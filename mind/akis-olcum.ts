// mind/akis-olcum.ts — GERÇEK terminal çıktısıyla uçtan uca süzgeç ölçümü.
//
// refleks-olcum.ts'in kusuru şuydu: sınavı da cevap anahtarını da ben yazdım,
// üstelik henüz BAĞLI OLMAYAN bir akış için. Bu dosya o kusuru kapatır:
//   - Girdi uydurma değil: bu makinede gerçekten koşturulmuş komutların çıktısı.
//   - Metrik "benim etiketime göre doğruluk" değil, ölçülebilir bir davranış:
//     "bu komut beyni KAÇ KEZ uyandırır?"
//
// Çünkü asıl zarar yanlış etiket değil, BOĞULMA: her uyandırma qwen2.5:7b'de
// saniyelerce süren bir araç turu demek. Ozyn'e cevap veremeyen bir Orion,
// npm loglarını düşünüyor olabilir.
//
// Koşum:  node --experimental-strip-types mind/akis-olcum.ts <yakalama-dizini>
"use strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ciktiFarki } from "../world/surfaces/ciktiFarki.ts";
import { CiktiToplayici } from "../world/surfaces/ciktiToplayici.ts";
import { KuralRefleksi } from "./refleks.ts";

/** Monitörün satır sayısı (world/surfaces/monitor.ts ROWS ile aynı). */
const ROWS = 24;
/** Kaç satırda bir örnekleme yapıldığını taklit eder (~1 Hz akan çıktı). */
const ORNEK_ARALIK_SATIR = 6;

/** Satırlar arası gerçekçi akış hızı (ms). Komut akarken satırlar hızlı gelir. */
const SATIR_ARALIK_MS = 12;

/**
 * Gerçek pipeline taklidi — TAM hat:
 *   satır akışı → 24 satırlık pencere → ciktiFarki → CiktiToplayici → süzgeç
 *
 * `toplayiciyla=false` ise toplayıcı atlanır; ilk ölçümdeki (parça başına
 * karar) davranış elde edilir. İkisini yan yana koymak, düzeltmenin
 * işe yarayıp yaramadığını İDDİA etmek yerine GÖSTERİR.
 */
function beyneUlasanlar(tamCikti: string, toplayiciyla: boolean): string[] {
  const satirlar = tamCikti.split("\n");
  const pencere: string[] = [];
  let sonKuyruk = "";
  const cikti: string[] = [];
  const toplayici = new CiktiToplayici({ sessizlikMs: 800, azamiBekleyisMs: 8000, azamiSatir: 16 });
  let ms = 0;

  for (let i = 0; i < satirlar.length; i++) {
    pencere.push(satirlar[i] ?? "");
    if (pencere.length > ROWS) pencere.shift();
    ms += SATIR_ARALIK_MS;

    const sonMu = i === satirlar.length - 1;
    if ((i + 1) % ORNEK_ARALIK_SATIR === 0 || sonMu) {
      const kuyruk = pencere.join("\n");
      const fark = ciktiFarki(sonKuyruk, kuyruk);
      sonKuyruk = kuyruk;
      if (!fark.trim()) continue;
      if (toplayiciyla) {
        toplayici.ekle(fark, ms);
        const blok = toplayici.topla(ms);
        if (blok) cikti.push(blok);
      } else {
        cikti.push(fark);
      }
    }
  }
  // Komut bitti: sessizlik. Toplayıcı bekleyen bloğu burada bırakır.
  if (toplayiciyla) {
    const son = toplayici.topla(ms + 1000);
    if (son) cikti.push(son);
  }
  return cikti;
}

interface Satir {
  dosya: string;
  toplamSatir: number;
  parca: number;
  /** Toplayıcı YOKken (ilk tasarım) kaç kez uyanırdı. */
  eskiUyandirma: number;
  uyandirma: number;
  /** Elle verilen dürüst hedef: bu komut ideal olarak kaç kez uyandırmalı? */
  ideal: number;
  not: string;
}

/**
 * İdeal uyandırma sayısı: benim yargım, açıkça yazılı ve tartışmaya açık.
 * Genel kural — bir komut bir kez "sonucunu" bildirmeli, akarken değil.
 */
const IDEAL: Record<string, { ideal: number; not: string }> = {
  "01-npm-test-basarili.txt": { ideal: 1, not: "sonucu bir kez: 171/171 gecti" },
  "02-tsc-temiz.txt":         { ideal: 0, not: "SESSIZ basari — metinde hic sinyal yok (OSC133 gerekir)" },
  "03-tsc-hatali.txt":        { ideal: 1, not: "hata bildirilmeli" },
  "04-node-stack.txt":        { ideal: 1, not: "hata + yigin izi tek olay" },
  "05-node-sessiz.txt":       { ideal: 1, not: "programin ciktisi" },
  "06-komut-yok.txt":         { ideal: 1, not: "komut bulunamadi — bildirilmeli" },
  "07-git-repo-degil.txt":    { ideal: 0, not: "rutin git status listesi" },
  "08-npm-ls.txt":            { ideal: 0, not: "bagimlilik agaci, rutin" },
  "09-listeleme.txt":         { ideal: 0, not: "dizin listesi, rutin" },
  // Bu üçü GERÇEK Windows kabuk hatalarıdır; hiçbiri "error"/"fail" içermez.
  "10-cmd-komut-yok.txt":     { ideal: 1, not: "cmd.exe: is not recognized as an internal..." },
  "11-cmd-dosya-yok.txt":     { ideal: 1, not: "cmd dir: File Not Found" },
  "12-ps-komut-yok.txt":      { ideal: 1, not: "PowerShell: is not recognized as the name of a cmdlet" },
  // Canlı koşuda yanlış teşhis ettiğim durum: paket adları arasında "p-timeout"
  // gibi adlar var. Süzgeç bunları hata SANMAMALI (gerçek başarısızlık değil).
  "13-dir-node-modules.txt":  { ideal: 0, not: "basarili dizin listesi — paket adlari hata sanilmamali" },
};

const dizin = process.argv[2];
if (!dizin) { console.error("kullanim: akis-olcum.ts <yakalama-dizini>"); process.exit(1); }

const kural = new KuralRefleksi();
const satirlar: Satir[] = [];

const say = (bloklar: string[]) =>
  bloklar.filter((b) => kural.karar({ ozet: `Terminal çıktısı:\n${b}` }).terfi);

for (const dosya of readdirSync(dizin).filter((d) => d.endsWith(".txt")).sort()) {
  const ham = readFileSync(join(dizin, dosya), "utf8");
  const eski = beyneUlasanlar(ham, false);
  const yeni = beyneUlasanlar(ham, true);
  const gecen = say(yeni);
  const hedef = IDEAL[dosya] ?? { ideal: 1, not: "?" };
  satirlar.push({
    dosya, toplamSatir: ham.split("\n").length, parca: yeni.length,
    eskiUyandirma: say(eski).length, uyandirma: gecen.length,
    ideal: hedef.ideal, not: hedef.not,
  });
  for (const g of gecen.slice(0, 2)) {
    console.log(`   [gecen] ${dosya}: ${(g.split("\n").pop() ?? "").slice(0, 66)}`);
  }
}

console.log("\n┌ GERCEK CIKTI — SUZGEC DAVRANISI " + "─".repeat(52));
console.log("│ dosya                      satir  blok   ESKI  YENI  ideal  durum");
let toplamEski = 0, toplamYeni = 0, toplamIdeal = 0, kotu = 0;
for (const s of satirlar) {
  toplamEski += s.eskiUyandirma; toplamYeni += s.uyandirma; toplamIdeal += s.ideal;
  const durum = s.uyandirma === s.ideal ? "tam"
    : s.uyandirma > s.ideal ? `FAZLA +${s.uyandirma - s.ideal}`
    : `EKSIK -${s.ideal - s.uyandirma}`;
  if (s.uyandirma !== s.ideal) kotu++;
  console.log(`│ ${s.dosya.padEnd(26)} ${String(s.toplamSatir).padStart(4)}  ${String(s.parca).padStart(4)}  ${String(s.eskiUyandirma).padStart(5)} ${String(s.uyandirma).padStart(5)}  ${String(s.ideal).padStart(5)}  ${durum}`);
}
console.log("└" + "─".repeat(85));
console.log(`  ESKI (parca basina karar)   toplam uyandirma: ${toplamEski}`);
console.log(`  YENI (sessizlikte toplama)  toplam uyandirma: ${toplamYeni}   |  ideal ${toplamIdeal}`);
console.log(`  hedefi tutturan: ${satirlar.length - kotu}/${satirlar.length}`);
for (const s of satirlar) if (s.uyandirma !== s.ideal) console.log(`  ! ${s.dosya}: ${s.not}`);
