// uygulama/doktor.ts — ORION DOKTOR: Orion'un kendi bedenini/dünyasını muayene etmesi (Ozyn, 2026-10-15).
//
// Neden: GI çalışma anında açılınca ekran bozuldu, Orion ve ofis duvarları kayboldu (RSM'e parçacık çizilmesi). Duman koşuları bunu görmedi.
// Bu modül o ölçümü KALICI bir yetenek yapar: "doktor" sözü (LLM'siz, token'sız) ya da `doktor` niyeti. Ozyn'in isteği: "oturmak kadar kolay
// olmalı, token harcamamalı; ileride Orion canlıda hatayı kendisi tespit edecekken bu testleri istek üzerine çalıştırabilsin".
//
// İki kapsam. HIZLI: pasif (hiçbir şeye dokunmaz, ~2 sn): WebGL hata bayrağı + görünmez mesh'ler + kare hızı + köprü sayaçları.
// TAM: hızlı + (yalnız ova'da) her ışık efektini ve önayarı gündüz/gece çalışma anında açıp kapatır, her adımda aynısını ölçer ve EN SONDA
// eski hâle döner (`finally`; günlüğe/öğrenen sözlüğe yazmaz: `uygula(k, { sessiz: true })`).
//
// Ölçü: (1) `gl.getError()` 50 ms'de bir okunur, INVALID_OPERATION görülen pencere sayılır (konsola bakmaya gerek yok); (2) GÖRÜNMEZLİK:
// görünür, malzemeli her mesh `isReady(true)` olmalı (shader derlenmemiş/çizilemeyen mesh ekranda yok olur).
// Saf çekirdek: Babylon yok, `DoktorBaglami` arkasında (testte sahte); Babylon bağı `doktorBaglamiBabylon`da.
"use strict";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene } from "@babylonjs/core/scene";
import type { LevelTanimi } from "../world/level/cekirdek/levelTanimi.ts";
import type { OrtamKomutu } from "../world/level/stil/ortamKomutu.ts";
import type { DoktorKapsam } from "../protocol/niyet.ts";
import type { OrtamBaglantisi } from "./ortamBaglantisi.ts";

export const GL_INVALID_OPERATION = 0x0502;
/** Işık sonrası efekt grupları (ortam komutundaki ASCII adlar) ve önayarlar: `3dorion.bat efektdene` ile AYNI küme. */
export const DOKTOR_EFEKTLERI = ["bloom", "huzme", "parilti", "ao", "egri", "vinyet", "gren", "sapma", "keskinlik", "derinlik", "gi"] as const;
export const DOKTOR_STILLERI = ["toon", "cel", "anime90", "standart"] as const;

export interface DoktorBaglami {
  /** `getError` okunabilen bağlam; yoksa null (ölçülemez, rapor "ölçülemedi" der). */
  gl(): { getError(): number } | null;
  /** Görünür ve malzemeli mesh'ler: ad + çizilebilir mi (`isReady(true)`). */
  mesheler(): readonly { ad: string; hazirMi(): boolean }[];
  fps(): number;
  ortam: Pick<OrtamBaglantisi, "kullanilabilirMi" | "anlik" | "geriYukle"> & { uygula(k: OrtamKomutu, secenek?: { sessiz?: boolean }): { ok: boolean; not: string } };
  bekle(ms: number): Promise<void>;
  /** Köprü sayaçları (hata/ret); verilmezse atlanır. */
  kopruSayac?(): { hata?: number; reddedilenCagri?: number };
  /** Adım ayarı (test 0 verir). */
  yerlesmeMs?: number;
  olcumMs?: number;
  simdi?(): number;
}

export interface DoktorRaporu {
  kapsam: DoktorKapsam;
  saglikli: boolean;
  /** Ozyn'e: altyazı ve Orion'un sesi için kısa Türkçe cümle. */
  ozet: string;
  /** Modele: `sonuc.not` (hasta ise `hata` ile döner; sağlıklıysa sessiz `bitti`). İngilizce, kısa. */
  modelNotu: string;
  /** Adım adım `GECTI/KALDI …` satırları (günlük ve `efektdene` senaryosu). */
  ayrinti: string[];
  sureMs: number;
}

export interface Doktor {
  muayene(kapsam: DoktorKapsam): Promise<DoktorRaporu>;
  mesgulMu(): boolean;
}

export function doktorKur(b: DoktorBaglami): Doktor {
  const yerlesme = b.yerlesmeMs ?? 400, olcum = b.olcumMs ?? 600;
  const simdi = b.simdi ?? (() => Date.now());
  let mesgul = false;

  /** `ms` boyunca GL hata bayrağını 50 ms'de bir okur; INVALID_OPERATION görülen pencere sayısı (null: ölçülemedi). */
  async function glPencereleri(ms: number): Promise<number | null> {
    const gl = b.gl();
    if (!gl) return null;
    while (gl.getError() !== 0) { /* eski bayrağı boşalt */ }
    let n = 0;
    for (let t = 0; t < ms; t += 50) { await b.bekle(50); if (gl.getError() === GL_INVALID_OPERATION) n++; }
    return n;
  }

  async function olc(ad: string, ayrinti: string[], sorunlar: string[], ms = olcum): Promise<void> {
    const hata = await glPencereleri(ms);
    const yok = b.mesheler().filter((m) => !m.hazirMi()).map((m) => m.ad);
    const ok = (hata === null || hata === 0) && yok.length === 0;
    ayrinti.push(`${ok ? "GECTI" : "KALDI"} ${ad} — GL hata penceresi=${hata ?? "ölçülemedi"} hazır_olmayan_mesh=${yok.length}${yok.length ? ` (${yok.slice(0, 3).join(", ")})` : ""}`);
    if (!ok) sorunlar.push(ad);
  }

  async function tamMuayene(ayrinti: string[], sorunlar: string[]): Promise<void> {
    if (!b.ortam.kullanilabilirMi()) {
      ayrinti.push("ATLANDI tam muayene: efektler yalnız ova'da (dışarıdayken tekrar iste)");
      return;
    }
    const once: LevelTanimi | null = b.ortam.anlik();
    const uygula = (k: OrtamKomutu) => b.ortam.uygula(k, { sessiz: true });
    const adim = async (ad: string, k: OrtamKomutu) => {
      const r = uygula(k);
      if (!r.ok) { ayrinti.push(`KALDI ${ad} — komut reddedildi: ${r.not}`); sorunlar.push(ad); return; }
      await b.bekle(yerlesme);
      await olc(ad, ayrinti, sorunlar);
    };
    try {
      for (const [yer, saat] of [["gündüz", 12], ["gece", 0]] as const) {
        uygula({ tur: "ortam", ne: "sifirla" });
        uygula({ tur: "ortam", ne: "saat", sayi: saat });
        await b.bekle(yerlesme);
        await olc(`${yer} · başlangıç`, ayrinti, sorunlar);
        for (const e of DOKTOR_EFEKTLERI) await adim(`${yer} · ${e} aç`, { tur: "ortam", ne: "efekt", deger: `${e}:ac` });
        await olc(`${yer} · HEPSİ açık`, ayrinti, sorunlar);
        for (const s of DOKTOR_STILLERI) await adim(`${yer} · stil ${s} (hepsi açık üstüne)`, { tur: "ortam", ne: "stil", deger: s });
        for (const e of DOKTOR_EFEKTLERI) uygula({ tur: "ortam", ne: "efekt", deger: `${e}:kapat` });
        await b.bekle(yerlesme);
        await olc(`${yer} · efektler kapatıldı`, ayrinti, sorunlar);
      }
    } finally {
      // ESKİ HÂL: hata ya da iptalle bile geri yüklenir. Yüklenemezse bunu AÇIKÇA söyle (sessiz bırakılmış bir ortam en kötü hâl).
      if (once && !b.ortam.geriYukle(once)) { ayrinti.push("KALDI eski ortam hâline dönülemedi"); sorunlar.push("eski hâle dönüş"); }
    }
  }

  return {
    mesgulMu: () => mesgul,
    async muayene(kapsam) {
      if (mesgul) {
        return { kapsam, saglikli: false, ozet: "Zaten muayene ediyorum, bitince söylerim.", modelNotu: "A check is already running.", ayrinti: [], sureMs: 0 };
      }
      mesgul = true;
      const t0 = simdi();
      const ayrinti: string[] = [], sorunlar: string[] = [];
      try {
        await olc("pasif kontrol", ayrinti, sorunlar, Math.max(olcum, 1500));
        const fps = b.fps();
        ayrinti.push(`${fps >= 8 || !Number.isFinite(fps) ? "GECTI" : "KALDI"} kare hızı ${Number.isFinite(fps) ? Math.round(fps) : "?"}`);
        if (Number.isFinite(fps) && fps < 8) sorunlar.push(`kare hızı ${Math.round(fps)}`);
        const sayac = b.kopruSayac?.();
        if (sayac) ayrinti.push(`BILGI köprü: hata=${sayac.hata ?? 0} reddedilen_çağrı=${sayac.reddedilenCagri ?? 0}`);
        if (kapsam === "tam") await tamMuayene(ayrinti, sorunlar);
      } catch (err) {
        ayrinti.push(`KALDI muayene çöktü: ${err instanceof Error ? err.message : String(err)}`);
        sorunlar.push("muayene çöktü");
      } finally {
        mesgul = false;
      }
      const kontrol = ayrinti.filter((s) => s.startsWith("GECTI") || s.startsWith("KALDI")).length;
      const saglikli = sorunlar.length === 0;
      const ilk = sorunlar.slice(0, 2).join("; ");
      return {
        kapsam, saglikli, ayrinti, sureMs: simdi() - t0,
        ozet: saglikli ? `Muayene temiz: ${kontrol} kontrol, sorun yok.` : `Sorun var: ${sorunlar.length} kontrol başarısız (${ilk}).`,
        modelNotu: saglikli ? `Check clean: ${kontrol} checks, no problems.` : `Check found ${sorunlar.length} problem(s): ${ilk}.`,
      };
    },
  };
}

/** Gerçek Babylon sahnesi için bağlam (çekirdek bunu bilmez). */
export function doktorBaglamiBabylon(
  sahne: Scene, motor: AbstractEngine, ortam: DoktorBaglami["ortam"], kopruSayac?: DoktorBaglami["kopruSayac"],
): DoktorBaglami {
  return {
    gl: () => (motor.getRenderingCanvas()?.getContext("webgl2") as WebGL2RenderingContext | null) ?? null,
    mesheler: () => sahne.meshes
      .filter((m) => m.isEnabled() && m.isVisible && m.getTotalVertices() > 0 && !!m.material)
      .map((m) => ({ ad: m.name, hazirMi: () => m.isReady(true) })),
    fps: () => motor.getFps(),
    ortam,
    bekle: (ms) => new Promise((r) => setTimeout(r, ms)),
    ...(kopruSayac ? { kopruSayac } : {}),
  };
}
