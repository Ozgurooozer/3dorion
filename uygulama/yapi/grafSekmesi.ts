// uygulama/yapi/grafSekmesi.ts — ALT ÇUBUK · GRAF SEKMESİ (spec 35 dilim 1, MVP): grafikler ve desenler, Kontrol et, ▶ Çalıştır / ■ Durdur. DOM katmanı.
//
// Görsel düğüm editörü DEĞİL (dilim 2): düzenleme mevcut metin düzenleyici penceresiyle JSON'dur (çift tık ya da "Aç"). Burası listeler, denetler ve çalıştırır.
//   • Kartlar iki şeritte: Grafikler (▶ ile çalışan programlar) ve Desenler (başka grafikten tek düğüm olarak çağrılan alt-grafikler). Bozuk dosya kırmızı ve
//     nedeniyle görünür (sessiz kayıp yok). Tık seçer, çift tık düzenleyicide açar.
//   • Kontrol et: kaydedilmiş hâlin biçim hatası (depo) ya da tür denetimi (kütüphane) — hatalar satır satır.
//   • ▶ ÇALIŞTIR YALNIZ OZYN'İN GERÇEK TIKLAMASIYLA: olay `isTrusted` değilse (betikten `.click()`, senaryo, konsol) yok sayılır; Orion'un araç yüzeyinde
//     grafik çalıştıran bir yol yoktur (bekçi: uygulama/graf/ajanDugumleri.test.ts "▶ TEK YERDEN"). Aynı anda tek çalışma; ■ her an.
//   • Çalışırken canlı satır (şu anki düğüm: kimlik + tür adı, desen derinliği, süre); bitince son sonuç (bitti / durdu / hata + hangi düğüm).
// Mantık saf modüllerde ve testli (grafCalistirici.ts, grafDeposu.ts, ajanDugumleri.ts); bu dosya yalnız çizer ve düğmeleri bağlar — DOM'u test edecek bir
// tarayıcı ortamı bu projede yok (hafizaSekmesi.ts gibi), canlı deneme listesi spec 35'te.
"use strict";
import type { Sekme, SekmeAraci, SekmeIcerigi } from "../../world/arayuz/altCubuk.ts";
import { grafAdiGecerli } from "../../protocol/graf.ts";
import type { GrafDeposu, GrafKaydi } from "../graf/grafDeposu.ts";
import { canliSatir, sonucSatiri, type GrafCalistirici } from "../graf/grafCalistirici.ts";
import { yeniDesenSablonu, yeniGrafSablonu } from "../graf/kutuphane.ts";

export interface GrafSekmesiAyari {
  depo: GrafDeposu;
  calistirici: GrafCalistirici;
  /** Düzenleyici penceresinde aç (JSON). */
  ac: (ad: string) => void;
  /** Depo yüklenemediyse nedeni. */
  hata: () => string | null;
  bildir: (metin: string, ms?: number) => void;
}

const CSS = `
.gs-kok { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.gs-ust { display: flex; align-items: center; gap: 8px; padding: 8px 14px 4px; flex-wrap: wrap; }
.gs-satir { flex: 1; min-width: 200px; font: 12px/1.4 'Cascadia Mono', Consolas, monospace; color: #aab4d0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-satir[data-tur="calisiyor"] { color: #8fe0a8; }
.gs-satir[data-tur="hata"] { color: #ff8c84; }
.gs-satir[data-tur="durdu"] { color: #ffb454; }
.gs-dugme { background: #121726; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 11px; font: inherit; cursor: pointer; white-space: nowrap; }
.gs-dugme:hover:not(:disabled) { border-color: #58c1ff; }
.gs-dugme:disabled { opacity: 0.4; cursor: default; }
.gs-calistir:not(:disabled) { border-color: #2f8f5a; color: #8fe0a8; }
.gs-durdur:not(:disabled) { border-color: #c2563f; color: #ff9c84; }
.gs-yeni { display: flex; align-items: center; gap: 6px; }
.gs-yeni input { width: 150px; background: #121726; color: #eef1fa; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 9px; font: inherit; user-select: text; }
.gs-yeni-hata { color: #ff8c84; font-size: 12px; }
.gs-govde { flex: 1; min-height: 0; display: flex; gap: 10px; padding: 4px 14px 10px; }
.gs-sutun { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.gs-baslik { color: #7c88a6; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; padding: 2px 0 4px; }
.gs-serit { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); grid-auto-rows: 64px; gap: 8px; align-content: start; }
.gs-kart { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; background: #151c2b; border: 1px solid #222c41; border-radius: 9px; cursor: pointer; overflow: hidden; }
.gs-kart:hover { border-color: #4a69b0; }
.gs-kart[data-secili="1"] { border-color: #58c1ff; background: #182238; }
.gs-kart[data-bozuk="1"] { border-color: #7a3030; }
.gs-kart[data-calisiyor="1"] { border-color: #2f8f5a; }
.gs-ad { font-weight: 600; color: #eef1fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-alt { color: #6b7794; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-kart[data-bozuk="1"] .gs-alt { color: #ff8c84; }
.gs-kontrol { width: 300px; flex: none; overflow: auto; font-size: 12px; color: #aab4d0; border-left: 1px solid #222c41; padding-left: 10px; }
.gs-kontrol li { margin: 0 0 4px 14px; color: #ffcf8a; }
.gs-kontrol .gs-tamam { color: #8fe0a8; }
.gs-bos { grid-column: 1 / -1; padding: 10px 2px; color: #7c88a6; }
`;

export function grafSekmesi(a: GrafSekmesiAyari): Sekme {
  return {
    id: "graf", ad: "Graf", simge: "🧩", sira: 50,
    ipucu: "Orion ve Flash'ı süren programlar (düğüm grafiği): seç · çift tık JSON'u düzenle · Kontrol et · ▶ çalıştır · ■ durdur",
    kur(sayfa, arac): SekmeIcerigi { return kur(sayfa, arac, a); },
  };
}

function kur(sayfa: HTMLElement, arac: SekmeAraci, a: GrafSekmesiAyari): SekmeIcerigi {
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);
  const el = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin) e.textContent = metin; return e;
  };
  const dugme = (metin: string, sinif = "", ipucu = ""): HTMLButtonElement => {
    const b = el("button", `gs-dugme ${sinif}`.trim(), metin); b.type = "button"; if (ipucu) b.title = ipucu; return b;
  };

  const kok = el("div", "gs-kok");
  const ust = el("div", "gs-ust");
  const satir = el("div", "gs-satir");
  const calistir = dugme("▶ Çalıştır", "gs-calistir", "Seçili grafiği çalıştır (yalnız senin tıklamanla)");
  const durdur = dugme("■ Durdur", "gs-durdur", "Süren grafiği hemen durdur (yürüyen ajan da durur)");
  const kontrolDugme = dugme("Kontrol et", "", "Kaydedilmiş hâlin biçim ve tür denetimi");
  const acDugme = dugme("Aç", "", "Seçili grafiği düzenleyicide aç (JSON)");
  const yeniGraf = dugme("＋ Yeni grafik", "", "Çalışan bir örnekle başlar: Flash yanına gelir, el sallar, selam verir");
  const yeniDesen = dugme("＋ Yeni desen", "", "Girişli alt-grafik: başka bir grafikte 'Desen' düğümüyle tek düğüm olarak çağrılır");
  const yeniKutu = el("div", "gs-yeni"); yeniKutu.style.display = "none";
  const yeniGirdi = el("input"); yeniGirdi.autocomplete = "off"; yeniGirdi.spellcheck = false;
  const yeniHata = el("span", "gs-yeni-hata");
  yeniKutu.append(yeniGirdi, yeniHata);
  ust.append(satir, calistir, durdur, kontrolDugme, acDugme, yeniKutu, yeniGraf, yeniDesen);

  const govde = el("div", "gs-govde");
  const sutun = (baslik: string) => { const s = el("div", "gs-sutun"); const serit = el("div", "gs-serit"); s.append(el("div", "gs-baslik", baslik), serit); return { s, serit }; };
  const grafikler = sutun("Grafikler (▶ ile çalışır)");
  const desenler = sutun("Desenler (tek düğüm olarak çağrılır)");
  const kontrol = el("div", "gs-kontrol");
  govde.append(grafikler.s, desenler.s, kontrol);
  kok.append(ust, govde);
  sayfa.append(kok);

  let secili: string | null = null;
  const kayit = (ad: string | null): GrafKaydi | null => (ad ? a.depo.liste().find((k) => k.ad === ad) ?? null : null);

  // ── üst satır: canlı satır / son sonuç ──
  let saat: ReturnType<typeof setInterval> | null = null;
  function satirCiz(): void {
    const d = a.calistirici.durum();
    if (d.calisiyor) {
      satir.dataset.tur = "calisiyor";
      satir.textContent = canliSatir(d, Date.now());
    } else if (d.son) {
      satir.dataset.tur = d.son.durum;
      satir.textContent = sonucSatiri(d.son);
    } else {
      satir.dataset.tur = "";
      satir.textContent = "Henüz çalıştırılmadı. Bir grafik seç ve ▶ Çalıştır.";
    }
    satir.title = satir.textContent;
    arac.rozet(d.calisiyor ? "▶" : null);
  }
  function dugmeleriCiz(): void {
    const k = kayit(secili);
    const calisiyor = a.calistirici.durum().calisiyor !== null;
    const neden = calisiyor ? "zaten bir grafik çalışıyor (■ ile durdur)" : !k ? "önce bir grafik seç" : k.hata ? `bozuk: ${k.hata}` : k.tur !== "olay" ? "desen tek başına çalışmaz" : "";
    calistir.disabled = neden !== "";
    calistir.title = neden || `'${k?.ad}' çalıştır (yalnız senin tıklamanla)`;
    durdur.disabled = !calisiyor;
    kontrolDugme.disabled = !k;
    acDugme.disabled = !k;
  }
  a.calistirici.dinle((d) => {
    satirCiz(); dugmeleriCiz(); kartlariIsaretle();
    if (d.calisiyor && !saat) saat = setInterval(satirCiz, 250);   // geçen süre canlı
    if (!d.calisiyor && saat) { clearInterval(saat); saat = null; }
  });

  // ── ▶ / ■ ──
  calistir.addEventListener("click", (e) => {
    calistir.blur();
    // YALNIZ GERÇEK TIKLAMA: betikten üretilen tık (`el.click()`, senaryo, konsol) programı başlatmaz (spec 35 §1: çalıştıran Ozyn'in tuşu).
    if (!e.isTrusted || !secili) return;
    const r = a.calistirici.calistir(secili);
    if (!r.ok) a.bildir(`çalıştırılamadı: ${r.neden}`, 4000);
  });
  durdur.addEventListener("click", () => { durdur.blur(); a.calistirici.durdur(); });

  // ── Kontrol et ──
  function kontrolEt(): void {
    const k = kayit(secili);
    kontrol.replaceChildren();
    if (!k) return;
    kontrol.append(el("div", "", `Kontrol: ${k.ad} (kaydedilmiş hâli)`));
    const g = a.depo.al(k.ad);
    const hatalar = k.hata ? [k.hata] : g ? a.calistirici.kontrol(g) : ["grafik yüklenemedi"];
    if (!hatalar.length) {
      kontrol.append(el("div", "gs-tamam", k.tur === "olay" ? "✓ hata yok: çalıştırılabilir" : "✓ hata yok (desen: bir grafikte 'Desen' düğümüyle çağrılır)"));
      return;
    }
    const l = el("ul");
    for (const h of hatalar) l.append(el("li", "", h));
    kontrol.append(el("div", "", `✗ ${hatalar.length} sorun:`), l);
  }
  kontrolDugme.addEventListener("click", () => { kontrolDugme.blur(); kontrolEt(); });
  acDugme.addEventListener("click", () => { acDugme.blur(); if (secili) a.ac(secili); });

  // ── yeni grafik / desen ──
  let yeniTur: "olay" | "fonksiyon" = "olay";
  const yeniKapat = () => { yeniKutu.style.display = "none"; yeniGraf.style.display = ""; yeniDesen.style.display = ""; yeniGirdi.value = ""; yeniHata.textContent = ""; };
  const yeniAc = (tur: "olay" | "fonksiyon") => {
    yeniTur = tur;
    yeniGraf.style.display = "none"; yeniDesen.style.display = "none"; yeniKutu.style.display = "flex";
    yeniGirdi.placeholder = tur === "olay" ? "grafik adı (örn. selam)" : "desen adı (örn. selamla)";
    yeniGirdi.focus();
  };
  yeniGraf.addEventListener("click", () => { yeniGraf.blur(); yeniAc("olay"); });
  yeniDesen.addEventListener("click", () => { yeniDesen.blur(); yeniAc("fonksiyon"); });
  yeniGirdi.addEventListener("keydown", (e) => {
    e.stopPropagation();   // yazarken çubuk kısayolları (1–9, Y) ve oyun tuşları çalışmasın
    if (e.key === "Escape") { yeniKapat(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ad = yeniGirdi.value.trim();
    if (!grafAdiGecerli(ad)) { yeniHata.textContent = "geçersiz ad (harf, rakam, _ ve -; boşluk yok)"; return; }
    if (kayit(ad)) { yeniHata.textContent = "bu ad zaten var"; return; }
    const g = yeniTur === "olay" ? yeniGrafSablonu(ad) : yeniDesenSablonu(ad);
    void a.depo.yeni(g).then(() => { yeniKapat(); secili = ad; ciz(); a.ac(ad); }, (err: unknown) => { yeniHata.textContent = err instanceof Error ? err.message : String(err); });
  });
  yeniGirdi.addEventListener("keyup", (e) => e.stopPropagation());

  // ── kartlar ──
  const kartlar = new Map<string, HTMLElement>();
  function kart(k: GrafKaydi): HTMLElement {
    const c = el("div", "gs-kart");
    c.dataset.bozuk = k.hata ? "1" : "0";
    c.title = `${k.ad}${k.aciklama ? `\n${k.aciklama}` : ""}${k.hata ? `\n✗ ${k.hata}` : ""}\nTık: seç · Çift tık: düzenle`;
    c.append(el("div", "gs-ad", `${k.tur === "fonksiyon" ? "🧩" : k.hata ? "⚠" : "▶"} ${k.ad}`), el("div", "gs-alt", k.hata ? `bozuk: ${k.hata}` : k.aciklama ?? ""));
    c.addEventListener("click", () => { secili = k.ad; kontrol.replaceChildren(); kartlariIsaretle(); dugmeleriCiz(); });
    c.addEventListener("dblclick", () => a.ac(k.ad));
    kartlar.set(k.ad, c);
    return c;
  }
  function kartlariIsaretle(): void {
    const calisan = a.calistirici.durum().calisiyor?.graf ?? null;
    for (const [ad, c] of kartlar) { c.dataset.secili = ad === secili ? "1" : "0"; c.dataset.calisiyor = ad === calisan ? "1" : "0"; }
  }
  function ciz(): void {
    const liste = a.depo.liste();
    if (secili && !liste.some((k) => k.ad === secili)) secili = null;
    kartlar.clear();
    // Bozuk dosyanın türü bilinmiyorsa grafiklerin arasında görünür (orada nedeniyle durur).
    const olaylar = liste.filter((k) => k.tur !== "fonksiyon"), fonksiyonlar = liste.filter((k) => k.tur === "fonksiyon");
    const h = a.hata();
    grafikler.serit.replaceChildren(...(olaylar.length ? olaylar.map(kart) : [el("div", "gs-bos", h ? `Grafikler yüklenemedi: ${h}` : "Henüz grafik yok. ＋ Yeni grafik ile çalışan bir örnekle başla.")]));
    desenler.serit.replaceChildren(...(fonksiyonlar.length ? fonksiyonlar.map(kart) : [el("div", "gs-bos", "Henüz desen yok.")]));
    kartlariIsaretle(); dugmeleriCiz(); satirCiz();
  }
  // Abonelik sekme ömrü boyunca açık: kaydedince kart (bozuk/açıklama) çubuk kapalıyken de güncel kalır.
  a.depo.dinle((o) => { if (o.tur === "liste") ciz(); });
  return { goster() { ciz(); arac.ipucu("Tık: seç · Çift tık: JSON'u düzenle (Ctrl+S kaydeder, biçimi doğrular) · Kontrol et · ▶ / ■"); } };
}
