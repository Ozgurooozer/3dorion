// uygulama/senaryolar/ovadene.ts — `3dorion.bat ovadene`: Orion'un OVADA ne yapabildiği (spec 26 F4 ölçümü).
//
// Ozyn: "Orion ovadaki tüm özellikleri anlık kullanabilmeli: oturmak, takip etmek gibi." Burada tahmin yok: her yetenek GERÇEK
// bedenle denenir; sonuç ve nedeni satır satır basılır. Kalan her KALDI bir iş maddesidir (ACIK-ISLER). Söz değil sonuç.
//
// SPEC 27: ofis ova'nın İÇİNDE (tek dünya); ova'ya "çıkmak" yürümektir. Ozyn ofisin DIŞINA ışınlanır, Orion ofiste kalır ve kapıdan
// YÜRÜYEREK gelir; sonra uzağa gidilir, geri kapıdan ofise dönmesi istenir.
//
//   1. "bana gel" (sözlük) ofisin dışındaki Ozyn'a: Orion kapıdan çıkıp yanına geldi
//   2. "beni takip et" → Ozyn uzaklaşınca yine geldi (ofisin etrafından dolanarak); "takibi bırak" → gelmedi
//   3. kapıya git (çapa `kapi`) → kapının önünde (ofisin içinde: dışarıdan kapıdan girerek)
//   4. otur → ofisin sandalyesine oturabildi
//   5. bak / jest → bitti
//   6. sor dunya → algıda nesneler var
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import type { Kopru } from "../../bridge/kopru.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { oyuncu } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[OVADENE] " + m);
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") => sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

  await bekle(2500);
  const k = d.kopru as Kopru | null;
  const o = d.orion as Avatar | null;
  if (!k || !o) { log("KALDI köprü ya da beden yok"); return; }
  if (!(await d.ovayaCik())) { log("KALDI ovaya çıkılamadı"); return; }
  await bekle(2500);

  const sonuclar = new Map<string, NiyetSonucu>();
  o.sonucDinle((s) => { sonuclar.set(s.niyet_id, s); });
  const mesafe = () => { const a = o.durum().konum, p = oyuncu.oyuncuDurumu().konum; return Math.hypot(a.x - p.x, a.z - p.z); };
  const yere = (x: number, z: number) => { oyuncu.isinla(x, z, 0); };
  const olana = async (kosul: () => boolean, ms: number) => { for (let t = 0; t < ms; t += 250) { if (kosul()) return true; await bekle(250); } return kosul(); };
  const soyle = (metin: string) => k.algi({ tur: "duydum", metin, kesin: true });
  const niyet = async (n: Niyet, id: string, ms = 20_000) => {
    d.niyetiYurut(n, id);
    // `basladi` ara durumdur (yürüyüş sürüyor); bitiş = bitti / hata / iptal (ilk koşuda `basladi` bitiş sayıldı, yanlış KALDI verdi).
    await olana(() => { const r = sonuclar.get(id); return !!r && r.durum !== "basladi"; }, ms);
    return sonuclar.get(id);
  };
  const yer = d.yerler().orion;
  log(`yer=${yer.ad} · nesne ${yer.nesneler.length} · engel ${yer.engeller.length} · çapa ${yer.capalar.map((c) => c.ad).join(",")}`);

  // 1. bana gel
  // Noktalar taş yolun KORİDORUNDA (x ≈ -2, kuleler x ≥ 4, havuz x ≤ -5): ışınlanılan yer engelin içine düşerse Orion'a
  // ulaşılamaz ve test ova'yı değil noktayı ölçer (ilk koşuda böyle oldu: havuzun içine ışınlanmıştı).
  yere(-2, 12);                                              // ofisin ön tarafı, kapıdan ~5 m (Orion ofiste: kapıdan çıkmak zorunda)
  soyle("bana gel");
  kontrol("'bana gel' dışarıda: Orion kapıdan çıkıp yanına geldi (< 1,8 m)", await olana(() => mesafe() < 1.8, 20_000), `mesafe=${mesafe().toFixed(2)} m`);

  // 2. takip
  soyle("beni takip et");
  await bekle(500);
  yere(-2, -12);
  kontrol("takip: Ozyn uzaklaşınca Orion yine geldi", await olana(() => mesafe() < 1.8, 25_000), `takipte=${k.takipte} mesafe=${mesafe().toFixed(2)} m`);
  soyle("takibi bırak");
  await bekle(500);
  yere(-2, -26);
  await bekle(5000);
  kontrol("'takibi bırak' → Orion gelmedi", !k.takipte && mesafe() > 4, `mesafe=${mesafe().toFixed(2)} m`);

  // 3. kapıya git
  const kapi = yer.capalar.find((c) => c.ad === "kapi");
  const g = await niyet({ tur: "git", hedef: { tip: "capa", ad: "kapi" } }, "ova_git_kapi", 60_000);   // ~30 m yürüyüş; durak kapının İÇ yanında
  const kapiMesafe = kapi ? Math.hypot(o.durum().konum.x - kapi.durak.x, o.durum().konum.z - kapi.durak.z) : NaN;
  kontrol("kapıya git: kapının önüne vardı (≤ 1,5 m)", g?.durum === "bitti" && kapiMesafe <= 1.5, `durum=${g?.durum} not=${g?.not ?? "-"} durağa ${kapiMesafe.toFixed(2)} m`);

  // 4. otur
  const ot = await niyet({ tur: "otur" }, "ova_otur", 15_000);
  kontrol("otur: oturabildi (ofisin sandalyesine)", ot?.durum === "bitti", `durum=${ot?.durum} not=${ot?.not ?? "-"}`);

  // 5. bak / jest
  const b = await niyet({ tur: "bak", hedef: { tip: "oyuncu" } }, "ova_bak", 8_000);
  const j = await niyet({ tur: "jest", jest: "el_salliyor" }, "ova_jest", 8_000);
  kontrol("bak (Ozyn'a) ve jest (el sallama) çalıştı", b?.durum === "bitti" && j?.durum === "bitti", `bak=${b?.durum} jest=${j?.durum}`);

  // 6. algı
  const dunya = d.algiSor("dunya").metin;
  kontrol("sor dunya: algıda nesneler var (boş değil)", dunya.length > 0, dunya.slice(0, 140));

  for (const s of sonuc) log(s);
  log(`ozet: ${sonuc.filter((s) => s.startsWith("GECTI")).length}/${sonuc.length}`);
}
