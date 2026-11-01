// uygulama/yapi/level/sablonCubugu.ts — NESNELER PANELİ "ŞABLON" ÇUBUĞU (spec 45 B7; Unreal'da seçili aktörden Blueprint oluştur / sınıfı sahneye sürükle). DOM katmanı; iş mantığı `aktor/sablonIslemleri.ts`te (testli).
//
// İki işlem: "Şablon olarak kaydet" (seçili aktörün alt ağacı → Content/Actors/<ad>.aktor.json; DİSKE yazar) ve "Yerleştir" (seçilen şablon → level'a yeni kimliklerle; oturum içi).
// İKİSİ DE YALNIZ GERÇEK TIKLAMAYLA (`isTrusted`): betikten üretilen tık hiçbir şey yapmaz (spec 35 §1; Orion'un araç yüzeyinde şablon yazan/yerleştiren yol YOKTUR).
"use strict";
import type { LevelTanimi, Vec3 } from "../../../world/level/cekirdek/levelTanimi.ts";
import { kodlu } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { sablonAdlari, sablonKaydet, sablonYerlestirMetinden, SABLON_KLASORU, SABLON_UZANTISI, type HostSonucu, type Sonuc } from "../../aktor/sablonIslemleri.ts";
import { dugmeYap, el } from "../ortak/dom.ts";

const dugme = dugmeYap("");

/** Şablon dosyası erişimi (host IPC'si; Electron'suz ortamda verilmez ve çubuk çizilmez). */
export interface SablonDosyalari {
  yaz(ad: string, metin: string): Promise<HostSonucu<string>>;
  /** `Content` kökünün bütün öğe adresleri (süzme çubukta). */
  liste(): Promise<HostSonucu<string[]>>;
  oku(adres: string): Promise<HostSonucu<string>>;
}
export interface SablonCubuguAyari {
  dosyalar: SablonDosyalari;
  tanim: () => LevelTanimi | null;
  secili: () => string | null;
  /** Yeni nesnenin konumu (kamera önü gibi); yoksa [0,0,0]. */
  yerlestirmeKonumu?: () => Vec3;
  /** Tanımı dönüştür → canlı uygula (panelin `uygula`sı: level doğrular, bozuksa eski hâlinde kalır). */
  uygula: (f: (t: LevelTanimi) => Sonuc<LevelTanimi>) => void;
  /** Yerleştirilen kök seçilsin. */
  sec: (id: string) => void;
  altyazi: (metin: string, ms?: number) => void;
  /** Hata/başarı izi (kodlu metin; günlüğe giriş çağıranın). */
  iz?: (seviye: "bilgi" | "hata", metin: string) => void;
}

export function sablonCubuguKur(a: SablonCubuguAyari): HTMLElement {
  const kok = el("div", "il-tam"); kok.style.flexWrap = "wrap"; kok.style.padding = "4px 0";
  const ad = el("input"); ad.type = "text"; ad.placeholder = "şablon adı"; ad.title = "harf, rakam, _ ve -; en çok 48"; ad.style.flex = "1"; ad.style.minWidth = "80px";
  const kaydet = dugme("Şablon olarak kaydet", "", "Seçili nesnenin alt ağacını Content/Actors'a yaz (yalnız gerçek tıklamayla; var olanın üstüne yazmaz)");
  const sec = el("select"); sec.title = "Content/Actors şablonları"; sec.style.flex = "1"; sec.style.minWidth = "80px";
  const yenile = dugme("↻", "", "Şablon listesini yenile");
  const yerlestir = dugme("Yerleştir", "", "Seçili şablonu level'a yeni kimliklerle koy (yalnız gerçek tıklamayla; oturum içi)");
  kok.append(ad, kaydet, sec, yenile, yerlestir);

  const bildir = (seviye: "bilgi" | "hata", m: string, ms = 3500): void => { a.altyazi(m, ms); a.iz?.(seviye, m); };

  async function listeyiYenile(): Promise<void> {
    const onceki = sec.value;
    const r = await a.dosyalar.liste();
    sec.replaceChildren();
    if (!r.ok) { const o = el("option", "", "(liste alınamadı)"); o.value = ""; sec.append(o); bildir("hata", kodlu("AKT-SBL-007", `şablon listesi: ${r.kod}: ${r.mesaj}`), 4000); yerlestir.disabled = true; return; }
    const adlar = sablonAdlari(r.deger);
    if (!adlar.length) { const o = el("option", "", "(şablon yok)"); o.value = ""; sec.append(o); }
    for (const s of adlar) { const o = el("option", "", s); o.value = s; sec.append(o); }
    if (adlar.includes(onceki)) sec.value = onceki;
    yerlestir.disabled = !adlar.length;
  }

  kaydet.addEventListener("click", (e) => {
    kaydet.blur();
    if (!e.isTrusted) return;   // YALNIZ GERÇEK TIKLAMA
    const t = a.tanim(), id = a.secili();
    if (!t || !id) { bildir("hata", "Önce listeden bir nesne seç"); return; }
    void (async () => {
      const r = await sablonKaydet(t, id, ad.value.trim(), (n, m) => a.dosyalar.yaz(n, m));
      if (!r.ok) { bildir("hata", r.neden, 5000); return; }
      bildir("bilgi", `Şablon yazıldı: ${r.deger}`);
      await listeyiYenile();
      sec.value = ad.value.trim();
    })();
  });

  yerlestir.addEventListener("click", (e) => {
    yerlestir.blur();
    if (!e.isTrusted) return;   // YALNIZ GERÇEK TIKLAMA
    const secilen = sec.value;
    if (!secilen) { bildir("hata", "Önce bir şablon seç"); return; }
    void (async () => {
      const m = await a.dosyalar.oku(`${SABLON_KLASORU}${secilen}${SABLON_UZANTISI}`);
      if (!m.ok) { bildir("hata", kodlu("AKT-SBL-007", `şablon okunamadı: ${m.kod}: ${m.mesaj}`), 5000); return; }
      const yeni: { kok: string | null } = { kok: null };   // `uygula` eşzamanlı çağırır; kapanıştan taşınan değer nesnede (let daralması yanılmasın)
      const konum = a.yerlestirmeKonumu?.() ?? [0, 0, 0];
      a.uygula((t) => {
        const r = sablonYerlestirMetinden(t, m.deger, konum);
        if (!r.ok) { a.iz?.("hata", r.neden); return r; }   // panel `uygula` nedeni altyazıya basar
        yeni.kok = r.deger.kok;
        return { ok: true, deger: r.deger.tanim };
      });
      if (yeni.kok) { a.sec(yeni.kok); a.iz?.("bilgi", `şablon yerleştirildi: ${secilen} → ${yeni.kok}`); }
    })();
  });
  yenile.addEventListener("click", () => { yenile.blur(); void listeyiYenile(); });
  void listeyiYenile();
  return kok;
}
