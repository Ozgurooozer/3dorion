// uygulama/yapi/level/yeniLevelPenceresi.ts — YENİ LEVEL PENCERESİ (spec 42 Y4; Unreal File ▸ New Level). DOM katmanı; mantık `yeniLevelModeli.ts`te (testli).
//
// Ad + şablon seçilir; "Oluştur" level dosyasını AÇIK PROJENİN `Content/Levels/<ad>/` klasörüne yazar (host `proje:level-olustur`, atomik, aynı ad = hata). Yeni level'ı AÇMAK bu
// dilimde yok (ofis'siz level'ın açılışı ayrı dilim, spec 42 §4): dosya İçerik gezgininde görünür, ışık/zemin düzenlemesi açık level üzerinde yapılır. Pencere imleç kipinde açılır.
// TUŞLAR OYUNA SIZMAZ (keydown/keyup/keypress burada biter); Esc kapatır. Yazma yalnız Ozyn'in gerçek tıklaması ya da Enter'ıdır (`isTrusted`).
"use strict";
import type { Kopru } from "../../../host/kopru.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../world/arayuz/arayuzJetonlari.ts";
import { ACIK_LEVEL_KOPYASI, YENI_LEVEL_SABLONLARI, klasorAdi, olusturmaHatasi, yeniTanim } from "./yeniLevelModeli.ts";

export interface YeniLevelPenceresiAyari {
  kopru: Pick<Kopru, "projeLevelOlustur">;
  /** Şablon dosyasının ham tanımı (`bos` | `duz-zemin` | `tamamen-bos`); okunamazsa fırlatır. */
  sablonOku(id: string): Promise<unknown>;
  /** Açık level'ın tanımı (`@acik` kopyası için); level yoksa null. */
  acikTanim(): unknown | null;
  /** Açılmadan önce: fare serbest olsun (imleç kipi). false dönerse açılmaz. */
  izin(): boolean;
  /** Oluşturulunca (İçerik gezgini yenilensin). */
  olusturuldu?(slug: string): void;
  altyazi(metin: string, ms?: number): void;
}
export interface YeniLevelPenceresi { ac(): void; kapat(): void; acikMi(): boolean }

const CSS = `
.yl-kok { position: fixed; inset: 0; z-index: 45; display: none; align-items: center; justify-content: center; background: rgba(4,6,12,0.62); font: ${YAPI_YAZI.govde}; color: ${R.yazi}; user-select: none; outline: none; }
.yl-kok[data-acik="1"] { display: flex; }
.yl-kutu { width: min(520px, 92vw); max-height: 86vh; overflow: auto; display: flex; flex-direction: column; gap: 10px; background: #0e1424; border: 1px solid ${R.cizgi}; border-radius: 10px; box-shadow: 0 18px 50px rgba(0,0,0,0.7); padding: 14px 16px; }
.yl-bas { display: flex; align-items: center; font-weight: 600; color: ${R.yaziParlak}; } .yl-bas .yl-bosluk { flex: 1; }
.yl-kok button { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 6px; padding: 3px 12px; font: inherit; cursor: pointer; }
.yl-kok button:hover:not(:disabled) { border-color: ${R.vurgu}; color: ${R.yaziParlak}; } .yl-kok button:disabled { opacity: 0.4; cursor: default; }
.yl-kok button[data-ton="onay"]:not(:disabled) { border-color: ${R.iyiCizgi}; color: ${R.iyi}; }
.yl-kok input[type=text] { background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 4px 8px; font: inherit; user-select: text; width: 100%; box-sizing: border-box; }
.yl-klasor { color: ${R.yaziSoluk}; font-size: 11.5px; }
.yl-sablon { display: flex; gap: 8px; align-items: flex-start; padding: 7px 10px; background: ${R.kart}; border: 1px solid ${R.kartCizgi}; border-radius: 8px; cursor: pointer; }
.yl-sablon[data-secili="1"] { border-color: ${R.vurgu}; } .yl-sablon b { color: ${R.yaziParlak}; } .yl-sablon small { display: block; color: ${R.yaziSoluk}; }
.yl-sablon[data-yok="1"] { opacity: 0.45; cursor: default; }
.yl-mesaj { min-height: 18px; font-size: 12px; color: ${R.yaziOrta}; } .yl-mesaj[data-tur="hata"] { color: ${R.hata}; } .yl-mesaj[data-tur="iyi"] { color: ${R.iyi}; }
.yl-alt { display: flex; gap: 8px; justify-content: flex-end; }
`;
let stilEklendi = false;
const dugme = dugmeYap("");

/** Pencere stili (`yl-*`); level geçiş penceresi (`levelGecisPenceresi.ts`) AYNI kutuyu kullanır, ikinci kopya yok. */
export function yeniLevelPenceresiStiliEkle(): void {
  if (stilEklendi) return;
  const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); stilEklendi = true;
}

export function yeniLevelPenceresiKur(a: YeniLevelPenceresiAyari): YeniLevelPenceresi {
  yeniLevelPenceresiStiliEkle();
  const kok = el("div", "yl-kok"); kok.tabIndex = -1; kok.dataset.acik = "0";
  const kutu = el("div", "yl-kutu");
  const kapatD = dugme("✕", "", "Kapat (Esc)");
  const bas = el("div", "yl-bas"); bas.append(el("span", "", "🗺 Yeni level"), el("span", "yl-bosluk"), kapatD);
  const adGirdisi = el("input"); adGirdisi.type = "text"; adGirdisi.placeholder = "ad (ör. Liman Gece)"; adGirdisi.maxLength = 48; adGirdisi.spellcheck = false;
  const klasor = el("div", "yl-klasor", "klasör: —");
  const sablonlar = el("div");
  const mesaj = el("div", "yl-mesaj");
  const olusturD = dugme("Oluştur", "", "Level dosyasını açık projeye yazar"); olusturD.dataset.ton = "onay";
  const alt = el("div", "yl-alt"); alt.append(olusturD);
  kutu.append(bas, adGirdisi, klasor, sablonlar, mesaj, alt); kok.append(kutu);

  let acik = false, secili = YENI_LEVEL_SABLONLARI[0]!.id;
  const bildir = (m: string, tur: "bilgi" | "hata" | "iyi" = "bilgi") => { mesaj.textContent = m; mesaj.dataset.tur = tur; };

  function sablonlariCiz(): void {
    sablonlar.replaceChildren();
    for (const s of YENI_LEVEL_SABLONLARI) {
      const yok = s.id === ACIK_LEVEL_KOPYASI && a.acikTanim() === null;
      const k = el("div", "yl-sablon"); k.dataset.secili = s.id === secili ? "1" : "0"; k.dataset.yok = yok ? "1" : "0"; k.dataset.id = s.id;
      const r = el("input"); r.type = "radio"; r.name = "yl-sablon"; r.checked = s.id === secili; r.disabled = yok;
      const m = el("div"); m.append(el("b", "", s.ad), el("small", "", yok ? "açık level yok" : s.aciklama));
      k.append(r, m);
      if (!yok) k.addEventListener("click", () => { secili = s.id; sablonlariCiz(); });
      sablonlar.append(k);
    }
  }

  async function olustur(): Promise<void> {
    const klasorSonucu = klasorAdi(adGirdisi.value);
    if (!klasorSonucu.ok) { bildir(klasorSonucu.neden, "hata"); adGirdisi.focus(); return; }
    olusturD.disabled = true;
    try {
      const acikKopya = secili === ACIK_LEVEL_KOPYASI;
      let ham: unknown;
      try { ham = acikKopya ? a.acikTanim() : await a.sablonOku(secili); } catch (e) { bildir(`şablon okunamadı: ${e instanceof Error ? e.message : String(e)}`, "hata"); return; }
      const t = yeniTanim(ham, adGirdisi.value, acikKopya);
      if (!t.ok) { bildir(t.neden, "hata"); return; }
      const r = await a.kopru.projeLevelOlustur(klasorSonucu.deger, JSON.stringify(t.deger, null, 2) + "\n");
      if (!r.ok) { bildir(olusturmaHatasi(r.kod, r.mesaj), "hata"); return; }
      bildir(`'${t.deger.ad}' oluşturuldu: Content/Levels/${klasorSonucu.deger}/ — İçerik gezgininde görünür. (Açmak sonraki dilim.)`, "iyi");
      a.altyazi(`level oluşturuldu: ${klasorSonucu.deger}`, 2600);
      a.olusturuldu?.(klasorSonucu.deger);
      adGirdisi.value = ""; klasor.textContent = "klasör: —";
    } finally { olusturD.disabled = false; }
  }

  adGirdisi.addEventListener("input", () => { const k = klasorAdi(adGirdisi.value); klasor.textContent = `klasör: ${k.ok ? k.deger : "—"}`; });
  olusturD.addEventListener("click", (e) => { if (e.isTrusted) void olustur(); });
  kapatD.addEventListener("click", () => kapat());
  kok.addEventListener("pointerdown", (e) => { if (e.target === kok) kapat(); });
  kok.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); kapat(); return; }
    if (e.key === "Enter" && e.target === adGirdisi && e.isTrusted) { e.preventDefault(); void olustur(); }
  });
  kok.addEventListener("keyup", (e) => e.stopPropagation());
  kok.addEventListener("keypress", (e) => e.stopPropagation());
  kok.addEventListener("contextmenu", (e) => { if (e.target !== adGirdisi) e.preventDefault(); e.stopPropagation(); });

  function kapat(): void { if (!acik) return; acik = false; kok.dataset.acik = "0"; if (document.activeElement && kok.contains(document.activeElement)) (document.activeElement as HTMLElement).blur(); }
  function ac(): void {
    if (!acik) {
      if (!a.izin()) { a.altyazi("yeni level penceresi şimdi açılamaz (sohbet, onay ya da odak açık)", 2500); return; }
      acik = true; bildir("");
      if (!kok.isConnected) document.body.append(kok);
      kok.dataset.acik = "1";
    }
    sablonlariCiz();
    adGirdisi.focus();
  }

  return { ac, kapat, acikMi: () => acik };
}
