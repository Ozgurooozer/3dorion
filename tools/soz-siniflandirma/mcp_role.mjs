// mcp_role.mjs — Orion'un MCP ucuna bağlanan canlı röle. Claude oturumuna olay akıtır, komutu dosyadan alır.
//   node mcp_role.mjs --port 4810 --sure 180
// Çıktı (stdout, satır satır): OLAY <özet> | SONUC <araç> <özet> | BITTI <sebep>
// Komut vermek: tools/soz-siniflandirma/sonuc/el-komut.jsonl'a satır ekle: {"arac":"dunya_otur","arg":{}}
// Durdurma: süre dolar, el-dur dosyası oluşur ya da odada "dur"/"bitir" denir. Sessiz ("quiet") turlar basılmaz.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const arg = (ad, d) => { const i = process.argv.indexOf(`--${ad}`); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg("port", "4810"));
const SURE_MS = Number(arg("sure", "180")) * 1000;
const KLASOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "sonuc");
const KOMUT = path.join(KLASOR, "el-komut.jsonl");
const DUR = path.join(KLASOR, "el-dur");
const TUR_MS = Number(arg("tur", "45")) * 1000; // durumdan sonra komut beklenen süre
const BASLA = Date.now();
let tur = false;
let sessiz = 0;
if (!fs.existsSync(KOMUT)) fs.writeFileSync(KOMUT, ""); // önceden yazılmış komutlar korunur
try { fs.unlinkSync(DUR); } catch { /* yok */ }

let id = 0;
async function rpc(yontem, params) {
  const r = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: yontem, params }),
    signal: AbortSignal.timeout(130_000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
const metin = (s) => (s?.content ?? []).map((c) => c.text ?? "").join(" ").replace(/\s+/g, " ").trim();
const kes = (t, n = 700) => (t.length > n ? t.slice(0, n) + "…" : t);
const bitir = (sebep) => { console.log(`BITTI ${sebep} (${Math.round((Date.now() - BASLA) / 1000)} sn)`); process.exit(0); };

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-role", version: "1" } });
let ilk = true;
while (true) {
  if (Date.now() - BASLA > SURE_MS) bitir("sure doldu");
  if (fs.existsSync(DUR)) bitir("el-dur dosyasi");
  // Araçlar yalnızca bir durum işlenirken kabul edilir (bekle→bekle arası = tur). Bu yüzden durum basıldıktan sonra
  // tur AÇIK tutulur: komut dosyasına satır düşene kadar (en çok TUR_MS) beklenir, sonra bekle turu kapatır.
  let satirlar = [];
  if (tur) {
    const bitis = Date.now() + TUR_MS;
    while (Date.now() < bitis && !fs.existsSync(DUR)) {
      satirlar = fs.readFileSync(KOMUT, "utf8").split("\n").filter(Boolean);
      if (satirlar.length) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (satirlar.length) fs.writeFileSync(KOMUT, "");
    tur = false;
  }
  for (const s of satirlar) {
    try {
      const k = JSON.parse(s);
      console.log(`SONUC ${k.arac} ${kes(metin(await rpc("tools/call", { name: k.arac, arguments: k.arg ?? {} })), 300)}`);
    } catch (e) { console.log(`SONUC-HATA ${s.slice(0, 80)} ${e.message}`); }
  }
  let t;
  try { t = metin(await rpc("tools/call", { name: "dunya_bekle", arguments: { azami_sn: 60 } })); }
  catch (e) {
    // Uzun yoklamanın zaman aşımı hata değil: sessizce yeniden bekle (olay akışı gürültülenmesin).
    if (!/timeout|zaman|cevap vermedi|aborted/i.test(e.message)) console.log(`HATA ${e.message}`);
    else if (++sessiz === 1 || sessiz % 6 === 0) console.log(`BEKLE-ZAMAN ${sessiz} ${e.message}`); // nabız: sessizlik "çalışıyor" gibi görünmesin
    await new Promise((r) => setTimeout(r, 1000)); continue;
  }
  if (ilk) { ilk = false; console.log(`OLAY (ilk, talimat var) ${kes(t, 400)}`); continue; }
  if (/^\W*quiet\b/i.test(t) || t === "") continue;
  console.log(`OLAY ${kes(t)}`);
  tur = true;
  if (/duydum[^"]*?["“'‘]\s*(dur|bitir)\s*[.!]?\s*["”'’]/i.test(t) || /"metin"\s*:\s*"\s*(dur|bitir)\s*"/i.test(t)) bitir("odada 'dur' denildi");
}
