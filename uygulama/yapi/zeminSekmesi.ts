// uygulama/yapi/zeminSekmesi.ts — ALT ÇUBUK · ZEMİN SEKMESİ: araç kutusu (yükselt, alçalt, düzle…), fırça ayarları ve geri al. DOM katmanı.
//
// Araç tablosu `zeminAraclari.ts`te: yeni araç tabloya satır eklenince burada kendiliğinden düğme olur. Kalem sahnede `zeminKalemi.ts`, kayıt ve geri al
// `zeminBaglantisi.ts`te; burası yalnız bunları kullanıcıya açar. Araç seçmek kalemi AÇAR (ve çubuğu indirmez: sahneyi tam görerek çalışılabilsin); aynı araca
// tekrar tık kalemi bırakır. "Dosyadaki zemine dön" iki adımlıdır (geri alınabilir olsa da yanlışlıkla tıklanmasın).
"use strict";
import type { Sekme, SekmeAraci, SekmeIcerigi } from "./ortak/yapiPaneli.ts";
import type { ZeminKalemi } from "../zeminKalemi.ts";
import type { ZeminBaglantisi } from "../zeminBaglantisi.ts";
import { KALEM_SINIRLARI, ZEMIN_ARACLARI, aracBilgisi, gucEtiketi } from "../zeminAraclari.ts";

export interface ZeminSekmesiAyari { kalem: ZeminKalemi; baglanti: ZeminBaglantisi }

/** "Dosyadaki zemine dön" ilk tıktan sonra bu kadar ms içinde ikinci tık onaydır. */
const ONAY_MS = 3000;

const CSS = `
.zs-kok { display: flex; gap: 0; height: 100%; min-height: 0; overflow-x: auto; }
.zs-bolum { flex: 0 0 auto; padding: 10px 16px; border-right: 1px solid #2a3246; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.zs-bolum:last-child { border-right: 0; }
.zs-baslik { color: #7c88a6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
.zs-araclar { display: grid; grid-template-columns: repeat(4, 74px); gap: 6px; }
.zs-arac { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; height: 62px; background: #151c2b; color: #c8d0e6; border: 1px solid #222c41; border-radius: 8px; font: inherit; font-size: 12px; cursor: pointer; }
.zs-arac b { font-size: 22px; line-height: 1; font-weight: normal; }
.zs-arac:hover { border-color: #4a69b0; background: #19223a; }
.zs-arac[data-etkin="1"] { border-color: #58c1ff; box-shadow: 0 0 0 1px #58c1ff inset; background: #1a2a44; color: #fff; }
.zs-satir { display: grid; grid-template-columns: 74px 190px 62px; align-items: center; gap: 8px; }
.zs-satir label { color: #c8d0e6; }
.zs-satir output { color: #8fb8dc; font-variant-numeric: tabular-nums; text-align: right; }
.zs-satir input[type=range] { width: 100%; accent-color: #58c1ff; }
.zs-onay { display: flex; align-items: center; gap: 7px; color: #c8d0e6; cursor: pointer; }
.zs-onay input { accent-color: #58c1ff; }
.zs-dugmeler { display: flex; flex-direction: column; gap: 6px; }
.zs-dugme { background: #121726; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; padding: 5px 12px; font: inherit; cursor: pointer; text-align: left; }
.zs-dugme:hover:not(:disabled) { border-color: #58c1ff; }
.zs-dugme:disabled { opacity: 0.4; cursor: default; }
.zs-dugme[data-onay="1"] { border-color: #ffb454; color: #ffb454; }
.zs-durum { color: #7c88a6; font-size: 12px; max-width: 240px; }
.zs-ipucu { color: #8fb8dc; font-size: 12px; max-width: 280px; min-height: 32px; }
`;

export function zeminSekmesi(a: ZeminSekmesiAyari): Sekme {
  return {
    id: "zemin", ad: "Zemin", simge: "⛰", sira: 20,
    ipucu: "Zemin kalemi: tepe yap, çukur kaz, düzle, yumuşat",
    kur(sayfa, arac): SekmeIcerigi { return kur(sayfa, arac, a); },
  };
}

function kur(sayfa: HTMLElement, arac: SekmeAraci, a: ZeminSekmesiAyari): SekmeIcerigi {
  const { kalem, baglanti } = a;
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);
  const el = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin) e.textContent = metin; return e;
  };

  const kok = el("div", "zs-kok");
  sayfa.append(kok);

  // ── araçlar ──
  const araclarBolumu = el("div", "zs-bolum");
  const araclar = el("div", "zs-araclar");
  const aracDugmeleri = new Map<string, HTMLButtonElement>();
  for (const b of ZEMIN_ARACLARI) {
    const d = el("button", "zs-arac"); d.type = "button";
    d.title = b.ipucu;
    d.append(el("b", "", b.simge), el("span", "", b.ad));
    d.addEventListener("click", () => { kalem.sec(kalem.arac() === b.id ? null : b.id); d.blur(); });
    aracDugmeleri.set(b.id, d);
    araclar.append(d);
  }
  const aracIpucu = el("div", "zs-ipucu");
  araclarBolumu.append(el("div", "zs-baslik", "Kalem"), araclar, aracIpucu);

  // ── fırça ayarları ──
  const ayarBolumu = el("div", "zs-bolum");
  const kaydirici = (etiket: string, s: { min: number; max: number; adim: number }, oku: () => number, yaz: (v: number) => void, goster: (v: number) => string) => {
    const satir = el("div", "zs-satir");
    const l = el("label", "", etiket);
    const g = el("input"); g.type = "range"; g.min = String(s.min); g.max = String(s.max); g.step = String(s.adim);
    const o = el("output");
    g.addEventListener("input", () => { yaz(Number(g.value)); });
    g.addEventListener("change", () => g.blur());
    satir.append(l, g, o);
    return { satir, tazele() { g.value = String(oku()); o.textContent = goster(oku()); } };
  };
  const boyut = kaydirici("Boyut", KALEM_SINIRLARI.yaricap, () => kalem.ayar().yaricap, (v) => kalem.ayarla({ yaricap: v }), (v) => `${v} m`);
  const guc = kaydirici("Güç", KALEM_SINIRLARI.guc, () => kalem.ayar().guc, (v) => kalem.ayarla({ guc: v }), (v) => gucEtiketi(kalem.arac() ?? "yukselt", v));
  const sertlik = kaydirici("Sertlik", KALEM_SINIRLARI.sertlik, () => kalem.ayar().sertlik, (v) => kalem.ayarla({ sertlik: v }), (v) => `%${Math.round(v * 100)}`);
  const oturEtiket = el("label", "zs-onay");
  const oturKutu = el("input"); oturKutu.type = "checkbox";
  oturKutu.addEventListener("change", () => { kalem.ayarla({ nesneleriOturt: oturKutu.checked }); oturKutu.blur(); });
  oturEtiket.title = "Zemini oynatınca üstündeki nesneler (bina, eşya) yeni yüksekliğe taşınır; kapalıysa olduğu yerde kalır";
  oturEtiket.append(oturKutu, el("span", "", "Nesneleri araziye oturt"));
  ayarBolumu.append(el("div", "zs-baslik", "Fırça"), boyut.satir, guc.satir, sertlik.satir, oturEtiket);

  // ── geçmiş ──
  const gecmisBolumu = el("div", "zs-bolum");
  const dugmeler = el("div", "zs-dugmeler");
  const dugme = (yazi: string, is: () => void): HTMLButtonElement => {
    const d = el("button", "zs-dugme", yazi); d.type = "button";
    d.addEventListener("click", () => { is(); d.blur(); });
    return d;
  };
  const geriDugme = dugme("", () => { void baglanti.geriAl(); });
  const ileriDugme = dugme("", () => { void baglanti.ileriAl(); });
  let onayZamani: ReturnType<typeof setTimeout> | undefined;
  const donDugme = dugme("", () => {
    if (donDugme.dataset["onay"] === "1") { clearTimeout(onayZamani); donDugme.dataset["onay"] = "0"; void baglanti.dosyadakineDon(); return; }
    donDugme.dataset["onay"] = "1";
    clearTimeout(onayZamani);
    onayZamani = setTimeout(() => { donDugme.dataset["onay"] = "0"; tazele(); }, ONAY_MS);
    tazele();
  });
  donDugme.title = "Senin şekillendirdiğin zemini atar, level dosyasındaki zemine döner (geri alınabilir)";
  dugmeler.append(geriDugme, ileriDugme, donDugme);
  const durumMetni = el("div", "zs-durum");
  gecmisBolumu.append(el("div", "zs-baslik", "Geçmiş"), dugmeler, durumMetni);

  kok.append(araclarBolumu, ayarBolumu, gecmisBolumu);

  function tazele(): void {
    const secili = kalem.arac();
    for (const [id, d] of aracDugmeleri) d.dataset.etkin = id === secili ? "1" : "0";
    aracIpucu.textContent = secili
      ? `${aracBilgisi(secili).ipucu}. Basılı tut ve sürükle · Shift ters · Ctrl+tekerlek boyut`
      : "Bir araç seç, sonra sahnede basılı tutarak şekillendir.";
    boyut.tazele(); guc.tazele(); sertlik.tazele();
    oturKutu.checked = kalem.ayar().nesneleriOturt;
    const s = baglanti.sayilar();
    geriDugme.textContent = `↶ Geri al${s.geri ? ` (${s.geri})` : ""}`; geriDugme.disabled = s.geri === 0;
    ileriDugme.textContent = `↷ İleri al${s.ileri ? ` (${s.ileri})` : ""}`; ileriDugme.disabled = s.ileri === 0;
    donDugme.disabled = !baglanti.sekilVar();
    donDugme.textContent = donDugme.dataset["onay"] === "1" ? "Emin misin? Tekrar tıkla" : "Dosyadaki zemine dön";
    durumMetni.textContent = baglanti.sekilVar() ? "Zemin senin şekillendirdiğin hâlde; tarayıcıda kayıtlı. Level dosyasına yazılmaz." : "Zemin level dosyasındaki hâlinde.";
    arac.rozet(secili ? "●" : null);
    arac.ipucu(secili ? `${aracBilgisi(secili).ad} · basılı tut ve sürükle · Shift ters · Ctrl+tekerlek boyut · Ctrl+Z geri al · sağ tık / Esc bırak` : "Bir araç seç, sahnede basılı tutarak şekillendir");
  }
  // Abonelikler sekme ömrü boyunca açık kalır: kalem çubuk kapalıyken de çalışır, rozet doğru kalmalı.
  kalem.dinle(tazele);
  baglanti.degistiginde(tazele);

  return { goster: tazele };
}
