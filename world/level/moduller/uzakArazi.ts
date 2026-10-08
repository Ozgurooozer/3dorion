// world/level/moduller/uzakArazi.ts — Blender'da şekillenen uzak arazi (tepe halkası, masa dağları, büyük kayalar).
//
// BİÇİM Blender'dan (assets/kaynak/ova-arazi.py → assets/ova-arazi.glb), RENK buradan: paletten, yüksekliğe ve
// eğime göre, üstüne hava perspektifi (uzaklık ve alçak pus ufuk rengine karıştırır). Bu yüzden paneldeki palet
// ve bu ayarlar araziyi canlı değiştirir; Blender'a dönmek yalnız biçim için gerekir.
//
// Nesne adı anlam taşır (betiğin başındaki sözleşme): `kaya*` kaya rengi alır; `masa*` ve `kaya*` zemine
// oturtulur — merkezleri zemin yüksekliği kadar kaydırılır. Bu yüzden tanımda ZEMİNDEN SONRA gelmeli.
//
// Yükleme eşzamansız: `kur` hemen boş döner, glb gelince mesh eklenir (aynı oturumda dosya bir kez indirilir,
// ayar değişince yalnız boyama yeniden yapılır). Yüklenemezse konsola HATA yazar; level geri kalanıyla açılır.
"use strict";
import { flatGeometri, meshKur, type Ucgen, type V3 } from "../cekirdek/geometri.ts";
import { glbOku, type GlbNesnesi } from "../cekirdek/glb.ts";
import { karistir, type Renk } from "../cekirdek/renk.ts";
import { gurultu, rastgele } from "../cekirdek/rastgele.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";

/** Biçim dosyası (assets/ altında; geliştirmede "/", pakette "./" — varlik.ts çözer). */
export const ARAZI_DOSYASI = "ova-arazi.glb";

export const UZAK_ARAZI_VARSAYILAN = {
  /** Yükseklik bantları (alttan üste); renkler.length = esikler.length + 1. */
  renkler: ["cimOrta", "cimKoyu", "toprak", "kaya"],
  /** Bant sınırları (m). */
  esikler: [6, 20, 42],
  /** Bant sınırını kıran gürültü genliği (m): düz kontur çizgisi olmasın. */
  bantGurultu: 7,
  /** Yüz normalinin y'si bunun altındaysa yüz DİK sayılır (kayalık yamaç). */
  dikEsik: 0.6,
  dik: "kaya",
  /** `kaya*` nesnelerinin rengi (dik yüzleri `dik`). */
  kaya: "kaya",
  /** Yüz başına parlaklık oynaması (0 = yok): lowpoly yüzeyler ayırt edilsin. */
  titreme: 0.06,
  /**
   * Sahnenin sisi bu katmana da uygulansın mı. Açık (varsayılan): uzak sırtlar zeminle AYNI sise gömülür —
   * kapalıyken dağlar soluklaşan zeminin üstüne yapıştırılmış gibi durdu (görüntüde kıyaslandı, spec 17).
   */
  sis: true,
  /** Ek hava perspektifi (sise ek, köşe renginde): `havaYakin`'dan `havaUzak`'a (m) ufuk rengine `havaGuc` kadar. */
  hava: "gokUfuk",
  havaYakin: 90,
  havaUzak: 430,
  havaGuc: 0,
  /** Alçak pus: yere yakın yüzler ek karışır, `pusYukseklik` (m) üstünde biter — dağlar pustan yükselir. */
  pus: 0.3,
  pusYukseklik: 22,
  /** Masa dağları ve kayaları zemine oturt. */
  oturt: true,
  golgeAtar: true,
  tohum: 5,
};
export type UzakAraziAyari = typeof UZAK_ARAZI_VARSAYILAN;

const yumusak = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };

/** Biçimi boyar (ve isteğe bağlı zemine oturtur): saf, sahnesiz test edilir. */
export function araziUcgenleri(
  nesneler: readonly GlbNesnesi[], a: UzakAraziAyari, renk: (ad: string) => Renk, yukseklik: (x: number, z: number) => number,
): Ucgen[] {
  if (a.renkler.length !== a.esikler.length + 1) throw new Error("uzakArazi: renkler.length = esikler.length + 1 olmalı");
  const rnd = rastgele(a.tohum);
  const bantlar = a.renkler.map(renk), dik = renk(a.dik), kaya = renk(a.kaya), hava = renk(a.hava);
  const u: Ucgen[] = [];
  for (const n of nesneler) {
    const kayaMi = n.ad.startsWith("kaya");
    let dy = 0;
    if (a.oturt && (kayaMi || n.ad.startsWith("masa")) && n.ucgenler.length) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const t of n.ucgenler) for (const p of t) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
      dy = yukseklik((x0 + x1) / 2, (z0 + z1) / 2);
    }
    for (const t of n.ucgenler) {
      const [p, q, r] = t.map((v): V3 => [v[0], v[1] + dy, v[2]]) as [V3, V3, V3];
      const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], e2 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
      const nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!, ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!, nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
      const egim = ny / (Math.hypot(nx, ny, nz) || 1);
      const cx = (p[0] + q[0] + r[0]) / 3, cy = (p[1] + q[1] + r[1]) / 3, cz = (p[2] + q[2] + r[2]) / 3;
      let c: Renk;
      if (egim < a.dikEsik) c = dik;
      else if (kayaMi) c = kaya;
      else {
        const h = cy + (gurultu(cx / 40, cz / 40, a.tohum) - 0.5) * 2 * a.bantGurultu;
        const i = a.esikler.findIndex((e) => h < e);
        c = bantlar[i === -1 ? bantlar.length - 1 : i]!;
      }
      const s = 1 + (rnd() - 0.5) * 2 * a.titreme;
      c = [c[0] * s, c[1] * s, c[2] * s];
      const uzak = a.havaGuc * yumusak(a.havaYakin, a.havaUzak, Math.hypot(cx, cz));
      const alcak = a.pus * (1 - yumusak(0, a.pusYukseklik, cy));
      c = karistir(c, hava, 1 - (1 - uzak) * (1 - alcak));
      u.push({ a: p, b: q, c: r, renk: c });
    }
  }
  return u;
}

/** Oturum içi önbellek: dosya bir kez indirilir ve ayrıştırılır. */
const onbellek = new Map<string, Promise<GlbNesnesi[]>>();
function bicimYukle(): Promise<GlbNesnesi[]> {
  let p = onbellek.get(ARAZI_DOSYASI);
  if (!p) {
    // varlik.ts import.meta.env okur (yalnız Vite'ta var): dinamik import, modül kaydı Node testlerinde de yüklensin.
    p = import("../../varlik.ts")
      .then(({ varlik }) => fetch(varlik(ARAZI_DOSYASI)))
      .then((y) => { if (!y.ok) throw new Error(`${ARAZI_DOSYASI}: HTTP ${y.status}`); return y.arrayBuffer(); })
      .then(glbOku);
    p.catch(() => onbellek.delete(ARAZI_DOSYASI));
    onbellek.set(ARAZI_DOSYASI, p);
  }
  return p;
}

export const uzakAraziModulu: LevelModulu<UzakAraziAyari> = {
  tur: "uzakArazi",
  aciklama: "Blender'da şekillenen uzak arazi (assets/kaynak/ova-arazi.py); renk paletten, hava perspektifli. Zeminden sonra gelmeli.",
  varsayilan: UZAK_ARAZI_VARSAYILAN,
  aralik: {
    esikler: { min: -5, max: 80, adim: 1 }, bantGurultu: { min: 0, max: 30, adim: 0.5 },
    dikEsik: { min: 0, max: 1, adim: 0.01 }, titreme: { min: 0, max: 0.3, adim: 0.01 },
    havaYakin: { min: 0, max: 400, adim: 5 }, havaUzak: { min: 50, max: 800, adim: 5 }, havaGuc: { min: 0, max: 1, adim: 0.01 },
    pus: { min: 0, max: 1, adim: 0.01 }, pusYukseklik: { min: 1, max: 100, adim: 1 }, tohum: { min: 0, max: 9999, adim: 1 },
  },
  kur(b, a) {
    const meshler: ReturnType<typeof meshKur>[] = [];
    const malzeme = b.malzeme("uzakArazi", "isikli", { sis: a.sis });
    let bitti = false;
    bicimYukle().then((nesneler) => {
      if (bitti) return;
      const m = meshKur(b.sahne, "uzakArazi", flatGeometri(araziUcgenleri(nesneler, a, b.renk, b.yukseklik)));
      m.material = malzeme;
      m.freezeWorldMatrix();
      b.golge(m, { atar: a.golgeAtar, alir: true });
      meshler.push(m);
    }).catch((err: unknown) => console.error("[uzakArazi] biçim yüklenemedi:", err));
    return {
      meshler,
      yokEt() { bitti = true; for (const m of meshler) m.dispose(); malzeme.dispose(); },
    };
  },
};
