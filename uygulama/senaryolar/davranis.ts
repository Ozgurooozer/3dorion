// uygulama/senaryolar/davranis.ts — `3dorion.bat davranis` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── DAVRANIS olcumu (?davranis=1) ─────────────────────────────────────────
// "Hat calisiyor" ile "davranis iyi" ayni sey degil. Gorudene borunun
// baglandigini kanitladi; bu, Orion'un gordugu seye NE YAPTIGINI olcer.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { SenaryoSonucu } from "../../world/davranisDenemesi.ts";
import { DavranisDefteri, raporla } from "../../world/davranisDenemesi.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { monitor, monitoreGec } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const defter = new DavranisDefteri();
  const kayit = defter.kayit();
  (window as unknown as { _davranisKayit?: unknown })._davranisKayit = kayit;

  const sonuclar: { sonuc: SenaryoSonucu; konusmaBekleniyor: boolean; beklenenKelimeler?: readonly string[] }[] = [];
  async function senaryo(ad: string, konusmaBekleniyor: boolean, hazirla: () => void, bekleMs: number,
                         beklenenKelimeler?: readonly string[]) {
    defter.sifirla();
    const t0 = performance.now();
    hazirla();
    await bekle(bekleMs);
    sonuclar.push({ sonuc: defter.topla(ad, performance.now() - t0), konusmaBekleniyor, beklenenKelimeler });
  }

  await bekle(1500);
  await monitoreGec();
  await bekle(1500);

  // 1) Ozyn dogrudan konusuyor -> Orion MUTLAKA cevap vermeli.
  await senaryo("Ozyn selam veriyor", true,
    () => { d.kopru?.algi({ tur: "duydum", metin: "Orion, selam. Orada misin?", kesin: true }); }, 22000);

  // 2) Masadaki terminalde GERCEK hata -> Orion fark edip soylemeli.
  await senaryo("terminalde gercek hata", true,
    () => { monitor.yaz("boyle_bir_komut_yok\r"); }, 22000,
    // Konu ilgisi denetimi: cevap gordugu hatayla ilgili mi?
    ["komut", "bulunamad", "tanin", "tanın", "hata", "calismad", "çalışmad", "terminal", "ekran"]);

  // 3) Rutin basarili komut -> Orion SUSMALI (konusmasi beklenmiyor).
  await senaryo("rutin basarili komut", false,
    () => { monitor.yaz("dir\r"); }, 12000);

  raporla(sonuclar);
}
