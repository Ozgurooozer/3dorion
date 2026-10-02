// uygulama/senaryolar/admindene.ts — `3dorion.bat admindene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── YÖNETİM TERMİNALİ denemesi (?admindene=1) ─────────────────────────────
// Masadaki ikinci ekran gerçek bir kabuk mu, okunuyor mu, ve Orion'un algı
// hattına SIZIYOR MU? Son soru önemli: admin terminali bilerek köprüye bağlı
// değil; bağlanmış olsaydı her yönetim komutu Orion'a gürültü olurdu.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Kopru } from "../../bridge/kopru.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { monitor, adminTerminal, admineGec } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(1800);
  const k0 = d.kopru as Kopru | null;
  const oncekiDusunme = k0?.sayac().dusunme ?? 0;
  await admineGec();
  await bekle(2500);

  adminTerminal.yaz("echo YONETIM-TERMINALI-CALISIYOR" + String.fromCharCode(13));
  await bekle(3000);

  const k = adminTerminal.kuyruk(14).replace(/\s+/g, " ");
  const gordu = k.includes("YONETIM-TERMINALI-CALISIYOR");
  console.log(`[ADMINDENE] ${gordu ? "GECTI" : "KALDI"} kabuk cikti uretti`);
  console.log(`[ADMINDENE] kuyruk: ...${k.slice(-120)}`);

  // SIZINTI denetimi: admin çıktısı Orion'un algı hattına girmemeli.
  const sonraDusunme = (d.kopru as Kopru | null)?.sayac().dusunme ?? 0;
  console.log(`[ADMINDENE] ${sonraDusunme === oncekiDusunme ? "GECTI" : "KALDI"} `
    + `admin cikisi Orion'a sizmadi (dusunme ${oncekiDusunme} -> ${sonraDusunme})`);
  console.log(`[ADMINDENE] ana monitor acik mi: ${monitor.acikMi()}`);
}
