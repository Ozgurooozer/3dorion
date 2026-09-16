// tools/baglam-olcum.mjs — Isteğimiz kaç token ve bağlam penceresi yetiyor mu?
//
// BULGU (ollama ps): model 32768 destekliyor ama Ollama 4096 ile çalıştırıyor.
// Ollama sınırı aşan bağlamı BAŞTAN kırpar — yani sistem mesajı ve araç
// tanımları sessizce buharlaşabilir. Canlıda görülen bozuk araç adları
// (`orld`, `orlda_komut`) tam da hasarlı bağlamın imzası.
//
// Bu araç: gerçek isteğin token sayısını ölçer ve farklı num_ctx değerlerinde
// davranışı karşılaştırır.
//
// Kullanim: node tools/baglam-olcum.mjs [model]

const T = (ad, aciklama, props, req) => ({
  type: "function",
  function: { name: ad, description: aciklama, parameters: { type: "object", properties: props, required: req } },
});

const ARACLAR = [
  T("dunya_poz", "Duruşu değiştir. Bir seferde tek poz geçerli.", { poz: { type: "string", enum: ["duruyor", "oturuyor", "yatıyor", "eğiliyor", "yürüyor", "koşuyor", "bakıyor"] } }, ["poz"]),
  T("dunya_jest", "Anlık jest oynat. Pozu bozmaz, üstüne biner.", { jest: { type: "string", enum: ["el_salliyor", "başını_sallıyor", "omuz_silkiyor", "işaret_ediyor", "gülümsüyor", "kaş_çatıyor", "el_açıyor", "bekliyor"] }, hedef: { type: "object" } }, ["jest"]),
  T("dunya_bak", "Başını/gövdeni hedefe çevir. Hedef verilmezse serbest bakışa döner.", { hedef: { type: "object" } }, []),
  T("dunya_git", "Hedefe yürü. Mesafe, hedefin kaç metre yakınında duracağın.", { hedef: { type: "object" }, mesafe: { type: "number" } }, ["hedef"]),
  T("dunya_otur", "Belirtilen çapaya otur (varsayılan sandalye).", { capa: { type: "string" } }, []),
  T("dunya_kalk", "Ayağa kalk.", {}, []),
  T("dunya_soyle", "Konuş. Dünya bunu altyazıya ve TTS'e verir, ağız senkronunu tetikler.", { metin: { type: "string" }, ses: { type: "boolean" } }, ["metin"]),
  T("dunya_komut", "Terminale bir komut ÖNER. Komut ÇALIŞMAZ — ekranda Ozyn'e gösterilir, yalnızca o onaylarsa çalışır. Tek satır olmalı. gerekce zorunludur: neden bu komut? Gerekçesiz öneriler reddedilir. Reddedilirse ısrar etme.", { metin: { type: "string" }, gerekce: { type: "string" } }, ["metin", "gerekce"]),
  T("dunya_yaz", "Beyaz tahtaya yaz. Tahtanın önünde değilsen önce oraya gitmen gerekir.", { metin: { type: "string" }, temizle: { type: "boolean" } }, ["metin"]),
  T("dunya_al", "Nesneyi eline al.", { nesne: { type: "string" } }, ["nesne"]),
  T("dunya_birak", "Elindekini bırak.", {}, []),
  T("dunya_odaklan", "Dikkatini bir yüzeye ver (monitör, tahta).", { capa: { type: "string" } }, ["capa"]),
  T("dunya_dur", "Yürüyen/oynayan her şeyi kes. Acil durdurma.", {}, []),
  T("dunya_sor", "Salt-okunur sorgu: dünya durumunu iste.", { ne: { type: "string", enum: ["dunya", "yakin", "oyuncu"] } }, ["ne"]),
];

const TALIMAT =
  "Bir odadasın ve bir bedenin var. Ozyn de bu odada. Araçlarla gerçekten hareket edersin. " +
  "Konuşmak için dunya_soyle çağır — düz metin duyulmaz. EN FAZLA İKİ CÜMLE konuş. Sahne yönergesi yazma. " +
  "Yapacak bir şey yoksa sessiz kal. Tek turda bir veya iki eylem yeter. " +
  "Masandaki monitörde Ozyn'in terminali var; ekranı görüyorsun. Komutları OZYN yazıyor, sen değil. " +
  "Bir şey başarısız olduysa dunya_soyle ile SOMUT söyle. " +
  "Düzeltme önereceksen dunya_komut aracını ÇAĞIR. Komutu cümle içinde yazarsan HİÇBİR ŞEY OLMAZ. " +
  "Önerdiğin komut tam ve çalışabilir tek satır olsun (ör. `git status`), tarif etme. " +
  "Tahtaya yazmak için önce `git` ile tahtanın önüne geçmelisin.\n" +
  "Odadaki çapalar: masa, monitor, sandalye, tahta, pencere, kapi, oda_ortasi.";

const GECMIS = [
  { role: "user", content: "selam orion" },
  { role: "assistant", content: "", tool_calls: [{ function: { name: "dunya_soyle", arguments: { metin: "Selam Ozyn, buradayım." } } }] },
  { role: "tool", content: "bitti" },
  { role: "user", content: "hava nasil" },
  { role: "assistant", content: "", tool_calls: [{ function: { name: "dunya_soyle", arguments: { metin: "Pencereden bakıyorum." } } }] },
  { role: "tool", content: "bitti" },
  { role: "user", content: "tahtaya bir not yaz" },
  { role: "assistant", content: "", tool_calls: [{ function: { name: "dunya_yaz", arguments: { metin: "not" } } }] },
  { role: "tool", content: "bitti" },
];

const GIRDI =
  "Sen: duruyor, konum 0.9,-1.2. Ozyn 5.6m uzakta, sana bakiyor.\n" +
  "Ozyn'in terminalinde (masandaki ekran), komut HATA ile bitti (çıkış kodu 1):\n" +
  "PS C:\\Users\\ozigo> gti status\n" +
  "gti : The term 'gti' is not recognized as the name of a cmdlet, function, script file,\n" +
  "or operable program. Check the spelling of the name, or if a path was included, verify\n" +
  "that the path is correct and try again.\n" +
  "At line:1 char:1\n+ gti status\n+ ~~~\n" +
  "    + CategoryInfo          : ObjectNotFound: (gti:String) [], CommandNotFoundException\n" +
  "    + FullyQualifiedErrorId : CommandNotFoundException";

// TEK ORNEK (few-shot): dogru davranisin bir gosterimi. Canlida terminal
// hatasi cogu zaman HICBIR konusma olmadan gelir, yani gecmis BOSTUR -
// olcumde en zayif kosul tam olarak buydu (1/3 ve Cince'ye kayma).
const ORNEK = [
  { role: "user", content:
    "Ozyn'in terminalinde (masandaki ekran), komut HATA ile bitti (çıkış kodu 1):\n" +
    "pyhton : The term 'pyhton' is not recognized as the name of a cmdlet." },
  { role: "assistant", content: "", tool_calls: [
    { function: { name: "dunya_komut", arguments: {
      metin: "python --version",
      gerekce: "'pyhton' yazim hatasi; dogrusu 'python'" } } }] },
  { role: "tool", content: "bitti" },
];

async function sor(model, { ctx, gecmis, ornek }) {
  const mesajlar = [{ role: "system", content: TALIMAT }];
  if (ornek) mesajlar.push(...ORNEK);
  if (gecmis) mesajlar.push(...GECMIS);
  mesajlar.push({ role: "user", content: GIRDI });

  const secenek = { temperature: 0.3 };
  if (ctx) secenek.num_ctx = ctx;

  const t0 = Date.now();
  const y = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, tools: ARACLAR, options: secenek, messages: mesajlar }),
  });
  const d = await y.json();
  const c = (d.message?.tool_calls ?? [])[0];
  let arg = c?.function?.arguments;
  if (typeof arg === "string") { try { arg = JSON.parse(arg); } catch { /* bos gec */ } }
  return {
    ms: Date.now() - t0,
    istemToken: d.prompt_eval_count ?? 0,
    ad: c?.function?.name ?? null,
    metin: (arg && typeof arg === "object" && arg.metin ? String(arg.metin) : "") || (d.message?.content ?? ""),
  };
}

const model = process.argv[2] ?? "qwen2.5:7b";
console.log(`model: ${model}\n`);

const KOSULLAR = [
  ["gecmis YOK (canlidaki ilk tur)   ", { gecmis: false, ornek: false }],
  ["gecmis VAR                       ", { gecmis: true, ornek: false }],
  ["ORNEK var, gecmis YOK            ", { gecmis: false, ornek: true }],
  ["ORNEK + gecmis                   ", { gecmis: true, ornek: true }],
];

for (const [ad, k] of KOSULLAR) {
  let cagirdi = 0, ornek = "", token = 0, sure = 0;
  for (let i = 0; i < 4; i++) {
    const r = await sor(model, k);
    token = r.istemToken; sure += r.ms;
    if (r.ad === "dunya_komut") cagirdi++;
    if (i === 0) ornek = `${r.ad ?? "ARAC YOK"} | "${r.metin.replace(/\s+/g, " ").slice(0, 44)}"`;
  }
  console.log(`  ${ad} istem=${String(token).padStart(5)} tok  komut:${cagirdi}/4  ${Math.round(sure / 4)}ms  ${ornek}`);
}
process.exit(0);
