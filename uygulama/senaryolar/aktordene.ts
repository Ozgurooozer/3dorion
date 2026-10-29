// uygulama/senaryolar/aktordene.ts — `3dorion.bat aktordene` (spec 43 A3 + A4): AKTÖR GRAFI + HATA AYIKLAMA ÇALIŞMA ANINDA, gerçek ışık + gerçek graf deposu + gerçek çalıştırıcı + gerçek editör.
//
// Ölçülenler, hepsi SONUÇ olarak (gerçek DOM, gerçek Babylon ışığı, gerçek yorumlayıcı):
//   A1  Details'te graf seçilir (tanıma yazılır), ▶ ■ düğmeleri görünür; ▶ etkin, ■ pasif.
//   A2  GÜVENLİK: sentetik (isTrusted=false) ▶ tıklaması grafı BAŞLATMAZ.
//   A3  çalışırken: graf @bu ışığı kısar/söndürür, aktör değişkenini okuyup yazar; level TANIMI değişmez; Details'te ▶ pasif, ■ etkin.
//   A4  ■ durdurunca ışık çalışma öncesi hâline döner; geçici yazma kalmaz.
//   A5  graf sonuna kadar çalışır; bitince ışık geri gelir, son sonuç "bitti".
//   A6  hata: olmayan aktörü yazan graf nedenle düşer, hiçbir şey kalıcı değişmez.
//   A7  aynı aktörde ikinci ▶ reddedilir.
//   A8  (A4) editörde akışlı düğümde kesme noktası düğmesi var, saf düğümde yok; tıklayınca kesme noktası konur.
//   A9  çalışma kesme noktasında BAŞLAMADAN durur: düğüm 'duraklamış' görünür, sağ panelde ⏸ ve izlenen değişken satırı, Devam açık; sentetik Devam tıklaması SÜRDÜRMEZ.
//   A10 Devam sürdürür (kesme düğümü koşar), günlük bölümü düğümleri girdi/çıktıyla gösterir.
//   A11 Adım: bir düğüm ilerleyip sıradaki akışlı düğümde yine durur; ■ duraklamayı keser, ışık geri gelir, kesme noktası kaldırılır.
// Kareler ORION_SS_DIR'e PNG. Sonda eklenen ışık silinir.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Graf } from "../../protocol/graf.ts";
import { ISIK_TAVANI } from "../../world/level/cekirdek/levelTanimi.ts";
import { ISIKLAR_PANELI_KIMLIGI } from "../yapi/level/isiklarPaneli.ts";
import { AKTOR_DUGUMU } from "../graf/aktorDugumleri.ts";

const KIS = "aktordene_kis", HATA = "aktordene_hata";
const kisGrafi = (): Graf => ({
  surum: 1, ad: KIS, tur: "olay", girisler: [], cikislar: [],
  dugumler: [
    { id: "b", tip: "olay.basla", konum: [40, 40] },
    { id: "w1", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "siddet", deger: 0.2 }, konum: [280, 40] },
    { id: "dv", tip: AKTOR_DUGUMU.degiskenYaz, ayar: { ad: "hiz", deger: 7 }, konum: [520, 40] },
    { id: "do", tip: AKTOR_DUGUMU.degiskenOku, ayar: { ad: "hiz" }, konum: [520, 200] },
    { id: "w3", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "menzil" }, konum: [760, 40] },
    { id: "w2", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "gizli", deger: true }, konum: [1000, 40] },
    { id: "bk", tip: "akis.bekle", ayar: { ms: 2500 }, konum: [1240, 40] },
  ],
  baglar: [
    { kaynak: ["b", "sonra"], hedef: ["w1", "giris"] }, { kaynak: ["w1", "sonra"], hedef: ["dv", "giris"] }, { kaynak: ["dv", "sonra"], hedef: ["w3", "giris"] },
    { kaynak: ["do", "deger"], hedef: ["w3", "deger"] }, { kaynak: ["w3", "sonra"], hedef: ["w2", "giris"] }, { kaynak: ["w2", "sonra"], hedef: ["bk", "giris"] },
  ],
});
const hataGrafi = (): Graf => ({
  surum: 1, ad: HATA, tur: "olay", girisler: [], cikislar: [],
  dugumler: [{ id: "b", tip: "olay.basla", konum: [40, 40] }, { id: "w", tip: AKTOR_DUGUMU.yaz, ayar: { aktor: "hayalet", alan: "siddet", deger: 1 }, konum: [280, 40] }],
  baglar: [{ kaynak: ["b", "sonra"], hedef: ["w", "giris"] }],
});

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[AKTORDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const bitir = () => console.log(`[AKTORDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
  const ss = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(400); };

  const { baglanti: b, level: levelGetir } = d.levelIsik;
  const tik = async (e: Element | null) => { e?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await bekle(200); };
  const panelKok = () => b.isiklar.kok;
  const satirlar = () => [...panelKok().querySelectorAll<HTMLElement>(".il-satir")];
  const detay = () => panelKok().querySelector<HTMLElement>(".il-detay");
  const dugmeler = () => {
    const t = [...(detay()?.querySelectorAll<HTMLButtonElement>(".il-tam button") ?? [])];
    return { oynat: t.find((x) => x.textContent === "▶") ?? null, durdur: t.find((x) => x.textContent === "■") ?? null };
  };

  // ── hazırlık: panel + level + bir ışık + graflar ──
  d.ayarAc(); await bekle(300); d.ayarKapat();
  d.dok.sec(ISIKLAR_PANELI_KIMLIGI);
  await bekle(400);
  for (let n = 0; n < 125 && levelGetir() === null; n++) await bekle(200);
  const l0 = levelGetir();
  if (!l0) { kontrol("A0 level hazır", false, "level yok"); bitir(); return; }
  const id1 = b.isiklar.ekle();
  await bekle(300);
  const isik = id1 ? l0.isiklar.isik(id1) : null;
  if (!id1 || !isik) { kontrol("A0 ışık eklendi", false, `id=${id1}`); bitir(); return; }
  const baslangic = { siddet: isik.intensity, menzil: isik.range };
  const adlar = d.graf.adlar();
  for (const g of [kisGrafi(), hataGrafi()]) if (!adlar.includes(g.ad)) await d.graf.yeni(g);
  await bekle(300);
  b.isiklar.sec(id1);
  b.isiklar.tazele();
  // Aktör değişkeni: Details'ten "hiz" (sayı) ekle, değerini 3 yap (graf 7 yazacak; okuma ezmeyi görmeli)
  const degAd = detay()?.querySelector<HTMLInputElement>('input[placeholder="yeni değişken adı"]') ?? null;
  if (degAd) { degAd.value = "hiz"; await tik(degAd.parentElement?.querySelector("button") ?? null); }
  const hizG = [...(detay()?.querySelectorAll<HTMLInputElement>(".il-tam input[type=number]") ?? [])][0] ?? null;
  if (hizG) { hizG.value = "3"; hizG.dispatchEvent(new Event("change", { bubbles: true })); await bekle(250); }
  const isikTanimi = () => l0.tanim().isiklar?.find((x) => x.id === id1);

  // ── A1 ──
  const sec = detay()?.querySelector<HTMLSelectElement>("select[title^='Bu aktörün grafı']") ?? null;
  if (sec) { sec.value = KIS; sec.dispatchEvent(new Event("change", { bubbles: true })); await bekle(300); }
  const d1 = dugmeler();
  kontrol("A1 Details'te graf seçilir (tanıma yazılır); ▶ etkin, ■ pasif",
    isikTanimi()?.graf === KIS && d1.oynat !== null && d1.durdur !== null && !d1.oynat.disabled && d1.durdur.disabled && isikTanimi()?.degiskenler?.["hiz"] === 3,
    `graf=${isikTanimi()?.graf} ▶=${d1.oynat ? !d1.oynat.disabled : "yok"} ■pasif=${d1.durdur?.disabled} hiz=${isikTanimi()?.degiskenler?.["hiz"]}`);
  await ss("01_details_graf");

  // ── A2: sentetik ▶ BAŞLATMAZ ──
  await tik(d1.oynat);
  await bekle(500);
  kontrol("A2 GÜVENLİK: sentetik ▶ tıklaması grafı başlatmaz", d.aktorGraf.sayi() === 0 && isik.intensity === baslangic.siddet,
    `çalışan=${d.aktorGraf.sayi()} şiddet=${isik.intensity}`);

  // ── A3: gerçek çalıştırıcıyla (senaryo yüzü) ──
  const acikOnce = l0.isiklar.say();
  const r1 = d.aktorGraf.calistir(id1, KIS);
  await bekle(900);
  const ortada = {
    siddet: isik.intensity, menzil: isik.range, acik: isik.isEnabled(false), calisan: d.aktorGraf.calisiyor(id1), say: l0.isiklar.say(),
    tanimSiddet: isikTanimi()?.siddet, tanimGizli: isikTanimi()?.gizli ?? false, tanimHiz: isikTanimi()?.degiskenler?.["hiz"],
  };
  b.isiklar.tazele();
  const d3 = dugmeler();
  kontrol("A3 çalışırken: graf @bu ışığı kıstı (şiddet 0.2), değişkeni okuyup menzile yazdı (7), ışığı söndürdü; TANIM değişmedi; ▶ pasif, ■ etkin",
    r1.ok && Math.abs(ortada.siddet - 0.2) < 1e-6 && Math.abs(ortada.menzil - 7) < 1e-6 && !ortada.acik && ortada.calisan && ortada.say === acikOnce - 1 &&
    ortada.tanimSiddet === baslangic.siddet && !ortada.tanimGizli && ortada.tanimHiz === 3 && d3.oynat?.disabled === true && d3.durdur?.disabled === false,
    `ok=${r1.ok} ${JSON.stringify(ortada)} ▶pasif=${d3.oynat?.disabled} ■pasif=${d3.durdur?.disabled}`);
  await ss("02_calisirken");

  // ── A7: aynı aktörde ikinci ▶ ──
  const r2 = d.aktorGraf.calistir(id1, KIS);
  kontrol("A7 aynı aktörde ikinci ▶ nedenle reddedilir", !r2.ok && /zaten/.test(r2.neden), r2.ok ? "kabul edildi!" : r2.neden);

  // ── A4: ■ ──
  const durdu = d.aktorGraf.durdur(id1);
  await d.aktorGraf.bitti();
  await bekle(200);
  const sonra = { siddet: isik.intensity, menzil: isik.range, acik: isik.isEnabled(false), say: l0.isiklar.say(), calisan: d.aktorGraf.calisiyor(id1), gecici: b.aktor.gecici() };
  b.isiklar.tazele();
  const durumYazisi = [...(detay()?.querySelectorAll(".il-degisken-ad") ?? [])].map((x) => x.textContent ?? "").find((t) => /durduruldu/.test(t)) ?? "";
  kontrol("A4 ■: ışık çalışma öncesi hâline döner (şiddet, menzil, açık), geçici yazma kalmaz, Details 'durduruldu' yazar",
    durdu && sonra.siddet === baslangic.siddet && sonra.menzil === baslangic.menzil && sonra.acik && sonra.say === acikOnce && !sonra.calisan && sonra.gecici.length === 0 && durumYazisi !== "",
    `${JSON.stringify(sonra)} yazı='${durumYazisi}'`);
  await ss("03_durdu");

  // ── A5: sonuna kadar ──
  const r3 = d.aktorGraf.calistir(id1, KIS);
  await bekle(600);
  const calisirken = isik.isEnabled(false);
  await d.aktorGraf.bitti();
  await bekle(250);
  b.isiklar.tazele();
  const yaziBitti = [...(detay()?.querySelectorAll(".il-degisken-ad") ?? [])].map((x) => x.textContent ?? "").find((t) => /bitti/.test(t)) ?? "";
  kontrol("A5 sonuna kadar çalışır; bitince ışık geri gelir, geçici yazma kalmaz, Details '✓ … bitti' yazar",
    r3.ok && calisirken === false && isik.isEnabled(false) && isik.intensity === baslangic.siddet && isik.range === baslangic.menzil && b.aktor.gecici().length === 0 && yaziBitti !== "",
    `ok=${r3.ok} çalışırkenAçık=${calisirken} son: açık=${isik.isEnabled(false)} şiddet=${isik.intensity} yazı='${yaziBitti}'`);

  // ── A6: hata ──
  const r4 = d.aktorGraf.calistir(id1, HATA);
  await d.aktorGraf.bitti();
  await bekle(250);
  b.isiklar.tazele();
  const yaziHata = [...(detay()?.querySelectorAll(".il-degisken-ad") ?? [])].map((x) => x.textContent ?? "").find((t) => /✗/.test(t)) ?? "";
  kontrol("A6 hata: olmayan aktörü yazan graf nedenle düşer, ışık değişmez, geçici yazma kalmaz",
    r4.ok && /level'da yok/.test(yaziHata) && isik.intensity === baslangic.siddet && b.aktor.gecici().length === 0, `yazı='${yaziHata}'`);
  await ss("04_hata");

  // ── A4: hata ayıklama (editörde kesme noktası, duraklama, Devam/Adım, günlük) ──
  const ge = () => document.querySelector<HTMLElement>(".ge-kok");
  const dugum = (id: string) => ge()?.querySelector<HTMLElement>(`.ge-dugum[data-id="${id}"]`) ?? null;
  d.graf.ac(KIS);
  await bekle(900);
  const noktaW2 = () => dugum("w2")?.querySelector<HTMLButtonElement>(".ge-kesme") ?? null;
  const safDugumNokta = dugum("do")?.querySelector(".ge-kesme") ?? null;
  const w2Nokta = noktaW2();
  kontrol("A8 editör açıldı; akışlı düğümde (w2) kesme noktası düğmesi VAR, saf düğümde (do) YOK", ge()?.dataset.acik === "1" && w2Nokta !== null && safDugumNokta === null,
    `editör=${ge()?.dataset.acik} w2Nokta=${w2Nokta !== null} safNokta=${safDugumNokta !== null}`);
  await tik(w2Nokta);
  await bekle(250);
  const kesmeKondu = dugum("w2")?.dataset.kesme === "1";
  kontrol("A8b kesme noktasına tıklayınca düğümde kırmızı nokta (data-kesme=1)", kesmeKondu, `kesme=${dugum("w2")?.dataset.kesme}`);

  const rB = d.aktorGraf.calistir(id1, KIS);
  await bekle(900);
  const duran = d.aktorGraf.duraklayan();
  const siddetDuraklamada = isik.intensity, acikDuraklamada = isik.isEnabled(false);
  const panelMetni = () => ge()?.querySelector<HTMLElement>(".ge-sag")?.textContent ?? "";
  const devamD = () => [...(ge()?.querySelectorAll<HTMLButtonElement>(".ge-devam") ?? [])][0] ?? null;
  const devamAcik = devamD()?.disabled === false;
  await tik(devamD());   // SENTETİK: isTrusted=false → sürdürmemeli
  await bekle(400);
  const hala = d.aktorGraf.duraklayan();
  const kare = async () => ss("05_duraklama");
  kontrol("A9 çalışma w2'de BAŞLAMADAN durdu (w1 koştu: şiddet 0.2; w2 koşmadı: ışık hâlâ açık); düğüm 'duraklamış'; sağ panelde ⏸; Devam açık; sentetik Devam SÜRDÜRMEZ",
    rB.ok && duran.join() === "w2" && Math.abs(siddetDuraklamada - 0.2) < 1e-6 && acikDuraklamada && dugum("w2")?.dataset.duraklamis === "1" && /⏸/.test(panelMetni()) && devamAcik && hala.join() === "w2",
    `ok=${rB.ok} duran=${duran} şiddet=${siddetDuraklamada} açık=${acikDuraklamada} duraklamış=${dugum("w2")?.dataset.duraklamis} ⏸=${/⏸/.test(panelMetni())} devamAçık=${devamAcik} sentetikSonrasıDuran=${hala}`);
  await kare();

  d.aktorGraf.devam();
  await bekle(700);
  const gunlukSatirlari = [...(ge()?.querySelectorAll<HTMLElement>(".ge-gunluk div") ?? [])].map((x) => x.textContent ?? "");
  const w2Satiri = gunlukSatirlari.find((t) => /^w2 \(/.test(t)) ?? "";
  kontrol("A10 Devam: w2 koştu (ışık söndü), çalışma sürüyor (Bekle); günlük bölümü düğümleri girdi/çıktıyla gösterir",
    d.aktorGraf.duraklayan().length === 0 && !isik.isEnabled(false) && d.aktorGraf.calisiyor(id1) && gunlukSatirlari.length >= 4 && /deger=true/.test(w2Satiri),
    `duran=${d.aktorGraf.duraklayan().length} açık=${isik.isEnabled(false)} satır=${gunlukSatirlari.length} w2='${w2Satiri}'`);
  await ss("06_devam_gunluk");
  d.aktorGraf.durdur(id1);
  await d.aktorGraf.bitti();

  // Adım: yeniden başlat → w2'de dur → Adım → bir sonraki akışlı düğümde (bk) dur
  const rC = d.aktorGraf.calistir(id1, KIS);
  await bekle(700);
  const once = d.aktorGraf.duraklayan().join();
  d.aktorGraf.adim();
  await bekle(500);
  const adimSonrasi = d.aktorGraf.duraklayan().join();
  const adimdaAcik = isik.isEnabled(false);
  d.aktorGraf.durdur(id1);
  await d.aktorGraf.bitti();
  await bekle(250);
  const kalanDuraklama = d.aktorGraf.duraklayan().length;
  const geriGeldi = isik.isEnabled(false) && isik.intensity === baslangic.siddet;
  await tik(noktaW2());
  await bekle(250);
  const kesmeKalkti = dugum("w2")?.dataset.kesme === "0";
  kontrol("A11 Adım: w2'de duran çalışma bir adım sonra 'bk'de durur (w2 koştu: ışık söndü); ■ duraklamayı keser, ışık geri gelir, bekleyen kalmaz; kesme noktası kaldırılır",
    rC.ok && once === "w2" && adimSonrasi === "bk" && adimdaAcik === false && kalanDuraklama === 0 && geriGeldi && kesmeKalkti,
    `önce=${once} sonra=${adimSonrasi} adımdaAçık=${adimdaAcik} kalanDuraklama=${kalanDuraklama} geriGeldi=${geriGeldi} kesmeKalktı=${kesmeKalkti}`);
  d.graf.gizle();
  await bekle(400);

  // ── temizlik ──
  for (let n = 0; n < 2 * ISIK_TAVANI && satirlar().length > 0; n++) await tik([...satirlar()[0]!.querySelectorAll<HTMLButtonElement>("button")].pop() ?? null);
  await bekle(200);
  bitir();
}
