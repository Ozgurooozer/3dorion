# assets/kaynak/sehir-kiti.py — Modüler siberpunk şehir kitini nesne nesne web varlığına çevirir.
#
# Çalıştırma (repo kökünden):
#   blender --background "C:/Users/ozigo/Desktop/city build test moduler 1.blend" \
#       --python assets/kaynak/sehir-kiti.py -- --cikti assets/sehir [--onizleme-yok]
#
# Ne yapar: .blend'deki her MESH/CURVE nesnesi için
#   <cikti>/<Ad>.glb             — tek nesne, glTF ikili, +Y yukarı, değiştiriciler uygulanmış, malzemeli
#   <cikti>/onizleme/<Ad>.png    — 128×128 Workbench küçük resmi (koyu #1a1f2a zemin, 3/4 ortografik)
#   <cikti>/katalog.json         — varlık listesi (kategori, dosya, boyut, üçgen, bayt); kategori, sonra ad sırası
# .blend KAYDEDİLMEZ; bütün değişiklikler (yeniden adlandırma, malzeme rengi) yalnız bellekte.
#
# Pivot: her nesnenin dönüşü ve ölçeği geometriye işlenir, sonra geometri sınır kutusunun ALT-ORTASI
# (x, y ortası, z en alt) orijine gelecek biçimde kaydırılır. Kitte çoğu parça orijinde üst üste durur ama
# bazıları uzakta (ör. DETAIL_Manhole_Cover (198, 840)) — kayma atılır, Babylon'da yerleştirmeyi tarayıcı yapar.
#
# Eksen: Blender (X, Y, Z yukarı) → glTF (X, Z, -Y). katalog `boyut` = [X genişlik, Y yükseklik, Z derinlik]
# glTF/Babylon eksenlerinde (metre); yani Blender boyutlarından [dx, dz, dy].
#
# Işıyan malzemeler: adı neon/glow/screen/logo/hologram içeren malzemenin ışıması yoksa (güç 0 ya da renk
# siyah) Emission Color = Base Color, güç 1 yapılır → glTF emissiveFactor sıfır olmaz. Kitte bunlar zaten
# ışıyor (güç 5–15; dışa aktarıcı 1'in üstünü KHR_materials_emissive_strength olarak yazar).
#
# Tekrar üretilebilirlik: rastgelelik yok; nesneler ada göre sıralı işlenir; PNG'ye tarih/saat damgası
# yazılmaz; çıktı klasöründeki eski glb/png/katalog önce silinir (kitten çıkan parça artık dosya bırakmaz).
import bpy
import json
import math
import os
import re
import sys

from mathutils import Matrix, Vector

# ── Argümanlar ───────────────────────────────────────────────────────────────
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(ad, varsayilan=None):
    return argv[argv.index(ad) + 1] if ad in argv else varsayilan


CIKTI = arg("--cikti")
ONIZLEME_YOK = "--onizleme-yok" in argv
if not CIKTI:
    raise SystemExit("kullanım: blender --background <kit.blend> --python sehir-kiti.py -- --cikti <klasör> [--onizleme-yok]")

CIKTI = os.path.abspath(CIKTI)
ONIZ_KLASOR = os.path.join(CIKTI, "onizleme")
# katalogdaki yollar assets/ köküne göre: "sehir/<Ad>.glb"
ONEK = os.path.basename(CIKTI.rstrip("\\/"))
KAYNAK_ADI = os.path.basename(bpy.data.filepath) or "?"

# ── Kategori: ad öneki → katalog kategorisi ─────────────────────────────────
# Sıra önemli: uzun önek önce (NEON_BLD, "NEON" ile başlayan başka önek gelirse karışmasın).
KATEGORI = (
    ("CORP_BLD_", "bina"),
    ("HARBOR_BLD_", "bina"),
    ("NEON_BLD_", "bina"),
    ("SLUM_BLD_", "bina"),      # görevde listelenmemişti, kitte 3 parça var (Shack, ShopHouse, StackedBlock)
    ("CORP_MOD_", "modul"),
    ("DETAIL_", "detay"),
    ("ELEV_", "yukseltilmis"),
    ("HARBOR_PROP_", "liman"),
    ("INFRA_", "altyapi"),
    ("SIGN_", "tabela"),
    ("PROP_", "esya"),
    ("ROAD_", "yol"),
)


def kategori_bul(ad):
    for onek, kat in KATEGORI:
        if ad.startswith(onek):
            return kat
    return None


ISIYAN = re.compile(r"neon|glow|screen|logo|hologram", re.IGNORECASE)

sahne = bpy.context.scene
katman = bpy.context.view_layer

# ── Çıktı klasörü: eskileri temizle ──────────────────────────────────────────
os.makedirs(ONIZ_KLASOR, exist_ok=True)
for klasor, uzanti in ((CIKTI, ".glb"), (ONIZ_KLASOR, ".png")):
    for f in os.listdir(klasor):
        if f.lower().endswith(uzanti):
            os.remove(os.path.join(klasor, f))
if os.path.exists(os.path.join(CIKTI, "katalog.json")):
    os.remove(os.path.join(CIKTI, "katalog.json"))


# ── Malzemeler (yalnız bellekte) ─────────────────────────────────────────────
def principled(m):
    if not m.node_tree:
        return None
    for n in m.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return n
    return None


isitilan = []
for m in sorted(bpy.data.materials, key=lambda x: x.name):
    p = principled(m)
    if p is None:
        continue
    taban = p.inputs["Base Color"]
    if not taban.is_linked:
        # Workbench önizlemesi Principled'ı değil "viewport display" rengini (diffuse_color) çizer;
        # kitte hepsi varsayılan 0.8 gri → önizlemede her şey gri olurdu.
        m.diffuse_color = tuple(taban.default_value)
    if ISIYAN.search(m.name):
        renk = p.inputs["Emission Color"]
        guc = p.inputs["Emission Strength"]
        siyah = (not renk.is_linked) and max(renk.default_value[:3]) <= 0.0
        if (not guc.is_linked and guc.default_value <= 0.0) or siyah:
            if not taban.is_linked and not renk.is_linked:
                renk.default_value = tuple(taban.default_value)
            if not guc.is_linked and guc.default_value <= 0.0:
                guc.default_value = 1.0
            isitilan.append(m.name)
print(f"[SEHIR] ışıması eklenen malzeme: {isitilan or 'yok (hepsi zaten ışıyor)'}")

# ── Kaynak nesneler ──────────────────────────────────────────────────────────
kaynaklar = sorted((o for o in sahne.objects if o.type in ("MESH", "CURVE")), key=lambda o: o.name)
atlanan = []
for o in sahne.objects:
    o.hide_render = True  # önizlemede yalnız işlenen geçici nesne görünsün
    if o.type not in ("MESH", "CURVE"):
        atlanan.append((o.name, f"tür {o.type}"))

# ── Önizleme kurulumu: Workbench, koyu zemin, ortografik kamera ─────────────
if not ONIZLEME_YOK:
    sahne.render.engine = "BLENDER_WORKBENCH"
    sahne.render.resolution_x = sahne.render.resolution_y = 128
    sahne.render.resolution_percentage = 100
    sahne.render.film_transparent = False
    sahne.render.image_settings.file_format = "PNG"
    sahne.render.image_settings.color_mode = "RGB"
    # PNG'ye tarih/saat/ana makine metadatası yazılmasın (bayt eşitliği).
    for ozellik in dir(sahne.render):
        if ozellik.startswith("use_stamp"):
            try:
                setattr(sahne.render, ozellik, False)
            except (AttributeError, TypeError):
                pass
    sahne.view_settings.view_transform = "Standard"
    sahne.view_settings.look = "None"
    sahne.view_settings.exposure = 0.0
    sahne.view_settings.gamma = 1.0
    golge = sahne.display.shading
    golge.light = "STUDIO"
    golge.color_type = "MATERIAL"
    golge.show_cavity = False
    golge.show_object_outline = False
    golge.show_shadows = False
    if sahne.world is None:
        sahne.world = bpy.data.worlds.new("sehir_onizleme")
    # #1a1f2a (sRGB) → doğrusal; Standard görünüm geri sRGB'ye çevirir.
    srgb = lambda c: (c / 255 / 12.92) if c / 255 <= 0.04045 else ((c / 255 + 0.055) / 1.055) ** 2.4
    sahne.world.color = (srgb(0x1A), srgb(0x1F), srgb(0x2A))

    kamera_veri = bpy.data.cameras.new("sehir_kamera")
    kamera_veri.type = "ORTHO"
    kamera = bpy.data.objects.new("sehir_kamera", kamera_veri)
    sahne.collection.objects.link(kamera)
    sahne.camera = kamera
    # 3/4 bakış: önden-sağdan-yukarıdan (Blender'da ön = -Y).
    BAKIS = Vector((1.0, -1.25, 0.9)).normalized()
    KAMERA_ROT = (-BAKIS).to_track_quat("-Z", "Y")


def onizle(kutu_min, kutu_max, yol):
    """Sınır kutusunu kadraja alan ortografik kamera; 8 köşenin kamera düzlemine izdüşümünden ölçek."""
    rot = KAMERA_ROT.to_matrix()
    sag, yukari = rot.col[0], rot.col[1]
    koseler = [Vector((x, y, z)) for x in (kutu_min.x, kutu_max.x) for y in (kutu_min.y, kutu_max.y)
               for z in (kutu_min.z, kutu_max.z)]
    us = [k.dot(sag) for k in koseler]
    vs = [k.dot(yukari) for k in koseler]
    merkez = sag * ((min(us) + max(us)) / 2) + yukari * ((min(vs) + max(vs)) / 2)
    olcek = max(max(us) - min(us), max(vs) - min(vs), 0.01) * 1.1
    cap = (kutu_max - kutu_min).length
    kamera.location = merkez + BAKIS * (cap + 1.0)
    kamera.rotation_euler = KAMERA_ROT.to_euler()
    kamera_veri.ortho_scale = olcek
    kamera_veri.clip_start = 0.01
    kamera_veri.clip_end = cap * 2 + 2.0
    sahne.render.filepath = yol
    bpy.ops.render.render(write_still=True)


# ── Dışa aktarıcı seçenekleri (sürüme göre olmayanlar düşer) ────────────────
GLTF_SECENEK = dict(
    export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
    export_cameras=False, export_lights=False, export_animations=False, export_extras=False,
    export_materials="EXPORT", export_texcoords=False,  # kitte doku yok: UV taşımak boşa bayt
    export_normals=True, export_tangents=False, export_vertex_color="NONE", export_attributes=False,
    export_draco_mesh_compression_enable=False,  # Babylon'da draco çözücü gerekmesin
)
_gecerli = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
GLTF_SECENEK = {k: v for k, v in GLTF_SECENEK.items() if k in _gecerli}

# ── Ana döngü ───────────────────────────────────────────────────────────────
varliklar = []
depsgraph = bpy.context.evaluated_depsgraph_get()
for ob in kaynaklar:
    ad = ob.name
    kat = kategori_bul(ad)
    if kat is None:
        atlanan.append((ad, "bilinmeyen önek"))
        continue

    # Değerlendirilmiş nesneden yeni mesh: değiştiriciler uygulanır, eğri (CURVE) mesh'e döner.
    ob_eval = ob.evaluated_get(depsgraph)
    me = bpy.data.meshes.new_from_object(ob_eval, preserve_all_data_layers=False, depsgraph=depsgraph)
    if len(me.vertices) == 0:
        bpy.data.meshes.remove(me)
        atlanan.append((ad, "boş geometri"))
        continue
    # Geçici nesne kaynağın adını alsın (glTF düğüm/mesh adı = varlık adı): kaynağı bellekte yeniden adlandır.
    ob.name = ad + ".kaynak"
    ob.data.name = ad + ".kaynak"
    me.name = ad

    # Dönüş + ölçek geometriye; ayna ölçekte yüzler ters döner, düzelt.
    dogrusal = ob.matrix_world.to_3x3()
    me.transform(dogrusal.to_4x4())
    if dogrusal.determinant() < 0:
        me.flip_normals()
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    alt_orta = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
    me.transform(Matrix.Translation(-alt_orta))
    kutu_min = Vector((min(xs), min(ys), min(zs))) - alt_orta
    kutu_max = Vector((max(xs), max(ys), max(zs))) - alt_orta
    me.calc_loop_triangles()
    ucgen = len(me.loop_triangles)

    yeni = bpy.data.objects.new(ad, me)
    sahne.collection.objects.link(yeni)
    for o in sahne.objects:
        o.select_set(False)
    yeni.select_set(True)
    katman.objects.active = yeni
    katman.update()

    glb = os.path.join(CIKTI, ad + ".glb")
    bpy.ops.export_scene.gltf(filepath=glb, **GLTF_SECENEK)

    if not ONIZLEME_YOK:
        onizle(kutu_min, kutu_max, os.path.join(ONIZ_KLASOR, ad + ".png"))

    boyut = kutu_max - kutu_min
    varliklar.append({
        "ad": ad,
        "kategori": kat,
        "dosya": f"{ONEK}/{ad}.glb",
        "onizleme": f"{ONEK}/onizleme/{ad}.png",
        # glTF/Babylon eksenleri: x, y (yükseklik = Blender z), z (derinlik = Blender y)
        "boyut": [round(boyut.x, 3), round(boyut.z, 3), round(boyut.y, 3)],
        "ucgen": ucgen,
        "bayt": os.path.getsize(glb),
    })
    print(f"[SEHIR] {kat:13s} {ad:36s} ucgen={ucgen:6d} bayt={os.path.getsize(glb):8d}")

    bpy.data.objects.remove(yeni)
    bpy.data.meshes.remove(me)

varliklar.sort(key=lambda v: (v["kategori"], v["ad"]))
katalog = {"surum": 1, "kaynak": KAYNAK_ADI, "varliklar": varliklar}
with open(os.path.join(CIKTI, "katalog.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(katalog, f, ensure_ascii=False, indent=2)
    f.write("\n")

toplam = sum(v["bayt"] for v in varliklar)
sayim = {}
for v in varliklar:
    sayim[v["kategori"]] = sayim.get(v["kategori"], 0) + 1
print(f"[SEHIR] varlık={len(varliklar)} toplam={toplam} bayt  kategoriler={dict(sorted(sayim.items()))}")
for ad, neden in atlanan:
    print(f"[SEHIR] atlandı: {ad} ({neden})")
