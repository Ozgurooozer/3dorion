# assets/kaynak/oda-esyalar.py — Orion'un ofisinin GÖRÜNÜŞÜ (spec 11).
#
# Çalıştırma (repo kökünden):
#   node --experimental-strip-types tools/oda-olcu-json.ts > <tmp>/olculer.json
#   blender --background --factory-startup --python assets/kaynak/oda-esyalar.py -- \
#       --olculer <tmp>/olculer.json --glb assets/oda-esyalar.glb [--onizleme <png>] [--blend <dosya.blend>]
#
# Ne yapar: kabuk kaplamalarını (ahşap lambri, eğik cam duvar çerçevesi, tavan ışıklığı,
# neon şeritler) ve bütün eşyaları (Viktorya masası, banker sandalyesi, kırmızı berjer,
# portmanto + fötr, lambalar, halı, kitaplık, çerçeveler, kapı) KURAR ve tek bir glb'ye
# yazar. İŞLEV TAŞIYAN YÜZEYLER (monitör ekranları, tahta, zihin paneli, manzara) burada
# YOK — onlar oda.ts'de kodla kurulur, içerikleri canlı çizilir.
#
# Koordinat: model Babylon dünya koordinatında YERİNDE kurulur. Babylon (X, Y, Z) →
# Blender (-X, -Z, Y). glTF dışa aktarımı (+Y yukarı) ve Babylon glTF yükleyicisinin
# sağ-el → sol-el dönüşümü bunu tam geri çevirir; oda.ts eşyaları ayrıca konumlandırmaz.
#
# Tekrar üretilebilirlik: rastgelelik yalnızca sabit tohumlu `random.Random(11)`;
# dokular numpy ile hesaplanır (dışarıdan dosya yok). Aynı girdi → aynı glb.
#
# Bütçe (spec 11): ~50k üçgen, doku ≤ 1K. Aynı malzemeli parçalar sonunda tek mesh'e
# birleştirilir — Babylon'da çizim çağrısı ≈ malzeme sayısı.
import bpy
import bmesh
import json
import math
import os
import random
import sys

import numpy as np
from mathutils import Matrix, Vector

# ── Argümanlar ───────────────────────────────────────────────────────────────
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(ad, varsayilan=None):
    if ad in argv:
        return argv[argv.index(ad) + 1]
    return varsayilan


OLCU_YOLU = arg("--olculer")
GLB_YOLU = arg("--glb")
ONIZLEME = arg("--onizleme")
BLEND_YOLU = arg("--blend")
MANZARA = arg("--manzara")  # yalnız önizleme render'ı için: pencere arkası doku
if not OLCU_YOLU or not GLB_YOLU:
    raise SystemExit("kullanım: ... -- --olculer <json> --glb <çıktı.glb> [--onizleme <png>]")

with open(OLCU_YOLU, encoding="utf-8") as f:
    O = json.load(f)

ODA, MASA, SANDALYE, TAHTA, KAPI = O["ODA"], O["MASA"], O["SANDALYE"], O["TAHTA"], O["KAPI"]
SEMA, GUNLUK, MONITOR = O["SEMA"], O["GUNLUK"], O["MONITOR"]
G, D, Y, K = ODA["genislik"], ODA["derinlik"], ODA["yukseklik"], ODA["duvarKalinlik"]

# Cam duvar ve ışıklık: yalnız görünüş. Orion'un pencere çapası (PENCERE) DEĞİŞMEZ.
CAM = O["CAM_DUVARI"]
# float(): JSON 0 tamsayı gelir; -0 (tamsayı) ile -0.0 farklı bayt üretir (glb bayt eşitliği bunu yakaladı).
ISIKLIK = {k: float(v) for k, v in O["ISIKLIK"].items()}

rng = random.Random(11)

# ── Sahne temizliği ──────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
sahne = bpy.context.scene
DISA = bpy.data.collections.new("disa_aktar")
ONIZ = bpy.data.collections.new("onizleme")
sahne.collection.children.link(DISA)
sahne.collection.children.link(ONIZ)


def B(x, y, z):
    """Babylon dünya noktası → Blender noktası."""
    return Vector((-x, -z, y))


# ── Dokular (numpy, sabit tohum) ─────────────────────────────────────────────
def goruntu(ad, dizi):
    """dizi: (h, w, 3|4) float 0..1, satır 0 = ÜST. Blender alttan başlar → çevir."""
    h, w = dizi.shape[:2]
    if dizi.shape[2] == 3:
        dizi = np.concatenate([dizi, np.ones((h, w, 1))], axis=2)
    img = bpy.data.images.new(ad, width=w, height=h, alpha=True)
    img.pixels.foreach_set(np.flipud(dizi).astype(np.float32).ravel())
    img.pack()
    return img


def zemin_dokusu(n=1024):
    """Koyu ahşap tahta döşeme: 8 sıra, damar gürültüsü, sıra başına ton farkı."""
    r = np.random.default_rng(11)
    y = np.linspace(0, 1, n)[:, None]
    x = np.linspace(0, 1, n)[None, :]
    sira = np.minimum(np.floor(y * 8), 7)  # y = 1.0 son satır: 9. sıra yok
    ton = 0.75 + 0.25 * r.random(8)[sira.astype(int)]
    damar = 0.5 + 0.5 * np.sin(x * 90 + np.sin(y * 40 + sira) * 2.5 + r.random() * 6)
    temel = np.stack([0.11, 0.06, 0.035])[None, None, :] * ton[..., None]
    renk = temel * (0.8 + 0.25 * damar[..., None])
    derz = (np.abs((y * 8) % 1 - 0.0) < 0.012) | (np.abs((y * 8) % 1 - 1.0) < 0.012)
    kaydirma = (sira % 2) * 0.5
    uc = np.abs(((x + kaydirma) * 2) % 1) < 0.006
    renk[np.broadcast_to(derz | uc, renk.shape[:2])] *= 0.35
    return np.clip(renk, 0, 1)


def hali_dokusu(n=1024):
    """Desenli kenarlı halı: koyu bordo zemin, altın/lacivert kenar bantları, ortada madalyon."""
    yy, xx = np.mgrid[0:n, 0:n] / (n - 1)
    kenar = np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy))
    renk = np.zeros((n, n, 3))
    renk[:] = (0.22, 0.03, 0.06)
    bant = lambda a, b: (kenar >= a) & (kenar < b)
    renk[bant(0.0, 0.035)] = (0.08, 0.05, 0.12)
    renk[bant(0.035, 0.05)] = (0.55, 0.38, 0.12)
    desen = (np.sin(xx * 120) * np.sin(yy * 120) > 0.2)
    renk[bant(0.05, 0.11) & desen] = (0.30, 0.10, 0.35)
    renk[bant(0.05, 0.11) & ~desen] = (0.12, 0.04, 0.14)
    renk[bant(0.11, 0.122)] = (0.55, 0.38, 0.12)
    # Orta alan: ince altın elmas kafes + her gözde küçük mor nokta (damask hissi).
    # (İlk sürümdeki büyük madalyon önizlemede leke gibi göründü — kaldırıldı.)
    alan = kenar >= 0.122
    u, v = (xx + yy) * 14, (xx - yy) * 14
    kafes = (np.abs(u - np.round(u)) < 0.04) | (np.abs(v - np.round(v)) < 0.04)
    goz = (np.abs(u - np.floor(u) - 0.5) < 0.12) & (np.abs(v - np.floor(v) - 0.5) < 0.12)
    renk[alan & kafes] = (0.40, 0.26, 0.09)
    renk[alan & goz] = (0.28, 0.07, 0.24)
    gurultu = np.random.default_rng(12).random((n, n, 1)) * 0.06
    return np.clip(renk * (0.9 + gurultu), 0, 1)


def gok_dokusu(n=512):
    """Işıklıktan görünen gök: koyu mor, yağmur çizgileri, pembe neon yansıması."""
    yy, xx = np.mgrid[0:n, 0:n] / (n - 1)
    renk = np.zeros((n, n, 3))
    renk[:] = (0.10, 0.03, 0.20)
    renk += np.exp(-((xx - 0.7) ** 2 + (yy - 0.3) ** 2) / 0.05)[..., None] * np.array([0.9, 0.15, 0.6])
    renk += np.exp(-((xx - 0.2) ** 2 + (yy - 0.8) ** 2) / 0.03)[..., None] * np.array([0.1, 0.5, 0.9])
    r = np.random.default_rng(13)
    for _ in range(260):
        x0, y0, L = r.random(), r.random(), 0.04 + r.random() * 0.1
        i0, i1 = int(y0 * n), min(n - 1, int((y0 + L) * n))
        renk[i0:i1, int(x0 * (n - 1))] += 0.25
    return np.clip(renk, 0, 1)


# ── Malzemeler ───────────────────────────────────────────────────────────────
MAT = {}


def malzeme(ad, renk, puruz=0.6, metal=0.0, isik=None, isik_guc=0.0, doku=None, alfa=1.0):
    m = bpy.data.materials.new(ad)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*renk, 1.0)
    bsdf.inputs["Roughness"].default_value = puruz
    bsdf.inputs["Metallic"].default_value = metal
    if isik is not None:
        bsdf.inputs["Emission Color"].default_value = (*isik, 1.0)
        bsdf.inputs["Emission Strength"].default_value = isik_guc
    if doku is not None:
        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = doku
        m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if isik is not None:
            m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    if alfa < 1.0:
        bsdf.inputs["Alpha"].default_value = alfa
        m.surface_render_method = "BLENDED"
    MAT[ad] = m
    return m


malzeme("maun", (0.16, 0.065, 0.035), puruz=0.42)
malzeme("lambri", (0.085, 0.045, 0.035), puruz=0.55)
malzeme("siva", (0.075, 0.065, 0.105), puruz=0.92)
malzeme("tavan", (0.035, 0.03, 0.05), puruz=0.95)
malzeme("pirinc", (0.78, 0.56, 0.26), puruz=0.32, metal=1.0)
malzeme("deri_yesil", (0.03, 0.14, 0.07), puruz=0.5)
# Ayrı malzeme: birleştirme malzemeye göre; minder deriyle birleşseydi "masa üstü" düğümü sandalyeye uzardı.
malzeme("minder_yesil", (0.025, 0.11, 0.06), puruz=0.8)
malzeme("deri_kirmizi", (0.42, 0.035, 0.05), puruz=0.45)
malzeme("metal", (0.05, 0.05, 0.065), puruz=0.38, metal=0.85)
malzeme("neon_pembe", (0.2, 0.02, 0.15), isik=(1.0, 0.12, 0.72), isik_guc=2.2)
malzeme("neon_mavi", (0.02, 0.15, 0.2), isik=(0.08, 0.75, 1.0), isik_guc=2.0)
malzeme("lamba_yesil", (0.05, 0.3, 0.12), isik=(0.35, 1.0, 0.45), isik_guc=1.1)
malzeme("lamba_sicak", (0.6, 0.5, 0.35), isik=(1.0, 0.75, 0.45), isik_guc=1.5)
malzeme("kagit", (0.82, 0.79, 0.70), puruz=0.9)
malzeme("kitap_a", (0.30, 0.04, 0.05), puruz=0.7)
malzeme("kitap_b", (0.05, 0.08, 0.22), puruz=0.7)
malzeme("kitap_c", (0.25, 0.20, 0.08), puruz=0.7)
malzeme("kece", (0.07, 0.065, 0.06), puruz=0.95)
malzeme("karton", (0.16, 0.10, 0.06), puruz=0.9)
malzeme("hologram", (0.01, 0.08, 0.1), isik=(0.15, 0.75, 1.0), isik_guc=0.8, alfa=0.18)
malzeme("zemin", (1, 1, 1), puruz=0.45, doku=goruntu("d_zemin", zemin_dokusu()))
malzeme("hali", (1, 1, 1), puruz=0.95, doku=goruntu("d_hali", hali_dokusu()))
malzeme("gok", (0, 0, 0), isik=(1, 1, 1), isik_guc=1.4, doku=goruntu("d_gok", gok_dokusu()))


# ── Şekil yardımcıları (hepsi Babylon ölçüsüyle çağrılır) ─────────────────────
def nesne(ad, bm, mat, koleksiyon=None):
    # Üçgenleme burada, sabit yöntemle (dışa aktarıcının seçimine bırakılmaz). Not: üretimden
    # üretime değişen üçgen sırasının asıl nedeni bu değil, UV küresiydi (bkz. kure());
    # belirleyicilik bu satır + ikosferle 3/3 üretimde bayt bayt ölçüldü (2026-10-02).
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="FIXED", ngon_method="EAR_CLIP")
    me = bpy.data.meshes.new(ad)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MAT[mat])
    ob = bpy.data.objects.new(ad, me)
    (koleksiyon or DISA).objects.link(ob)
    return ob


def kutu(ad, mat, x, y, z, g, yuk, d, don=0.0, pah=0.0, egim_x=0.0, koleksiyon=None):
    """Babylon merkez (x,y,z), boyut (g: X, yuk: Y, d: Z), Y ekseni dönüşü `don` (Babylon radyanı)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((g, d, yuk)), verts=bm.verts)
    if pah > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(pah, g / 2.1, d / 2.1, yuk / 2.1),
                        segments=2, affect="EDGES", profile=0.5)
    if egim_x:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector((0, 0, -yuk / 2)), matrix=Matrix.Rotation(egim_x, 3, "X"))
    bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(-don, 3, "Z"))
    bmesh.ops.translate(bm, vec=B(x, y, z), verts=bm.verts)
    return nesne(ad, bm, mat, koleksiyon)


def silindir(ad, mat, x, y, z, cap, yuk, seg=16, cap2=None, eksen="Y", don=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=cap / 2,
                          radius2=(cap2 if cap2 is not None else cap) / 2, depth=yuk)
    if eksen == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    elif eksen == "Z":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=Matrix.Rotation(-don, 3, "Z"))
    bmesh.ops.translate(bm, vec=B(x, y, z), verts=bm.verts)
    return nesne(ad, bm, mat)


def kure(ad, mat, x, y, z, cap, seg=10, olcek=(1, 1, 1)):
    bm = bmesh.new()
    # İkosfer: UV küresinin kutbunda üst üste binen eş köşeler dışa aktarımda üçgen sırasını
    # üretimden üretime değiştiriyordu (yalnız küre kullanan oda_pirinc; 2026-10-02 ölçüldü).
    bmesh.ops.create_icosphere(bm, subdivisions=1 if seg <= 10 else 2, radius=cap / 2)
    bmesh.ops.scale(bm, vec=Vector((olcek[0], olcek[2], olcek[1])), verts=bm.verts)
    bmesh.ops.translate(bm, vec=B(x, y, z), verts=bm.verts)
    return nesne(ad, bm, mat)


def duzlem(ad, mat, x, y, z, g, d, yatay=True, koleksiyon=None, uv_tekrar=1.0):
    """Yatay düzlem (yukarı bakar) — zemin, halı, gök."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=Vector((g, d, 1)), verts=bm.verts)
    uv = bm.loops.layers.uv.new("UVMap")
    for yuz in bm.faces:
        for lp in yuz.loops:
            co = lp.vert.co
            lp[uv].uv = ((co.x / g + 0.5) * uv_tekrar, (co.y / d + 0.5) * uv_tekrar)
    bmesh.ops.translate(bm, vec=B(x, y, z), verts=bm.verts)
    return nesne(ad, bm, mat, koleksiyon)


# ═════════════════════════════════════════════════════════════════════════════
# KABUK
# ═════════════════════════════════════════════════════════════════════════════
# Zemin (oda.ts'nin kod zemini görünmez kalır; ışın/yer hizası onu kullanır).
duzlem("zemin_kaplama", "zemin", 0, 0.002, 0, G, D, uv_tekrar=2.0)

LAMBRI_Y = 1.0


def duvar_yan(isim, x_ic, normal):
    """Yan duvar: alt ahşap lambri (panelli), üst sıva, tavan pervazı + neon şerit."""
    xd = x_ic - normal * K / 2
    kutu(f"{isim}_siva", "siva", xd, (LAMBRI_Y + Y) / 2, 0, K, Y - LAMBRI_Y, D)
    kutu(f"{isim}_lambri", "lambri", xd + normal * 0.02, LAMBRI_Y / 2, 0, K, LAMBRI_Y, D)
    kutu(f"{isim}_kusak", "maun", x_ic + normal * 0.025, LAMBRI_Y, 0, 0.05, 0.06, D, pah=0.01)
    kutu(f"{isim}_supurgelik", "maun", x_ic + normal * 0.02, 0.07, 0, 0.04, 0.14, D)
    n = 7
    for i in range(n):
        zc = -D / 2 + (i + 0.5) * D / n
        kutu(f"{isim}_panel", "maun", x_ic + normal * 0.012, 0.55, zc, 0.025, 0.62, D / n - 0.16, pah=0.008)
    kutu(f"{isim}_pervaz", "maun", x_ic + normal * 0.06, Y - 0.08, 0, 0.12, 0.16, D, pah=0.02)
    kutu(f"{isim}_neon", "neon_pembe", x_ic + normal * 0.13, Y - 0.17, 0, 0.02, 0.025, D - 0.3)


duvar_yan("duvar_sol", -G / 2, +1)
duvar_yan("duvar_sag", G / 2, -1)

# Ön duvar: kapı boşluğu çevresinde parçalar.
zOn = D / 2 + K / 2
kx0, kx1 = KAPI["x"] - KAPI["genislik"] / 2 - 0.05, KAPI["x"] + KAPI["genislik"] / 2 + 0.05
kutu("duvar_on_sol", "siva", (-G / 2 + kx0) / 2, Y / 2, zOn, kx0 + G / 2, Y, K)
kutu("duvar_on_sag", "siva", (kx1 + G / 2) / 2, Y / 2, zOn, G / 2 - kx1, Y, K)
kutu("duvar_on_ust", "siva", KAPI["x"], (KAPI["yukseklik"] + 0.05 + Y) / 2, zOn, kx1 - kx0, Y - KAPI["yukseklik"] - 0.05, K)
kutu("duvar_on_lambri", "lambri", (-G / 2 + kx0) / 2, LAMBRI_Y / 2, D / 2 + 0.005, kx0 + G / 2, LAMBRI_Y, 0.03)
kutu("duvar_on_lambri2", "lambri", (kx1 + G / 2) / 2, LAMBRI_Y / 2, D / 2 + 0.005, G / 2 - kx1, LAMBRI_Y, 0.03)
kutu("duvar_on_pervaz", "maun", 0, Y - 0.08, D / 2 - 0.06, G, 0.16, 0.12, pah=0.02)

# Kapı: panelli ahşap kanat, kasa, pirinç tokmak.
kutu("kapi_kanat", "maun", KAPI["x"], KAPI["y"], D / 2 - 0.03, KAPI["genislik"], KAPI["yukseklik"], 0.05)
for py, ph in ((0.55, 0.75), (1.55, 0.85)):
    for px in (-0.22, 0.22):
        kutu("kapi_panel", "lambri", KAPI["x"] + px, py, D / 2 - 0.06, 0.34, ph, 0.02, pah=0.01)
for sx in (-1, 1):
    kutu("kapi_kasa", "maun", KAPI["x"] + sx * (KAPI["genislik"] / 2 + 0.04), KAPI["yukseklik"] / 2 + 0.02,
         D / 2 - 0.04, 0.08, KAPI["yukseklik"] + 0.06, 0.09, pah=0.01)
kutu("kapi_kasa_ust", "maun", KAPI["x"], KAPI["yukseklik"] + 0.06, D / 2 - 0.04, KAPI["genislik"] + 0.16, 0.09, 0.09, pah=0.01)
kure("kapi_tokmak", "pirinc", KAPI["x"] - KAPI["genislik"] / 2 + 0.12, 1.02, D / 2 - 0.09, 0.07)

# Arka duvar: cam duvar boşluğunun çevresi (pervaz altı, başlık, yan kolonlar).
zArka = -D / 2 - K / 2
kutu("arka_sol", "lambri", (-G / 2 + CAM["xMin"]) / 2, Y / 2, zArka, CAM["xMin"] + G / 2, Y, K)
kutu("arka_sag", "lambri", (CAM["xMax"] + G / 2) / 2, Y / 2, zArka, G / 2 - CAM["xMax"], Y, K)
camG = CAM["xMax"] - CAM["xMin"]
kutu("arka_denizlik", "maun", 0, CAM["alt"] / 2, zArka, camG, CAM["alt"], K)
kutu("arka_denizlik_ust", "maun", 0, CAM["alt"] + 0.02, -D / 2 + 0.06, camG + 0.1, 0.04, 0.16, pah=0.01)
egimKaydir = (CAM["ust"] - CAM["alt"]) * math.tan(CAM["egim"])
kutu("arka_baslik", "tavan", 0, (CAM["ust"] + Y) / 2, -D / 2 - egimKaydir / 2 - K / 2, camG, Y - CAM["ust"], egimKaydir + K)

# Eğik cam duvar çerçevesi: dikmeler alttan dışa doğru yatar; iki yatay kayıt.
camY = CAM["ust"] - CAM["alt"]
for i in range(CAM["bolme"] + 1):
    x = CAM["xMin"] + i * camG / CAM["bolme"]
    kalin = 0.07 if i in (0, CAM["bolme"]) else 0.045
    kutu("cam_dikme", "metal", x, CAM["alt"] + camY / 2, -D / 2 - 0.02, kalin, camY, 0.06, egim_x=-CAM["egim"])
for oran in (0.0, 0.62, 1.0):
    yk = CAM["alt"] + oran * camY
    zk = -D / 2 - 0.02 - oran * egimKaydir
    kutu("cam_kayit", "metal", 0, yk, zk, camG, 0.05, 0.07)

# Tavan: ışıklık boşluğu çevresinde dört parça + çerçeve + kuyu + gök + neon.
ix0, ix1 = ISIKLIK["x"] - ISIKLIK["g"] / 2, ISIKLIK["x"] + ISIKLIK["g"] / 2
iz0, iz1 = ISIKLIK["z"] - ISIKLIK["d"] / 2, ISIKLIK["z"] + ISIKLIK["d"] / 2
yT = Y + K / 2
kutu("tavan_on", "tavan", 0, yT, (iz1 + D / 2) / 2, G, K, D / 2 - iz1)
kutu("tavan_arka", "tavan", 0, yT, (-D / 2 - egimKaydir + iz0) / 2, G, K, iz0 + D / 2 + egimKaydir)
kutu("tavan_sol", "tavan", (-G / 2 + ix0) / 2, yT, ISIKLIK["z"], ix0 + G / 2, K, ISIKLIK["d"])
kutu("tavan_sag", "tavan", (ix1 + G / 2) / 2, yT, ISIKLIK["z"], G / 2 - ix1, K, ISIKLIK["d"])
kd = ISIKLIK["derinlik"]
for sx in (-1, 1):
    kutu("isiklik_kuyu", "tavan", ISIKLIK["x"] + sx * ISIKLIK["g"] / 2, Y + kd / 2, ISIKLIK["z"], 0.04, kd, ISIKLIK["d"])
    kutu("isiklik_kuyu", "tavan", ISIKLIK["x"], Y + kd / 2, ISIKLIK["z"] + sx * ISIKLIK["d"] / 2, ISIKLIK["g"], kd, 0.04)
duzlem("isiklik_gok", "gok", ISIKLIK["x"], Y + kd, ISIKLIK["z"], ISIKLIK["g"], ISIKLIK["d"])
for i in range(5):
    x = ix0 + i * ISIKLIK["g"] / 4
    kutu("isiklik_cubuk", "metal", x, Y + kd - 0.03, ISIKLIK["z"], 0.04, 0.05, ISIKLIK["d"])
for oran in (0.0, 0.5, 1.0):
    kutu("isiklik_cubuk", "metal", ISIKLIK["x"], Y + kd - 0.03, iz0 + oran * ISIKLIK["d"], ISIKLIK["g"], 0.05, 0.04)
for sx in (-1, 1):
    kutu("isiklik_neon", "neon_pembe", ISIKLIK["x"] + sx * (ISIKLIK["g"] / 2 + 0.05), Y - 0.01, ISIKLIK["z"], 0.03, 0.02, ISIKLIK["d"] + 0.1)
    kutu("isiklik_neon", "neon_pembe", ISIKLIK["x"], Y - 0.01, ISIKLIK["z"] + sx * (ISIKLIK["d"] / 2 + 0.05), ISIKLIK["g"] + 0.1, 0.02, 0.03)

# ═════════════════════════════════════════════════════════════════════════════
# EŞYALAR
# ═════════════════════════════════════════════════════════════════════════════
# ── Viktorya masası (MASA ölçüsünde) ────────────────────────────────────────
mx, mz, mg, md, mu, mk = MASA["x"], MASA["z"], MASA["genislik"], MASA["derinlik"], MASA["ustYuzey"], MASA["kalinlik"]
kutu("masa_ust", "maun", mx, mu - mk / 2, mz, mg, mk, md, pah=0.015)
kutu("masa_deri", "deri_yesil", mx, mu + 0.002, mz + 0.04, mg - 0.3, 0.006, md - 0.25)
ayakG, ayakY = 0.62, mu - mk
for sx in (-1, 1):
    px = mx + sx * (mg / 2 - ayakG / 2 - 0.03)
    kutu("masa_ayak", "maun", px, ayakY / 2, mz, ayakG, ayakY, md - 0.08, pah=0.012)
    kutu("masa_kaide", "maun", px, 0.04, mz, ayakG + 0.05, 0.08, md - 0.03, pah=0.01)
    for j in range(3):
        cy = 0.16 + j * 0.2
        kutu("masa_cekmece", "lambri", px, cy, mz + (md - 0.08) / 2 + 0.008, ayakG - 0.1, 0.16, 0.02, pah=0.006)
        kure("masa_kulp", "pirinc", px, cy, mz + (md - 0.08) / 2 + 0.03, 0.035)
kutu("masa_orta_cekmece", "lambri", mx, mu - mk - 0.06, mz + md / 2 - 0.05, mg - 2 * ayakG - 0.12, 0.1, 0.02, pah=0.006)
kutu("masa_arka_panel", "maun", mx, (mu - mk) / 2 + 0.1, mz - md / 2 + 0.06, mg - 2 * ayakG - 0.06, mu - mk - 0.2, 0.03, pah=0.006)
kutu("masa_led", "neon_mavi", mx, mu - mk - 0.015, mz + md / 2 - 0.02, mg - 0.3, 0.012, 0.015)

# Masa üstü: banker lambası, kitaplar, kâğıtlar, hologram yayıcı.
LAMBA = O["LAMBA"]  # ışık noktası olculer.ts'de; şapka onun çevresine kurulur
lx, lz = LAMBA["banker"]["x"], LAMBA["banker"]["z"] - 0.06
silindir("lamba_taban", "pirinc", lx, mu + 0.012, lz, 0.16, 0.024, seg=20)
silindir("lamba_govde", "pirinc", lx, mu + 0.2, lz, 0.025, 0.36, seg=10)
silindir("lamba_kol", "pirinc", lx, mu + 0.38, lz, 0.02, 0.36, seg=8, eksen="X")
silindir("lamba_sapka", "lamba_yesil", lx, mu + 0.42, lz + 0.06, 0.14, 0.42, seg=16, cap2=0.08, eksen="X")
for i, (bx, bz, don) in enumerate(((mx - 1.05, mz + 0.22, 0.2), (mx + 0.6, mz + 0.25, -0.1))):
    h = mu
    for j in range(3 + i):
        kal = 0.035 + rng.random() * 0.02
        kutu("kitap", ["kitap_a", "kitap_b", "kitap_c"][(i + j) % 3], bx, h + kal / 2, bz,
             0.24 - j * 0.015, kal, 0.17 - j * 0.01, don=don + (rng.random() - 0.5) * 0.3, pah=0.004)
        h += kal
for i in range(4):
    kutu("kagit", "kagit", mx + 0.35 + rng.random() * 0.25, mu + 0.006 + i * 0.002, mz + 0.18 + rng.random() * 0.08,
         0.21, 0.002, 0.297, don=(rng.random() - 0.5) * 0.6)
hx, hz = mx - 0.55, mz - 0.25
silindir("holo_yayici", "metal", hx, mu + 0.02, hz, 0.14, 0.04, seg=16)
silindir("holo_halka", "neon_mavi", hx, mu + 0.045, hz, 0.12, 0.01, seg=16)
silindir("holo_isin", "hologram", hx, mu + 0.3, hz, 0.12, 0.5, seg=16, cap2=0.02)

# ── Banker sandalyesi (SANDALYE: Ozyn'in oturduğu yer, monitöre bakar) ─────
sx0, sz0, so = SANDALYE["x"], SANDALYE["z"], SANDALYE["oturma"]
sg, sd = SANDALYE["genislik"], SANDALYE["derinlik"]
kutu("sandalye_oturak", "maun", sx0, so, sz0, sg, 0.06, sd, pah=0.025)
kutu("sandalye_minder", "minder_yesil", sx0, so + 0.04, sz0, sg - 0.08, 0.025, sd - 0.08, pah=0.01)
sirtZ = sz0 + sd / 2 - 0.03
kutu("sandalye_ust_ray", "maun", sx0, so + 0.48, sirtZ, sg + 0.04, 0.07, 0.05, pah=0.015)
for i in range(7):
    x = sx0 - sg / 2 + 0.05 + i * (sg - 0.1) / 6
    silindir("sandalye_cubuk", "maun", x, so + 0.25, sirtZ, 0.022, 0.42, seg=8)
for kx in (-1, 1):
    kutu("sandalye_kolcak", "maun", sx0 + kx * (sg / 2 + 0.02), so + 0.24, sz0 + 0.02, 0.05, 0.04, sd - 0.05, pah=0.012)
    silindir("sandalye_kol_dikme", "maun", sx0 + kx * (sg / 2 + 0.02), so + 0.12, sz0 - sd / 2 + 0.08, 0.03, 0.22, seg=8)
silindir("sandalye_direk", "metal", sx0, (so - 0.06) / 2 + 0.05, sz0, 0.06, so - 0.1, seg=10)
for i in range(4):
    a = i * math.pi / 2 + math.pi / 4
    kutu("sandalye_ayak", "maun", sx0 + math.sin(a) * 0.17, 0.06, sz0 + math.cos(a) * 0.17, 0.05, 0.05, 0.36, don=a, pah=0.01)

# ── Kırmızı deri berjer (dekor, masanın sağında; pencere çapasının durağını kapatmaz) ──
BERJER, YIGIN = O["BERJER"], O["YIGIN"]
bx0, bz0, bdon = BERJER["x"], BERJER["z"], BERJER["don"]


def berjer_parca(ad, mat, dx, dy, dz, g, yuk, d, pah=0.05):
    """Berjerin yerel ekseninde (önü +Z) parça; dünyaya dönüşle taşınır."""
    c, s = math.cos(bdon), math.sin(bdon)
    x = bx0 + dx * c + dz * s
    z = bz0 - dx * s + dz * c
    kutu(ad, mat, x, dy, z, g, yuk, d, don=bdon, pah=pah)


berjer_parca("berjer_oturak", "deri_kirmizi", 0, 0.38, 0.03, 0.72, 0.16, 0.66)
berjer_parca("berjer_govde", "deri_kirmizi", 0, 0.17, 0.0, 0.8, 0.26, 0.74, pah=0.03)
berjer_parca("berjer_sirt", "deri_kirmizi", 0, 0.82, -0.31, 0.8, 1.0, 0.18)
for k in (-1, 1):
    berjer_parca("berjer_kanat", "deri_kirmizi", k * 0.36, 0.86, -0.18, 0.1, 0.62, 0.36)
    berjer_parca("berjer_kol", "deri_kirmizi", k * 0.36, 0.52, 0.05, 0.12, 0.2, 0.62)
    for kz in (-1, 1):
        berjer_parca("berjer_ayak", "maun", k * 0.3, 0.02, kz * 0.28, 0.06, 0.06, 0.06, pah=0.01)

# ── Sol köşe: portmanto + fötr şapka, ayaklı lamba, yan sandalye ────────────
px0, pz0 = -4.35, -3.35
silindir("portmanto_direk", "maun", px0, 0.95, pz0, 0.05, 1.8, seg=10)
silindir("portmanto_taban", "maun", px0, 0.03, pz0, 0.42, 0.06, seg=16)
for i in range(4):
    a = i * math.pi / 2
    kutu("portmanto_kanca", "pirinc", px0 + math.sin(a) * 0.1, 1.72, pz0 + math.cos(a) * 0.1, 0.02, 0.02, 0.2, don=a)
silindir("fotr_kenar", "kece", px0 + 0.12, 1.79, pz0, 0.36, 0.015, seg=20)
silindir("fotr_tepe", "kece", px0 + 0.12, 1.85, pz0, 0.2, 0.12, seg=16, cap2=0.17)
silindir("fotr_bant", "kitap_a", px0 + 0.12, 1.81, pz0, 0.205, 0.025, seg=16)

lx2, lz2 = LAMBA["ayakli"]["x"] - 0.3, LAMBA["ayakli"]["z"]
silindir("ayakli_lamba_taban", "metal", lx2, 0.02, lz2, 0.3, 0.04, seg=16)
silindir("ayakli_lamba_direk", "metal", lx2, 0.85, lz2, 0.03, 1.66, seg=8)
silindir("ayakli_lamba_kol", "metal", lx2 + 0.15, 1.68, lz2, 0.02, 0.32, seg=6, eksen="X")
silindir("ayakli_lamba_sapka", "neon_mavi", lx2 + 0.3, 1.6, lz2, 0.12, 0.18, seg=12, cap2=0.26)

ysx, ysz, ysdon = -1.95, -2.7, math.radians(35)
kutu("yan_sandalye_oturak", "maun", ysx, 0.46, ysz, 0.46, 0.05, 0.44, don=ysdon, pah=0.015)
c, s = math.cos(ysdon), math.sin(ysdon)
for dx, dz in ((-0.19, -0.18), (0.19, -0.18), (-0.19, 0.18), (0.19, 0.18)):
    silindir("yan_sandalye_ayak", "maun", ysx + dx * c + dz * s, 0.22, ysz - dx * s + dz * c, 0.035, 0.44, seg=8)
sirt_x, sirt_z = ysx + 0.2 * s, ysz + 0.2 * c
for dx in (-0.19, 0.19):
    silindir("yan_sandalye_sirt_dikme", "maun", sirt_x + dx * c, 0.72, sirt_z - dx * s, 0.035, 0.5, seg=8)
for i in range(5):
    dx = -0.14 + i * 0.07
    silindir("yan_sandalye_cubuk", "maun", sirt_x + dx * c, 0.7, sirt_z - dx * s, 0.018, 0.4, seg=6)
kutu("yan_sandalye_ust", "maun", sirt_x, 0.96, sirt_z, 0.46, 0.06, 0.04, don=ysdon, pah=0.012)

# ── Halı (masa + sandalye altında) ──────────────────────────────────────────
duzlem("hali", "hali", 0, 0.006, -2.3, 4.4, 3.1)

# ── Yerde kutular ve kitap yığını (YIGIN ölçüsünün çevresinde; engel kutusu olculer.ts'de) ──
yx, yz = YIGIN["x"], YIGIN["z"]
for i, (dx_, ky_, dz_, kg_, kd_, kdon) in enumerate((
        (-0.27, 0.17, -0.05, 0.5, 0.4, 0.15), (-0.22, 0.47, -0.05, 0.42, 0.34, -0.2), (0.23, 0.12, 0.25, 0.36, 0.3, 0.6))):
    kutu("kutu", "karton", yx + dx_, ky_, yz + dz_, kg_, ky_ * 2 if i != 1 else 0.26, kd_, don=kdon, pah=0.01)
h = 0
for j in range(5):
    kal = 0.04 + rng.random() * 0.03
    kutu("yer_kitap", ["kitap_a", "kitap_b", "kitap_c"][j % 3], yx + 0.38, h + kal / 2, yz - 0.25,
         0.26, kal, 0.19, don=rng.random() * 0.8, pah=0.004)
    h += kal

# ── Kitaplık (sol duvar, eski rafın yeri) ───────────────────────────────────
rx, rz, rg, ry, rd = -G / 2 + 0.2, 2.4, 0.4, 2.1, 1.8
kutu("kitaplik_arka", "lambri", rx - rg / 2 + 0.02, ry / 2, rz, 0.03, ry, rd)
for sz in (-1, 1):
    kutu("kitaplik_yan", "maun", rx, ry / 2, rz + sz * (rd / 2 - 0.02), rg, ry, 0.04, pah=0.008)
kutu("kitaplik_tac", "maun", rx + 0.02, ry + 0.04, rz, rg + 0.06, 0.08, rd + 0.08, pah=0.015)
for i, ray in enumerate((0.1, 0.55, 1.0, 1.45, 1.9)):
    kutu("kitaplik_raf", "maun", rx, ray, rz, rg, 0.03, rd - 0.06)
    if ray > 1.85:
        continue
    zz = rz - rd / 2 + 0.06
    while zz < rz + rd / 2 - 0.12:
        kal = 0.03 + rng.random() * 0.035
        boy = 0.24 + rng.random() * 0.14
        if rng.random() < 0.12:
            zz += 0.06
            continue
        kutu("raf_kitap", ["kitap_a", "kitap_b", "kitap_c"][rng.randrange(3)],
             rx + 0.02, ray + 0.015 + boy / 2, zz + kal / 2, 0.26, boy, kal)
        zz += kal + 0.004


# ── Çerçeveler: tahta (sol duvar), zihin duvarı panelleri (sağ duvar) ──────
def cerceve(ad, x, y, z, g, yuk, normal_x):
    """Duvara asılı yüzeyin çevresine ahşap çerçeve + pirinç iç kenar. Genişlik Z boyunca."""
    t = 0.08
    for dz in (-1, 1):
        kutu(ad, "maun", x, y, z + dz * (g / 2 + t / 2), 0.05, yuk + 2 * t, t, pah=0.012)
    for dy in (-1, 1):
        kutu(ad, "maun", x, y + dy * (yuk / 2 + t / 2), z, 0.05, t, g + 2 * t, pah=0.012)
    for dz in (-1, 1):
        kutu(ad + "_pirinc", "pirinc", x + normal_x * 0.026, y, z + dz * (g / 2 + 0.008), 0.01, yuk + 0.02, 0.012)
    for dy in (-1, 1):
        kutu(ad + "_pirinc", "pirinc", x + normal_x * 0.026, y + dy * (yuk / 2 + 0.008), z, 0.01, 0.012, g + 0.02)


cerceve("tahta_cerceve", TAHTA["x"], TAHTA["y"], TAHTA["z"], TAHTA["genislik"], TAHTA["yukseklik"], +1)
kutu("tahta_kanal", "maun", TAHTA["x"] + 0.06, TAHTA["y"] - TAHTA["yukseklik"] / 2 - 0.1, TAHTA["z"], 0.1, 0.03, TAHTA["genislik"] * 0.8, pah=0.008)
cerceve("sema_cerceve", SEMA["x"], SEMA["y"], SEMA["z"], SEMA["genislik"], SEMA["yukseklik"], -1)
cerceve("gunluk_cerceve", GUNLUK["x"], GUNLUK["y"], GUNLUK["z"], GUNLUK["genislik"], GUNLUK["yukseklik"], -1)

# ═════════════════════════════════════════════════════════════════════════════
# BİRLEŞTİR + DIŞA AKTAR
# ═════════════════════════════════════════════════════════════════════════════
# Aynı malzemeli parçalar tek nesne olur: Babylon'da çizim çağrısı ≈ malzeme sayısı.
# Ad: "oda_<malzeme>" — oda.ts bu adlarla ayırt eder (ör. ışın dışı tutulacak neon).
gruplar = {}
for ob in list(DISA.objects):
    gruplar.setdefault(ob.data.materials[0].name, []).append(ob)
for mat_ad, obler in gruplar.items():
    bpy.ops.object.select_all(action="DESELECT")
    for ob in obler:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obler[0]
    if len(obler) > 1:
        bpy.ops.object.join()
    birlesik = bpy.context.view_layer.objects.active
    birlesik.name = f"oda_{mat_ad}"
    birlesik.data.name = f"oda_{mat_ad}"
    # Sert kenarlar korunsun, eğriler yumuşak görünsün.
    for p in birlesik.data.polygons:
        p.use_smooth = False

ucgen = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in DISA.objects)
print(f"[ODA] nesne={len(DISA.objects)} malzeme={len(MAT)} ucgen={ucgen}")

bpy.ops.object.select_all(action="DESELECT")
for ob in DISA.objects:
    ob.select_set(True)
os.makedirs(os.path.dirname(os.path.abspath(GLB_YOLU)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(GLB_YOLU), export_format="GLB", use_selection=True,
                          export_apply=True, export_lights=False, export_cameras=False, export_yup=True)
print(f"[ODA] glb: {GLB_YOLU} ({os.path.getsize(GLB_YOLU)} bayt)")

# ═════════════════════════════════════════════════════════════════════════════
# ÖNİZLEME RENDER'I (dışa aktarılmaz): referans açısı, Babylon'dakine yakın ışık
# ═════════════════════════════════════════════════════════════════════════════
if ONIZLEME:
    if MANZARA and os.path.exists(MANZARA):
        mz_img = bpy.data.images.load(os.path.abspath(MANZARA))
        malzeme("manzara", (0, 0, 0), isik=(1, 1, 1), isik_guc=1.2, doku=mz_img)
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
        bmesh.ops.scale(bm, vec=Vector((camG + 1.2, 1, 1)), verts=bm.verts)
        uv = bm.loops.layers.uv.new("UVMap")
        for yuz in bm.faces:
            for lp in yuz.loops:
                lp[uv].uv = (lp.vert.co.x / (camG + 1.2) + 0.5, lp.vert.co.y + 0.5)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
        bmesh.ops.scale(bm, vec=Vector((1, 1, Y + 0.6)), verts=bm.verts)
        bmesh.ops.translate(bm, vec=B(0, Y / 2, -D / 2 - 1.2), verts=bm.verts)
        nesne("manzara", bm, "manzara", ONIZ)

    # Kodda kurulan işlev yüzeylerinin YER TUTUCULARI (yalnız önizleme; glb'ye girmez):
    # onlarsız render masayı monitörsüz, duvarları boş çerçeveli gösterip yanıltıyordu.
    malzeme("onz_ekran", (0.01, 0.02, 0.03), isik=(0.05, 0.25, 0.35), isik_guc=1.5)
    malzeme("onz_kasa", (0.02, 0.02, 0.025), puruz=0.4)
    malzeme("onz_tahta", (0.85, 0.86, 0.88), puruz=0.3, isik=(0.6, 0.6, 0.65), isik_guc=0.15)
    ADM = O["ADMIN"]
    for ad, o, don in (("monitor", MONITOR, 0.0), ("admin", ADM, ADM["aciY"])):
        kutu(f"onz_{ad}_kasa", "onz_kasa", o["x"], o["y"], o["z"], o["genislik"] + 0.06, o["yukseklik"] + 0.06, 0.04, don=don, koleksiyon=ONIZ)
        kutu(f"onz_{ad}_ekran", "onz_ekran", o["x"], o["y"], o["z"] + 0.025, o["genislik"], o["yukseklik"], 0.005, don=don, koleksiyon=ONIZ)
        kutu(f"onz_{ad}_ayak", "onz_kasa", o["x"], mu + 0.12, o["z"], 0.05, 0.24, 0.05, koleksiyon=ONIZ)
    kutu("onz_klavye", "onz_kasa", mx, mu + 0.012, mz + 0.22, 0.44, 0.02, 0.15, koleksiyon=ONIZ)
    kutu("onz_tahta", "onz_tahta", TAHTA["x"] + 0.03, TAHTA["y"], TAHTA["z"], 0.01, TAHTA["yukseklik"], TAHTA["genislik"], koleksiyon=ONIZ)
    for p in (SEMA, GUNLUK):
        kutu("onz_panel", "onz_ekran", p["x"] - 0.03, p["y"], p["z"], 0.01, p["yukseklik"], p["genislik"], koleksiyon=ONIZ)

    def isik(ad, tur, konum_b, enerji, renk, boy=0.2, yon_b=None):
        li = bpy.data.lights.new(ad, tur)
        li.energy = enerji
        li.color = renk
        if tur in ("POINT", "SPOT", "AREA"):
            li.shadow_soft_size = boy
        ob = bpy.data.objects.new(ad, li)
        ob.location = B(*konum_b)
        if yon_b is not None:
            ob.rotation_euler = (B(*yon_b) * -1).to_track_quat("-Z", "Y").to_euler()
        ONIZ.objects.link(ob)

    isik("pencere", "AREA", (0, 1.8, -3.85), 2600, (0.95, 0.3, 0.9), yon_b=(0, -0.25, 1))
    bpy.data.lights["pencere"].size = 8
    isik("isiklik", "AREA", (0, 3.4, -1.7), 900, (0.65, 0.35, 1.0), yon_b=(0, -1, 0))
    bpy.data.lights["isiklik"].size = 3
    isik("banker", "POINT", (lx, mu + 0.36, lz + 0.12), 60, (0.65, 1.0, 0.6))
    isik("ayakli", "POINT", (lx2 + 0.3, 1.5, lz2), 120, (0.3, 0.8, 1.0))
    isik("dolgu", "POINT", (0, 2.7, 1.2), 450, (0.55, 0.45, 0.95), boy=1.5)
    isik("pembe_kenar", "POINT", (4.2, 2.6, -1.0), 260, (1.0, 0.25, 0.7), boy=0.8)
    isik("mavi_kenar", "POINT", (-4.2, 2.4, 0.5), 200, (0.25, 0.6, 1.0), boy=0.8)

    dunya = bpy.data.worlds.new("dunya")
    dunya.use_nodes = True
    dunya.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.008, 0.025, 1)
    sahne.world = dunya

    kam = bpy.data.cameras.new("kamera")
    kam.sensor_fit = "VERTICAL"
    kam.angle_y = 1.0
    kam.clip_start = 0.05
    kob = bpy.data.objects.new("kamera", kam)
    ONIZ.objects.link(kob)
    sahne.camera = kob

    for motor in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            sahne.render.engine = motor
            break
        except TypeError:
            continue
    sahne.render.resolution_x, sahne.render.resolution_y = 1280, 720
    sahne.render.image_settings.file_format = "PNG"
    try:
        sahne.view_settings.view_transform = "AgX"
        sahne.view_settings.look = "AgX - Punchy"
    except TypeError:
        pass
    sahne.view_settings.exposure = 0.6
    # Açılar oda-deneme.ts ACILAR ile aynı (referans) + yakın bir masa açısı.
    acilar = {
        "referans": ((-3.4, 1.7, 1.9), (0.6, 1.15, -3.6)),
        "yakin": ((2.6, 1.45, 0.4), (-0.4, 0.9, -3.4)),
    }
    kok, uzanti = os.path.splitext(os.path.abspath(ONIZLEME))
    for ad, (konum, hedef_b) in acilar.items():
        kob.location = B(*konum)
        kob.rotation_euler = (B(*hedef_b) - kob.location).to_track_quat("-Z", "Y").to_euler()
        sahne.render.filepath = f"{kok}-{ad}{uzanti}"
        bpy.ops.render.render(write_still=True)
        print(f"[ODA] önizleme: {sahne.render.filepath}")

if BLEND_YOLU:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND_YOLU))
