// host/webMonitor.js — Ofisteki 3. monitör (groma haritası): EKRAN DIŞI bir pencere sayfayı yükler, kareler renderer'a JPEG olarak gider.
// YALNIZCA ana süreçte çalışır (Electron). Ön kayıt: docs/olcum/on-kayit-groma-monitoru-1.md.
//
// Neden ekran dışı (offscreen) pencere: WebGL dokusuna DOM çizilemez; Electron'un `offscreen: true` kipi sayfayı bellekte işler ve her kareyi `paint`
// olayıyla verir. Kare JPEG'e sıkıştırılıp IPC'ye girer (≈50–90 KB; ham bitmap 2,4 MB olurdu). Fare olayları normalleştirilmiş (0..1) koordinatla gelir ve
// sayfa piksellerine burada çevrilir: renderer sayfanın boyutunu bilmek zorunda değil.
//
// GÜVENLİK: yalnız yerel adres (localhost/127.0.0.1/::1, http). Başka adres `ac`ta REDDEDİLİR (oyun, internetten rastgele sayfa yüklemez); klavye iletilmez,
// yalnız fare ve tekerlek. Sunucu kapalıysa `kapali` durumu bildirilir ve 5 sn'de bir yeniden denenir (groma sonradan açılırsa kendiliğinden bağlanır).
import { createRequire } from "node:module";

// Electron YALNIZ gerçek pencere açılırken yüklenir: birim testleri (Node) `electron` paketini ESM olarak içe aktaramaz.
const electron = () => createRequire(import.meta.url)("electron");

export const VARSAYILAN_ADRES = "http://localhost:4747";
export const GENISLIK = 1008, YUKSEKLIK = 600;   // ekranın en-boy oranı (0,74 × 0,44 m ≈ 1,68)
const YENIDEN_DENE_MS = 5000;
const EN_AZ_KARE_ARALIGI_MS = 110;                // ≈ 9 kare/sn üst sınırı

/** Yalnız yerel http adresi. Dışarıya açık sayfa yüklenmez. */
export function adresGecerliMi(adres) {
  try {
    const u = new URL(String(adres));
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(u.hostname);
  } catch {
    return false;
  }
}

/** Normalleştirilmiş (0..1) koordinatı sayfa pikseline çevirir; sınır dışı değerler kenara sıkıştırılır. */
export function pikselCevir(nx, ny, g = GENISLIK, y = YUKSEKLIK) {
  const kelepce = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  return { x: Math.round(kelepce(nx) * (g - 1)), y: Math.round(kelepce(ny) * (y - 1)) };
}

export class WebMonitor {
  /**
   * @param {(olay: object) => void} olayVer  renderer'a giden olay: {olay:"durum", d} | {olay:"kare", jpeg, g, y}
   * @param {{ pencereKur?: Function, zamanlayici?: Function, simdi?: () => number }} [ayar]  (testte sahte geçer)
   */
  constructor(olayVer, ayar = {}) {
    this._olayVer = olayVer;
    this._pencereKur = ayar.pencereKur ?? (() => new (electron().BrowserWindow)({
      show: false, width: GENISLIK, height: YUKSEKLIK, frame: false, focusable: false,
      webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, sandbox: true, nodeIntegration: false },
    }));
    this._simdi = ayar.simdi ?? (() => Date.now());
    this._zamanlayici = ayar.zamanlayici ?? setTimeout;
    this._pencere = null;
    this._adres = null;
    this._sonKare = 0;
    this._tekrar = null;
  }

  get acik() { return this._pencere !== null; }

  /** Sayfayı yükler (zaten açıksa yalnız adresi günceller). Geçersiz adres: false, hiçbir pencere açılmaz. */
  ac(adres = VARSAYILAN_ADRES) {
    if (!adresGecerliMi(adres)) return false;
    this._adres = adres;
    if (this._pencere) return true;
    const p = this._pencere = this._pencereKur();
    const wc = p.webContents;
    wc.setFrameRate?.(9);
    wc.on("paint", (_e, _kirli, resim) => this._kare(resim));
    wc.on("did-finish-load", () => this._olayVer({ olay: "durum", d: "acik" }));
    wc.on("did-fail-load", (_e, kod, _aciklama, _url, anaCerceve) => {
      if (anaCerceve === false || kod === -3) return;   // alt çerçeve / iptal: gürültü
      this._olayVer({ olay: "durum", d: "kapali" });
      this._yenidenDene();
    });
    // Sayfa içinden başka siteye gidilmesin: yerel adres dışı gezinme iptal.
    wc.on("will-navigate", (e, url) => { if (!adresGecerliMi(url)) e.preventDefault(); });
    wc.setWindowOpenHandler?.(() => ({ action: "deny" }));
    this._olayVer({ olay: "durum", d: "yukleniyor" });
    this._yukle();
    return true;
  }

  _yukle() {
    if (!this._pencere || this._pencere.isDestroyed?.()) return;
    const sonuc = this._pencere.loadURL(this._adres);
    sonuc?.catch?.(() => { /* did-fail-load olayı durumu bildirir */ });
  }

  _yenidenDene() {
    if (this._tekrar || !this._pencere) return;
    this._tekrar = this._zamanlayici(() => { this._tekrar = null; this._yukle(); }, YENIDEN_DENE_MS);
  }

  _kare(resim) {
    const t = this._simdi();
    if (t - this._sonKare < EN_AZ_KARE_ARALIGI_MS) return;   // sayfa hızlı boyanıyorsa IPC'yi boğma
    this._sonKare = t;
    const boyut = resim.getSize();
    this._olayVer({ olay: "kare", jpeg: resim.toJPEG(78), g: boyut.width, y: boyut.height });
  }

  /**
   * Fare olayını sayfaya iletir. `olay`: {tip:"hareket"|"bas"|"birak"|"tekerlek", x, y (0..1), dugme?: "left"|"right"|"middle", dy?, dx?}.
   * Pencere yoksa ya da tür bilinmiyorsa false (sessiz yutma yok).
   */
  fare(olay) {
    if (!this._pencere || !olay || typeof olay !== "object") return false;
    const { x, y } = pikselCevir(olay.x, olay.y);
    const dugme = ["left", "right", "middle"].includes(olay.dugme) ? olay.dugme : "left";
    const wc = this._pencere.webContents;
    switch (olay.tip) {
      case "hareket": wc.sendInputEvent({ type: "mouseMove", x, y }); return true;
      case "bas": wc.sendInputEvent({ type: "mouseDown", x, y, button: dugme, clickCount: 1 }); return true;
      case "birak": wc.sendInputEvent({ type: "mouseUp", x, y, button: dugme, clickCount: 1 }); return true;
      case "tekerlek": {
        const sinir = (v) => Math.max(-600, Math.min(600, Number.isFinite(v) ? v : 0));
        wc.sendInputEvent({ type: "mouseWheel", x, y, deltaX: sinir(olay.dx ?? 0), deltaY: sinir(olay.dy ?? 0) });
        return true;
      }
      default: return false;
    }
  }

  kapat() {
    const p = this._pencere;
    this._pencere = null;
    this._tekrar = null;
    if (p && !p.isDestroyed?.()) p.destroy();
    this._olayVer({ olay: "durum", d: "sonlandi" });
  }
}
