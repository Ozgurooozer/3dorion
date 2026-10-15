// uygulama/senaryolar/gromadene.ts — `3dorion.bat gromadene`: ofisteki 3. monitör (groma haritası) canlıda (docs/olcum/on-kayit-groma-monitoru-1.md).
//
// Ön koşul: groma sunucusu ayakta (`C:\Users\ozigo\Desktop\groma-haritasi.bat`, localhost:4747). Kapalıysa senaryo bunu AÇIKÇA söyler ve KALDI verir
// (W4: ekran "groma kapalı" yazmalı).
//   W1  sayfa yüklenir (≤ 12 sn), ilk kare gelir (≤ 10 sn) ve doku DOLUDUR (tek renk değil).
//   W3  odağa geçilir; haritaya tekerlek ve tıklama iletilir; sayfa tepki verir (yeni kare gelir).
// Not (ön kayıt düzeltmesi, ölçmeden önce): ekran dışı pencere `paint`i yalnız sayfa DEĞİŞİNCE verir; durağan bir harita saniyede 25 kare üretmez.
// Bu yüzden "5 sn'de ≥ 25 kare" ölçütü yanlıştı; ölçüt "ilk kare + dolu doku + etkileşimde yeni kare" oldu.
// Ekran görüntüsü (ORION_SS) sonunda alınır: kamera odakta, monitör kadrajda.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[GROMADENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const olana = async (kosul: () => boolean, ms: number) => { for (let t = 0; t < ms; t += 200) { if (kosul()) return true; await bekle(200); } return kosul(); };

  await bekle(2500);
  const w = d.webMonitoru;
  const acildi = await olana(() => w.durum() === "acik", 12_000);
  kontrol("W1 sayfa yüklendi (groma ayakta)", acildi, `durum=${w.durum()}${acildi ? "" : " — masaüstündeki groma-haritasi.bat ile aç"}`);
  if (!acildi) { console.log(`[GROMADENE] KALDI — ${gecen}/${gecen + kalan}`); return; }

  const ilkKare = await olana(() => w.ekran.kareSayisi() >= 1, 10_000);
  kontrol("W1 ilk kare geldi", ilkKare, `kare=${w.ekran.kareSayisi()}`);
  await bekle(800);
  const doluluk = w.ekran.doluluk();
  kontrol("W1 doku dolu (tek renk değil)", doluluk > 0.05, `farklı piksel oranı=${doluluk.toFixed(3)}`);

  // Odak: kamera monitöre yaklaşır (ekran görüntüsü bunu gösterir); fare olayları sayfaya gider.
  d.panelOdak(d.oda.gromaEkran, "groma haritası");
  await bekle(1800);
  const once = w.ekran.kareSayisi();
  const iletildi = w.tekerlek(0.5, 0.5, -400, 0) && w.tikla(0.5, 0.5);
  const tepki = await olana(() => w.ekran.kareSayisi() > once, 4000);
  kontrol("W3 tekerlek ve tıklama sayfaya iletildi", iletildi);
  kontrol("W3 sayfa etkileşime tepki verdi (yeni kare)", tepki, `kare ${once} → ${w.ekran.kareSayisi()}`);

  await bekle(1200);
  console.log(`[GROMADENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
}
