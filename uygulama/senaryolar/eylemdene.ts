// uygulama/senaryolar/eylemdene.ts — `3dorion.bat eylemdene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── EYLEM denemesi (?eylemdene=1, spec 13 Faz 7) ──────────────────────────
// Ortak testlerde Ozyn'in söylediği komutlar, GERÇEK köprü yolundan (`kopru.algi`, kesin
// söz): doğuştan programlar (`?komut=1` ile, senaryoda varsayılan kapalı) ve dünyanın
// gerçek hâli kontrol edilir — söz değil, sonuç: oturdu mu, yanına geldi mi, terminal açık
// mı, Ozyn'in kamerası kaçırıldı mı, tahtada mı. Günlükte program satırları görünüyor mu.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import type { Kopru } from "../../bridge/kopru.ts";
import { yaklastiMi } from "../../world/level/capalar.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { oyuncu, monitor, gunluk } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);
  /** Koşul sağlanana kadar (en fazla `ms`) bekler; sağlandı mı döner. */
  const olana = async (kosul: () => boolean, ms: number) => {
    for (let t = 0; t < ms; t += 200) { if (kosul()) return true; await bekle(200); }
    return kosul();
  };
  await bekle(2500);
  const kp = d.kopru as Kopru | null;
  const o = d.orion as Avatar | null;
  if (!kp || !o) { console.log("[EYLEMDENE] KALDI köprü ya da beden yok"); return; }
  const soyle = (metin: string) => kp.algi({ tur: "duydum", metin, kesin: true });
  const mesafe = () => {
    const a = o.durum().konum, p = oyuncu.oyuncuDurumu().konum;
    return Math.hypot(a.x - p.x, a.z - p.z);
  };

  soyle("otur");
  kontrol("'otur' → oturdu", await olana(() => o.durum().oturuyor_mu, 10_000), `poz=${o.durum().poz}`);

  soyle("kalk");
  await olana(() => !o.durum().oturuyor_mu, 4000);
  soyle("bana gel");
  kontrol("'bana gel' → Ozyn'in yanına geldi (< 1,6 m)", await olana(() => mesafe() < 1.6, 12_000), `mesafe=${mesafe().toFixed(2)} m`);

  soyle("önündeki bilgisayarı aç");
  const acti = await olana(() => o.durum().oturuyor_mu && monitor.acikMi(), 15_000);
  kontrol("'bilgisayarı aç' → oturdu ve terminal açık", acti, `oturuyor=${o.durum().oturuyor_mu} monitor=${monitor.acikMi()}`);
  kontrol("Ozyn'in kamerası kaçırılmadı", oyuncu.oyuncuDurumu().etkilesim !== "monitor", `etkilesim=${oyuncu.oyuncuDurumu().etkilesim ?? "-"}`);

  soyle("kalk");
  await olana(() => !o.durum().oturuyor_mu, 4000);
  soyle("tahtaya git");
  kontrol("'tahtaya git' → tahtanın önünde", await olana(() => yaklastiMi("tahta", o.durum().konum), 12_000),
    `konum=${o.durum().konum.x.toFixed(1)},${o.durum().konum.z.toFixed(1)}`);

  const programlar = gunluk.satirlar().filter((s) => s.includes("program")).length;
  kontrol("günlükte program satırları", programlar >= 4, `${programlar} satır`);
  console.log(`[EYLEMDENE] sayac komut=${kp.sayac().komut} dusunme=${kp.sayac().dusunme}`);

  for (const r of sonuc) console.log("[EYLEMDENE] " + r);
  console.log("[EYLEMDENE] ozet: " + sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
}
