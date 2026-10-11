// uygulama/senaryolar/kapidene.ts — `3dorion.bat kapidene` (spec 24 C3): ofisin kapısından ovaya ve geri.
//
// GERÇEK yoldan: oyuncu kapıya bakar, ipucu "geç" çıkar, E tuşu (klavye olayı) basılır — kararma, ova, Orion
// yanında. Orion ovada kendi yürüyüşüyle ofis kapısına gider; Ozyn ofis kapısına bakıp E'ye basar — oda geri gelir,
// Orion da. Söz değil sonuç: yer adı, mesafe, kararmanın gerçekten olduğu, odanın mesh sayısı ve sisi.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import { capaBul, yaklastiMi } from "../../world/level/capalar.ts";
import { EtkilesimOlaylari } from "../../world/player/etkilesim.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { oyuncu, sahne } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);
  const olana = async (kosul: () => boolean, ms: number) => {
    for (let t = 0; t < ms; t += 100) { if (kosul()) return true; await bekle(100); }
    return kosul();
  };
  const bitir = () => {
    for (const r of sonuc) console.log("[KAPIDENE] " + r);
    console.log("[KAPIDENE] ozet: " + sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
  };
  const eBas = () => {
    dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", key: "e" }));
    dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE", key: "e" }));
  };
  const kararmaOpak = () => Number(getComputedStyle(document.getElementById("kararma")!).opacity);
  /** Geçiş boyunca kararmanın en koyu hâli (geçişin örtüldüğünün kanıtı). */
  const gecisiIzle = async (hedef: string) => {
    let enKoyu = 0;
    const vardi = await olana(() => { enKoyu = Math.max(enKoyu, kararmaOpak()); return d.yerler().ozyn.ad === hedef && kararmaOpak() < 0.05; }, 10_000);
    return { vardi, enKoyu };
  };

  await bekle(2500);
  const o = d.orion as Avatar | null;
  if (!o) { kontrol("Orion'un bedeni hazır", false); bitir(); return; }
  const mesafe = () => { const a = o.durum().konum, p = oyuncu.oyuncuDurumu().konum; return Math.hypot(a.x - p.x, a.z - p.z); };
  const odaMesh = sahne.meshes.length, odaSis = sahne.fogDensity;

  // ── 1. Ofiste kapıya bak: ipucu "geç" ──
  const kapi = capaBul("kapi")!;
  oyuncu.isinla(kapi.durak.x, kapi.durak.z, 0);              // yaw 0 → +Z: ön duvardaki kapıya
  kontrol("ofiste kapıya bakınca ipucu: geç", await olana(() => EtkilesimOlaylari.sonIpucu?.eylem === "gec", 3000),
    EtkilesimOlaylari.sonIpucu?.metin ?? "ipucu yok");

  // ── 2. E → kararma → ova ──
  eBas();
  const cikis = await gecisiIzle("ova");
  kontrol("E → ovadasın", cikis.vardi, `yer=${d.yerler().ozyn.ad}`);
  kontrol("geçiş kararmanın arkasında", cikis.enKoyu > 0.9, `en koyu ${cikis.enKoyu.toFixed(2)}`);
  kontrol("Orion da ovada", d.yerler().orion.ad === "ova");
  kontrol("Orion Ozyn'in yanında (≤ 2,5 m)", mesafe() <= 2.5, `${mesafe().toFixed(2)} m`);
  kontrol("ovadayken odanın meshleri kapalı", odaKapali(d));
  // NPC algısı (spec 25 Faz 1): Orion'un "dunya" algısı bulunduğu yerin nesnelerinden; ofisin eşyası ovaya sızmaz.
  const ovaAlgisi = d.algiSor("dunya").metin;
  kontrol("ovada algı ova'nın nesnelerinden, ofis eşyası yok", /ofis kapısı|boru duvarı/.test(ovaAlgisi) && !/beyaz tahta|monitör|çalışma masası/.test(ovaAlgisi), ovaAlgisi);

  // ── 3. Orion ovada ofis kapısına yürür ──
  // Önce kapıdan ~10 m uzaklaşır: Orion kapının yanında belirdiği için doğrudan "kapıya git" bir şey kanıtlamaz
  // (ilk koşuda yaklaşma yarıçapının içindeydi, yürümeden "bitti" dedi).
  const ova = d.yerler().orion;
  d.niyetiYurut({ tur: "git", hedef: { tip: "nokta", x: -2, y: 0, z: 4 } }, "kapidene_uzaklas");
  const uzaklasti = await olana(() => !yaklastiMi("kapi", o.durum().konum, ova.capalar) && o.durum().konum.z < 6, 15_000);
  kontrol("Orion ovada kapıdan uzaklaştı", uzaklasti, `z=${o.durum().konum.z.toFixed(1)}`);
  d.niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "kapi" } }, "kapidene_git");
  kontrol("Orion ovada ofis kapısına yürüdü", await olana(() => yaklastiMi("kapi", o.durum().konum, ova.capalar), 20_000),
    `konum=${o.durum().konum.x.toFixed(1)},${o.durum().konum.y.toFixed(2)},${o.durum().konum.z.toFixed(1)}`);

  // ── 4. Ozyn ofis kapısına bakar: ipucu → E → oda ──
  const ovaKapi = capaBul("kapi", ova.capalar)!;
  const yaw = Math.atan2(ovaKapi.yon.x, ovaKapi.yon.z);
  // Kapının TAM karşısında, durağın 0,4 m gerisinde (kapı 1 m geniş: ilk sürüm 0,6 m yana koyuyordu, dümdüz bakış
  // kapının kenarını 10 cm ıskalıyordu). Orion durakta dursa da ışını kesmez (beden katı yüzey değil).
  oyuncu.isinla(ovaKapi.durak.x - ovaKapi.yon.x * 0.4, ovaKapi.durak.z - ovaKapi.yon.z * 0.4, yaw);
  kontrol("ovada ofis kapısına bakınca ipucu: geç", await olana(() => EtkilesimOlaylari.sonIpucu?.eylem === "gec", 3000),
    EtkilesimOlaylari.sonIpucu?.metin ?? "ipucu yok");
  eBas();
  const donus = await gecisiIzle("oda");
  kontrol("E → ofistesin", donus.vardi, `yer=${d.yerler().ozyn.ad}`);
  kontrol("dönüş kararmanın arkasında", donus.enKoyu > 0.9, `en koyu ${donus.enKoyu.toFixed(2)}`);
  kontrol("Orion da ofiste, yanında", d.yerler().orion.ad === "oda" && mesafe() <= 2.5, `${mesafe().toFixed(2)} m`);
  kontrol("oda birebir geri: mesh sayısı", sahne.meshes.length === odaMesh, `${odaMesh} → ${sahne.meshes.length}`);
  kontrol("oda birebir geri: sis", sahne.fogDensity === odaSis, `${odaSis} → ${sahne.fogDensity}`);
  const odaAlgisi = d.algiSor("dunya").metin;
  // "kapı" tek başına yetmez: "ofis kapısı" da onu içerir (ilk sürüm dönüş olmadan geçmişti).
  kontrol("ofiste algı yine odanın nesnelerinden", /beyaz tahta|monitör|çalışma masası/.test(odaAlgisi) && !/boru duvarı|ofis kapısı/.test(odaAlgisi), odaAlgisi);
  bitir();
}

/** Ovadayken odanın meshleri kapalı mı (görüntüye sızmıyor). */
function odaKapali(d: SenaryoBaglami): boolean {
  return d.oda.meshler.every((m) => !m.isEnabled());
}
