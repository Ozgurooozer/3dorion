// uygulama/yapi/sekans/sekansSekmesi.ts — ALT ÇUBUK · SEKANS SEKMESİ (spec 36 S2): sekans kartları, repodaki örnekler, Aç / Metin / ＋ Yeni / Kopyasını al /
// Yeniden adlandır / Kopyasını oluştur / Sil. DOM katmanı (Graf sekmesinin kalıbı: uygulama/yapi/grafSekmesi.ts).
//
//   • Kartlar iki şeritte: "Sekanslarım" (`<userData>/orion-sekans/`; bozuk dosya kırmızı ve nedeniyle) ve "Örnekler" (repodaki `assets/sekans/`, SALT
//     OKUNUR: düzenlemek için "Kopyasını al" — kullanıcı klasörüne YENİ dosya; var olan adın üstüne asla). Tık seçer, çift tık editörde açar
//     (örnekte çift tık = kopyasını al + aç).
//   • ▶ BURADA YOK: oynatmak editörün ▶ düğmesinden (tek yer; isTrusted bekçisi). Burası listeler ve dosya işlerini yapar.
//   • SİL = KALDIR (`.silinenler/`, kalıcı silme yok), iki adım ve ikinci adım yalnız gerçek tık. Oynayan ya da açık-kirli sekans silinmez.
"use strict";
import type { Sekme, SekmeAraci, SekmeIcerigi } from "../ortak/yapiPaneli.ts";
import { BEN, sekansAdiGecerli, type Sekans } from "../../../protocol/sekans.ts";
import { yeniSekans, type SekansDeposu, type SekansKaydi } from "../../sekans/sekansDeposu.ts";
import type { OrnekKutuphanesi } from "../../sekans/ornekler.ts";
import type { SekansOynatici } from "../../sekans/oynatici.ts";
import { sureYazisi } from "../../sekans/editor/zamanEkseni.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import type { SekansEditoru } from "./sekansEditoru.ts";
import { sekansStiliEkle } from "./sekansStili.ts";

export interface SekansSekmesiAyari {
  depo: SekansDeposu;
  ornekler: OrnekKutuphanesi;
  oynatici: SekansOynatici;
  editor: Pick<SekansEditoru, "ac" | "yenidenAdlandir" | "kopyasiniOlustur">;
  ajanlar: () => readonly string[];
  metinAc: (ad: string) => void;
  hata: () => string | null;
  bildir: (metin: string, ms?: number) => void;
}

const dugme = dugmeYap("sk-dugme");

export function sekansSekmesi(a: SekansSekmesiAyari): Sekme {
  return {
    id: "sekans", ad: "Sekans", simge: "🎬", sira: 55,
    ipucu: "Zaman çizelgesi (Unreal Sequencer gibi): Orion/Flash'ın hareketlerini kare kare diz · çift tık: editör · örnekler: Kopyasını al",
    kur(sayfa, arac): SekmeIcerigi { return kur(sayfa, arac, a); },
  };
}

/** Örneğin kopyası için boş ad: örneğin adı, doluysa `_2`, `_3`… */
export function bosAd(var_: (ad: string) => boolean, taban: string): string {
  if (!var_(taban)) return taban;
  for (let i = 2; ; i++) if (!var_(`${taban}_${i}`)) return `${taban}_${i}`;
}

function kur(sayfa: HTMLElement, arac: SekmeAraci, a: SekansSekmesiAyari): SekmeIcerigi {
  sekansStiliEkle();
  const kok = el("div", "sk-sekme-kok");
  const ust = el("div", "sk-sekme-ust");
  const satir = el("span", "sk-satir");
  const acD = dugme("Aç", "", "Seçili sekansı editörde aç (çift tık da açar)");
  const metinD = dugme("Metin", "", "Seçili sekansı JSON metin düzenleyicisinde aç");
  const kopyaAlD = dugme("Kopyasını al", "", "Seçili ÖRNEĞİ kendi sekanslarına kopyala (örnekler salt okunur)");
  const adD = dugme("Yeniden adlandır", "", "Seçili sekansın adını değiştir (eski dosya .silinenler'e)");
  const kopyaD = dugme("Kopyasını oluştur", "", "Seçili sekansın aynı içerikli, yeni adlı kopyası");
  const silD = dugme("Sil", "sk-sil", "Seçili sekansı kaldır (dosya silinmez, .silinenler klasörüne taşınır)");
  const yeniD = dugme("＋ Yeni sekans", "", "Çalışan küçük bir örnekle başlar: el sallar, başını iki kez eğer");
  const yeniKutu = el("div", "sk-kutu"); yeniKutu.style.display = "none";
  const yeniAd = el("input"); yeniAd.autocomplete = "off"; yeniAd.spellcheck = false; yeniAd.style.width = "150px";
  const yeniAjan = el("select");
  const yeniHata = el("span", "sk-hata");
  yeniKutu.append(yeniAd, yeniAjan, yeniHata);
  ust.append(satir, acD, metinD, kopyaAlD, adD, kopyaD, silD, yeniKutu, yeniD);
  const govde = el("div", "sk-sekme-govde");
  const sutun = (baslik: string) => { const s = el("div", "sk-sutun"); const serit = el("div", "sk-serit"); s.append(el("div", "sk-baslik2", baslik), serit); return { s, serit }; };
  const benim = sutun("Sekanslarım (çift tık: editör · ▶ editörde)");
  const ornek = sutun("Örnekler (salt okunur · çift tık: kopyasını al ve aç)");
  govde.append(benim.s, ornek.s);
  kok.append(ust, govde);
  sayfa.append(kok);

  let secili: { tur: "benim" | "ornek"; ad: string } | null = null;
  let yeniKip: "yeni" | "ad" | "kopya" = "yeni";
  const kayit = (ad: string): SekansKaydi | null => a.depo.liste().find((k) => k.ad === ad) ?? null;
  const varMi = (ad: string) => !!kayit(ad);

  async function ornegiKopyala(s: Sekans): Promise<string> {
    const ad = bosAd(varMi, s.ad);
    await a.depo.yeni({ ...structuredClone(s), ad });
    return ad;
  }

  function dugmeleriCiz(): void {
    const k = secili?.tur === "benim" ? kayit(secili.ad) : null;
    const oynayan = a.oynatici.durum().calisiyor?.sekans ?? null;
    acD.disabled = !k || !!k.hata; metinD.disabled = !k; adD.disabled = kopyaD.disabled = !k || !!k.hata;
    kopyaAlD.disabled = secili?.tur !== "ornek";
    const silNeden = !k ? "önce kendi sekanslarından birini seç" : oynayan === k.ad ? "oynuyor (önce ■)" : "";
    silD.disabled = silNeden !== ""; silD.title = silNeden || "Seçili sekansı kaldır (dosya .silinenler klasörüne taşınır)";
    silD.textContent = "Sil"; silD.dataset.emin = "0";
    const d = a.oynatici.durum();
    satir.dataset.tur = d.calisiyor ? "oynuyor" : d.son?.durum === "hata" ? "hata" : "";
    satir.textContent = d.calisiyor ? `▶ ${d.calisiyor.sekans} oynuyor` : d.son ? `son: ${d.son.sekans} ${d.son.durum}${d.son.neden ? ` — ${d.son.neden}` : ""}` : "Bir sekans seç · çift tık: editör (▶ orada).";
    satir.title = satir.textContent;
    arac.rozet(d.calisiyor ? "▶" : null);
  }

  function kart(ad: string, alt: string, tur: "benim" | "ornek", bozuk: boolean): HTMLElement {
    const c = el("div", "sk-kart");
    c.dataset.bozuk = bozuk ? "1" : "0";
    c.dataset.secili = secili?.tur === tur && secili.ad === ad ? "1" : "0";
    c.dataset.oynuyor = a.oynatici.durum().calisiyor?.sekans === ad && tur === "benim" ? "1" : "0";
    c.title = `${ad}\n${alt}\nTık: seç · Çift tık: ${tur === "ornek" ? "kopyasını al ve aç" : bozuk ? "JSON'u düzelt (Metin)" : "editörde aç"}`;
    c.append(el("div", "sk-kad", `${tur === "ornek" ? "📘" : bozuk ? "⚠" : "🎬"} ${ad}`), el("div", "sk-kalt", alt));
    c.addEventListener("click", () => { secili = { tur, ad }; ciz(); });
    c.addEventListener("dblclick", () => {
      if (tur === "benim") { if (bozuk) a.metinAc(ad); else a.editor.ac(ad); return; }
      const s = a.ornekler.al(ad);
      if (s) ornegiKopyala(s).then((y) => { secili = { tur: "benim", ad: y }; a.bildir(`örnek '${ad}' kopyalandı: ${y}`, 2500); a.editor.ac(y); }, (err: unknown) => a.bildir(`kopyalanamadı: ${err instanceof Error ? err.message : String(err)}`, 5000));
    });
    return c;
  }

  function ciz(): void {
    const liste = a.depo.liste();
    if (secili?.tur === "benim" && !liste.some((k) => k.ad === secili!.ad)) secili = null;
    const h = a.hata();
    benim.serit.replaceChildren(...(liste.length ? liste.map((k) => kart(k.ad, k.hata ? `bozuk: ${k.hata}` : `${sureYazisi(k.sure_kare ?? 0)} · ${k.ajanlar.join(", ") || "bağlama yok"}${k.aciklama ? ` · ${k.aciklama}` : ""}`, "benim", !!k.hata))
      : [el("div", "sk-bos", h ? `Sekanslar yüklenemedi: ${h}` : "Henüz sekans yok. ＋ Yeni sekans ya da bir örneği çift tıkla.")]));
    const or = a.ornekler.liste();
    const oh = a.ornekler.hatalar();
    ornek.serit.replaceChildren(...or.map((s) => kart(s.ad, `${sureYazisi(s.sure_kare)} · ${s.baglamalar.map((x) => x.ajan).join(", ")}${s.aciklama ? ` · ${s.aciklama}` : ""}`, "ornek", false)),
      ...oh.map((x) => el("div", "sk-hata", `örnek ${x.dosya}: ${x.neden}`)), ...(or.length || oh.length ? [] : [el("div", "sk-bos", "Örnekler yükleniyor (assets/sekans/)…")]));
    dugmeleriCiz();
  }

  acD.addEventListener("click", () => { acD.blur(); if (secili?.tur === "benim") a.editor.ac(secili.ad); });
  metinD.addEventListener("click", () => { metinD.blur(); if (secili?.tur === "benim") a.metinAc(secili.ad); });
  kopyaAlD.addEventListener("click", () => {
    kopyaAlD.blur();
    const s = secili?.tur === "ornek" ? a.ornekler.al(secili.ad) : null;
    if (s) ornegiKopyala(s).then((y) => { secili = { tur: "benim", ad: y }; a.bildir(`örnek kopyalandı: ${y} (çift tık: editör)`, 2500); ciz(); }, (err: unknown) => a.bildir(`kopyalanamadı: ${err instanceof Error ? err.message : String(err)}`, 5000));
  });
  silD.addEventListener("click", (e) => {
    silD.blur();
    if (secili?.tur !== "benim") return;
    const ad = secili.ad;
    if (silD.dataset.emin !== "1") {
      silD.dataset.emin = "1"; silD.textContent = `Emin misin? '${ad}'`;
      setTimeout(() => { if (silD.dataset.emin === "1") { silD.dataset.emin = "0"; silD.textContent = "Sil"; } }, 4000);
      return;
    }
    // Silmenin ikinci adımı YALNIZ gerçek tık (yanlışlıkla/betikle kayıp olmasın).
    if (!e.isTrusted) return;
    a.depo.sil(ad).then(() => { a.bildir(`'${ad}' kaldırıldı (dosya .silinenler klasörüne taşındı)`, 3000); secili = null; ciz(); },
      (err: unknown) => { a.bildir(`silinemedi: ${err instanceof Error ? err.message : String(err)}`, 5000); dugmeleriCiz(); });
  });

  const yeniKapat = () => { yeniKutu.style.display = "none"; yeniD.style.display = ""; yeniAd.value = ""; yeniHata.textContent = ""; };
  const yeniAc = (kip: typeof yeniKip) => {
    yeniKip = kip;
    yeniD.style.display = "none"; yeniKutu.style.display = "flex";
    yeniAjan.style.display = kip === "yeni" ? "" : "none";
    yeniAjan.replaceChildren(...[...a.ajanlar(), BEN].map((x) => { const o = el("option", "", x); o.value = x; return o; }));
    yeniAd.placeholder = kip === "yeni" ? "sekans adı (örn. selam)" : kip === "ad" ? `'${secili?.ad}' için yeni ad` : `'${secili?.ad}' kopyasının adı`;
    yeniAd.value = kip === "ad" ? secili?.ad ?? "" : kip === "kopya" ? `${secili?.ad ?? ""}_kopya` : "";
    yeniAd.focus(); yeniAd.select();
  };
  yeniD.addEventListener("click", () => { yeniD.blur(); yeniAc("yeni"); });
  adD.addEventListener("click", () => { adD.blur(); if (secili?.tur === "benim") yeniAc("ad"); });
  kopyaD.addEventListener("click", () => { kopyaD.blur(); if (secili?.tur === "benim") yeniAc("kopya"); });
  for (const g of [yeniAd, yeniAjan]) g.addEventListener("keyup", (e) => e.stopPropagation());
  yeniAjan.addEventListener("keydown", (e) => e.stopPropagation());
  yeniAd.addEventListener("keydown", (e) => {
    e.stopPropagation();   // yazarken çubuk kısayolları (1–9, Y) ve oyun tuşları çalışmasın
    if (e.key === "Escape") { yeniKapat(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ad = yeniAd.value.trim();
    if (!sekansAdiGecerli(ad)) { yeniHata.textContent = "geçersiz ad (harf, rakam, _ ve -; boşluk yok)"; return; }
    const eski = secili?.ad ?? null;
    const is = yeniKip === "yeni" ? (varMi(ad) ? Promise.reject(new Error("bu ad zaten var")) : a.depo.yeni(yeniSekans(ad, yeniAjan.value)))
      : yeniKip === "ad" && eski ? a.editor.yenidenAdlandir(eski, ad) : eski ? a.editor.kopyasiniOlustur(eski, ad) : Promise.resolve();
    is.then(() => { yeniKapat(); secili = { tur: "benim", ad }; ciz(); if (yeniKip === "yeni") a.editor.ac(ad); }, (err: unknown) => { yeniHata.textContent = err instanceof Error ? err.message : String(err); });
  });

  a.depo.dinle((o) => { if (o.tur === "liste") ciz(); });
  a.ornekler.dinle(ciz);
  a.oynatici.dinle(() => dugmeleriCiz());
  return { goster() { ciz(); arac.ipucu("Tık: seç · Çift tık: editör · Örnekler salt okunur (Kopyasını al) · ▶ editörde"); } };
}
