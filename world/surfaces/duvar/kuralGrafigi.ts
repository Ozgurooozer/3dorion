// world/surfaces/duvar/kuralGrafigi.ts — Zihin duvarında HAFIZA KURALLARI görünümü: bloklar + oklar (Markov hafıza, aşama 2).
//
// Salt okunur. Hafızaya NE yazıldığını söyleyen sıralı kural tablosu (`mind/hafizaKurallari.ts`) burada bloklar halinde görünür:
//   algı → ELE → İÇERİK → ÖNEM → hafızaya yaz     (üst sıra; ok = `sonra`)
//   her grubun altında kuralları (ince omurga = `içerir`); "at" kuralları kırmızı kenarlı, oklarla "reddet" kutusuna gider.
// Çizim AYRI bir kopya değil: düğüm ve kenar listesi `grafik()`ten gelir (kompozisyon kökü bağlar, K4: world mind'i import etmez);
// yerleşim bu listeden TÜRER, tabloya kural eklenince kutu da eklenir. Yerleşim saf ve testli; canvas yalnız `cizKuralGrafigi`de.
"use strict";
import { RENK, YAZI, zeminDoldur, type YuzeyOlcusu } from "../yuzeyStil.ts";
import type { Bolge } from "./semaCizim.ts";

// Tipler mind/hafizaKurallari.ts'tekiyle YAPISAL olarak aynı (world mind'i import etmez).
export interface KuralDugumu {
  id: string; tur: "giris" | "grup" | "kural" | "cikis"; etiket: string;
  aciklama?: string; kosul?: string; sonuc?: string; grup?: string; kisa?: string;
  degiskenler?: { ad: string; deger: number }[];
}
export interface KuralKenari { kimden: string; kime: string; tur: "sonra" | "icerir" | "at" }
export interface KuralGrafigiVerisi { dugumler: readonly KuralDugumu[]; kenarlar: readonly KuralKenari[] }

export interface Alan { x: number; y: number; g: number; yuk: number }
export interface Kutu { id: string; x: number; y: number; g: number; yuk: number }
export interface Nokta { x: number; y: number }
export interface Ok { kimden: string; kime: string; tur: KuralKenari["tur"]; noktalar: Nokta[] }
export interface Yerlesim { kutular: Kutu[]; oklar: Ok[] }

/** `sonra` kenarlarını giriş düğümünden izleyerek sütun sırasını çıkarır (giriş, gruplar…, yaz). */
function sutunSirasi(g: KuralGrafigiVerisi): string[] {
  const sonraki = new Map(g.kenarlar.filter((e) => e.tur === "sonra").map((e) => [e.kimden, e.kime]));
  const sira: string[] = [];
  let simdiki: string | undefined = "giris";
  while (simdiki !== undefined && !sira.includes(simdiki)) { sira.push(simdiki); simdiki = sonraki.get(simdiki); }
  return sira;
}

/**
 * Saf yerleşim: kutular ve ok çizgileri. Sütun = `sonra` zinciri; grubun kuralları sütunda alt alta (en çok kuralı olan grup
 * satır yüksekliğini belirler); "reddet" kutusu ilk sütunda, at kurallarının dikey ortasında.
 */
export function kuralYerlesimi(g: KuralGrafigiVerisi, alan: Alan): Yerlesim {
  const sutunlar = sutunSirasi(g);
  const n = Math.max(1, sutunlar.length);
  const sutunG = alan.g / n, kutuG = sutunG * 0.84;
  const kuralSayisi = (grupId: string) => g.kenarlar.filter((e) => e.kimden === grupId && e.tur === "icerir").length;
  const enCok = Math.max(1, ...sutunlar.map(kuralSayisi));
  const baslikY = Math.min(alan.yuk * 0.12, 46), bosluk = Math.max(4, alan.yuk * 0.025);
  const satirY = (alan.yuk - baslikY - bosluk) / enCok, kuralY = satirY * 0.84;
  const girinti = Math.min(14, kutuG * 0.08);

  const kutular = new Map<string, Kutu>();
  const kutuEkle = (id: string, x: number, y: number, gg: number, yuk: number) => { kutular.set(id, { id, x, y, g: gg, yuk }); };

  sutunlar.forEach((id, s) => {
    const x = alan.x + s * sutunG + (sutunG - kutuG) / 2;
    kutuEkle(id, x, alan.y, kutuG, baslikY);
    g.kenarlar.filter((e) => e.kimden === id && e.tur === "icerir").forEach((e, i) => {
      kutuEkle(e.kime, x + girinti, alan.y + baslikY + bosluk + i * satirY, kutuG - girinti, kuralY);
    });
  });

  // "Reddet": ilk sütun, at kurallarının dikey ortası.
  const atlar = g.kenarlar.filter((e) => e.tur === "at");
  const reddet = atlar[0]?.kime;
  if (reddet) {
    const ortalar = atlar.map((e) => { const k = kutular.get(e.kimden)!; return k.y + k.yuk / 2; });
    const orta = ortalar.reduce((a, b) => a + b, 0) / ortalar.length;
    const yuk = Math.min(baslikY * 1.3, kuralY * 1.2);
    kutuEkle(reddet, alan.x + (sutunG - kutuG) / 2, orta - yuk / 2, kutuG, yuk);
  }

  const oklar: Ok[] = g.kenarlar.map((e) => {
    const a = kutular.get(e.kimden)!, b = kutular.get(e.kime)!;
    if (e.tur === "sonra") {
      const y = a.y + a.yuk / 2;
      return { ...e, noktalar: [{ x: a.x + a.g, y }, { x: b.x, y }] };
    }
    if (e.tur === "icerir") {
      const omurga = a.x + Math.min(6, girinti / 2), y = b.y + b.yuk / 2;
      return { ...e, noktalar: [{ x: omurga, y: a.y + a.yuk }, { x: omurga, y }, { x: b.x, y }] };
    }
    const y = a.y + a.yuk / 2, ry = b.y + b.yuk / 2;
    return { ...e, noktalar: [{ x: a.x, y }, { x: b.x + b.g, y: ry }] };
  });
  return { kutular: [...kutular.values()], oklar };
}

/** Ölçülmüş genişliğe sığacak şekilde kısaltır; kısaltıldığı "…" ile belli. */
export function kisalt(bag: Pick<CanvasRenderingContext2D, "measureText">, metin: string, enGenislik: number): string {
  if (bag.measureText(metin).width <= enGenislik) return metin;
  let k = metin;
  while (k.length > 1 && bag.measureText(`${k}…`).width > enGenislik) k = k.slice(0, -1);
  return `${k}…`;
}

export interface KuralGirdisi {
  grafik: KuralGrafigiVerisi;
  /** Seçili kuralın kimliği. */
  secili: string | null;
}

/** Çizer; tıklanabilir bölgeleri döner: her kural kutusu (`kural`, değer = kimlik) ve `‹ Bulut`. */
export function cizKuralGrafigi(bag: CanvasRenderingContext2D, o: YuzeyOlcusu, g: KuralGirdisi): Bolge[] {
  zeminDoldur(bag, o, RENK.ekranZemin);
  const bolgeler: Bolge[] = [];
  const basYuk = Math.round(o.yukseklik * 0.10), altYuk = Math.round(o.yukseklik * 0.12), kenar = Math.round(o.yukseklik * 0.03);
  const kuralSayisi = g.grafik.dugumler.filter((d) => d.tur === "kural").length;
  const grupSayisi = g.grafik.dugumler.filter((d) => d.tur === "grup").length;

  bag.fillStyle = "#0d1220";
  bag.fillRect(0, 0, o.genislik, basYuk);
  bag.textBaseline = "middle";
  bag.textAlign = "left";
  bag.fillStyle = RENK.vurgu;
  bag.font = `600 ${Math.round(basYuk * 0.44)}px ${YAZI.duz}`;
  bag.fillText("‹ HAFIZA · kurallar", kenar, basYuk / 2);
  bag.textAlign = "right";
  bag.fillStyle = RENK.soluk;
  bag.font = `${Math.round(basYuk * 0.34)}px ${YAZI.tek}`;
  // Kısa tutulur: orta üstte ana sayfanın yakınlaştırma düğmesi durur; uzun yazı altında kalıyordu (canlı görüntü).
  bag.fillText(`${kuralSayisi} kural · ${grupSayisi} grup`, o.genislik - kenar, basYuk / 2);

  const alan: Alan = { x: kenar, y: basYuk + kenar, g: o.genislik - kenar * 2, yuk: o.yukseklik - basYuk - altYuk - kenar * 2 };
  const y = kuralYerlesimi(g.grafik, alan);
  const dugum = new Map(g.grafik.dugumler.map((d) => [d.id, d]));
  const kutu = new Map(y.kutular.map((k) => [k.id, k]));

  // Oklar önce (kutuların altında kalsın).
  for (const ok of y.oklar) {
    const renk = ok.tur === "at" ? RENK.kotu : ok.tur === "sonra" ? RENK.vurgu : RENK.cerceve;
    bag.strokeStyle = renk; bag.fillStyle = renk;
    bag.lineWidth = ok.tur === "icerir" ? 1 : 1.6;
    bag.setLineDash(ok.tur === "at" ? [4, 3] : []);
    bag.beginPath();
    ok.noktalar.forEach((p, i) => (i === 0 ? bag.moveTo(p.x, p.y) : bag.lineTo(p.x, p.y)));
    bag.stroke();
    bag.setLineDash([]);
    if (ok.tur !== "icerir") {
      const a = ok.noktalar[ok.noktalar.length - 2]!, b = ok.noktalar[ok.noktalar.length - 1]!;
      const aci = Math.atan2(b.y - a.y, b.x - a.x), u = Math.max(5, o.yukseklik * 0.014);
      bag.beginPath();
      bag.moveTo(b.x, b.y);
      bag.lineTo(b.x - u * Math.cos(aci - 0.45), b.y - u * Math.sin(aci - 0.45));
      bag.lineTo(b.x - u * Math.cos(aci + 0.45), b.y - u * Math.sin(aci + 0.45));
      bag.closePath(); bag.fill();
    }
  }

  for (const k of y.kutular) {
    const d = dugum.get(k.id)!;
    const secili = g.secili === k.id;
    const atMi = g.grafik.kenarlar.some((e) => e.tur === "at" && e.kimden === k.id);
    const baslikMi = d.tur !== "kural";
    bag.fillStyle = secili ? "#1d2a44" : baslikMi ? "#101a30" : "#0d1220";
    bag.fillRect(k.x, k.y, k.g, k.yuk);
    bag.strokeStyle = secili ? RENK.vurgu : atMi || d.id === "cikis:at" ? RENK.kotu : baslikMi ? RENK.vurgu : RENK.cerceve;
    bag.lineWidth = secili ? 2 : 1;
    bag.strokeRect(k.x, k.y, k.g, k.yuk);
    const ic = k.g - kenar;
    bag.textAlign = "left";
    if (baslikMi) {
      const punto = Math.max(9, Math.round(k.yuk * (d.kisa ? 0.30 : 0.34)));
      bag.font = `600 ${punto}px ${YAZI.duz}`;
      bag.fillStyle = d.id === "cikis:at" ? RENK.kotu : RENK.metin;
      bag.fillText(kisalt(bag, d.etiket, ic), k.x + kenar / 2, d.kisa ? k.y + k.yuk * 0.32 : k.y + k.yuk / 2);
      if (d.kisa) {
        bag.font = `${Math.max(8, Math.round(punto * 0.72))}px ${YAZI.duz}`;
        bag.fillStyle = RENK.soluk;
        bag.fillText(kisalt(bag, d.kisa, ic), k.x + kenar / 2, k.y + k.yuk * 0.72);
      }
    } else {
      const punto = Math.max(8, Math.round(k.yuk * 0.30));
      bag.font = `600 ${punto}px ${YAZI.tek}`;
      bag.fillStyle = RENK.metin;
      bag.fillText(kisalt(bag, d.etiket, ic), k.x + kenar / 2, k.y + k.yuk * 0.30);
      const deg = (d.degiskenler ?? []).map((v) => `${v.ad} ${v.deger}`).join(" · ");
      bag.font = `${Math.max(7, punto - 1)}px ${YAZI.tek}`;
      let sag = 0;
      if (deg) {
        bag.textAlign = "right"; bag.fillStyle = RENK.uyari;
        const dyazi = kisalt(bag, deg, ic * 0.5);
        sag = bag.measureText(dyazi).width + kenar / 2;
        bag.fillText(dyazi, k.x + k.g - kenar / 2, k.y + k.yuk * 0.72);
        bag.textAlign = "left";
      }
      bag.fillStyle = RENK.soluk;
      bag.fillText(kisalt(bag, d.kisa ?? d.kosul ?? "", ic - sag), k.x + kenar / 2, k.y + k.yuk * 0.72);
      bolgeler.push({ x: k.x, y: k.y, g: k.g, yuk: k.yuk, ad: "hafiza", islem: "kural", deger: k.id });
    }
  }

  // Alt şerit: geri düğmesi + seçili kuralın açıklaması.
  const altY = o.yukseklik - altYuk;
  bag.fillStyle = "#090c15";
  bag.fillRect(0, altY, o.genislik, altYuk);
  bag.font = `${Math.round(altYuk * 0.30)}px ${YAZI.duz}`;
  bag.textAlign = "left";
  const yazi = "‹ Bulut", w = bag.measureText(yazi).width + kenar * 1.4;
  bag.fillStyle = "#121726"; bag.fillRect(kenar, altY + altYuk * 0.2, w, altYuk * 0.6);
  bag.strokeStyle = RENK.cerceve; bag.lineWidth = 1; bag.strokeRect(kenar, altY + altYuk * 0.2, w, altYuk * 0.6);
  bag.fillStyle = RENK.metin; bag.fillText(yazi, kenar + kenar * 0.7, altY + altYuk / 2);
  bolgeler.push({ x: kenar, y: altY, g: w, yuk: altYuk, ad: "hafiza", islem: "gorunum", deger: "bulut" });

  const sec = g.secili ? dugum.get(g.secili) : undefined;
  const metin = sec
    ? `${sec.etiket} — ${sec.aciklama ?? ""}  ·  koşul: ${sec.kosul ?? ""}  ·  sonuç: ${sec.sonuc ?? ""}`
    : "bir kuralın kutusuna tıkla: neden, koşul, sonuç · grupta İLK uyan kural kazanır · kırmızı kenar: hafızaya YAZMAZ · sarı: değişken";
  const x0 = kenar * 2 + w, satirG = o.genislik - x0 - kenar;
  const satirlar = sar(bag, metin, satirG).slice(0, 2);
  bag.fillStyle = sec ? RENK.metin : RENK.soluk;
  satirlar.forEach((s, i) => bag.fillText(s, x0, altY + altYuk * (satirlar.length === 1 ? 0.5 : 0.33 + i * 0.36)));
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
