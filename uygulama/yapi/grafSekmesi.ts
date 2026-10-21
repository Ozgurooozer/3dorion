// uygulama/yapi/grafSekmesi.ts — ALT ÇUBUK · GRAF SEKMESİ (spec 35 dilim 1, MVP): grafikler ve desenler, Kontrol et, ▶ Çalıştır / ■ Durdur. DOM katmanı.
//
// Görsel düğüm editörü DEĞİL (dilim 2): düzenleme mevcut metin düzenleyici penceresiyle JSON'dur (çift tık ya da "Aç"). Burası listeler, denetler ve çalıştırır.
//   • Kartlar iki şeritte: Grafikler (▶ ile çalışan programlar) ve Desenler (başka grafikten tek düğüm olarak çağrılan alt-grafikler). Bozuk dosya kırmızı ve
//     nedeniyle görünür (sessiz kayıp yok). Tık seçer, çift tık düzenleyicide açar.
//   • Kontrol et: kaydedilmiş hâlin biçim hatası (depo) ya da tür denetimi (kütüphane) — hatalar satır satır.
//   • ▶ ÇALIŞTIR YALNIZ OZYN'İN GERÇEK TIKLAMASIYLA: olay `isTrusted` değilse (betikten `.click()`, senaryo, konsol) yok sayılır; Orion'un araç yüzeyinde
//     grafik çalıştıran bir yol yoktur (bekçi: uygulama/graf/ajanDugumleri.test.ts "▶ TEK YERDEN"). Aynı anda tek çalışma; ■ her an.
//   • Çalışırken canlı satır (şu anki düğüm: kimlik + tür adı, desen derinliği, süre); bitince son sonuç (bitti / durdu / hata + hangi düğüm).
//   • ⚡ DİNLEMEYE AL (dilim 2) da YALNIZ GERÇEK TIKLAMAYLA: olay gelince çalıştırma iznidir (bekçi: grafDinleyici.test.ts). Dinlemedekiler sağda listelenir
//     (tetik/atlanan sayıları, bırak, hepsini bırak); ■ bütün süren çalışmaları (▶ + olay) durdurur, dinlemeyi bırakmaz. Seçili grafiğin bellekteki
//     değişkenleri Kontrol et altında (Durumu sıfırla).
// Mantık saf modüllerde ve testli (grafCalistirici.ts, grafDeposu.ts, ajanDugumleri.ts); bu dosya yalnız çizer ve düğmeleri bağlar — DOM'u test edecek bir
// tarayıcı ortamı bu projede yok (hafizaSekmesi.ts gibi), canlı deneme listesi spec 35'te.
"use strict";
import type { Sekme, SekmeAraci, SekmeIcerigi } from "../../world/arayuz/altCubuk.ts";
import { grafAdiGecerli } from "../../protocol/graf.ts";
import type { GrafDegeri } from "../../protocol/graf.ts";
import type { GrafDeposu, GrafKaydi } from "../graf/grafDeposu.ts";
import { canliSatir, sonucSatiri, type GrafCalistirici } from "../graf/grafCalistirici.ts";
import type { GrafDinleyici } from "../graf/grafDinleyici.ts";
import { GRAF_SABLONLARI, yeniDesenSablonu } from "../graf/kutuphane.ts";

export interface GrafSekmesiAyari {
  depo: GrafDeposu;
  calistirici: GrafCalistirici;
  /** ⚡ Dinleme (dilim 2): olay tetikli çalışma. Kurulum yalnız buradan, yalnız gerçek tıklamayla. */
  dinleyici: GrafDinleyici;
  /** Grafiklerin bellekteki değişkenleri (gösterim ve "Durumu sıfırla"). */
  durum: { ozet(graf: string): Readonly<Record<string, GrafDegeri>>; sifirla(graf: string): boolean; dinle(f: (graf: string) => void): () => void };
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
.gs-dinle:not(:disabled) { border-color: #a87a2a; color: #ffcf8a; }
.gs-kart[data-dinliyor="1"] { border-color: #a87a2a; }
.gs-sag { width: 320px; flex: none; display: flex; flex-direction: column; gap: 8px; min-height: 0; border-left: 1px solid #222c41; padding-left: 10px; }
.gs-sag .gs-kontrol { width: auto; border-left: 0; padding-left: 0; flex: 1; min-height: 0; }
.gs-dinleme { font-size: 12px; color: #aab4d0; max-height: 45%; overflow: auto; }
.gs-dinleme-satir { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.gs-dinleme-satir span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-dinleme-satir[data-calisiyor="1"] span { color: #8fe0a8; }
.gs-dinleme .gs-dugme { padding: 1px 8px; font-size: 11px; }
.gs-yeni select { background: #121726; color: #eef1fa; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 6px; font: inherit; }
.gs-durum { margin-top: 8px; color: #9fb0d8; }
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
  const durdur = dugme("■ Durdur", "gs-durdur", "Süren bütün grafikleri hemen durdur (▶ ve olayla çalışanlar; yürüyen ajan da durur, açık diyalog kapanır)");
  const dinleDugme = dugme("⚡ Dinlemeye al", "gs-dinle", "Seçili grafik olay gelince (Ozyn Flash'a yaklaştı…) çalışsın — yalnız senin tıklamanla; uygulama kapanınca biter");
  const kontrolDugme = dugme("Kontrol et", "", "Kaydedilmiş hâlin biçim ve tür denetimi");
  const acDugme = dugme("Aç", "", "Seçili grafiği düzenleyicide aç (JSON)");
  const yeniGraf = dugme("＋ Yeni grafik", "", "Çalışan bir örnekle başlar (şablon seç): selam — Flash yanına gelir, el sallar; nöbetçi — yaklaşınca parola sorar");
  const yeniDesen = dugme("＋ Yeni desen", "", "Girişli alt-grafik: başka bir grafikte 'Desen' düğümüyle tek düğüm olarak çağrılır");
  const yeniKutu = el("div", "gs-yeni"); yeniKutu.style.display = "none";
  const yeniGirdi = el("input"); yeniGirdi.autocomplete = "off"; yeniGirdi.spellcheck = false;
  const yeniHata = el("span", "gs-yeni-hata");
  // Şablon seçimi (yalnız grafik için): boş sayfa yerine çalışan örnek — selam (▶) ya da nöbetçi (⚡ olay + diyalog).
  const sablonSec = el("select");
  for (const s of GRAF_SABLONLARI) { const o = el("option", "", s.ad); o.value = s.id; sablonSec.append(o); }
  sablonSec.addEventListener("keydown", (e) => e.stopPropagation());
  yeniKutu.append(sablonSec, yeniGirdi, yeniHata);
  ust.append(satir, calistir, durdur, dinleDugme, kontrolDugme, acDugme, yeniKutu, yeniGraf, yeniDesen);

  const govde = el("div", "gs-govde");
  const sutun = (baslik: string) => { const s = el("div", "gs-sutun"); const serit = el("div", "gs-serit"); s.append(el("div", "gs-baslik", baslik), serit); return { s, serit }; };
  const grafikler = sutun("Grafikler (▶ ile ya da ⚡ olayla çalışır)");
  const desenler = sutun("Desenler (tek düğüm olarak çağrılır)");
  const sag = el("div", "gs-sag");
  const dinleme = el("div", "gs-dinleme");
  const kontrol = el("div", "gs-kontrol");
  sag.append(dinleme, kontrol);
  govde.append(grafikler.s, desenler.s, sag);
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
    const olayla = a.dinleyici.liste();
    arac.rozet(d.calisiyor || olayla.some((x) => x.calisiyor) ? "▶" : olayla.length ? "⚡" : null);
  }
  function dugmeleriCiz(): void {
    const k = kayit(secili);
    const calisiyor = a.calistirici.durum().calisiyor !== null;
    const neden = calisiyor ? "zaten bir grafik çalışıyor (■ ile durdur)" : !k ? "önce bir grafik seç" : k.hata ? `bozuk: ${k.hata}` : k.tur !== "olay" ? "desen tek başına çalışmaz" : "";
    calistir.disabled = neden !== "";
    calistir.title = neden || `'${k?.ad}' çalıştır (yalnız senin tıklamanla)`;
    durdur.disabled = !calisiyor && !a.dinleyici.liste().some((x) => x.calisiyor);
    // Seçili grafik dinlemedeyse aynı düğme BIRAKIR (bırakmak her zaman serbest); değilse kurar (yalnız gerçek tıklama).
    const dinlemede = !!k && a.dinleyici.dinlemedeMi(k.ad);
    dinleDugme.textContent = dinlemede ? "⚡ Dinlemeyi bırak" : "⚡ Dinlemeye al";
    dinleDugme.disabled = !k || (!dinlemede && (!!k.hata || k.tur !== "olay"));
    kontrolDugme.disabled = !k;
    acDugme.disabled = !k;
  }
  a.calistirici.dinle((d) => {
    satirCiz(); dugmeleriCiz(); kartlariIsaretle();
    if (d.calisiyor && !saat) saat = setInterval(satirCiz, 250);   // geçen süre canlı
    if (!d.calisiyor && saat) { clearInterval(saat); saat = null; }
  });
  a.dinleyici.dinle(() => { dinlemeCiz(); dugmeleriCiz(); kartlariIsaretle(); satirCiz(); });
  a.durum.dinle((g) => { if (g === secili && kontrol.childElementCount) kontrolEt(); });

  // ── ▶ / ■ ──
  calistir.addEventListener("click", (e) => {
    calistir.blur();
    // YALNIZ GERÇEK TIKLAMA: betikten üretilen tık (`el.click()`, senaryo, konsol) programı başlatmaz (spec 35 §1: çalıştıran Ozyn'in tuşu).
    if (!e.isTrusted || !secili) return;
    const r = a.calistirici.calistir(secili);
    if (!r.ok) a.bildir(`çalıştırılamadı: ${r.neden}`, 4000);
  });
  // ■ her şeyi durdurur (▶ çalışması + olay çalışmaları); dinleme SÜRER — bırakmak için "Dinlemeyi bırak". Durdurmak güvenlik yönü: isTrusted istemez.
  durdur.addEventListener("click", () => { durdur.blur(); a.calistirici.durdur(); a.dinleyici.durdur(); });

  // ── ⚡ dinleme ──
  dinleDugme.addEventListener("click", (e) => {
    dinleDugme.blur();
    if (!secili) return;
    if (a.dinleyici.dinlemedeMi(secili)) { a.dinleyici.birak(secili); return; }
    // YALNIZ GERÇEK TIKLAMA (▶ ile aynı kural): dinlemeye almak, olay gelince çalıştırma İZNİDİR; betik bu izni veremez.
    if (!e.isTrusted) return;
    const r = a.dinleyici.dinlemeyeAl(secili);
    if (!r.ok) a.bildir(`dinlemeye alınamadı: ${r.neden}`, 5000);
    else a.bildir(`⚡ ${secili} dinlemede (uygulama kapanınca biter)`, 2500);
  });
  function dinlemeCiz(): void {
    const l = a.dinleyici.liste();
    dinleme.replaceChildren();
    if (!l.length) { dinleme.append(el("div", "gs-alt", "⚡ Dinlemede grafik yok. Bir grafik seç ve ⚡ Dinlemeye al.")); return; }
    const bas = el("div", "gs-dinleme-satir");
    const hepsi = dugme("hepsini bırak", "", "Bütün dinlemeleri bırak (süren olay çalışmaları da durur)");
    hepsi.addEventListener("click", () => { hepsi.blur(); a.dinleyici.hepsiniBirak(); });
    bas.append(el("span", "gs-baslik", `⚡ Dinlemede (${l.length})`), hepsi);
    dinleme.append(bas);
    for (const x of l) {
      const s = el("div", "gs-dinleme-satir");
      s.dataset.calisiyor = x.calisiyor ? "1" : "0";
      const atlanan = x.atlanan.calisiyor + x.atlanan.soguma;
      const yazi = `${x.calisiyor ? "▶" : "⚡"} ${x.graf} · ${x.tetikler.map((t) => `${t.ajan}:${t.olay}`).join(", ")} · ${x.tetik} tetik${atlanan ? ` · ${atlanan} atlandı` : ""}`;
      const metin = el("span", "", yazi);
      metin.title = `${yazi}\natlanan: ${x.atlanan.calisiyor} (zaten çalışıyordu) · ${x.atlanan.soguma} (soğuma)${x.son ? `\nson: ${sonucSatiri(x.son)}` : ""}`;
      const birak = dugme("bırak", "", "Dinlemeyi bırak");
      birak.addEventListener("click", () => { birak.blur(); a.dinleyici.birak(x.graf); });
      s.append(metin, birak);
      dinleme.append(s);
    }
  }

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
    } else {
      const l = el("ul");
      for (const h of hatalar) l.append(el("li", "", h));
      kontrol.append(el("div", "", `✗ ${hatalar.length} sorun:`), l);
    }
    // Değişkenler (bellekte; uygulama kapanınca gider): nöbetçinin ziyaret sayacı burada görünür ve sıfırlanır.
    const ozet = Object.entries(a.durum.ozet(k.ad));
    if (k.tur !== "olay") return;
    const d = el("div", "gs-durum", ozet.length ? `Durum (bellekte): ${ozet.map(([ad, v]) => `${ad} = ${JSON.stringify(v)}`).join(" · ")}` : "Durum (bellekte): değişken yok");
    if (ozet.length) {
      const sifirla = dugme("Durumu sıfırla", "", "Bu grafiğin değişkenlerini sil (ziyaret sayacı 0'dan başlar)");
      sifirla.addEventListener("click", () => { sifirla.blur(); a.durum.sifirla(k.ad); kontrolEt(); });
      d.append(" ", sifirla);
    }
    kontrol.append(d);
  }
  kontrolDugme.addEventListener("click", () => { kontrolDugme.blur(); kontrolEt(); });
  acDugme.addEventListener("click", () => { acDugme.blur(); if (secili) a.ac(secili); });

  // ── yeni grafik / desen ──
  let yeniTur: "olay" | "fonksiyon" = "olay";
  const yeniKapat = () => { yeniKutu.style.display = "none"; yeniGraf.style.display = ""; yeniDesen.style.display = ""; yeniGirdi.value = ""; yeniHata.textContent = ""; };
  const yeniAc = (tur: "olay" | "fonksiyon") => {
    yeniTur = tur;
    yeniGraf.style.display = "none"; yeniDesen.style.display = "none"; yeniKutu.style.display = "flex";
    sablonSec.style.display = tur === "olay" ? "" : "none";
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
    const sablon = GRAF_SABLONLARI.find((s) => s.id === sablonSec.value) ?? GRAF_SABLONLARI[0]!;
    const g = yeniTur === "olay" ? sablon.kur(ad) : yeniDesenSablonu(ad);
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
    for (const [ad, c] of kartlar) {
      c.dataset.secili = ad === secili ? "1" : "0";
      c.dataset.calisiyor = ad === calisan || a.dinleyici.calisiyorMu(ad) ? "1" : "0";
      c.dataset.dinliyor = a.dinleyici.dinlemedeMi(ad) ? "1" : "0";
    }
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
    kartlariIsaretle(); dugmeleriCiz(); satirCiz(); dinlemeCiz();
  }
  // Abonelik sekme ömrü boyunca açık: kaydedince kart (bozuk/açıklama) çubuk kapalıyken de güncel kalır.
  a.depo.dinle((o) => { if (o.tur === "liste") ciz(); });
  return { goster() { ciz(); arac.ipucu("Tık: seç · Çift tık: JSON'u düzenle (Ctrl+S kaydeder, biçimi doğrular) · Kontrol et · ▶ / ■"); } };
}
