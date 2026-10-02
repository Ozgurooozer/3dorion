// uygulama/senaryolar/tahtadene.ts — `3dorion.bat tahtadene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── TAHTA denemesi (?tahtadene=1) ─────────────────────────────────────────
// Iki iddiayi kanitlar: (1) Orion tahtanin ONUNDEYKEN gercekten yaziyor,
// (2) UZAKTAN yazmak istenince once KENDISI tahtaya yuruyor, varinca yaziyor
// (spec 13 robot ilkesi; eskiden reddedilip gerekce beyne donuyordu).
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import { yaklastiMi } from "../../world/level/capalar.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { tahta, niyetiYurut } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

  await bekle(2200);
  const o = d.orion as Avatar | null;
  if (!o) { console.log("[TAHTADENE] KALDI avatar yok"); return; }

  // 1) UZAKTAN yazma: hemen yazilMAMALI (uzaktan yazilmaz), Orion once yurumeli,
  //    varinca yazmali (spec 13 robot ilkesi).
  const uzakta = o.durum().konum;
  niyetiYurut({ tur: "yaz", metin: "uzaktan istendi, yuruyup yazdim" }, "dene_uzak");
  await bekle(900);
  kontrol("uzaktan HEMEN yazilmadi", tahta.satirlar().length === 0,
    `konum=${uzakta.x.toFixed(1)},${uzakta.z.toFixed(1)} satir=${tahta.satirlar().length}`);
  await bekle(7000);
  const vardi = o.durum().konum;
  kontrol("once tahtaya YURUDU, sonra yazdi", yaklastiMi("tahta", vardi) && tahta.satirlar().length === 1,
    `konum=${vardi.x.toFixed(1)},${vardi.z.toFixed(1)} satir=${tahta.satirlar().length}`);

  // 2) Tahtanin onundeyken yaz.
  niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "dene_git_tahta");
  await bekle(1500);
  const yakinda = o.durum().konum;
  niyetiYurut({ tur: "yaz", metin: "Terminal suzgeci bitti. Cikis kodu ile calisiyor." }, "dene_yaz");
  await bekle(900);
  const satirlar = tahta.satirlar();
  // ≥ 2: ilk (yürüyüp yazılan) satırın üstüne eklendi; uzun metin satıra sarılabilir.
  kontrol("yakindan yazmak CALISTI", satirlar.length >= 2,
    `konum=${yakinda.x.toFixed(1)},${yakinda.z.toFixed(1)} satir=${satirlar.length}`);
  for (const s of satirlar) console.log(`[TAHTADENE]   tahtada: "${s}"`);

  // 3) temizle=true onceki yaziyi silmeli.
  niyetiYurut({ tur: "yaz", metin: "yeni not", temizle: true }, "dene_temizle");
  await bekle(900);
  kontrol("temizle=true eskiyi sildi",
    tahta.satirlar().length === 1 && tahta.satirlar()[0] === "yeni not",
    JSON.stringify(tahta.satirlar()));

  for (const r of sonuc) console.log("[TAHTADENE] " + r);
  console.log("[TAHTADENE] ozet: " + sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
}
