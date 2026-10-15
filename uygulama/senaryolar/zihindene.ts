// uygulama/senaryolar/zihindene.ts — `3dorion.bat zihindene` (spec 14 R3: uygulama/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── ZİHİN DUVARI denemesi (?zihindene=1) ──────────────────────────────────
// İki paneli beyin olmadan sürer: çizim, yerleşim ve okunabilirlik gözle
// doğrulanabilsin. Sağlayıcı kotası doluyken de koşar — panellerin doğruluğu
// modele bağlı olmamalı.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DUGUMLER } from "../../world/surfaces/duvar/semaCekirdek.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { motor, sahne, rig, oda, gunluk, sema, panelOdak, panoyuAl } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(1200);
  // Kamerayı zihin duvarına çevir ki panel ekranda olsun.
  // İKİ paneli birden çerçevele: duvarın ortasına, geriden bak.
  rig.sinematikBak(new Vector3(4.9, 1.72, 0), 5.2, 0.15, 0);

  const tur = async (
    ozet: string, terfi: boolean, sure: string, niyet: string | null,
  ) => {
    sema.vur("algi", "terminal"); sema.vur("suzgec");
    gunluk.ekle("bilgi", "algi", ozet);
    await bekle(260);
    sema.vur(terfi ? "dikkat" : "refleks", terfi ? "" : "süzüldü");
    if (!terfi) { gunluk.ekle("bilgi", "suzgec", `süzüldü: ${ozet}`); return; }
    await bekle(200);
    sema.vur("hafiza", "2 anı");
    sema.vur("beyin", "düşünüyor…"); sema.durumYaz("düşünüyor");
    await bekle(900);
    sema.vur("beyin", sure); sema.durumYaz(`son düşünce ${sure}`);
    if (!niyet) { gunluk.ekle("bilgi", "beyin", "eylem üretmedi"); return; }
    await bekle(200);
    sema.vur("bakis", "onumde");
    sema.vur("niyet", niyet);
    gunluk.ekle("iyi", "orion", `${niyet} niyeti üretildi`);
    await bekle(200);
    sema.vur("beden", niyet);
  };

  await tur("npm bağımlılık ağacı yazdırıldı", false, "", null);
  await bekle(700);
  await tur("komut HATA ile bitti (kod 1): gti tanınmıyor", true, "3.4 sn", "soyle");
  await bekle(900);

  // Onay yolu
  sema.vur("onay", "bekliyor (okur)");
  gunluk.ekle("bilgi", "onay", "önerildi: git status — yazım hatası düzeltmesi");
  await bekle(1400);
  sema.vur("onay", "onaylandı");
  gunluk.ekle("iyi", "onay", "onaylandı (okur): git status");
  await bekle(1200);

  // Arıza yolu — kota senaryosu, canlıda yaşandığı gibi.
  sema.ariza("beyin", true, "kota doldu");
  sema.durumYaz("düşünce kapalı — sağlayıcı kotası doldu, kurallı kipte");
  gunluk.ekle("hata", "beyin", "sağlayıcı kotası doldu — APIError 429: free-models-per-day");
  await bekle(2000);

  // Toparlanma
  sema.vur("beyin", "8.6 sn");
  sema.durumYaz("düşünce geri geldi");
  gunluk.ekle("iyi", "beyin", "sağlayıcı yeniden yanıt veriyor");
  console.log(`[ZIHINDENE] gunluk satirlari=${gunluk.satirlar().length}`);

  // ── AYNA KONTROLÜ — göz kararı değil, ışın testi ────────────────────
  //
  // Birim testi UV→düğüm matematiğini kanıtlıyor ama ARADAKİ zinciri
  // kanıtlayamaz: mesh dönük, malzemenin arka yüzü açık ve kamera panele
  // hangi taraftan baktığını bilmiyoruz. Yüzey ters taraftan görünüyorsa
  // gördüğün ALGI'ya tıklarsın, ışın BEDEN'in UV'sine düşer. Panel
  // çökmez, yalnızca "biraz şaşı" görünür — tam olarak sessiz hata.
  //
  // Varsayımsız ölçüm: ekrana ızgara atıp her noktayı GERÇEK `sahne.pick`
  // ile çözüyoruz, sonra düğümlerin ekran-X sırasını şemadaki sütun
  // sırasıyla karşılaştırıyoruz. UV yerleşimi hakkında hiçbir kabul yok.
  panelOdak(oda.semaYuzey, "beyin şeması");
  await bekle(1400);

  // ÖN KOŞUL ZORLANIR: tarama ŞEMA görünümünde anlamlı. Detay açıkken
  // `hedef` düğüm değil düğme adı döndürür ve kontrol sessizce başka bir
  // şeyi ölçer — ilk koşuda tam olarak bu oldu (vurulan 5/10, adlar
  // "dikkat.tekrar artir"). Kontrol kendi ön koşulunu kurmalı.
  sema.sec(null);
  await bekle(120);
  console.log(`[ZIHINDENE] ayna oncesi secili=${sema.secili()}`);

  const ekranX = new Map<string, number[]>();
  const G = motor.getRenderWidth(), Y = motor.getRenderHeight();
  for (let ex = 0; ex < G; ex += 6) {
    for (let ey = 0; ey < Y; ey += 6) {
      const p = sahne.pick(ex, ey);
      if ((p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa !== "sema") continue;
      const uv = p?.getTextureCoordinates?.();
      if (!uv) continue;
      const ad = sema.hedef(uv.x, uv.y);
      if (!ad) continue;
      (ekranX.get(ad) ?? ekranX.set(ad, []).get(ad)!).push(ex);
    }
  }

  const ortalama = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const olculen = [...ekranX.entries()]
    .map(([ad, xs]) => ({ ad, x: ortalama(xs), n: xs.length }))
    .sort((a, b) => a.x - b.x);
  const beklenen = [...DUGUMLER].sort((a, b) => a.sutun - b.sutun || a.satir - b.satir);

  if (!olculen.length) {
    console.log("[ZIHINDENE] AYNA KALDI — panelde hiç düğüm vurulamadı (ışın hiç değmedi?)");
  } else {
    // Sütun sırası: soldaki düğüm ekranda da solda olmalı.
    let ters = 0;
    for (let i = 0; i < olculen.length; i++) {
      for (let j = i + 1; j < olculen.length; j++) {
        const a = DUGUMLER.find((d) => d.ad === olculen[i]!.ad);
        const b = DUGUMLER.find((d) => d.ad === olculen[j]!.ad);
        if (a && b && a.sutun > b.sutun) ters++;
      }
    }
    console.log(`[ZIHINDENE] AYNA ${ters === 0 ? "GECTI" : "KALDI"} — ` +
      `vurulan=${olculen.length}/${DUGUMLER.length} ters_cift=${ters}`);
    console.log(`[ZIHINDENE] ekran sirasi : ${olculen.map((o) => o.ad).join(" ")}`);
    console.log(`[ZIHINDENE] sema sirasi  : ${beklenen.map((d) => d.ad).join(" ")}`);
  }

  // Detay görünümü gerçekten çiziliyor mu — ekran görüntüsünde görünsün.
  sema.sec("dikkat");
  console.log(`[ZIHINDENE] detay secili=${sema.secili()} sayac=${sema.oku("dikkat").sayac}`);
  await bekle(900);

  // ── S5 KAPISI (canlı): ekrandaki "+" DÜĞMESİNE gerçekten bas ─────────
  //
  // Birim testi panonun yazdığını kanıtlıyor. Kanıtlamadığı şey, ekranda
  // GÖRÜNEN düğmenin o yazmayı tetikleyip tetiklemediği: çizim bir yere,
  // vuruş bölgesi başka yere düşerse testler yeşil kalır ve panel elle
  // denenene kadar bozuk durur.
  {
    const G2 = motor.getRenderWidth(), Y2 = motor.getRenderHeight();
    let basildi = false;
    // Ön koşul: DETAY açık olmalı. Tarama sırasında araya giren bir
    // tıklama seçimi değiştirebilir; kapı kendi zeminini kurar.
    sema.sec("dikkat");
    await bekle(120);
    const oncekiDeger = () => panoyuAl()?.goruntu("dikkat")
      .flatMap((m) => m.dugmeler).find((d) => d.ad === "dikkat.tekrar")?.deger ?? null;
    const once = oncekiDeger();

    dis: for (let ex = 0; ex < G2; ex += 3) {
      for (let ey = 0; ey < Y2; ey += 3) {
        const p = sahne.pick(ex, ey);
        if ((p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa !== "sema") continue;
        const uv = p?.getTextureCoordinates?.();
        if (!uv) continue;
        const h = sema.hedef(uv.x, uv.y);
        if (h && h.includes("dikkat.tekrar") && h.endsWith("artir")) {
          sema.tikla(uv.x, uv.y);
          basildi = true;
          break dis;
        }
      }
    }
    const sonra = oncekiDeger();
    console.log(`[ZIHINDENE] S5 ${basildi && sonra !== once ? "GECTI" : "KALDI"} — ` +
      `"+" bulundu=${basildi} tekrar: ${once} -> ${sonra}`);
    await bekle(700);

    // ── S6 KAPISI (canlı): TEHLİKELİ düğme teyit ekranı AÇMALI ─────────
    //
    // Birim testi panonun teyit istediğini kanıtlıyor. Kanıtlamadığı şey,
    // ekrandaki "−" düğmesine basmanın o teyidi açıp açmadığı: sınıf
    // kapısını panelin kendi yorumladığı bir tasarımda buradaki yol
    // sessizce doğrudan yazmaya kayabilirdi.
    const oku = (ad: string) => panoyuAl()?.goruntu("dikkat")
      .flatMap((m) => m.dugmeler).find((d) => d.ad === ad)?.deger ?? null;
    const azamiOnce = oku("dikkat.azami");
    let teyitAcildi = false;

    dis2: for (let ex = 0; ex < G2; ex += 3) {
      for (let ey = 0; ey < Y2; ey += 3) {
        const p = sahne.pick(ex, ey);
        if ((p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa !== "sema") continue;
        const uv = p?.getTextureCoordinates?.();
        if (!uv) continue;
        const h = sema.hedef(uv.x, uv.y);
        if (h && h.includes("dikkat.azami") && h.endsWith("azalt")) {
          sema.tikla(uv.x, uv.y);
          teyitAcildi = true;
          break dis2;
        }
      }
    }
    await bekle(400);
    const teyit = panoyuAl()?.bekleyenTeyit() ?? null;
    const yazilmadi = oku("dikkat.azami") === azamiOnce;
    console.log(`[ZIHINDENE] S6 ${teyitAcildi && teyit && yazilmadi ? "GECTI" : "KALDI"} — ` +
      `"−" bulundu=${teyitAcildi} teyit=${teyit ? "acik" : "yok"} ` +
      `deger_degismedi=${yazilmadi} azami=${azamiOnce}`);
    if (teyit) console.log(`[ZIHINDENE] S6 uyari: ${teyit.uyari}`);
    await bekle(900);
    // Kapı arkasında İZ BIRAKMAZ: açık kalan teyit sonraki kapının isteğini
    // "bekleyen ezilemez" kuralına takıyordu ve o kapı yanlış teyidi
    // onaylıyordu (ilk koşuda dikkat.azami=15 böyle yazıldı).
    panoyuAl()?.teyitIptal();
  }

  // ── BEYİN SEÇİCİ (canlı): cevabı bilinen iki geçiş ─────────────────
  //
  // Birim testleri yönlendirmeyi kanıtlıyor; burada kanıtlanan GERÇEK
  // sağlık kontrolleri. Ollama ayakta ve qwen2.5:7b kurulu → geçmeli.
  // `dis` reddedilmeli ve mevcut beyin kalmalı. `dis` varsayılan adresi 4700 = Electron'un Haiku
  // adaptörü; bu yüzden `3dorion.bat zihindene` ORION_BEYIN_ADRES'i kapalı bir porta çevirir
  // (spec 14 R6: adres boşken `dis` Haiku'ya bağlanıp geçiyordu, kapı bayat sebeple KALIYORDU).
  {
    const pn = panoyuAl();
    const deger = (ad: string) => pn?.goruntu("beyin")
      .flatMap((m) => m.dugmeler).find((d) => d.ad === ad)?.deger ?? null;
    const gec = async (hedef: string) => {
      pn?.teyitIptal();                               // zemin: açık teyit yok
      pn?.teyitIste("beyin.model", hedef);
      const t = pn?.bekleyenTeyit();
      // Onaylanan teyit BİZİM istediğimiz olmalı — başkasınınkini onaylamak
      // bu kapının ilk koşusundaki hataydı.
      if (!t || t.dugmeAdi !== "beyin.model" || t.yeni !== hedef) {
        console.log(`[ZIHINDENE] SECICI teyit beklenmedik: ${t ? `${t.dugmeAdi}=${String(t.yeni)}` : "yok"}`);
        return null;
      }
      const s = pn!.teyitliYaz(t.jeton);
      // Sağlık kontrolü asenkron: "kontrol" durumu bitene kadar bekle.
      for (let i = 0; i < 40 && String(deger("beyin.aktif")).includes("(kontrol)"); i++) await bekle(150);
      return s;
    };
    const once = deger("beyin.aktif");
    // Reddedilen geçiş modeli değiştirmemeli: kıyas başlangıç modeliyle, adla
    // değil (varsayılan beyin 2026-09-28'de değişti; ad yazılı olsaydı kırılırdı).
    const oncekiModel = deger("beyin.model");

    const r = await gec("dis");
    const disSonra = { model: deger("beyin.model"), aktif: deger("beyin.aktif") };
    console.log(`[ZIHINDENE] SECICI-RED ${disSonra.model === oncekiModel && String(disSonra.aktif).includes("reddedildi") ? "GECTI" : "KALDI"}` +
      ` — yazma=${r?.oldu} model=${disSonra.model} aktif=${disSonra.aktif}`);

    // Yerel seçenekler artık Ollama taramasından gelir: önce bitsin.
    await window.orionModel?.tara();
    const y = await gec("yerel:qwen2.5:7b");
    const yerelSonra = { model: deger("beyin.model"), aktif: deger("beyin.aktif") };
    console.log(`[ZIHINDENE] SECICI-GECIS ${yerelSonra.aktif === "qwen2.5:7b" ? "GECTI" : "KALDI"}` +
      ` — yazma=${y?.oldu} once=${once} model=${yerelSonra.model} aktif=${yerelSonra.aktif}`);

    sema.sec("beyin");
    await bekle(900);
  }

  // ── UNUT KAPISI (canlı): duvarda bir anıya tıkla → "Unut…" → teyit → onay ──────────
  //
  // Birim testleri silmenin ve yedeğin doğru olduğunu kanıtlıyor; kanıtlamadıkları: ekranda GÖRÜNEN
  // kelimeye ve "Unut…" düğmesine gerçekten basınca teyit ekranının açılıp açılmadığı ve onayın anıyı silip
  // silmediği. Yalıtım: ORION_SMOKE=1 + ORION_HAFIZA_DOSYASI (geçici tohum hafıza; gerçek dosyaya DOKUNMAZ).
  // Tohum yoksa (dosya boş) kapı "ATLANDI" der, geçmiş sayılmaz.
  {
    const G3 = motor.getRenderWidth(), Y3 = motor.getRenderHeight();
    const pn = panoyuAl();
    const sayi = () => Number(pn?.goruntu("hafiza").flatMap((m) => m.dugmeler).find((x) => x.ad === "hafiza.sayi")?.deger ?? NaN);
    /** Ekranda "sema" yüzeyindeki bölgeleri tarar; anahtarı `ara`yı içerenlerin UV'lerini döner. */
    // Duvarın ekran dikdörtgeni: kaba taramayla (12 px) BİR kez bulunur; ince tarama yalnız orada (tam ekran 3 px tarama
    // dakikalar sürüyor, teyit 30 sn ömürlü).
    let kutuAlani: { x0: number; y0: number; x1: number; y1: number } | null = null;
    const alanBul = () => {
      if (kutuAlani) return kutuAlani;
      let x0 = G3, y0 = Y3, x1 = 0, y1 = 0;
      for (let ex = 0; ex < G3; ex += 12) for (let ey = 0; ey < Y3; ey += 12) {
        if ((sahne.pick(ex, ey)?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa !== "sema") continue;
        x0 = Math.min(x0, ex); y0 = Math.min(y0, ey); x1 = Math.max(x1, ex); y1 = Math.max(y1, ey);
      }
      kutuAlani = x1 >= x0 ? { x0: Math.max(0, x0 - 12), y0: Math.max(0, y0 - 12), x1: Math.min(G3, x1 + 12), y1: Math.min(Y3, y1 + 12) } : { x0: 0, y0: 0, x1: G3, y1: Y3 };
      return kutuAlani;
    };
    const tara = (ara: string, ilk = false): { h: string; u: number; v: number }[] => {
      const bulunan = new Map<string, { h: string; u: number; v: number }>();
      const a = alanBul();
      for (let ex = a.x0; ex < a.x1; ex += 3) {
        for (let ey = a.y0; ey < a.y1; ey += 3) {
          const p = sahne.pick(ex, ey);
          if ((p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa !== "sema") continue;
          const uv = p?.getTextureCoordinates?.();
          if (!uv) continue;
          const h = sema.hedef(uv.x, uv.y);
          if (h && h.includes(ara) && !bulunan.has(h)) {
            bulunan.set(h, { h, u: uv.x, v: uv.y });
            if (ilk) return [...bulunan.values()];     // teyit 30 sn ömürlü: tam tarama süreyi aşar
          }
        }
      }
      return [...bulunan.values()];
    };

    pn?.teyitIptal();
    sema.sec("hafiza");
    await bekle(900);
    const once = sayi();
    if (!(once > 0)) {
      console.log(`[ZIHINDENE] UNUT ATLANDI — hafiza bos (sayi=${once}); ORION_HAFIZA_DOSYASI ile tohum ver`);
    } else {
      let unutBasildi = false;
      for (const k of tara("hafiza\u0000kelime\u0000").slice(0, 40)) {
        sema.tikla(k.u, k.v);
        await bekle(120);
        const unut = tara("hafiza\u0000unut\u0000", true)[0];     // yalnız DERİN anıda çıkar
        if (!unut) continue;
        sema.tikla(unut.u, unut.v);
        unutBasildi = true;
        break;
      }
      await bekle(300);
      const t = pn?.bekleyenTeyit() ?? null;
      const teyitDogru = t?.dugmeAdi === "hafiza.unut";
      const silindiMiOnce = sayi() !== once;                 // teyit AÇIKKEN silinmemiş olmalı
      if (t) console.log(`[ZIHINDENE] UNUT uyari: ${t.uyari}`);
      const onay = teyitDogru ? tara("teyitOnay", true)[0] : undefined;
      if (onay) sema.tikla(onay.u, onay.v);
      await bekle(500);
      const sonra = sayi();
      const bitti = unutBasildi && teyitDogru && !silindiMiOnce && !!onay && sonra === once - 1 && !pn?.bekleyenTeyit();
      console.log(`[ZIHINDENE] UNUT ${bitti ? "GECTI" : "KALDI"} — unut_basildi=${unutBasildi} teyit=${t?.dugmeAdi ?? "yok"} ` +
        `teyitte_silinmedi=${!silindiMiOnce} onay_bulundu=${!!onay} anilar: ${once} -> ${sonra}`);
      pn?.teyitIptal();
      await bekle(600);
    }

    // ── KURALLAR KAPISI (canlı, Markov hafıza aşama 2): [Kurallar] düğmesine bas → kural kutuları görünsün ──────────
    //
    // Birim/ölçüm testleri yerleşimin doğru olduğunu söylüyor; kanıtlamadıkları: ekranda GÖRÜNEN düğmenin görünümü açması ve
    // tablodaki HER kuralın tıklanabilir bir kutu olarak orada bulunması. Son durum (bir kural seçili) açık bırakılır: ORION_SS
    // senaryo sonunda bu kareyi kaydeder; okunabilirlik görüntüye bakılarak değerlendirilir.
    {
      pn?.teyitIptal();
      sema.sec("hafiza");
      await bekle(600);
      const kd = tara("hafiza\u0000gorunum\u0000kurallar", true)[0];
      if (kd) sema.tikla(kd.u, kd.v);
      await bekle(500);
      const kutular = tara("hafiza\u0000kural\u0000");
      const secilecek = kutular.find((k) => k.h.endsWith("komut.dusuk"));
      if (secilecek) sema.tikla(secilecek.u, secilecek.v);
      await bekle(600);
      console.log(`[ZIHINDENE] KURALLAR ${kd && kutular.length === 14 && secilecek ? "GECTI" : "KALDI"} — dugme_bulundu=${!!kd} kural_kutusu=${kutular.length}/14 secilen=${secilecek ? "komut.dusuk" : "yok"}`);
    }
  }

  console.log("[ZIHINDENE] bitti — panelleri gozle dogrula");
}
