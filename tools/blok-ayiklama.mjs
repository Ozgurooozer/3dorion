// tools/blok-ayiklama.mjs — Sonda 4/4 veriyor, CANLI 0/3. Fark nerede?
//
// Onceki ayiklama (baglam-ayiklama.mjs) gecmisi sucladi ve gecmis kaldirildi;
// canlida yine olmadi. Canli turun girdisi olculdu:
//   ozet=1 ani=0 gecmis=0 talimat=710ch  -> sondadaki D kosulunun AYNISI
// Geriye tek belirgin fark kaldi: sondaya TEK SATIRLIK temiz hata verdim,
// canlida PowerShell'in 10 SATIRLIK dagitik blogu gidiyor.
//
// Kullanim: node tools/blok-ayiklama.mjs [model]

const T = (ad, aciklama, props, req) => ({
  type: "function",
  function: { name: ad, description: aciklama, parameters: { type: "object", properties: props, required: req } },
});

// Canlidaki ARAC ACIKLAMALARININ birebir esdegeri (bridge/araclar.ts).
const ARACLAR = [
  T("dunya_komut",
    "Terminale bir komut ONER. Komut CALISMAZ - ekranda Ozyn'e gosterilir, " +
    "yalnizca o onaylarsa calisir. Tek satir olmali. `gerekce` zorunludur: " +
    "neden bu komut? Gerekcesiz oneriler reddedilir. Reddedilirse israr etme.",
    { metin: { type: "string" }, gerekce: { type: "string" } }, ["metin", "gerekce"]),
  T("dunya_soyle", "Sesli konus. Dunya bunu altyaziya ve TTS'e verir.", { metin: { type: "string" } }, ["metin"]),
  T("dunya_git", "Bir capaya yuru.", { hedef_ad: { type: "string" } }, ["hedef_ad"]),
  T("dunya_bak", "Basini/govdeni hedefe cevir.", { hedef_tip: { type: "string" } }, ["hedef_tip"]),
  T("dunya_otur", "Sandalyeye otur.", {}, []),
  T("dunya_kalk", "Ayaga kalk.", {}, []),
  T("dunya_poz", "Durusu degistir.", { poz: { type: "string" } }, ["poz"]),
  T("dunya_jest", "Anlik jest oynat.", { jest: { type: "string" } }, ["jest"]),
  T("dunya_yaz", "Beyaz tahtaya yaz.", { metin: { type: "string" } }, ["metin"]),
  T("dunya_al", "Nesneyi eline al.", { nesne: { type: "string" } }, ["nesne"]),
  T("dunya_birak", "Elindekini birak.", {}, []),
  T("dunya_odaklan", "Bir yuzeye odaklan.", { capa: { type: "string" } }, ["capa"]),
  T("dunya_dur", "Her seyi kes.", {}, []),
  T("dunya_sor", "Dunya durumunu sor.", { ne: { type: "string" } }, ["ne"]),
];

const TALIMAT =
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

const ONEK = "Ozyn'in terminalinde (masandaki ekran), komut HATA ile bitti (cikis kodu 1):";

// 1) Sondada kullandigim TEMIZ tek satir.
const TEK_SATIR = `${ONEK}\ngti : The term 'gti' is not recognized as the name of a cmdlet, function, script file, or operable program.`;

// 2) CANLIDA giden gercekci PowerShell blogu: istem satiri, sarilmis hata,
//    konum satiri, isaretci, CategoryInfo, FullyQualifiedErrorId, yeni istem.
const TAM_BLOK = `${ONEK}
PS C:\\Users\\ozigo> gti status
gti : The term 'gti' is not recognized as the name of a cmdlet, function, script file,
or operable program. Check the spelling of the name, or if a path was included, verify
that the path is correct and try again.
At line:1 char:1
+ gti status
+ ~~~
    + CategoryInfo          : ObjectNotFound: (gti:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException

PS C:\\Users\\ozigo>`;

// 3) Ozetlenmis blok: ilk anlamli hata satiri + son satir.
const OZETLI = `${ONEK}
gti : The term 'gti' is not recognized as the name of a cmdlet, function, script file, or operable program.`;

// Canlida sistem mesajina EKLENEN sabit bilgi (giris.ts sabitBilgi).
const CAPALAR = "Odadaki capalar: masa, sandalye, tahta, pencere, kapi, oda_ortasi, monitor.";

async function sor(model, girdi, capaEkle = false) {
  const y = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, stream: false, tools: ARACLAR, options: { temperature: 0.3 },
      messages: [
        { role: "system", content: capaEkle ? `${TALIMAT}
${CAPALAR}` : TALIMAT },
        { role: "user", content: `${DUNYA}\n${girdi}` },
      ],
    }),
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
console.log(`model: ${model}\ngorev: 'gti' hatasi -> dunya_komut ile duzeltme oner\n`);
await sor(model, TEK_SATIR);

for (const [ad, girdi, capa] of [
  ["1) TEK SATIR (sondadaki)      ", TEK_SATIR, false],
  ["2) TAM BLOK (canlidaki)       ", TAM_BLOK, false],
  ["3) OZETLI blok                ", OZETLI, false],
  ["4) TAM BLOK + CAPA LISTESI    ", TAM_BLOK, true],
  ["5) TEK SATIR + CAPA LISTESI   ", TEK_SATIR, true],
]) {
  let cagirdi = 0, ornek = "";
  for (let i = 0; i < TEKRAR; i++) {
    const r = await sor(model, girdi, capa);
    if (r.ad === "dunya_komut") cagirdi++;
    if (i === 0) ornek = `${r.ad ?? "ARAC YOK"} | "${r.metin.replace(/\s+/g, " ").slice(0, 50)}"`;
  }
  console.log(`  ${ad} komut: ${cagirdi}/${TEKRAR}   ${ornek}`);
}
process.exit(0);
