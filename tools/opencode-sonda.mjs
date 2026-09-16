// tools/opencode-sonda.mjs — OpenCode'u Orion'un DUSUNCE beyni olarak sinar.
//
// Olculen: (1) calisiyor mu, (2) gecikme, (3) Turkce kalitesi,
// (4) talimata uyuyor mu (iki cumle, sahne yonergesi yok).
//
// NOT: burada arac cagrisi OLCULMEZ. OpenCode'un kendi araclari var; Orion'un
// dunya araclari ona MCP ile verilecek (ayri adim). Bu sonda once "dusunme ve
// konusma" katmanini olcer.
//
// Kullanim: node tools/opencode-sonda.mjs [providerID] [modelID]

const SUNUCU = process.env.OPENCODE_SUNUCU ?? "http://127.0.0.1:4096";
const providerID = process.argv[2] ?? "openrouter";
const modelID = process.argv[3] ?? "inclusionai/ling-3.0-flash-vl:free";

const TALIMAT =
  "Sen Orion'sun: bir odada bedeni olan bir yapay zekasin. Ozyn de bu odada. " +
  "Masandaki monitorde Ozyn'in terminali var, ekrani goruyorsun. " +
  "TURKCE konus. EN FAZLA IKI CUMLE. Sahne yonergesi yazma (-boyle- veya *boyle* kullanma). " +
  "Kod yazma, dosya duzenleme, arac kullanma - sadece konus.";

const SENARYOLAR = [
  { ad: "selam",
    girdi: 'Ozyn dedi: "Orion, selam. Orada misin?"' },
  { ad: "terminal hatasi",
    girdi: "Ozyn'in terminalinde (masandaki ekran), komut HATA ile bitti (cikis kodu 1):\n" +
           "gti : The term 'gti' is not recognized as the name of a cmdlet.\n" +
           "Ne oldugunu kisaca soyle ve duzeltmeyi oner." },
  { ad: "hafizadan hatirlama",
    girdi: "Hatirladiklarin: bu hafta terminal suzgeci uzerinde calisiyorum | kahve ictim\n" +
           'Ozyn dedi: "ne uzerinde calistigimi hatirliyor musun"' },
];

async function istek(yol, secenek = {}) {
  const y = await fetch(`${SUNUCU}${yol}`, {
    headers: { "Content-Type": "application/json" },
    ...secenek,
  });
  const metin = await y.text();
  if (!y.ok) throw new Error(`${yol} -> ${y.status}: ${metin.slice(0, 200)}`);
  return metin ? JSON.parse(metin) : null;
}

/** Yanit parcalarindan okunabilir metni cikarir. */
function metniTopla(yanit) {
  const parcalar = yanit?.parts ?? yanit?.message?.parts ?? [];
  const yazilar = [];
  for (const p of Array.isArray(parcalar) ? parcalar : []) {
    if (p?.type === "text" && typeof p.text === "string") yazilar.push(p.text);
  }
  if (yazilar.length === 0 && typeof yanit?.text === "string") yazilar.push(yanit.text);
  return yazilar.join(" ").trim();
}

console.log(`sunucu : ${SUNUCU}`);
console.log(`model  : ${providerID}/${modelID}\n`);

let oturum;
try {
  oturum = await istek("/session", { method: "POST", body: JSON.stringify({}) });
} catch (e) {
  console.error("oturum acilamadi:", e.message);
  process.exit(1);
}
const oturumID = oturum.id ?? oturum.sessionID;
console.log(`oturum : ${oturumID}\n`);

let toplamMs = 0, basarili = 0;
for (const s of SENARYOLAR) {
  const t0 = Date.now();
  try {
    const yanit = await istek(`/session/${oturumID}/message`, {
      method: "POST",
      body: JSON.stringify({
        model: { providerID, modelID },
        system: TALIMAT,
        // OpenCode'un kendi araclarini KAPAT: bu sonda yalnizca konusmayi olcer.
        tools: { bash: false, edit: false, write: false, read: false, glob: false, grep: false },
        parts: [{ type: "text", text: s.girdi }],
      }),
    });
    const ms = Date.now() - t0;
    toplamMs += ms;
    const metin = metniTopla(yanit).replace(/\s+/g, " ");
    const cumle = (metin.match(/[.!?]/g) ?? []).length;
    const sahne = /[-*][^-*\n]{3,}[-*]/.test(metin);
    const turkce = /[çğıöşüÇĞİÖŞÜ]/.test(metin);
    if (metin) basarili++;
    console.log(`  ${s.ad.padEnd(20)} ${String(ms).padStart(6)}ms  cumle=${cumle} turkce=${turkce ? "evet" : "HAYIR"} sahne=${sahne ? "VAR" : "yok"}`);
    console.log(`     "${metin.slice(0, 150)}"`);
  } catch (e) {
    console.log(`  ${s.ad.padEnd(20)} HATA: ${e.message.slice(0, 160)}`);
  }
}
console.log(`\n  ortalama ${Math.round(toplamMs / SENARYOLAR.length)}ms, yanit veren ${basarili}/${SENARYOLAR.length}`);
process.exit(0);
