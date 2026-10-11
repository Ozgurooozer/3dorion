# assets/kaynak/orman-kiti.py — "Yeşil harabe" modüler varlık kiti (ova; Ozyn'in referans görüntüsü, 2026-10-11).
#
# Referans: yosun ve sarmaşık basmış beton küp-kuleler, küplerin kenarında pas/bakır çerçeve çizgileri, karanlık
# girintilerde küçük camgöbeği ışıklar, kuleler arası köprüler, açık renk taş döşeme yol, sığ havuz, geniş yapraklı
# ağaçlar, eğrelti otları. Tek bütün sahne DEĞİL: her parça ayrı, ızgaraya oturan modül.
#
# Çalıştırma — iki yol:
#   1. Açık Blender'da (MCP soketi): dosyanın içeriği olduğu gibi çalıştırılır; kit "orman_kiti" koleksiyonuna kurulur.
#   2. Arka planda: blender --background --python assets/kaynak/orman-kiti.py -- --kaydet assets/kaynak/orman-kiti.blend
# Sonra dışa aktarım şehir kitiyle AYNI betikten (pivot, glb, önizleme, katalog):
#   blender --background assets/kaynak/orman-kiti.blend --python assets/kaynak/sehir-kiti.py -- --cikti assets/orman #       --pivot koken
#
# Izgara: 1 birim = 1 m. Duvar 4 m × 4 m × 0,4 m; blok 4 m küp; zemin taşı 2 m × 2 m; havuz 4 m.
# Pivot = nesnenin ORİJİNİ (`--pivot koken`), sınır kutusu değil: dışa taşan panel/yosun/sarmaşık kutuyu büyütür,
# kutu ortası pivot olsaydı küpler ızgaraya oturmazdı. Orijin: yapılarda nominal taban ortası (4 m küp = x,y ∈ ±2,
# z ∈ 0..4), bitkilerde gövde dibi, sarmaşıkta ASILDIĞI ÜST KENAR (dudak +Y'de üstte, iplikler -Y yüzünün önünde
# aşağı sarkar) — bir yüzün üst kenarına koy, -Y dışa baksın. Katalog `boyut` sınır kutusudur (taşmalar dahil).
#
# Ad öneki → katalog kategorisi (sehir-kiti.py KATEGORI): RUIN_WALL_ duvar · RUIN_BLK_ blok · RUIN_FLR_ zemin ·
# RUIN_POOL_ havuz · RUIN_BRG_ kopru · RUIN_DET_ detay · PLANT_ bitki.
#
# Malzeme: dokusuz, düz renk (stil shader'ları sonra boyar). Işıyan tek malzeme `orman_glow_cyan` (ad "glow" içerir;
# dışa aktarıcı ışımayı korur). Yapraklar iki yüzlü (glTF doubleSided). Rastgelelik sabit tohumlu: her koşu aynı kit.
import bpy
import bmesh
import math
import random
import sys
import zlib

from mathutils import Matrix, Vector, noise

KOLEKSIYON = "orman_kiti"
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


# ── Malzemeler ──────────────────────────────────────────────────────────────
def _dogrusal(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_renk(h):
    h = h.lstrip("#")
    return tuple(_dogrusal(int(h[i:i + 2], 16)) for i in (0, 2, 4)) + (1.0,)


# ad: (sRGB, pürüz, ışıma gücü, iki yüzlü)
PALET = {
    "beton_acik": ("#A4AAA4", 0.85, 0, False),
    "beton": ("#8A928D", 0.9, 0, False),
    "beton_koyu": ("#69716D", 0.9, 0, False),
    "derz": ("#454D4A", 0.95, 0, False),
    "girinti": ("#172024", 0.8, 0, False),
    "bakir": ("#6E3A25", 0.55, 0, False),
    "glow_cyan": ("#2FD9F2", 0.4, 3.0, False),
    "zemin_tas": ("#CACCC3", 0.85, 0, False),
    "toprak": ("#3A2B1F", 1.0, 0, False),
    "su": ("#0E5C59", 0.03, 0, False),
    "yosun": ("#4A7228", 1.0, 0, False),
    "yosun_acik": ("#6C9634", 1.0, 0, False),
    "yosun_koyu": ("#34541E", 1.0, 0, False),
    "kabuk": ("#4A3727", 0.95, 0, False),
    "yaprak_koyu": ("#2B561C", 0.7, 0, True),
    "yaprak": ("#4C8B2C", 0.7, 0, True),
    "yaprak_acik": ("#88BD43", 0.7, 0, True),
    "egrelti": ("#5A9B2E", 0.7, 0, True),
    "cimen": ("#6EA033", 0.8, 0, True),
}


def malzeme(ad):
    tam = "orman_" + ad
    # Varsa da değerleri yeniden yazılır: açık Blender'da paleti değiştirip yeniden kurmak eski rengi bırakmasın.
    m = bpy.data.materials.get(tam) or bpy.data.materials.new(tam)
    renk_hex, puruz, isima, iki_yuz = PALET[ad]
    renk = hex_renk(renk_hex)
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = renk
    p.inputs["Roughness"].default_value = puruz
    if isima:
        p.inputs["Emission Color"].default_value = renk
        p.inputs["Emission Strength"].default_value = isima
    m.diffuse_color = renk          # Workbench önizlemesi bunu çizer
    m.roughness = puruz
    m.use_backface_culling = not iki_yuz
    return m


# ── Parça: tek bmesh, yüz başına malzeme ────────────────────────────────────
class Parca:
    def __init__(self, ad):
        self.ad = ad
        self.bm = bmesh.new()
        self.malz = []

    def _mi(self, ad):
        if ad not in self.malz:
            self.malz.append(ad)
        return self.malz.index(ad)

    def _boya(self, yuzler, ad, yumusak=False):
        i = self._mi(ad)
        for f in yuzler:
            f.material_index = i
            f.smooth = yumusak

    def kutu(self, x0, y0, z0, x1, y1, z1, ad):
        """Eksene hizalı kutu (min-max)."""
        M = Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @ Matrix.Diagonal(
            (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), 1))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)
        self._boya({f for v in r["verts"] for f in v.link_faces}, ad)

    def kutu_yerel(self, o, u, v, n, a, b, c, ad):
        """Yerel çerçevede kutu: köşe = o + u·a + v·b + n·c, (a0,a1)×(b0,b1)×(c0,c1)."""
        vs = [self.bm.verts.new(o + u * a[i] + v * b[j] + n * c[k]) for i in (0, 1) for j in (0, 1) for k in (0, 1)]
        q = lambda i, j, k: vs[i * 4 + j * 2 + k]
        yuzler = [
            self.bm.faces.new((q(0, 0, 0), q(0, 1, 0), q(0, 1, 1), q(0, 0, 1))),
            self.bm.faces.new((q(1, 0, 0), q(1, 0, 1), q(1, 1, 1), q(1, 1, 0))),
            self.bm.faces.new((q(0, 0, 0), q(0, 0, 1), q(1, 0, 1), q(1, 0, 0))),
            self.bm.faces.new((q(0, 1, 0), q(1, 1, 0), q(1, 1, 1), q(0, 1, 1))),
            self.bm.faces.new((q(0, 0, 0), q(1, 0, 0), q(1, 1, 0), q(0, 1, 0))),
            self.bm.faces.new((q(0, 0, 1), q(0, 1, 1), q(1, 1, 1), q(1, 0, 1))),
        ]
        bmesh.ops.recalc_face_normals(self.bm, faces=yuzler)
        self._boya(yuzler, ad)

    def kutu_doner(self, merkez, boyut, ad, rz=0.0, rx=0.0, ry=0.0):
        M = (Matrix.Translation(merkez) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Rotation(ry, 4, "Y")
             @ Matrix.Rotation(rx, 4, "X") @ Matrix.Diagonal((*boyut, 1)))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)
        self._boya({f for v in r["verts"] for f in v.link_faces}, ad)

    def prizma(self, cokgen, z0, z1, ad):
        """Saat yönü tersine 2B çokgen → dikey prizma."""
        alt = [self.bm.verts.new((x, y, z0)) for x, y in cokgen]
        ust = [self.bm.verts.new((x, y, z1)) for x, y in cokgen]
        yuzler = [self.bm.faces.new(list(reversed(alt))), self.bm.faces.new(ust)]
        n = len(cokgen)
        for i in range(n):
            j = (i + 1) % n
            yuzler.append(self.bm.faces.new((alt[i], alt[j], ust[j], ust[i])))
        self._boya(yuzler, ad)

    def kure(self, merkez, yaricap, ad, olcek=(1, 1, 1), puruz=0.25, tohum=0.0, alt=2):
        """Noktalı (gürültüyle bozulmuş) ikosfer — yaprak kümesi, çalı, moloz."""
        r = bmesh.ops.create_icosphere(self.bm, subdivisions=alt, radius=1.0)
        kay = Vector((tohum, tohum * 1.37, tohum * 0.71))
        for v in r["verts"]:
            nn = v.co.normalized()
            d = 1 + puruz * noise.noise(nn * 1.8 + kay)
            v.co = Vector(merkez) + Vector((nn.x * olcek[0], nn.y * olcek[1], nn.z * olcek[2])) * yaricap * d
        self._boya({f for v in r["verts"] for f in v.link_faces}, ad, True)

    def tup(self, noktalar, yaricaplar, ad, kenar=7, uc=True):
        """Paralel taşımalı boru (gövde, dal, kök): halkalar arası dörtgen, uçta tek nokta."""
        noktalar = [Vector(p) for p in noktalar]
        halkalar, u = [], None
        for i, p in enumerate(noktalar):
            if i == 0:
                t = noktalar[1] - noktalar[0]
            elif i == len(noktalar) - 1:
                t = p - noktalar[i - 1]
            else:
                t = noktalar[i + 1] - noktalar[i - 1]
            t.normalize()
            if u is None:
                u = t.cross(X if abs(t.x) < 0.9 else Y)
            u = (u - t * u.dot(t)).normalized()
            w = t.cross(u)
            r = yaricaplar[i]
            halkalar.append([self.bm.verts.new(p + (u * math.cos(a) + w * math.sin(a)) * r)
                             for a in (2 * math.pi * k / kenar for k in range(kenar))])
        yuzler = []
        for h0, h1 in zip(halkalar, halkalar[1:]):
            for k in range(kenar):
                m = (k + 1) % kenar
                yuzler.append(self.bm.faces.new((h0[k], h0[m], h1[m], h1[k])))
        if uc:
            son = self.bm.verts.new(noktalar[-1] + (noktalar[-1] - noktalar[-2]).normalized() * yaricaplar[-1])
            for k in range(kenar):
                yuzler.append(self.bm.faces.new((halkalar[-1][k], halkalar[-1][(k + 1) % kenar], son)))
        self._boya(yuzler, ad, True)

    def yaprak(self, taban, yon, normal, boy, en, ad, kivrim=0.25):
        """Elmas yaprak: tabandan uca, orta damardan hafif katlı (iki üçgen)."""
        yon = Vector(yon).normalized()
        yan = yon.cross(Vector(normal)).normalized()
        kalk = yan.cross(yon).normalized()
        a = Vector(taban)
        c = a + yon * boy
        b = a + yon * boy * 0.42 + yan * en * 0.5 + kalk * en * kivrim
        d = a + yon * boy * 0.42 - yan * en * 0.5 + kalk * en * kivrim
        va, vb, vc, vd = (self.bm.verts.new(p) for p in (a, b, c, d))
        self._boya([self.bm.faces.new((va, vb, vc)), self.bm.faces.new((va, vc, vd))], ad, True)

    def nesne(self, konum, koleksiyon, pah=0.0):
        me = bpy.data.meshes.new(self.ad)
        self.bm.to_mesh(me)
        self.bm.free()
        for ad in self.malz:
            me.materials.append(malzeme(ad))
        ob = bpy.data.objects.new(self.ad, me)
        koleksiyon.objects.link(ob)
        ob.location = konum
        if pah:
            mod = ob.modifiers.new("pah", "BEVEL")
            mod.width = pah
            mod.segments = 1
            mod.limit_method = "ANGLE"
            mod.angle_limit = math.radians(35)
        return ob


# ── Beton yüzey yardımcıları ───────────────────────────────────────────────
BETONLAR = ("beton_acik", "beton", "beton", "beton_koyu")


def yuzey_panelle(p, rng, o, u, v, n, U, V, nu, nv, girinti=0.0, isik=0.0, bosluk=0.07, cikinti=0.03, atla=None):
    """Bir yüzü nu×nv panele böler: panel yüzeyden `cikinti` kadar çıkar, aralarda derz kalır.
    `girinti` olasılığıyla panel yerine karanlık girinti, onun içinde `isik` olasılığıyla camgöbeği ışık."""
    w, h = U / nu, V / nv
    for i in range(nu):
        for j in range(nv):
            a0, a1 = i * w + bosluk / 2, (i + 1) * w - bosluk / 2
            b0, b1 = j * h + bosluk / 2, (j + 1) * h - bosluk / 2
            if atla and atla(a0, a1, b0, b1):
                continue
            if rng.random() < girinti:
                p.kutu_yerel(o, u, v, n, (a0, a1), (b0, b1), (0.0, 0.006), "girinti")
                for _ in range(1 + (rng.random() < 0.4)):
                    if rng.random() < isik:
                        s = rng.uniform(0.09, 0.17) * min(w, h)
                        ca = rng.uniform(a0 + s, a1 - s)
                        cb = rng.uniform(b0 + s, b1 - s)
                        p.kutu_yerel(o, u, v, n, (ca - s / 2, ca + s / 2), (cb - s / 2, cb + s / 2), (0.0, 0.02), "glow_cyan")
            elif min(a1 - a0, b1 - b0) > 1.4 and rng.random() < 0.3:
                # büyük panel dört küçük karoya bölünür; biri bazen dışa taşar (referanstaki tırtıklı yüzey)
                am, bm = (a0 + a1) / 2, (b0 + b1) / 2
                for aa, bb in (((a0, am - 0.03), (b0, bm - 0.03)), ((am + 0.03, a1), (b0, bm - 0.03)),
                               ((a0, am - 0.03), (bm + 0.03, b1)), ((am + 0.03, a1), (bm + 0.03, b1))):
                    c = cikinti * rng.choice((1, 1, 1, 3, 5))
                    p.kutu_yerel(o, u, v, n, aa, bb, (0.0, c), rng.choice(BETONLAR))
            else:
                c = cikinti * rng.choice((1, 1, 1, 1, 2.5))
                p.kutu_yerel(o, u, v, n, (a0, a1), (b0, b1), (0.0, c), rng.choice(BETONLAR))


def kenar_cubuklari(p, x0, y0, z0, x1, y1, z1, k=0.085, ad="bakir"):
    """Kutunun 12 kenarına pas/bakır çerçeve (referanstaki kahverengi kenar çizgileri)."""
    h = k / 2
    for y in (y0, y1):
        for z in (z0, z1):
            p.kutu(x0 - h, y - h, z - h, x1 + h, y + h, z + h, ad)
    for x in (x0, x1):
        for z in (z0, z1):
            p.kutu(x - h, y0 + h, z - h, x + h, y1 - h, z + h, ad)
    for x in (x0, x1):
        for y in (y0, y1):
            p.kutu(x - h, y - h, z0 + h, x + h, y + h, z1 - h, ad)


def blok_govde(p, rng, en, der, boy, acik_on=False, girinti=0.18, isik=0.6, ust_panel=True, yosun_kenar=0.35):
    """en (X) × der (Y) × boy (Z) beton blok; tabanı z=0, ortası x=y=0. Yüzler panelli, kenarlar bakır çerçeveli."""
    x0, x1, y0, y1 = -en / 2, en / 2, -der / 2, der / 2
    if acik_on:
        t = 0.3
        p.kutu(x0, y0 + t, 0, x1, y1, boy, "girinti")             # arka kütle (iç yüzü karanlık)
        p.kutu(x0, y0, 0, x0 + t, y1, boy, "girinti")              # sol
        p.kutu(x1 - t, y0, 0, x1, y1, boy, "girinti")              # sağ
        p.kutu(x0, y0, boy - t, x1, y1, boy, "girinti")            # tavan
        p.kutu(x0, y0, 0, x1, y1, t, "derz")                       # taban
        # iç arka duvarda ışık şeridi ve iki küçük kare
        p.kutu(x0 + 0.6, y0 + t - 0.02, boy * 0.62, x1 - 0.6, y0 + t, boy * 0.62 + 0.08, "glow_cyan")
        for cx in (-en * 0.22, en * 0.18):
            p.kutu(cx - 0.14, y0 + t - 0.02, boy * 0.3, cx + 0.14, y0 + t, boy * 0.3 + 0.28, "glow_cyan")
    else:
        p.kutu(x0, y0, 0, x1, y1, boy, "derz")
    nu, nv = max(1, round(en / 2)), max(1, round(boy / 2))
    nd = max(1, round(der / 2))
    yuzler = [
        (Vector((x1, y0, 0)), -X, Z, -Y, en, boy, nu, nv),     # ön (-Y), soldan sağa bakınca
        (Vector((x0, y1, 0)), X, Z, Y, en, boy, nu, nv),       # arka
        (Vector((x0, y0, 0)), Y, Z, -X, der, boy, nd, nv),     # sol
        (Vector((x1, y1, 0)), -Y, Z, X, der, boy, nd, nv),     # sağ
    ]
    if acik_on:
        yuzler = yuzler[1:]
    for o, u, v, n, U, V, a, b in yuzler:
        k = 2 if rng.random() < 0.35 else 1          # bazı yüzler 1 m karolu
        yuzey_panelle(p, rng, o, u, v, n, U, V, a * k, b * k, girinti=girinti, isik=isik)
    if ust_panel:
        yuzey_panelle(p, rng, Vector((x0, y0, boy)), X, Y, Z, en, der, nu, nd)
    # alt yüz karanlık kalır (referansta kulelerin altı gölgede)
    kenar_cubuklari(p, x0, y0, 0, x1, y1, boy)
    if yosun_kenar:
        # üst kenara tutunmuş yosun topakları (temiz blok bile tamamen çıplak değil)
        for (ax, ay), (bx, by) in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
            L = math.hypot(bx - ax, by - ay)
            t = rng.uniform(0, 0.4)
            while t < 1:
                if rng.random() < yosun_kenar:
                    c = Vector((ax + (bx - ax) * t, ay + (by - ay) * t, boy + 0.02))
                    p.kure(c, rng.uniform(0.12, 0.28), rng.choice(("yosun", "yosun_koyu", "yosun_acik")),
                           olcek=(1.3, 1.3, 0.45), puruz=0.35, tohum=rng.uniform(0, 99), alt=1)
                t += rng.uniform(0.3, 0.7) / L


# ── Bitki üreticileri (bir parçanın içine ekler; tek başına ya da saksı/blok üstünde) ─────
def yaprak_kumesi(p, rng, merkez, r, renkler, yaprak_sayisi=None, yaprak_boy=0.35, basik=0.75):
    """Yaprak kümesi: gürültülü çekirdek + yüzeye yatık, pul gibi örtüşen yapraklar (siluet tırtıklı, top değil)."""
    merkez = Vector(merkez)
    p.kure(merkez, r * 0.92, renkler[0], olcek=(1, 1, basik), puruz=0.32, tohum=rng.uniform(0, 50))
    if yaprak_sayisi is None:
        yaprak_sayisi = int(14 * (r / yaprak_boy) ** 2 * 0.55) + 12
    for _ in range(yaprak_sayisi):
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1) + 0.35)).normalized()
        taban = merkez + Vector((d.x, d.y, d.z * basik)) * r * rng.uniform(0.8, 1.0)
        t = d.cross(Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))).normalized()
        yon = (t * 0.75 + d * 0.45 - Z * 0.25).normalized()
        boy = yaprak_boy * rng.uniform(0.7, 1.2)
        # üstteki yapraklar açık, alttakiler koyu: ışık önceden boyanmış gibi
        renk = renkler[-1] if d.z > 0.45 and rng.random() < 0.7 else (renkler[0] if d.z < -0.1 else rng.choice(renkler))
        p.yaprak(taban, yon, d, boy, boy * 0.62, renk, kivrim=0.22)


def agac(p, rng, taban, boy, tac=1.0, renkler=("yaprak_koyu", "yaprak", "yaprak_acik")):
    """Geniş yapraklı ağaç: kıvrık uzun gövde, toprağa gömülen kök ayakları, 5–6 ana dal (her biri çatallı),
    dal uçlarında ve kubbe yüzeyinde örtüşen yaprak kümeleri — geniş, düzensiz taç (lolipop değil)."""
    taban = Vector(taban)
    egim = Vector((rng.uniform(-.1, .1), rng.uniform(-.1, .1), 0))
    gr = 0.032 * boy
    N = 9
    govde = [taban + Z * (boy * 0.58 * t) + egim * boy * t * t
             + Vector((math.sin(t * 5 + rng.random()) * 0.035 * boy * t, math.cos(t * 4) * 0.03 * boy * t, 0))
             for t in (i / N for i in range(N + 1))]
    p.tup(govde, [gr * (1.6 if i == 0 else 1.2 - 0.5 * i / N) for i in range(N + 1)], "kabuk", kenar=9, uc=False)
    for k in range(6):
        a = k * 2 * math.pi / 6 + rng.uniform(-.25, .25)
        d = Vector((math.cos(a), math.sin(a), 0))
        uz = gr * rng.uniform(2.5, 3.8)
        p.tup([taban + Z * gr * 2.0 + d * gr * 0.6, taban + d * uz * 0.6 + Z * gr * 0.35, taban + d * uz - Z * 0.08],
              [gr * 0.5, gr * 0.3, gr * 0.12], "kabuk", kenar=6)
    tepe = govde[-1]
    kumeler = []
    dal_sayisi = rng.randint(5, 6)
    for k in range(dal_sayisi):
        a = k * 2 * math.pi / dal_sayisi + rng.uniform(-.35, .35)
        cikis = govde[rng.randint(N - 3, N)]
        d = Vector((math.cos(a), math.sin(a), rng.uniform(0.35, 0.75))).normalized()
        uz = boy * rng.uniform(0.3, 0.42) * tac
        orta = cikis + d * uz * 0.5 + Z * uz * 0.1
        uc = cikis + d * uz + Z * uz * 0.08
        p.tup([cikis, orta, uc], [gr * 0.6, gr * 0.38, gr * 0.14], "kabuk", kenar=6)
        kumeler.append((uc, boy * rng.uniform(0.13, 0.17) * tac))
        yan = Vector((-d.y, d.x, 0)) * rng.choice((-1, 1))
        uc2 = orta + (d * 0.45 + yan * 0.55 + Z * 0.35).normalized() * uz * 0.5
        p.tup([orta, uc2], [gr * 0.28, gr * 0.1], "kabuk", kenar=5)
        kumeler.append((uc2, boy * rng.uniform(0.11, 0.14) * tac))
    # kubbe: tacın üst yüzeyine dağılmış dolgu kümeleri (dal uçları arasındaki boşlukları kapatır)
    C = tepe + Z * boy * 0.14
    R, H = boy * 0.4 * tac, boy * 0.2 * tac
    for _ in range(int(18 * tac + 8)):
        a = rng.uniform(0, 2 * math.pi)
        e = rng.uniform(0.0, 1.2)
        kumeler.append((C + Vector((math.cos(a) * math.cos(e) * R * 0.85, math.sin(a) * math.cos(e) * R * 0.85,
                                    math.sin(e) * H)), boy * rng.uniform(0.1, 0.14) * tac))
    for merkez, r in kumeler:
        yaprak_kumesi(p, rng, merkez, r, renkler, yaprak_boy=0.16 + boy * 0.028, basik=0.7)


def egrelti(p, rng, taban, boy, yaprak_sayisi=None, renk="egrelti"):
    """Eğrelti: merkezden kemerlenen yapraklar, her yaprakta uca doğru küçülen yaprakçıklar."""
    taban = Vector(taban)
    n = yaprak_sayisi or rng.randint(10, 14)
    for k in range(n):
        a = k * 2 * math.pi / n + rng.uniform(-.25, .25)
        d = Vector((math.cos(a), math.sin(a), 0))
        uz = boy * rng.uniform(0.75, 1.1)
        yuksel = math.radians(rng.uniform(50, 72))
        sark = rng.uniform(0.7, 1.0)
        N = 14
        omurga = []
        for i in range(N + 1):
            t = i / N
            omurga.append(taban + d * (uz * math.cos(yuksel) * t + uz * 0.25 * t * t)
                          + Z * max(0.02, uz * math.sin(yuksel) * t - uz * sark * t * t))
        yan = d.cross(Z).normalized()
        for i in range(1, N):
            t = i / N
            tg = (omurga[i + 1] - omurga[i - 1]).normalized()
            ly = boy * 0.3 * (math.sin(math.pi * min(1, t * 1.15)) ** 0.7) * (1 - 0.35 * t) + 0.02
            for s in (-1, 1):
                yon = (yan * s + tg * 0.45 - Z * 0.15).normalized()
                p.yaprak(omurga[i], yon, Z, ly, ly * 0.32, renk, kivrim=0.15)
        # damar: ince şerit
        for i in range(N):
            w = 0.012 * (1 - i / N) + 0.004
            a0, a1 = omurga[i], omurga[i + 1]
            vs = [p.bm.verts.new(q) for q in (a0 - yan * w, a0 + yan * w, a1 + yan * w, a1 - yan * w)]
            p._boya([p.bm.faces.new(vs)], renk, True)


def genis_yaprakli(p, rng, taban, boy, renk="yaprak"):
    """Fil kulağı benzeri: saplar üstünde büyük, uca doğru sarkan, ortadan katlı yapraklar."""
    taban = Vector(taban)
    n = rng.randint(6, 8)
    for k in range(n):
        a = k * 2 * math.pi / n + rng.uniform(-.3, .3)
        d = Vector((math.cos(a), math.sin(a), 0))
        sap_boy = boy * rng.uniform(0.45, 0.75)
        sap_uc = taban + d * sap_boy * 0.45 + Z * sap_boy
        p.tup([taban, taban + d * sap_boy * 0.15 + Z * sap_boy * 0.6, sap_uc], [0.025, 0.02, 0.015], "yaprak_koyu",
              kenar=5, uc=False)
        L = boy * rng.uniform(0.5, 0.75)
        W = L * 0.62
        N = 8
        yan = d.cross(Z).normalized()
        orta = []
        for i in range(N + 1):
            t = i / N
            orta.append(sap_uc + d * L * t + Z * (L * 0.25 * t - L * 0.55 * t * t))
        kenarlar = []
        for i in range(N + 1):
            t = i / N
            g = W * 0.5 * math.sin(math.pi * t) ** 0.8 * (1.1 - 0.4 * t)
            kenarlar.append((orta[i] + yan * g - Z * g * 0.25, orta[i] - yan * g - Z * g * 0.25))
        for i in range(N):
            for j in (0, 1):
                vs = [p.bm.verts.new(q) for q in (orta[i], kenarlar[i][j], kenarlar[i + 1][j], orta[i + 1])]
                p._boya([p.bm.faces.new(vs)], renk, True)


def cimen_tutamı(p, rng, taban, boy, n=18, yaricap=0.15, renk="cimen"):
    taban = Vector(taban)
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi)
        o = taban + Vector((math.cos(a), math.sin(a), 0)) * rng.uniform(0, yaricap)
        d = Vector((math.cos(a), math.sin(a), 0))
        h = boy * rng.uniform(0.6, 1.1)
        egil = rng.uniform(0.15, 0.45)
        yan = d.cross(Z).normalized()
        noktalar = [o + d * h * egil * t * t + Z * h * t for t in (0, 0.4, 0.75, 1.0)]
        genis = [0.02, 0.016, 0.009, 0.0]
        vs = []
        for q, w in zip(noktalar, genis):
            vs.append((p.bm.verts.new(q - yan * w), p.bm.verts.new(q + yan * w)))
        yuzler = []
        for i in range(3):
            if i == 2:
                yuzler.append(p.bm.faces.new((vs[i][0], vs[i][1], vs[i + 1][0])))
            else:
                yuzler.append(p.bm.faces.new((vs[i][0], vs[i][1], vs[i + 1][1], vs[i + 1][0])))
        p._boya(yuzler, renk, True)


def sarmasik_iplikleri(p, rng, x0, x1, y, z_ust, uz_min, uz_max, sik=0.12, yon=-1,
                       renkler=("yaprak_koyu", "yaprak", "yaprak", "yaprak_acik")):
    """Kenardan aşağı sarkan sarmaşık perdesi: iplik boyları gürültüyle komşu (perde perde), her düğümde iki
    örtüşen yaprak, uca doğru seyrelir; kenarın üstünde koyu yaprak bandı (sarmaşığın tutunduğu kalın kısım)."""
    tohum = rng.uniform(0, 100)
    x = x0
    while x < x1:
        g = noise.noise(Vector((x * 0.9, tohum, 0.5))) * 0.5 + 0.5
        uz = uz_min + (uz_max - uz_min) * g * rng.uniform(0.75, 1.1)
        adim = 0.075
        n = max(3, int(uz / adim))
        faz = rng.uniform(0, 6)
        for i in range(n):
            t = i / n
            z = z_ust - i * adim
            xx = x + math.sin(i * 0.35 + faz) * 0.06
            yy = y + yon * (0.03 + 0.03 * math.sin(i * 0.5 + faz))
            for s in (-1, 1):
                if t > 0.6 and rng.random() < (t - 0.6) * 1.6:
                    continue
                a = math.radians(rng.uniform(25, 75)) * s
                yon_v = Vector((math.sin(a), yon * rng.uniform(0.2, 0.6), -math.cos(a)))
                boy = rng.uniform(0.13, 0.21) * (1 - 0.35 * t)
                renk = renkler[0] if t < 0.15 and rng.random() < 0.6 else rng.choice(renkler)
                p.yaprak((xx, yy, z), yon_v, Vector((rng.uniform(-.3, .3), yon, rng.uniform(-.2, .3))), boy,
                         boy * 0.8, renk, kivrim=0.25)
        x += sik * rng.uniform(0.6, 1.3)
    # üst bant
    x = x0
    while x < x1:
        yaprak_kumesi(p, rng, (x, y + yon * 0.02, z_ust - 0.05), rng.uniform(0.14, 0.22), renkler[:3],
                      yaprak_sayisi=14, yaprak_boy=0.17, basik=0.6)
        x += rng.uniform(0.3, 0.45)


def yosun_ortu(p, rng, x0, y0, x1, y1, z, kalin=0.1, kenar_tasma=0.08, n=10, renkler=("yosun", "yosun_acik", "yosun_koyu")):
    """Üst yüzeye serilen yosun örtüsü: tümsekli ızgara, düzensiz kenar, üstünde küçük tümsekler."""
    x0, y0, x1, y1 = x0 - kenar_tasma, y0 - kenar_tasma, x1 + kenar_tasma, y1 + kenar_tasma
    tohum = rng.uniform(0, 100)
    vs = {}
    for i in range(n + 1):
        for j in range(n + 1):
            x = x0 + (x1 - x0) * i / n
            y = y0 + (y1 - y0) * j / n
            kenarda = i in (0, n) or j in (0, n)
            h = kalin * (0.4 + 0.6 * (noise.noise(Vector((x * 0.9, y * 0.9, tohum))) * 0.5 + 0.5))
            if kenarda:
                h = 0.015
                x += rng.uniform(-0.06, 0.06) if j not in (0, n) else 0
                y += rng.uniform(-0.06, 0.06) if i not in (0, n) else 0
            vs[i, j] = p.bm.verts.new((x, y, z + h))
    yuzler = []
    for i in range(n):
        for j in range(n):
            yuzler.append(p.bm.faces.new((vs[i, j], vs[i + 1, j], vs[i + 1, j + 1], vs[i, j + 1])))
    p._boya(yuzler, renkler[0], True)
    for _ in range(int((x1 - x0) * (y1 - y0) * 1.2)):
        c = (rng.uniform(x0 + .2, x1 - .2), rng.uniform(y0 + .2, y1 - .2), z + kalin * 0.6)
        p.kure(c, rng.uniform(0.12, 0.3), rng.choice(renkler), olcek=(1, 1, 0.45), puruz=0.35,
               tohum=rng.uniform(0, 99), alt=1)


# ── Varlıklar ────────────────────────────────────────────────────────────────
def duvar_panel(ad, rng, girinti=0.08, isik=0.5, sarmasik=False):
    p = Parca(ad)
    en, kal, boy = 4.0, 0.4, 4.0
    p.kutu(-en / 2, -kal / 2, 0, en / 2, kal / 2, boy, "derz")
    for o, u, n in ((Vector((en / 2, -kal / 2, 0)), -X, -Y), (Vector((-en / 2, kal / 2, 0)), X, Y)):
        yuzey_panelle(p, rng, o, u, Z, n, en, boy, 2, 2, girinti=girinti, isik=isik)
    p.kutu(-en / 2, -kal / 2 - 0.05, boy - 0.12, en / 2, kal / 2 + 0.05, boy, "bakir")
    p.kutu(-en / 2, -kal / 2 - 0.05, 0, en / 2, kal / 2 + 0.05, 0.14, "bakir")
    if sarmasik:
        yosun_ortu(p, rng, -en / 2, -kal / 2, en / 2, kal / 2, boy, kalin=0.12, n=8)
        sarmasik_iplikleri(p, rng, -en / 2 + 0.05, en / 2 - 0.05, -kal / 2 - 0.08, boy, 1.0, 3.2)
    return p


def duvar_pencere(ad, rng):
    p = Parca(ad)
    en, kal, boy = 4.0, 0.4, 4.0
    wx, wz0, wz1 = 0.85, 1.25, 2.85            # açıklık yarı eni, alt/üst
    girinti_derin = 0.1
    # çekirdek açıklığın çevresinde
    p.kutu(-en / 2, -kal / 2, 0, -wx, kal / 2, boy, "derz")
    p.kutu(wx, -kal / 2, 0, en / 2, kal / 2, boy, "derz")
    p.kutu(-wx, -kal / 2, 0, wx, kal / 2, wz0, "derz")
    p.kutu(-wx, -kal / 2, wz1, wx, kal / 2, boy, "derz")
    p.kutu(-wx, -kal / 2 + girinti_derin + 0.12, wz0, wx, kal / 2, wz1, "girinti")   # içerisi karanlık
    p.kutu(-0.12, -kal / 2 + girinti_derin + 0.1, 1.75, 0.18, -kal / 2 + girinti_derin + 0.12, 2.05, "glow_cyan")
    p.kutu(-0.6, -kal / 2 + girinti_derin + 0.1, 2.45, -0.35, -kal / 2 + girinti_derin + 0.12, 2.55, "glow_cyan")
    # bakır pencere çerçevesi
    t = 0.09
    p.kutu(-wx - t, -kal / 2 - 0.05, wz0 - t, wx + t, -kal / 2 + girinti_derin + 0.12, wz0, "bakir")
    p.kutu(-wx - t, -kal / 2 - 0.05, wz1, wx + t, -kal / 2 + girinti_derin + 0.12, wz1 + t, "bakir")
    p.kutu(-wx - t, -kal / 2 - 0.05, wz0, -wx, -kal / 2 + girinti_derin + 0.12, wz1, "bakir")
    p.kutu(wx, -kal / 2 - 0.05, wz0, wx + t, -kal / 2 + girinti_derin + 0.12, wz1, "bakir")
    acik = lambda a0, a1, b0, b1: (en / 2 - a1) < wx + 0.05 and (en / 2 - a0) > -wx - 0.05 and b1 > wz0 - 0.1 and b0 < wz1 + 0.1
    yuzey_panelle(p, rng, Vector((en / 2, -kal / 2, 0)), -X, Z, -Y, en, boy, 4, 4, atla=acik)
    yuzey_panelle(p, rng, Vector((-en / 2, kal / 2, 0)), X, Z, Y, en, boy, 2, 2)
    p.kutu(-en / 2, -kal / 2 - 0.05, boy - 0.12, en / 2, kal / 2 + 0.05, boy, "bakir")
    p.kutu(-en / 2, -kal / 2 - 0.05, 0, en / 2, kal / 2 + 0.05, 0.14, "bakir")
    return p


def duvar_menfez(ad, rng):
    p = duvar_panel(ad, rng, girinti=0.0)
    for i, z in enumerate((2.55, 2.8, 3.05)):
        p.kutu(-1.4, -0.26, z, 1.4, -0.2, z + 0.12, "girinti")
        for k in range(4):
            if (i + k) % 3 == 0:
                cx = -1.1 + k * 0.72
                p.kutu(cx - 0.08, -0.265, z + 0.03, cx + 0.08, -0.255, z + 0.09, "glow_cyan")
    return p


def duvar_kirik(ad, rng):
    p = Parca(ad)
    en, kal = 4.0, 0.4
    sutun = 8
    w = en / sutun
    boylar = [4.0 - abs(math.sin(i * 1.3 + 0.5)) * 1.6 - rng.uniform(0, 0.4) for i in range(sutun)]
    boylar[0] = boylar[-1] = 4.0
    for i, h in enumerate(boylar):
        x0 = -en / 2 + i * w
        p.kutu(x0, -kal / 2, 0, x0 + w, kal / 2, h, "derz")
        mat = rng.choice(BETONLAR)
        for j in range(int(h // 1.0)):
            for yy, cc in ((-kal / 2, -0.03), (kal / 2, 0.03)):
                p.kutu(x0 + 0.035, min(yy, yy + cc), j + 0.035, x0 + w - 0.035, max(yy, yy + cc), j + 0.965, mat)
        # kırık uç: eğri beton parçası
        p.kutu_doner((x0 + w / 2, 0, h), (w * 0.95, kal * 0.9, 0.2), "beton_koyu", rz=rng.uniform(-.1, .1),
                     rx=rng.uniform(-.2, .2), ry=rng.uniform(-.3, .3))
    p.kutu(-en / 2, -kal / 2 - 0.05, 0, en / 2, kal / 2 + 0.05, 0.14, "bakir")
    for _ in range(9):
        s = rng.uniform(0.15, 0.45)
        p.kutu_doner((rng.uniform(-1.6, 1.6), rng.uniform(-0.9, -0.35), s * 0.35), (s, s * 0.8, s * 0.6),
                     rng.choice(BETONLAR), rz=rng.uniform(0, 3), rx=rng.uniform(-.4, .4))
    yosun_ortu(p, rng, -1.2, -1.0, 1.2, -0.3, 0.0, kalin=0.06, n=6)
    return p


def duvar_sutun(ad, rng):
    p = Parca(ad)
    a, boy = 0.35, 4.0
    p.kutu(-a, -a, 0, a, a, boy, "beton")
    for z0 in (0, 1.95, boy - 0.15):
        p.kutu(-a - 0.04, -a - 0.04, z0, a + 0.04, a + 0.04, z0 + 0.15, "bakir")
    for o, u, n in ((Vector((a, -a, 0.15)), -X, -Y), (Vector((-a, a, 0.15)), X, Y),
                    (Vector((-a, -a, 0.15)), Y, -X), (Vector((a, a, 0.15)), -Y, X)):
        yuzey_panelle(p, rng, o, u, Z, n, 2 * a, 1.8, 1, 1)
        yuzey_panelle(p, rng, o + Z * 1.95, u, Z, n, 2 * a, 1.9, 1, 1)
    return p


def duvar_korniz(ad, rng):
    p = Parca(ad)
    p.kutu(-2, -0.35, 0, 2, 0.35, 0.3, "beton")
    p.kutu(-2, -0.4, 0.08, 2, -0.35, 0.22, "bakir")
    for k in range(4):
        p.kutu(-1.9 + k, -0.36, 0.0, -1.1 + k, 0.36, 0.04, "derz")
    return p


def blok_kup(ad, rng, **kw):
    p = Parca(ad)
    blok_govde(p, rng, 4, 4, 4, **kw)
    return p


def kup_sarmasigi(p, rng, ad, yuzler):
    """Küpün yüzlerinden sarmaşık sarkıtır. `yuzler`: [(çeyrek dönüş, en kısa, en uzun)] — 0 = ön (-Y), 1 = sağ (+X)…
    İplikler ön yüz için kurulur, sonra Z çevresinde döndürülüp eklenir (tek üretici, dört yüz)."""
    for ceyrek, uz_min, uz_max in yuzler:
        q = Parca(ad + "_gecici")
        sarmasik_iplikleri(q, rng, -1.95, 1.95, -2.12, 4.08, uz_min, uz_max)
        if ceyrek:
            bmesh.ops.rotate(q.bm, verts=q.bm.verts[:], cent=(0, 0, 0),
                             matrix=Matrix.Rotation(math.pi / 2 * ceyrek, 3, "Z"))
        _birlestir(p, q)


def blok_kup_yesil(ad, rng):
    """Üstü yosunlu, iki yüzünden uzun sarmaşık sarkan küp: referanstaki kulelerin tipik katı."""
    p = Parca(ad)
    blok_govde(p, rng, 4, 4, 4, girinti=0.15, yosun_kenar=0)
    yosun_ortu(p, rng, -2, -2, 2, 2, 4.04, kalin=0.18, kenar_tasma=0.12)
    kup_sarmasigi(p, rng, ad, [(0, 0.8, 3.4), (1, 0.5, 2.6)])
    yaprak_kumesi(p, rng, (1.3, -1.2, 4.35), 0.55, ("yaprak_koyu", "yaprak", "yaprak_acik"), yaprak_boy=0.22)
    egrelti(p, rng, (-1.1, 0.8, 4.12), 0.9)
    return p


def blok_kup_yosunlu(ad, rng):
    """Dört yüzünden kısa sarmaşık saçağı, üstünde çalı ve eğrelti: hangi yöne çevrilse yeşil görünür."""
    p = Parca(ad)
    blok_govde(p, rng, 4, 4, 4, girinti=0.2, yosun_kenar=0)
    yosun_ortu(p, rng, -2, -2, 2, 2, 4.04, kalin=0.16, kenar_tasma=0.12)
    kup_sarmasigi(p, rng, ad, [(k, 0.3, 1.6) for k in range(4)])
    yaprak_kumesi(p, rng, (-0.8, -0.6, 4.4), 0.65, ("yaprak_koyu", "yaprak", "yaprak_acik"), yaprak_boy=0.22)
    yaprak_kumesi(p, rng, (0.9, 0.9, 4.35), 0.5, ("yaprak_koyu", "yaprak", "yaprak_acik"), yaprak_boy=0.2)
    egrelti(p, rng, (1.0, -1.0, 4.12), 1.0)
    egrelti(p, rng, (-1.2, 1.1, 4.12), 0.8)
    return p


def _birlestir(p, q):
    """q'nun geometrisini malzemeleriyle p'ye ekler, q'yu boşaltır."""
    me = bpy.data.meshes.new("_gecici")
    q.bm.to_mesh(me)
    q.bm.free()
    harita = [p._mi(ad) for ad in q.malz]
    once = len(p.bm.faces)
    p.bm.from_mesh(me)
    p.bm.faces.ensure_lookup_table()
    for f in p.bm.faces[once:]:
        f.material_index = harita[f.material_index] if f.material_index < len(harita) else 0
    bpy.data.meshes.remove(me)


def blok_cikma(ad, rng):
    """Dışa taşan alçak modül (4 × 3 × 2): ön yüzünde karanlık pencere şeridi."""
    p = Parca(ad)
    blok_govde(p, rng, 4, 3, 2, girinti=0.0, ust_panel=True)
    p.kutu(-1.7, -1.56, 0.65, 1.7, -1.5, 1.35, "girinti")
    for cx in (-1.1, -0.2, 0.9):
        if rng.random() < 0.8:
            p.kutu(cx - 0.12, -1.565, 0.85, cx + 0.12, -1.555, 1.1, "glow_cyan")
    p.kutu(-1.8, -1.6, 0.6, 1.8, -1.48, 0.66, "bakir")
    p.kutu(-1.8, -1.6, 1.34, 1.8, -1.48, 1.4, "bakir")
    return p


def blok_saksi(ad, rng):
    """Üstü açık beton saksı (4 × 4 × 1,2): toprak, çalı, eğrelti, kenardan sarkan sarmaşık."""
    p = Parca(ad)
    t, h = 0.3, 1.2
    for x0, y0, x1, y1 in ((-2, -2, 2, -2 + t), (-2, 2 - t, 2, 2), (-2, -2 + t, -2 + t, 2 - t), (2 - t, -2 + t, 2, 2 - t)):
        p.kutu(x0, y0, 0, x1, y1, h, rng.choice(BETONLAR))
    p.kutu(-2 + t, -2 + t, 0, 2 - t, 2 - t, h - 0.15, "toprak")
    kenar_cubuklari(p, -2, -2, 0, 2, 2, h, k=0.1)
    yaprak_kumesi(p, rng, (0.6, 0.5, h + 0.45), 0.7, ("yaprak_koyu", "yaprak", "yaprak_acik"), yaprak_boy=0.24)
    yaprak_kumesi(p, rng, (-0.5, 0.9, h + 0.35), 0.55, ("yaprak_koyu", "yaprak", "yaprak_acik"), yaprak_boy=0.22)
    egrelti(p, rng, (-0.9, -0.8, h - 0.15), 1.0)
    genis_yaprakli(p, rng, (0.9, -0.9, h - 0.15), 0.9)
    sarmasik_iplikleri(p, rng, -1.9, 1.9, -2.08, h + 0.02, 0.4, h - 0.1)
    return p


def blok_doseme(ad, rng):
    p = Parca(ad)
    p.kutu(-2, -2, 0, 2, 2, 0.4, "beton_koyu")
    yuzey_panelle(p, rng, Vector((-2, -2, 0.4)), X, Y, Z, 4, 4, 2, 2, cikinti=0.02)
    for o, u, n in ((Vector((2, -2, 0)), -X, -Y), (Vector((-2, 2, 0)), X, Y), (Vector((-2, -2, 0)), Y, -X),
                    (Vector((2, 2, 0)), -Y, X)):
        p.kutu_yerel(o, u, Z, n, (0, 4), (0.12, 0.28), (0, 0.03), "bakir")
    return p


def zemin_tasi(ad, rng, kirik=False):
    p = Parca(ad)
    h = 0.15
    g = 0.04    # derz yarı genişliği
    if not kirik:
        p.prizma([(-1 + g, -1 + g), (1 - g, -1 + g), (1 - g, 1 - g), (-1 + g, 1 - g)], 0, h, "zemin_tas")
    else:
        parcalar = [
            [(-1 + g, -1 + g), (0.25, -1 + g), (-0.15, 0.1), (-1 + g, 0.35)],
            [(0.25 + 2 * g, -1 + g), (1 - g, -1 + g), (1 - g, 0.5), (0.2, 0.25), (-0.15 + 2 * g, 0.12)],
            [(-1 + g, 0.35 + 2 * g), (-0.15, 0.1 + 2 * g), (0.2, 0.25 + 2 * g), (1 - g, 0.5 + 2 * g), (1 - g, 1 - g),
             (-1 + g, 1 - g)],
        ]
        for i, c in enumerate(parcalar):
            p.prizma(c, 0, h - 0.015 * i, "zemin_tas")
        p.kutu(-0.95, -0.95, 0, 0.95, 0.95, 0.03, "toprak")
        for (x, y) in ((-0.5, 0.25), (0.05, 0.18), (0.6, 0.38), (0.15, -0.4), (-0.2, 0.05)):
            cimen_tutamı(p, rng, (x, y, 0.03), 0.22, n=10, yaricap=0.08)
    # bakır kenar şeridi (referans: açık taşların arasında paslı çizgi)
    s = 0.035
    p.kutu(-1, -1, 0, 1, -1 + s, h - 0.03, "bakir")
    p.kutu(-1, 1 - s, 0, 1, 1, h - 0.03, "bakir")
    p.kutu(-1, -1 + s, 0, -1 + s, 1 - s, h - 0.03, "bakir")
    p.kutu(1 - s, -1 + s, 0, 1, 1 - s, h - 0.03, "bakir")
    return p


def havuz_kenari(ad, rng, kose=False):
    p = Parca(ad)
    h = 0.4
    if kose:
        p.kutu(-0.3, -0.3, 0, 0.3, 0.3, h, "beton")
        p.kutu(-0.34, -0.34, h - 0.06, 0.34, 0.34, h, "beton_acik")
        p.kutu(-0.35, -0.35, h - 0.12, 0.35, 0.35, h - 0.06, "bakir")
        return p
    p.kutu(-2, -0.3, 0, 2, 0.3, h, "beton")
    p.kutu(-2, -0.34, h - 0.06, 2, 0.34, h, "beton_acik")      # başlık taşı
    p.kutu(-2, -0.35, h - 0.12, 2, 0.35, h - 0.06, "bakir")
    for k in range(4):
        p.kutu(-2 + k + 0.02, -0.31, 0.04, -1 + k - 0.02, -0.3, h - 0.16, rng.choice(BETONLAR))
    for x in (-1.3, 0.4, 1.5):
        cimen_tutamı(p, rng, (x, 0.42, 0), 0.25, n=8, yaricap=0.06)
    return p


def havuz_su(ad, rng):
    p = Parca(ad)
    p.kutu(-2, -2, 0, 2, 2, 0.04, "girinti")    # havuz tabanı
    p.kutu(-2, -2, 0.27, 2, 2, 0.28, "su")      # su yüzeyi (kenar başlığının 12 cm altı)
    return p


def kopru(ad, rng):
    """8 m köprü: tabliye, iki yanda alçak korkuluk, altta karanlık kirişler, üstte yosun yamaları."""
    p = Parca(ad)
    L, W, h = 8.0, 2.4, 0.6
    p.kutu(-L / 2, -W / 2, 0.25, L / 2, W / 2, h, "beton")
    p.kutu(-L / 2, -0.8, 0, L / 2, -0.5, 0.25, "girinti")
    p.kutu(-L / 2, 0.5, 0, L / 2, 0.8, 0.25, "girinti")
    for s in (-1, 1):
        p.kutu(-L / 2, s * W / 2 - 0.15, h, L / 2, s * W / 2 + 0.15, h + 0.45, "beton_acik")
        p.kutu(-L / 2, s * (W / 2 + 0.15) - 0.03, h + 0.1, L / 2, s * (W / 2 + 0.15) + 0.03, h + 0.18, "bakir")
        for k in range(8):
            yuzey_panelle(p, rng, Vector((-L / 2 + k, s * (W / 2), 0.25)) if s > 0 else Vector((-L / 2 + k + 1, -W / 2, 0.25)),
                          X if s > 0 else -X, Z, Y if s > 0 else -Y, 1.0, 0.35, 1, 1, bosluk=0.05, cikinti=0.02)
    for x0, x1, y0, y1 in ((-3.6, -1.2, -0.9, 0.2), (0.4, 2.9, -0.3, 0.95)):
        yosun_ortu(p, rng, x0, y0, x1, y1, h, kalin=0.08, n=6)
    kenar_cubuklari(p, -L / 2, -W / 2, 0.25, L / 2, W / 2, h, k=0.08)
    return p


def detay_isik(ad, rng):
    p = Parca(ad)
    p.kutu(-0.25, -0.06, 0, 0.25, 0, 0.5, "bakir")
    p.kutu(-0.19, -0.075, 0.06, 0.19, -0.06, 0.44, "glow_cyan")
    return p


def detay_moloz(ad, rng):
    p = Parca(ad)
    for _ in range(11):
        s = rng.uniform(0.12, 0.5)
        p.kutu_doner((rng.uniform(-0.7, 0.7), rng.uniform(-0.6, 0.6), s * 0.3), (s, s * rng.uniform(0.6, 1), s * 0.6),
                     rng.choice(BETONLAR), rz=rng.uniform(0, 3), rx=rng.uniform(-.5, .5), ry=rng.uniform(-.5, .5))
    p.kutu_doner((0.1, 0.0, 0.08), (1.2, 0.08, 0.06), "bakir", rz=0.6, ry=0.15)
    return p


def bitki(ad, rng, tur):
    p = Parca(ad)
    if tur == "agac_buyuk":
        agac(p, rng, (0, 0, 0), 9.0, tac=1.0)
    elif tur == "agac_orta":
        agac(p, rng, (0, 0, 0), 5.5, tac=0.85, renkler=("yaprak", "yaprak", "yaprak_acik"))
    elif tur == "egrelti_buyuk":
        egrelti(p, rng, (0, 0, 0), 1.3)
    elif tur == "egrelti_kucuk":
        egrelti(p, rng, (0, 0, 0), 0.7, yaprak_sayisi=9)
    elif tur == "calı":
        for k in range(4):
            a = k * 1.7
            yaprak_kumesi(p, rng, (math.cos(a) * 0.45, math.sin(a) * 0.45, 0.45 + 0.1 * k), rng.uniform(0.45, 0.6),
                          ("yaprak_koyu", "yaprak", "yaprak_acik"), yaprak_boy=0.2, basik=0.8)
    elif tur == "genis_yaprak":
        genis_yaprakli(p, rng, (0, 0, 0), 1.1)
    elif tur == "cimen":
        cimen_tutamı(p, rng, (0, 0, 0), 0.35, n=28, yaricap=0.22)
    elif tur == "cimen_serit":
        for k in range(9):
            cimen_tutamı(p, rng, (-0.9 + k * 0.225 + rng.uniform(-.05, .05), rng.uniform(-.03, .03), 0), 0.22,
                         n=8, yaricap=0.05)
    elif tur == "sarmasik":
        # 4 m kenar: orijin asıldığı üst kenarda; dudak üstte (+Y, içeri), iplikler kenardan 0,8–3 m aşağı
        yosun_ortu(p, rng, -2, 0.0, 2, 0.45, 0.0, kalin=0.1, kenar_tasma=0.05, n=8)
        sarmasik_iplikleri(p, rng, -1.95, 1.95, -0.05, 0.04, 0.8, 3.0)
    elif tur == "yosun_ortu":
        yosun_ortu(p, rng, -2, -2, 2, 2, 0.0, kalin=0.16, kenar_tasma=0.1)
    return p


# (ad, kurucu, satır) — satır: sahnede dizilen sıra (yalnız göz için; dışa aktarım pivotu düzeltir)
VARLIKLAR = [
    ("RUIN_WALL_Panel_4x4", lambda r: duvar_panel("RUIN_WALL_Panel_4x4", r), 0),
    ("RUIN_WALL_PanelLit_4x4", lambda r: duvar_panel("RUIN_WALL_PanelLit_4x4", r, girinti=0.35, isik=0.8), 0),
    ("RUIN_WALL_Window_4x4", lambda r: duvar_pencere("RUIN_WALL_Window_4x4", r), 0),
    ("RUIN_WALL_Vent_4x4", lambda r: duvar_menfez("RUIN_WALL_Vent_4x4", r), 0),
    ("RUIN_WALL_Broken_4x4", lambda r: duvar_kirik("RUIN_WALL_Broken_4x4", r), 0),
    ("RUIN_WALL_Overgrown_4x4", lambda r: duvar_panel("RUIN_WALL_Overgrown_4x4", r, sarmasik=True), 0),
    ("RUIN_WALL_Pillar_4", lambda r: duvar_sutun("RUIN_WALL_Pillar_4", r), 0),
    ("RUIN_WALL_Ledge_4", lambda r: duvar_korniz("RUIN_WALL_Ledge_4", r), 0),
    ("RUIN_BLK_Cube_4", lambda r: blok_kup("RUIN_BLK_Cube_4", r), 1),
    ("RUIN_BLK_CubeLit_4", lambda r: blok_kup("RUIN_BLK_CubeLit_4", r, girinti=0.4, isik=0.85), 1),
    ("RUIN_BLK_CubeOpen_4", lambda r: blok_kup("RUIN_BLK_CubeOpen_4", r, acik_on=True), 1),
    ("RUIN_BLK_CubeOvergrown_4", lambda r: blok_kup_yesil("RUIN_BLK_CubeOvergrown_4", r), 1),
    ("RUIN_BLK_CubeMossy_4", lambda r: blok_kup_yosunlu("RUIN_BLK_CubeMossy_4", r), 1),
    ("RUIN_BLK_Cantilever_4x3x2", lambda r: blok_cikma("RUIN_BLK_Cantilever_4x3x2", r), 1),
    ("RUIN_BLK_Planter_4", lambda r: blok_saksi("RUIN_BLK_Planter_4", r), 1),
    ("RUIN_BLK_Slab_4", lambda r: blok_doseme("RUIN_BLK_Slab_4", r), 1),
    ("RUIN_FLR_Tile_2x2", lambda r: zemin_tasi("RUIN_FLR_Tile_2x2", r), 2),
    ("RUIN_FLR_TileCracked_2x2", lambda r: zemin_tasi("RUIN_FLR_TileCracked_2x2", r, kirik=True), 2),
    ("RUIN_POOL_Edge_4", lambda r: havuz_kenari("RUIN_POOL_Edge_4", r), 2),
    ("RUIN_POOL_Corner", lambda r: havuz_kenari("RUIN_POOL_Corner", r, kose=True), 2),
    ("RUIN_POOL_Water_4x4", lambda r: havuz_su("RUIN_POOL_Water_4x4", r), 2),
    ("RUIN_BRG_Span_8", lambda r: kopru("RUIN_BRG_Span_8", r), 2),
    ("RUIN_DET_LightPanel", lambda r: detay_isik("RUIN_DET_LightPanel", r), 2),
    ("RUIN_DET_Rubble", lambda r: detay_moloz("RUIN_DET_Rubble", r), 2),
    ("PLANT_Tree_Broadleaf_LG", lambda r: bitki("PLANT_Tree_Broadleaf_LG", r, "agac_buyuk"), 3),
    ("PLANT_Tree_Young_MD", lambda r: bitki("PLANT_Tree_Young_MD", r, "agac_orta"), 3),
    ("PLANT_Bush_MD", lambda r: bitki("PLANT_Bush_MD", r, "calı"), 3),
    ("PLANT_Fern_LG", lambda r: bitki("PLANT_Fern_LG", r, "egrelti_buyuk"), 3),
    ("PLANT_Fern_SM", lambda r: bitki("PLANT_Fern_SM", r, "egrelti_kucuk"), 3),
    ("PLANT_BigLeaf_MD", lambda r: bitki("PLANT_BigLeaf_MD", r, "genis_yaprak"), 3),
    ("PLANT_Grass_Tuft", lambda r: bitki("PLANT_Grass_Tuft", r, "cimen"), 3),
    ("PLANT_Grass_Strip_2", lambda r: bitki("PLANT_Grass_Strip_2", r, "cimen_serit"), 3),
    ("PLANT_Ivy_Hang_4", lambda r: bitki("PLANT_Ivy_Hang_4", r, "sarmasik"), 3),
    ("PLANT_Moss_Cap_4", lambda r: bitki("PLANT_Moss_Cap_4", r, "yosun_ortu"), 3),
]

PAHLI = ("RUIN_WALL_", "RUIN_BLK_", "RUIN_BRG_", "RUIN_POOL_Edge", "RUIN_POOL_Corner", "RUIN_DET_")


def kur(yalniz=None):
    """Kiti kurar. `yalniz`: yalnız bu adları yeniden kur (hızlı yineleme)."""
    sahne = bpy.data.scenes[0]
    kol = bpy.data.collections.get(KOLEKSIYON)
    if kol is None:
        kol = bpy.data.collections.new(KOLEKSIYON)
        sahne.collection.children.link(kol)
    for ob in list(kol.objects):
        if yalniz is None or ob.name in yalniz:
            me = ob.data
            bpy.data.objects.remove(ob)
            if me and me.users == 0:
                bpy.data.meshes.remove(me)
    sayac = {}
    ozet = []
    for i, (ad, kurucu, satir) in enumerate(VARLIKLAR):
        sutun = sayac.get(satir, 0)
        sayac[satir] = sutun + 1
        if yalniz is not None and ad not in yalniz:
            continue
        rng = random.Random(zlib.crc32(ad.encode()))   # tohum addan: parça eklemek/sırayı değiştirmek ötekileri oynatmaz
        p = kurucu(rng)
        ob = p.nesne((sutun * 11.0, satir * 14.0, 0), kol, pah=0.02 if ad.startswith(PAHLI) else 0.0)
        ozet.append((ad, len(ob.data.polygons)))
    return ozet


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ozet = kur()
    if "--kaydet" in argv:
        bpy.ops.wm.save_as_mainfile(filepath=argv[argv.index("--kaydet") + 1])
    for ad, n in ozet:
        print(f"[ORMAN] {ad:30s} yuz={n}")
