// tools/baglam-ayiklama.mjs — Canlidaki HANGI unsur tool-call'i bastiriyor?
//
// Sonda (arac-yuzey-olcum.mjs) gosterdi ki yalitilmis halde model
// `dunya_komut` aracini 3/3 cagiriyor - tam 14 araclik yuzeyle bile.
// Demek ki arac kalabaligi sucu degil. Canlida olup sondada olmayan uc sey:
// dunya durumu oneki, uzun talimat, konusma gecmisi. Tek tek ayikliyoruz.
//
// Kullanim: node tools/baglam-ayiklama.mjs [model]

const T = (ad, aciklama, props, req) => ({
  type: "function",
  function: { name: ad, description: aciklama, parameters: { type: "object", properties: props, required: req } },
});

const ARACLAR = [
  T("dunya_komut", "Terminale komut ONER. Calismaz; Ozyn onaylarsa calisir. Tek satir.",
    { metin: { type: "string" }, gerekce: { type: "string" } }, ["metin", "gerekce"]),
  T("dunya_soyle", "Sesli konus.", { metin: { type: "string" } }, ["metin"]),
  T("dunya_git", "Bir capaya yuru.", { hedef_ad: { type: "string" } }, ["hedef_ad"]),
  T("dunya_bak", "Bir hedefe bak.", { hedef_tip: { type: "string" } }, ["hedef_tip"]),
  T("dunya_otur", "Otur.", {}, []),
  T("dunya_kalk", "Kalk.", {}, []),
  T("dunya_poz", "Durus degistir.", { poz: { type: "string" } }, ["poz"]),
  T("dunya_jest", "Jest yap.", { jest: { type: "string" } }, ["jest"]),
  T("dunya_yaz", "Tahtaya yaz.", { metin: { type: "string" } }, ["metin"]),
  T("dunya_al", "Nesne al.", { nesne: { type: "string" } }, ["nesne"]),
  T("dunya_birak", "Birak.", {}, []),
  T("dunya_odaklan", "Bir yuzeye odaklan.", { capa: { type: "string" } }, ["capa"]),
  T("dunya_dur", "Dur.", {}, []),
  T("dunya_sor", "Dunya durumunu sor.", { ne: { type: "string" } }, ["ne"]),
];

const KISA =
  "Bir odadasin. Masandaki monitorde Ozyn'in terminali var. " +
  "Duzeltme onerecegin zaman dunya_komut aracini CAGIR; komutu cumle icinde yazma. " +
  "Onerdigin komut tam ve calisabilir tek satir olsun. En fazla iki cumle konus.";

// Canlidaki talimatin (duruma gore kurulmus, terminal baglamli) esdegeri.
const UZUN =
  "Bir odadasin ve bir bedenin var. Ozyn de bu odada. " +
  "Araclarla gercekten hareket edersin. Konusmak icin dunya_soyle cagir - duz metin duyulmaz. " +
  "EN FAZLA IKI CUMLE konus. Sahne yonergesi yazma. " +
  "Yapacak bir sey yoksa sessiz kal. Tek turda bir veya iki eylem yeter. " +
  "Masandaki monitorde Ozyn'in terminali var; ekrani goruyorsun. " +
  "Komutlari OZYN yaziyor, sen degil. 'Ben komut verdim' deme. " +
  "Bir sey basarisiz olduysa dunya_soyle ile SOMUT soyle: neyin basarisiz oldugunu belirt. " +
  "Duzeltme onereceksen dunya_komut aracini CAGIR. Komutu cumle icinde yazarsan HICBIR SEY OLMAZ. " +
  "Onerdigin komut tam ve calisabilir tek satir olsun (or. `git status`), tarif etme. " +
  "Tahtaya yazmak icin once `git` ile tahtanin onune gecmelisin.";

const DUNYA =
  "Odadasin. Sen: duruyor, konum -0.4,-1.2. Ozyn 2.6m uzakta, sana bakiyor. " +
  "Ozyn senin monitorunde calisiyor.";

const GECMIS = [
  { role: "user", content: "selam orion" },
  { role: "assistant", content: "Selam Ozyn, buradayim." },
  { role: "user", content: "hava nasil" },
  { role: "assistant", content: "Pencereden bakiyorum." },
];

const GIRDI =
  "Ozyn'in terminalinde (masandaki ekran), komut HATA ile bitti (cikis kodu 1):\n" +
  "gti : The term 'gti' is not recognized as the name of a cmdlet, function, script file, or operable program.";

async function sor(model, { talimat, dunya, gecmis }) {
  const mesajlar = [{ role: "system", content: talimat }];
  if (gecmis === "aracli") mesajlar.push(...GECMIS_ARACLI);
  else if (gecmis) mesajlar.push(...GECMIS);
  mesajlar.push({ role: "user", content: dunya ? `${DUNYA}\n${GIRDI}` : GIRDI });

  const y = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, tools: ARACLAR, options: { temperature: 0.3 }, messages: mesajlar }),
  });
  const d = await y.json();
  const c = (d.message?.tool_calls ?? [])[0];
  let arg = c?.function?.arguments;
  if (typeof arg === "string") { try { arg = JSON.parse(arg); } catch { /* bos gec */ } }
  const metin = (arg && typeof arg === "object" && arg.metin ? String(arg.metin) : "") || (d.message?.content ?? "");
  return { ad: c?.function?.name ?? null, metin };
}

const model = process.argv[2] ?? "qwen2.5:7b";
const TEKRAR = 4;

console.log(`model: ${model}`);
console.log(`gorev: 'gti' yazim hatasini gor -> duzeltme komutu ONER (14 arac her kosulda ayni)\n`);

await sor(model, { talimat: KISA, dunya: false, gecmis: false }); // isinma

// HIPOTEZ: gecmiste Orion'un sozleri DUZ ASISTAN METNI olarak duruyor.
// Gercekte onlar `dunya_soyle` ARAC CAGRISIYDI. Model baglamda "asistan duz
// metin yazar" oruntusunu gorup taklit ediyor olabilir. Gecmisi DOGRU temsil
// edelim: arac cagrisi + arac sonucu ciftleri.
const GECMIS_ARACLI = [
  { role: "user", content: "selam orion" },
  { role: "assistant", content: "", tool_calls: [
    { function: { name: "dunya_soyle", arguments: { metin: "Selam Ozyn, buradayim." } } }] },
  { role: "tool", content: "bitti" },
  { role: "user", content: "hava nasil" },
  { role: "assistant", content: "", tool_calls: [
    { function: { name: "dunya_soyle", arguments: { metin: "Pencereden bakiyorum." } } }] },
  { role: "tool", content: "bitti" },
];

const KOSULLAR = [
  ["A  kisa talimat                      ", { talimat: KISA, dunya: false, gecmis: false }],
  ["B  kisa talimat + DUNYA oneki        ", { talimat: KISA, dunya: true, gecmis: false }],
  ["C  UZUN talimat                      ", { talimat: UZUN, dunya: false, gecmis: false }],
  ["D  UZUN talimat + DUNYA              ", { talimat: UZUN, dunya: true, gecmis: false }],
  ["E  UZUN + DUNYA + GECMIS (canli gibi)", { talimat: UZUN, dunya: true, gecmis: true }],
  ["F  GECMIS ARAC CAGRISI olarak       ", { talimat: UZUN, dunya: true, gecmis: "aracli" }],
];

for (const [ad, k] of KOSULLAR) {
  let cagirdi = 0;
  let ornek = "";
  for (let i = 0; i < TEKRAR; i++) {
    const r = await sor(model, k);
    if (r.ad === "dunya_komut") cagirdi++;
    if (i === 0) ornek = `${r.ad ?? "ARAC YOK"} | "${r.metin.replace(/\s+/g, " ").slice(0, 56)}"`;
  }
  console.log(`  ${ad} komut: ${cagirdi}/${TEKRAR}   ${ornek}`);
}
process.exit(0);
