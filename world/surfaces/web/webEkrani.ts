// world/surfaces/web/webEkrani.ts — Ofisteki 3. monitör: bir WEB SAYFASININ (groma mimari haritası) kareleri ekranda.
// Ön kayıt: docs/olcum/on-kayit-groma-monitoru-1.md. Kareleri ana süreçteki ekran dışı pencere üretir (host/webMonitor.js, JPEG); burası yalnız çizer.
//
// Dürüst boşluk (W4): sayfa yokken ekran siyah kalmaz, NE olduğunu yazar ("groma kapalı — masaüstündeki groma-haritasi.bat"); bağlantı koparsa son kare
// "bağlantı kesildi" şeridiyle kalır (bayat harita güncel sanılmasın). Bağımlılık sınırı (K4): yalnız Babylon ve `yuzey.ts`.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { yuzeyKur, RENK, YAZI, zeminDoldur, type Yuzey, type YuzeyOlcusu } from "../yuzey.ts";

export type WebDurumu = "baglaniyor" | "yukleniyor" | "acik" | "kapali" | "yok";

/** Doku UV'si (0..1; v yukarı artar) → sayfanın normalleştirilmiş koordinatı (0..1, y aşağı). Ekran dışı değerler kenara sıkıştırılır. */
export function uvdenSayfaya(u: number, v: number): { x: number; y: number } {
  const k = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
  return { x: k(u), y: k(1 - v) };
}

/** Kare yokken ekranda yazan (başlık, ayrıntı). Saf, testli. */
export function yerTutucuMetni(d: WebDurumu): { baslik: string; ayrinti: string } {
  switch (d) {
    case "baglaniyor": return { baslik: "groma haritası", ayrinti: "bağlanılıyor…" };
    case "yukleniyor": return { baslik: "groma haritası", ayrinti: "sayfa yükleniyor…" };
    case "kapali": return { baslik: "groma kapalı", ayrinti: "masaüstündeki groma-haritasi.bat ile aç; açılınca kendiliğinden bağlanır" };
    case "yok": return { baslik: "groma haritası", ayrinti: "yalnız Electron'da çalışır (tarayıcı/dev kipinde ekran dışı pencere yok)" };
    case "acik": return { baslik: "groma haritası", ayrinti: "ilk kare bekleniyor…" };
  }
}

export interface WebEkrani {
  /** Yeni kare (JPEG baytları). Çözülürse ekrana çizilir; çözülemezse false (önceki kare kalır). */
  kareGeldi(jpeg: Uint8Array): Promise<boolean>;
  durum(d: WebDurumu): void;
  kareSayisi(): number;
  /** Ekrandaki son karenin boş olmayan piksel oranı (W1: doku dolu mu); kare yoksa 0. */
  doluluk(): number;
  yokEt(): void;
}

export interface WebEkraniAyari {
  sahne: Scene;
  mesh: AbstractMesh;
  genislikM: number;
  yukseklikM: number;
  /** Dokunun dikey çözünürlüğü; varsayılan 600 (sayfa 1008×600: 1:1 eşleşir). */
  dikeyPiksel?: number;
  /** JPEG → çizilebilir resim (testte sahte; varsayılan `createImageBitmap`). */
  resimCoz?: (jpeg: Uint8Array) => Promise<ImageBitmap>;
}

export function webEkraniKur(a: WebEkraniAyari): WebEkrani {
  let durumu: WebDurumu = "baglaniyor";
  let resim: ImageBitmap | null = null;
  let kareler = 0;
  const coz = a.resimCoz ?? ((j) => createImageBitmap(new Blob([j.buffer.slice(j.byteOffset, j.byteOffset + j.byteLength) as ArrayBuffer], { type: "image/jpeg" })));

  function ciz(bag: CanvasRenderingContext2D, o: YuzeyOlcusu): void {
    zeminDoldur(bag, o, "#0a0e18");
    if (resim) {
      bag.drawImage(resim, 0, 0, o.genislik, o.yukseklik);
      if (durumu === "kapali") {
        // Sayfa koptu: son kare bayat, bunu söyle.
        bag.fillStyle = "rgba(10,14,24,0.82)";
        bag.fillRect(0, o.yukseklik - o.yukseklik * 0.12, o.genislik, o.yukseklik * 0.12);
        bag.fillStyle = RENK.uyari;
        bag.font = `${Math.round(o.yukseklik * 0.05)}px ${YAZI.duz}`;
        bag.textAlign = "center"; bag.textBaseline = "middle";
        bag.fillText("bağlantı kesildi — harita güncel değil", o.genislik / 2, o.yukseklik - o.yukseklik * 0.06);
      }
      return;
    }
    const m = yerTutucuMetni(durumu);
    bag.textAlign = "center"; bag.textBaseline = "middle";
    bag.fillStyle = durumu === "kapali" ? RENK.kotu : RENK.vurgu;
    bag.font = `600 ${Math.round(o.yukseklik * 0.09)}px ${YAZI.duz}`;
    bag.fillText(m.baslik, o.genislik / 2, o.yukseklik * 0.42);
    bag.fillStyle = RENK.soluk;
    bag.font = `${Math.round(o.yukseklik * 0.045)}px ${YAZI.duz}`;
    bag.fillText(m.ayrinti, o.genislik / 2, o.yukseklik * 0.55);
  }

  const yuzey: Yuzey = yuzeyKur({
    sahne: a.sahne, mesh: a.mesh, genislikM: a.genislikM, yukseklikM: a.yukseklikM,
    dikeyPiksel: a.dikeyPiksel ?? 600, isik: "ekran", ad: "groma", ciz,
  });

  return {
    async kareGeldi(jpeg) {
      let yeni: ImageBitmap;
      try { yeni = await coz(jpeg); } catch { return false; }
      const eski = resim;
      resim = yeni;
      eski?.close?.();
      kareler++;
      if (durumu !== "acik") durumu = "acik";
      yuzey.kirlet();
      return true;
    },
    durum(d) { durumu = d; yuzey.kirlet(); },
    kareSayisi: () => kareler,
    doluluk() {
      if (!resim) return 0;
      // Küçük bir örneklem tuvalinde tek renk dışı piksel oranı (arka plan rengiyle aynı olmayanlar).
      const N = 48;
      const tuval = document.createElement("canvas");
      tuval.width = N; tuval.height = N;
      const bag = tuval.getContext("2d");
      if (!bag) return 0;
      bag.drawImage(resim, 0, 0, N, N);
      const px = bag.getImageData(0, 0, N, N).data;
      const r0 = px[0]!, g0 = px[1]!, b0 = px[2]!;
      let farkli = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (Math.abs(px[i]! - r0) + Math.abs(px[i + 1]! - g0) + Math.abs(px[i + 2]! - b0) > 24) farkli++;
      }
      return farkli / (N * N);
    },
    yokEt() { resim?.close?.(); resim = null; yuzey.yokEt(); },
  };
}
