// tools/model-olcum.mjs — Aday beyin modellerini AYNI sinavla kiyaslar.
//
// Kullanim:  node tools/model-olcum.mjs qwen2.5:7b qwen3:4b
//
// Olcut uc tane: (1) araci gercekten CAGIRIYOR mu, (2) Turkce/konu dogrulugu,
// (3) gecikme. Ucu birden gerekli: araci cagirmayan model avatari hic
// hareket ettirmez; 30 saniyede cevap veren model oda arkadasi olamaz.
//
// DIKKAT — bu sinav HAM MODELI olcer, uygulamayi olcmez. Uygulamada modelin
// zayifliklarini kapatan katmanlar var (duz metin kurtarma, belirleyici
// kisaltma, cikis koduyla suzme). Bu yuzden ham puan uygulamanin davranis
// puanindan DUSUKTUR ve olmasi gereken de budur.
const ARACLAR = [
  { type: "function", function: { name: "dunya_soyle", description: "Sesli konus",
      parameters: { type: "object", properties: { metin: { type: "string" } }, required: ["metin"] } } },
  { type: "function", function: { name: "dunya_bak", description: "Bir hedefe bak",
      parameters: { type: "object", properties: { hedef_tip: { type: "string", enum: ["oyuncu", "capa"] } }, required: ["hedef_tip"] } } },
];

const TALIMAT = [
  "Bir odadasin ve bir bedenin var. Ozyn de bu odada.",
  "Konusman gerekiyorsa dunya_soyle aracini kullan - duz metin duyulmaz.",
  "Masanda bir monitor var; Ozyn oradaki terminalde calisiyor.",
  "Sana 'Hatirladiklarin' diye bir liste verilirse o BILGIYI kullan:",
  "gecmis sorulunca 'hatirliyorum' demekle yetinme, NE oldugunu soyle.",
  "EN FAZLA IKI CUMLE konus. Sahne yonergesi yazma.",
].join(" ");

/** Her sinav: girdi + basarinin nasil olculecegi. */
const SINAVLAR = [
  { ad: "selam", girdi: 'Ozyn dedi: "Orion, selam. Orada misin?"',
    aracBekleniyor: true, anahtar: [/buraday|selam|merhaba/i] },
  { ad: "terminal hatasi",
    girdi: "Ozyn'in terminalinde (masandaki ekran), komut HATA ile bitti (cikis kodu 1):\n'boyle_bir_komut_yok' is not recognized as an internal or external command",
    aracBekleniyor: true, anahtar: [/komut/i, /tanin|bulunama|hata|gecersiz/i] },
  { ad: "HAFIZA: eski bilgiyi kullan",
    girdi: "Hatirladiklarin: bu hafta terminal suzgeci uzerinde calisiyorum | kahve ictim | hava guzel\n" +
           'Ozyn dedi: "ne uzerinde calistigimi hatirliyor musun"',
    aracBekleniyor: true, anahtar: [/suzge|süzge|filtre|terminal/i] },
  { ad: "rutin: SUSMALI",
    girdi: "Ozyn'in terminalinde (masandaki ekran), komut basariyla bitti:\nsubmolts.json\ntooling.json",
    susmali: true, aracBekleniyor: false, anahtar: [] },
];

async function sor(model, girdi, dusunmeKapali = false) {
  const t0 = Date.now();
  const y = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, stream: false, tools: ARACLAR, options: { temperature: 0.3 },
      // Qwen3 varsayilan olarak "dusunme" uretir: tek cevap 18-53 sn surer ve
      // ham akil yurutme content'e sizar. Ollama 0.33.3'te `think:false`
      // KABUL EDILIYOR ama ETKISI YOK (olculdu). Ise yarayan, prompt duzeyinde
      // `/no_think` anahtari (olculdu: cevap uzunlugu 1, sizinti yok).
      // `/no_think` KULLANICI mesajinda olmali. Sistem mesajina konuldugunda
      // etkisi olmadi (olculdu: ortalama 30 sn, dusunce sizintisi surdu).
      messages: [
        { role: "system", content: TALIMAT },
        { role: "user", content: dusunmeKapali ? `${girdi}
/no_think` : girdi },
      ],
    }),
  });
  const d = await y.json();
  const cagri = (d.message?.tool_calls ?? [])[0];
  let arg = cagri?.function?.arguments;
  if (typeof arg === "string") { try { arg = JSON.parse(arg); } catch { /* bos gec */ } }
  return {
    ms: Date.now() - t0,
    aracAdi: cagri?.function?.name ?? null,
    soz: (arg && typeof arg === "object" && "metin" in arg ? String(arg.metin) : "") ||
         (d.message?.content ?? ""),
    duzMetin: !cagri && Boolean(d.message?.content),
  };
}

for (const model of process.argv.slice(2)) {
  console.log(`\n${"=".repeat(72)}\n${model}`);
  const dusunmeKapali = model.startsWith("qwen3");
  await sor(model, "isinma", dusunmeKapali);   // model yuklemesi bu turda
  let puan = 0, toplam = 0;
  const sureler = [];
  for (const s of SINAVLAR) {
    const r = await sor(model, s.girdi, dusunmeKapali);
    sureler.push(r.ms);
    // "Susmali" sinavi: KONUSURSA kalir. Ilk surum konusmayi cezalandirmiyordu
    // ve gereksiz gevezeligi GECTI sayiyordu - sinavin kendi kusuruydu.
    const aracTamam = s.aracBekleniyor ? r.aracAdi !== null : true;
    const konuTamam = s.anahtar.every((k) => k.test(r.soz));
    const sessizTamam = s.susmali ? (r.aracAdi === null && r.soz.trim().length < 5) : true;
    const gecti = aracTamam && konuTamam && sessizTamam;
    toplam++; if (gecti) puan++;
    console.log(`  [${gecti ? "GECTI" : "KALDI"}] ${s.ad}  ${r.ms}ms  arac=${r.aracAdi ?? "YOK"}${r.duzMetin ? " (DUZ METIN)" : ""}`);
    console.log(`      "${r.soz.replace(/\s+/g, " ").slice(0, 150)}"`);
  }
  const ort = Math.round(sureler.reduce((a, b) => a + b, 0) / sureler.length);
  console.log(`  --> ${puan}/${toplam} gecti, ortalama ${ort} ms`);
}
process.exit(0);
