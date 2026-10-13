// uygulama/senaryolar/ortamdene.ts — `3dorion.bat ortamdene`: Orion'un ORTAM aracı canlıda (Ozyn, 2026-10-13).
//
// Ova'ya çıkılır; Ozyn'in ağzından sözler `kopru.algi` ile verilir (klavyeyle AYNI yol) ve her adımda ova'nın GERÇEK tanımına
// bakılır (`d.ortam.tanim()`), köprü sayaçlarına bakılır (LLM uyandı mı). Adımlar:
//   1) sözlük (token'sız): gece yap · saat 21 · ışığı kıs · toon yap · bloom kapat · sis aç → LLM'in düşünme sayısı ARTMAZ
//   2) LLM yolu: sözlüğün bilmediği serbest ifade → ortam aracı çağrılır (Haiku önerilir); başarırsa söz ÖĞRENİLİR
//   3) öğrenen sözlük: aynı söz ikinci kez → LLM uyanmaz
//   4) kalıcılık: kalıcı kipte ofise dön, tekrar çık → ayar geri gelir
//   5) sıfırla: açılıştaki hâle döner
// Sonuç satırları `[ORTAMDENE] GECTI/KALDI …`; ekran görüntüsü (ORION_SS) sonunda alınır. LLM adımı Haiku'nun tek atışına
// bağlıdır (spec ölçümü: ilk atış ~%38): KALDI çıkarsa bu bir kusur değil bir ÖLÇÜMDÜR, sonuç olduğu gibi yazılır.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import { onayarAdi } from "../../world/level/stil/stilTanimi.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[ORTAMDENE] " + m);
  const sonuc: string[] = [];
  const kontrol = (ad: string, ok: boolean, ek = "") => { sonuc.push(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const olana = async (kosul: () => boolean, ms: number) => {
    for (let t = 0; t < ms; t += 200) { if (kosul()) return true; await bekle(200); }
    return kosul();
  };
  const dusunme = () => d.kopru?.sayac().dusunme ?? 0;
  const soyle = async (soz: string, ms = 1200) => {
    log(`söz: "${soz}"`);
    d.kopru?.algi({ tur: "duydum", metin: soz, kesin: true });
    await bekle(ms);
  };
  const pozlama = () => d.ortam.tanim()?.ortam.tonlama.pozlama ?? NaN;

  await bekle(2500);
  if (!d.kopru) { log("köprü yok (beyin kapalı?): senaryo koşamaz"); return; }

  // 0) ofiste (level yok) sözlük sahiplenmez
  kontrol("ofiste ova yok (ortam bağlı değil)", d.ortam.tanim() === null);

  if (!(await d.ovayaCik())) { log("ovaya çıkılamadı"); return; }
  await bekle(1500);
  const ilk = d.ortam.tanim();
  kontrol("ova'da level bağlı", !!ilk);
  if (!ilk) return;
  const pozIlk = pozlama();
  log(`açılış: stil=${onayarAdi(ilk)} saat=${ilk.zaman?.saat ?? "-"} pozlama=${pozIlk} sis=${ilk.ortam.sis.acik}`);

  // 1) sözlük: token'sız
  const d0 = dusunme();
  await soyle("gece yap");
  kontrol("'gece yap' → saat 0", d.ortam.tanim()?.zaman?.saat === 0, `saat=${d.ortam.tanim()?.zaman?.saat}`);
  await soyle("saat 21");
  kontrol("'saat 21' → saat 21", d.ortam.tanim()?.zaman?.saat === 21, `saat=${d.ortam.tanim()?.zaman?.saat}`);
  const p1 = pozlama();
  await soyle("ışığı kıs");
  kontrol("'ışığı kıs' → pozlama düştü", pozlama() < p1, `${p1} → ${pozlama()}`);
  await soyle("toon yap");
  kontrol("'toon yap' → stil toon", onayarAdi(d.ortam.tanim()!) === "toon", `stil=${onayarAdi(d.ortam.tanim()!)}`);
  await soyle("bloom kapat");
  kontrol("'bloom kapat' → bloom kapalı", d.ortam.tanim()?.stil?.son.bloom.acik === false);
  await soyle("sis aç");
  kontrol("'sis aç' → sis açık", d.ortam.tanim()?.ortam.sis.acik === true);
  kontrol("sözlük yolunda LLM HİÇ uyanmadı (token yok)", dusunme() === d0, `düşünme ${d0} → ${dusunme()}`);

  // 2) LLM yolu + öğrenme
  const ogr0 = d.ortam.ogrenilenSayisi();
  const onceki = JSON.stringify(d.ortam.tanim());
  const d1 = dusunme();
  await soyle("burası çok karanlık", 500);
  await olana(() => dusunme() > d1, 30_000);
  await bekle(6000);   // araç çağrısı + sonuç + öğrenme
  const degisti = JSON.stringify(d.ortam.tanim()) !== onceki;
  kontrol("serbest ifade LLM'e gitti ve ova DEĞİŞTİ (ortam aracı çağrıldı)", dusunme() > d1 && degisti, `düşünme +${dusunme() - d1}, değişti=${degisti}`);
  const ogr1 = d.ortam.ogrenilenSayisi();
  kontrol("başarılı LLM yapışı söz olarak ÖĞRENİLDİ", ogr1 === ogr0 + 1, `öğrenilen ${ogr0} → ${ogr1}`);

  // 3) ikinci sefer: LLM uyanmaz
  if (ogr1 > ogr0) {
    await soyle("ışığı kıs");   // pozlamayı bir adım daha oynat ki 'aynı söz' etkisi görülsün
    const d2 = dusunme(), p2 = pozlama();
    await soyle("burası çok karanlık", 1800);
    kontrol("öğrenilen söz ikinci sefer token'sız (LLM uyanmadı)", dusunme() === d2, `düşünme ${d2} → ${dusunme()}`);
    kontrol("öğrenilen söz ova'yı yine değiştirdi", pozlama() !== p2 || JSON.stringify(d.ortam.tanim()) !== onceki);
  }

  // 4) kalıcılık (kalıcı kip): ofise dön, tekrar çık
  d.ortam.kipAyarla("kalici");
  await soyle("anime 90 yap");
  const stilKalici = onayarAdi(d.ortam.tanim()!);
  d.ortam.odayaDon();
  await bekle(1500);
  kontrol("ofise dönünce level yok", d.ortam.tanim() === null);
  await d.ovayaCik();
  await bekle(2000);
  kontrol("tekrar çıkınca ayar HATIRLANDI (kalıcı kip)", d.ortam.tanim() !== null && onayarAdi(d.ortam.tanim()!) === stilKalici, `stil=${d.ortam.tanim() ? onayarAdi(d.ortam.tanim()!) : "-"} (beklenen ${stilKalici})`);
  d.ortam.kipAyarla("oturum");   // temizle: bu koşu tarayıcı deposunda iz bırakmasın

  // 5) sıfırla
  await soyle("ortamı sıfırla");
  const t = d.ortam.tanim()!;
  kontrol("'ortamı sıfırla' → açılış hâli", pozlama() === pozIlk && onayarAdi(t) === onayarAdi(ilk) && t.ortam.sis.acik === ilk.ortam.sis.acik && t.zaman?.saat === ilk.zaman?.saat,
    `pozlama=${pozlama()} stil=${onayarAdi(t)} saat=${t.zaman?.saat}`);

  // ekran görüntüsü için güzel bir hâl
  await soyle("akşam yap");
  await soyle("toon yap");
  await bekle(2500);

  for (const r of sonuc) log(r);
  log(`ozet: ${sonuc.filter((r) => r.startsWith("GECTI")).length}/${sonuc.length}`);
}
