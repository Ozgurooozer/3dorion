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
import { KuralRefleksi, OllamaRefleks, type Refleks } from "./refleks.ts";
// Etiketli küme ayrı modülde: bu dosya içe aktarılınca ölçümü koşturur, küme
// başka ölçümlerce de (tools/ogretmen.ts) kopyalanmadan kullanılsın diye.
import { KUME } from "./refleksKumesi.ts";

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
