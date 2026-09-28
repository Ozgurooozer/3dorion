// world/surfaces/semaCizim.ts — ZİHİN AKIŞI panelinin ÇİZİMİ.
//
// `sema.ts` durumu ve tıklamayı tutar; burası yalnızca boyar ve boyadığı
// tıklama bölgelerini döndürür. Ayrılma sebebi: çizim artık Babylon'suz
// (`yuzeyStil.ts`), yani sahnesiz düz bir canvas'ta koşar — tasarım
// `sema-deneme.html` sayfasında gözle ve ekran görüntüsüyle sınanabilir.
// Eskiden panelin nasıl göründüğünü görmek için odayı açıp duvara yürümek
// gerekiyordu.
//
// TASARIM (2026-09-28, Ozyn: "zihin akışı tablosunu düzelt"):
//   - TABLO: sütun başlıkları (GİRİŞ … EYLEM) ve hafif sütun şeritleri.
//     Kutular başıboş durmaz; her biri bir aşamanın altında okunur.
//   - KART: solda lob renginde şerit, sol üstte ad, sağ üstte sayaç (büyük,
//     tek aralıklı), altta not ya da "son çalışma" süresi.
//   - AKIŞ: oklar yuvarlatılmış dik açılı; kaynak yeni çalıştıysa okun
//     üzerinde bir damla hedefe doğru akar. Parıltı tek başına "ne oldu"yu
//     söylüyordu, "nereye gitti"yi söylemiyordu.
//   - BAŞLIK: şu an düşünen model adıyla, lobunun renginde. Lejant ölçülerek
//     yerleşir (eskiden sabit %9 kaydırmayla, uzun yazıda üst üste biniyordu).
//   - Lob RENGİ canlı: DÜŞÜNCE yerel modelde yeşil (`etkinLob`).
//
// Bağımlılık sınırı (K4): kardeş yüzey modülleri + `protocol/` tipleri.
"use strict";
import { RENK, YAZI, zeminDoldur, yuvarlakKutu, type YuzeyOlcusu } from "./yuzeyStil.ts";
import type { Pano, DugmeGoruntu, Sinif, Etki, Teyit } from "../../protocol/pano.ts";
import {
  DUGUMLER, OKLAR, SUTUN_ADLARI, PARILTI_MS, semaAlani, semaYerlesimi, sutunSeritleri,
  dugumTanim, etkinLob,
} from "./semaCekirdek.ts";
import type { Dugum, Kutu, SemaDurumu } from "./semaCekirdek.ts";

/** Lob renkleri: yerel hızlı (yeşilimsi), bulut yavaş (mavi), ortak nötr. */
export const LOB_RENK: Record<Dugum["lob"], string> = {
  yerel: "#4fd8a0",
  bulut: RENK.vurgu,
  ortak: "#b9a6ff",
};

const LOB_YAZI: Record<Dugum["lob"], string> = { yerel: "yerel", bulut: "bulut", ortak: "ortak" };

/** Şeritlerin zemini — ekran zemininden bir ton açık. */
const SERIT = "#0d1220";

export type BolgeIslem = "artir" | "azalt" | "eylem" | "teyitOnay" | "teyitIptal" | "sec";

/** Çizimin bıraktığı tıklama bölgesi. `deger` yalnızca `sec` için. */
export interface Bolge {
  ad: string; islem: BolgeIslem; x: number; y: number; g: number; yuk: number; deger?: string;
}

// ── ŞEMA GÖRÜNÜMÜ ─────────────────────────────────────────────────────────

export interface SemaGirdisi {
  durum: SemaDurumu;
  altDurum: string;
  simdi: number;
}

export function cizSema(bag: CanvasRenderingContext2D, o: YuzeyOlcusu, g: SemaGirdisi): Bolge[] {
  const { durum, simdi } = g;
  zeminDoldur(bag, o, RENK.ekranZemin);
  const alan = semaAlani(o.genislik, o.yukseklik);
  const { kenar, basYuk, altYuk, sutunYuk } = alan;
  const cizgi = Math.max(1, Math.round(o.yukseklik * 0.003));

  // ── Tablo zemini: sütun şeritleri (tek sütunlar hafif açık) ──────────
  const seritler = sutunSeritleri(alan);
  const tabloUst = basYuk;
  const tabloAlt = o.yukseklik - altYuk;
  seritler.forEach((s, i) => {
    if (i % 2 === 1) {
      bag.fillStyle = "#0a0e18";
      bag.fillRect(s.x, tabloUst, s.g, tabloAlt - tabloUst);
    }
  });

  // ── Sütun başlıkları ─────────────────────────────────────────────────
  bag.textAlign = "center";
  bag.textBaseline = "middle";
  bag.font = `600 ${Math.round(sutunYuk * 0.42)}px ${YAZI.tek}`;
  seritler.forEach((s, i) => {
    bag.fillStyle = "#56618a";
    bag.fillText(harfAraligi(SUTUN_ADLARI[i] ?? ""), s.merkez, basYuk + sutunYuk * 0.55);
  });
  bag.strokeStyle = "#161c2c";
  bag.lineWidth = cizgi;
  bag.beginPath();
  bag.moveTo(kenar, basYuk + sutunYuk); bag.lineTo(o.genislik - kenar, basYuk + sutunYuk);
  bag.stroke();

  // ── Başlık şeridi ────────────────────────────────────────────────────
  bag.fillStyle = SERIT;
  bag.fillRect(0, 0, o.genislik, basYuk);
  bag.textBaseline = "middle";
  bag.textAlign = "left";
  bag.fillStyle = RENK.metin;
  bag.font = `600 ${Math.round(basYuk * 0.40)}px ${YAZI.duz}`;
  const baslik = "ZİHİN AKIŞI";
  bag.fillText(baslik, kenar, basYuk / 2);
  let x = kenar + bag.measureText(baslik).width + Math.round(basYuk * 0.35);

  // Şu an düşünen model — başlığın yanında, lob renginde bir hap.
  const beyinDurum = durum.oku("beyin");
  const beyinLob = etkinLob("beyin", beyinDurum);
  const lejantG = lejantGenisligi(bag, basYuk);
  if (beyinDurum.not) {
    const boy = Math.round(basYuk * 0.30);
    bag.font = `600 ${boy}px ${YAZI.tek}`;
    const renk = beyinDurum.arizali ? RENK.kotu : LOB_RENK[beyinLob];
    const enFazla = o.genislik - kenar - lejantG - x - basYuk * 0.6;
    const metin = kirp(bag, `DÜŞÜNCE · ${beyinDurum.not}`, Math.max(40, enFazla - boy));
    const hg = bag.measureText(metin).width + boy * 1.4;
    const hy = Math.round(basYuk * 0.26), hyuk = basYuk - hy * 2;
    yuvarlakKutu(bag, x, hy, hg, hyuk, hyuk / 2);
    bag.fillStyle = karistir(SERIT, renk, 0.14);
    bag.fill();
    bag.strokeStyle = karistir(SERIT, renk, 0.7);
    bag.lineWidth = cizgi;
    bag.stroke();
    bag.fillStyle = renk;
    bag.fillText(metin, x + boy * 0.7, basYuk / 2);
    x += hg;
  }
  lejantCiz(bag, o.genislik - kenar, basYuk);

  bag.strokeStyle = RENK.cerceve;
  bag.lineWidth = cizgi;
  bag.beginPath();
  bag.moveTo(0, basYuk); bag.lineTo(o.genislik, basYuk); bag.stroke();

  // ── Oklar (kutuların altında kalsınlar) ──────────────────────────────
  const kutular = semaYerlesimi(alan);
  for (const [a, b] of OKLAR) {
    const ka = kutular.get(a), kb = kutular.get(b);
    if (!ka || !kb) continue;
    const sa = durum.oku(a);
    const p = durum.parilti(a, simdi);
    const renk = LOB_RENK[etkinLob(a, sa)];
    const yol = okYolu(ka, kb);
    bag.strokeStyle = p > 0 ? karistir(RENK.cerceve, renk, 0.35 + 0.65 * p) : "#26304a";
    bag.lineWidth = Math.max(1, o.yukseklik * (0.0035 + 0.004 * p));
    yolCiz(bag, yol, Math.max(4, ka.yuk * 0.16));
    okUcu(bag, yol, Math.max(4, ka.yuk * 0.13), bag.strokeStyle as string);
    // Akan damla: kaynak az önce çalıştı → veri bu okta, hedefe gidiyor.
    if (p > 0) {
      const n = yolNoktasi(yol, 1 - p);
      bag.beginPath();
      bag.arc(n.x, n.y, Math.max(2, ka.yuk * 0.065), 0, Math.PI * 2);
      bag.fillStyle = renk;
      bag.fill();
    }
  }

  // ── Düğüm kartları ───────────────────────────────────────────────────
  for (const d of DUGUMLER) {
    const k = kutular.get(d.ad);
    if (!k) continue;
    kartCiz(bag, k, d, durum, simdi);
  }

  // ── Alt şerit: genel durum (sol) + toplamlar (sağ) ───────────────────
  bag.fillStyle = SERIT;
  bag.fillRect(0, o.yukseklik - altYuk, o.genislik, altYuk);
  bag.strokeStyle = RENK.cerceve;
  bag.lineWidth = cizgi;
  bag.beginPath();
  bag.moveTo(0, o.yukseklik - altYuk); bag.lineTo(o.genislik, o.yukseklik - altYuk); bag.stroke();
  const altOrta = o.yukseklik - altYuk / 2;
  bag.font = `${Math.round(altYuk * 0.38)}px ${YAZI.tek}`;
  const toplam = `algı ${durum.oku("algi").sayac} · düşünce ${durum.oku("beyin").sayac} · niyet ${durum.oku("niyet").sayac}`;
  bag.textAlign = "right";
  bag.fillStyle = "#56618a";
  bag.fillText(toplam, o.genislik - kenar, altOrta);
  const toplamG = bag.measureText(toplam).width;
  bag.textAlign = "left";
  bag.fillStyle = RENK.soluk;
  bag.fillText(kirp(bag, g.altDurum || "hazır", o.genislik - kenar * 3 - toplamG), kenar, altOrta);
  return [];
}

/** Tek düğüm kartı. */
function kartCiz(
  bag: CanvasRenderingContext2D, k: Kutu, d: Dugum, durum: SemaDurumu, simdi: number,
): void {
  const s = durum.oku(d.ad);
  const p = durum.parilti(d.ad, simdi);
  const lob = etkinLob(d.ad, s);
  const renk = s.arizali ? RENK.kotu : LOB_RENK[lob];
  const r = Math.min(9, k.yuk * 0.16);

  // Gövde: koyu zemin, parıltıyla lob rengine doğru aydınlanır.
  yuvarlakKutu(bag, k.x, k.y, k.g, k.yuk, r);
  bag.fillStyle = s.arizali ? "#2a1214" : karistir("#10151f", renk, 0.06 + 0.26 * p);
  bag.fill();
  bag.strokeStyle = s.arizali ? RENK.kotu : karistir("#232b40", renk, 0.25 + 0.75 * p);
  bag.lineWidth = Math.max(1, k.yuk * (0.028 + 0.05 * p));
  bag.stroke();

  // Sol şerit — lobun kimliği. Kutunun içine kırpılır ki köşe taşmasın.
  bag.save();
  yuvarlakKutu(bag, k.x, k.y, k.g, k.yuk, r);
  bag.clip();
  bag.fillStyle = renk;
  bag.globalAlpha = 0.55 + 0.45 * p;
  bag.fillRect(k.x, k.y, Math.max(3, k.g * 0.035), k.yuk);
  bag.restore();

  const ic = k.g * 0.09;
  const ustY = k.y + k.yuk * 0.34;
  // Ad
  bag.textBaseline = "middle";
  bag.textAlign = "left";
  bag.fillStyle = s.arizali ? RENK.kotu : karistir(RENK.metin, renk, 0.15 + 0.6 * p);
  bag.font = `600 ${Math.round(k.yuk * 0.27)}px ${YAZI.duz}`;
  const adG = bag.measureText(d.etiket).width;
  bag.fillText(d.etiket, k.x + ic, ustY);
  // Sayaç — sağ üstte, tek aralıklı: basamak değişince yazı titremesin.
  bag.textAlign = "right";
  bag.font = `600 ${Math.round(k.yuk * 0.25)}px ${YAZI.tek}`;
  bag.fillStyle = s.arizali ? RENK.kotu : (s.sayac ? karistir(RENK.soluk, renk, 0.5 + 0.5 * p) : "#3a4561");
  const sayac = s.arizali ? "ARIZA" : String(s.sayac);
  if (bag.measureText(sayac).width + adG + ic * 2.4 < k.g) bag.fillText(sayac, k.x + k.g - ic * 0.8, ustY);

  // Alt satır: not varsa not, yoksa "ne zaman". Boş kart ölü görünüyordu.
  const alt = s.not || (s.sonAn ? `son ${suredenBeri(s.sonAn, simdi)}` : "—");
  bag.textAlign = "left";
  bag.fillStyle = s.arizali ? RENK.uyari : RENK.soluk;
  bag.font = `${Math.round(k.yuk * 0.20)}px ${YAZI.tek}`;
  bag.fillText(kirp(bag, alt, k.g - ic * 1.8), k.x + ic, k.y + k.yuk * 0.72);
}

function lejantGenisligi(bag: CanvasRenderingContext2D, basYuk: number): number {
  bag.font = `${Math.round(basYuk * 0.27)}px ${YAZI.tek}`;
  const aralik = basYuk * 0.45;
  return (["yerel", "bulut", "ortak"] as const)
    .reduce((t, l) => t + bag.measureText(`● ${LOB_YAZI[l]}`).width + aralik, -aralik);
}

/** Lejant SAĞDAN sola, ölçülerek: yazı uzasa da üst üste binmez. */
function lejantCiz(bag: CanvasRenderingContext2D, sag: number, basYuk: number): void {
  bag.font = `${Math.round(basYuk * 0.27)}px ${YAZI.tek}`;
  bag.textAlign = "right";
  bag.textBaseline = "middle";
  let x = sag;
  for (const l of ["ortak", "bulut", "yerel"] as const) {
    const m = `● ${LOB_YAZI[l]}`;
    bag.fillStyle = LOB_RENK[l];
    bag.fillText(m, x, basYuk / 2);
    x -= bag.measureText(m).width + basYuk * 0.45;
  }
}

// ── Ok geometrisi: dik açılı yol, yuvarlatılmış köşe, akan damla ──────────

type Nokta = { x: number; y: number };

/**
 * Okun yolu. Üç biçim:
 *   - aynı satır: düz çizgi, sağ kenardan sol kenara
 *   - komşu sütun, farklı satır: aradaki boşlukta dirsek
 *   - ARADA SÜTUN VAR, farklı satır: kaynağın satırında hedefin ortasına
 *     kadar git, sonra hedefe ÜSTTEN/ALTTAN gir. Aradaki boşlukta dirsek
 *     kırmak çizgiyi aradaki sütunun kutusunun içinden geçiriyordu
 *     (REFLEKS → NİYET, DÜŞÜNCE'nin ortasından).
 */
export function okYolu(a: Kutu, b: Kutu): Nokta[] {
  const ax = a.x + a.g, ay = a.y + a.yuk / 2;
  const bx = b.x, by = b.y + b.yuk / 2;
  if (Math.abs(ay - by) < 1) return [{ x: ax, y: ay }, { x: bx, y: by }];
  const bosluk = bx - ax;
  if (bosluk > a.g) {
    const mx = b.x + b.g / 2;
    const giris = ay < by ? b.y : b.y + b.yuk;
    return [{ x: ax, y: ay }, { x: mx, y: ay }, { x: mx, y: giris }];
  }
  const orta = ax + bosluk * 0.5;
  return [{ x: ax, y: ay }, { x: orta, y: ay }, { x: orta, y: by }, { x: bx, y: by }];
}

function yolCiz(bag: CanvasRenderingContext2D, yol: Nokta[], yaricap: number): void {
  bag.beginPath();
  bag.moveTo(yol[0]!.x, yol[0]!.y);
  for (let i = 1; i < yol.length - 1; i++) {
    const o = yol[i - 1]!, n = yol[i]!, s = yol[i + 1]!;
    // Köşe yarıçapı iki kolun kısasının yarısını geçemez; yoksa yay taşar.
    const r = Math.min(yaricap, Math.hypot(n.x - o.x, n.y - o.y) / 2, Math.hypot(s.x - n.x, s.y - n.y) / 2);
    bag.arcTo(n.x, n.y, s.x, s.y, r);
  }
  // Uç üçgenin altında kalsın: çizgi ucun biraz gerisinde biter.
  const son = yol.at(-1)!, once = yol.at(-2)!;
  const l = Math.hypot(son.x - once.x, son.y - once.y) || 1;
  bag.lineTo(son.x - ((son.x - once.x) / l) * 2, son.y - ((son.y - once.y) / l) * 2);
  bag.stroke();
}

/** Ok ucu — son parçanın YÖNÜNDE (yatay ya da dikey giriş). */
function okUcu(bag: CanvasRenderingContext2D, yol: Nokta[], u: number, renk: string): void {
  const b = yol.at(-1)!, a = yol.at(-2)!;
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const dx = (b.x - a.x) / l, dy = (b.y - a.y) / l;
  bag.beginPath();
  bag.moveTo(b.x, b.y);
  bag.lineTo(b.x - dx * u - dy * u * 0.55, b.y - dy * u + dx * u * 0.55);
  bag.lineTo(b.x - dx * u + dy * u * 0.55, b.y - dy * u - dx * u * 0.55);
  bag.closePath();
  bag.fillStyle = renk;
  bag.fill();
}

/** Yol üzerinde `t` (0..1) oranındaki nokta — uzunluğa göre, köşe payı yok. */
export function yolNoktasi(yol: readonly Nokta[], t: number): Nokta {
  const parca: number[] = [];
  let toplam = 0;
  for (let i = 1; i < yol.length; i++) {
    const l = Math.hypot(yol[i]!.x - yol[i - 1]!.x, yol[i]!.y - yol[i - 1]!.y);
    parca.push(l);
    toplam += l;
  }
  let kalan = Math.max(0, Math.min(1, t)) * toplam;
  for (let i = 0; i < parca.length; i++) {
    const l = parca[i]!;
    if (kalan <= l || i === parca.length - 1) {
      const k = l ? Math.min(1, kalan / l) : 0;
      const a = yol[i]!, b = yol[i + 1]!;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    kalan -= l;
  }
  return yol[0]!;
}

// ── TEYİT GÖRÜNÜMÜ ────────────────────────────────────────────────────────

/**
 * İki aşamalı onayın ikinci aşaması. Şema ve detay gibi TAM PANELİ kaplar:
 * küçük bir açılır kutu olsaydı arkasındaki sayılar okunmaya devam eder ve
 * "ne onaylıyorum" sorusu ikinci plana düşerdi.
 */
export function cizTeyit(
  bag: CanvasRenderingContext2D, o: YuzeyOlcusu, t: Teyit, secilenEylemler: ReadonlySet<string>,
): Bolge[] {
  const bolgeler: Bolge[] = [];
  zeminDoldur(bag, o, "#150d10");
  const alan = semaAlani(o.genislik, o.yukseklik);
  const { kenar, basYuk, altYuk } = alan;

  bag.fillStyle = "#24121a";
  bag.fillRect(0, 0, o.genislik, basYuk);
  bag.textBaseline = "middle";
  bag.textAlign = "left";
  bag.fillStyle = RENK.uyari;
  bag.font = `600 ${Math.round(basYuk * 0.40)}px ${YAZI.duz}`;
  bag.fillText("TEYİT GEREKİYOR", kenar, basYuk / 2);
  bag.textAlign = "right";
  bag.font = `${Math.round(basYuk * 0.28)}px ${YAZI.tek}`;
  bag.fillStyle = RENK.soluk;
  bag.fillText(t.dugmeAdi, o.genislik - kenar, basYuk / 2);
  bag.strokeStyle = RENK.kotu;
  bag.lineWidth = Math.max(1, Math.round(o.yukseklik * 0.004));
  bag.beginPath(); bag.moveTo(0, basYuk); bag.lineTo(o.genislik, basYuk); bag.stroke();

  let y = basYuk + Math.round(o.yukseklik * 0.09);
  bag.textAlign = "left";
  bag.fillStyle = RENK.metin;
  bag.font = `600 ${Math.round(o.yukseklik * 0.062)}px ${YAZI.duz}`;
  bag.fillText(kirp(bag, `${t.etiket}:  ${String(t.eski)}  →  ${String(t.yeni)}`, o.genislik - kenar * 2),
    kenar, y);
  y += Math.round(o.yukseklik * 0.085);

  // CANLI uyarı — teyidin asıl içeriği.
  bag.fillStyle = RENK.uyari;
  const ub = Math.round(o.yukseklik * 0.046);
  bag.font = `${ub}px ${YAZI.duz}`;
  for (const satir of satirla(bag, t.uyari, o.genislik - kenar * 2)) {
    bag.fillText(satir, kenar, y);
    y += Math.round(ub * 1.35);
  }
  y += Math.round(o.yukseklik * 0.035);

  // Bağlı eylemler — ayrı seçim. Ayarın yan etkisi DEĞİLLER.
  if (t.eylemler.length) {
    bag.fillStyle = RENK.soluk;
    bag.font = `${Math.round(o.yukseklik * 0.034)}px ${YAZI.tek}`;
    bag.fillText("BİRLİKTE ÇALIŞTIR (isteğe bağlı)", kenar, y);
    y += Math.round(o.yukseklik * 0.048);
    for (const e of t.eylemler) {
      const secili = secilenEylemler.has(e.ad);
      const kb = Math.round(o.yukseklik * 0.040);
      yuvarlakKutu(bag, kenar, y - kb / 2, kb, kb, kb * 0.25);
      bag.strokeStyle = secili ? RENK.iyi : RENK.cerceve;
      bag.lineWidth = Math.max(1, Math.round(kb * 0.10));
      bag.stroke();
      if (secili) { bag.fillStyle = RENK.iyi; bag.fill(); }
      bolgeler.push({ ad: e.ad, islem: "eylem", x: kenar, y: y - kb / 2, g: kb, yuk: kb });
      bag.fillStyle = secili ? RENK.metin : RENK.soluk;
      bag.font = `${Math.round(o.yukseklik * 0.040)}px ${YAZI.duz}`;
      bag.fillText(kirp(bag, `${e.etiket} — ${e.aciklama}`, o.genislik - kenar * 2 - kb * 2),
        kenar + kb * 1.5, y);
      y += Math.round(o.yukseklik * 0.058);
    }
  }

  // ONAYLA / VAZGEÇ
  const dy = Math.round(o.yukseklik * 0.085);
  const dgG = Math.round(o.genislik * 0.20);
  const dugY = o.yukseklik - altYuk - dy - Math.round(o.yukseklik * 0.035);
  for (const [i, [etiket, islem, renk]] of
       ([["ONAYLA", "teyitOnay", RENK.kotu], ["VAZGEÇ", "teyitIptal", RENK.cerceve]] as const).entries()) {
    const bx = kenar + i * (dgG + Math.round(o.genislik * 0.02));
    yuvarlakKutu(bag, bx, dugY, dgG, dy, dy * 0.22);
    bag.strokeStyle = renk;
    bag.lineWidth = Math.max(1, Math.round(dy * 0.07));
    bag.stroke();
    bag.fillStyle = renk === RENK.cerceve ? RENK.soluk : renk;
    bag.font = `600 ${Math.round(dy * 0.42)}px ${YAZI.duz}`;
    bag.textAlign = "center";
    bag.fillText(etiket, bx + dgG / 2, dugY + dy / 2);
    bag.textAlign = "left";
    bolgeler.push({ ad: "", islem, x: bx, y: dugY, g: dgG, yuk: dy });
  }

  bag.fillStyle = "#24121a";
  bag.fillRect(0, o.yukseklik - altYuk, o.genislik, altYuk);
  bag.fillStyle = RENK.soluk;
  bag.font = `${Math.round(altYuk * 0.38)}px ${YAZI.tek}`;
  bag.fillText("Esc · vazgeç", kenar, o.yukseklik - altYuk / 2);
  return bolgeler;
}

// ── DETAY GÖRÜNÜMÜ ────────────────────────────────────────────────────────

export interface DetayGirdisi {
  durum: SemaDurumu;
  pano: Pano | null;
  simdi: number;
  /** Son yazma denemesinin sonucu; 4 sn görünür. */
  sonYazma: string;
  sonYazmaAn: number;
}

/** Seçenek hapları en çok kaç satır tutar; taşarsa "+N" yazılır. */
const SECENEK_SATIR = 2;

/**
 * Tek düğüm: ne yapar, sayıları, komşuları ve bağlı teller.
 *
 * Metin seçenekli düğmeler (beyin seçimi) artık −/+ ile TEK TEK DÖNMEZ:
 * seçenekler hap olarak dizilir, dokunulan seçilir (teyit ekranı yine açılır).
 * Eskiden 8 yerel modelde istediğine ulaşmak 7 teyit ekranı demekti.
 */
export function cizDetay(
  bag: CanvasRenderingContext2D, o: YuzeyOlcusu, ad: string, g: DetayGirdisi,
): Bolge[] {
  const { durum, pano, simdi } = g;
  const bolgeler: Bolge[] = [];
  zeminDoldur(bag, o, RENK.ekranZemin);

  const alan = semaAlani(o.genislik, o.yukseklik);
  const { kenar, basYuk, altYuk } = alan;
  const tanim = dugumTanim(ad);
  const s = durum.oku(ad);
  const lob = etkinLob(ad, s);
  const renk = s.arizali ? RENK.kotu : (tanim ? LOB_RENK[lob] : RENK.soluk);

  // ── Başlık = GERİ düğmesi ────────────────────────────────────────────
  bag.fillStyle = SERIT;
  bag.fillRect(0, 0, o.genislik, basYuk);
  bag.textBaseline = "middle";
  bag.textAlign = "left";
  bag.font = `600 ${Math.round(basYuk * 0.40)}px ${YAZI.duz}`;
  bag.fillStyle = RENK.soluk;
  const geri = "◀ ZİHİN AKIŞI · ";
  bag.fillText(geri, kenar, basYuk / 2);
  const genG = bag.measureText(geri).width;
  bag.fillStyle = renk;
  bag.fillText(tanim ? tanim.etiket : ad, kenar + genG, basYuk / 2);

  const yazilabilirSayi = pano
    ? pano.goruntu(ad).flatMap((m) => m.dugmeler).filter((d) => d.yazilabilir).length
    : 0;
  bag.textAlign = "right";
  bag.font = `${Math.round(basYuk * 0.28)}px ${YAZI.tek}`;
  bag.fillStyle = yazilabilirSayi ? RENK.iyi : RENK.soluk;
  bag.fillText(yazilabilirSayi ? `${yazilabilirSayi} AYARLANABİLİR` : "SALT OKUNUR",
    o.genislik - kenar, basYuk / 2);
  bag.strokeStyle = RENK.cerceve;
  bag.lineWidth = Math.max(1, Math.round(o.yukseklik * 0.004));
  bag.beginPath(); bag.moveTo(0, basYuk); bag.lineTo(o.genislik, basYuk); bag.stroke();

  // ── Gövde ────────────────────────────────────────────────────────────
  let y = basYuk + Math.round(o.yukseklik * 0.06);
  bag.textAlign = "left";
  bag.fillStyle = RENK.metin;
  const cumleBoy = Math.round(o.yukseklik * 0.042);
  bag.font = `${cumleBoy}px ${YAZI.duz}`;
  for (const satir of satirla(bag, tanim?.aciklama ?? "(tanım yok)", o.genislik - kenar * 2)) {
    bag.fillText(satir, kenar, y);
    y += Math.round(cumleBoy * 1.35);
  }

  // Sayılar — kutucuklar hâlinde, panelin asıl işi.
  y += Math.round(o.yukseklik * 0.02);
  const olculer: readonly (readonly [string, string])[] = [
    ["ÇALIŞMA", String(s.sayac)],
    ["SON", suredenBeri(s.sonAn, simdi)],
    ["DURUM", s.arizali ? "ARIZALI" : (s.sayac ? "çalışıyor" : "hiç çalışmadı")],
    ["LOB", tanim ? LOB_YAZI[lob] : "—"],
  ];
  const bosluk = Math.round(o.genislik * 0.012);
  const hucreG = (o.genislik - kenar * 2 - bosluk * (olculer.length - 1)) / olculer.length;
  const hucreY = Math.round(o.yukseklik * 0.095);
  olculer.forEach(([bas, deg], i) => {
    const hx = kenar + i * (hucreG + bosluk);
    yuvarlakKutu(bag, hx, y, hucreG, hucreY, 7);
    bag.fillStyle = "#0e1320";
    bag.fill();
    bag.strokeStyle = "#1d2436";
    bag.lineWidth = 1;
    bag.stroke();
    bag.fillStyle = RENK.soluk;
    bag.font = `${Math.round(hucreY * 0.24)}px ${YAZI.tek}`;
    bag.fillText(bas, hx + hucreG * 0.07, y + hucreY * 0.30);
    bag.fillStyle = bas === "DURUM" && s.arizali ? RENK.kotu : renk;
    bag.font = `600 ${Math.round(hucreY * 0.36)}px ${YAZI.duz}`;
    bag.fillText(kirp(bag, deg, hucreG * 0.86), hx + hucreG * 0.07, y + hucreY * 0.68);
  });
  y += hucreY + Math.round(o.yukseklik * 0.032);

  // Not + komşuluk tek satırda: panel duvardan okunuyor, satır pahalı.
  const girdi = OKLAR.filter(([, b]) => b === ad).map(([a]) => etiketAl(a));
  const cikti = OKLAR.filter(([a]) => a === ad).map(([, b]) => etiketAl(b));
  bag.font = `${Math.round(o.yukseklik * 0.034)}px ${YAZI.tek}`;
  bag.fillStyle = RENK.soluk;
  const komsu = `← ${girdi.join(" · ") || "—"}    → ${cikti.join(" · ") || "—"}`;
  bag.fillText(kirp(bag, s.not ? `${s.not}    ${komsu}` : komsu, o.genislik - kenar * 2), kenar, y);
  y += Math.round(o.yukseklik * 0.025);

  // ── DEVRE PANOSU: bu durağa bağlı teller ─────────────────────────────
  //
  // Sabit teller GİZLENMEZ, çizilir: saklamak operatöre "panel her şeydir"
  // yalanını öğretir ve görünmeyen bir güvenlik teli savunulamaz hale gelir.
  const satirlar = pano ? pano.goruntu(ad).flatMap((m) => m.dugmeler) : [];
  if (!pano || !satirlar.length) {
    bag.fillStyle = RENK.soluk;
    bag.font = `${Math.round(o.yukseklik * 0.036)}px ${YAZI.tek}`;
    bag.fillText(pano ? "bu durağa bağlı ayar yok" : "pano takılı değil", kenar, y + 10);
  } else {
    // Seçenekli düğme (varsa ilki) haplarla gösterilir; yerini ayır.
    const secenekli = satirlar.find((d) => secenekliMi(d));
    const hapY = Math.round(o.yukseklik * 0.056);
    const hapAlani = secenekli ? hapY * SECENEK_SATIR + Math.round(hapY * 0.72) + Math.round(o.yukseklik * 0.012) : 0;
    const kalan = o.yukseklik - altYuk - y - hapAlani - Math.round(o.yukseklik * 0.02);
    const satirY = Math.max(
      Math.round(o.yukseklik * 0.046),
      Math.min(Math.round(o.yukseklik * 0.066), Math.floor(kalan / satirlar.length)));
    for (const d of satirlar) {
      satirCiz(bag, o, kenar, y, satirY, d, bolgeler);
      y += satirY;
    }
    if (secenekli) {
      y += Math.round(o.yukseklik * 0.012);
      y = seceneklerCiz(bag, o, kenar, y, hapY, secenekli, bolgeler);
    }
  }

  // ── Alt şerit ────────────────────────────────────────────────────────
  bag.fillStyle = SERIT;
  bag.fillRect(0, o.yukseklik - altYuk, o.genislik, altYuk);
  bag.strokeStyle = RENK.cerceve;
  bag.lineWidth = 1;
  bag.beginPath();
  bag.moveTo(0, o.yukseklik - altYuk); bag.lineTo(o.genislik, o.yukseklik - altYuk); bag.stroke();
  const altOrta = o.yukseklik - altYuk / 2;
  bag.font = `${Math.round(altYuk * 0.38)}px ${YAZI.tek}`;
  bag.textAlign = "left";
  // Son yazma sonucu 4 sn görünür; kalıcı olsaydı eski bir ret yeni denemede
  // hâlâ ekranda durur ve yanlış okunurdu.
  const taze = g.sonYazma && simdi - g.sonYazmaAn < 4000;
  bag.fillStyle = taze ? (g.sonYazma.startsWith("reddedildi") ? RENK.kotu : RENK.iyi) : RENK.soluk;
  bag.fillText(kirp(bag, taze ? g.sonYazma : "Esc veya üst şerit · geri",
    Math.round(o.genislik * 0.52)), kenar, altOrta);
  // ÖLÇÜM DIŞI şeridi: kilit bir kez açıldıysa bu oturum boyunca görünür.
  if (pano?.olcumDisi()) {
    bag.fillStyle = RENK.kotu;
    bag.font = `600 ${Math.round(altYuk * 0.38)}px ${YAZI.tek}`;
    bag.textAlign = "center";
    bag.fillText(kirp(bag, `ÖLÇÜM DIŞI — ${pano.kilitGerekcesi()}`, o.genislik * 0.40),
      o.genislik * 0.62, altOrta);
    bag.font = `${Math.round(altYuk * 0.38)}px ${YAZI.tek}`;
  }
  if (pano) {
    const sabitSayi = satirlar.filter((d) => d.sinif === "sabit").length;
    const acikSayi = satirlar.filter((d) => d.yazilabilir).length;
    bag.textAlign = "right";
    bag.fillStyle = RENK.soluk;
    bag.fillText(`${satirlar.length} tel · ${sabitSayi} sabit · ${acikSayi} açık`,
      o.genislik - kenar, altOrta);
  }
  bag.textAlign = "left";
  return bolgeler;
}

/** Metin seçenekli ve değiştirilebilir (doğrudan ya da teyitle) düğme mi. */
function secenekliMi(d: DugmeGoruntu): boolean {
  return typeof d.deger === "string" && d.secenekler.length > 1
    && (d.yazilabilir || d.kilitSebebi.includes("teyit"));
}

/** Bir tel satırı: ad · sınıf rozeti · değer · (−/+) · etki. */
function satirCiz(
  bag: CanvasRenderingContext2D, o: YuzeyOlcusu, kenar: number, y: number, satirY: number,
  d: DugmeGoruntu, bolgeler: Bolge[],
): void {
  const merkez = y + satirY / 2;
  const yaziBoy = Math.round(satirY * 0.52);
  const rozetX = kenar + Math.round(o.genislik * 0.28);
  const degerX = kenar + Math.round(o.genislik * 0.43);
  const etkiX = o.genislik - kenar;
  bag.textAlign = "left";
  bag.textBaseline = "middle";

  // Zebra: satırlar tablo gibi okunsun.
  bag.fillStyle = "#0b0f19";
  bag.fillRect(kenar - 6, y + 1, o.genislik - kenar * 2 + 12, satirY - 2);

  bag.fillStyle = d.sinif === "sabit" ? RENK.soluk : RENK.metin;
  bag.font = `${yaziBoy}px ${YAZI.duz}`;
  bag.fillText(kirp(bag, d.etiket, rozetX - kenar - 6), kenar, merkez);

  rozetCiz(bag, rozetX, merkez, Math.round(yaziBoy * 0.80), d.sinif);

  bag.fillStyle = d.hata ? RENK.kotu : (d.sinif === "sabit" ? RENK.soluk : RENK.metin);
  bag.font = `600 ${yaziBoy}px ${YAZI.tek}`;
  const metin = d.hata ? "okunamadı" : `${degerYaz(d.deger)}${d.birim ? " " + d.birim : ""}`;
  bag.fillText(kirp(bag, metin, etkiX - degerX - Math.round(o.genislik * 0.14)), degerX, merkez);

  bag.textAlign = "right";
  bag.fillStyle = "#6a769a";
  bag.font = `${Math.round(yaziBoy * 0.86)}px ${YAZI.tek}`;
  bag.fillText(ETKI_YAZI[d.etki], etkiX, merkez);
  bag.textAlign = "left";

  // −/+ yalnızca SAYISAL ayarlanır düğmede. Metin seçenekliler haplarla
  // seçilir (aşağıda); iki ayrı yol aynı değeri değiştirmesin.
  const teyitli = d.kilitSebebi.includes("teyit");
  if ((d.yazilabilir || teyitli) && typeof d.deger === "number" && d.adim > 0) {
    const dg = Math.round(satirY * 0.92);
    const artiX = etkiX - Math.round(o.genislik * 0.12) - dg;
    const eksiX = artiX - dg - Math.round(satirY * 0.2);
    for (const [bx, isaret, islem] of [[eksiX, "−", "azalt"], [artiX, "+", "artir"]] as const) {
      yuvarlakKutu(bag, bx, merkez - dg / 2, dg, dg, dg * 0.26);
      bag.fillStyle = "#121827";
      bag.fill();
      bag.strokeStyle = "#34405e";
      bag.lineWidth = Math.max(1, Math.round(dg * 0.06));
      bag.stroke();
      bag.fillStyle = RENK.metin;
      bag.font = `600 ${Math.round(dg * 0.62)}px ${YAZI.duz}`;
      bag.textAlign = "center";
      bag.fillText(isaret, bx + dg / 2, merkez);
      bag.textAlign = "left";
      bolgeler.push({ ad: d.ad, islem, x: bx, y: merkez - dg / 2, g: dg, yuk: dg });
    }
  }
}

/** Seçenek hapları: seçili olan dolu, diğerleri çerçeveli. Dönüş: yeni y. */
function seceneklerCiz(
  bag: CanvasRenderingContext2D, o: YuzeyOlcusu, kenar: number, y: number, hapY: number,
  d: DugmeGoruntu, bolgeler: Bolge[],
): number {
  bag.textBaseline = "middle";
  bag.textAlign = "left";
  bag.fillStyle = RENK.soluk;
  bag.font = `${Math.round(o.yukseklik * 0.030)}px ${YAZI.tek}`;
  bag.fillText(`${d.etiket.toLocaleUpperCase("tr")} · dokun, seç`, kenar, y + hapY * 0.3);
  y += Math.round(hapY * 0.72);

  const boy = Math.round(hapY * 0.40);
  bag.font = `${boy}px ${YAZI.tek}`;
  const ara = Math.round(hapY * 0.18);
  const sag = o.genislik - kenar;
  const enGenis = (o.genislik - kenar * 2) * 0.46;
  let x = kenar, satir = 0;
  const hy = hapY - ara;
  for (let i = 0; i < d.secenekler.length; i++) {
    const s = d.secenekler[i]!;
    const metin = kirp(bag, s, enGenis);
    const hg = bag.measureText(metin).width + boy * 1.6;
    if (x + hg > sag && x > kenar) { x = kenar; satir++; }
    if (satir >= SECENEK_SATIR) {
      // Taşan seçenekler: sayı + nereden görüleceği. Sessizce kesmek,
      // "listede yok" yanılgısı doğururdu.
      bag.fillStyle = RENK.soluk;
      bag.fillText(`+${d.secenekler.length - i} · tümü için odada M`, kenar, y + (SECENEK_SATIR - 1) * hapY + hy / 2);
      break;
    }
    const yy = y + satir * hapY;
    const secili = s === d.deger;
    const yerel = s.startsWith("yerel:");
    const renk = yerel ? LOB_RENK.yerel : LOB_RENK.bulut;
    yuvarlakKutu(bag, x, yy, hg, hy, hy / 2);
    bag.fillStyle = secili ? karistir(RENK.ekranZemin, renk, 0.28) : "#0e1320";
    bag.fill();
    bag.strokeStyle = secili ? renk : "#2a3450";
    bag.lineWidth = secili ? 2 : 1;
    bag.stroke();
    bag.fillStyle = secili ? "#f2f5ff" : RENK.metin;
    bag.fillText(metin, x + boy * 0.8, yy + hy / 2);
    bolgeler.push({ ad: d.ad, islem: "sec", x, y: yy, g: hg, yuk: hy, deger: s });
    x += hg + ara;
  }
  return y + (satir + 1) * hapY;
}

// ── Küçük yardımcılar ─────────────────────────────────────────────────────

/** `#rrggbb` iki rengi `t` oranında karıştırır. Parıltı geçişleri için. */
export function karistir(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const ay = coz(a), by = coz(b);
  const c = (i: number) => Math.round(ay[i]! + (by[i]! - ay[i]!) * k);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}

function coz(renk: string): [number, number, number] {
  const r = renk.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (r) return [Number(r[1]), Number(r[2]), Number(r[3])];
  const h = renk.replace("#", "");
  const g = h.length === 3
    ? [h[0]! + h[0]!, h[1]! + h[1]!, h[2]! + h[2]!]
    : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  return [parseInt(g[0]!, 16) || 0, parseInt(g[1]!, 16) || 0, parseInt(g[2]!, 16) || 0];
}

/** Sütun başlıkları seyrek harfli: küçük puntoda duvardan okunsun. */
function harfAraligi(s: string): string {
  return [...s].join(" ");
}

/** Genişliğe sığmayan metni `…` ile kısaltır — taşan yazı şemayı bozar. */
function kirp(bag: CanvasRenderingContext2D, metin: string, enFazla: number): string {
  if (bag.measureText(metin).width <= enFazla) return metin;
  let s = metin;
  while (s.length > 1 && bag.measureText(`${s}…`).width > enFazla) s = s.slice(0, -1);
  return `${s}…`;
}

/** Metni genişliğe göre satırlara böler — taşan cümle paneli bozar. */
function satirla(bag: CanvasRenderingContext2D, metin: string, enFazla: number): string[] {
  const kelimeler = metin.split(/\s+/).filter(Boolean);
  if (!kelimeler.length) return [""];
  const satirlar: string[] = [];
  let simdiki = kelimeler[0]!;
  for (const k of kelimeler.slice(1)) {
    const aday = `${simdiki} ${k}`;
    if (bag.measureText(aday).width <= enFazla) simdiki = aday;
    else { satirlar.push(simdiki); simdiki = k; }
  }
  satirlar.push(simdiki);
  return satirlar;
}

/**
 * "ne kadar önce" — insan ölçeğinde. Ham epoch damgası gösterilmiyor:
 * duvardaki panelden 13 haneli sayı okumak bilgi değil gürültüdür.
 */
export function suredenBeri(an: number, simdi: number): string {
  if (!an) return "hiç";
  const gecen = Math.max(0, simdi - an);
  if (gecen < 1000) return "şimdi";
  if (gecen < 60_000) return `${(gecen / 1000).toFixed(1)} sn`;
  if (gecen < 3_600_000) return `${Math.round(gecen / 60_000)} dk`;
  return `${Math.round(gecen / 3_600_000)} sa`;
}

function etiketAl(ad: string): string {
  return dugumTanim(ad)?.etiket ?? ad;
}

const ETKI_YAZI: Record<Etki, string> = {
  aninda: "anında",
  sonraki_tur: "sonraki tur",
  yeniden_kurulum: "yeniden kurulum",
};

/** Sınıf rozetinin rengi ve harfi. Tehlike EKSENİ, etki ekseninden ayrı. */
const ROZET: Record<Sinif, { yazi: string; renk: string }> = {
  sabit:      { yazi: "SABİT",  renk: "#3a4561" },
  olculmus:   { yazi: "ÖLÇÜM",  renk: RENK.uyari },
  guvenli:    { yazi: "AYAR",   renk: RENK.iyi },
  tehlikeli:  { yazi: "RİSK",   renk: RENK.kotu },
};

/** Çerçeveli, dolgusuz: dolgu satırı ağırlaştırıp gözü değerden çalıyordu. */
function rozetCiz(
  bag: CanvasRenderingContext2D, x: number, merkez: number, boy: number, sinif: Sinif,
): void {
  const r = ROZET[sinif];
  bag.font = `600 ${boy}px ${YAZI.tek}`;
  const g = bag.measureText(r.yazi).width + boy * 0.9;
  const yuk = boy * 1.7;
  yuvarlakKutu(bag, x, merkez - yuk / 2, g, yuk, yuk * 0.28);
  bag.strokeStyle = r.renk;
  bag.lineWidth = Math.max(1, Math.round(boy * 0.09));
  bag.stroke();
  bag.fillStyle = r.renk;
  bag.textAlign = "center";
  bag.fillText(r.yazi, x + g / 2, merkez);
  bag.textAlign = "left";
}

function degerYaz(d: DugmeGoruntu["deger"]): string {
  if (d === null) return "—";
  if (typeof d === "boolean") return d ? "evet" : "hayır";
  return String(d);
}

/** Parıltı sabitini dışa ver: deneme sayfası vuruşları buna göre zamanlar. */
export { PARILTI_MS };
