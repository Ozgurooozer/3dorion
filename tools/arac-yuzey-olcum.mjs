// tools/arac-yuzey-olcum.mjs — HIPOTEZ: arac yuzeyi kalabaligi tool-call'i bastiriyor mu?
// Ayni gorev, ayni model, YALNIZCA arac sayisi degisiyor.
const T = (ad, aciklama, props, req) => ({ type: "function", function: { name: ad, description: aciklama,
  parameters: { type: "object", properties: props, required: req } } });

const KOMUT = T("dunya_komut", "Terminale komut ONER. Calismaz; Ozyn onaylarsa calisir. Tek satir.",
  { metin: { type: "string" }, gerekce: { type: "string" } }, ["metin", "gerekce"]);
const SOYLE = T("dunya_soyle", "Sesli konus.", { metin: { type: "string" } }, ["metin"]);
const DOLGU = [
  T("dunya_git", "Bir capaya yuru.", { hedef_ad: { type: "string" } }, ["hedef_ad"]),
  T("dunya_bak", "Bir hedefe bak.", { hedef_tip: { type: "string" } }, ["hedef_tip"]),
  T("dunya_otur", "Otur.", {}, []),
  T("dunya_kalk", "Kalk.", {}, []),
  T("dunya_poz", "Duruş degistir.", { poz: { type: "string" } }, ["poz"]),
  T("dunya_jest", "Jest yap.", { jest: { type: "string" } }, ["jest"]),
  T("dunya_yaz", "Tahtaya yaz.", { metin: { type: "string" } }, ["metin"]),
  T("dunya_al", "Nesne al.", { nesne: { type: "string" } }, ["nesne"]),
  T("dunya_birak", "Birak.", {}, []),
  T("dunya_odaklan", "Bir yuzeye odaklan.", { capa: { type: "string" } }, ["capa"]),
  T("dunya_dur", "Dur.", {}, []),
  T("dunya_sor", "Dunya durumunu sor.", { ne: { type: "string" } }, ["ne"]),
];

const TALIMAT =
  "Bir odadasin. Masandaki monitorde Ozyn'in terminali var. " +
  "Duzeltme onerecegin zaman dunya_komut aracini CAGIR; komutu cumle icinde yazma. " +
  "Onerdigin komut tam ve calisabilir tek satir olsun. En fazla iki cumle konus.";

const GIRDI =
  "Ozyn'in terminalinde (masandaki ekran), komut HATA ile bitti (cikis kodu 1):\n" +
  "gti : The term 'gti' is not recognized as the name of a cmdlet, function, script file, or operable program.";

async function dene(model, araclar) {
  const t0 = Date.now();
  const y = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, tools: araclar, options: { temperature: 0.3 },
      messages: [{ role: "system", content: TALIMAT }, { role: "user", content: GIRDI }] }),
  });
  const d = await y.json();
  const c = (d.message?.tool_calls ?? [])[0];
  let arg = c?.function?.arguments;
  if (typeof arg === "string") { try { arg = JSON.parse(arg); } catch {} }
  return { ms: Date.now() - t0, ad: c?.function?.name ?? null,
           metin: (arg && typeof arg === "object" ? (arg.metin ?? "") : "") || (d.message?.content ?? "") };
}

const model = process.argv[2] ?? "qwen2.5:7b";
const kumeler = [
  ["SADECE komut (1 arac)", [KOMUT]],
  ["komut + soyle (2 arac)", [KOMUT, SOYLE]],
  ["komut + soyle + 4 dolgu (6)", [KOMUT, SOYLE, ...DOLGU.slice(0, 4)]],
  ["TAM yuzey (14 arac)", [KOMUT, SOYLE, ...DOLGU]],
];
console.log(`model: ${model}\ngorev: yazim hatali komut -> duzeltme oner\n`);
await dene(model, [SOYLE]);  // isinma
for (const [ad, ar] of kumeler) {
  let basari = 0; const sureler = [];
  for (let i = 0; i < 3; i++) {
    const r = await dene(model, ar);
    sureler.push(r.ms);
    if (r.ad === "dunya_komut") basari++;
    if (i === 0) console.log(`  ${ad.padEnd(30)} ilk: arac=${r.ad ?? "YOK"} "${String(r.metin).replace(/\s+/g," ").slice(0,70)}"`);
  }
  const ort = Math.round(sureler.reduce((a, b) => a + b, 0) / sureler.length);
  console.log(`  ${ad.padEnd(30)} dunya_komut cagrildi: ${basari}/3   ort ${ort}ms\n`);
}
process.exit(0);
