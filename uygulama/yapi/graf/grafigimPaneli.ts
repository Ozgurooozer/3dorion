// uygulama/yapi/graf/grafigimPaneli.ts — SOL PANEL "BENİM GRAFİĞİM" (Blueprint'in "My Blueprint"i; spec 35 dilim 2b). DOM katmanı.
//
//   (a) DEĞİŞKENLER: grafikteki değişken düğümlerinden TOPLANIR (degiskenler.ts; yeni değişken sistemi yok). Her değişkenin yanında Oku / Yaz / Artır
//       kısayolu o değişkenin düğümünü tuvalin ortasına ekler. "＋ Değişken": ad + tür → aynı kısayollar. Aynı ad iki türle ⚠ (çalışırken hata verirdi).
//   (b) DESENLER: kayıtlı desenler; "ekle" Desen düğümünü (ayarı dolu) ekler, çift tık deseni yeni sekmede açar.
//   (c) DÜNYA DEĞİŞKENLERİ: palette'in "dünya" grubu (saat, ajan/Ozyn durumu, mesafe, en yakın nesne, konum) tek tıkla; liste kütüphaneden (kategori).
"use strict";
import { DEGISKEN_TIPLERI, type DegiskenTipi } from "../../graf/durumDugumleri.ts";
import { DESEN_CAGIR_TIPI } from "../../graf/grafTurDenetimi.ts";
import { degiskenDugumu, degiskenleriTopla } from "../../graf/editor/degiskenler.ts";
import { paletOgeleri } from "../../graf/editor/palet.ts";
import { PIN_TIP_ADI } from "../../graf/editor/bagKurali.ts";
import type { EditorBaglami } from "./editorBaglami.ts";
import { dugme, el } from "./dom.ts";

export function grafigimPaneliKur(b: EditorBaglami): { kok: HTMLElement; ciz(): void } {
  const kok = el("div", "ge-sol");
  let formAcik = false;
  /** Form yalnız ilk açılışta odak alır (panel başka bir değişiklikle yeniden çizilince odak çalınmasın). */
  let formYeniAcildi = false;
  let formAd = "", formTip: DegiskenTipi = "sayi";

  const degiskenEkle = (islem: "oku" | "yaz" | "artir", ad: string, tip: DegiskenTipi) => {
    const r = degiskenDugumu(islem, ad, tip);
    if (!r.ok) { b.bildir(r.hata, "hata"); return; }
    b.ortayaEkle(r.deger.tip, r.deger.ayar);
  };
  const islemDugmeleri = (ad: string, tip: DegiskenTipi): HTMLElement[] => {
    const l: HTMLElement[] = [];
    for (const [islem, yazi, ipucu] of [["oku", "Oku", "değeri okuyan saf düğüm"], ["yaz", "Yaz", "değer yazan akış düğümü"], ["artir", "Artır", "sayıya ekleyen akış düğümü"]] as const) {
      if (islem === "artir" && tip !== "sayi") continue;
      const d = dugme(yazi, "", `'${ad}': ${ipucu} ekle (tuvalin ortasına)`);
      d.addEventListener("click", () => { d.blur(); degiskenEkle(islem, ad, tip); });
      l.push(d);
    }
    return l;
  };

  function degiskenler(): void {
    const o = b.oturum()!;
    const bas = el("div", "ge-baslik2", "Değişkenler");
    const yeni = dugme("＋ Değişken", "", "Ad ve tür ver: Oku / Yaz / Artır düğümü ekle. Değişken bellektedir (uygulama kapanınca gider).");
    yeni.addEventListener("click", () => { yeni.blur(); formAcik = !formAcik; formYeniAcildi = formAcik; ciz(); });
    bas.append(yeni);
    kok.append(bas);
    if (formAcik) {
      const f = el("div", "ge-oge");
      const ad = el("input"); ad.placeholder = "ad (örn. ziyaret)"; ad.value = formAd; ad.spellcheck = false; ad.style.width = "100px";
      ad.addEventListener("input", () => { formAd = ad.value.trim(); });
      const tip = el("select");
      for (const t of DEGISKEN_TIPLERI) { const op = el("option", "", PIN_TIP_ADI[t]); op.value = t; op.selected = t === formTip; tip.append(op); }
      tip.addEventListener("change", () => { formTip = tip.value as DegiskenTipi; ciz(); });
      f.append(ad, tip);
      kok.append(f);
      // Formun düğmeleri adı ÇİZİM anında değil TIKLAMA anında okur (yazarken panel her harfte yeniden çizilmesin).
      const d = el("div", "ge-oge");
      d.append(el("span", "ge-soluk", "ekle:"), ...(["oku", "yaz", "artir"] as const).filter((x) => x !== "artir" || formTip === "sayi").map((islem) => {
        const x = dugme(islem === "oku" ? "Oku" : islem === "yaz" ? "Yaz" : "Artır");
        x.addEventListener("click", () => { x.blur(); degiskenEkle(islem, formAd, formTip); });
        return x;
      }));
      kok.append(d);
      if (formYeniAcildi) { formYeniAcildi = false; setTimeout(() => ad.focus({ preventScroll: true }), 0); }
    }
    const l = degiskenleriTopla(o.graf());
    if (!l.length) kok.append(el("div", "ge-soluk", "Bu grafikte değişken yok. ＋ Değişken ile ekle (sayaç, parola bildi mi…)."));
    for (const v of l) {
      const s = el("div", "ge-oge");
      const yazi = el("span", v.cakisma ? "ge-uyari" : "", `${v.cakisma ? "⚠ " : ""}${v.ad} · ${v.tipler.map((t) => PIN_TIP_ADI[t]).join(" / ") || "?"}`);
      yazi.title = `${v.dugumler.length} düğümde: ${v.dugumler.join(", ")}${v.cakisma ? "\n⚠ aynı ad iki türle: çalışırken okuma hata verir" : ""}`;
      s.append(yazi, ...islemDugmeleri(v.ad, v.tipler[0] ?? "sayi"));
      kok.append(s);
    }
  }

  function desenler(): void {
    const o = b.oturum()!;
    kok.append(el("div", "ge-baslik2", "Desenler"));
    const l = b.desenler().filter((x) => x !== o.graf().ad);
    if (!l.length) kok.append(el("div", "ge-soluk", "Kayıtlı desen yok (Graf sekmesi · ＋ Yeni desen)."));
    for (const ad of l) {
      const s = el("div", "ge-oge");
      const yazi = el("span", "", `🧩 ${ad}`);
      yazi.title = "Çift tık: deseni yeni sekmede aç";
      yazi.addEventListener("dblclick", () => b.desenAc(ad));
      const ekle = dugme("ekle", "", `'${ad}' desenini Desen düğümü olarak ekle`);
      ekle.addEventListener("click", () => { ekle.blur(); b.ortayaEkle(DESEN_CAGIR_TIPI, { desen: ad }); });
      const ac = dugme("aç", "", "Deseni yeni sekmede aç");
      ac.addEventListener("click", () => { ac.blur(); b.desenAc(ad); });
      s.append(yazi, ekle, ac);
      kok.append(s);
    }
  }

  function dunya(): void {
    const o = b.oturum()!;
    kok.append(el("div", "ge-baslik2", "Dünya değişkenleri"));
    const l = paletOgeleri(b.kayit, o.ortam(), o.graf().tur, [], o.graf().ad).filter((x) => x.kategori === "dunya");
    for (const x of l) {
      const s = el("div", "ge-oge");
      const yazi = el("span", "", x.ad); yazi.title = x.aciklama;
      const ekle = dugme("ekle", "", `${x.ad}: ${x.aciklama}`);
      ekle.addEventListener("click", () => { ekle.blur(); b.ortayaEkle(x.tip, x.ayar); });
      s.append(yazi, ekle);
      kok.append(s);
    }
  }

  function ciz(): void {
    kok.replaceChildren();
    if (!b.oturum()) { kok.append(el("div", "ge-soluk", "Açık grafik yok.")); return; }
    degiskenler();
    desenler();
    dunya();
  }
  return { kok, ciz };
}
