// world/surfaces/sema.ts — Zihin duvarındaki BEYİN ŞEMASI paneli.
//
// Orion'un algıdan eyleme giden yolu, canlı. Hangi durak çalıştı, kaç kez,
// ne kadar sürdü, nerede arıza var — hepsi odada görünür.
//
// Karar ve yerleşim `semaCekirdek.ts`'te (saf, testli). Burası yalnızca boyar.
// Sürekli boyama AÇIK: parıltılar zamanla söndüğü için her kare yeniden
// çizilmeli — bu, yüzey altyapısının `surekliBoyama` kipidir.
//
// Bağımlılık sınırı (K4): @babylonjs/* + kardeş yüzey modülleri.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { yuzeyKur, RENK, YAZI, zeminDoldur, yuvarlakKutu } from "./yuzey.ts";
import type { Yuzey, YuzeyOlcusu } from "./yuzey.ts";
import { DUGUMLER, OKLAR, semaDurumuKur, semaAlani, semaYerlesimi } from "./semaCekirdek.ts";
import type { Dugum, Kutu, SemaAlani, SemaDurumu } from "./semaCekirdek.ts";

export interface SemaAyari {
  sahne: Scene;
  mesh: AbstractMesh;
  genislikM: number;
  yukseklikM: number;
}

export interface SemaPaneli {
  /** Bir durak çalıştı — parıltı yakar, sayacı artırır. */
  vur(ad: string, not?: string): void;
  /** Durum notu (sayacı artırmaz): model adı, kesik süresi, kip. */
  not(ad: string, metin: string): void;
  /** Arıza işaretle/kaldır. */
  ariza(ad: string, arizali: boolean, not?: string): void;
  /** Alt şeritte gösterilecek tek satırlık genel durum. */
  durumYaz(metin: string): void;
  yokEt(): void;
}

/** Lob renkleri: yerel hızlı (yeşilimsi), bulut yavaş (mavi), ortak nötr. */
const LOB_RENK: Record<Dugum["lob"], string> = {
  yerel: "#4fd8a0",
  bulut: RENK.vurgu,
  ortak: "#b9a6ff",
};

export function semaKur(ayar: SemaAyari): SemaPaneli {
  const durum: SemaDurumu = semaDurumuKur();
  let altDurum = "";

  // `an` (performance.now()) KULLANILMAZ: parıltı `Date.now()` tabanlı çünkü
  // durum vuruşları da onunla damgalanıyor. İki saat karıştırılırsa parıltı
  // ya hiç sönmez ya hep sönük çıkar.
  function ciz(bag: CanvasRenderingContext2D, o: YuzeyOlcusu): void {
    const simdi = Date.now();
    zeminDoldur(bag, o, RENK.ekranZemin);

    // Geometri TEK KAYNAKTAN: `semaCekirdek.semaAlani`. Bu oranlar eskiden
    // burada hesaplanıyordu; tıklama testi de aynı sayılara ihtiyaç duyduğu
    // için çekirdeğe taşındı — iki kopya er geç birbirinden kayardı.
    const alan: SemaAlani = semaAlani(o.genislik, o.yukseklik);
    const { kenar, basYuk, altYuk } = alan;

    // ── Başlık ───────────────────────────────────────────────────────────
    bag.fillStyle = "#0d1220";
    bag.fillRect(0, 0, o.genislik, basYuk);
    bag.textBaseline = "middle";
    bag.textAlign = "left";
    bag.fillStyle = RENK.vurgu;
    bag.font = `600 ${Math.round(basYuk * 0.44)}px ${YAZI.duz}`;
    bag.fillText("ORION · ZİHİN AKIŞI", kenar, basYuk / 2);

    // Sağda lob göstergesi — iki katmanlı beynin okunur özeti.
    bag.textAlign = "right";
    bag.font = `${Math.round(basYuk * 0.32)}px ${YAZI.tek}`;
    bag.fillStyle = LOB_RENK.yerel;
    bag.fillText("● yerel", o.genislik - kenar - Math.round(o.genislik * 0.09), basYuk / 2);
    bag.fillStyle = LOB_RENK.bulut;
    bag.fillText("● bulut", o.genislik - kenar, basYuk / 2);

    bag.strokeStyle = RENK.cerceve;
    bag.lineWidth = Math.max(1, Math.round(o.yukseklik * 0.004));
    bag.beginPath();
    bag.moveTo(0, basYuk); bag.lineTo(o.genislik, basYuk); bag.stroke();

    // ── Şema alanı ───────────────────────────────────────────────────────
    const kutular = semaYerlesimi(alan);

    // Oklar ÖNCE: kutuların altında kalsınlar.
    for (const [a, b] of OKLAR) {
      const ka = kutular.get(a), kb = kutular.get(b);
      if (!ka || !kb) continue;
      // Ok canlılığı KAYNAĞIN parıltısı: veri oradan aktı.
      const p = durum.parilti(a, simdi);
      bag.strokeStyle = p > 0 ? karistir(RENK.cerceve, LOB_RENK.ortak, p) : RENK.cerceve;
      bag.lineWidth = Math.max(1, Math.round(o.yukseklik * (0.003 + 0.004 * p)));
      okCiz(bag, ka, kb);
    }

    for (const d of DUGUMLER) {
      const k = kutular.get(d.ad);
      if (!k) continue;
      const s = durum.oku(d.ad);
      const p = durum.parilti(d.ad, simdi);
      const renk = s.arizali ? RENK.kotu : LOB_RENK[d.lob];

      // Gövde: sönük zemin, parıltıyla aydınlanır.
      yuvarlakKutu(bag, k.x, k.y, k.g, k.yuk, Math.min(10, k.yuk * 0.22));
      bag.fillStyle = s.arizali ? "#2a1214" : karistir("#111827", renk, 0.10 + 0.30 * p);
      bag.fill();
      bag.strokeStyle = s.arizali ? RENK.kotu : karistir(RENK.cerceve, renk, 0.35 + 0.65 * p);
      bag.lineWidth = Math.max(1, Math.round(k.yuk * (0.045 + 0.06 * p)));
      bag.stroke();

      // Etiket
      bag.textAlign = "center";
      bag.textBaseline = "middle";
      bag.fillStyle = s.arizali ? RENK.kotu : karistir(RENK.metin, renk, 0.35 + 0.65 * p);
      bag.font = `600 ${Math.round(k.yuk * 0.34)}px ${YAZI.duz}`;
      bag.fillText(d.etiket, k.x + k.g / 2, k.y + k.yuk * 0.38);

      // Sayaç + not — küçük, sönük; şemayı boğmasın.
      const alt = s.not ? `${s.sayac} · ${s.not}` : String(s.sayac);
      bag.fillStyle = s.arizali ? RENK.uyari : RENK.soluk;
      bag.font = `${Math.round(k.yuk * 0.24)}px ${YAZI.tek}`;
      bag.fillText(kirp(bag, alt, k.g * 0.92), k.x + k.g / 2, k.y + k.yuk * 0.72);
    }

    // ── Alt şerit: tek satırlık genel durum ──────────────────────────────
    bag.fillStyle = "#0d1220";
    bag.fillRect(0, o.yukseklik - altYuk, o.genislik, altYuk);
    bag.strokeStyle = RENK.cerceve;
    bag.beginPath();
    bag.moveTo(0, o.yukseklik - altYuk); bag.lineTo(o.genislik, o.yukseklik - altYuk); bag.stroke();
    bag.textAlign = "left";
    bag.fillStyle = RENK.soluk;
    bag.font = `${Math.round(altYuk * 0.40)}px ${YAZI.tek}`;
    bag.fillText(kirp(bag, altDurum || "hazır", o.genislik - kenar * 2),
      kenar, o.yukseklik - altYuk / 2);
  }

  const yuzey: Yuzey = yuzeyKur({
    sahne: ayar.sahne,
    mesh: ayar.mesh,
    genislikM: ayar.genislikM,
    yukseklikM: ayar.yukseklikM,
    dikeyPiksel: 512,
    isik: "ekran",
    ad: "sema",
    ciz,
  });
  // Parıltılar zamanla söner: kirli bayrağı yetmez, her kare çizilmeli.
  yuzey.surekliBoyama(true);

  return {
    vur(ad, not) { durum.vur(ad, not); },
    not(ad, metin) { durum.notYaz(ad, metin); },
    ariza(ad, arizali, not) { durum.ariza(ad, arizali, not); },
    durumYaz(metin) { altDurum = metin.replace(/\s+/g, " ").trim(); },
    yokEt() { yuzey.yokEt(); },
  };
}

// ── Çizim yardımcıları ─────────────────────────────────────────────────────

/** İki kutu arasına ok çizer: kaynağın sağ kenarından hedefin sol kenarına. */
function okCiz(bag: CanvasRenderingContext2D, a: Kutu, b: Kutu): void {
  const ax = a.x + a.g, ay = a.y + a.yuk / 2;
  const bx = b.x, by = b.y + b.yuk / 2;

  bag.beginPath();
  if (Math.abs(ay - by) < 1) {
    bag.moveTo(ax, ay); bag.lineTo(bx, by);
  } else {
    // Dirsekli yol: yatay çık, dikey in, yatay gir. Çapraz çizgiden okunur.
    const orta = ax + (bx - ax) * 0.5;
    bag.moveTo(ax, ay); bag.lineTo(orta, ay); bag.lineTo(orta, by); bag.lineTo(bx, by);
  }
  bag.stroke();

  // Uç: küçük üçgen.
  const u = Math.max(3, a.yuk * 0.14);
  bag.beginPath();
  bag.moveTo(bx, by);
  bag.lineTo(bx - u, by - u * 0.55);
  bag.lineTo(bx - u, by + u * 0.55);
  bag.closePath();
  bag.fillStyle = bag.strokeStyle as string;
  bag.fill();
}

/** `#rrggbb` iki rengi `t` oranında karıştırır. Parıltı geçişleri için. */
function karistir(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const ay = coz(a), by = coz(b);
  const c = (i: number) => Math.round(ay[i]! + (by[i]! - ay[i]!) * k);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}

function coz(renk: string): [number, number, number] {
  const h = renk.replace("#", "");
  const g = h.length === 3
    ? [h[0]! + h[0]!, h[1]! + h[1]!, h[2]! + h[2]!]
    : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  return [parseInt(g[0]!, 16) || 0, parseInt(g[1]!, 16) || 0, parseInt(g[2]!, 16) || 0];
}

/** Genişliğe sığmayan metni `…` ile kısaltır — taşan yazı şemayı bozar. */
function kirp(bag: CanvasRenderingContext2D, metin: string, enFazla: number): string {
  if (bag.measureText(metin).width <= enFazla) return metin;
  let s = metin;
  while (s.length > 1 && bag.measureText(`${s}…`).width > enFazla) s = s.slice(0, -1);
  return `${s}…`;
}
