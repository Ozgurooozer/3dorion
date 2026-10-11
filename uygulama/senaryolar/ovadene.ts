// uygulama/senaryolar/ovadene.ts — `3dorion.bat ovadene`: Orion'un OVADA ne yapabildiği (spec 26 F4 ölçümü).
//
// Ozyn: "Orion ovadaki tüm özellikleri anlık kullanabilmeli: oturmak, takip etmek gibi." Burada tahmin yok: ovaya çıkılır
// (kapıdan, gerçek yoldan) ve her yetenek GERÇEK bedenle denenir; sonuç ve nedeni satır satır basılır. Kalan her KALDI
// bir iş maddesidir (ACIK-ISLER). Söz değil sonuç: mesafe, avatarın döndürdüğü hata metni.
//
//   1. "bana gel" (sözlük) uzaktan → Orion yanına geldi
//   2. "beni takip et" → Ozyn uzaklaşınca yine geldi; "takibi bırak" → gelmedi
//   3. kapıya git (çapa `kapi`) → kapının önünde
//   4. otur (ovada) → sonuç ve hata metni
//   5. bak / jest → bitti
//   6. sor dunya → ovanın nesneleri algıda
//   7. gec: Orion kapıdan KENDİ BAŞINA geçebilir mi (C6) → niyet var mı
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import type { Kopru } from "../../bridge/kopru.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import { araclariUret } from "../../bridge/araclar.ts";

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
  yere(-2, 3);
  soyle("bana gel");
  kontrol("'bana gel' ovada: Orion yanına geldi (< 1,8 m)", await olana(() => mesafe() < 1.8, 20_000), `mesafe=${mesafe().toFixed(2)} m`);

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
  const g = await niyet({ tur: "git", hedef: { tip: "capa", ad: "kapi" } }, "ova_git_kapi", 60_000);   // ~25 m yürüyüş
  const kapiMesafe = kapi ? Math.hypot(o.durum().konum.x - kapi.durak.x, o.durum().konum.z - kapi.durak.z) : NaN;
  kontrol("kapıya git: kapının önüne vardı (≤ 1,5 m)", g?.durum === "bitti" && kapiMesafe <= 1.5, `durum=${g?.durum} not=${g?.not ?? "-"} durağa ${kapiMesafe.toFixed(2)} m`);

  // 4. otur
  const ot = await niyet({ tur: "otur" }, "ova_otur", 15_000);
  kontrol("otur: ovada oturabildi", ot?.durum === "bitti", `durum=${ot?.durum} not=${ot?.not ?? "-"}`);

  // 5. bak / jest
  const b = await niyet({ tur: "bak", hedef: { tip: "oyuncu" } }, "ova_bak", 8_000);
  const j = await niyet({ tur: "jest", jest: "el_salliyor" }, "ova_jest", 8_000);
  kontrol("bak (Ozyn'a) ve jest (el sallama) çalıştı", b?.durum === "bitti" && j?.durum === "bitti", `bak=${b?.durum} jest=${j?.durum}`);

  // 6. algı
  const dunya = d.algiSor("dunya").metin;
  kontrol("sor dunya: ovanın nesneleri algıda (boş değil)", dunya.length > 0 && !/çalışma masası|beyaz tahta|monitör/.test(dunya), dunya.slice(0, 140));

  // 7. gec
  kontrol("gec: Orion kapıdan KENDİ BAŞINA geçebilir (niyet var)", araclariUret().some((a) => a.ad === "dunya_gec"), "araç tablosunda `gec` yok → C6");

  for (const s of sonuc) log(s);
  log(`ozet: ${sonuc.filter((s) => s.startsWith("GECTI")).length}/${sonuc.length}`);
}
