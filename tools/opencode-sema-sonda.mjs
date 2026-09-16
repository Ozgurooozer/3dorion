// tools/opencode-sema-sonda.mjs — YAPISAL CIKTI gercekten calisiyor mu?
//
// Canlida `format: json_schema` ile istek 30 sn'de zaman asimina ugradi.
// Uygulamadan bagimsiz olcelim: sema var/yok, retry var/yok karsilastirmasi.
//
// Kullanim: node tools/opencode-sema-sonda.mjs [modelID]

const SUNUCU = process.env.OPENCODE_SUNUCU ?? "http://127.0.0.1:4096";
const providerID = "openrouter";
const modelID = process.argv[2] ?? "inclusionai/ling-3.0-flash-vl:free";

const ARAC_ADLARI = [
  "dunya_soyle", "dunya_komut", "dunya_git", "dunya_bak", "dunya_yaz",
  "dunya_jest", "dunya_otur", "dunya_kalk", "dunya_poz", "dunya_al",
  "dunya_birak", "dunya_odaklan", "dunya_dur", "dunya_sor",
];

const SEMA = {
  type: "object",
  properties: {
    cagrilar: {
      type: "array",
      description: "Dunyada yapilacak eylemler. Yapacak bir sey yoksa bos dizi.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", enum: ARAC_ADLARI },
          arguments: { type: "object", additionalProperties: true },
        },
        required: ["name", "arguments"],
      },
    },
  },
  required: ["cagrilar"],
};

const SISTEM =
  "Sen Orion'sun. Ozyn'in odasinda bir bedenin var. Masandaki monitorde Ozyn calisiyor. " +
  "Konusmak bir eylemdir: dunya_soyle. Duzeltme onerecegin zaman dunya_komut. " +
  "EN FAZLA IKI CUMLE. Cevabini YALNIZCA verilen JSON semasina gore ver.";

const GIRDI =
  "Ozyn'in terminalinde (masandaki ekran), komut HATA ile bitti (cikis kodu 1):\n" +
  "gti : The term 'gti' is not recognized as the name of a cmdlet.";

async function oturumAc() {
  const y = await fetch(`${SUNUCU}/session`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  const j = await y.json();
  return j.id ?? j.sessionID;
}

async function dene(ad, oturum, ek, zamanAsimiMs) {
  const c = new AbortController();
  const saat = setTimeout(() => c.abort(), zamanAsimiMs);
  const t0 = Date.now();
  try {
    const y = await fetch(`${SUNUCU}/session/${oturum}/message`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: c.signal,
      body: JSON.stringify({
        model: { providerID, modelID },
        system: SISTEM,
        tools: { bash: false, edit: false, write: false, read: false, glob: false, grep: false, webfetch: false },
        parts: [{ type: "text", text: GIRDI }],
        ...ek,
      }),
    });
    const t = await y.text();
    const ms = Date.now() - t0;

    let j = null;
    try { j = JSON.parse(t); } catch { /* ham birak */ }
    const parcalar = j?.parts ?? j?.message?.parts ?? [];
    const metin = (Array.isArray(parcalar) ? parcalar : [])
      .filter((p) => p?.type === "text").map((p) => p.text).join(" ").trim();
    console.log(`  ${ad.padEnd(26)} ${String(ms).padStart(6)} ms  http=${y.status}`);
    console.log(`     "${(metin || t).replace(/\s+/g, " ").slice(0, 150)}"`);
  } catch (e) {
    console.log(`  ${ad.padEnd(26)} ${String(Date.now() - t0).padStart(6)} ms  HATA: ${e.name}`);
  } finally {
    clearTimeout(saat);
  }
}

const oturum = await oturumAc();
console.log(`model: ${modelID}\noturum: ${oturum}\n`);

await dene("1) sema YOK", oturum, {}, 60_000);
await dene("2) sema VAR, retry yok", oturum, { format: { type: "json_schema", schema: SEMA } }, 60_000);
await dene("3) sema VAR, retry=2", oturum, { format: { type: "json_schema", schema: SEMA, retryCount: 2 } }, 90_000);
process.exit(0);
