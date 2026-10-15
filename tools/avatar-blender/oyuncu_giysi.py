# oyuncu_giysi.py — Ozyn'in bedeni: Orion'un low-poly bedeni, FARKLI renkte, pantolon + gömlek + ceketli (2026-10-15).
#
# Çalıştırma (repo kökünden; .blend'e YAZMAZ, yalnız glb üretir):
#   blender --background assets/kaynak/orion-lowpoly.blend --python tools/avatar-blender/oyuncu_giysi.py -- \
#       assets/oyuncu-beden.glb [onizleme-oneki]
#
# Aynı iskelet (52 kemik, aynı 5 klip) ve aynı ağırlıklar: oyuncu bedeni Orion'un yürüme/oturma kliplerini olduğu gibi kullanır.
# Giysi ayrı kemik/ağırlık İSTEMEZ: gövdenin yüzleri baskın kemik grubuna ve yüksekliğe göre malzemeye ayrılır; ceket,
# gövde+kol yüzlerinin normal boyunca şişirilmiş KOPYASIdır (ağırlıklar kopyayla gelir) ve önü açıktır → gömlek görünür.
# Blender Z-yukarı, ön = -Y. Beden 1.744 m; bel çizgisi z=1.0, ayak bileği z=0.075.
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

PANTOLON_UST_Z = 0.83  # pantolon kabuğunun üstü: ceket eteğinin (0.86) ALTINDA biter → iki kabuk kesişip dişlenmez
BEL_Z = 1.0          # pantolon üstü / gömlek altı
BILEK_Z = 0.075      # pantolon paçası; altı ayakkabı
CEKET_ALT_Z = 0.86   # ceket etek ucu (kalçanın biraz altı)
CEKET_UST_Z = 1.50   # yaka çizgisi (boyun tabanı)
SISME = 0.022        # ceket şişmesi (m); pantolon 0.013 → etek ucunda pantolonla çakışıp dişlenmesin
ON_ACIKLIK = 0.034   # ceket önü: |x| < bu → açık
KOL_BILEK = 0.93     # kol ucu (ceket manşeti) — el başlangıcı

# Doğrusal renkler (glTF doğrusal okur).
RENK = {
    "oyuncu_ten": (0.50, 0.28, 0.19, 1.0),
    "oyuncu_gomlek": (0.62, 0.64, 0.66, 1.0),
    "oyuncu_pantolon": (0.05, 0.05, 0.06, 1.0),
    "oyuncu_ayakkabi": (0.025, 0.014, 0.010, 1.0),
    "oyuncu_ceket": (0.015, 0.035, 0.11, 1.0),
}
SIRA = list(RENK)

govde = bpy.data.objects["orion_govde"]
rig = bpy.data.objects["orion_rig"]
mesh = govde.data

# ── Malzemeler ───────────────────────────────────────────────────────────────
mesh.materials.clear()
for ad in SIRA:
    m = bpy.data.materials.new(ad)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = RENK[ad]
    bsdf.inputs["Roughness"].default_value = 0.9
    m.diffuse_color = RENK[ad]
    mesh.materials.append(m)
IDX = {ad: i for i, ad in enumerate(SIRA)}

# ── Baskın kemik grubu (köşe başına) ─────────────────────────────────────────
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

def yuz_ailesi(p):
    sayac = {}
    for vi in p.vertices:
        a = aile(baskin(mesh.vertices[vi]))
        sayac[a] = sayac.get(a, 0) + 1
    return max(sayac, key=sayac.get)

def yuz_z(p):
    return sum(mesh.vertices[vi].co.z for vi in p.vertices) / len(p.vertices)

# ── Gövde yüzlerini malzemeye ayır ───────────────────────────────────────────
ailesi = {}
for p in mesh.polygons:
    a = yuz_ailesi(p)
    z = yuz_z(p)
    ailesi[p.index] = a
    if a in ("bacak", "govde") and z >= PANTOLON_UST_Z and z < BEL_Z + 0.55:
        mal = "oyuncu_gomlek"  # pantolon kabuğunun üstü: gömlek (ceket önü açıkken bel hizasına kadar görünür, "içine" sokulu)
    elif a == "bacak" or (a == "govde" and z < BEL_Z):
        mal = "oyuncu_pantolon" if z > BILEK_Z else "oyuncu_ayakkabi"
    elif a == "ayak":
        mal = "oyuncu_ayakkabi"
    elif a in ("govde", "kol"):
        mal = "oyuncu_gomlek"
    else:
        mal = "oyuncu_ten"  # baş, boyun, eller
    p.material_index = IDX[mal]
    p.use_smooth = False

# ── Giysi kabukları: gövde yüzlerinin şişirilmiş kopyası, DÜZ kesilmiş kenarlı ─
# Kopya köşeler ağırlıkları taşır (iskeletle birlikte hareket eder). Kenarlar yüz seçimiyle değil DÜZLEMLE kesilir:
# etek, paça, yaka ve manşet tırtıksız, düz çizgi olur.
bm = bmesh.new()
bm.from_mesh(mesh)
bm.faces.ensure_lookup_table()
bm.verts.ensure_lookup_table()
bm.normal_update()
normal = {v: v.normal.copy() for v in bm.verts}  # yalnız ORİJİNAL köşeler (kopya köşeler anahtar olmaz)

def yuz_merkez_z(f):
    return sum(v.co.z for v in f.verts) / len(f.verts)

# Sol kol kemik parçaları (omuz→dirsek, dirsek→bilek); sağ kol x aynası. Kabuk bu eksenlere en yakın noktadan dışa şişer.
KOL_PARCALARI = (((0.172, 0.02, 1.398), (0.299, 0.001, 1.14)), ((0.299, 0.001, 1.14), (0.388, -0.065, 0.915)))

def sisme_yonu(konum, kol_var, bacak_var):
    """Şişirme yönü köşe normali DEĞİL, ışınsal (eksenden dışa): kolda kol ekseninden, bacakta bacak ekseninden, gövdede orta eksenden.
    Köşe normali bel/kalça gibi yerlerde yukarı-aşağı baktığından kabuğu gövdenin İÇİNE sokup tırtıklatıyordu; ışınsal yön her yerde dışa bakar,
    z bileşeni hep 0 olduğundan etek/paça düzlemle kesilince düz kalır."""
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
    if bacak_var:
        # Kalçada (z>0.98) orta eksen, dizde ve aşağıda her bacağın kendi ekseni (x=±0.11); arası yumuşak geçiş.
        w = min(1.0, max(0.0, (0.98 - konum.z) / 0.1))
        cx = (0.11 if konum.x > 0 else -0.11) * w
    v = Vector((konum.x - cx, konum.y, 0.0))
    return v.normalized() if v.length > 1e-6 else v

def kabuk(yuzler, sisme, malzeme, kol_var=False, bacak_var=False):
    """Yüzleri kopyala, kısıtlı normal boyunca şişir, malzemeyi ata; yeni geometriyi (köşe/kenar/yüz) döndür."""
    kopya = bmesh.ops.duplicate(bm, geom=yuzler)
    for eski, yeni in kopya["vert_map"].items():
        if eski in normal:
            yeni.co = eski.co + sisme_yonu(eski.co, kol_var, bacak_var) * sisme
    for g in kopya["geom"]:
        if isinstance(g, bmesh.types.BMFace):
            g.material_index = IDX[malzeme]
            g.smooth = False
    return kopya["geom"]

def canli(geom):
    return [g for g in geom if g.is_valid]

def kes(geom, nokta, yon, dis_sil=False, ic_sil=False):
    """Düzlemden kes; yön tarafı 'dış'. Dönüş: kalan geometri."""
    bmesh.ops.bisect_plane(bm, geom=canli(geom), dist=1e-5, plane_co=nokta, plane_no=yon,
                           clear_outer=dis_sil, clear_inner=ic_sil)
    return geom

yuzler = list(bm.faces)

# PANTOLON: bacak yüzleri + belin altındaki gövde yüzleri. Bol kesim: 1.3 cm. Üstten bel, alttan paça (ayak bileğinin üstü).
pantolon_yuz = [f for f in yuzler if ailesi[f.index] == "bacak" or (ailesi[f.index] == "govde" and yuz_merkez_z(f) < BEL_Z + 0.04)]
p_geom = kabuk(pantolon_yuz, 0.013, "oyuncu_pantolon", bacak_var=True)
p_geom = kes(p_geom, Vector((0, 0, PANTOLON_UST_Z)), Vector((0, 0, 1)), dis_sil=True)
p_geom = kes(p_geom, Vector((0, 0, BILEK_Z + 0.03)), Vector((0, 0, -1)), dis_sil=True)

# CEKET: gövde + kol yüzleri. Üstten yaka, alttan etek (kalça altı), kollar bileğe kadar, önü açık.
# Gövde bölgesi SINIFA DEĞİL YÜKSEKLİĞE göre seçilir: z 0.86–1.0 arası yüzlerin yarısı "bacak" baskındır (üst uyluk); sınıfa
# göre seçince etek tırtıklı bir sınır çiziyordu.
ceket_yuz = [f for f in yuzler if (ailesi[f.index] in ("govde", "bacak") and CEKET_ALT_Z - 0.05 <= yuz_merkez_z(f) <= CEKET_UST_Z + 0.05)
             or (ailesi[f.index] == "kol" and yuz_merkez_z(f) >= KOL_BILEK - 0.15)]
c_geom = kabuk(ceket_yuz, SISME, "oyuncu_ceket", kol_var=True)
c_geom = kes(c_geom, Vector((0, 0, CEKET_ALT_Z)), Vector((0, 0, 1)), ic_sil=True)   # etek: altı gitsin
c_geom = kes(c_geom, Vector((0, 0, CEKET_UST_Z)), Vector((0, 0, 1)), dis_sil=True)  # yaka: üstü gitsin
for yon in (1, -1):  # manşet: bilek noktasında, kol ekseni boyunca
    bilek = Vector((yon * 0.388, -0.065, 0.915))
    eksen = Vector((yon * 0.089, -0.066, -0.225)).normalized()  # elin yönü
    c_geom = kes(c_geom, bilek + eksen * 0.012, eksen, dis_sil=True)
for x0 in (ON_ACIKLIK, -ON_ACIKLIK):  # ön açıklık kenarları düz olsun
    c_geom = kes(c_geom, Vector((x0, 0, 0)), Vector((1, 0, 0)))
sil = []
for g in canli(c_geom):
    if isinstance(g, bmesh.types.BMFace):
        c = g.calc_center_median()
        if abs(c.x) < ON_ACIKLIK - 1e-4 and c.y < -0.03 and CEKET_ALT_Z - 0.01 < c.z < CEKET_UST_Z:
            sil.append(g)
bmesh.ops.delete(bm, geom=sil, context="FACES")
kalan_on = [g for g in canli(c_geom) if isinstance(g, bmesh.types.BMFace) and abs(g.calc_center_median().x) < ON_ACIKLIK - 1e-3
            and g.calc_center_median().y < -0.03 and CEKET_ALT_Z < g.calc_center_median().z < CEKET_UST_Z]
print("[OYUNCU] ön açıklıkta kalan ceket yüzü:", len(kalan_on))

bm.to_mesh(mesh)
bm.free()
mesh.update()

# ── Dışa aktar (disa_aktar.py ile aynı NLA düzeni) ───────────────────────────
for x in list(bpy.data.objects):
    if x not in (govde, rig):
        bpy.data.objects.remove(x, do_unlink=True)
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
rig.select_set(True); govde.select_set(True); vl.objects.active = rig
os.makedirs(os.path.dirname(GLB), exist_ok=True)
with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[rig, govde]):
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True,
        export_yup=True, export_apply=False, export_skins=True, export_def_bones=True,
        export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
        export_frame_step=1, export_morph=False, export_materials="EXPORT", export_extras=False)
print(f"[OYUNCU] glb: {GLB} ({os.path.getsize(GLB)} bayt) ucgen={sum(len(p.vertices) - 2 for p in mesh.polygons)}")

# ── Önizleme (dışa aktarılmaz): önden + yandan, çalışma ekranı yazı tipi ─────
if ONIZ:
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.render.resolution_x, sc.render.resolution_y = 600, 900
    cam_d = bpy.data.cameras.new("kam"); cam = bpy.data.objects.new("kam", cam_d)
    sc.collection.objects.link(cam); sc.camera = cam
    cam_d.type = "ORTHO"; cam_d.ortho_scale = 2.0
    # (ad, kamera x, y, bakılan z, ortho ölçek): bütün beden önden/yandan + bel çevresi yakın çekim (etek/ön açıklık dikişleri)
    for ad_, (kx, ky, kz, olcek) in {"on": (0, -4, 0.9, 2.0), "yan": (4, 0, 0.9, 2.0), "yakin": (2.4, -3.2, 1.15, 0.9)}.items():
        cam_d.ortho_scale = olcek
        cam.location = (kx, ky, kz)
        d = Vector((0, 0, kz)) - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = f"{ONIZ}-{ad_}.png"
        bpy.ops.render.render(write_still=True)
    print("[OYUNCU] onizleme:", ONIZ)
