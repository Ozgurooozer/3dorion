// host/anahtarDeposu.js — API anahtarlarının diskteki yeri (spec 13 Faz 3).
//
// Ozyn'in kararı (2026-10-02): seçiciye (M) girilen anahtar ŞİFRELİ saklanır ve
// hatırlanır; "sil" düğmesi vardır. Şifreleme Electron `safeStorage` (Windows'ta
// DPAPI: kullanıcı hesabına bağlı) — burada `sifreleyici` olarak dışarıdan verilir,
// böylece modül Electron'suz test edilir.
//
// ÜÇ KURAL, üçü de testli (anahtarDeposu.test.ts):
//   1. ANAHTAR RENDERER'A ÇIKMAZ. `durum()` yalnız "anahtar var mı" söyler; anahtarın
//      kendisini yalnız `anahtar()` döner ve onu yalnız ana süreç çağırır (istek atarken).
//   2. ANAHTAR DÜZ METİN DİSKE YAZILMAZ. Şifreleme yoksa anahtar yalnız bu oturumun
//      belleğinde kalır ve `kalici: false` ile söylenir — sessizce düz yazmak yok.
//   3. ANAHTAR LOG'A GİTMEZ. Bu modül hiçbir şey basmaz; hata metinleri anahtarı içermez.
//
// Dosya: { surum: 1, saglayicilar: { <ad>: { adres, sifreli: <base64> } } }. Atomik yazım
// (önce .tmp, sonra yeniden adlandırma), hafizaDosyasi.js ile aynı desen.
import fs from "node:fs";
import path from "node:path";

const AD = /^[a-z0-9-]{1,32}$/;
const ANAHTAR_SINIRI = 512;

/**
 * Adres doğrulaması: HTTPS ya da yalnız bu makine (yerel sahte sunucu, test).
 * Anahtar düz HTTP ile başka bir makineye GİTMEZ.
 * @param {string} adres
 * @returns {string} "" geçerli, aksi hâlde sebep
 */
export function adresHatasi(adres) {
  let u;
  try { u = new URL(adres); } catch { return "adres geçerli bir URL değil"; }
  if (u.protocol === "https:") return "";
  if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return "";
  return "adres https olmalı (anahtar şifresiz bağlantıyla gönderilmez)";
}

/**
 * @param {{ yol: string, sifreleyici: { kullanilabilir(): boolean, sifrele(m: string): Buffer, coz(b: Buffer): string } }} ayar
 */
export function anahtarDeposuKur({ yol, sifreleyici }) {
  /** @type {Map<string, { adres: string, anahtar: string, kalici: boolean }>} */
  const bellek = new Map();

  // Açılış: dosyadakiler çözülür. Çözülemeyen kayıt atlanır (başka hesapta şifrelenmiş
  // olabilir); dosya SİLİNMEZ — kullanıcı yeniden girince üzerine yazılır.
  try {
    const j = JSON.parse(fs.readFileSync(yol, "utf8"));
    if (sifreleyici.kullanilabilir()) {
      for (const [ad, k] of Object.entries(j?.saglayicilar ?? {})) {
        try {
          if (!AD.test(ad) || typeof k?.adres !== "string" || typeof k?.sifreli !== "string") continue;
          bellek.set(ad, { adres: k.adres, anahtar: sifreleyici.coz(Buffer.from(k.sifreli, "base64")), kalici: true });
        } catch { /* çözülemedi: atla */ }
      }
    }
  } catch { /* dosya yok ya da bozuk: boş başla */ }

  function diskeYaz() {
    if (!sifreleyici.kullanilabilir()) return false;
    /** @type {Record<string, {adres: string, sifreli: string}>} */
    const saglayicilar = {};
    for (const [ad, k] of bellek) {
      if (!k.kalici) continue;
      saglayicilar[ad] = { adres: k.adres, sifreli: sifreleyici.sifrele(k.anahtar).toString("base64") };
    }
    fs.mkdirSync(path.dirname(yol), { recursive: true });
    const tmp = `${yol}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ surum: 1, saglayicilar }, null, 2));
    fs.renameSync(tmp, yol);
    return true;
  }

  return {
    /** Renderer'a giden tek görünüm: anahtarın KENDİSİ yok. */
    durum() {
      return [...bellek].map(([ad, k]) => ({ ad, adres: k.adres, anahtarVar: true, kalici: k.kalici }));
    },
    /**
     * @param {string} ad @param {string} adres @param {string} anahtar
     * @returns {{ ok: true, kalici: boolean } | { ok: false, hata: string }}
     */
    kaydet(ad, adres, anahtar) {
      if (typeof ad !== "string" || !AD.test(ad)) return { ok: false, hata: "sağlayıcı adı geçersiz" };
      const ah = adresHatasi(String(adres));
      if (ah) return { ok: false, hata: ah };
      const a = typeof anahtar === "string" ? anahtar.trim() : "";
      if (!a) return { ok: false, hata: "anahtar boş" };
      if (a.length > ANAHTAR_SINIRI || /\s/.test(a)) return { ok: false, hata: "anahtar biçimi geçersiz" };
      const kalici = sifreleyici.kullanilabilir();
      bellek.set(ad, { adres: String(adres).replace(/\/+$/, ""), anahtar: a, kalici });
      try { if (kalici) diskeYaz(); }
      catch { return { ok: false, hata: "anahtar dosyası yazılamadı" }; }
      return { ok: true, kalici };
    },
    /** @param {string} ad */
    sil(ad) {
      const vardi = bellek.delete(ad);
      try { diskeYaz(); } catch { return { ok: false, hata: "anahtar dosyası yazılamadı" }; }
      return vardi ? { ok: true } : { ok: false, hata: "bu sağlayıcı için anahtar yok" };
    },
    /** YALNIZ ana süreç: istek atarken. @param {string} ad */
    anahtar(ad) { return bellek.get(ad) ?? null; },
  };
}
