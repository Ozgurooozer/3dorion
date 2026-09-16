// tools/sozlesme-sonda.ts — SATIR SÖZLEŞMESİ canlıda tutuyor mu?
//
// JSON şeması ölçümde askıda kaldı (60-90 sn AbortError). Yerine gelen satır
// sözleşmesinin gerçek modelde işe yaradığını UYGULAMADAN BAĞIMSIZ ölçer:
// OpenCodeBeyni.dusun() doğrudan çağrılır, çıkan araç çağrıları sayılır.
//
// Kullanım: node --experimental-strip-types tools/sozlesme-sonda.ts [modelID]
"use strict";
import { OpenCodeBeyni } from "../bridge/opencode.ts";
import { araclariUret } from "../bridge/araclar.ts";
import { talimatUret } from "../bridge/talimat.ts";
import type { BeyinGirdisi } from "../bridge/beyin.ts";

const modelID = process.argv[2] ?? "inclusionai/ling-3.0-flash-vl:free";
const beyin = new OpenCodeBeyni({ modelID, zamanAsimiMs: Number(process.env.SONDA_ZAMAN ?? 45000) });

const araclar = araclariUret();

interface Senaryo {
  ad: string;
  girdi: Partial<BeyinGirdisi>;
  bekle: string;          // beklenen araç adı
  baglam: Parameters<typeof talimatUret>[0];
}

const SENARYOLAR: Senaryo[] = [
  {
    ad: "terminal hatasi -> komut onerisi",
    baglam: { konusma: true, terminal: true, anilar: false, olay: false },
    bekle: "dunya_komut",
    girdi: {
      dunya: "Odadasin. Masandaki monitorde Ozyn calisiyor.",
      ozetler: [
        "Ekranda komut HATA ile bitti (cikis kodu 1): gti : The term 'gti' is not recognized as the name of a cmdlet.",
      ],
      gecmis: [{ rol: "kullanici", metin: "ekranda ne oldu, duzeltmek icin bir komut onerir misin" }],
    },
  },
  {
    ad: "tahtaya yaz istegi -> git + yaz",
    baglam: { konusma: true, terminal: false, anilar: false, olay: false },
    bekle: "dunya_yaz",
    girdi: {
      dunya: "Odadasin. Tahta arka duvarda, capa adi: tahta.",
      ozetler: [],
      gecmis: [{ rol: "kullanici", metin: "tahtaya 'bugun T6 bitti' yaz" }],
    },
  },
  {
    ad: "rutin basarili komut -> eylem beklenmez",
    baglam: { konusma: false, terminal: true, anilar: false, olay: false },
    bekle: "",
    girdi: {
      dunya: "Odadasin. Masandaki monitorde Ozyn calisiyor.",
      ozetler: ["Ekranda komut BASARIYLA bitti (cikis kodu 0): dir"],
      gecmis: [],
    },
  },
];

if (!(await beyin.hazirMi())) {
  console.error("opencode sunucusu ayakta degil (http://127.0.0.1:4096)");
  process.exit(1);
}
console.log(`model: ${modelID}\n`);

let gecti = 0;
for (const s of SENARYOLAR) {
  // Her senaryo TEMIZ oturumda: onceki turun cevabi bir sonrakini kirletmesin.
  beyin.oturumuSifirla();
  const t0 = Date.now();
  try {
    const c = await beyin.dusun({
      talimat: talimatUret(s.baglam),
      sabit: "Odadaki capalar: masa, tahta, kapi, pencere, monitor.",
      ozetler: s.girdi.ozetler ?? [],
      dunya: s.girdi.dunya ?? "",
      gecmis: s.girdi.gecmis ?? [],
      araclar,
    });
    const adlar = c.cagrilar.map((x) => x.ad);
    const ok = s.bekle ? adlar.includes(s.bekle) : !adlar.some((a) => a !== "dunya_soyle");
    if (ok) gecti++;
    console.log(`${ok ? "GECTI" : "KALDI"}  ${s.ad}  (${Date.now() - t0} ms)`);
    console.log(`   cagrilar : ${adlar.join(", ") || "(yok)"}`);
    console.log(`   soz      : "${c.metin.slice(0, 120)}"`);
    for (const x of c.cagrilar) {
      if (x.ad === "dunya_soyle") continue;
      console.log(`   ${x.ad.padEnd(12)}: ${JSON.stringify(x.girdi).slice(0, 140)}`);
    }
  } catch (e) {
    console.log(`HATA   ${s.ad}  (${Date.now() - t0} ms)  ${(e as Error).message.slice(0, 120)}`);
  }
  console.log("");
}
console.log(`sonuc: ${gecti}/${SENARYOLAR.length}`);
process.exit(0);
