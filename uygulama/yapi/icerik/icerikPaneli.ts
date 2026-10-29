// uygulama/yapi/icerik/icerikPaneli.ts — İÇERİK GEZGİNİ PANELİ (Unreal Content Browser, spec 39 D4). DOM katmanı; mantık `uygulama/icerik/icerikModeli.ts`te (testli), dosya işlemi host'ta.
//
// Düzen: üstte araç çubuğu (＋ Klasör · ⤓ İçe aktar · ↻ · arama · tür süzgeçleri), solda Favoriler + klasör ağacı (Content ve Engine), sağda kırıntı + önizlemeli kartlar.
// Çift tık türüne göre açar (`ac` kökten gelir: sekans/graf/level/önizleme); sağ tık menüsü (spec 29 çekirdeği): Aç · Klasörü aç · Yeniden adlandır · Çoğalt · Explorer'da göster ·
// Favori · Sil. Engine salt okunurdur: yazan satırlar GRİ ve nedenli. Klavye (panel odaktayken): Enter aç · F2 adlandır · Delete sil · Backspace üst klasör · Ctrl+F ara.
// Panel dok sistemine kayıtlıdır (sol/sağ/alt/yüzer); ilk açılışta KAPALI gelir (oyun alanını daraltmasın), Pencere ▸ İçerik gezgini ile açılır.
"use strict";
import { baglamMenusuKur, type BaglamMenusu } from "../../../world/arayuz/menu/baglamMenusu.ts";
import type { MenuDugumu } from "../../../world/arayuz/menu/menuModeli.ts";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../world/arayuz/arayuzJetonlari.ts";
import type { IpcSonuc, Kopru } from "../../../host/kopru.ts";
import {
  SUZGEC_TURLERI, TUR_BILGISI, acmaEylemi, agacKur, boyutMetni, dosyaAdi, favoriDegistir, favoriOku, gecerliKlasor, gezin, gorunenAd, islemDurumu, kartGenisligi, tasimaKurali, kartlar as kartlariKur, kirinti,
  type AcmaEylemi, type GezinmeTusu, type AgacDugumu, type IcerikKoku, type IcerikTuru, type Kart, type Oge,
} from "../../icerik/icerikModeli.ts";
import { el } from "../ortak/dom.ts";
import type { DokYoneticisi } from "../ortak/dok/dokYoneticisi.ts";

export const ICERIK_PANELI_KIMLIGI = "icerik";
const FAVORI_ANAHTARI = "orion.icerik.favoriler.v1";
const GORUNUM_ANAHTARI = "orion.icerik.gorunum.v1";   // { kart: px, yan: px } — kart boyutu ve klasör ağacı genişliği
const YAN_SINIRI = { en_az: 120, en_cok: 420, varsayilan: 190 };
const KART_TAVANI = 400;
const KUCUK_RESIM_TAVANI = 1.5 * 1048576;

export interface IcerikPaneliAyari {
  kopru: Pick<Kopru, "icerikListe" | "icerikIkili" | "icerikYeniKlasor" | "icerikAdlandir" | "icerikCogalt" | "icerikSil" | "icerikIceAktar" | "icerikTasi" | "icerikBirakAktar" | "icerikGoster">;
  dok: DokYoneticisi;
  /** Çift tık/Enter/menü ▸ Aç: türün editörünü ya da pencereyi açar (kompozisyon kökü bilir). `gir` ve `yok` buraya gelmez. */
  ac: (kart: Kart, eylem: Exclude<AcmaEylemi, "gir" | "yok">) => void | Promise<void>;
  altyazi: (metin: string, ms?: number) => void;
  /** Bir dosya/klasör eklendi, adlandı ya da silindi (sekans/graf/NPC depoları tazelensin diye). */
  degisti?: (adres: string) => void;
  /** Model kartı ▸ "Odaya yerleştir" (Yapı çubuğundaki Asset sekmesiyle AYNI yol): dosya adının gövdesi katalogdaki varlık adıysa hayalet açılır, değilse false. */
  yerlestir?: (govde: string) => boolean;
}

export interface IcerikPaneli {
  readonly kok: HTMLElement;
  yenile(): Promise<void>;
  git(klasor: string): void;
  klasor(): string;
  secili(): string | null;
  sec(adres: string | null): void;
  ara(metin: string): void;
  turSuz(turler: readonly IcerikTuru[]): void;
  gorunenKartlar(): Kart[];
  /** Çift tık/Enter ile aynı yol. */
  ac(adres: string): Promise<void>;
  yeniKlasor(ad: string): Promise<boolean>;
  adlandir(adres: string, yeniAd: string): Promise<boolean>;
  cogalt(adres: string): Promise<boolean>;
  sil(adres: string): Promise<boolean>;
  iceAktar(): Promise<boolean>;
  favori(adres: string): void;
  favoriler(): string[];
  mesaj(): { metin: string; tur: string };
}

const CSS = `
.ic-kok { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #0c111e; color: ${R.yazi}; font: ${YAPI_YAZI.govde}; outline: none; user-select: none; }
.ic-arac { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 5px 8px; border-bottom: 1px solid ${R.cizgi}; flex: none; }
.ic-arac button, .ic-menu-dugme { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 9px; font: inherit; cursor: pointer; }
.ic-arac button:hover:not(:disabled) { border-color: ${R.vurgu}; color: ${R.yaziParlak}; } .ic-arac button:disabled { opacity: 0.4; cursor: not-allowed; }
.ic-arac button[data-acik="1"] { border-color: ${R.vurgu}; background: rgba(88,193,255,0.14); color: ${R.yaziParlak}; }
.ic-ara { flex: 1; min-width: 110px; max-width: 240px; background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 8px; font: inherit; user-select: text; }
.ic-suzgec { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; }
.ic-suzgec button { padding: 1px 7px; font-size: 11px; white-space: nowrap; }
.ic-zoom { display: flex; align-items: center; gap: 4px; margin-left: auto; color: ${R.yaziSoluk}; font-size: 11px; }
.ic-zoom input { width: 84px; accent-color: ${R.vurgu}; }
.ic-govde { flex: 1; min-height: 0; display: flex; }
.ic-ayirac { width: 5px; flex: none; cursor: col-resize; background: transparent; margin-left: -3px; z-index: 1; } .ic-ayirac:hover, .ic-ayirac[data-surukleniyor="1"] { background: ${R.vurgu}; opacity: .55; }
.ic-yan { width: var(--ic-yan, 190px); flex: none; overflow: auto; border-right: 1px solid ${R.cizgi}; padding: 4px 0; }
.ic-baslik { padding: 4px 10px 2px; color: ${R.yaziSoluk}; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.ic-dugum { display: flex; align-items: center; gap: 3px; padding: 1px 6px 1px 0; cursor: pointer; white-space: nowrap; }
.ic-dugum:hover { background: rgba(255,255,255,0.05); }
.ic-dugum[data-birak="1"], .ic-kart[data-birak="1"], .ic-kirinti span[data-birak="1"] { outline: 2px dashed ${R.vurgu}; outline-offset: -2px; background: rgba(88,193,255,0.18); }
.ic-izgara[data-birak="1"] { outline: 2px dashed ${R.vurgu}; outline-offset: -3px; }
.ic-kart[data-suruklenen="1"] { opacity: 0.45; }
.ic-dugum[data-secili="1"] { background: rgba(88,193,255,0.16); color: ${R.yaziParlak}; }
.ic-ok { width: 14px; text-align: center; color: ${R.yaziSoluk}; flex: none; }
.ic-ana { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ic-kirinti { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 4px 10px; color: ${R.yaziOrta}; flex: none; }
.ic-kirinti span[data-adres] { cursor: pointer; padding: 0 3px; border-radius: 3px; } .ic-kirinti span[data-adres]:hover { background: rgba(255,255,255,0.08); color: ${R.yaziParlak}; }
.ic-izgara { flex: 1; min-height: 0; overflow: auto; padding: 6px 10px 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--ic-kart, 104px), 1fr)); grid-auto-rows: max-content; gap: 8px; align-content: start; }
.ic-kart { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px 4px; border: 1px solid transparent; border-radius: 7px; background: ${R.kart}; cursor: default; min-width: 0; }
.ic-kart:hover { border-color: ${R.kartCizgi}; background: #1a2336; }
.ic-kart[data-secili="1"] { border-color: ${R.vurgu}; background: rgba(88,193,255,0.12); }
.ic-kok:focus-within .ic-kart[data-secili="1"] { box-shadow: 0 0 0 1px ${R.vurgu}; }
.ic-onizleme { width: calc(var(--ic-kart, 104px) - 20px); height: calc((var(--ic-kart, 104px) - 20px) * .76); display: flex; align-items: center; justify-content: center; font-size: calc(var(--ic-kart, 104px) * .29); border-radius: 5px; background: #0a0f1b; overflow: hidden; position: relative; }
.ic-onizleme img { max-width: 100%; max-height: 100%; object-fit: contain; }
.ic-onizleme .ic-rozet { position: absolute; right: 2px; bottom: 1px; font-size: 10px; color: ${R.yaziSoluk}; }
.ic-ad { max-width: 100%; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: ${R.yaziParlak}; }
.ic-ad-girdi { width: 96px; background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.vurgu}; border-radius: 3px; font: inherit; font-size: 12px; padding: 0 3px; user-select: text; }
.ic-alt { font-size: 10.5px; color: ${R.yaziSoluk}; }
.ic-bos { grid-column: 1 / -1; padding: 24px; color: ${R.yaziSoluk}; text-align: center; }
.ic-durum { display: flex; gap: 12px; padding: 3px 10px; border-top: 1px solid ${R.cizgi}; color: ${R.yaziSoluk}; font-size: 11.5px; flex: none; min-height: 18px; }
.ic-durum .ic-mesaj { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ic-durum .ic-mesaj[data-tur="hata"] { color: ${R.hata}; } .ic-durum .ic-mesaj[data-tur="iyi"] { color: ${R.iyi}; } .ic-durum .ic-mesaj[data-tur="uyari"] { color: ${R.uyari}; }
`;
let stilEklendi = false;
const yanGenisligi = (ham: unknown): number => { const n = typeof ham === "number" ? ham : Number.NaN; return Number.isFinite(n) ? Math.min(YAN_SINIRI.en_cok, Math.max(YAN_SINIRI.en_az, Math.round(n))) : YAN_SINIRI.varsayilan; };

export function icerikPaneliKur(a: IcerikPaneliAyari): IcerikPaneli {
  if (!stilEklendi) { const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); stilEklendi = true; }
  const menu: BaglamMenusu<() => void> = baglamMenusuKur<() => void>({ calistir: (f) => f() });

  // ── durum ──
  let ogeler: Oge[] = [];
  let klasor = "Content";
  let secili: string | null = null;
  let arama = "";
  let turler = new Set<IcerikTuru>();
  let favoriler: string[] = (() => { try { return favoriOku(JSON.parse(localStorage.getItem(FAVORI_ANAHTARI) ?? "null")); } catch { return []; } })();
  const acikDugumler = new Set<string>(["Content", "Engine"]);
  let adlanan: string | null = null;
  let mesajMetni = "", mesajTuru = "";
  let kesildi = false, projeYok = false;
  const resimler = new Map<string, string>();   // adres → data URL (küçük görsel önizlemesi)
  const resimIstenen = new Set<string>();

  // ── iskelet ──
  const kok = el("div", "ic-kok"); kok.tabIndex = 0;
  const dugme = (metin: string, ipucu: string): HTMLButtonElement => { const b = el("button", "", metin); b.type = "button"; b.title = ipucu; return b; };
  const klasorD = dugme("＋ Klasör", "Seçili klasörde yeni klasör (Content/Assets altında)");
  const iceD = dugme("⤓ İçe aktar", "glb / png / jpg / webp dosyalarını Content/Assets'e kopyala");
  const yenileD = dugme("↻", "Listeyi yeniden oku");
  const araGirdisi = el("input", "ic-ara"); araGirdisi.placeholder = "ara (seçili klasörün altında)"; araGirdisi.spellcheck = false;
  const suzgec = el("div", "ic-suzgec");
  const suzgecDugmeleri = new Map<IcerikTuru, HTMLButtonElement>();
  const tumuD = dugme("Tümü", "Tür süzgecini kaldır"); tumuD.dataset.tumu = "1";
  suzgec.append(tumuD);
  for (const t of SUZGEC_TURLERI) { const b = dugme(`${TUR_BILGISI[t].ikon} ${TUR_BILGISI[t].ad}`, `Yalnız ${TUR_BILGISI[t].ad} (birden çok tür seçilebilir)`); b.dataset.tur = t; suzgecDugmeleri.set(t, b); suzgec.append(b); }
  const zoomGirdisi = el("input"); zoomGirdisi.type = "range"; zoomGirdisi.min = "72"; zoomGirdisi.max = "200"; zoomGirdisi.step = "4"; zoomGirdisi.title = "Kart boyutu";
  const zoom = el("label", "ic-zoom", "Boyut "); zoom.append(zoomGirdisi);
  const arac = el("div", "ic-arac"); arac.append(klasorD, iceD, yenileD, araGirdisi, suzgec, zoom);
  const yan = el("div", "ic-yan"), ana = el("div", "ic-ana");
  const ayirac = el("div", "ic-ayirac"); ayirac.title = "Sürükle: klasör ağacının genişliği";
  const kirintiKutusu = el("div", "ic-kirinti"), izgara = el("div", "ic-izgara");
  ana.append(kirintiKutusu, izgara);
  const govde = el("div", "ic-govde"); govde.append(yan, ayirac, ana);

  // Görünüm tercihi (kart boyutu, ağaç genişliği): kişisel kolaylık, localStorage (yoksa varsayılan).
  const gorunum = (() => {
    try { const h = JSON.parse(localStorage.getItem(GORUNUM_ANAHTARI) ?? "null") as { kart?: unknown; yan?: unknown } | null; return { kart: kartGenisligi(h?.kart), yan: yanGenisligi(h?.yan) }; }
    catch { return { kart: kartGenisligi(null), yan: YAN_SINIRI.varsayilan }; }
  })();
  function gorunumuUygula(): void {
    kok.style.setProperty("--ic-kart", `${gorunum.kart}px`); kok.style.setProperty("--ic-yan", `${gorunum.yan}px`); zoomGirdisi.value = String(gorunum.kart);
  }
  const gorunumuKaydet = (): void => { try { localStorage.setItem(GORUNUM_ANAHTARI, JSON.stringify(gorunum)); } catch { /* depo yok: yalnız bu oturum */ } };
  gorunumuUygula();
  const durum = el("div", "ic-durum"), mesajKutusu = el("div", "ic-mesaj"), sayiKutusu = el("div", ""); durum.append(mesajKutusu, sayiKutusu);
  kok.append(arac, govde, durum);

  const mesajVer = (metin: string, tur = ""): void => { mesajMetni = metin; mesajTuru = tur; mesajKutusu.textContent = metin; mesajKutusu.dataset.tur = tur; };
  const sonucMesaji = (r: Extract<IpcSonuc<unknown>, { ok: false }>): string => r.mesaj;

  // ── veri ──
  async function yenile(): Promise<void> {
    // Köprü yok (yalnız tarayıcı, Electron'suz): içerik yok, hata da yok — dosya işlemleri Electron'da çalışır.
    if (!a.kopru) { mesajVer("İçerik gezgini Electron'da çalışır (proje dosyaları masaüstü uygulamasında)."); return; }
    const [c, e] = await Promise.all([a.kopru.icerikListe("Content"), a.kopru.icerikListe("Engine")]);
    const yeni: Oge[] = [];
    projeYok = false; kesildi = false;
    if (c.ok) { yeni.push(...c.deger.ogeler); kesildi ||= c.deger.kesildi; } else if (c.kod === "kok-yok") projeYok = true; else mesajVer(`Content okunamadı: ${sonucMesaji(c)}`, "hata");
    if (e.ok) { yeni.push(...e.deger.ogeler); kesildi ||= e.deger.kesildi; } else mesajVer(`Engine okunamadı: ${sonucMesaji(e)}`, "hata");
    ogeler = yeni;
    klasor = gecerliKlasor(ogeler, klasor);
    if (secili && !ogeler.some((o) => o.adres === secili)) secili = null;
    ciz();
  }

  const kartListesi = (): Kart[] => kartlariKur(ogeler, klasor, { arama, turler });
  const kartBul = (adres: string): Kart | undefined => kartListesi().find((k) => k.adres === adres);
  const ogeBul = (adres: string): Oge | undefined => ogeler.find((o) => o.adres === adres);

  // ── çizim ──
  function agacSatiri(d: AgacDugumu, derinlik: number, hedef: HTMLElement): void {
    const acik = acikDugumler.has(d.adres), cocuklu = d.cocuklar.length > 0;
    const s = el("div", "ic-dugum"); s.style.paddingLeft = `${4 + derinlik * 12}px`; s.dataset.adres = d.adres; s.dataset.secili = klasor === d.adres ? "1" : "0";
    const ok = el("span", "ic-ok", cocuklu ? (acik ? "▾" : "▸") : "");
    ok.addEventListener("click", (e) => { e.stopPropagation(); if (acikDugumler.has(d.adres)) acikDugumler.delete(d.adres); else acikDugumler.add(d.adres); ciz(); });
    s.append(ok, el("span", "", derinlik === 0 && d.adres === "Engine" ? "🔒" : "📁"), el("span", "", d.ad));
    s.addEventListener("click", () => git(d.adres));
    s.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); git(d.adres); bosMenusu(e.clientX, e.clientY); });
    birakHedefi(s, d.adres, true);
    hedef.append(s);
    if (acik) for (const c of d.cocuklar) agacSatiri(c, derinlik + 1, hedef);
  }

  // ── sürükle-bırak (D4+): kartı klasöre taşı (host `tasi`), Explorer'dan dosya bırak (host `icerikBirakAktar`) ──
  let suruklenen: string | null = null;
  const dosyaMi = (e: DragEvent): boolean => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  /** Bırakılan dosyaların gideceği yer: hedef Assets altındaysa o, değilse Content/Assets (içe aktarma yalnız oraya). */
  const aktarHedefi = (hedef: string): string => (hedef.startsWith("Content/Assets") ? hedef : "Content/Assets");
  function birakBitti(): void {
    suruklenen = null;
    for (const h of kok.querySelectorAll<HTMLElement>("[data-birak],[data-suruklenen]")) { delete h.dataset.birak; delete h.dataset.suruklenen; }
  }
  /** `ogeEl`i `hedef` klasörü için bırakma hedefi yap: iç taşıma `tasimaKurali`ndan, dosya bırakma proje açıksa geçer. */
  function birakHedefi(ogeEl: HTMLElement, hedefAl: string | (() => string), klasorMu: boolean): void {
    const hedef = (): string => (typeof hedefAl === "string" ? hedefAl : hedefAl());
    const uygun = (e: DragEvent): boolean => suruklenen ? tasimaKurali(suruklenen, hedef(), klasorMu) === null : dosyaMi(e) && !projeYok;
    ogeEl.addEventListener("dragover", (e) => {
      if (!uygun(e)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = suruklenen ? "move" : "copy";
      ogeEl.dataset.birak = "1";
    });
    ogeEl.addEventListener("dragleave", () => { delete ogeEl.dataset.birak; });
    ogeEl.addEventListener("drop", (e) => {
      delete ogeEl.dataset.birak;
      if (!uygun(e)) return;
      e.preventDefault(); e.stopPropagation();
      if (suruklenen) { const k = suruklenen; birakBitti(); void tasi(k, hedef()); }
      else if (e.dataTransfer) void birakAktar(aktarHedefi(hedef()), Array.from(e.dataTransfer.files));
    });
  }

  function ciz(): void {
    // klasörün atalarını açık tut (kırıntıdan gelinse de ağaçta görünsün)
    for (const k of kirinti(klasor)) acikDugumler.add(k.adres);
    yan.replaceChildren();
    if (favoriler.length) {
      yan.append(el("div", "ic-baslik", "Favoriler"));
      for (const f of favoriler) {
        const o = ogeBul(f), s = el("div", "ic-dugum"); s.style.paddingLeft = "10px"; s.dataset.favori = f;
        s.append(el("span", "", o?.klasor ? "📁" : "★"), el("span", "", dosyaAdi(f) + (o ? "" : " (yok)")));
        s.addEventListener("click", () => { if (!o) { mesajVer(`Favori artık yok: ${f}`, "uyari"); return; } if (o.klasor) git(f); else { git(f.split("/").slice(0, -1).join("/")); sec(f); } });
        yan.append(s);
      }
    }
    yan.append(el("div", "ic-baslik", "Klasörler"));
    for (const k of ["Content", "Engine"] as IcerikKoku[]) agacSatiri(agacKur(ogeler, k), 0, yan);

    kirintiKutusu.replaceChildren();
    kirinti(klasor).forEach((k, i, d) => {
      const s = el("span", "", k.ad); s.dataset.adres = k.adres; s.addEventListener("click", () => git(k.adres)); birakHedefi(s, k.adres, true);
      kirintiKutusu.append(s); if (i < d.length - 1) kirintiKutusu.append(el("span", "", "›"));
    });
    if (arama || turler.size) kirintiKutusu.append(el("span", "", `  — ${arama ? `"${arama}" ` : ""}${turler.size ? [...turler].map((t) => TUR_BILGISI[t].ad).join("+") : ""} aranıyor`));

    const liste = kartListesi();
    izgara.replaceChildren();
    if (projeYok) izgara.append(el("div", "ic-bos", "Açık proje yok (Dosya ▸ Yeni proje…)"));
    else if (!liste.length) {
      const yaz = islemDurumu(klasor);
      izgara.append(el("div", "ic-bos", arama || turler.size ? "Eşleşen öğe yok — aramayı ya da süzgeci temizle (Esc / Tümü)" : yaz.yazilabilir ? "Bu klasör boş — sağ tık: Yeni klasör / İçe aktar" : "Bu klasör boş"));
    }
    for (const k of liste.slice(0, KART_TAVANI)) izgara.append(kartCiz(k));
    if (liste.length > KART_TAVANI) izgara.append(el("div", "ic-bos", `… ${liste.length - KART_TAVANI} öğe daha (aramayı daraltın)`));
    durumuYaz(liste.length);

    const yazilabilir = islemDurumu(klasor);
    klasorD.disabled = !yazilabilir.yazilabilir; klasorD.title = yazilabilir.yazilabilir ? "Seçili klasörde yeni klasör" : (yazilabilir.neden ?? "");
    iceD.disabled = projeYok;
    for (const [t, b] of suzgecDugmeleri) b.dataset.acik = turler.has(t) ? "1" : "0";
    tumuD.dataset.acik = turler.size ? "0" : "1";
    resimleriIste(liste);
  }

  /** Sağ alt durum: öğe sayısı + seçili kartın türü ve boyutu (Unreal'daki "N öğe (1 seçili)"). */
  function durumuYaz(sayi: number): void {
    const k = secili ? kartBul(secili) : undefined;
    sayiKutusu.textContent = `${sayi} öğe${kesildi ? " · liste kesildi (çok büyük)" : ""}${secili ? ` · ${k ? `${gorunenAd(k)} (${TUR_BILGISI[k.tur].ad}${k.klasor && k.tur === "klasor" ? "" : `, ${boyutMetni(k.boyut)}`})` : dosyaAdi(secili)}` : ""}`;
  }

  function kartCiz(k: Kart): HTMLElement {
    const c = el("div", "ic-kart"); c.dataset.adres = k.adres; c.dataset.tur = k.tur; c.dataset.secili = secili === k.adres ? "1" : "0";
    c.title = `${k.adres}\n${TUR_BILGISI[k.tur].ad}${k.klasor && k.tur === "klasor" ? "" : ` · ${boyutMetni(k.boyut)}`}${k.saltOkunur ? " · salt okunur" : ""}`;
    const o = el("div", "ic-onizleme");
    const resim = resimler.get(k.adres);
    if (resim) { const i = document.createElement("img"); i.src = resim; i.alt = ""; o.append(i); } else o.append(el("span", "", TUR_BILGISI[k.tur].ikon));
    if (k.saltOkunur) o.append(el("span", "ic-rozet", "🔒"));
    c.append(o);
    if (adlanan === k.adres) {
      const g = el("input", "ic-ad-girdi"); g.value = k.ad; g.spellcheck = false;
      let bitti = false;
      const bitir = (kaydet: boolean): void => { if (bitti) return; bitti = true; adlanan = null; if (kaydet && g.value !== k.ad) void adlandir(k.adres, g.value); else ciz(); kok.focus(); };
      g.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") bitir(true); else if (e.key === "Escape") bitir(false); });
      g.addEventListener("blur", () => bitir(false));
      g.addEventListener("click", (e) => e.stopPropagation());
      c.append(g);
      setTimeout(() => { g.focus(); const i = g.value.indexOf("."); g.setSelectionRange(0, i > 0 ? i : g.value.length); }, 0);
    } else c.append(el("div", "ic-ad", gorunenAd(k)));
    c.append(el("div", "ic-alt", TUR_BILGISI[k.tur].ad));
    c.addEventListener("click", (e) => { e.stopPropagation(); sec(k.adres); kok.focus(); });
    c.addEventListener("dblclick", (e) => { e.stopPropagation(); void ac(k.adres); });
    c.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); sec(k.adres); kartMenusu(k, e.clientX, e.clientY); });
    const yazilir = islemDurumu(k.adres);
    if (yazilir.yazilabilir && !yazilir.korumali && adlanan !== k.adres) {
      c.draggable = true;
      c.addEventListener("dragstart", (e) => {
        suruklenen = k.adres; c.dataset.suruklenen = "1";
        if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", k.adres); }
      });
      c.addEventListener("dragend", () => birakBitti());
    }
    if (k.tur === "klasor") birakHedefi(c, k.adres, true);   // paket kartları (level/karakter) klasör gibi görünse de içine bırakılmaz
    return c;
  }

  /** Görünen küçük görselleri tembelce yükle (en çok 40; aynı adres bir kez istenir). */
  function resimleriIste(liste: Kart[]): void {
    for (const k of liste.slice(0, 40)) {
      if (k.tur !== "gorsel" || resimler.has(k.adres) || resimIstenen.has(k.adres) || k.boyut > KUCUK_RESIM_TAVANI) continue;
      resimIstenen.add(k.adres);
      void a.kopru.icerikIkili(k.adres).then((r) => {
        if (!r.ok) return;
        const uz = dosyaAdi(k.adres).split(".").pop()!.toLowerCase();
        resimler.set(k.adres, `data:image/${uz === "jpg" ? "jpeg" : uz};base64,${r.deger.base64}`);
        const h = izgara.querySelector<HTMLElement>(`.ic-kart[data-adres="${CSS_KACIS(k.adres)}"]`);
        if (h) { const yeni = kartCiz(k); h.replaceWith(yeni); }
      });
    }
  }

  // ── gezinme/seçim ──
  function git(hedef: string): void {
    klasor = hedef; secili = null; arama = ""; araGirdisi.value = ""; turler = new Set(); adlanan = null; ciz();
  }
  function sec(adres: string | null): void {
    secili = adres;
    for (const c of izgara.querySelectorAll<HTMLElement>(".ic-kart")) c.dataset.secili = c.dataset.adres === adres ? "1" : "0";
    durumuYaz(kartListesi().length);
    if (adres) izgara.querySelector<HTMLElement>(`.ic-kart[data-adres="${CSS_KACIS(adres)}"]`)?.scrollIntoView({ block: "nearest" });
  }

  async function ac(adres: string): Promise<void> {
    const k = kartBul(adres);
    if (!k) return;
    const eylem = acmaEylemi(k.tur);
    if (eylem === "gir") { git(k.adres); return; }
    if (eylem === "yok") { mesajVer(`${TUR_BILGISI[k.tur].ad} türü için bir editör yok: ${k.ad}`, "uyari"); return; }
    try { await a.ac(k, eylem); } catch (e) { mesajVer(`Açılamadı: ${e instanceof Error ? e.message : String(e)}`, "hata"); }
  }

  // ── işlemler ──
  /** IPC çağrısı reddedilirse (kayıtsız kanal = ana süreç eski, köprü hatası) iş SESSİZCE yutulmasın: durum çubuğunda hata olarak görünür. */
  const sonuc = async <T>(r: Promise<IpcSonuc<T>>): Promise<IpcSonuc<T>> => {
    try { return await r; } catch (e) { return { ok: false, kod: "ipc", mesaj: `köprü hatası (oyunu yeniden başlat?): ${e instanceof Error ? e.message : String(e)}` }; }
  };
  async function islem(ad: string, adres: string, r: Promise<IpcSonuc<string>>, iyiMetin: (s: string) => string): Promise<boolean> {
    const s = await sonuc(r);
    if (!s.ok) { mesajVer(`${ad}: ${sonucMesaji(s)}`, "hata"); a.altyazi(`${ad}: ${sonucMesaji(s)}`, 3200); ciz(); return false; }
    mesajVer(iyiMetin(s.deger), "iyi");
    a.degisti?.(adres);
    await yenile();
    return true;
  }
  const yeniKlasor = async (ad: string): Promise<boolean> => {
    const hedef = `${klasor}/${ad}`;
    const ok = await islem("Yeni klasör", hedef, a.kopru.icerikYeniKlasor(hedef), (s) => `Klasör açıldı: ${s}`);
    if (ok) { acikDugumler.add(klasor); }
    return ok;
  };
  const adlandir = (adres: string, yeniAd: string): Promise<boolean> => islem("Adlandır", adres, a.kopru.icerikAdlandir(adres, yeniAd), (s) => `Adlandırıldı: ${s}`)
    .then((ok) => { if (ok) secili = adres.split("/").slice(0, -1).concat(yeniAd).join("/"); if (ok) ciz(); return ok; });
  const cogalt = (adres: string): Promise<boolean> => islem("Çoğalt", adres, a.kopru.icerikCogalt(adres), (s) => `Çoğaltıldı: ${s}`);
  const tasi = (adres: string, hedef: string): Promise<boolean> => islem("Taşı", adres, a.kopru.icerikTasi(adres, hedef), (s) => `Taşındı: ${s}`)
    .then((ok) => { if (ok) { secili = `${hedef}/${dosyaAdi(adres)}`; ciz(); } return ok; });
  const sil = (adres: string): Promise<boolean> => islem("Sil", adres, a.kopru.icerikSil(adres), (s) => `Kaldırıldı (geri alınabilir): Content/${s}`);
  async function iceAktar(): Promise<boolean> {
    const hedef = klasor.startsWith("Content/Assets") ? klasor : "Content/Assets";
    return aktarSonucu(hedef, await sonuc(a.kopru.icerikIceAktar(hedef)));
  }
  /** Explorer'dan bırakılan dosyalar (seçici açılmaz). */
  async function birakAktar(hedef: string, dosyalar: File[]): Promise<boolean> {
    if (!dosyalar.length) return false;
    return aktarSonucu(hedef, await sonuc(a.kopru.icerikBirakAktar(hedef, dosyalar)));
  }
  async function aktarSonucu(hedef: string, r: Awaited<ReturnType<typeof a.kopru.icerikIceAktar>>): Promise<boolean> {
    if (!r.ok) { mesajVer(`İçe aktar: ${sonucMesaji(r)}`, "hata"); return false; }
    const { eklenen, atlanan } = r.deger;
    if (eklenen.length) { git(hedef); await yenile(); }
    mesajVer(eklenen.length ? `${eklenen.length} dosya içe aktarıldı → ${hedef}${atlanan.length ? ` · atlanan: ${atlanan.map((x) => `${x.ad} (${x.neden})`).join(", ")}` : ""}` : atlanan.length ? `Aktarılmadı: ${atlanan.map((x) => `${x.ad} (${x.neden})`).join(", ")}` : "İçe aktarma iptal edildi", eklenen.length ? "iyi" : "uyari");
    return eklenen.length > 0;
  }
  function favori(adres: string): void {
    favoriler = favoriDegistir(favoriler, adres);
    try { localStorage.setItem(FAVORI_ANAHTARI, JSON.stringify(favoriler)); } catch { /* depo yok: yalnız bu oturum */ }
    ciz();
  }
  const adlanmayaBasla = (adres: string): void => { adlanan = adres; ciz(); };

  // ── menüler ──
  const e = (kimlik: string, ad: string, eylem: () => void, uygun = true, neden: string | null = null, kisayol: string | null = null): MenuDugumu<() => void> =>
    ({ tur: "eylem", kimlik, ad, kisayol, uygun, neden, eylem });
  const AYRAC: MenuDugumu<() => void> = { tur: "ayrac" };

  function kartMenusu(k: Kart, x: number, y: number): void {
    const d = islemDurumu(k.adres), ac_ = acmaEylemi(k.tur);
    const yaz = d.yazilabilir && !d.korumali;
    const nedenYaz = !d.yazilabilir ? d.neden ?? null : d.korumali ? "Korumalı klasör (proje bunu tür klasörü olarak arar)" : null;
    const satirlar: MenuDugumu<() => void>[] = [
      e("ac", "Aç", () => { void ac(k.adres); }, ac_ !== "yok", ac_ === "yok" ? `${TUR_BILGISI[k.tur].ad} türü için editör yok` : null, "Enter"),
    ];
    if (k.klasor && k.tur !== "klasor") satirlar.push(e("klasoru-ac", "Klasörü aç", () => git(k.adres)));
    if (k.tur === "model" && a.yerlestir) {
      const govde = dosyaAdi(k.adres).replace(/\.glb$/i, "");
      satirlar.push(e("yerlestir", "Odaya yerleştir", () => {
        if (a.yerlestir!(govde)) mesajVer(`'${govde}' odaya yerleştirilmek üzere hayalet olarak açıldı (tıkla: bırak, Esc: vazgeç)`, "iyi");
        else mesajVer(`'${govde}' katalogda yok (yalnız Engine/sehir, orman, esya katalog varlıkları yerleştirilir)`, "uyari");
      }));
    }
    satirlar.push(AYRAC,
      e("adlandir", "Yeniden adlandır", () => adlanmayaBasla(k.adres), yaz, nedenYaz, "F2"),
      e("cogalt", "Çoğalt", () => { void cogalt(k.adres); }, yaz, nedenYaz),
      e("goster", "Explorer'da göster", () => { void a.kopru.icerikGoster(k.adres).then((r) => { if (!r.ok) mesajVer(`Göster: ${sonucMesaji(r)}`, "hata"); }); }),
      e("favori", favoriler.includes(k.adres) ? "Favorilerden çıkar" : "Favorilere ekle", () => favori(k.adres)),
      AYRAC,
      e("sil", "Sil", () => { void sil(k.adres); }, yaz, nedenYaz, "Delete"),
    );
    menu.ac(satirlar, x, y);
  }
  function bosMenusu(x: number, y: number): void {
    const d = islemDurumu(klasor);
    menu.ac([
      e("yeni-klasor", "Yeni klasör", () => yeniKlasorSor(), d.yazilabilir, d.neden ?? null),
      e("ice-aktar", "İçe aktar…", () => { void iceAktar(); }, !projeYok, projeYok ? "Açık proje yok" : null),
      AYRAC,
      e("yenile", "Yenile", () => { void yenile(); }),
    ], x, y);
  }
  /** Yeni klasör adı: kartlar arasında ilk satırda düzenlenen bir ad girdisi (prompt yok: Electron'da kapalı). */
  function yeniKlasorSor(): void {
    const g = el("input", "ic-ad-girdi"); g.value = "Yeni Klasör"; g.spellcheck = false;
    const kart = el("div", "ic-kart"); const onz = el("div", "ic-onizleme"); onz.append(el("span", "", "📁")); kart.append(onz, g);
    izgara.prepend(kart);
    let bitti = false;
    const bitir = (kaydet: boolean): void => { if (bitti) return; bitti = true; kart.remove(); if (kaydet && g.value.trim()) void yeniKlasor(g.value.trim()); kok.focus(); };
    g.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") bitir(true); else if (ev.key === "Escape") bitir(false); });
    g.addEventListener("blur", () => bitir(false));
    setTimeout(() => { g.focus(); g.select(); }, 0);
  }

  // ── olaylar ──
  klasorD.addEventListener("click", () => yeniKlasorSor());
  iceD.addEventListener("click", () => { void iceAktar(); });
  yenileD.addEventListener("click", () => { void yenile().then(() => mesajVer("Liste yenilendi", "iyi")); });
  araGirdisi.addEventListener("input", () => { arama = araGirdisi.value; ciz(); });
  araGirdisi.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Escape") { araGirdisi.value = ""; arama = ""; ciz(); kok.focus(); } });
  for (const [t, b] of suzgecDugmeleri) b.addEventListener("click", () => { if (turler.has(t)) turler.delete(t); else turler.add(t); ciz(); });
  tumuD.addEventListener("click", () => { turler = new Set(); ciz(); });
  zoomGirdisi.addEventListener("input", () => { gorunum.kart = kartGenisligi(zoomGirdisi.value); gorunumuUygula(); gorunumuKaydet(); });
  ayirac.addEventListener("pointerdown", (ev) => {
    ev.preventDefault(); try { ayirac.setPointerCapture(ev.pointerId); } catch { /* sentetik/bitmiş işaretçi: yakalamasız sürer */ } ayirac.dataset.surukleniyor = "1";
    const x0 = ev.clientX, g0 = gorunum.yan;
    const tasi = (m: PointerEvent): void => { gorunum.yan = yanGenisligi(g0 + m.clientX - x0); gorunumuUygula(); };
    const bitir = (): void => { ayirac.dataset.surukleniyor = "0"; ayirac.removeEventListener("pointermove", tasi); ayirac.removeEventListener("pointerup", bitir); ayirac.removeEventListener("pointercancel", bitir); gorunumuKaydet(); };
    ayirac.addEventListener("pointermove", tasi); ayirac.addEventListener("pointerup", bitir); ayirac.addEventListener("pointercancel", bitir);
  });
  ayirac.addEventListener("dblclick", () => { gorunum.yan = YAN_SINIRI.varsayilan; gorunumuUygula(); gorunumuKaydet(); });
  izgara.addEventListener("click", () => sec(null));
  birakHedefi(izgara, () => klasor, true);
  izgara.addEventListener("contextmenu", (ev) => { ev.preventDefault(); bosMenusu(ev.clientX, ev.clientY); });
  kok.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLInputElement) return;
    const s = secili ? kartBul(secili) : undefined;
    if (ev.key === "Enter" && s) { ev.preventDefault(); void ac(s.adres); }
    else if (ev.key === "F2" && s) { const d = islemDurumu(s.adres); if (d.yazilabilir && !d.korumali) { ev.preventDefault(); adlanmayaBasla(s.adres); } else mesajVer(d.neden ?? "Korumalı klasör adlandırılamaz", "uyari"); }
    else if (ev.key === "Delete" && s) { const d = islemDurumu(s.adres); if (d.yazilabilir && !d.korumali) { ev.preventDefault(); void sil(s.adres); } else mesajVer(d.neden ?? "Korumalı klasör silinemez", "uyari"); }
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(ev.key)) {
      // Izgarada ok tuşu: sütun sayısı çizilmiş kartların ilk satırından okunur (kart boyutu/pencere genişliği değişse de doğru).
      const kartlar = [...izgara.querySelectorAll<HTMLElement>(".ic-kart[data-adres]")];
      if (!kartlar.length) return;
      ev.preventDefault();
      const ust = kartlar[0]!.offsetTop, sutun = Math.max(1, kartlar.filter((c) => c.offsetTop === ust).length);
      const yeni = gezin(kartlar.length, sutun, kartlar.findIndex((c) => c.dataset.adres === secili), ev.key as GezinmeTusu);
      if (yeni >= 0) sec(kartlar[yeni]!.dataset.adres ?? null);
    }
    else if (ev.key === "Backspace") { ev.preventDefault(); const u = klasor.split("/").slice(0, -1).join("/"); if (u) git(u); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "f") { ev.preventDefault(); araGirdisi.focus(); araGirdisi.select(); }
  });

  // ── dok kaydı ──
  // `baslangicKapali`: ilk açılışta ve "Dok düzenini sıfırla"da kapalı gelir (oyun alanını daraltmasın); Pencere ▸ İçerik ile açılır.
  a.dok.kaydet({ kayit: { id: ICERIK_PANELI_KIMLIGI, ad: "İçerik", bolgeler: ["sol", "sag", "alt", "yuzer"], varsayilan: "alt", baslangicKapali: true }, icerik: kok, gorunur: true, ipucu: "İçerik gezgini: proje ve motor dosyaları" });
  void yenile();

  return {
    kok, yenile, git, klasor: () => klasor, secili: () => secili, sec,
    ara(m) { arama = m; araGirdisi.value = m; ciz(); },
    turSuz(t) { turler = new Set(t); ciz(); },
    gorunenKartlar: kartListesi,
    ac, yeniKlasor, adlandir, cogalt, sil, iceAktar, favori,
    favoriler: () => [...favoriler],
    mesaj: () => ({ metin: mesajMetni, tur: mesajTuru }),
  };
}

/** `querySelector` öznitelik değeri için kaçış (adreste boşluk/tırnak/ters bölü olabilir). */
const CSS_KACIS = (s: string): string => s.replace(/["\\]/g, "\\$&");
