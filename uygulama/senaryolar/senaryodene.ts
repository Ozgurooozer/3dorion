// uygulama/senaryolar/senaryodene.ts — `3dorion.bat senaryodene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── SENARYO KİPİ denetimi (?senaryodene=1) ────────────────────────────────
// Susturmanın GERÇEKTEN işe yaradığını kanıtlar.
//
// Sorun normalde beyin niyet ürettiğinde çıkıyor; sağlayıcı kotası dolu
// olduğu için beyin şu an hiç konuşmuyor ve arıza GİZLİ. Bu yüzden çakışma
// burada YAPAY olarak üretilir: senaryo bir `git` başlatır, hemen ardından
// "beyin" gibi rakip bir `git` gönderilir.
//
// `?rakip=1` ile rakip niyet ZORLA gönderilir (susturmanın atlandığı durum),
// varsayılanda ise köprü yolundan gönderilir — susturma çalışıyorsa köprü
// zaten durmuştur ve hiçbir şey gelmez.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import type { Kopru } from "../../bridge/kopru.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { niyetiYurut } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(2200);
  const o = d.orion as Avatar | null;
  if (!o) { console.log("[SENARYODENE] KALDI avatar yok"); return; }

  const rakipZorla = new URLSearchParams(location.search).has("rakip");
  const kesilenler: string[] = [];
  o.sonucDinle((r) => {
    if (r.durum === "hata" && /kesildi|iptal/i.test(r.not ?? "")) kesilenler.push(r.niyet_id);
  });

  // Senaryonun niyeti: tahtaya git.
  niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "senaryo_git");
  await bekle(600);

  // Rakip: "beyin" pencereye gitmek istiyor.
  if (rakipZorla) {
    // Susturmayı ATLA: doğrudan avatara gönder — arızanın kendisi budur.
    o.niyet({ tur: "git", hedef: { tip: "capa", ad: "pencere" } }, "rakip_beyin");
  } else {
    // Normal yol: köprü üzerinden. Susturma çalışıyorsa buradan hiçbir
    // niyet çıkmaz, çünkü köprü durdurulmuştur.
    (d.kopru as Kopru | null)?.algi({ tur: "duydum", kesin: true, metin: "pencereye git" });
  }

  await bekle(7000);
  const k = o.durum().konum;
  const tahtada = Math.abs(k.x + 3.8) < 0.9;
  console.log(`[SENARYODENE] rakipZorla=${rakipZorla} konum=${k.x.toFixed(1)},${k.z.toFixed(1)} `
    + `kesilen=${kesilenler.length ? kesilenler.join(",") : "yok"}`);
  console.log(`[SENARYODENE] ${tahtada ? "GECTI" : "KALDI"} senaryonun git'i tamamlandi`);
}
