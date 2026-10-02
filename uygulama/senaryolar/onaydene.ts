// uygulama/senaryolar/onaydene.ts — `3dorion.bat onaydene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { monitor, onayKapisi, niyetiYurut, onayKarari, monitoreGec } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

  await bekle(1800);
  await monitoreGec();
  await bekle(1800);

  // 1) Oneri sun — onaysiz hicbir sey calismamali.
  niyetiYurut({ tur: "komut", metin: "echo ONAY_DENEMESI_1", gerekce: "deneme" }, "k1");
  await bekle(1500);
  const kuyruk1 = monitor.kuyruk(24);
  kontrol("oneri ONAYSIZ calismadi",
    onayKapisi.durum === "bekliyor" && !kuyruk1.includes("ONAY_DENEMESI_1"),
    `kapi=${onayKapisi.durum}`);

  // 2) Bekleyen oneri EZILEMEZ.
  niyetiYurut({ tur: "komut", metin: "echo EZME_DENEMESI", gerekce: "ikinci" }, "k2");
  await bekle(400);
  kontrol("bekleyen oneri EZILMEDI",
    onayKapisi.bekleyen?.komut === "echo ONAY_DENEMESI_1",
    `bekleyen=${onayKapisi.bekleyen?.komut ?? "yok"}`);

  // 3) REDDET — calismamali.
  onayKarari(false);
  await bekle(1800);
  kontrol("ret komutu CALISTIRMADI",
    onayKapisi.durum === "bos" && !monitor.kuyruk(24).includes("ONAY_DENEMESI_1"),
    `sayac=${JSON.stringify(onayKapisi.sayac())}`);

  // 4) ONAYLA — calismali.
  niyetiYurut({ tur: "komut", metin: "echo ONAY_DENEMESI_2", gerekce: "deneme" }, "k3");
  await bekle(600);
  onayKarari(true);
  await bekle(3000);
  const kuyruk2 = monitor.kuyruk(24);
  kontrol("onay komutu CALISTIRDI", kuyruk2.includes("ONAY_DENEMESI_2"),
    `kuyrukta=${kuyruk2.includes("ONAY_DENEMESI_2")}`);

  for (const r of sonuc) console.log("[ONAYDENE] " + r);
  console.log(`[ONAYDENE] denetim izi=${JSON.stringify(onayKapisi.gecmis().map((g) => [g.karar, g.oneri.komut]))}`);
  console.log("[ONAYDENE] ozet: " + sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
}
