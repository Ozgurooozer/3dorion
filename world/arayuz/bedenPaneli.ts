// world/arayuz/bedenPaneli.ts — BEDENİM paneli (B tuşu): Ozyn'in bedenini parça parça değiştirir (giysi seçimi + renkler).
//
// Odanın ÜSTÜNDE küçük bir pencere (gozPaneli gibi). Seçenekler `world/player/bedenAyari.ts` SLOTLAR tablosundan üretilir: yeni giysi tabloya
// eklenince burası değişmez. Her değişiklik ANINDA uygulanır (`degisti`) ve beden ekranda güncellenir; kalıcılık çağıranın işi (`uygulama/bedenKaydi.ts`).
// B tuşu paneli açar/kapatır, Esc kapatır. Yazı yazarken (terminal/sohbet) B bir harftir: `tusSerbest`. Bağımlılık sınırı (K4): yalnız DOM + saf ayar modeli.
"use strict";
// Panel Yüzeyler alt-sisteminde: Sahne'deki ayar modeline (world/player/bedenAyari.ts) BAĞLANMAZ; model kompozisyon kökünden verilir (`model`).
// Tipler yapısaldır: bedenAyari.ts'in `BedenAyari`/`SLOTLAR`/`RENK_ADLARI`/`VARSAYILAN`/`YOK` değerleri doğrudan uyar.

export interface PanelAyari { secim: Record<string, string>; renk: Record<string, string> }

export interface PanelModeli {
  readonly slotlar: readonly { readonly kimlik: string; readonly ad: string; readonly secenekler: Readonly<Record<string, { readonly ad: string }>> }[];
  readonly renkAdlari: Readonly<Record<string, string>>;
  readonly varsayilan: Readonly<PanelAyari>;
  /** "Yok" seçeneğinin kimliği. */
  readonly yok: string;
}

export interface BedenPaneli {
  ac(): void;
  kapat(): void;
  acikMi(): boolean;
  /** Ayar dışarıdan değiştiyse (yükleme) arayüzü tazele. */
  yenile(): void;
}

export interface BedenPaneliAyari {
  model: PanelModeli;
  /** Şu anki ayar (panel her açılışta/yenilemede buradan okur). */
  ayar: () => PanelAyari;
  /** Kullanıcı bir şeyi değiştirdi: yeni ayar (kopya) — uygula ve kaydet. */
  degisti: (a: PanelAyari) => void;
  tusSerbest?: () => boolean;
  /** Pencere açılınca (fare kilidini bırakmak için: kontroller tıklanabilsin). */
  acildi?: () => void;
  ata?: HTMLElement;
}

const CSS = `
#bedenPaneli { position: fixed; top: 64px; left: calc(16px + var(--dok-sol, 0px));   /* dok sol bölgesinin dışında (spec 41) */ width: min(340px, calc(100vw - 32px)); z-index: 55; display: none; flex-direction: column; gap: 8px;
  background: rgba(10,14,24,0.96); color: #d7dcea; border: 1px solid #2a3246; border-radius: 10px; padding: 12px 14px; font: 13px/1.45 'Segoe UI', system-ui, sans-serif;
  box-shadow: none; }
#bedenPaneli[data-acik="1"] { display: flex; }
#bedenPaneli .bp-baslik { display: flex; align-items: center; gap: 8px; }
#bedenPaneli .bp-baslik b { color: #58c1ff; font-size: 14px; font-weight: 600; flex: 1; }
#bedenPaneli button { background: #121726; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 9px; font: inherit; cursor: pointer; }
#bedenPaneli button:hover { border-color: #58c1ff; }
#bedenPaneli kbd { font: 11px 'Cascadia Mono', Consolas, monospace; color: #7c88a6; border: 1px solid #2a3246; border-radius: 4px; padding: 0 4px; }
#bedenPaneli .bp-ipucu { color: #7c88a6; font-size: 12px; }
#bedenPaneli .bp-bolum { color: #7c88a6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }
#bedenPaneli .bp-satir { display: flex; align-items: center; gap: 8px; }
#bedenPaneli .bp-satir label { flex: 0 0 96px; color: #d7dcea; }
#bedenPaneli select { flex: 1; background: #121726; color: #eef1fa; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 6px; font: inherit; }
#bedenPaneli input[type=color] { width: 44px; height: 26px; padding: 0; background: #121726; border: 1px solid #2a3246; border-radius: 6px; cursor: pointer; }
#bedenPaneli .bp-kod { font: 11px 'Cascadia Mono', Consolas, monospace; color: #7c88a6; }
`;

export function bedenPaneliKur(a: BedenPaneliAyari): BedenPaneli {
  const { slotlar, renkAdlari, varsayilan, yok } = a.model;
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);

  const kok = document.createElement("div");
  kok.id = "bedenPaneli";
  kok.dataset.acik = "0";
  const olustur = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif: string, metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); e.className = sinif; if (metin) e.textContent = metin; return e;
  };
  const tusEtiketi = (t: string): HTMLElement => Object.assign(document.createElement("kbd"), { textContent: t });

  const baslik = olustur("div", "bp-baslik");
  const sifirla = olustur("button", "", "Varsayılan");
  sifirla.title = "Giysileri ve renkleri ilk haline döndür";
  const kapatDugme = olustur("button", "", "Kapat"); kapatDugme.append(" ", tusEtiketi("Esc"));
  baslik.append(olustur("b", "", "Bedenim"), sifirla, kapatDugme);
  const ipucu = olustur("div", "bp-ipucu", "Parçaları seç, rengi değiştir; beden anında güncellenir ve kaydedilir. Kendini görmek için C ile omuz kamerasına geç.");

  // Arayüz tablodan üretilir: seçim kutuları (slot başına) + renk seçiciler (renk anahtarı başına).
  const secimKutulari = new Map<string, HTMLSelectElement>();
  const renkKutulari = new Map<string, HTMLInputElement>();
  const govde = olustur("div", "");
  const satir = (etiket: string, kontrol: HTMLElement): HTMLElement => {
    const s = olustur("div", "bp-satir"); const l = olustur("label", "", etiket); s.append(l, kontrol); return s;
  };

  govde.append(olustur("div", "bp-bolum", "Giysiler"));
  for (const slot of slotlar) {
    const sel = document.createElement("select");
    sel.append(new Option("Yok (çıplak)", yok));
    for (const [kimlik, s] of Object.entries(slot.secenekler)) sel.append(new Option(s.ad, kimlik));
    sel.addEventListener("change", () => degistir((x) => { x.secim[slot.kimlik] = sel.value; }));
    secimKutulari.set(slot.kimlik, sel);
    govde.append(satir(slot.ad, sel));
  }
  govde.append(olustur("div", "bp-bolum", "Renkler"));
  for (const anahtar of Object.keys(renkAdlari)) {
    const girdi = document.createElement("input");
    girdi.type = "color";
    girdi.addEventListener("input", () => degistir((x) => { x.renk[anahtar] = girdi.value; }));
    renkKutulari.set(anahtar, girdi);
    govde.append(satir(renkAdlari[anahtar]!, girdi));
  }
  kok.append(baslik, ipucu, govde);
  (a.ata ?? document.body).append(kok);

  const kopya = (x: Readonly<PanelAyari>): PanelAyari => ({ secim: { ...x.secim }, renk: { ...x.renk } });
  function degistir(degisiklik: (x: PanelAyari) => void): void {
    const yeni = kopya(a.ayar());
    degisiklik(yeni);
    a.degisti(yeni);
  }
  function yenile(): void {
    const x = a.ayar();
    for (const [k, sel] of secimKutulari) sel.value = x.secim[k] ?? yok;
    for (const [k, girdi] of renkKutulari) girdi.value = x.renk[k] ?? "#000000";
  }

  let acik = false;
  function ac(): void {
    if (acik) return;
    acik = true; yenile(); kok.dataset.acik = "1"; a.acildi?.();
  }
  function kapat(): void { acik = false; kok.dataset.acik = "0"; }

  sifirla.addEventListener("click", () => { a.degisti(kopya(varsayilan)); yenile(); });
  kapatDugme.addEventListener("click", kapat);

  addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const h = e.target as HTMLElement | null;
    if (h && (h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.isContentEditable || h.tagName === "SELECT")) return;
    if (e.key === "Escape" && acik) { kapat(); return; }
    if (e.code !== "KeyB") return;
    if (a.tusSerbest && !a.tusSerbest()) return;
    e.preventDefault();
    if (acik) kapat(); else ac();
  });

  return { ac, kapat, acikMi: () => acik, yenile };
}
