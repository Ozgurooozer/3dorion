// uygulama/senaryolar/leveldene.ts — `3dorion.bat leveldene` (spec 42): YENİ LEVEL + IŞIK AKTÖRLERİ ÇALIŞMA ANINDA, geçici projede (ORION_SMOKE: gerçek projeye yazılmaz).
//
// Ölçülenler, hepsi SONUÇ olarak (gerçek DOM, gerçek Babylon ışığı, gerçek host dosyası):
//   L1  Işıklar dok paneli kayıtlı ve açılır; level hazır.                                  L2  "+ Nokta ışık": tanıma girer, sahnede GERÇEK PointLight olur, kirli rozeti çıkar.
//   L3  Details alanı (şiddet) canlı level'a yansır (PointLight.intensity).                 L4  gizle → sahnede açık ışık sayısı düşer; geri aç → döner. (setEnabled yalnız değişince)
//   L5  tavan: ISIK_TAVANI ışıkta "+" pasif, 9. ekleme reddedilir, tanım değişmez.          L6  GÜVENLİK: sentetik (isTrusted=false) 💾 Kaydet ve Oluştur tıklaması DİSKE YAZMAZ.
//   L7  host: yeni level yaz → oku (gidiş-dönüş); aynı ad 409; bozuk metin 400; kaydet yalnız `isiklar`ı değiştirir; olmayan level 404.
//   L8  Yeni level penceresi gerçek DOM'da: 4 şablon satırı, Esc kapatır.
//   L9–L11  Orion'un yeni level'a geçişi (2. aşama): zeminsiz level reddi, zeminli level'da özet, sentetik tık yazmaz, host sözleşmesi (yeniden başlatma senaryoda yok).
// Kareler ORION_SS_DIR'e PNG. Sonda eklenen ışıklar silinir (level eski hâline döner).
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import { ISIK_TAVANI } from "../../world/level/cekirdek/levelTanimi.ts";
import { ISIKLAR_PANELI_KIMLIGI } from "../yapi/level/isiklarPaneli.ts";
import { diskeYaz } from "../yapi/level/isikModeli.ts";
import { yeniTanim } from "../yapi/level/yeniLevelModeli.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[LEVELDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const bitir = () => console.log(`[LEVELDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
  const ss = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(400); };

  const { baglanti: b, level: levelGetir } = d.levelIsik;
  const kopru = window.kopru;
  const tik = async (e: Element | null) => { e?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await bekle(200); };
  const panelKok = () => b.isiklar.kok;
  const satirlar = () => [...panelKok().querySelectorAll<HTMLElement>(".il-satir")];

  // ── L1 ──
  d.ayarAc(); await bekle(300); d.ayarKapat();   // imleç kipi açık kalır: dok panelleri yalnız imleç kipinde görünür
  d.dok.sec(ISIKLAR_PANELI_KIMLIGI);
  await bekle(400);
  // Birleşik dünya (ova + ofis) asenkron kurulur: hazır olana dek bekle (en çok 25 sn).
  for (let n = 0; n < 125 && levelGetir() === null; n++) await bekle(200);
  const l0 = levelGetir();
  kontrol("L1 Işıklar paneli dok'ta açılır ve level hazır", d.dok.ekrandaMi(ISIKLAR_PANELI_KIMLIGI) && l0 !== null, `level=${l0 ? "hazır" : "yok"}`);
  if (!l0) { bitir(); return; }
  const ilkSayi = l0.tanim().isiklar?.length ?? 0;
  await ss("01_panel");

  // ── L2 ──
  const id1 = b.isiklar.ekle();
  await bekle(200);
  const ik1 = id1 ? l0.isiklar.isik(id1) : null;
  kontrol("L2 '+ Nokta ışık': tanıma girer, sahnede GERÇEK PointLight olur, kirli rozeti çıkar",
    id1 !== null && ik1 !== null && (l0.tanim().isiklar?.length ?? 0) === ilkSayi + 1 && b.isiklar.kirliMi() && /kaydedilmedi/.test(panelKok().querySelector(".il-rozet")?.textContent ?? ""),
    `id=${id1} sahnedeAcik=${l0.isiklar.say()} kirli=${b.isiklar.kirliMi()}`);
  await ss("02_isik_eklendi");

  // ── L2b: yeni ışık SEÇİLİ gelir, gizmo ona takılır, sahnede işareti var; sahnede başka işarete tıklamak onu seçer ──
  const g = b.isikGizmosu;
  await bekle(300);
  const bagliIlk = g.bagliId() === id1 && b.isiklar.secili() === id1 && g.isaretSayisi() >= 1;
  const id2 = b.isiklar.ekle([l0.isiklar.isik(id1!)!.position.x + 1.5, l0.isiklar.isik(id1!)!.position.y, l0.isiklar.isik(id1!)!.position.z]);
  await bekle(300);
  const ikinciSecili = id2 !== null && g.bagliId() === id2 && b.isiklar.secili() === id2;
  const nokta = id1 ? g.ekranNoktasi(id1) : null;
  const tuval = document.getElementById("tuval");
  if (nokta && tuval) tuval.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: nokta.clientX, clientY: nokta.clientY }));
  await bekle(300);
  const tiklaSecti = nokta !== null && b.isiklar.secili() === id1 && g.bagliId() === id1;
  kontrol("L2b yeni ışık SEÇİLİ gelir + taşı gizmosu takılır + sahne işareti; sahnede işarete tıklamak seçer",
    bagliIlk && ikinciSecili && tiklaSecti, `ilkBağlı=${bagliIlk} ikinciSeçili=${ikinciSecili} tıklaSeçti=${tiklaSecti} işaret=${g.isaretSayisi()}`);
  await ss("02b_gizmo");
  if (id2) { const s2 = satirlar().find((s) => s.dataset.id === id2); await tik([...(s2?.querySelectorAll<HTMLButtonElement>("button") ?? [])].pop() ?? null); }
  await tik(satirlar().find((s) => s.dataset.id === id1) ?? null);

  // ── L3 ──
  const satir1 = satirlar().find((s) => s.dataset.id === id1) ?? null;
  await tik(satir1);
  const sayiGirdileri = [...panelKok().querySelectorAll<HTMLInputElement>(".il-detay input[type=number]")];
  // Details sırası: konum X, Y, Z, şiddet, menzil
  const siddetG = sayiGirdileri[3] ?? null;
  if (siddetG) { siddetG.value = "4.5"; siddetG.dispatchEvent(new Event("change", { bubbles: true })); }
  await bekle(250);
  const yeniSiddet = id1 ? l0.isiklar.isik(id1)?.intensity ?? -1 : -1;
  kontrol("L3 Details'te şiddet → canlı PointLight.intensity", siddetG !== null && Math.abs(yeniSiddet - 4.5) < 1e-6, `girdi=${sayiGirdileri.length} intensity=${yeniSiddet}`);

  // ── L4 ──
  const aciktan = l0.isiklar.say();
  const goz = satirlar().find((s) => s.dataset.id === id1)?.querySelector<HTMLButtonElement>("button") ?? null;
  await tik(goz);
  const gizliyken = l0.isiklar.say();
  const goz2 = satirlar().find((s) => s.dataset.id === id1)?.querySelector<HTMLButtonElement>("button") ?? null;
  await tik(goz2);
  const geriAcik = l0.isiklar.say();
  kontrol("L4 gizle → açık ışık sayısı düşer, geri aç → döner", gizliyken === aciktan - 1 && geriAcik === aciktan, `açık=${aciktan} gizli=${gizliyken} geri=${geriAcik}`);

  // ── L4b: Details şemadan (spec 43 A2): mantıksal alan, değişken ekle/sil, graf seçimi ──
  const detay = () => panelKok().querySelector<HTMLElement>(".il-detay")!;
  const gizliKutu = () => [...detay().querySelectorAll("label")].find((x) => x.textContent === "Gizli")?.nextElementSibling as HTMLInputElement | undefined;
  const isik1 = () => l0.tanim().isiklar?.find((x) => x.id === id1);
  const gk = gizliKutu();
  if (gk) { gk.checked = true; gk.dispatchEvent(new Event("change", { bubbles: true })); await bekle(250); }
  const gizlendi = isik1()?.gizli === true && l0.isiklar.isik(id1!)!.isEnabled(false) === false;
  const gk2 = gizliKutu();
  if (gk2) { gk2.checked = false; gk2.dispatchEvent(new Event("change", { bubbles: true })); await bekle(250); }
  const geriAcildi = isik1()?.gizli !== true && l0.isiklar.isik(id1!)!.isEnabled(false) === true;
  const degAdG = detay().querySelector<HTMLInputElement>('input[placeholder="yeni değişken adı"]');
  if (degAdG) { degAdG.value = "hiz"; await tik(degAdG.parentElement?.querySelector("button") ?? null); }
  const degisken = isik1()?.degiskenler?.["hiz"];
  const silDugmesi = [...detay().querySelectorAll<HTMLButtonElement>(".il-tam button")].find((x) => x.title === "Değişkeni sil") ?? null;
  await tik(silDugmesi);
  const silindi = isik1()?.degiskenler === undefined;
  const ornekGraf = await d.graf.ornekOlustur();
  await bekle(300);
  b.isiklar.tazele();
  const grafSec = detay().querySelector<HTMLSelectElement>("select[title^='Bu aktörün grafı']");
  if (grafSec) { grafSec.value = ornekGraf; grafSec.dispatchEvent(new Event("change", { bubbles: true })); await bekle(250); }
  const grafAtandi = isik1()?.graf === ornekGraf;
  kontrol("L4b Details şemadan: Gizli kutusu ışığı söndürür/yakar; değişken ekle (tür sıfırıyla) ve sil; graf seçimi tanıma yazılır",
    gizlendi && geriAcildi && degisken === 0 && silindi && grafAtandi,
    `gizlendi=${gizlendi} geriAcildi=${geriAcildi} değişken=${String(degisken)} silindi=${silindi} graf=${isik1()?.graf}`);
  await ss("02c_details");

  // ── L5 ──
  while ((l0.tanim().isiklar?.length ?? 0) < ISIK_TAVANI) { if (b.isiklar.ekle() === null) break; }
  const doluSayi = l0.tanim().isiklar?.length ?? 0;
  const ekleD = [...panelKok().querySelectorAll<HTMLButtonElement>(".il-arac button")].find((x) => /Nokta ışık/.test(x.textContent ?? "")) ?? null;
  const dokuzuncu = b.isiklar.ekle();
  kontrol("L5 tavan: dolunca '+' pasif, ek ekleme reddedilir, tanım değişmez", doluSayi === ISIK_TAVANI && ekleD?.disabled === true && dokuzuncu === null && (l0.tanim().isiklar?.length ?? 0) === ISIK_TAVANI,
    `ışık=${doluSayi}/${ISIK_TAVANI} artıPasif=${ekleD?.disabled} sonEkleme=${dokuzuncu}`);
  await ss("03_tavan");

  // ── L6 (güvenlik) ──
  if (!kopru) { kontrol("L6/L7/L8 host yazma", false, "window.kopru yok (Electron dışı)"); bitir(); return; }
  const bilgi = await kopru.projeBilgi();
  const projeAdi = bilgi.ok && bilgi.deger ? bilgi.deger.varsayilanLevel : null;
  const oncekiDisk = projeAdi ? await kopru.projeLevelOku(projeAdi) : null;
  const kaydetD = [...panelKok().querySelectorAll<HTMLButtonElement>(".il-arac button")].find((x) => /Kaydet/.test(x.textContent ?? "")) ?? null;
  await tik(kaydetD);                      // sentetik: isTrusted=false
  await bekle(400);
  const sonraDisk = projeAdi ? await kopru.projeLevelOku(projeAdi) : null;
  const diskAyni = !!oncekiDisk && !!sonraDisk && oncekiDisk.ok && sonraDisk.ok && oncekiDisk.deger === sonraDisk.deger;
  const diskeIsikGirdi = !!sonraDisk && sonraDisk.ok && /"isiklar"/.test(sonraDisk.deger) && !/"isiklar"/.test((oncekiDisk && oncekiDisk.ok) ? oncekiDisk.deger : "");
  kontrol("L6 GÜVENLİK: sentetik 💾 Kaydet tıklaması diske YAZMAZ (isTrusted), kirli kalır", projeAdi !== null && diskAyni && !diskeIsikGirdi && b.isiklar.kirliMi(), `proje level=${projeAdi} diskAyni=${diskAyni}`);

  // ── L7 ──
  const yeniAd = `leveldene-${Date.now().toString(36)}`;   // geçici kök koşular arası kalabilir: her koşuda yeni ad
  const kopya = yeniTanim(l0.tanim(), "Level Dene", true);
  if (!kopya.ok) { kontrol("L7 yeni level tanımı üretilir", false, kopya.neden); bitir(); return; }
  const metin = JSON.stringify(kopya.deger, null, 2) + "\n";
  const olustur = await kopru.projeLevelOlustur(yeniAd, metin);
  const oku = await kopru.projeLevelOku(yeniAd);
  const gidisDonus = olustur.ok && oku.ok && JSON.parse(oku.deger).ad === kopya.deger.ad && !("isiklar" in (JSON.parse(oku.deger) as object));
  const tekrar = await kopru.projeLevelOlustur(yeniAd, metin);
  const bozuk = await kopru.projeLevelOlustur("leveldene-bozuk", "{bozuk");
  const olmayan = await kopru.projeLevelKaydet("leveldene-yok", metin);
  const yaz = oku.ok ? diskeYaz(oku.deger, l0.tanim().isiklar ?? []) : null;
  const kaydet = yaz && yaz.ok ? await kopru.projeLevelKaydet(yeniAd, yaz.deger) : null;
  const okuSonra = await kopru.projeLevelOku(yeniAd);
  const kaydedilen = okuSonra.ok ? (JSON.parse(okuSonra.deger) as { isiklar?: unknown[]; ad?: string; katmanlar?: unknown[] }) : null;
  const yalnizIsik = !!kaydedilen && (kaydedilen.isiklar?.length ?? 0) === ISIK_TAVANI && kaydedilen.ad === kopya.deger.ad && (kaydedilen.katmanlar?.length ?? 0) === kopya.deger.katmanlar.length;
  kontrol("L7a host: yeni level yaz → oku gidiş-dönüş", gidisDonus, `oluştur=${olustur.ok} oku=${oku.ok}`);
  kontrol("L7b host: aynı ad 409, bozuk metin 400, olmayan level kaydı 404",
    !tekrar.ok && String(tekrar.kod) === "409" && !bozuk.ok && String(bozuk.kod) === "400" && !olmayan.ok && String(olmayan.kod) === "404", `tekrar=${tekrar.ok ? "ok" : tekrar.kod} bozuk=${bozuk.ok ? "ok" : bozuk.kod} olmayan=${olmayan.ok ? "ok" : olmayan.kod}`);
  kontrol("L7c host: kaydet YALNIZ ışıkları yazar (öteki alanlar diskteki gibi)", !!kaydet && kaydet.ok && yalnizIsik, `kaydedilenIşık=${kaydedilen?.isiklar?.length}`);

  // ── L8 ──
  b.yeniLevel.ac();
  await bekle(400);
  const kok = document.querySelector<HTMLElement>(".yl-kok");
  const sablonSatiri = kok ? kok.querySelectorAll(".yl-sablon").length : 0;
  const acildi = b.yeniLevel.acikMi() && kok?.dataset.acik === "1";
  await ss("04_yeni_level");
  // Sentetik Oluştur: ad boş + sentetik tıklama → hiçbir şey yazılmaz
  const adG = kok?.querySelector<HTMLInputElement>("input[type=text]") ?? null;
  if (adG) { adG.value = "Sentetik Deneme"; adG.dispatchEvent(new Event("input", { bubbles: true })); }
  await tik([...(kok?.querySelectorAll<HTMLButtonElement>(".yl-alt button") ?? [])][0] ?? null);
  await bekle(400);
  const sentetikYazildi = (await kopru.projeLevelOku("sentetik-deneme")).ok;
  kok?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await bekle(250);
  kontrol("L8 Yeni level penceresi: 4 şablon satırı, sentetik Oluştur YAZMAZ, Esc kapatır", acildi && sablonSatiri === 4 && !sentetikYazildi && !b.yeniLevel.acikMi(), `şablon=${sablonSatiri} sentetikYazıldı=${sentetikYazildi} kapandı=${!b.yeniLevel.acikMi()}`);

  // ── L9–L11: ORION'UN YENİ LEVEL'A GEÇİŞİ (spec 42 2. aşama): onay penceresi + host sözleşmesi (yeniden başlatma senaryo koşusunda YOK) ──
  const zeminsizAd = `leveldene-zeminsiz-${Date.now().toString(36)}`;
  const zeminsizTanim = { ...kopya.deger, katmanlar: kopya.deger.katmanlar.filter((k) => k.tur !== "zemin") };
  await kopru.projeLevelOlustur(zeminsizAd, JSON.stringify(zeminsizTanim, null, 2) + "\n");
  const gecKok = () => document.querySelectorAll<HTMLElement>(".yl-kok")[1] ?? null;   // ikinci .yl-kok: geçiş penceresi (ilki Yeni level)
  const gecDugme = () => gecKok()?.querySelector<HTMLButtonElement>(".yl-alt button") ?? null;
  const gecMesaj = () => gecKok()?.querySelector(".yl-mesaj")?.textContent ?? "";
  await b.levelGecis.sor(zeminsizAd);
  await bekle(300);
  kontrol("L9 geçiş penceresi: zeminsiz level REDDEDİLİR, neden söylenir, düğme pasif", b.levelGecis.acikMi() && gecDugme()?.disabled === true && /zemin katmanı yok/.test(gecMesaj()), `mesaj="${gecMesaj()}" pasif=${gecDugme()?.disabled}`);
  await ss("06_gecis_reddi");
  await b.levelGecis.sor(yeniAd);
  await bekle(300);
  const ozetMetni = gecKok()?.textContent ?? "";
  kontrol("L10 geçiş penceresi: zeminli level'da özet + etkin düğme (katman/nesne/ışık sayıları)", gecDugme()?.disabled === false && /\d+ katman · \d+ nesne · \d+ ışık/.test(ozetMetni), `düğme pasif=${gecDugme()?.disabled} özet="${(ozetMetni.match(/klasör:[^⚠]*/) ?? [""])[0]}"`);
  await ss("07_gecis_onay");
  await tik(gecDugme());   // sentetik: isTrusted=false → hiçbir şey yazılmamalı
  await bekle(300);
  const ilk = await kopru.projeVarsayilanLevel(yeniAd);   // yazılmışsa "zaten açılış level'ı", yazılmamışsa senaryo koşusu nedeni (+ şimdi yazar)
  const tekrarGec = await kopru.projeVarsayilanLevel(yeniAd);
  const olmayanGec = await kopru.projeVarsayilanLevel("leveldene-olmayan");
  const kacisGec = await kopru.projeVarsayilanLevel("../ova");
  kontrol("L11 GÜVENLİK + host: sentetik tık açılış level'ını DEĞİŞTİRMEZ; gerçek çağrı yazar (yeniden başlatma yok), tekrar 'zaten', olmayan 'yok', kaçış 'gecersiz-ad'",
    ilk.ok && ilk.deger.yeniden === false && /senaryo/.test(ilk.deger.neden ?? "") && ilk.deger.varsayilanLevel === yeniAd
      && tekrarGec.ok && /zaten/.test(tekrarGec.deger.neden ?? "")
      && !olmayanGec.ok && String(olmayanGec.kod) === "yok" && !kacisGec.ok && String(kacisGec.kod) === "gecersiz-ad",
    `ilk=${ilk.ok ? ilk.deger.neden : ilk.kod} tekrar=${tekrarGec.ok ? tekrarGec.deger.neden : tekrarGec.kod} olmayan=${olmayanGec.ok ? "ok" : olmayanGec.kod} kaçış=${kacisGec.ok ? "ok" : kacisGec.kod}`);
  if (projeAdi) await kopru.projeVarsayilanLevel(projeAdi);   // geçici projeyi eski açılış level'ına geri ver
  gecKok()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await bekle(250);

  // ── temizlik: eklenen ışıklar silinir (kirli kalmasın) ──
  for (let n = 0; n < 2 * ISIK_TAVANI && satirlar().length > 0; n++) await tik([...satirlar()[0]!.querySelectorAll<HTMLButtonElement>("button")].pop() ?? null);
  await bekle(200);
  await ss("05_temiz");
  bitir();
}
