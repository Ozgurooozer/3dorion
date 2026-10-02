// host/apiIstek.js — OpenAI uyumlu API'ye ANA SÜREÇTEN istek (spec 13 Faz 3).
//
// Neden ana süreç: anahtar renderer'a hiç girmez (anahtarDeposu.js kural 1) ve
// renderer'dan başka bir alan adına `fetch` CORS'a takılır. Renderer yalnız
// "şu sağlayıcıya şu gövdeyi gönder" der; Authorization başlığını burası ekler.
//
// Hata metinleri ANAHTARI İÇERMEZ: sağlayıcının cevabı anahtarı geri yansıtsa bile
// (bazı ağ geçitleri "invalid key: sk-…" der) metin renderer'a gitmeden önce
// anahtar maskelenir. Testli (apiIstek.test.ts).
//
// Saf Node: fetch ve depo dışarıdan verilir.

/**
 * @param {string} metin @param {string} anahtar
 */
export function maskele(metin, anahtar) {
  if (!anahtar) return metin;
  return String(metin).split(anahtar).join("***");
}

/**
 * @param {{
 *   depo: { anahtar(ad: string): { adres: string, anahtar: string } | null },
 *   getir?: typeof fetch,
 *   saglayici: string, yol: string, govde?: unknown, zamanAsimiMs?: number,
 * }} a
 * @returns {Promise<{ ok: true, veri: unknown } | { ok: false, hata: string }>}
 */
export async function apiIstek({ depo, getir = fetch, saglayici, yol, govde, zamanAsimiMs = 60_000 }) {
  const k = depo.anahtar(saglayici);
  if (!k) return { ok: false, hata: `${saglayici} için anahtar yok` };
  const c = new AbortController();
  const saat = setTimeout(() => c.abort(), zamanAsimiMs);
  try {
    const y = await getir(`${k.adres}${yol}`, {
      method: govde === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k.anahtar}` },
      ...(govde === undefined ? {} : { body: JSON.stringify(govde) }),
      signal: c.signal,
    });
    const metin = await y.text();
    if (!y.ok) return { ok: false, hata: maskele(`${saglayici} ${y.status}: ${metin.slice(0, 300)}`, k.anahtar) };
    try { return { ok: true, veri: JSON.parse(metin) }; }
    catch { return { ok: false, hata: maskele(`${saglayici}: JSON olmayan cevap: ${metin.slice(0, 120)}`, k.anahtar) }; }
  } catch (e) {
    if (e && e.name === "AbortError") return { ok: false, hata: `${saglayici} ${Math.round(zamanAsimiMs / 1000)} sn içinde cevap vermedi` };
    return { ok: false, hata: maskele(`${saglayici}: ${e instanceof Error ? e.message : String(e)}`, k.anahtar) };
  } finally {
    clearTimeout(saat);
  }
}
