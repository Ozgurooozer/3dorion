// uygulama/senaryolar/baglamdene.ts — `3dorion.bat baglamdene` (spec 16 F5): temiz bağlam canlıda.
//
// Soru: yönlendirici kipinde Orion SORULANI biliyor mu, sorulmayan bağlama girmiyor mu?
//   1. "otur" (doğuştan program) → konum oturduğu yer olur.
//   2. "neredesin"  → cevap şimdiki yerin adını anıyor mu (durum defteri).
//   3. "beyaz tahtaya git" → yeni yer; eskisi önceki konum olur.
//   4. "neredeydin" → cevap ÖNCEKİ yeri anıyor mu.
//   5. bir bilgi + yakın pencereyi taşıran alakasız sözler.
//   6. "ne konuşmuştuk" → cevap bilgiyi anıyor mu (konuşma çekmecesi, pencere dışından).
// Her soru tek koşu: n=1. Ön-kayıtlı eşik (P3/P4) için koşu tekrarlanır ve karar kaydı
// (ORION_KARAR_DOSYASI) `uyanis.baglam` / `hafizaIstegi` ile ayrıca sayılır.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Kopru } from "../../bridge/kopru.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import { sadelestir } from "../../mind/hafizaYonlendirici.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);
  await bekle(2500);
  const k = d.kopru as Kopru | null;
  const o = d.orion as Avatar | null;
  if (!k || !o) { console.log("[BAGLAMDENE] KALDI köprü ya da beden yok"); return; }

  const soylenen: string[] = [];
  k.konusmaDinle((m) => { soylenen.push(m); });
  /** Söyler, Orion'un cevabını (en fazla `ms`) bekler; cevabı döner. */
  const sor = async (metin: string, ms = 30_000) => {
    const once = soylenen.length;
    k.algi({ tur: "duydum", metin, kesin: true });
    for (let t = 0; t < ms && soylenen.length === once; t += 250) await bekle(250);
    await bekle(1500);   // ikinci cümle gelsin
    return soylenen.slice(once).join(" ");
  };
  /** Cevap, yer adının ilk kelimesini anıyor mu (Türkçe ekler: "masada", "tahtanın"). */
  const aniyor = (cevap: string, yer: string | undefined) =>
    !!yer && sadelestir(cevap).includes(sadelestir(yer.split(" ").at(-1)!).slice(0, 4));

  k.algi({ tur: "duydum", metin: "otur", kesin: true });
  for (let t = 0; t < 12_000 && !o.durum().oturuyor_mu; t += 200) await bekle(200);
  await bekle(3000);   // konum oturma süresi (KONUM_OTURMA_MS) + pay
  const yer1 = k.durum.oku("konum")?.deger;
  const c1 = await sor("neredesin");
  kontrol("'neredesin' → şimdiki yeri anıyor", aniyor(c1, yer1), `yer=${yer1} cevap="${c1}"`);

  k.algi({ tur: "duydum", metin: "kalk", kesin: true });
  await bekle(2500);
  k.algi({ tur: "duydum", metin: "beyaz tahtaya git", kesin: true });
  for (let t = 0; t < 15_000 && k.durum.oku("konum")?.deger === yer1; t += 250) await bekle(250);
  await bekle(1000);
  const yer2 = k.durum.oku("konum")?.deger;
  const once = k.durum.oku("onceki_konum")?.deger;
  kontrol("defter: yer değişti, eskisi önceki konum", !!yer2 && yer2 !== yer1 && once === yer1, `yer=${yer2} önceki=${once}`);
  const c2 = await sor("neredeydin");
  kontrol("'neredeydin' → önceki yeri anıyor", aniyor(c2, once), `önceki=${once} cevap="${c2}"`);

  await sor("bu hafta terminal suzgeci uzerinde calisiyorum", 20_000);
  for (const s of ["hava bugun guzel", "kahve ictim", "muzik dinliyorum", "biraz yoruldum", "kitap okudum"]) await sor(s, 20_000);
  const c3 = await sor("ne konusmustuk");
  kontrol("'ne konuşmuştuk' → pencere dışındaki bilgiyi anıyor", /süzge|suzge|terminal|filtre/i.test(c3), `cevap="${c3}"`);

  for (const s of sonuc) console.log(`[BAGLAMDENE] ${s}`);
  console.log(`[BAGLAMDENE] ${sonuc.filter((s) => s.startsWith("GECTI")).length}/${sonuc.length} · sayac=${JSON.stringify(k.sayac())}`);
}
