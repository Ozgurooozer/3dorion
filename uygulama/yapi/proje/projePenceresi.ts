// uygulama/yapi/proje/projePenceresi.ts — PROJE TARAYICISI (spec 39 D2; Unreal'ın Project Browser'ı): projeleri listeler, yeni proje açar, projeyi AÇAR. DOM katmanı.
//
// Mantık `projeModeli.ts`te (testli). Burası yalnız çizer ve host'a sorar (`kopru.projeListe/Yeni/Ac`). AÇ projeyi canlı değiştirmez: host seçimi yazıp
// uygulamayı YENİDEN BAŞLATIR — kaydedilmemiş sekme varsa önce uyarır, ikinci tıklama gerekir (`acmaUyarisi`). Pencere imleç kipinde açılır (`izin`).
// TUŞLAR OYUNA SIZMAZ: pencere içindeki keydown/keyup/keypress burada biter; Esc kapatır. Katman: ana menü şeridinin (z 40) üstü, altyazının (31) üstü.
"use strict";
import type { Kopru, ProjeDurumu, SablonAdi } from "../../../host/kopru.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../world/arayuz/arayuzJetonlari.ts";
import { SABLONLAR, acmaUyarisi, hataMetni, projeKartlari } from "./projeModeli.ts";

export interface ProjePenceresiAyari {
  /** Yalnız proje kanalları (testte sahte). */
  kopru: Pick<Kopru, "projeListe" | "projeYeni" | "projeAc">;
  /** Açılmadan önce: fare serbest olsun (imleç kipi). false dönerse açılmaz. */
  izin(): boolean;
  /** Kaydedilmemiş değişikliği olan sekmeler ("sekans 'a'"…): proje açılırken uyarı için. */
  kirli(): string[];
  altyazi(metin: string, ms?: number): void;
}
export interface ProjePenceresi { ac(odak?: "liste" | "yeni"): Promise<void>; kapat(): void; acikMi(): boolean }

const CSS = `
.pp-kok { position: fixed; inset: 0; z-index: 45; display: none; align-items: center; justify-content: center; background: rgba(4,6,12,0.62); font: ${YAPI_YAZI.govde}; color: ${R.yazi}; user-select: none; outline: none; }
.pp-kok[data-acik="1"] { display: flex; }
.pp-kutu { width: min(620px, 92vw); max-height: 82vh; display: flex; flex-direction: column; background: #0e1424; border: 1px solid ${R.cizgi}; border-radius: 10px; box-shadow: 0 18px 50px rgba(0,0,0,0.7); }
.pp-bas { display: flex; align-items: center; padding: 10px 14px; border-bottom: 1px solid ${R.cizgi}; font-weight: 600; color: ${R.yaziParlak}; }
.pp-bas .pp-bosluk { flex: 1; }
.pp-kok button { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 6px; padding: 3px 12px; font: inherit; cursor: pointer; }
.pp-kok button:hover:not(:disabled) { border-color: ${R.vurgu}; color: ${R.yaziParlak}; } .pp-kok button:disabled { opacity: 0.4; cursor: default; }
.pp-kok button[data-ton="onay"]:not(:disabled) { border-color: ${R.iyiCizgi}; color: ${R.iyi}; } .pp-kok button[data-ton="uyari"] { border-color: ${R.uyari}; color: ${R.uyari}; }
.pp-liste { flex: 1; min-height: 80px; overflow: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.pp-kart { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: ${R.kart}; border: 1px solid ${R.kartCizgi}; border-radius: 8px; }
.pp-kart[data-acik="1"] { border-color: ${R.iyiCizgi}; } .pp-kart[data-bozuk="1"] { border-color: #7a3030; }
.pp-ad { font-weight: 600; color: ${R.yaziParlak}; } .pp-durum { color: ${R.yaziSoluk}; font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-kart[data-bozuk="1"] .pp-durum { color: ${R.hata}; }
.pp-yeni { border-top: 1px solid ${R.cizgi}; padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pp-yeni input, .pp-yeni select { background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 3px 8px; font: inherit; user-select: text; min-width: 0; }
.pp-yeni input { flex: 1; min-width: 140px; }
.pp-mesaj { padding: 6px 14px 10px; min-height: 18px; font-size: 12px; color: ${R.yaziOrta}; } .pp-mesaj[data-tur="hata"] { color: ${R.hata}; } .pp-mesaj[data-tur="uyari"] { color: ${R.uyari}; } .pp-mesaj[data-tur="iyi"] { color: ${R.iyi}; }
.pp-kok-yol { padding: 0 14px 6px; color: ${R.yaziSoluk}; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
let stilEklendi = false;

const dugme = dugmeYap("");

export function projePenceresiKur(a: ProjePenceresiAyari): ProjePenceresi {
  if (!stilEklendi) { const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); stilEklendi = true; }
  const kok = el("div", "pp-kok"); kok.tabIndex = -1; kok.dataset.acik = "0";
  const kutu = el("div", "pp-kutu");
  const kapatD = dugme("✕", "", "Kapat (Esc)");
  const bas = el("div", "pp-bas"); bas.append(el("span", "", "📁 Projeler"), el("span", "pp-bosluk"), kapatD);
  const yol = el("div", "pp-kok-yol"), liste = el("div", "pp-liste"), mesaj = el("div", "pp-mesaj");
  const adGirdisi = el("input"); adGirdisi.placeholder = "yeni proje adı"; adGirdisi.maxLength = 48; adGirdisi.spellcheck = false;
  const sablon = el("select"); for (const s of SABLONLAR) { const o = el("option", "", s.ad); o.value = s.id; o.title = s.aciklama; sablon.append(o); }
  const olusturD = dugme("Oluştur", "", "Projeyi oluşturur; açmak için listeden Aç'a bas"); olusturD.dataset.ton = "onay";
  const yeni = el("div", "pp-yeni"); yeni.append(el("span", "", "Yeni proje:"), adGirdisi, sablon, olusturD);
  kutu.append(bas, yol, liste, yeni, mesaj); kok.append(kutu);

  let acik = false, onayBekleyen: string | null = null;
  const bildir = (m: string, tur: "bilgi" | "hata" | "uyari" | "iyi" = "bilgi") => { mesaj.textContent = m; mesaj.dataset.tur = tur; };

  async function yenile(): Promise<void> {
    const r = await a.kopru.projeListe();
    if (!r.ok) { bildir(`Projeler okunamadı: ${hataMetni(r.kod, r.mesaj)}`, "hata"); return; }
    ciz(r.deger);
  }

  function ciz(d: ProjeDurumu): void {
    yol.textContent = `Klasör: ${d.kok}`; yol.title = d.kok;
    liste.replaceChildren();
    const kartlar = projeKartlari(d);
    if (!kartlar.length) liste.append(el("div", "pp-durum", "Henüz proje yok — aşağıdan oluştur."));
    for (const k of kartlar) {
      const kart = el("div", "pp-kart"); kart.dataset.acik = k.acik ? "1" : "0"; kart.dataset.bozuk = k.bozuk ? "1" : "0";
      const ac = dugme(k.acik ? "Açık" : onayBekleyen === k.ad ? "Yine de aç" : "Aç", "", k.acik ? "Bu proje zaten açık" : "Projeyi aç (uygulama yeniden başlar)");
      ac.disabled = !k.acilabilir;
      if (onayBekleyen === k.ad) ac.dataset.ton = "uyari";
      ac.addEventListener("click", () => { void projeyiAc(k.ad); });
      kart.append(el("span", "pp-ad", k.ad), el("span", "pp-durum", k.durum), ac);
      liste.append(kart);
    }
  }

  async function projeyiAc(ad: string): Promise<void> {
    const uyari = acmaUyarisi(a.kirli());
    if (uyari && onayBekleyen !== ad) { onayBekleyen = ad; bildir(uyari, "uyari"); await yenile(); return; }
    onayBekleyen = null;
    const r = await a.kopru.projeAc(ad);
    if (!r.ok) { bildir(hataMetni(r.kod, r.mesaj), "hata"); await yenile(); return; }
    if (r.deger.yeniden) bildir(`'${ad}' açılıyor — uygulama yeniden başlıyor…`, "iyi");
    else bildir(r.deger.neden ?? "açılmadı", "bilgi");
  }

  async function olustur(): Promise<void> {
    const ad = adGirdisi.value.trim();
    if (!ad) { bildir("Bir proje adı yaz.", "uyari"); adGirdisi.focus(); return; }
    olusturD.disabled = true;
    try {
      const r = await a.kopru.projeYeni(ad, sablon.value as SablonAdi);
      if (!r.ok) { bildir(hataMetni(r.kod, r.mesaj), "hata"); return; }
      adGirdisi.value = ""; bildir(`'${r.deger.ad}' oluşturuldu: ${r.deger.dizin} — açmak için listeden Aç'a bas.`, "iyi");
      await yenile();
    } finally { olusturD.disabled = false; }
  }

  olusturD.addEventListener("click", () => { void olustur(); });
  kapatD.addEventListener("click", () => kapat());
  kok.addEventListener("pointerdown", (e) => { if (e.target === kok) kapat(); });   // dışarı tık
  kok.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); kapat(); return; }
    if (e.key === "Enter" && e.target === adGirdisi) { e.preventDefault(); void olustur(); }
  });
  kok.addEventListener("keyup", (e) => e.stopPropagation());
  kok.addEventListener("keypress", (e) => e.stopPropagation());
  kok.addEventListener("contextmenu", (e) => { if (e.target !== adGirdisi) e.preventDefault(); e.stopPropagation(); });

  function kapat(): void { if (!acik) return; acik = false; onayBekleyen = null; kok.dataset.acik = "0"; if (document.activeElement && kok.contains(document.activeElement)) (document.activeElement as HTMLElement).blur(); }

  async function ac(odak: "liste" | "yeni" = "liste"): Promise<void> {
    if (!acik) {
      if (!a.izin()) { a.altyazi("proje penceresi şimdi açılamaz (sohbet, onay ya da odak açık)", 2500); return; }
      acik = true; onayBekleyen = null; bildir("");
      if (!kok.isConnected) document.body.append(kok);
      kok.dataset.acik = "1";
    }
    await yenile();
    if (odak === "yeni") adGirdisi.focus(); else kok.focus({ preventScroll: true });
  }

  return { ac, kapat, acikMi: () => acik };
}
