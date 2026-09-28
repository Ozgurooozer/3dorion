// host/ollamaSunucu.js — Ollama kapalıysa `ollama serve`'ü başlatır.
//
// NEDEN: model seçici (M) kurulu Ollama modellerini açılışta tarıyor. Ollama
// Windows'ta çoğu zaman tepsi uygulamasıyla açılır ama kapalıysa seçici
// "Ollama yok" der ve Ozyn'in ayrı bir terminalde `ollama serve` yazması
// gerekirdi — Claude adaptörünün eskiden yaşadığı sorunun aynısı (main.js
// `claudeBeyniBaslat` yorumu). Artık Electron kendi başlatır.
//
// ÜÇ KURAL (ollamaSunucu.test.ts):
//   1. AYAKTAYSA DOKUNMA: zaten koşan bir Ollama'ya ikinci süreç açılmaz
//      (port çakışır, ikincisi hemen ölür ve günlüğü kirletir).
//   2. BİZ AÇTIYSAK BİZ KAPATIRIZ: kapanışta yalnızca kendi başlattığımız
//      süreç öldürülür. Ozyn'in açtığı Ollama'yı kapatmak başka
//      uygulamalarını da düşürürdü.
//   3. ASLA FIRLATMAZ: `ollama` kurulu değilse oda YİNE açılır; yalnızca
//      yerel seçenekler boş kalır ve seçici sebebini söyler.
//
// `ORION_OLLAMA=0` ile kapatılır. Adres `OLLAMA_HOST` (Ollama'nın kendi
// değişkeni) ya da varsayılan 127.0.0.1:11434.
//
// Saf Node: `spawn` ve `fetch` dışarıdan verilir, testte sahte.

export const VARSAYILAN_ADRES = "http://127.0.0.1:11434";

/** `OLLAMA_HOST` biçimleri: `0.0.0.0:11434`, `127.0.0.1`, `http://h:p`. */
export function ollamaAdresi(host) {
  const h = String(host ?? "").trim();
  if (!h) return VARSAYILAN_ADRES;
  let u = /^https?:\/\//.test(h) ? h : `http://${h}`;
  u = u.replace(/\/+$/, "");
  // Dinleme adresi 0.0.0.0 ise bağlanılacak adres yerel makinedir.
  u = u.replace("://0.0.0.0", "://127.0.0.1");
  return /:\d+$/.test(u) ? u : `${u}:11434`;
}

/** Sunucu ayakta mı — `/api/version` cevap veriyor mu. */
export async function ayaktaMi(adres, ayar = {}) {
  const f = ayar.fetch ?? globalThis.fetch;
  const c = new AbortController();
  const saat = setTimeout(() => c.abort(), ayar.zamanAsimiMs ?? 1500);
  try {
    const y = await f(`${adres}/api/version`, { signal: c.signal });
    return y.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(saat);
  }
}

/**
 * Ollama'yı hazırla. Dönüş: `{ durum, surec, kapat() }`
 *   durum: "kapali-istendi" | "zaten-ayakta" | "baslatildi" | "baslatilamadi"
 *   kapat(): yalnızca BİZİM başlattığımız süreci durdurur.
 */
export async function ollamaHazirla(ayar = {}) {
  const env = ayar.env ?? process.env;
  const log = ayar.log ?? ((m) => console.log(`[ollama] ${m}`));
  const bos = (durum) => ({ durum, surec: null, kapat() {} });

  if (env.ORION_OLLAMA === "0") return bos("kapali-istendi");
  const adres = ollamaAdresi(env.OLLAMA_HOST);
  if (await ayaktaMi(adres, ayar)) {
    log(`zaten ayakta: ${adres}`);
    return bos("zaten-ayakta");
  }

  let surec = null;
  try {
    surec = (ayar.spawn)(env.ORION_OLLAMA_YOL || "ollama", ["serve"], {
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env,
    });
  } catch (e) {
    log(`başlatılamadı: ${e?.message ?? e}`);
    return bos("baslatilamadi");
  }
  // `ollama` PATH'te yoksa spawn fırlatmaz, 'error' olayı yayar.
  let hata = null;
  surec.on?.("error", (e) => { hata = e; log(`başlatılamadı: ${e?.message ?? e} (Ollama kurulu mu?)`); });
  surec.on?.("exit", (kod) => { if (kod) log(`çıktı, kod=${kod}`); surec = null; });
  // Ollama günlüğü gürültülü (her istek bir satır): yalnızca hata satırları.
  surec.stderr?.on?.("data", (d) => {
    const s = String(d);
    if (/error|panic|fatal/i.test(s)) process.stderr.write(`[ollama] ${s}`);
  });

  // Hazır olana dek kısa aralıklarla yokla; seçici taramasının boş dönmemesi
  // için pencere açılmadan ÖNCE ayakta olmalı. Tavan 8 sn: açılış beklemez.
  const bitis = Date.now() + (ayar.beklemeMs ?? 8000);
  while (Date.now() < bitis && !hata && surec) {
    if (await ayaktaMi(adres, ayar)) {
      log(`başlatıldı: ${adres}`);
      const s = surec;
      return {
        durum: "baslatildi", surec: s,
        kapat() { try { s.kill(); } catch { /* kapanışta önemsiz */ } },
      };
    }
    await new Promise((r) => setTimeout(r, ayar.aralikMs ?? 250));
  }
  if (surec && !hata) {
    log(`${ayar.beklemeMs ?? 8000} ms içinde cevap vermedi; arkada açılmaya devam ediyor`);
    const s = surec;
    return { durum: "baslatildi", surec: s, kapat() { try { s.kill(); } catch { /* önemsiz */ } } };
  }
  return bos("baslatilamadi");
}
