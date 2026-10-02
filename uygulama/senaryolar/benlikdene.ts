// uygulama/senaryolar/benlikdene.ts — `3dorion.bat benlikdene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── ANLIK BENLİK denemesi (?benlikdene=1, spec 12 Faz 1 / spec 13 Faz 4) ────
// Önerinin yaşam döngüsü benlikte DOĞRU SIRAYLA görünüyor mu — gerçek onay kapısı,
// gerçek pty, gerçek terminal algısı, gerçek `sonuc` yoluyla: önerildi → onay bekleniyor
// → onaylandı (bildirim SÜZÜLÜR ama benlik güncellenir) → sonuç bekleniyor → terminal
// bloğu → kapandı. Önerinin girişi köprünün `_gonder`inin yaptığı iki çağrıdır
// (benliğe yaz + `niyetiYurut`): LLM'in hangi komutu önereceği bu denemenin konusu değil.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Kopru } from "../../bridge/kopru.ts";
import type { Niyet } from "../../protocol/niyet.ts";
import { izdusum } from "../../mind/benlik.ts";
import { kimlik } from "../../protocol/temel.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { niyetiYurut, onayKarari, monitoreGec } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);
  await bekle(1800);
  const kp = d.kopru as Kopru | null;
  if (!kp) { console.log("[BENLIKDENE] KALDI köprü yok"); return; }
  await monitoreGec();
  await bekle(1800);

  const id = kimlik("n");
  const komut: Niyet = { tur: "komut", metin: "echo BENLIK_DENEMESI", gerekce: "benlik denemesi" };
  kp.benlik.niyetGonderildi(id, komut, "ben");
  niyetiYurut(komut, id);
  await bekle(600);
  const b1 = kp.benlik.oku();
  console.log(`[BENLIKDENE] izdüşüm: ${izdusum(b1)}`);
  kontrol("1 önerildi → ONAY bekleniyor", b1.bekliyorum?.ne === "onay", JSON.stringify(b1.bekliyorum));

  // Geçişler 50 ms'de bir örneklenir: `echo` 400 ms dolmadan biter, ara hâl tek bir
  // anlık bakışla kaçar (ilk koşu: 2/3, sonuç zaten kapanmıştı).
  const dusunmeOnce = kp.sayac().dusunme;
  const gecisler: string[] = [kp.benlik.oku().bekliyorum?.ne ?? "-"];
  const ornekle = setInterval(() => {
    const ne = kp.benlik.oku().bekliyorum?.ne ?? "-";
    if (gecisler.at(-1) !== ne) gecisler.push(ne);
  }, 50);
  onayKarari(true);
  await bekle(4000);
  clearInterval(ornekle);
  kontrol("2 sıra: onay → SONUÇ bekleniyor (bildirim süzülse de) → kapandı",
    JSON.stringify(gecisler) === JSON.stringify(["onay", "komut_sonucu", "-"]), JSON.stringify(gecisler));

  const b3 = kp.benlik.oku();
  kontrol("3 terminal bloğu → kapandı, son niyet 'bitti'",
    b3.bekliyorum === null && b3.son.bitenNiyet?.durum === "bitti" && (b3.son.bitenNiyet?.ozet ?? "").includes("BENLIK_DENEMESI"),
    JSON.stringify(b3.son.bitenNiyet));

  // 4) SÜZGEÇ MERCEĞİ (spec 12 Faz 4–5): gölgede sonuç beyni UYANDIRMAZ (bugünkü gibi);
  //    yetkide (`?benliksuzgec=1`) onaylanan kendi komutunun sonucu beyne gider.
  const yetki = new URLSearchParams(location.search).has("benliksuzgec");
  const uyandi = kp.sayac().dusunme > dusunmeOnce;
  kontrol(yetki ? "4 YETKİ: komutun sonucu beyni uyandırdı" : "4 GÖLGE: komutun sonucu beyni uyandırmadı (bugünkü gibi)",
    yetki ? uyandi : !uyandi, `dusunme ${dusunmeOnce} → ${kp.sayac().dusunme}`);

  for (const r of sonuc) console.log("[BENLIKDENE] " + r);
  console.log("[BENLIKDENE] ozet: " + sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
}
