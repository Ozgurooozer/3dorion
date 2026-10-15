// uygulama/gozlem.ts — GÖZ MUAYENESİ: Orion'un gözünden kare → yerel görme modeli → "ne görüyorsun" betimi, panelde önizleme + cevap (Ozyn, 2026-10-15).
//
// "Zihin akışına bakma": bir tuşla (O) Orion'un o anki kamerasından kare alınır ve Orion'un sohbetinden, rolünden ve algısından BAĞIMSIZ, düz bir
// soruyla görme modeline sorulur (`GozModeli.incele`, `GOZLEM_ISTEMI`). Sonuç sohbet geçmişine GİRMEZ, köprüden geçmez, hafızaya yazılmaz: yalnız
// panelde görünür (önizleme + cevap + model + süre). Orion'un kendi `sor gor` yolundan ayrı bir araçtır.
//
// SIRA (yerel model tek): aynı Ollama modeli beyin ve göz için kullanılabilir; ikisi birden yüklenip ekran belleğini zorlamasın diye İKİ YÖNLÜ sıra vardır:
//   - beyin düşünüyorsa göz muayenesi bekler (panelde "beyin düşünüyor, sıra bekleniyor");
//   - göz muayenesi sürerken beyin yeni tur BAŞLATMAZ (`suruyor()` köprünün `beyinKapisi`na bağlı; tur kısa süre ertelenir, kaybolmaz).
// Tek uçuş: muayene sürerken ikinci istek yeni muayene açmaz.
// Saf çekirdek: DOM ve Babylon yok (`GozlemBagi` arkasında); panel `world/arayuz/gozPaneli.ts`.
"use strict";

export interface GozlemKaresi { png: string; en: number; boy: number }

export interface GozlemKaydi {
  metin: string;
  model: string;
  /** Yalnız MODELİN cevap süresi (ms); kare çekimi ve sıra beklemesi hariç. */
  ms: number;
  en: number;
  boy: number;
  /** base64 PNG (önek yok). */
  png: string;
  /** Kayıt anı (epoch ms). */
  an: number;
}

export interface GozlemPaneli {
  ac(): void;
  durum(mesaj: string): void;
  onizleme(dataUrl: string, en: number, boy: number): void;
  cevap(metin: string, model: string, ms: number): void;
  hata(mesaj: string): void;
}

export interface GozlemBagi {
  /** Orion'un ŞU ANKİ gözünden kare; beden yoksa null. */
  kare(): Promise<GozlemKaresi | null>;
  model: { readonly model: string; incele(png: string): Promise<string> };
  /** Beyin şu an düşünüyor mu (köprü `dusunuyorMu`). */
  beyinMesgul(): boolean;
  panel: GozlemPaneli;
  bekle?: (ms: number) => Promise<void>;
  simdi?: () => number;
  /** Sırada beklemenin tavanı (ms); aşılırsa muayene vazgeçer ve söyler. Varsayılan 90 sn. */
  siraTavaniMs?: number;
}

export interface Gozlem {
  /** Bir kez bak. Dönüş: kayıt; sorun olduysa (kare yok, model yok, sıra zaman aşımı) null — sorun panelde yazılıdır. Sürerken ikinci çağrı null. */
  bak(): Promise<GozlemKaydi | null>;
  /** Muayene sürüyor mu (beyin başlamasın diye köprünün kapısı bunu okur). */
  suruyor(): boolean;
  son(): GozlemKaydi | null;
}

export function gozlemKur(b: GozlemBagi): Gozlem {
  const bekle = b.bekle ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const simdi = b.simdi ?? (() => Date.now());
  const tavan = b.siraTavaniMs ?? 90_000;
  let calisiyor = false;
  let sonKayit: GozlemKaydi | null = null;

  return {
    suruyor: () => calisiyor,
    son: () => sonKayit,
    async bak() {
      if (calisiyor) { b.panel.ac(); b.panel.durum("zaten bakıyorum, bitince cevap burada görünür"); return null; }
      calisiyor = true;
      try {
        b.panel.ac();
        b.panel.durum("kare çekiliyor…");
        let kare: GozlemKaresi | null;
        try { kare = await b.kare(); } catch (err) { b.panel.hata(`kare çekilemedi: ${err instanceof Error ? err.message : String(err)}`); return null; }
        if (!kare) { b.panel.hata("Orion'un bedeni yok (kare alınamadı)"); return null; }
        b.panel.onizleme(`data:image/png;base64,${kare.png}`, kare.en, kare.boy);

        // Sıra: beyin düşünüyorsa bekle. `calisiyor` zaten doğru: beyin kapısı kapalı, yeni tur başlamaz; yalnız süren tur bitmeli.
        const t0 = simdi();
        while (b.beyinMesgul()) {
          if (simdi() - t0 > tavan) { b.panel.hata(`beyin ${Math.round(tavan / 1000)} sn içinde boşalmadı; göz muayenesi vazgeçti (tekrar dene)`); return null; }
          b.panel.durum("beyin düşünüyor, sıra bekleniyor…");
          await bekle(300);
        }

        b.panel.durum(`${b.model.model} bakıyor…`);
        const t1 = simdi();
        let metin: string;
        try { metin = await b.model.incele(kare.png); } catch (err) { b.panel.hata(err instanceof Error ? err.message : String(err)); return null; }
        const kayit: GozlemKaydi = { metin, model: b.model.model, ms: simdi() - t1, en: kare.en, boy: kare.boy, png: kare.png, an: simdi() };
        sonKayit = kayit;
        b.panel.cevap(metin, kayit.model, kayit.ms);
        return kayit;
      } finally {
        calisiyor = false;
      }
    },
  };
}
