// world/surfaces/hafizaBulutu.ts — Zihin duvarında HAFIZA görünümü: üç kabuklu kelime bulutu
// (spec 13 Faz 5, Ozyn: "hafıza bölümünün içine girince Orion için böyle görebilelim").
//
// Model: Ozyn'in gösterdiği "Artık benlik imgesi" sayfası — üç kabuk halinde dönen kelimeler,
// ortada bir imleç, imleçten bazı kelimelere uzanan kırmızı iplikler. Orion'da her kelime
// GERÇEK bir kayıttır (spec 05: panel süs eklemiyor):
//   kabuk 0 SABİT — içgüdüler ve kimlik (değişmez)
//   kabuk 1 ANLIK — benlik, çalışma belleği, konuşma penceresi (oturum bitince gider)
//   kabuk 2 DERİN — anılar (kalıcı): önem → boyut, yaş → soluklık
// İmleç = bu tur; kırmızı iplik = bu turda hatırlanan anı.
//
// Saf çekirdek + canvas çizimi; Babylon yok (semaCizim.ts deseni). Kelimeleri kompozisyon
// kökü verir (mind/hafizaGorunumu.ts kurar): burası `mind/`i görmez (K4).
"use strict";
import { RENK, YAZI, zeminDoldur, type YuzeyOlcusu } from "./yuzeyStil.ts";
import type { Bolge } from "./semaCizim.ts";

export interface BulutKelimesi {
  kabuk: 0 | 1 | 2;
  /** Bulutta yazan (kısa). */
  metin: string;
  /** Seçince kutuda yazan: ne olduğu, kaynağı, yaşı. */
  not: string;
  /** 0..1 — yazı boyu (anıda önem). */
  boyut: number;
  /** 0..1 — 1 = tam soluk (anıda yaş). */
  soluk: number;
  /** Bu turda hatırlandı: imleçten kırmızı iplik. */
  kirmizi?: boolean;
  /** "Gerçek" kipte kelimenin yerine yazan sayı (skor, önem). */
  sayi: string;
}

/** Kabuk yarıçapları (birim küre oranı). Sayfadakiyle aynı: 0.36 · 0.66 · 1. */
export const KABUK_YARICAPI = [0.36, 0.66, 1] as const;

export interface Yerlesik { i: number; x: number; y: number; derinlik: number; olcek: number }

/**
 * Kelimeleri kabuklarına Fibonacci küresiyle dizer ve döndürüp ekrana iz düşürür.
 * Belirleyici: aynı kelime listesi ve açı → aynı yerleşim (deneme sayfası ve test için).
 * Dönen liste derinliğe göre sıralıdır (arkadan öne çizilsin).
 */
export function bulutYerlesimi(kelimeler: readonly BulutKelimesi[], yaw: number, pitch: number,
  merkezX: number, merkezY: number, yaricap: number, dikeyYaricap = yaricap): Yerlesik[] {
  const kabukSayisi = [0, 0, 0];
  for (const k of kelimeler) kabukSayisi[k.kabuk]!++;
  const sira = [0, 0, 0];
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const D = 3.2;
  const cikti: Yerlesik[] = kelimeler.map((k, i) => {
    const n = kabukSayisi[k.kabuk]!, j = sira[k.kabuk]!++;
    const yy = 1 - (2 * (j + 0.5)) / n, r = Math.sqrt(Math.max(0, 1 - yy * yy)), faz = j * 2.399963 + k.kabuk * 1.3;
    const R = KABUK_YARICAPI[k.kabuk];
    const x0 = Math.cos(faz) * r * R, y0 = yy * R * 0.92, z0 = Math.sin(faz) * r * R;
    const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
    const y2 = y0 * cp - z1 * sp, z2 = y0 * sp + z1 * cp;
    const p = D / (D - z2);
    return { i, x: merkezX + x1 * yaricap * p, y: merkezY - y2 * dikeyYaricap * p, derinlik: Math.max(0, Math.min(1, (z2 + 1.1) / 2.2)), olcek: p };
  });
  return cikti.sort((a, b) => a.derinlik - b.derinlik);
}

export interface BulutGirdisi {
  kelimeler: readonly BulutKelimesi[];
  /** Seçili kelimenin indeksi (bilgi kutusu). */
  secili: number | null;
  /** "Gerçek" kip: kelimeler sayılarına çözülür. */
  gercek: boolean;
  /** Dönme açısı için (ms). */
  simdi: number;
}

const KABUK_ADI = ["SABİT", "ANLIK", "DERİN"] as const;
const KABUK_RENK = ["#eef1fa", "#ff7aa8", "#9aa5c4"] as const;

/**
 * Bulutu çizer; tıklanabilir bölgeleri döner: alt şeritte [Ayarlar] [Gerçek] düğmeleri ve
 * her kelimenin kutusu (`kelime`, değer = indeks). Üst şerit sema.ts'te "geri"dir.
 */
export function cizHafizaBulutu(bag: CanvasRenderingContext2D, o: YuzeyOlcusu, g: BulutGirdisi): Bolge[] {
  zeminDoldur(bag, o, RENK.ekranZemin);
  const bolgeler: Bolge[] = [];
  const basYuk = Math.round(o.yukseklik * 0.10), altYuk = Math.round(o.yukseklik * 0.09);
  const kenar = Math.round(o.yukseklik * 0.03);

  // Üst şerit: başlık + kabuk sayıları + "geri" ipucu.
  bag.fillStyle = "#0d1220";
  bag.fillRect(0, 0, o.genislik, basYuk);
  bag.textBaseline = "middle";
  bag.textAlign = "left";
  bag.fillStyle = RENK.vurgu;
  bag.font = `600 ${Math.round(basYuk * 0.44)}px ${YAZI.duz}`;
  bag.fillText("‹ HAFIZA · üç kabuk", kenar, basYuk / 2);
  const say = [0, 1, 2].map((k) => `${KABUK_ADI[k]} ${g.kelimeler.filter((w) => w.kabuk === k).length}`).join(" · ");
  bag.textAlign = "right";
  bag.fillStyle = RENK.soluk;
  bag.font = `${Math.round(basYuk * 0.34)}px ${YAZI.tek}`;
  bag.fillText(say, o.genislik - kenar, basYuk / 2);

  // Bulut.
  const alanY = basYuk, alanH = o.yukseklik - basYuk - altYuk;
  const mx = o.genislik / 2, my = alanY + alanH / 2;
  // Elips: panel geniş (16:9) — yalnız yüksekliğe göre boyutlanınca iç kabuk sıkışıyordu
  // (deneme sayfası görüntüsü, ilk sürüm).
  const yaw = (g.simdi / 1000) * 0.12, pitch = -0.18;
  const yer = bulutYerlesimi(g.kelimeler, yaw, pitch, mx, my, o.genislik * 0.40, alanH * 0.40);

  // Kırmızı iplikler: imleçten bu turda hatırlananlara.
  bag.strokeStyle = "#d85b45";
  bag.lineWidth = 1;
  for (const p of yer) {
    if (!g.kelimeler[p.i]!.kirmizi) continue;
    bag.globalAlpha = 0.35 + 0.45 * p.derinlik;
    bag.beginPath(); bag.moveTo(mx, my); bag.lineTo(p.x, p.y); bag.stroke();
  }
  bag.globalAlpha = 1;

  bag.textAlign = "center";
  for (const p of yer) {
    const k = g.kelimeler[p.i]!;
    const puntoTaban = k.kabuk === 0 ? 12 : k.kabuk === 1 ? 12 : 10 + 6 * k.boyut;
    const punto = Math.max(8, Math.round(puntoTaban * p.olcek * (o.yukseklik / 512)));
    bag.font = k.kabuk === 0 ? `italic 300 ${punto}px ${YAZI.duz}` : `${punto}px ${YAZI.tek}`;
    const yazi = g.gercek ? k.sayi : k.metin;
    const alfa = (0.28 + 0.72 * p.derinlik) * (1 - 0.6 * k.soluk);
    bag.globalAlpha = Math.max(0.12, Math.min(1, alfa));
    bag.fillStyle = k.kirmizi ? "#ff6f5a" : KABUK_RENK[k.kabuk];
    bag.fillText(yazi, p.x, p.y);
    if (g.secili === p.i) {
      const w = bag.measureText(yazi).width;
      bag.globalAlpha = 1;
      bag.fillStyle = "#d85b45";
      bag.fillRect(p.x - w / 2, p.y + punto * 0.62, w, Math.max(1, punto * 0.08));
    }
    const w = bag.measureText(yazi).width;
    bolgeler.push({ x: p.x - w / 2, y: p.y - punto / 2, g: w, yuk: punto, ad: "hafiza", islem: "kelime", deger: String(p.i) });
  }
  bag.globalAlpha = 1;

  // İmleç: bu tur.
  const yanip = Math.sin(g.simdi / 1000 * 5.4) > -0.25 ? 1 : 0.15;
  bag.globalAlpha = yanip;
  bag.fillStyle = "#d85b45";
  const ib = Math.round(o.yukseklik * 0.035);
  bag.fillRect(mx - ib * 0.26, my - ib * 0.6, ib * 0.52, ib * 1.2);
  bag.globalAlpha = 1;

  // Seçili kelimenin kutusu.
  if (g.secili !== null && g.kelimeler[g.secili]) {
    const k = g.kelimeler[g.secili]!;
    const kutuG = Math.round(o.genislik * 0.36), satir = Math.round(o.yukseklik * 0.035);
    bag.font = `${satir}px ${YAZI.duz}`;
    const satirlar = sar(bag, `${k.metin} — ${k.not}`, kutuG - kenar * 2).slice(0, 6);
    const kutuH = satirlar.length * satir * 1.35 + kenar * 1.5;
    const kx = o.genislik - kutuG - kenar, ky = alanY + kenar;
    bag.fillStyle = "rgba(10,14,24,0.92)";
    bag.fillRect(kx, ky, kutuG, kutuH);
    bag.strokeStyle = RENK.cerceve;
    bag.strokeRect(kx, ky, kutuG, kutuH);
    bag.textAlign = "left";
    bag.fillStyle = KABUK_RENK[k.kabuk];
    satirlar.forEach((s, i) => bag.fillText(s, kx + kenar, ky + kenar + satir * 0.6 + i * satir * 1.35));
  }

  // Alt şerit: düğmeler.
  const altY = o.yukseklik - altYuk;
  bag.fillStyle = "#090c15";
  bag.fillRect(0, altY, o.genislik, altYuk);
  bag.font = `${Math.round(altYuk * 0.42)}px ${YAZI.duz}`;
  bag.textAlign = "left";
  let x = kenar;
  const dugme = (yazi: string, islem: Bolge["islem"], deger?: string, aktif = false) => {
    const w = bag.measureText(yazi).width + kenar * 1.4;
    bag.fillStyle = aktif ? "#1d2a44" : "#121726";
    bag.fillRect(x, altY + altYuk * 0.15, w, altYuk * 0.7);
    bag.strokeStyle = aktif ? RENK.vurgu : RENK.cerceve;
    bag.strokeRect(x, altY + altYuk * 0.15, w, altYuk * 0.7);
    bag.fillStyle = aktif ? RENK.vurgu : RENK.metin;
    bag.fillText(yazi, x + kenar * 0.7, altY + altYuk / 2);
    bolgeler.push({ x, y: altY, g: w, yuk: altYuk, ad: "hafiza", islem, ...(deger !== undefined ? { deger } : {}) });
    x += w + kenar * 0.6;
  };
  dugme("Ayarlar · Buda", "gorunum", "ayar");
  dugme(g.gercek ? "Gerçek: sayılar" : "Gerçek", "gercek", undefined, g.gercek);
  bag.fillStyle = RENK.soluk;
  bag.fillText("kelimeye tıkla: ne olduğu · kırmızı: bu turda hatırlanan", x + kenar * 0.4, altY + altYuk / 2);
  return bolgeler;
}

/** Basit kelime sarma (ölçülerek). */
function sar(bag: CanvasRenderingContext2D, metin: string, genislik: number): string[] {
  const satirlar: string[] = [];
  let satir = "";
  for (const k of metin.split(/\s+/)) {
    const aday = satir ? `${satir} ${k}` : k;
    if (bag.measureText(aday).width > genislik && satir) { satirlar.push(satir); satir = k; }
    else satir = aday;
  }
  if (satir) satirlar.push(satir);
  return satirlar;
}
