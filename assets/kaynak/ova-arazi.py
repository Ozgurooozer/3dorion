# assets/kaynak/ova-arazi.py — Ova'nın UZAK ARAZİSİ: tepe halkası, masa dağları, büyük kayalar (spec 17 L2).
#
# Çalıştırma (repo kökünden):
#   1) Üret (betikten, tohumlu):
#      blender --background --factory-startup --python assets/kaynak/ova-arazi.py -- \
#          --glb assets/ova-arazi.glb [--blend assets/kaynak/ova-arazi.blend] [--tohum 1907]
#   2) Elle düzenlenmiş .blend'den YALNIZ dışa aktar (Blender'da şekillendirdikten sonra):
#      blender --background assets/kaynak/ova-arazi.blend --python assets/kaynak/ova-arazi.py -- \
#          --glb assets/ova-arazi.glb --disa-aktar
#
# Ne var, ne yok: glb YALNIZ BİÇİM taşır (konum + üçgen). Renk, malzeme, normal yok — renk Babylon'da level
# paletinden yüksekliğe/eğime göre verilir (world/level/moduller/uzakArazi.ts), böylece paneldeki palet arazinin
# rengini de değiştirir. Nesne adları anlam taşır:
#   tepeler   — ufuk halkası; olduğu yerde kalır (tabanı zeminin altında başlar).
#   masa_N    — masa dağları; Babylon'da zemine OTURTULUR (merkezlerinin zemin yüksekliği kadar kaydırılır).
#   kaya_N    — büyük kayalar; aynı şekilde oturtulur.
# Elle yeni nesne eklerken bu önekleri kullan; yüzlerin normali DIŞA baksın (Babylon sarım sırasından okur).
#
# Koordinat: biçimler Babylon dünya koordinatında düşünülür, Blender'a (X, Y, Z) → (-X, -Z, Y) ile yazılır
# (spec 11 kuralı). glTF dışa aktarımı ve Babylon'un sağ-el → sol-el dönüşümü bunu tam geri çevirir.
#
# Tekrar üretilebilirlik: rastgelelik yalnız tohumlu `random.Random` ve kendi değer gürültümüz (Blender'ın
# gürültüsü sürümle değişebilir). Aynı tohum → aynı glb.
import bpy
import bmesh
import math
import os
import random
import sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(ad, varsayilan=None):
    return argv[argv.index(ad) + 1] if ad in argv else varsayilan


GLB_YOLU = arg("--glb")
BLEND_YOLU = arg("--blend")
TOHUM = int(arg("--tohum", "1907"))
YALNIZ_DISA = "--disa-aktar" in argv
if not GLB_YOLU:
    raise SystemExit("kullanım: ... -- --glb <çıktı.glb> [--blend <dosya.blend>] [--tohum N] [--disa-aktar]")

# ── Ölçüler (m, Babylon) ─────────────────────────────────────────────────────
# Zemin ±320 m kare, gök kubbesi 480 m (ova.level.json). Halka zeminin içinde başlar, kubbenin içinde biter.
HALKA_IC, HALKA_DIS = 215.0, 430.0
HALKA_DILIM, HALKA_BANT = 112, 9
TEPE_MIN, TEPE_MAX = 10.0, 68.0
MASA_SAYI, MASA_UZAK = 4, (125.0, 185.0)
KAYA_KUME, KAYA_UZAK = 4, (70.0, 115.0)


# ── Gürültü (kendi; sürümden bağımsız) ───────────────────────────────────────
def _kose(ix, iz, tohum):
    h = (ix * 374761393 + iz * 668265263 + tohum * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296.0


def gurultu(x, z, tohum):
    ix, iz = math.floor(x), math.floor(z)
    fx, fz = x - ix, z - iz
    fx, fz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)
    a, b = _kose(ix, iz, tohum), _kose(ix + 1, iz, tohum)
    c, d = _kose(ix, iz + 1, tohum), _kose(ix + 1, iz + 1, tohum)
    ust, alt = a + (b - a) * fx, c + (d - c) * fx
    return ust + (alt - ust) * fz


def fbm(x, z, tohum, oktav=4):
    t, g, n = 0.0, 1.0, 0.0
    for i in range(oktav):
        t += g * gurultu(x * 2 ** i, z * 2 ** i, tohum + i * 31)
        n += g
        g *= 0.5
    return t / n


def yumusak_esik(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ── Babylon → Blender ────────────────────────────────────────────────────────
def bl(p):
    x, y, z = p
    return (-x, -z, y)


def nesne_yap(ad, koseler, yuzler, kapali):
    """koseler: Babylon koordinatı; yuzler: köşe indeksleri. Normaller dışa (kapalıda) / yukarı (açıkta)."""
    bm = bmesh.new()
    vs = [bm.verts.new(bl(p)) for p in koseler]
    for f in yuzler:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if not kapali:
        # Açık yüzeyde (halka) recalc tutarlı yapar ama yönü garanti etmez: ortalama normal Blender +Z'ye baksın.
        ort = sum((f.normal.z * f.calc_area() for f in bm.faces), 0.0)
        if ort < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(ad)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(ad, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ── Tepe halkası ─────────────────────────────────────────────────────────────
def tepeler(rnd):
    koseler, yuzler = [], []
    # Bantlar dışa doğru seyrekleşir (yakın etek ayrıntılı, uzak sırt kaba).
    yaricaplar = [HALKA_IC + (HALKA_DIS - HALKA_IC) * (j / (HALKA_BANT - 1)) ** 1.25 for j in range(HALKA_BANT)]
    adim_a = 2 * math.pi / HALKA_DILIM
    for j, r0 in enumerate(yaricaplar):
        for i in range(HALKA_DILIM):
            # Izgara izini kır: açı ve yarıçapta küçük oynama (ilk ve son bant düzgün kalır).
            ic = 0 < j < HALKA_BANT - 1
            a = i * adim_a + (rnd.uniform(-0.3, 0.3) * adim_a if ic else 0.0)
            r = r0 + (rnd.uniform(-0.3, 0.3) * (yaricaplar[1] - yaricaplar[0]) if ic else 0.0)
            x, z = math.cos(a) * r, math.sin(a) * r
            # Dağ maskesi: düşük frekans — kimi yönde yüksek sıradağ, kimi yönde alçak geçit.
            maske = yumusak_esik(0.25, 0.75, fbm(x / 260, z / 260, TOHUM + 5, 2))
            sirt = 1 - abs(2 * fbm(x / 70, z / 70, TOHUM + 11) - 1)  # sivri sırtlar
            yuk = TEPE_MIN + (TEPE_MAX - TEPE_MIN) * maske * sirt ** 1.6
            etek = yumusak_esik(HALKA_IC, HALKA_IC + 75, r)  # iç kenar zeminin altından yükselir
            y = -3.0 + (yuk + 3.0) * etek
            koseler.append((x, y, z))
    for j in range(HALKA_BANT - 1):
        for i in range(HALKA_DILIM):
            i2 = (i + 1) % HALKA_DILIM
            a, b = j * HALKA_DILIM + i, j * HALKA_DILIM + i2
            c, d = (j + 1) * HALKA_DILIM + i2, (j + 1) * HALKA_DILIM + i
            yuzler += [(a, b, c), (a, c, d)] if (i + j) % 2 == 0 else [(a, b, d), (b, c, d)]
    return nesne_yap("tepeler", koseler, yuzler, kapali=False)


# ── Masa dağları (yassı tepeli kayalık) ──────────────────────────────────────
def masa(ad, rnd, merkez, yaricap, boy):
    kenar = rnd.randint(6, 9)
    # (yarıçap çarpanı, yükseklik) halkaları: gömülü taban → etek → duvar → tepe kenarı.
    halkalar = [(1.45, -4.0), (1.25, boy * 0.18), (1.0, boy * 0.72), (0.86, boy)]
    koseler, yuzler = [], []
    for kat, (rc, y) in enumerate(halkalar):
        for i in range(kenar):
            a = (i + rnd.uniform(-0.25, 0.25)) / kenar * 2 * math.pi
            r = yaricap * rc * rnd.uniform(0.85, 1.12)
            koseler.append((merkez[0] + math.cos(a) * r, y + (rnd.uniform(-0.06, 0.06) * boy if kat else 0.0),
                            merkez[1] + math.sin(a) * r))
    for k in range(len(halkalar) - 1):
        for i in range(kenar):
            i2 = (i + 1) % kenar
            yuzler.append((k * kenar + i, k * kenar + i2, (k + 1) * kenar + i2, (k + 1) * kenar + i))
    ust = len(koseler)
    koseler.append((merkez[0], boy * rnd.uniform(1.0, 1.06), merkez[1]))  # tepe hafif kubbe
    for i in range(kenar):
        yuzler.append((3 * kenar + i, 3 * kenar + (i + 1) % kenar, ust))
    yuzler.append(tuple(reversed(range(kenar))))  # taban kapağı: kapalı gövde → normaller dışa
    return nesne_yap(ad, koseler, yuzler, kapali=True)


# ── Büyük kayalar (bozulmuş ikosahedron) ─────────────────────────────────────
def kaya(ad, rnd, merkez, boy, basik):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    koseler = []
    for v in bm.verts:
        # bmesh Blender koordinatında; Babylon'a çevir (x, y, z)_bab = (-X, Z, -Y), boz, geri yaz.
        s = rnd.uniform(0.72, 1.25)
        koseler.append((-v.co.x * s, v.co.z * s * basik, -v.co.y * s))
    yuzler = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    en_alt = min(p[1] for p in koseler)
    # Taban gömülsün: en alt köşe zeminin altında (Babylon'da merkezin zemin yüksekliğine oturtulur).
    koseler = [(merkez[0] + p[0] * boy, (p[1] - en_alt) * boy - 0.22 * boy, merkez[1] + p[2] * boy) for p in koseler]
    return nesne_yap(ad, koseler, yuzler, kapali=True)


def yeri(rnd, uzak):
    a = rnd.uniform(0, 2 * math.pi)
    r = rnd.uniform(*uzak)
    return (math.cos(a) * r, math.sin(a) * r)


def uret():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    rnd = random.Random(TOHUM)
    tepeler(rnd)
    for n in range(MASA_SAYI):
        masa(f"masa_{n + 1}", rnd, yeri(rnd, MASA_UZAK), rnd.uniform(16, 32), rnd.uniform(16, 34))
    k = 0
    for _ in range(KAYA_KUME):
        cx, cz = yeri(rnd, KAYA_UZAK)
        for _ in range(rnd.randint(2, 4)):
            k += 1
            kaya(f"kaya_{k}", rnd, (cx + rnd.uniform(-7, 7), cz + rnd.uniform(-7, 7)), rnd.uniform(2.2, 6.5), rnd.uniform(0.55, 0.85))


def disa_aktar():
    meshler = [ob for ob in bpy.data.objects if ob.type == "MESH"]
    if not meshler:
        raise SystemExit("dışa aktarılacak mesh yok")
    for ob in meshler:
        # Dönüşümü köşelere uygula: glb'de düğüm dönüşümü kalmasın (Babylon tarafı düz köşe okur).
        ob.data.transform(ob.matrix_world)
        ob.matrix_world.identity()
        ob.parent = None
    os.makedirs(os.path.dirname(os.path.abspath(GLB_YOLU)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(GLB_YOLU), export_format="GLB", use_selection=False, export_apply=True,
        export_materials="NONE", export_texcoords=False, export_normals=False, export_yup=True,
    )
    ucgen = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in meshler)
    print(f"[ova-arazi] {len(meshler)} nesne, {ucgen} üçgen → {GLB_YOLU} ({os.path.getsize(GLB_YOLU)} bayt)")


if not YALNIZ_DISA:
    uret()
    if BLEND_YOLU:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND_YOLU), compress=True)
disa_aktar()
