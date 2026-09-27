// host/kararDosyasi.js — Karar kaydının diskteki yeri (spec 08).
//
// Renderer karar satırını `[KARAR] {json}` olarak konsola yazar
// (mind/kararKaydi.ts); ana süreç renderer konsolunu zaten dinliyor
// (main.js `console-message`) ve önekli satırı buraya verir. Yeni bir IPC
// yüzeyi yok: `KayitBeyni` ile aynı yol, bu kez günlüğe değil dosyaya.
//
// ÜÇ KURAL, üçü de test edildi (kararDosyasi.test.ts):
//   1. YALNIZCA KARAR SATIRI: önekli olmayan mesaj yazılmaz. Önek atılır,
//      gövde JSON olarak doğrulanır; bozuk gövde YAZILMAZ ama SAYILIR —
//      dosyada tek bozuk satır, onu okuyan her aracı kırar.
//   2. GÜNLÜK DOSYA: <kök>/YYYY-MM-DD.jsonl (yerel tarih). Bir gün bir dosya:
//      gerçek kullanım aylarca birikecek; tek dev dosya ne okunur ne taşınır.
//      `sabitDosya` verilirse (ORION_KARAR_DOSYASI) her şey oraya yazılır —
//      deneme koşuları kendi kaydını ayrı tutsun.
//   3. SIRA KORUNUR: ekleme senkron. Satırlar küçük ve seyrek (tik yazılmaz);
//      zincirin anlamı sırada — uyanış, tetikleyen algılardan sonra gelmeli.
//
// Hata ASLA fırlatılmaz: kayıt yazılamıyorsa Orion yine yaşar (içgüdü `kayit`).
// Hata sayılır ve ilk seferde bir kez söylenir.
//
// Saf Node (fs + path). Electron'a bağlı değil: testte doğrudan koşar.
import fs from "node:fs";
import path from "node:path";

/** Satır öneki. Tek kaynak mind/kararKaydi.ts'te; eşitliği kararDosyasi.test.ts bekler. */
export const KARAR_ONEKI = "[KARAR]";

/** Konsol mesajı bir karar satırı mı? */
export function kararSatiriMi(mesaj) {
  return typeof mesaj === "string" && mesaj.startsWith(`${KARAR_ONEKI} `);
}

/** Günün dosya yolu — yerel tarihle: gece yarısı Ozyn'in gecesidir, UTC'nin değil. */
export function gunlukYol(kok, tarih = new Date()) {
  const iki = (n) => String(n).padStart(2, "0");
  return path.join(kok, `${tarih.getFullYear()}-${iki(tarih.getMonth() + 1)}-${iki(tarih.getDate())}.jsonl`);
}

/**
 * @param {{ kok?: string, sabitDosya?: string, simdi?: () => Date, uyar?: (m: string) => void }} ayar
 */
export function kararYaziciKur(ayar) {
  const simdi = ayar.simdi ?? (() => new Date());
  const uyar = ayar.uyar ?? ((m) => console.warn(m));
  const sayac = { yazilan: 0, bozuk: 0, hata: 0 };
  const hazirKlasor = new Set();
  let uyarildi = false;

  function yol() {
    if (ayar.sabitDosya) return ayar.sabitDosya;
    if (!ayar.kok) throw new Error("kararYaziciKur: kok ya da sabitDosya gerekli");
    return gunlukYol(ayar.kok, simdi());
  }

  return {
    /** Konsol mesajını alır; karar satırıysa dosyaya ekler. Karar satırıysa true döner. */
    yaz(mesaj) {
      if (!kararSatiriMi(mesaj)) return false;
      const govde = mesaj.slice(KARAR_ONEKI.length + 1);
      try {
        JSON.parse(govde);
      } catch {
        sayac.bozuk++;
        return true;
      }
      try {
        const hedef = yol();
        const klasor = path.dirname(hedef);
        if (!hazirKlasor.has(klasor)) { fs.mkdirSync(klasor, { recursive: true }); hazirKlasor.add(klasor); }
        fs.appendFileSync(hedef, `${govde}\n`, "utf8");
        sayac.yazilan++;
      } catch (e) {
        sayac.hata++;
        if (!uyarildi) { uyarildi = true; uyar(`[karar] kayit yazilamadi: ${e && e.message ? e.message : e}`); }
      }
      return true;
    },
    sayac() { return { ...sayac }; },
    /** Şu an yazılan dosya — başlangıçta bir kez söylenir, kayıt aranırken bulunsun. */
    yol,
  };
}
