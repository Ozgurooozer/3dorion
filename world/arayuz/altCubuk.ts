// world/arayuz/altCubuk.ts — ALT ÇUBUK (Yapı çubuğu): ekranın altında açılır-kapanır, sekmeli panel (Sims'in yapı/satın alma çubuğu gibi). DOM katmanı.
//
// Karar mantığı (hangi sekmeler, hangisi etkin, açık mı, engel, kalıcılık) `altCubukModeli.ts`te ve testli; burası yalnız onu çizer. Bu çubuk BİR ÇERÇEVEDİR:
// içerik sekmelerden gelir (`uygulama/yapi/*`), yeni özellik = yeni `Sekme` (`ekle`). Sekme kendi sayfasını TEMBEL kurar (ilk açılışta), sonra yalnız
// gösterilip gizlenir; çubuğa ipucu satırı yazabilir, şeritteki rozetini değiştirebilir, paneli kapatabilir (`SekmeAraci`).
//   • Şerit hep görünür (panel kapalıyken de): sekmeye tık açar, aynı sekmeye tekrar tık indirir. Üst kenardaki tutamaçla yükseklik sürüklenir ve saklanır.
//   • Kısayol (varsayılan Y) ve açıkken 1–9 sekme seçer; yazı yazarken (girdi kutusu, sohbet, onay) tuş harftir.
//   • Çubuk görünürlüğü çağıranın işidir (`gorunur`): Orion'da yalnız imleç kipi açıkken görünür (fare serbest değilken tıklanamaz).
// Yükseklik CSS değişkeni `--alt-cubuk` olarak yayılır (altyazı ve sohbet çubuğun üstüne taşınır, örtülmez).
"use strict";
import { altCubukModeliKur, type AltCubukModeli, type SekmeBilgisi } from "./altCubukModeli.ts";

export interface SekmeAraci {
  /** Şeritte görünen tek satırlık bağlam ipucu (ne yapılır: "sol tık koy · Esc bitir"). Boş metin siler. */
  ipucu(metin: string): void;
  /** Sekme düğmesinin köşesindeki küçük rozet (örn. "●" kalem açık). null siler. */
  rozet(metin: string | null): void;
  /** Paneli indir. */
  kapat(): void;
}
export interface SekmeIcerigi {
  /** Sekme etkin olup panel açıldığında. */
  goster?(): void;
  /** Başka sekmeye geçildi ya da panel kapandı. */
  gizle?(): void;
}
export interface Sekme extends SekmeBilgisi {
  /** İlk gösterimde bir kez: sayfa elemanını doldurur. */
  kur(sayfa: HTMLElement, arac: SekmeAraci): SekmeIcerigi;
}

export interface Depo { getItem(k: string): string | null; setItem(k: string, v: string): void }

export interface AltCubukAyari {
  /** Verilmezse localStorage; null: kalıcılık yok. */
  depo?: Depo | null;
  /** Yazı yazılırken (sohbet, onay, terminal odağı) kısayol tuşları harftir: false dönerse yok sayılır. */
  tusSerbest?: () => boolean;
  /** Panel açılmadan önce sorulur (örn. imleç kipini aç); false dönerse açılmaz. */
  izin?: () => boolean;
  /** Panel kısayolu (KeyboardEvent.code). */
  kisayol?: string;
  ata?: HTMLElement;
}

export interface AltCubuk {
  ekle(s: Sekme): void;
  /** `id` verilirse o sekmeyle aç. Açıldı mı. */
  ac(id?: string): boolean;
  kapat(): void;
  degistir(): void;
  acikMi(): boolean;
  etkinId(): string | null;
  /** Çubuk hiç görünsün mü (kapalıyken şerit de gizlenir). */
  gorunur(acik: boolean): void;
  engelle(id: string, neden: string | null): void;
  yokEt(): void;
}

const ANAHTAR = "orion.altCubuk.v1";
const YUKSEKLIK_ANAHTARI = "orion.altCubuk.yukseklik";
const YUKSEKLIK_ALT = 150;
const YUKSEKLIK_VARSAYILAN = 236;

const CSS = `
#altCubuk { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: none; flex-direction: column; color: #d7dcea;
  font: 13px/1.4 'Segoe UI', system-ui, sans-serif; user-select: none; --ac-yukseklik: ${YUKSEKLIK_VARSAYILAN}px; }
#altCubuk[data-gorunur="1"] { display: flex; }
#altCubuk .ac-tutamak { height: 10px; margin-bottom: -5px; position: relative; z-index: 1; cursor: ns-resize; display: none; }
#altCubuk[data-acik="1"] .ac-tutamak { display: block; }
#altCubuk .ac-tutamak::after { content: ""; position: absolute; left: 50%; top: 3px; width: 44px; height: 4px; margin-left: -22px; border-radius: 2px; background: #3a4560; }
#altCubuk .ac-tutamak:hover::after { background: #58c1ff; }
#altCubuk .ac-serit { display: flex; align-items: stretch; gap: 2px; padding: 0 8px; min-height: 40px; background: rgba(10,14,24,0.97); border-top: 1px solid #2a3246; }
#altCubuk .ac-sekmeler { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
#altCubuk .ac-sekme { position: relative; display: flex; align-items: center; gap: 7px; padding: 0 16px; background: transparent; color: #9aa6c4; border: 0; border-bottom: 3px solid transparent;
  font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
#altCubuk .ac-sekme:hover:not(:disabled) { color: #eef1fa; background: rgba(88,193,255,0.07); }
#altCubuk .ac-sekme[data-etkin="1"] { color: #eef1fa; border-bottom-color: #58c1ff; background: rgba(88,193,255,0.12); }
#altCubuk .ac-sekme:disabled { opacity: 0.38; cursor: not-allowed; }
#altCubuk .ac-simge { font-size: 18px; line-height: 1; }
#altCubuk .ac-rozet { position: absolute; right: 5px; top: 5px; font-size: 9px; color: #ffb454; line-height: 1; }
#altCubuk .ac-ipucu { flex: 1; align-self: center; text-align: right; padding: 0 12px; color: #7c88a6; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#altCubuk .ac-yan { align-self: center; display: flex; align-items: center; gap: 6px; color: #7c88a6; font-size: 11px; }
#altCubuk kbd { font: 11px 'Cascadia Mono', Consolas, monospace; color: #7c88a6; border: 1px solid #2a3246; border-radius: 4px; padding: 0 4px; }
#altCubuk .ac-dugme { background: #121726; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; width: 26px; height: 24px; cursor: pointer; font: inherit; padding: 0; }
#altCubuk .ac-dugme:hover { border-color: #58c1ff; }
#altCubuk .ac-icerik { height: 0; overflow: hidden; visibility: hidden; background: rgba(10,14,24,0.97); transition: height .16s ease, visibility 0s linear .16s; }
#altCubuk[data-acik="1"] .ac-icerik { height: var(--ac-yukseklik); visibility: visible; transition: height .16s ease, visibility 0s; }
#altCubuk .ac-sayfa { display: none; height: 100%; box-sizing: border-box; }
#altCubuk .ac-sayfa[data-etkin="1"] { display: block; }
@media (prefers-reduced-motion: reduce) { #altCubuk .ac-icerik, #altCubuk[data-acik="1"] .ac-icerik { transition: none; } }
`;

const yazilabilirMi = (h: EventTarget | null): boolean => {
  const e = h as HTMLElement | null;
  if (!e?.matches) return false;
  if (e.isContentEditable || e.matches("textarea, select")) return true;
  return e.matches("input") && !e.matches("input[type=range], input[type=checkbox], input[type=radio], input[type=color], input[type=button]");
};

function varsayilanDepo(): Depo | null { try { return globalThis.localStorage ?? null; } catch { return null; } }

export function altCubukKur(a: AltCubukAyari = {}): AltCubuk {
  const depo = a.depo === undefined ? varsayilanDepo() : a.depo;
  const kisayol = a.kisayol ?? "KeyY";
  const model: AltCubukModeli = altCubukModeliKur();
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);

  const el = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin) e.textContent = metin; return e;
  };
  const kok = el("div", ""); kok.id = "altCubuk"; kok.dataset.gorunur = "0"; kok.dataset.acik = "0";
  const tutamak = el("div", "ac-tutamak"); tutamak.title = "sürükle: yüksekliği ayarla";
  const serit = el("div", "ac-serit");
  const sekmeKabi = el("div", "ac-sekmeler");
  const ipucuYeri = el("div", "ac-ipucu");
  const yan = el("div", "ac-yan");
  const kisayolEtiketi = el("kbd", "", kisayol.replace(/^Key|^Digit/, ""));
  const indir = el("button", "ac-dugme", "▾"); indir.title = "paneli indir / kaldır";
  yan.append(kisayolEtiketi, indir);
  serit.append(sekmeKabi, ipucuYeri, yan);
  const icerik = el("div", "ac-icerik");
  kok.append(tutamak, serit, icerik);
  (a.ata ?? document.body).append(kok);

  interface Kayit { sekme: Sekme; dugme: HTMLButtonElement; rozet: HTMLElement; sayfa: HTMLElement; icerik: SekmeIcerigi | null; ipucu: string }
  const kayitlar = new Map<string, Kayit>();
  let gorunurMu = false;
  let yukseklik = (() => {
    try { const v = Number(depo?.getItem(YUKSEKLIK_ANAHTARI)); return Number.isFinite(v) && v >= YUKSEKLIK_ALT ? v : YUKSEKLIK_VARSAYILAN; } catch { return YUKSEKLIK_VARSAYILAN; }
  })();
  let yuklendi = false;
  let gosterilen: string | null = null;

  const ustSinir = () => Math.max(YUKSEKLIK_ALT, Math.round(innerHeight * 0.6));
  const kaydet = () => {
    try { depo?.setItem(ANAHTAR, model.yaz()); } catch (err) { console.warn("[ALT-CUBUK] kaydedilemedi:", err instanceof Error ? err.message : String(err)); }
  };
  const yukleBir = () => {
    if (yuklendi) return;
    yuklendi = true;
    try { model.yukle(depo?.getItem(ANAHTAR) ?? null); } catch (err) { console.warn("[ALT-CUBUK] kayıt okunamadı, boş başlıyor:", err instanceof Error ? err.message : String(err)); }
  };

  /** Çubuğun ekranda kapladığı yükseklik: altyazı ve sohbet bunun üstüne çıkar. */
  function yerlesimiYay(): void {
    kok.style.setProperty("--ac-yukseklik", `${Math.min(yukseklik, ustSinir())}px`);
    // Çözümsel hesap (ölçüm değil): yükseklik animasyonu sürerken ölçülen değer yarım kalırdı.
    const px = !gorunurMu ? 0 : serit.offsetHeight + (model.durum().acik ? Math.min(yukseklik, ustSinir()) : 0);
    document.documentElement.style.setProperty("--alt-cubuk", `${Math.round(px)}px`);
  }

  function ciz(): void {
    const d = model.durum();
    kok.dataset.acik = d.acik ? "1" : "0";
    for (const [id, k] of kayitlar) {
      const engel = model.engel(id);
      k.dugme.disabled = engel !== null;
      k.dugme.dataset.etkin = d.acik && d.etkin === id ? "1" : "0";
      k.dugme.title = engel ? `${k.sekme.ipucu ?? k.sekme.ad} — kullanılamıyor: ${engel}` : (k.sekme.ipucu ?? k.sekme.ad);
    }
    const hedef = d.acik ? d.etkin : null;
    if (hedef !== gosterilen) {
      if (gosterilen) { const k = kayitlar.get(gosterilen); if (k) { k.sayfa.dataset.etkin = "0"; k.icerik?.gizle?.(); } }
      gosterilen = hedef;
      if (hedef) {
        const k = kayitlar.get(hedef)!;
        k.sayfa.dataset.etkin = "1";
        if (!k.icerik) {
          k.icerik = k.sekme.kur(k.sayfa, {
            ipucu: (m) => { k.ipucu = m; if (gosterilen === hedef) ipucuYeri.textContent = m; },
            rozet: (m) => { k.rozet.textContent = m ?? ""; },
            kapat: () => { model.kapat(); },
          });
        }
        ipucuYeri.textContent = k.ipucu;
        k.icerik.goster?.();
      } else ipucuYeri.textContent = "";
    }
    indir.textContent = d.acik ? "▾" : "▴";
    yerlesimiYay();
  }
  model.dinle(() => { ciz(); kaydet(); });

  function ac(id?: string): boolean {
    yukleBir();
    if (a.izin && !a.izin()) return false;
    if (id !== undefined) { const ok = model.sec(id); if (!ok) return false; return true; }
    return model.ac();
  }
  const kapat = () => { model.kapat(); };
  const degistir = () => { if (model.durum().acik) kapat(); else ac(); };
  indir.addEventListener("click", () => { degistir(); indir.blur(); });

  // ── yükseklik tutamacı ──
  let surukle: { y0: number; h0: number } | null = null;
  tutamak.addEventListener("pointerdown", (e) => { surukle = { y0: e.clientY, h0: Math.min(yukseklik, ustSinir()) }; tutamak.setPointerCapture?.(e.pointerId); e.preventDefault(); });
  tutamak.addEventListener("pointermove", (e) => {
    if (!surukle) return;
    yukseklik = Math.max(YUKSEKLIK_ALT, Math.min(ustSinir(), Math.round(surukle.h0 + (surukle.y0 - e.clientY))));
    yerlesimiYay();
  });
  const surukleBitir = () => {
    if (!surukle) return;
    surukle = null;
    try { depo?.setItem(YUKSEKLIK_ANAHTARI, String(yukseklik)); } catch (err) { console.warn("[ALT-CUBUK] yükseklik kaydedilemedi:", err instanceof Error ? err.message : String(err)); }
  };
  tutamak.addEventListener("pointerup", surukleBitir);
  tutamak.addEventListener("pointercancel", surukleBitir);
  const boyutDegisti = () => yerlesimiYay();
  addEventListener("resize", boyutDegisti);

  // ── klavye: yazı kutusundaki tuşlar oyuna (WASD…) sızmaz; kısayol ve 1–9 ──
  const kutuTusu = (e: KeyboardEvent) => { if (yazilabilirMi(e.target)) e.stopPropagation(); };
  kok.addEventListener("keydown", kutuTusu);
  kok.addEventListener("keyup", kutuTusu);
  kok.addEventListener("contextmenu", (e) => e.preventDefault());
  const tus = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || yazilabilirMi(e.target)) return;
    if (a.tusSerbest && !a.tusSerbest()) return;
    if (e.code === kisayol) { e.preventDefault(); degistir(); return; }
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m && gorunurMu && model.durum().acik) {
      const s = model.sekmeler()[Number(m[1]) - 1];
      if (s && model.engel(s.id) === null) { e.preventDefault(); model.sec(s.id); }
    }
  };
  addEventListener("keydown", tus);

  return {
    ekle(s) {
      model.ekle(s);
      const dugme = el("button", "ac-sekme");
      dugme.type = "button";
      const rozet = el("span", "ac-rozet");
      dugme.append(el("span", "ac-simge", s.simge), el("span", "", s.ad), rozet);
      dugme.addEventListener("click", () => {
        yukleBir();
        if (!model.durum().acik && a.izin && !a.izin()) return;
        model.sekmeyeTikla(s.id);
        dugme.blur();
      });
      const sayfa = el("div", "ac-sayfa"); sayfa.dataset.etkin = "0";
      icerik.append(sayfa);
      kayitlar.set(s.id, { sekme: s, dugme, rozet, sayfa, icerik: null, ipucu: "" });
      // Sekme sırası modelden: şerit baştan dizilir.
      sekmeKabi.replaceChildren(...model.sekmeler().map((x) => kayitlar.get(x.id)!.dugme));
      ciz();
    },
    ac,
    kapat,
    degistir,
    acikMi: () => model.durum().acik,
    etkinId: () => model.durum().etkin,
    gorunur(acik) {
      gorunurMu = acik;
      kok.dataset.gorunur = acik ? "1" : "0";
      if (!acik) kapat();
      yerlesimiYay();
    },
    engelle(id, neden) { model.engelle(id, neden); ciz(); },
    yokEt() {
      removeEventListener("keydown", tus);
      removeEventListener("resize", boyutDegisti);
      document.documentElement.style.removeProperty("--alt-cubuk");
      kok.remove(); stil.remove();
    },
  };
}
