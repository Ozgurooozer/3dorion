// world/arayuz/ayarPaneli.ts — AJAN AYAR PANELİ (spec 34): Orion seçilince ekranın SOLUNDA açılan, bölümlü (akordeon) ayar penceresi. DOM katmanı.
//
// Karar mantığı (bölüm kaydı, ajan süzgeci, açık/kapalı, kalıcılık) `ayarPaneliModeli.ts`te ve testli; burası yalnız onu çizer. Panel BİR ÇERÇEVEDİR: içerik
// bölümlerden gelir (`uygulama/ayar/*`), yeni özellik = yeni `AyarBolumu` (`ekle`). Bölüm kendi gövdesini TEMBEL kurar (ilk açılışta, ajan başına bir kez),
// sonra yalnız gösterilip gizlenir; başlığa tek satırlık özet yazar (bölüm kapalıyken de görünür: "gemma4:e4b", "dfki").
//   • Açılış/kapanış çağıranın işidir: Orion'da `nesneSecimi` Orion'u seçince `ac`, seçim kalkınca `kapat`. ✕ ve Esc paneli kapatır ve `kapatildi`yı çağırır
//     (orada seçim de bırakılır: panel = seçimin görünümü).
//   • Görünürlük (`gorunur`): imleç kipi kapalıyken fare kilitli, panel tıklanamaz — gizlenir (KAYBOLMAZ: imleç geri gelince aynı hâliyle döner).
//   • Klavye: panelin içindeki tuşlar oyuna (WASD, T, M, Y…) SIZMAZ (editorPenceresi ile aynı kural); düğmeye tıklayınca odak bırakılır ki oyun tuşları dönsün.
//   • Yerleşim: HUD'un altında, Yapı çubuğunun ve sohbet kutusunun üstünde biter (örtmez). z-index 34: altyazı (31) üstü, editör pencereleri (40–55),
//     beden paneli (55), bilgi paneli (57) ve bağlam menüsü (58) altı.
"use strict";
import { ayarPaneliModeliKur, type AjanKimligi, type AyarPaneliModeli, type BolumBilgisi } from "./ayarPaneliModeli.ts";
import { YAPI_RENK as R, YAPI_YAZI } from "./arayuzJetonlari.ts";

export type { AjanKimligi };

export interface BolumAraci {
  /** Başlıktaki tek satırlık özeti şimdi yaz (boş metin siler). Bölüm `ozet` verdiyse panel onu düzenli tazeler. */
  ozet(metin: string): void;
  /** Kısa bildirim (altyazı). */
  bildir(metin: string, ms?: number): void;
}
export interface BolumIcerigi {
  /** Bölüm açıldı / panel göründü. */
  goster?(): void;
  /** Bölüm kapandı / panel gizlendi. */
  gizle?(): void;
  /** Panel açıkken ~1 sn'de bir (canlı değerler: koşan beyin, pano telleri). Ucuz olmalı. */
  tazele?(): void;
}
export interface AyarBolumu extends BolumBilgisi {
  /** İlk açılışta bir kez (ajan başına): gövdeyi doldurur. */
  kur(govde: HTMLElement, arac: BolumAraci, ajan: AjanKimligi): BolumIcerigi;
  /** Başlık özeti (bölüm kapalıyken de). */
  ozet?(ajan: AjanKimligi): string;
}

export interface Depo { getItem(k: string): string | null; setItem(k: string, v: string): void }

export interface AyarPaneliAyari {
  /** Verilmezse localStorage; null: kalıcılık yok. */
  depo?: Depo | null;
  /** ✕ ya da Esc ile kapandı (çağıran seçimi bırakır). */
  kapatildi?: () => void;
  bildir?: (metin: string, ms?: number) => void;
  tazelemeMs?: number;
  ata?: HTMLElement;
}

export interface AyarPaneli {
  ekle(b: AyarBolumu): void;
  /** Ajanın panelini aç (bölümü yoksa açılmaz). */
  ac(ajan: AjanKimligi): boolean;
  kapat(): void;
  acikMi(): boolean;
  gorunur(acik: boolean): void;
  yokEt(): void;
}

const ANAHTAR = "orion.ayarPaneli.v1";

const CSS = `
#ayarPaneli { position: fixed; left: 16px; top: 64px; z-index: 34; width: min(320px, calc(100vw - 32px));
  max-height: calc(100vh - 64px - 80px - var(--alt-yigin, 0px)); display: none; flex-direction: column;
  background: ${R.zemin}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 10px; font: ${YAPI_YAZI.govde}; user-select: none; overflow: hidden; }
#ayarPaneli[data-gorunur="1"] { display: flex; }
/* Dok paneline gömülü (ata verildi): konum ve çerçeve kabın, boyut kabın; kendi kenarlığı ve yüzen konumu yok. */
#ayarPaneli.ap-gomulu { position: relative; left: auto; top: auto; z-index: auto; width: auto; max-height: none; height: 100%; box-sizing: border-box; border: 0; border-radius: 0; box-shadow: none; }
#ayarPaneli .ap-bas { display: flex; align-items: center; gap: 8px; padding: 9px 10px 8px 12px; border-bottom: 1px solid ${R.cizgi}; }
#ayarPaneli .ap-nokta { width: 9px; height: 9px; border-radius: 50%; background: var(--ap-renk, ${R.vurgu}); flex: 0 0 auto; }
#ayarPaneli .ap-baslik-yazi { flex: 1; font-weight: 600; color: ${R.yaziParlak}; }
#ayarPaneli .ap-baslik-yazi small { font-weight: 400; color: ${R.yaziSoluk}; margin-left: 6px; }
#ayarPaneli .ap-kapat { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 6px; width: 26px; height: 24px; cursor: pointer; font: inherit; padding: 0; }
#ayarPaneli .ap-kapat:hover, #ayarPaneli .ap-kapat:focus-visible { border-color: ${R.vurgu}; outline: none; }
#ayarPaneli .ap-liste { overflow-y: auto; min-height: 0; padding: 4px 0 8px; scrollbar-width: thin; }
#ayarPaneli .ap-bolum + .ap-bolum { border-top: 1px solid rgba(42,50,70,0.55); }
#ayarPaneli .ap-bolum-bas { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; background: transparent; color: ${R.yaziOrta}; border: 0;
  font: inherit; text-align: left; cursor: pointer; }
#ayarPaneli .ap-bolum-bas:hover, #ayarPaneli .ap-bolum-bas:focus-visible { color: ${R.yaziParlak}; background: rgba(88,193,255,0.07); outline: none; }
#ayarPaneli .ap-bolum[data-acik="1"] > .ap-bolum-bas { color: ${R.yaziParlak}; }
#ayarPaneli .ap-simge { font-size: 15px; line-height: 1; width: 18px; text-align: center; }
#ayarPaneli .ap-ad { font-weight: 600; letter-spacing: .02em; }
#ayarPaneli .ap-ozet { flex: 1; min-width: 0; text-align: right; color: ${R.yaziSoluk}; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ayarPaneli .ap-ok { color: ${R.yaziSoluk}; font-size: 10px; transition: transform .12s ease; }
#ayarPaneli .ap-bolum[data-acik="1"] .ap-ok { transform: rotate(90deg); }
#ayarPaneli .ap-govde { display: none; padding: 2px 12px 10px; }
#ayarPaneli .ap-bolum[data-acik="1"] > .ap-govde { display: block; }
/* Bölümlerin ortak parçaları (uygulama/ayar/* bunları kullanır; her bölüm kendi CSS yığınını kurmaz). */
#ayarPaneli .ap-satir { display: flex; align-items: center; gap: 8px; min-height: 28px; }
#ayarPaneli .ap-etiket { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ayarPaneli .ap-not { color: ${R.yaziSoluk}; font-size: 11px; line-height: 1.35; margin: 2px 0 6px; }
#ayarPaneli .ap-uyari { color: ${R.uyari}; font-size: 11px; line-height: 1.35; margin: 4px 0; }
#ayarPaneli .ap-hata { color: ${R.hata}; font-size: 11px; line-height: 1.35; margin: 4px 0; }
#ayarPaneli .ap-iyi { color: ${R.iyi}; }
#ayarPaneli .ap-alt-baslik { color: ${R.yaziSoluk}; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; margin: 10px 0 2px; }
#ayarPaneli .ap-dugme { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 6px; padding: 2px 9px; font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
#ayarPaneli .ap-dugme:hover:not(:disabled), #ayarPaneli .ap-dugme:focus-visible { border-color: ${R.vurgu}; outline: none; }
#ayarPaneli .ap-dugme:disabled { opacity: .4; cursor: not-allowed; }
#ayarPaneli .ap-dugme[data-ton="iyi"] { border-color: ${R.iyiCizgi}; color: ${R.iyi}; background: ${R.iyiZemin}; }
#ayarPaneli .ap-dugme[data-ton="uyari"] { border-color: ${R.uyari}; color: ${R.uyari}; }
#ayarPaneli select, #ayarPaneli input[type=number] { background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 6px; padding: 3px 6px; font: inherit; font-size: 12px; }
#ayarPaneli select { width: 100%; }
#ayarPaneli input[type=number] { width: 74px; text-align: right; user-select: text; }
#ayarPaneli select:focus, #ayarPaneli input:focus { outline: none; border-color: ${R.vurgu}; }
#ayarPaneli select:disabled, #ayarPaneli input:disabled { opacity: .5; }
#ayarPaneli .ap-rozet { flex: 0 0 auto; padding: 1px 8px; border-radius: 999px; font-size: 11px; border: 1px solid ${R.cizgi}; background: #0d1320; color: ${R.yaziSoluk}; cursor: pointer; }
#ayarPaneli .ap-rozet[data-acik="1"] { border-color: ${R.iyiCizgi}; color: ${R.iyi}; background: #0f1d17; }
#ayarPaneli .ap-rozet:disabled { cursor: default; opacity: .75; }
#ayarPaneli .ap-rozet:hover:not(:disabled), #ayarPaneli .ap-rozet:focus-visible { border-color: ${R.vurgu}; outline: none; }
#ayarPaneli .ap-cubuk { height: 4px; border-radius: 2px; background: ${R.cizgi}; overflow: hidden; margin: 2px 0 4px; }
#ayarPaneli .ap-cubuk > i { display: block; height: 100%; background: ${R.vurgu}; width: 0; transition: width .2s linear; }
#ayarPaneli .ap-birim { color: ${R.yaziSoluk}; font-size: 11px; min-width: 40px; }
#ayarPaneli kbd { font: ${YAPI_YAZI.mono}; color: ${R.yaziSoluk}; border: 1px solid ${R.cizgi}; border-radius: 4px; padding: 0 4px; }
@media (prefers-reduced-motion: reduce) { #ayarPaneli .ap-ok, #ayarPaneli .ap-cubuk > i { transition: none; } }
`;

const yazilabilirMi = (h: EventTarget | null): boolean => {
  const e = h as HTMLElement | null;
  if (!e?.matches) return false;
  return e.isContentEditable || e.matches("textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=button])");
};
function varsayilanDepo(): Depo | null { try { return globalThis.localStorage ?? null; } catch { return null; } }

export function ayarPaneliKur(a: AyarPaneliAyari = {}): AyarPaneli {
  const depo = a.depo === undefined ? varsayilanDepo() : a.depo;
  const model: AyarPaneliModeli = ayarPaneliModeliKur();
  const bolumler = new Map<string, AyarBolumu>();
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);
  const el = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin) e.textContent = metin; return e;
  };

  const kok = el("div"); kok.id = "ayarPaneli"; kok.dataset.gorunur = "0";
  if (a.ata) kok.classList.add("ap-gomulu");
  kok.setAttribute("role", "dialog");
  const bas = el("div", "ap-bas");
  const nokta = el("span", "ap-nokta");
  const baslik = el("div", "ap-baslik-yazi");
  const kapatDugme = el("button", "ap-kapat", "✕"); kapatDugme.type = "button"; kapatDugme.title = "kapat (Esc) — seçimi de bırakır";
  bas.append(nokta, baslik, kapatDugme);
  const liste = el("div", "ap-liste");
  kok.append(bas, liste);
  (a.ata ?? document.body).append(kok);

  let gorunurMu = false;
  let yuklendi = false;
  const yukleBir = () => {
    if (yuklendi) return;
    yuklendi = true;
    try { model.yukle(depo?.getItem(ANAHTAR) ?? null); } catch (err) { console.warn("[AYAR-PANELI] kayıt okunamadı, varsayılanla:", err instanceof Error ? err.message : String(err)); }
  };
  const kaydet = () => { try { depo?.setItem(ANAHTAR, model.yaz()); } catch (err) { console.warn("[AYAR-PANELI] kaydedilemedi:", err instanceof Error ? err.message : String(err)); } };

  /** Ajan × bölüm başına DOM ve (tembel) içerik. */
  interface Kayit { kok: HTMLElement; bas: HTMLButtonElement; ozet: HTMLElement; govde: HTMLElement; icerik: BolumIcerigi | null; acikti: boolean; elleOzet: string | null }
  const kayitlar = new Map<string, Kayit>();
  const anahtar = (ajan: AjanKimligi, id: string) => `${ajan.id}:${id}`;

  function kayitAl(ajan: AjanKimligi, b: AyarBolumu): Kayit {
    const k0 = kayitlar.get(anahtar(ajan, b.id));
    if (k0) return k0;
    const bolum = el("section", "ap-bolum");
    const bb = el("button", "ap-bolum-bas"); bb.type = "button";
    const govdeId = `ap-${ajan.id}-${b.id}`;
    bb.setAttribute("aria-controls", govdeId);
    if (b.ipucu) bb.title = b.ipucu;
    const ozet = el("span", "ap-ozet");
    bb.append(el("span", "ap-simge", b.simge), el("span", "ap-ad", b.ad), ozet, el("span", "ap-ok", "▶"));
    const govde = el("div", "ap-govde"); govde.id = govdeId;
    bolum.append(bb, govde);
    bb.addEventListener("click", () => { model.bolumDegistir(b.id); });
    const k: Kayit = { kok: bolum, bas: bb, ozet, govde, icerik: null, acikti: false, elleOzet: null };
    kayitlar.set(anahtar(ajan, b.id), k);
    return k;
  }

  function ozetYaz(ajan: AjanKimligi, b: AyarBolumu, k: Kayit): void {
    let metin = k.elleOzet ?? "";
    if (b.ozet) { try { metin = b.ozet(ajan); } catch (err) { metin = "?"; console.warn(`[AYAR-PANELI] ${b.id} özeti okunamadı:`, err); } }
    if (k.ozet.textContent !== metin) { k.ozet.textContent = metin; k.ozet.title = metin; }
  }

  function ciz(): void {
    const d = model.durum();
    const goster = d.acik && gorunurMu && d.ajan !== null;
    kok.dataset.gorunur = goster ? "1" : "0";
    const ajan = d.ajan;
    const gorunenler = new Set<string>();
    if (ajan) {
      kok.setAttribute("aria-label", `${ajan.ad} ayarları`);
      nokta.style.setProperty("--ap-renk", ajan.renk ?? R.vurgu);
      baslik.replaceChildren(ajan.ad, el("small", "", "ayarlar"));
      const sirali = model.bolumler(ajan.id).map((x) => bolumler.get(x.id)!);
      const dugumler: HTMLElement[] = [];
      for (const b of sirali) {
        const k = kayitAl(ajan, b);
        gorunenler.add(anahtar(ajan, b.id));
        const acik = goster && model.bolumAcikMi(b.id);
        k.kok.dataset.acik = model.bolumAcikMi(b.id) ? "1" : "0";
        k.bas.setAttribute("aria-expanded", model.bolumAcikMi(b.id) ? "true" : "false");
        if (acik && !k.icerik) {
          k.icerik = b.kur(k.govde, { ozet: (m) => { k.elleOzet = m; ozetYaz(ajan, b, k); }, bildir: (m, ms) => a.bildir?.(m, ms) }, ajan);
        }
        if (acik !== k.acikti) { k.acikti = acik; if (acik) k.icerik?.goster?.(); else k.icerik?.gizle?.(); }
        ozetYaz(ajan, b, k);
        dugumler.push(k.kok);
      }
      const ayni = dugumler.length === liste.children.length && dugumler.every((x, i) => liste.children[i] === x);
      if (!ayni) liste.replaceChildren(...dugumler);
    }
    // Başka ajanın ya da gizlenen panelin açık bölümleri "gizlendi" duysun (zamanlayıcı/dinleyici bıraksın).
    for (const [ak, k] of kayitlar) if (!gorunenler.has(ak) && k.acikti) { k.acikti = false; k.icerik?.gizle?.(); }
    saatAyarla(goster);
  }

  let saat: ReturnType<typeof setInterval> | null = null;
  function saatAyarla(calissin: boolean): void {
    if (calissin && !saat) saat = setInterval(tazele, a.tazelemeMs ?? 1000);
    if (!calissin && saat) { clearInterval(saat); saat = null; }
  }
  function tazele(): void {
    const ajan = model.durum().ajan;
    if (!ajan) return;
    for (const x of model.bolumler(ajan.id)) {
      const b = bolumler.get(x.id)!;
      const k = kayitlar.get(anahtar(ajan, x.id));
      if (!k) continue;
      ozetYaz(ajan, b, k);
      if (k.acikti) { try { k.icerik?.tazele?.(); } catch (err) { console.warn(`[AYAR-PANELI] ${x.id} tazelenemedi:`, err); } }
    }
  }

  model.dinle(() => { ciz(); kaydet(); });

  const kapatElle = () => { if (model.kapat()) a.kapatildi?.(); };
  kapatDugme.addEventListener("click", () => { kapatElle(); kapatDugme.blur(); });

  // ── klavye ve fare: panelde olan panelde kalır ──
  const tusDurdur = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.type === "keydown" && e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); kapatElle(); }
  };
  kok.addEventListener("keydown", tusDurdur);
  kok.addEventListener("keyup", (e) => { e.stopPropagation(); });
  kok.addEventListener("keypress", (e) => { e.stopPropagation(); });
  kok.addEventListener("wheel", (e) => { e.stopPropagation(); }, { passive: true });
  kok.addEventListener("contextmenu", (e) => { if (!yazilabilirMi(e.target)) e.preventDefault(); e.stopPropagation(); });
  // Tıklanan düğme odağı tutmasın: yoksa WASD panelde yutulur ve Ozyn "yürüyemiyorum" sanır. Girdi/seçim kutusu yazarken odakta kalır.
  kok.addEventListener("click", (e) => {
    const d = (e.target as HTMLElement | null)?.closest?.("button");
    if (d && kok.contains(d)) setTimeout(() => { if (document.activeElement === d) d.blur(); }, 0);
  });
  kok.addEventListener("change", (e) => { const t = e.target as HTMLElement | null; if (t?.matches?.("select")) t.blur(); });

  return {
    ekle(b) {
      model.ekle(b);
      bolumler.set(b.id, b);
      ciz();
    },
    ac(ajan) { yukleBir(); return model.ac(ajan); },
    kapat() { model.kapat(); },
    acikMi: () => model.durum().acik,
    gorunur(acik) {
      gorunurMu = acik;
      if (!acik && kok.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      ciz();
    },
    yokEt() { saatAyarla(false); kok.remove(); stil.remove(); },
  };
}
