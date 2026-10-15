// uygulama/orionSesi.ts — Orion'un sesi: Piper çıkışı ve açılış selamı.
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2).
// Birleştirme noktası burası: voice/ ile world/ birbirini import etmez (K4),
// ikisini giris.ts bağlar. Avatar geldiğinde (T2) agizAcikligi() buradan
// avatar.agizAyarla()'ya beslenecek.
"use strict";
import { PiperCikisi } from "../voice/cikis.ts";

export function orionSesiKur(): PiperCikisi {
  const orionSesi = new PiperCikisi();
  window.orionSes = orionSesi;

  void (async () => {
    const kurulu = await orionSesi.kurulumKontrol();
    console.log(`[SES] piper kurulu=${kurulu}`);
    if (!kurulu) return;

    const sorgu = new URLSearchParams(location.search);
    if (sorgu.has("sessiz")) return;

    // ORION_SOZ verilmişse yalnızca onu söyle — elle deneme için.
    const istenen = sorgu.get("soz");
    if (istenen) {
      const oldu = await orionSesi.soyle(istenen);
      console.log(`[SES] istenen soyle=${oldu} baslama_gecikmesi=${orionSesi.baslamaGecikmesi.toFixed(0)}ms ses_uzunlugu=${orionSesi.sonSure.toFixed(2)}sn`);
      return;
    }

    // Açılışta tek selam. (Ölçüm koşumu ORION_SOZ ile ayrıca yapılabiliyor.)
    const cumleler = ["Merhaba Ozyn. Odama hoş geldin. Terminal masamda, istediğin zaman aç."];
    for (let i = 0; i < cumleler.length; i++) {
      const oldu = await orionSesi.soyle(cumleler[i]!);
      console.log(
        `[SES] cumle${i + 1} soyle=${oldu} ` +
        `baslama_gecikmesi=${orionSesi.baslamaGecikmesi.toFixed(0)}ms ` +
        `ses_uzunlugu=${orionSesi.sonSure.toFixed(2)}sn tepe_agiz=${orionSesi.tepeAgiz.toFixed(3)}`
      );
    }
  })();
  return orionSesi;
}
