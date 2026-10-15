# oyuncu_giysi.py — Ozyn'in bedeni: MODÜLER. Orion'un low-poly bedeni üzerine ayrı ayrı mesh olarak giysi varyantları (2026-10-15).
#
# Çalıştırma (repo kökünden; .blend'e YAZMAZ, yalnız glb üretir):
#   blender --background assets/kaynak/orion-lowpoly.blend --python tools/avatar-blender/oyuncu_giysi.py -- \
#       assets/oyuncu-beden.glb [onizleme-oneki]
#
# ÇIKTI (tek glb; Orion'la AYNI iskelet, AYNI ağırlıklar, AYNI 5 klip): her parça ayrı, adlı bir mesh + kendi malzemesi:
#   oyuncu_ten             çıplak gövde (her zaman görünür; ten rengi bu malzemenin rengi)
#   oyuncu_gomlek_uzun     gömlek, uzun kollu            ┐ ÜST (biri ya da hiçbiri)
#   oyuncu_gomlek_kisa     tişört/kısa kollu gömlek      ┘
#   oyuncu_ceket           ceket, önü açık, uzun kollu     DIŞ (var/yok)
#   oyuncu_pantolon_uzun   pantolon, paçası ayak bileğinde ┐ ALT (biri ya da hiçbiri)
#   oyuncu_pantolon_sort   şort, diz üstü                  ┘
#   oyuncu_ayakkabi        ayakkabı                        (var/yok)
# Oyun (world/player/oyuncuBeden.ts + bedenAyari.ts) hangilerinin görüneceğini ve her malzemenin rengini ÇALIŞMA ANINDA seçer: yeni giysi =
# bu betiğe bir varyant satırı + `bedenAyari.ts`te bir seçenek; kodun geri kalanı değişmez.
#
# Yöntem: giysi, gövde yüzlerinin ışınsal şişirilmiş KOPYASIdır (ağırlıklar kopyayla gelir → iskeletle birlikte hareket eder); kenarlar
# yüz seçimiyle değil DÜZLEMLE kesilir (etek/paça/yaka/manşet düz çizgi). Blender Z-yukarı, ön = -Y. Beden 1.744 m.
import bpy
import bmesh
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if not argv:
    raise SystemExit("kullanım: ... -- <cikti.glb> [onizleme-oneki]")
GLB = os.path.abspath(argv[0])
ONIZ = os.path.abspath(argv[1]) if len(argv) > 1 else None

# ── Ölçüler (m) ──────────────────────────────────────────────────────────────
GOMLEK_ETEK_Z = 0.90   # gömlek eteği (pantolonun İÇİNDE kalır: pantolon üstü bunun üstünde)
PANTOLON_UST_Z = 0.97  # pantolon/şort bel çizgisi
PACA_Z = 0.105         # uzun pantolon paçası (ayak bileğinin üstü)
SORT_Z = 0.52          # şort boyu (diz hizasının biraz üstü)
CEKET_ALT_Z = 0.86     # ceket etek ucu (kalçanın biraz altı)
CEKET_UST_Z = 1.50     # yaka çizgisi (boyun tabanı)
YAKA_UST_Z = 1.50      # gömlek yakası
AYAKKABI_UST_Z = 0.115 # ayakkabı bileği
ON_ACIKLIK = 0.034     # ceket önü: |x| < bu → açık
KOL_BILEK = 0.93       # kol ucu (manşet) — el başlangıcı
# gömlek < pantolon < ceket: aynı yüzeyin ışınsal ofsetleri, kesişmez. Ten yüzeyin sivri sırtlarından (karın kasları, baldır) daha ince bir kabuk
# DELİNİR (ten görünür); bu yüzden kalınlıklar ince değil, 1,3–2,8 cm.
SISME = {"gomlek": 0.013, "ceket": 0.028, "pantolon": 0.020, "ayakkabi": 0.014}

# Sol kol kemik parçaları (omuz→dirsek, dirsek→bilek); sağ kol x aynası. Kabuk bu eksenlere en yakın noktadan dışa şişer.
# Sol bacak kemik parçaları (kalça→diz, diz→bilek); sağ bacak x aynası. Bacak kabukları bu eksenlerden dışa şişer (sabit x=±0.11 alt bacakta sapıyordu → delik).
BACAK_PARCALARI = (((0.088, -0.047, 0.915), (0.136, 0.006, 0.497)), ((0.136, 0.006, 0.497), (0.179, 0.053, 0.085)))
KOL_PARCALARI = (((0.172, 0.02, 1.398), (0.299, 0.001, 1.14)), ((0.299, 0.001, 1.14), (0.388, -0.065, 0.915)))

# (varyant adı, doğrusal varsayılan renk). Her biri ayrı malzeme `oyuncu_<ad>`; renkleri oyun çalışma anında ezer.
VARYANTLAR = {
    "ten": (0.50, 0.28, 0.19),
    "gomlek_uzun": (0.62, 0.64, 0.66),
    "gomlek_kisa": (0.62, 0.64, 0.66),
    "ceket": (0.015, 0.035, 0.11),
    "pantolon_uzun": (0.05, 0.05, 0.06),
    "pantolon_sort": (0.05, 0.05, 0.06),
    "ayakkabi": (0.025, 0.014, 0.010),
}
SIRA = list(VARYANTLAR)

govde = bpy.data.objects["orion_govde"]
rig = bpy.data.objects["orion_rig"]
mesh = govde.data

# ── Malzemeler (varyant başına bir tane; tüm yüzler önce ten) ────────────────
MAT = {}
for ad in SIRA:
    m = bpy.data.materials.new(f"oyuncu_{ad}")
    m.use_nodes = True
    r, g, b = VARYANTLAR[ad]
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (r, g, b, 1.0)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    m.diffuse_color = (r, g, b, 1.0)
    MAT[ad] = m
IDX = {ad: i for i, ad in enumerate(SIRA)}
mesh.materials.clear()
for ad in SIRA:
    mesh.materials.append(MAT[ad])
for p in mesh.polygons:
    p.material_index = IDX["ten"]
    p.use_smooth = False

# ── Baskın kemik ailesi (yüz başına) ─────────────────────────────────────────
gad = {g.index: g.name for g in govde.vertex_groups}
def baskin(v):
    en = max(v.groups, key=lambda a: a.weight, default=None)
    return gad[en.group] if en else "hips"

def aile(ad):
    if ad in ("hips", "spine", "chest", "upperChest"):
        return "govde"
    if ad.endswith("Shoulder") or ad.endswith("UpperArm") or ad.endswith("LowerArm"):
        return "kol"
    if ad.endswith("UpperLeg") or ad.endswith("LowerLeg"):
        return "bacak"
    if ad.endswith("Foot") or ad.endswith("Toes"):
        return "ayak"
    if ad in ("neck", "head"):
        return "bas"
    return "el"  # el + parmaklar

ailesi = {}
for p in mesh.polygons:
    sayac = {}
    for vi in p.vertices:
        a = aile(baskin(mesh.vertices[vi]))
        sayac[a] = sayac.get(a, 0) + 1
    ailesi[p.index] = max(sayac, key=sayac.get)

bm = bmesh.new()
bm.from_mesh(mesh)
bm.faces.ensure_lookup_table()
bm.verts.ensure_lookup_table()
yuzler = list(bm.faces)
ORIJINAL = set(bm.verts)  # yalnız orijinal köşeler kabuk kaynağı olabilir

def merkez_z(f):
    return sum(v.co.z for v in f.verts) / len(f.verts)

def sisme_yonu(konum, kol_var, bacak_var, ayak_var):
    """Şişirme yönü köşe normali DEĞİL, ışınsal (eksenden dışa): kolda kol ekseninden, bacakta bacak ekseninden, gövdede orta eksenden.
    Köşe normali bel/kalça gibi yerlerde yukarı-aşağı baktığından kabuğu gövdenin içine sokup tırtıklatıyordu; ışınsal yön her yerde dışa
    bakar, z bileşeni hep 0 olduğundan etek/paça düzlemle kesilince düz kalır."""
    if kol_var and abs(konum.x) > 0.2:
        s = 1 if konum.x > 0 else -1
        en_iyi = None
        for p0, p1 in KOL_PARCALARI:
            a = Vector((s * p0[0], p0[1], p0[2])); b = Vector((s * p1[0], p1[1], p1[2]))
            d = b - a
            c = a + d * min(1.0, max(0.0, (konum - a).dot(d) / d.dot(d)))
            v = konum - c
            if en_iyi is None or v.length < en_iyi.length:
                en_iyi = v
        return en_iyi.normalized() if en_iyi.length > 1e-6 else en_iyi
    cx = 0.0
    cy = 0.0
    if ayak_var or bacak_var:
        # Her bacağın kendi ekseninden (aynı yükseklikteki eksen noktası) yatay dışa; kalçada (z>0.98) orta eksene yumuşak geçiş.
        s = 1 if konum.x > 0 else -1
        p0, p1 = BACAK_PARCALARI[0] if konum.z > BACAK_PARCALARI[0][1][2] else BACAK_PARCALARI[1]
        k = min(1.0, max(0.0, (p0[2] - konum.z) / (p0[2] - p1[2])))
        ax, ay = s * (p0[0] + (p1[0] - p0[0]) * k), p0[1] + (p1[1] - p0[1]) * k
        w = min(1.0, max(0.0, (0.98 - konum.z) / 0.1))
        cx, cy = ax * w, ay * w
    v = Vector((konum.x - cx, konum.y - cy, 0.0))
    return v.normalized() if v.length > 1e-6 else v

def kabuk(secili, sisme, varyant, kol_var=False, bacak_var=False, ayak_var=False):
    """Yüzleri kopyala, ışınsal şişir, varyant malzemesini ata; yeni geometriyi (köşe/kenar/yüz) döndür."""
    kopya = bmesh.ops.duplicate(bm, geom=secili)
    for eski, yeni in kopya["vert_map"].items():
        if eski in ORIJINAL:
            yeni.co = eski.co + sisme_yonu(eski.co, kol_var, bacak_var, ayak_var) * sisme
    for g in kopya["geom"]:
        if isinstance(g, bmesh.types.BMFace):
            g.material_index = IDX[varyant]
            g.smooth = False
    return kopya["geom"]

def varyant_yuzleri(varyant):
    """Bisect bölünce yeni yüzler üretir ve bunlar önceki `geom` listesinde YOKTUR; sonradan silme/denetim varyantın malzeme dizinine göre yapılır."""
    return [f for f in bm.faces if f.is_valid and f.material_index == IDX[varyant]]

def manset(geom, nokta, eksen, varyant):
    """Kol manşeti: düzlemin ötesindeki KOL yüzlerini sil. Düzlem sonsuzdur ve kol aşağı baktığından alt gövdeyi de kapsar (kısa kol gömlekte
    karın boşluğu böyle çıktı) → yalnız gövdeden uzak (|x|>0.19) yüzler silinir."""
    bmesh.ops.bisect_plane(bm, geom=canli(geom), dist=1e-5, plane_co=nokta, plane_no=eksen)
    sil = [f for f in varyant_yuzleri(varyant)
           if (f.calc_center_median() - nokta).dot(eksen) > 1e-5 and abs(f.calc_center_median().x) > 0.19]
    bmesh.ops.delete(bm, geom=sil, context="FACES")
    return geom

def canli(geom):
    return [g for g in geom if g.is_valid]

def kes(geom, nokta, yon, dis_sil=False, ic_sil=False):
    """Düzlemden kes; `yon` tarafı 'dış'. Dönüş: kalan geometri."""
    bmesh.ops.bisect_plane(bm, geom=canli(geom), dist=1e-5, plane_co=nokta, plane_no=yon,
                           clear_outer=dis_sil, clear_inner=ic_sil)
    return geom

YUKARI, ASAGI = Vector((0, 0, 1)), Vector((0, 0, -1))
fam = lambda f: ailesi[f.index]

# ── ÜST: gömlek (uzun / kısa kollu) ──────────────────────────────────────────
def gomlek(varyant, kisa):
    sec = [f for f in yuzler if (fam(f) in ("govde", "bacak") and GOMLEK_ETEK_Z - 0.05 <= merkez_z(f) <= YAKA_UST_Z + 0.05)
           or (fam(f) == "kol" and merkez_z(f) >= KOL_BILEK - 0.15)]
    g = kabuk(sec, SISME["gomlek"], varyant, kol_var=True)
    g = kes(g, Vector((0, 0, GOMLEK_ETEK_Z)), YUKARI, ic_sil=True)
    g = kes(g, Vector((0, 0, YAKA_UST_Z)), YUKARI, dis_sil=True)
    for yon in (1, -1):  # manşet: uzun kolda bilekte, kısa kolda üst kolun ortasında
        if kisa:
            p0, p1 = KOL_PARCALARI[0]
            nokta = Vector((yon * (p0[0] + (p1[0] - p0[0]) * 0.55), p0[1] + (p1[1] - p0[1]) * 0.55, p0[2] + (p1[2] - p0[2]) * 0.55))
        else:
            p0, p1 = KOL_PARCALARI[1]
            nokta = Vector((yon * p1[0], p1[1], p1[2])) + (Vector((yon * (p1[0] - p0[0]), p1[1] - p0[1], p1[2] - p0[2]))).normalized() * 0.012
        eksen = (Vector((yon * p1[0], p1[1], p1[2])) - Vector((yon * p0[0], p0[1], p0[2]))).normalized()
        g = manset(g, nokta, eksen, varyant)

gomlek("gomlek_uzun", kisa=False)
gomlek("gomlek_kisa", kisa=True)

# ── DIŞ: ceket (önü açık, uzun kollu) ────────────────────────────────────────
def ceket():
    # Gövde bölgesi SINIFA DEĞİL YÜKSEKLİĞE göre seçilir: z 0.86–1.0 arası yüzlerin yarısı "bacak" baskındır (üst uyluk); sınıfa göre
    # seçince etek tırtıklı bir sınır çiziyordu.
    sec = [f for f in yuzler if (fam(f) in ("govde", "bacak") and CEKET_ALT_Z - 0.05 <= merkez_z(f) <= CEKET_UST_Z + 0.05)
           or (fam(f) == "kol" and merkez_z(f) >= KOL_BILEK - 0.15)]
    g = kabuk(sec, SISME["ceket"], "ceket", kol_var=True)
    g = kes(g, Vector((0, 0, CEKET_ALT_Z)), YUKARI, ic_sil=True)
    g = kes(g, Vector((0, 0, CEKET_UST_Z)), YUKARI, dis_sil=True)
    p0, p1 = KOL_PARCALARI[1]
    for yon in (1, -1):
        bilek = Vector((yon * p1[0], p1[1], p1[2]))
        eksen = (bilek - Vector((yon * p0[0], p0[1], p0[2]))).normalized()
        g = manset(g, bilek + eksen * 0.012, eksen, "ceket")
    for x0 in (ON_ACIKLIK, -ON_ACIKLIK):  # ön açıklık kenarları düz
        g = kes(g, Vector((x0, 0, 0)), Vector((1, 0, 0)))
    sil = []
    for e in varyant_yuzleri("ceket"):
        c = e.calc_center_median()
        if abs(c.x) < ON_ACIKLIK - 1e-4 and c.y < -0.03 and CEKET_ALT_Z - 0.01 < c.z < CEKET_UST_Z:
            sil.append(e)
    bmesh.ops.delete(bm, geom=sil, context="FACES")

ceket()

# ── ALT: pantolon (uzun) / şort ──────────────────────────────────────────────
def pantolon(varyant, alt_z):
    sec = [f for f in yuzler if fam(f) == "bacak" or (fam(f) == "govde" and merkez_z(f) < PANTOLON_UST_Z + 0.04)]
    g = kabuk(sec, SISME["pantolon"], varyant, bacak_var=True)
    g = kes(g, Vector((0, 0, PANTOLON_UST_Z)), YUKARI, dis_sil=True)
    g = kes(g, Vector((0, 0, alt_z)), ASAGI, dis_sil=True)

pantolon("pantolon_uzun", PACA_Z)
pantolon("pantolon_sort", SORT_Z)

# ── Ayakkabı ─────────────────────────────────────────────────────────────────
sec = [f for f in yuzler if fam(f) == "ayak" or (fam(f) == "bacak" and merkez_z(f) < AYAKKABI_UST_Z + 0.03)]
g = kabuk(sec, SISME["ayakkabi"], "ayakkabi", ayak_var=True)
g = kes(g, Vector((0, 0, AYAKKABI_UST_Z)), YUKARI, dis_sil=True)

bm.to_mesh(mesh)
bm.free()
mesh.update()

# ── Varyant başına AYRI nesne (ağırlıklar + iskelet bağı kopyayla gelir) ─────
koleksiyon = bpy.context.scene.collection
parcalar = {}
for ad in SIRA:
    ob = govde.copy()
    ob.data = govde.data.copy()
    ob.name = f"oyuncu_{ad}"
    ob.data.name = f"oyuncu_{ad}"
    koleksiyon.objects.link(ob)
    b2 = bmesh.new()
    b2.from_mesh(ob.data)
    sil = [f for f in b2.faces if f.material_index != IDX[ad]]
    bmesh.ops.delete(b2, geom=sil, context="FACES")
    yalniz = [v for v in b2.verts if not v.link_faces]
    bmesh.ops.delete(b2, geom=yalniz, context="VERTS")
    for f in b2.faces:
        f.material_index = 0
    b2.to_mesh(ob.data)
    b2.free()
    ob.data.materials.clear()
    ob.data.materials.append(MAT[ad])
    parcalar[ad] = ob
    print(f"[OYUNCU] {ob.name}: {sum(len(p.vertices) - 2 for p in ob.data.polygons)} üçgen")

# Kaynak gövde ve gereksizler çıksın; yalnız iskelet + parçalar kalır.
for x in list(bpy.data.objects):
    if x is not rig and x not in parcalar.values():
        bpy.data.objects.remove(x, do_unlink=True)

# ── Dışa aktar (disa_aktar.py ile aynı NLA düzeni) ───────────────────────────
vl = bpy.context.view_layer
rig.animation_data.action = None
for b in rig.pose.bones:
    b.rotation_mode = "XYZ"; b.rotation_euler = (0, 0, 0); b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0)
ad = rig.animation_data
for t in list(ad.nla_tracks):
    ad.nla_tracks.remove(t)
for n in ("bosta", "yuru", "otur", "oturuyor", "kalk"):
    a = bpy.data.actions[n]
    tr = ad.nla_tracks.new(); tr.name = n
    tr.strips.new(n, int(a.frame_range[0]), a); tr.mute = True
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for ob in parcalar.values():
    ob.select_set(True)
vl.objects.active = rig
os.makedirs(os.path.dirname(GLB), exist_ok=True)
with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[rig, *parcalar.values()]):
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True,
        export_yup=True, export_apply=False, export_skins=True, export_def_bones=True,
        export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
        export_frame_step=1, export_morph=False, export_materials="EXPORT", export_extras=False)
print(f"[OYUNCU] glb: {GLB} ({os.path.getsize(GLB)} bayt)")

# ── Önizleme (dışa aktarılmaz): iki kombinasyon, önden + bel çevresi yakın ───
if ONIZ:
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.render.resolution_x, sc.render.resolution_y = 600, 900
    cam_d = bpy.data.cameras.new("kam"); cam = bpy.data.objects.new("kam", cam_d)
    sc.collection.objects.link(cam); sc.camera = cam
    cam_d.type = "ORTHO"
    KOMBINASYONLAR = {
        "a": ("ten", "gomlek_uzun", "ceket", "pantolon_uzun", "ayakkabi"),
        "b": ("ten", "gomlek_kisa", "pantolon_sort", "ayakkabi"),
    }
    BAKISLAR = {"on": (0, -4, 0.9, 2.0), "yakin": (2.4, -3.2, 1.15, 0.9)}
    for kad, acik in KOMBINASYONLAR.items():
        for ad, ob in parcalar.items():
            ob.hide_render = ad not in acik
        for bad, (kx, ky, kz, olcek) in BAKISLAR.items():
            cam_d.ortho_scale = olcek
            cam.location = (kx, ky, kz)
            cam.rotation_euler = (Vector((0, 0, kz)) - cam.location).to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = f"{ONIZ}-{kad}-{bad}.png"
            bpy.ops.render.render(write_still=True)
    print("[OYUNCU] onizleme:", ONIZ)
