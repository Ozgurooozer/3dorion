// uygulama/senaryolar/hafizadene.ts — `3dorion.bat hafizadene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── HAFIZA denemesi (?hafizadene=1) ───────────────────────────────────────
// Asil soru "hafiza modulu calisiyor mu" degil (birim testi var):
// HATIRLAMAK ORION'UN CEVABINI DEGISTIRIYOR MU?
// Bir bilgi verilir, kisa pencere (12 tur) tasirilir, sonra sorulur.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Kopru } from "../../bridge/kopru.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const soylenen: string[] = [];
  // DİKKAT: `kopru` avatar yüklendikten SONRA kuruluyor. İlk sürümde
  // dinleyici beklemeden önce kaydedilmeye çalışıldı, o anda kopru null'du
  // ve ölçüm hiçbir şey duymadı ("cevap boş" gibi göründü).
  await bekle(2500);
  const k = d.kopru as Kopru | null;
  if (!k) { console.log("[HAFIZADENE] KALDI kopru yok"); return; }
  k.konusmaDinle((m) => { soylenen.push(m); });

  const GERCEK = "bu hafta terminal suzgeci uzerinde calisiyorum";
  k.algi({ tur: "duydum", metin: GERCEK, kesin: true });
  await bekle(6000);

  // Kisa pencereyi tasir: 13 alakasiz tur (varsayilan gecmisSiniri 12).
  const dolgu = [
    "hava bugun guzel", "kahve ictim", "pencereden disari bakiyorum",
    "masan duzenli mi", "sandalyeyi begendim", "tahtayi merak ettim",
    "odanin rengi hos", "saat kac oldu", "biraz yoruldum",
    "muzik dinliyorum", "kedi geldi", "kapiyi kapattim", "isik yeterli",
  ];
  for (const d of dolgu) {
    k.algi({ tur: "duydum", metin: d, kesin: true });
    await bekle(2600);
  }

  const oncekiSayi = soylenen.length;
  k.algi({ tur: "duydum", metin: "ne uzerinde calistigimi hatirliyor musun", kesin: true });
  await bekle(9000);

  const cevap = soylenen.slice(oncekiSayi).join(" ");
  const hatirladi = /süzge|suzge|terminal|filtre/i.test(cevap);
  console.log(`[HAFIZADENE] gecmis_siniri=${new URLSearchParams(location.search).get("gecmis") ?? 12}, araya giren tur=${dolgu.length}`);
  console.log(`[HAFIZADENE] cevap: "${cevap}"`);
  console.log(`[HAFIZADENE] ${hatirladi ? "GECTI" : "KALDI"} eski bilgi hatirlandi mi`);
  console.log(`[HAFIZADENE] sayac=${JSON.stringify(k.sayac())}`);
}
