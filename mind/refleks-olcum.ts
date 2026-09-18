// mind/refleks-olcum.ts — İKİ ADAY ÖLÇÜMÜ: kural mı, 270M model mi?
//
// NEDEN BU DOSYA VAR
// Spec (docs/specs/01-sanal-alan.md sat. 58) "refleks = functiongemma:270m"
// diyor. Bu bir VARSAYIM; ölçülmedi. Bir yargı katmanını hatta bağlamadan
// önce iki şeyi bilmek gerekir:
//   1. Ucuz kural taban çizgisi ne kadar iyi? (Katkı ancak buna göre ölçülür.)
//   2. 253MB'lık model bu taban çizgisini geçiyor mu, hangi gecikmeyle?
//
// ETİKETLEME DÜRÜSTLÜĞÜ: aşağıdaki `beklenen` alanları model çıktısı
// GÖRÜLMEDEN yazıldı. Sonradan "model böyle dedi, demek doğruydu" diye
// düzeltilmedi. Anlaşmazlık çıkan durumlar raporda ayrıca listeleniyor.
//
// Koşum:  node --experimental-strip-types mind/refleks-olcum.ts
"use strict";
import { OZET_ONEKI } from "../protocol/algi.ts";
import { KuralRefleksi, OllamaRefleks, type Refleks } from "./refleks.ts";

interface Durum {
  ozet: string;
  /** Bu algı BÜYÜK beyni uyandırmaya değer mi? */
  beklenen: boolean;
  /** Neden böyle etiketledim — tartışmaya açık olsun diye yazılı. */
  neden: string;
  grup: "terminal" | "olay" | "konusma" | "sonuc" | "goruntu" | "dusman";
}

// ── Etiketli küme ───────────────────────────────────────────────────────────
// Ağırlık bilerek TERMİNAL'de: dikkat.ts terminali yalnızca ZAMANA göre
// kısıyor, içeriğe göre değil. Kuralların/modelin gerçekten fark yaratacağı
// tek yer burası. Olay/konuşma durumları çoğunlukla akıl sağlığı kontrolü.
const KUME: Durum[] = [
  // — terminal: gürültü —
  { grup: "terminal", beklenen: false, neden: "paket uyarısı, Orion'u ilgilendirmez",
    ozet: `${OZET_ONEKI.terminal}:\nnpm WARN deprecated inflight@1.0.6: This module is not supported` },
  { grup: "terminal", beklenen: false, neden: "derleme varlık listesi, tek satırı anlamsız",
    ozet: `${OZET_ONEKI.terminal}:\n  dist/assets/index-Dwfm1WzR.js   1,885.78 kB │ gzip: 456.72 kB` },
  { grup: "terminal", beklenen: false, neden: "boş kabuk istemi, hiçbir bilgi yok",
    ozet: `${OZET_ONEKI.terminal}:\n$ ` },
  { grup: "terminal", beklenen: false, neden: "yığın izi çerçeveleri — hata satırı ayrı geldi zaten",
    ozet: `${OZET_ONEKI.terminal} (truncated):\n    at Module._compile (node:internal/modules/cjs/loader:1234:14)\n    at Module._load (node:internal/modules/cjs/loader:1012:12)` },
  { grup: "terminal", beklenen: false, neden: "ilerleme göstergesi, sonuç değil",
    ozet: `${OZET_ONEKI.terminal}:\nresolving dependencies... 47/312` },

  // — terminal: sinyal —
  { grup: "terminal", beklenen: true, neden: "gerçek hata, Orion söylemeli",
    ozet: `${OZET_ONEKI.terminal}:\nError: Cannot find module './protocol/algi.ts'` },
  { grup: "terminal", beklenen: true, neden: "ağ hatası, iş durdu",
    ozet: `${OZET_ONEKI.terminal}:\nnpm ERR! code ECONNREFUSED` },
  { grup: "terminal", beklenen: true, neden: "test sonucu — başlattığı işin akıbeti",
    ozet: `${OZET_ONEKI.terminal}:\nℹ tests 151\nℹ pass 151\nℹ fail 0` },
  { grup: "terminal", beklenen: true, neden: "başarısız test, kesinlikle bildirilmeli",
    ozet: `${OZET_ONEKI.terminal}:\nℹ tests 151\nℹ pass 149\nℹ fail 2` },
  { grup: "terminal", beklenen: true, neden: "başlattığı derleme bitti",
    ozet: `${OZET_ONEKI.terminal}:\n✓ built in 3.88s` },

  // — olay —
  { grup: "olay", beklenen: true,  neden: "kullanıcı geldi, tepki verilmeli", ozet: "Olay: oyuncu_odaya_girdi" },
  { grup: "olay", beklenen: false, neden: "dikkat.ts'in de gürültü saydığı olay", ozet: "Olay: kamera_degisti" },
  { grup: "olay", beklenen: false, neden: "HUD ayrıntısı, dünya olayı değil", ozet: "Olay: ipucu" },
  { grup: "olay", beklenen: true,  neden: "kullanıcı monitörü açtı — bağlam değişti", ozet: "Olay: monitor_acildi" },
  { grup: "olay", beklenen: true,  neden: "kullanıcı oturdu, yeni durum", ozet: "Olay: oyuncu_masaya_oturdu" },

  // — konuşma (akıl sağlığı: asla kaçırılmamalı) —
  { grup: "konusma", beklenen: true, neden: "kullanıcı bekletilemez", ozet: 'Ozyn dedi: "merhaba"' },
  { grup: "konusma", beklenen: true, neden: "doğrudan emir", ozet: 'Ozyn dedi: "orion tahtaya git"' },

  // — niyet sonucu —
  { grup: "sonuc", beklenen: true,  neden: "yapamadığını öğrenmeli", ozet: "Niyet n_a1 → hata (çapa bulunamadı: tahtaa)" },
  { grup: "sonuc", beklenen: false, neden: "rutin başarı, bağlam şişirir", ozet: "Niyet n_a1 → bitti" },

  // — anlık görüntü —
  { grup: "goruntu", beklenen: false, neden: "istenmeden gelen rutin liste", ozet: "Yakında: masa, sandalye, monitor" },
  { grup: "goruntu", beklenen: false, neden: "rutin dünya nabzı", ozet: "Dünya: duruyor, Ozyn 2.6m sana bakıyor. Yakında: masa(0.9m), monitor(1.1m)" },

  // ── DÜŞMAN DURUMLAR ───────────────────────────────────────────────────────
  // Bunlar kurallar YAZILDIKTAN SONRA, kuralları KIRMAK için tasarlandı.
  // İlk ölçümde kural %100 aldı — ama sınavı da cevap anahtarını da aynı kişi
  // yazmıştı. Aşağısı gerçek sınav. Her biri gerçek terminal çıktısı biçimi.

  // Anahtar kelime var ama olay yok — kural "hata" sanmalı, değil:
  { grup: "dusman", beklenen: false, neden: "JSON alanı; hata YOK, sadece alan adı hata kelimesi içeriyor",
    ozet: 'Terminal çıktısı:\n  "error": null,' },
  { grup: "dusman", beklenen: false, neden: "commit mesajı hata kelimesi içeriyor; olan biten bir şey yok",
    ozet: `${OZET_ONEKI.terminal}:\na1b2c3d fix error handling in parser` },
  { grup: "dusman", beklenen: false, neden: "kullanıcının yazdığı komutun yankısı, sonuç değil",
    ozet: 'Terminal çıktısı:\n$ grep -rn "error" src/ | wc -l' },
  { grup: "dusman", beklenen: false, neden: "tarayıcı favicon gürültüsü, işi ilgilendirmiyor",
    ozet: `${OZET_ONEKI.terminal}:\nFailed to load resource: the server responded with a status of 404 (favicon.ico)` },

  // Olay var ama anahtar kelime yok — kural kaçırmalı:
  { grup: "dusman", beklenen: true, neden: "süreç çöktü — 'error' kelimesi geçmiyor ama en kritik çıktı",
    ozet: `${OZET_ONEKI.terminal}:\nSegmentation fault (core dumped)` },
  { grup: "dusman", beklenen: true, neden: "OOM katili süreci öldürdü; tek kelime, hayati",
    ozet: `${OZET_ONEKI.terminal}:\nKilled` },
  { grup: "dusman", beklenen: true, neden: "iş bitti ama 'built in' kalıbı değil",
    ozet: `${OZET_ONEKI.terminal}:\nCompiled successfully in 1.2s` },
  { grup: "dusman", beklenen: true, neden: "güvenlik bulgusu — söylenmeye değer, hata kelimesi yok",
    ozet: `${OZET_ONEKI.terminal}:\n17 vulnerabilities (3 moderate, 14 high)` },
  { grup: "dusman", beklenen: true, neden: "süreç yanıt vermiyor; kalıp yok ama durum kritik",
    ozet: `${OZET_ONEKI.terminal}:\nTimeout waiting for localhost:5173 after 30000ms` },
  { grup: "dusman", beklenen: false, neden: "satır sonu uyarısı, her git işleminde çıkar",
    ozet: `${OZET_ONEKI.terminal}:\nwarning: LF will be replaced by CRLF in package-lock.json` },
];

interface Rapor {
  ad: string;
  dogru: number;
  toplam: number;
  /** Kaçırılan sinyal: beklenen=true ama terfi=false. EN PAHALI hata türü. */
  kacirilan: string[];
  /** Boşuna uyandırma: beklenen=false ama terfi=true. Token yakar. */
  bosUyandirma: string[];
  gecikmeler: number[];
  gecersizJson: number;
  /** Düşman alt kümesi ayrı raporlanır — asıl sınav orası. */
  dusmanDogru: number;
  dusmanToplam: number;
}

async function olc(ad: string, r: Refleks): Promise<Rapor> {
  const rapor: Rapor = {
    ad, dogru: 0, toplam: KUME.length, kacirilan: [], bosUyandirma: [],
    gecikmeler: [], gecersizJson: 0,
    dusmanDogru: 0, dusmanToplam: KUME.filter((d) => d.grup === "dusman").length,
  };
  for (const d of KUME) {
    const t0 = performance.now();
    const k = await r.degerlendir({ ozet: d.ozet });
    rapor.gecikmeler.push(performance.now() - t0);
    if (k.gerekce?.includes("ayrıştırma hatası") || k.gerekce?.includes("refleks hatası")) rapor.gecersizJson++;

    const tekSatir = (d.grup === "dusman" ? "[D] " : "") + d.ozet.replace(/\n/g, " ⏎ ").slice(0, 58);
    if (k.terfi === d.beklenen) {
      rapor.dogru++;
      if (d.grup === "dusman") rapor.dusmanDogru++;
    } else if (d.beklenen) rapor.kacirilan.push(tekSatir);
    else rapor.bosUyandirma.push(tekSatir);
  }
  return rapor;
}

function ortanca(x: number[]): number {
  const s = [...x].sort((a, b) => a - b);
  return s.length % 2 ? (s[(s.length - 1) / 2] ?? 0) : ((s[s.length / 2 - 1] ?? 0) + (s[s.length / 2] ?? 0)) / 2;
}

function bas(r: Rapor): void {
  const yuzde = ((r.dogru / r.toplam) * 100).toFixed(0);
  console.log(`\n── ${r.ad} ──`);
  const dYuzde = r.dusmanToplam ? ((r.dusmanDogru / r.dusmanToplam) * 100).toFixed(0) : "-";
  console.log(`  dogruluk      ${r.dogru}/${r.toplam}  (%${yuzde})`);
  console.log(`  DUSMAN altkume ${r.dusmanDogru}/${r.dusmanToplam}  (%${dYuzde})   <- asil sinav`);
  console.log(`  gecikme       ortanca ${ortanca(r.gecikmeler).toFixed(1)} ms  |  azami ${Math.max(...r.gecikmeler).toFixed(1)} ms`);
  if (r.gecersizJson) console.log(`  gecersiz yanit ${r.gecersizJson} (guvenli tarafa dustu)`);
  console.log(`  KACIRILAN sinyal (${r.kacirilan.length}):`);
  for (const k of r.kacirilan) console.log(`     ✗ ${k}`);
  console.log(`  bos uyandirma (${r.bosUyandirma.length}):`);
  for (const k of r.bosUyandirma) console.log(`     ~ ${k}`);
}

const AD_MODEL = "hf.co/unsloth/functiongemma-270m-it-GGUF";

async function main(): Promise<void> {
  console.log(`refleks olcumu — ${KUME.length} etiketli durum`);
  console.log(`(etiketler model ciktisi GORULMEDEN yazildi)`);

  const kural = await olc("Aday A — kural tabanli", new KuralRefleksi());
  bas(kural);

  const model = new OllamaRefleks({ model: AD_MODEL, zamanAsimiMs: 15_000 });
  if (!(await model.hazirMi())) {
    console.log(`\n[ATLANDI] ${AD_MODEL} Ollama'da bulunamadi — aday B olculemedi.`);
    return;
  }
  const b = await olc(`Aday B — ${AD_MODEL.split("/").pop()}`, model);
  bas(b);

  console.log(`\n── KARAR GIRDISI ──`);
  console.log(`  dogruluk   A %${((kural.dogru / kural.toplam) * 100).toFixed(0)}  vs  B %${((b.dogru / b.toplam) * 100).toFixed(0)}`);
  console.log(`  DUSMAN     A ${kural.dusmanDogru}/${kural.dusmanToplam}  vs  B ${b.dusmanDogru}/${b.dusmanToplam}`);
  console.log(`  kacirilan  A ${kural.kacirilan.length}  vs  B ${b.kacirilan.length}   (dusuk olan iyi — kacirmak en pahali hata)`);
  console.log(`  gecikme    A ${ortanca(kural.gecikmeler).toFixed(1)}ms  vs  B ${ortanca(b.gecikmeler).toFixed(1)}ms`);
}

await main();
