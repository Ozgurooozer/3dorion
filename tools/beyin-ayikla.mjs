// tools/beyin-ayikla.mjs — Electron günlüğünden FIXTURE üretir.
//
// `KayitBeyni` her turu `[BEYIN:KAYIT] {json}` satırı olarak konsola basar;
// Electron renderer konsolunu ana sürece taşıdığı için bu satırlar günlüğe
// düşer. Bu araç onları ayıklayıp `fixtures/beyin/` altına tek tek JSON
// dosyası olarak yazar.
//
// Kullanım:
//   3dorion.bat ... > gunluk.txt          (ORION_KAYIT=1 ile)
//   node tools/beyin-ayikla.mjs gunluk.txt
//
// Sonra: node --experimental-strip-types tools/beyin-tekrar.ts
import fs from "node:fs";
import path from "node:path";

const ONEK = "[BEYIN:KAYIT]";
const kaynak = process.argv[2];
const hedef = process.argv[3] ?? "fixtures/beyin";

if (!kaynak) {
  console.error("kullanim: node tools/beyin-ayikla.mjs <gunluk.txt> [hedef-klasor]");
  process.exit(2);
}

const metin = fs.readFileSync(kaynak, "utf8");
fs.mkdirSync(hedef, { recursive: true });

let bulunan = 0, bozuk = 0, yazilan = 0;
for (const satir of metin.split(/\r?\n/)) {
  const i = satir.indexOf(ONEK);
  if (i < 0) continue;
  bulunan++;
  const ham = satir.slice(i + ONEK.length).trim();

  let kayit;
  try { kayit = JSON.parse(ham); }
  catch { bozuk++; continue; }

  // Hata kayıtlarının da girdisi değerlidir (beynin patladığı girdi), ama
  // `girdi` alanı yoksa fixture olarak işe yaramaz.
  if (!kayit?.girdi) { bozuk++; continue; }

  const ad = `${String(kayit.sira ?? yazilan + 1).padStart(3, "0")}-${etiket(kayit)}.json`;
  fs.writeFileSync(path.join(hedef, ad), JSON.stringify(kayit, null, 2), "utf8");
  yazilan++;
}

/** Dosya adına anlamlı bir ek: hangi durumu yakaladığı okunabilsin. */
function etiket(k) {
  if (k.hata) return "hata";
  const adlar = (k.cikti?.cagrilar ?? []).map((c) => c.ad?.replace(/^dunya_/, "")).filter(Boolean);
  if (adlar.length) return adlar.join("-").slice(0, 40);
  return "sessiz";
}

console.log(`gunluk: ${kaynak}`);
console.log(`bulunan kayit satiri: ${bulunan}`);
console.log(`yazilan fixture: ${yazilan}  ${bozuk ? `(bozuk/atlanan: ${bozuk})` : ""}`);
console.log(`hedef: ${hedef}`);
if (yazilan === 0) {
  console.log("\nHic kayit yok. ORION_KAYIT=1 ile kostugundan emin ol.");
  process.exit(1);
}
