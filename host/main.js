// host/main.js — Electron ana süreç. Pencere + pty + varlık çözümü.
// ESM (package.json "type":"module"). Electron 44 ESM main destekler.
import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron";
import { spawn as ptySpawn } from "node-pty";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { PiperSesi, piperBul } from "./ses.js";
import { Dinleyici } from "./dinleme.js";
import { WebMonitor, VARSAYILAN_ADRES as GROMA_ADRESI } from "./webMonitor.js";
import { durumYolu, hafizaDosyasiOku, hafizaDosyasiYaz, hafizaYolu } from "./hafizaDosyasi.js";
import { mdAktifYap, mdDizini, mdListe, mdOku, mdTohumla, mdYaz, mdYeni } from "./mdDosyalari.js";
import { kararYaziciKur, ogretimYolu, ogretimleriOku, satirlariOku, yeniSatirlar } from "./kararDosyasi.js";
import { mcpSunucuKur } from "./mcpSunucu.js";
import { ollamaHazirla, ollamaAdresi } from "./ollamaSunucu.js";
import { anahtarDeposuKur } from "./anahtarDeposu.js";
import { apiIstek } from "./apiIstek.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, "..");
const GELISTIRME = !app.isPackaged;

// Kanal adları tek kaynaktan: host/kanallar.cjs. Burada KOPYA TUTULMAZ.
import kanallar from "./kanallar.cjs";
const { CAGRI, OLAY } = kanallar;

/** @type {Map<string, import("node-pty").IPty>} */
const ptyler = new Map();
let ptySayac = 0;
/** @type {BrowserWindow | null} */
let pencere = null;

/**
 * Dünya terminalinin kabuğu.
 *
 * Windows'ta artık POWERSHELL — eskiden COMSPEC (cmd.exe) idi. Sebep ölçüldü:
 * Orion'un "bu komut başarısız oldu mu" sorusuna güvenilir cevap vermesi için
 * komut başına ÇIKIŞ KODU gerekiyor (OSC 133 ; D ; <kod>). cmd.exe'nin PROMPT
 * değişkeni %ERRORLEVEL%'i her istemde genişletmediğinden Microsoft'un
 * belgelediği cmd dizisi bile kodu YAYMIYOR. PowerShell'in `prompt`
 * fonksiyonu $LASTEXITCODE'a erişebiliyor; bu makinede node-pty üzerinden
 * canlı doğrulandı (echo -> D;0, bilinmeyen komut -> D;1).
 *
 * ORION_KABUK ile geçersiz kılınabilir (ör. cmd.exe'ye dönmek için).
 */
function varsayilanKabuk() {
  if (process.env.ORION_KABUK) return process.env.ORION_KABUK;
  if (process.platform === "win32") return "powershell.exe";
  return process.env.SHELL ?? "/bin/bash";
}

/** PowerShell'e kabuk entegrasyonunu enjekte eden argümanlar. */
function kabukArgv(kabuk) {
  if (!/powershell\.exe$|pwsh(\.exe)?$/i.test(kabuk)) return [];
  const E = "$([char]27)";
  const BEL = "$([char]7)";
  const prompt = [
    "function prompt {",
    "  $k = if ($?) { 0 } else { 1 };",
    "  if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { $k = $LASTEXITCODE };",
    `  "${E}]133;D;$k${BEL}${E}]133;A${BEL}PS $($executionContext.SessionState.Path.CurrentLocation)> ${E}]133;B${BEL}"`,
    "}",
  ].join(" ");
  return ["-NoLogo", "-NoExit", "-Command", prompt];
}

function pencereAc() {
  pencere = new BrowserWindow({
    width: 1600, height: 900,
    backgroundColor: "#07070d",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false, // dünya tick'i pencere arkada kalınca da dönmeli
    },
  });

  pencere.once("ready-to-show", () => pencere?.show());

  // Renderer konsolunu ana sürece taşı: GUI'yi göremeyen bir denetçi de kanıt görebilsin.
  // Karar satırları (spec 08) günlüğe BASILMAZ, dosyaya eklenir: her algı bir
  // satır — günlüğü boğardı ve kaydın asıl yeri zaten dosya.
  pencere.webContents.on("console-message", (_e, _sev, mesaj) => {
    if (kararYazici.yaz(mesaj)) return;
    console.log(`[renderer] ${mesaj}`);
  });

  // Duman testi: pencere açılır, ölçüm basılır, kendiliğinden kapanır.
  if (process.env.ORION_SMOKE === "1") {
    // Süre ayarlanabilir: gorudene gibi gerçek komut çalıştıran denemeler
    // 16 sn'ye sığmıyor, yarıda kesilen bir deneme kanıt değildir.
    const sure = Number(process.env.ORION_SMOKE_MS ?? 16000) || 16000;
    setTimeout(async () => {
      // EKRAN GORUNTUSU — gorsel isler icin tek kanit yolu.
      //
      // Testler geometriyi ve veriyi dogruluyor ama "ekranda dogru mu
      // gorunuyor" sorusunu yanitlamiyor. Paneller, kamera acisi, yazi
      // okunurlugu: bunlar ancak goruntuye bakilarak dogrulanir.
      // ORION_SS=<yol> verilirse pencere PNG olarak kaydedilir.
      const ss = process.env.ORION_SS;
      if (ss && pencere && !pencere.isDestroyed()) {
        try {
          const g = await pencere.webContents.capturePage();
          fs.mkdirSync(path.dirname(ss), { recursive: true });
          fs.writeFileSync(ss, g.toPNG());
          console.log(`[DUMAN] ekran goruntusu: ${ss}`);
        } catch (e) {
          console.error("[DUMAN] ekran goruntusu alinamadi:", e?.message ?? e);
        }
      }
      console.log("[DUMAN] kabuk ayakta, kapatiliyor");
      app.quit();
    }, sure);
  }

  // Dış bağlantılar tarayıcıda açılır, pencerede asla.
  pencere.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // ORION_SOZ ile açılışta bir cümle söyletilebilir (geliştirme kolaylığı):
  //   ORION_SOZ="merhaba" npx electron .
  const parcalar = [];
  if (process.env.ORION_SOZ) parcalar.push(`soz=${encodeURIComponent(process.env.ORION_SOZ)}`);
  if (process.env.ORION_TERMINAL_DENE === "1") parcalar.push("terminaldene=1", "sessiz=1");
  if (process.env.ORION_OTODENE === "1") parcalar.push("otodene=1", "sessiz=1");
  if (process.env.ORION_GORUDENE === "1") parcalar.push("gorudene=1", "sessiz=1");
  if (process.env.ORION_DAVRANIS === "1") parcalar.push("davranis=1");
  if (process.env.ORION_SESSIZDENE === "1") parcalar.push("sessizdene=1", "sessiz=1");
  if (process.env.ORION_YUZDENE === "1") parcalar.push("yuzdene=1", "sessiz=1");
  if (process.env.ORION_HAFIZADENE === "1") parcalar.push("hafizadene=1", "sessiz=1");
  if (process.env.ORION_BAGLAMDENE === "1") parcalar.push("baglamdene=1", "sessiz=1", "komut=1");
  if (process.env.ORION_TAKIPDENE === "1") parcalar.push("takipdene=1", "sessiz=1", "komut=1");
  if (process.env.ORION_TAHTADENE === "1") parcalar.push("tahtadene=1", "sessiz=1");
  if (process.env.ORION_APIDENE === "1") parcalar.push("apidene=1", "sessiz=1");
  if (process.env.ORION_BENLIKDENE === "1") parcalar.push("benlikdene=1", "sessiz=1");
  if (process.env.ORION_EYLEMDENE === "1") parcalar.push("eylemdene=1", "sessiz=1", "komut=1");
  if (process.env.ORION_KAPIDENE === "1") parcalar.push("kapidene=1", "sessiz=1");
  if (process.env.ORION_OVADENE === "1") parcalar.push("ovadene=1", "sessiz=1", "komut=1");
  // Ortam aracı (sözlük + LLM + öğrenme + kalıcılık): doğuştan komutlar açık (komut=1), ses kapalı.
  if (process.env.ORION_ORTAMDENE === "1") parcalar.push("ortamdene=1", "sessiz=1", "komut=1");
  if (process.env.ORION_EFEKTDENE === "1") parcalar.push("efektdene=1", "sessiz=1", "komut=1");
  if (process.env.ORION_GROMADENE === "1") parcalar.push("gromadene=1", "sessiz=1");
  if (process.env.ORION_GOZLEMDENE === "1") parcalar.push("gozlemdene=1", "sessiz=1");
  // Spec 25 Faz 2: görme. `ORION_GOZ` görme modelini seçer (varsayılan bridge/goz.ts'te).
  if (process.env.ORION_GOZDENE === "1") parcalar.push("gozdene=1", "sessiz=1");
  if (process.env.ORION_GOZ) parcalar.push(`goz=${encodeURIComponent(process.env.ORION_GOZ)}`);
  // Spec 12 Faz 5: süzgeç merceğinin yetkisi (varsayılan kapalı).
  if (process.env.ORION_BENLIK_SUZGEC === "1") parcalar.push("benliksuzgec=1");
  // Terminal komutu kipi (spec 26 F2): otomatik (varsayılan) | tam | onayli
  if (process.env.ORION_KOMUT_KIPI) parcalar.push(`komutkipi=${encodeURIComponent(process.env.ORION_KOMUT_KIPI)}`);
  if (process.env.ORION_TAHTABEYIN === "1") parcalar.push("tahtabeyin=1", "sessiz=1");
  if (process.env.ORION_BECERDENE === "1") parcalar.push("becerdene=1", "sessiz=1");
  if (process.env.ORION_BECERDENE_SOZLER) parcalar.push(`becerdenesoz=${encodeURIComponent(process.env.ORION_BECERDENE_SOZLER)}`);
  // Beceri yetkisi (spec 10, Faz D): anahtar varsayılan kapalı; yalnız açıkça istenince.
  if (process.env.ORION_BECERI === "1") parcalar.push("beceri=1");
  // Mikrofon (bas-konuş V): kulak süreci açılır, söz Orion'a "duydum" olarak gider. Varsayılan kapalı.
  if (process.env.ORION_MIKROFON === "1") parcalar.push("mikrofon=1");
  if (process.env.ORION_ONAYDENE === "1") parcalar.push("onaydene=1", "sessiz=1");
  if (process.env.ORION_TEZDENE === "1") parcalar.push("tezdene=1", "sessiz=1");
  if (process.env.ORION_ZIHINDENE === "1") parcalar.push("zihindene=1", "sessiz=1");
  if (process.env.ORION_ADMINDENE === "1") parcalar.push("admindene=1", "sessiz=1");
  if (process.env.ORION_GORDENE === "1") parcalar.push("gordene=1", "sessiz=1");
  if (process.env.ORION_SENARYODENE === "1") parcalar.push("senaryodene=1", "sessiz=1");
  if (process.env.ORION_SAGLOBDENE === "1") parcalar.push("saglobdene=1", "sessiz=1");
  if (process.env.ORION_ACIDENE === "1") parcalar.push("acidene=1", "sessiz=1");
  if (process.env.ORION_BAKDENE === "1") parcalar.push("bakdene=1", "sessiz=1");
  if (process.env.ORION_FPS === "1") parcalar.push("fps=1");
  if (process.env.ORION_RAKIP === "1") parcalar.push("rakip=1");
  if (process.env.ORION_GECMIS) parcalar.push(`gecmis=${process.env.ORION_GECMIS}`);
  // Spec 16 kıyası: ORION_HAFIZA_KIPI=otomatik eski bağlam davranışını geri getirir.
  if (process.env.ORION_HAFIZA_KIPI) parcalar.push(`hafiza=${encodeURIComponent(process.env.ORION_HAFIZA_KIPI)}`);
  // Senaryosuz canlı denemede TTS'i kapatmak için (Ozyn'in hoparlöründen ses çıkmasın).
  if (process.env.ORION_SESSIZ === "1") parcalar.push("sessiz=1");
  // MCP ajanı bağlanana kadar senaryoyu beklet (spec 05 canlı kapısı).
  if (process.env.ORION_SENARYO_BEKLE) parcalar.push(`senaryobekle=${encodeURIComponent(process.env.ORION_SENARYO_BEKLE)}`);
  // İnisiyatif canlı denemesi: sessizlik eşiği ve refrakter N saniyeye iner.
  if (process.env.ORION_INISIYATIF_SN) parcalar.push(`inisiyatifsn=${encodeURIComponent(process.env.ORION_INISIYATIF_SN)}`);
  // Açılıştan 8 sn sonra Ozyn bunu yazmış gibi (klavyeyle aynı yol); kendiliğinden uyanma açık kalır.
  if (process.env.ORION_OZYN_SOZU) parcalar.push(`ozynsozu=${encodeURIComponent(process.env.ORION_OZYN_SOZU)}`);
  // Ham sorgu eki (`poz=2.6,9,180`, deneme parametreleri): senaryoların URL anahtarları env'e gerek duymadan verilebilsin.
  if (process.env.ORION_SORGU_EK) parcalar.push(process.env.ORION_SORGU_EK);
  // Model karşılaştırması için: aynı ölçüm düzeneği, farklı beyin.
  if (process.env.ORION_MODEL) parcalar.push(`model=${encodeURIComponent(process.env.ORION_MODEL)}`);
  // Sağlayıcı/adres/şifre de dışarıdan: kota dolunca başka bir sağlayıcıya
  // geçmek kod değişikliği gerektirmemeli.
  if (process.env.ORION_SAGLAYICI) parcalar.push(`saglayici=${encodeURIComponent(process.env.ORION_SAGLAYICI)}`);
  // Beyin seçimi: ORION_BEYIN=dis → başka bir dilde yazılmış beyne bağlan.
  if (process.env.ORION_BEYIN) parcalar.push(`beyin=${encodeURIComponent(process.env.ORION_BEYIN)}`);
  if (process.env.ORION_KAYIT === "1") parcalar.push("kayit=1");
  if (process.env.ORION_BEYIN_ADRES) parcalar.push(`beyinadres=${encodeURIComponent(process.env.ORION_BEYIN_ADRES)}`);
  // Ollama başka bir adreste koşuyorsa (Ollama'nın kendi OLLAMA_HOST'u)
  // renderer'daki tarama ve yerel beyinler de oraya gitsin.
  if (process.env.OLLAMA_HOST) parcalar.push(`ollama=${encodeURIComponent(ollamaAdresi(process.env.OLLAMA_HOST))}`);
  if (process.env.ORION_OPENCODE) parcalar.push(`opencode=${encodeURIComponent(process.env.ORION_OPENCODE)}`);
  if (process.env.OPENCODE_SERVER_PASSWORD) parcalar.push(`sifre=${encodeURIComponent(process.env.OPENCODE_SERVER_PASSWORD)}`);
  const sorgu = parcalar.length ? { search: `?${parcalar.join("&")}` } : {};
  const sunucu = process.env.VITE_DEV_SERVER_URL;
  if (GELISTIRME && sunucu) pencere.loadURL(sunucu + (sorgu.search ?? ""));
  else pencere.loadFile(path.join(KOK, "dist", "index.html"), sorgu);

  // Ekran dışı 3. monitör penceresi de bir pencere: ana pencere kapanınca YIKILMAZSA `window-all-closed` hiç gelmez ve uygulama arkada kalır.
  pencere.on("closed", () => { pencere = null; webMonitor.kapat(); });
}

// ---- pty ----------------------------------------------------------------

ipcMain.handle(CAGRI.ptyAc, (olay, istek) => {
  const id = `pty${++ptySayac}`;
  const kabuk = istek?.kabuk || varsayilanKabuk();
  const p = ptySpawn(kabuk, istek?.argv ?? kabukArgv(kabuk), {
    name: "xterm-256color",
    cols: Math.max(20, istek?.cols ?? 80),
    rows: Math.max(5,  istek?.rows ?? 24),
    cwd:  istek?.cwd || process.env.USERPROFILE || process.env.HOME || KOK,
    env:  { ...process.env, TERM: "xterm-256color", ORION_DUNYA: "1" },
  });

  const gonderen = olay.sender;
  p.onData((veri) => { if (!gonderen.isDestroyed()) gonderen.send(OLAY.ptyCikti, { id, veri }); });
  p.onExit(({ exitCode }) => {
    ptyler.delete(id);
    if (!gonderen.isDestroyed()) gonderen.send(OLAY.ptyBitti, { id, kod: exitCode });
  });

  ptyler.set(id, p);
  return id;
});

ipcMain.on(CAGRI.ptiYaz,   (_e, id, veri) => { ptyler.get(id)?.write(veri); });
ipcMain.on(CAGRI.ptyBoyut, (_e, id, cols, rows) => {
  try { ptyler.get(id)?.resize(Math.max(20, cols | 0), Math.max(5, rows | 0)); }
  catch (err) { console.warn("[pty] resize başarısız:", err?.message ?? err); }
});
ipcMain.on(CAGRI.ptyKapat, (_e, id) => {
  const p = ptyler.get(id);
  if (!p) return;
  ptyler.delete(id);
  try { p.kill(); } catch (err) { console.warn("[pty] kill başarısız:", err?.message ?? err); }
});

// ---- varlık çözümü -------------------------------------------------------
// Renderer dosya sistemi görmez. Yalnızca assets/ altı, yalnızca dosya adı.

ipcMain.handle(CAGRI.varlik, (_e, ad) => {
  if (typeof ad !== "string" || !ad || ad.includes("..") || path.isAbsolute(ad))
    throw new Error(`varlık adı geçersiz: ${String(ad)}`);
  const kok = path.join(KOK, "assets");
  const tam = path.resolve(kok, ad);
  if (!tam.startsWith(kok + path.sep)) throw new Error("varlık kök dizin dışında");
  if (!fs.existsSync(tam)) throw new Error(`varlık yok: ${ad}`);
  return tam;
});

// ---- karar kaydı (spec 08) --------------------------------------------------
// İçgüdü `kayit`: renderer her kararı `[KARAR] {json}` olarak konsola yazar,
// burada günlük dosyaya eklenir (userData/karar-kaydi/YYYY-MM-DD.jsonl).
// `ORION_KARAR_DOSYASI` ile tek dosyaya yönlendirilir: deneme koşuları kendi
// kaydını gerçek kullanımın kaydına karıştırmasın.
const KARAR_AYARI = {
  // Duman/senaryo koşusu (ORION_SMOKE) gerçek kullanımın kaydına yazmaz: ayrı klasör.
  kok: path.join(app.getPath("userData"), process.env.ORION_SMOKE === "1" ? "karar-kaydi-deneme" : "karar-kaydi"),
  sabitDosya: process.env.ORION_KARAR_DOSYASI || undefined,
};
const kararYazici = kararYaziciKur(KARAR_AYARI);
console.log(`[KARAR-DOSYASI] ${kararYazici.yol()}`);

// ÖĞRENEN KAPI (toplantı 2026-09-27 K5): renderer kural hafızasını açılışta
// kayıttaki öğretim satırlarından kurar. Okuma hatası "öğretim yok" SAYILMAZ
// ama Orion'u da durdurmaz: hafıza boş doğar ve hata görünür olur.
ipcMain.on(CAGRI.ogretimOku, (e) => {
  try { e.returnValue = ogretimleriOku(KARAR_AYARI); }
  catch (hata) {
    console.error(`[ogretim] okunamadi: ${hata?.message ?? hata}`);
    e.returnValue = [];
  }
});

// BECERİ REFLEKSİ (spec 10): renderer beceri defterini açılışta geçmiş oturumların
// görev satırlarından kurar. Seçimi renderer verir (mind/gorev.ts `GOREV_SATIRLARI`),
// süzme burada: IPC yalnız gerekeni taşır. Okuma hatası Orion'u durdurmaz: boş liste,
// hata görünür.
ipcMain.on(CAGRI.kayitSatirlariOku, (e, secim) => {
  try { e.returnValue = satirlariOku(KARAR_AYARI, secim); }
  catch (hata) {
    console.error(`[beceri] kayit satirlari okunamadi: ${hata?.message ?? hata}`);
    e.returnValue = [];
  }
});

// Öğretim dosyası izlenir: tools/ogret.ts bir ders eklediğinde, Orion'u yeniden
// başlatmadan canlı hafızaya ulaşsın (tek deneme gerçekten tek deneme olsun).
// `fs.watchFile` (yoklama) bilerek: dosya henüz yokken de çalışır ve Windows'ta
// `fs.watch`tan kararlı. Açılışta okunan satır izleyiciden de gelirse köprü
// onu bir kez uygular (bridge/kopru.ts `ogretimUygula`).
const OGRETIM_YOLU = ogretimYolu(KARAR_AYARI);
let ogretimKonum = fs.existsSync(OGRETIM_YOLU) ? fs.statSync(OGRETIM_YOLU).size : 0;
fs.watchFile(OGRETIM_YOLU, { interval: 1000 }, () => {
  const r = yeniSatirlar(OGRETIM_YOLU, ogretimKonum);
  ogretimKonum = r.konum;
  for (const s of r.satirlar) {
    if (s && s.tur === "ogretim" && pencere && !pencere.isDestroyed()) pencere.webContents.send(OLAY.ogretim, s);
  }
});
app.on("will-quit", () => fs.unwatchFile(OGRETIM_YOLU));

// ---- API anahtarlı beyin (spec 13 Faz 3) --------------------------------------
// Anahtar safeStorage (Windows: DPAPI) ile şifreli dosyada; renderer onu hiç görmez.
// Depo ilk IPC çağrısında kurulur: safeStorage `ready`den önce kullanılamaz.
// Bu bölüm anahtarı hiçbir yere BASMAZ; hata metinleri apiIstek.js'te maskelenir.
let anahtarDeposu = null;
// `ORION_ANAHTAR_DOSYASI`: deneme (apidene) gerçek anahtar dosyasına dokunmasın.
const anahtarlar = () => anahtarDeposu ??= anahtarDeposuKur({
  yol: process.env.ORION_ANAHTAR_DOSYASI || path.join(app.getPath("userData"), "anahtarlar.json"),
  sifreleyici: {
    kullanilabilir: () => safeStorage.isEncryptionAvailable(),
    sifrele: (m) => safeStorage.encryptString(m),
    coz: (b) => safeStorage.decryptString(b),
  },
});
ipcMain.handle(CAGRI.apiDurum, () => anahtarlar().durum());
ipcMain.handle(CAGRI.apiKaydet, (_e, ad, adres, anahtar) => anahtarlar().kaydet(ad, adres, anahtar));
ipcMain.handle(CAGRI.apiSil, (_e, ad) => anahtarlar().sil(ad));
ipcMain.handle(CAGRI.apiModeller, (_e, ad) => apiIstek({ depo: anahtarlar(), saglayici: ad, yol: "/models", zamanAsimiMs: 20_000 }));
ipcMain.handle(CAGRI.apiSohbet, (_e, ad, govde) => apiIstek({ depo: anahtarlar(), saglayici: ad, yol: "/chat/completions", govde }));

// ---- hafıza dosyası (spec 07 K4) -------------------------------------------
// Orion'un hafızası renderer'ın localStorage'ından buraya taşındı: tarayıcı
// profiline ve köke bağlı kalmasın, ölçüm araçları okuyabilsin, yedeklenebilsin.
// `ORION_HAFIZA_DOSYASI` ile yol değiştirilebilir (deneme/ölçüm için ayrı hafıza). Senaryo koşusu
// (ORION_SMOKE=1) gerçek hafızaya DOKUNMAZ, geçici dosyayla başlar (spec 16 F0, `hafizaYolu`).
const HAFIZA_YOLU = hafizaYolu(process.env, app.getPath("userData"), os.tmpdir());
if (HAFIZA_YOLU !== path.join(app.getPath("userData"), "orion-hafiza.json")) console.log(`[hafiza] dosya: ${HAFIZA_YOLU}`);
// Senaryonun geçici dosyası BOŞ hafıza olarak var edilir: yoksa renderer "dosya yok" görüp
// localStorage'daki ESKİ hafızayı ona göç ettirirdi (mind/hafizaGocu.ts) — yalıtım delinirdi.
if (process.env.ORION_SMOKE === "1" && !process.env.ORION_HAFIZA_DOSYASI) {
  try { hafizaDosyasiYaz(HAFIZA_YOLU, []); } catch (hata) { console.error(`[hafiza] senaryo dosyasi kurulamadi: ${hata?.message ?? hata}`); }
}

// Okuma senkron (`sendSync`): köprü depoyu kurucuda senkron okuyor (K7).
ipcMain.on(CAGRI.hafizaOku, (e) => {
  try { e.returnValue = hafizaDosyasiOku(HAFIZA_YOLU); }
  catch (hata) {
    // İzin hatası vb.: "yok" DEMEYİZ — öyle desek göç yanlış tetiklenir.
    console.error(`[hafiza] okunamadi: ${hata?.message ?? hata}`);
    e.returnValue = { durum: "hata", mesaj: String(hata?.message ?? hata) };
  }
});
// Tek yönlü: IPC mesajları tek renderer'dan SIRAYLA gelir, her biri atomik yazılır.
ipcMain.on(CAGRI.hafizaYaz, (_e, kayitlar) => {
  if (!Array.isArray(kayitlar)) return console.error("[hafiza] dizi olmayan yazim reddedildi");
  try { hafizaDosyasiYaz(HAFIZA_YOLU, kayitlar); }
  catch (hata) { console.error(`[hafiza] yazilamadi: ${hata?.message ?? hata}`); }
});
// Göç için: sonuç bilinmeden "taşındı" denemez.
ipcMain.on(CAGRI.hafizaYazSenkron, (e, kayitlar) => {
  try {
    if (!Array.isArray(kayitlar)) throw new Error("dizi degil");
    hafizaDosyasiYaz(HAFIZA_YOLU, kayitlar);
    e.returnValue = true;
  } catch (hata) {
    console.error(`[hafiza] goc yazimi basarisiz: ${hata?.message ?? hata}`);
    e.returnValue = false;
  }
});

// Sıkıştırma yedeği (spec 26 F3-C): hafıza dosyasının yanına tarih damgalı kopya, en son 5'i kalır.
ipcMain.on(CAGRI.hafizaYedekYaz, (e, kayitlar, tur) => {
  try {
    if (!Array.isArray(kayitlar)) throw new Error("dizi degil");
    const dizin = path.dirname(HAFIZA_YOLU), taban = path.basename(HAFIZA_YOLU, ".json");
    // "unut" (duvardan elle silme) KENDİ öneki ve sınırıyla: arka arkaya silmeler sıkıştırma yedeklerini (son 5) döndürüp atmasın.
    const onek = tur === "unut" ? "unut-yedek" : "yedek", sinir = tur === "unut" ? 100 : 5;
    hafizaDosyasiYaz(path.join(dizin, `${taban}.${onek}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), kayitlar);
    const eskiler = fs.readdirSync(dizin).filter((f) => f.startsWith(`${taban}.${onek}-`)).sort();
    for (const f of eskiler.slice(0, Math.max(0, eskiler.length - sinir))) fs.unlinkSync(path.join(dizin, f));
    e.returnValue = true;
  } catch (hata) {
    console.error(`[hafiza] yedek yazilamadi: ${hata?.message ?? hata}`);
    e.returnValue = false;
  }
});

// ---- durum defteri (spec 16 F2) ---------------------------------------------
// Konum, son iş, son konuşma: oturumlar arası kalıcı, hafızadan AYRI dosya (durum ≠ anı, spec 06 K2).
// Göç yok (yeni dosya); bozuksa hafızadaki gibi kenara taşınır ve defter boş başlar.
const DURUM_YOLU = durumYolu(process.env, app.getPath("userData"), os.tmpdir());
ipcMain.on(CAGRI.durumOku, (e) => {
  try { const d = hafizaDosyasiOku(DURUM_YOLU); e.returnValue = d.durum === "var" ? d.kayitlar : []; }
  catch (hata) { console.error(`[durum] okunamadi: ${hata?.message ?? hata}`); e.returnValue = []; }
});
ipcMain.on(CAGRI.durumYaz, (_e, kayitlar) => {
  if (!Array.isArray(kayitlar)) return console.error("[durum] dizi olmayan yazim reddedildi");
  try { hafizaDosyasiYaz(DURUM_YOLU, kayitlar); }
  catch (hata) { console.error(`[durum] yazilamadi: ${hata?.message ?? hata}`); }
});

// ---- md dosyaları (Yapı çubuğu · Hafıza sekmesi, spec 32) ------------------------
// Persona, anlık hafıza ve Ozyn'in notları: kullanıcı verisinde (repoda DEĞİL), düzenleyici penceresi renderer'da. Hata `kod`ları sonuç nesnesinde döner.
const MD_DIZINI = mdDizini(process.env, app.getPath("userData"), os.tmpdir());
try { const t = mdTohumla(MD_DIZINI); if (t.length) console.log(`[md] tohum dosyalar yazildi: ${t.join(", ")}`); }
catch (hata) { console.error(`[md] klasor hazirlanamadi: ${hata?.message ?? hata}`); }
const mdSar = (is) => { try { return { ok: true, deger: is() }; } catch (hata) { return { ok: false, kod: hata?.kod ?? "hata", mesaj: String(hata?.message ?? hata) }; } };
ipcMain.handle(CAGRI.mdListe, () => mdSar(() => mdListe(MD_DIZINI)));
ipcMain.handle(CAGRI.mdOku, (_e, ad) => mdSar(() => mdOku(MD_DIZINI, ad)));
ipcMain.handle(CAGRI.mdYaz, (_e, ad, metin) => mdSar(() => { mdYaz(MD_DIZINI, ad, metin); return true; }));
ipcMain.handle(CAGRI.mdYeni, (_e, ad, metin) => mdSar(() => { mdYeni(MD_DIZINI, ad, metin ?? ""); return true; }));
ipcMain.handle(CAGRI.mdAktif, (_e, ad, aktif) => mdSar(() => { mdAktifYap(MD_DIZINI, ad, aktif); return true; }));

// ---- MCP ucu (spec 05 Aşama 1) --------------------------------------------
// Odadaki `claude` buraya bağlanıp Orion'un bedenini sürer. İstekler IPC ile
// renderer'daki `bridge/mcpBeyin.ts`'e röle edilir — dünya orada yaşıyor.
// Uç yalnız 127.0.0.1'de; araç çağrıları burada ÇALIŞMAZ, köprüye gider ve
// onay kapısı dahil bütün korumalardan geçer. `ORION_MCP=0` ile kapatılır.
const mcpBekleyenler = new Map();
let mcpSira = 0;

function mcpRole(yontem, param, sinyal) {
  return new Promise((coz, reddet) => {
    if (!pencere || pencere.isDestroyed()) return reddet(new Error("dunya penceresi yok"));
    const id = ++mcpSira;
    mcpBekleyenler.set(id, { coz, reddet });
    pencere.webContents.send(OLAY.mcpIstek, { id, yontem, param });
    // Ajanın bağlantısı koptu (ajan öldü): bekleyen `dunya_bekle`yi renderer'da
    // iptal et — ETİKETLİ, yalnızca bu isteğinkini (bkz. McpBeyin.bekleIptal).
    sinyal?.addEventListener("abort", () => {
      if (!mcpBekleyenler.delete(id)) return;
      if (param?.name === "dunya_bekle" && pencere && !pencere.isDestroyed()) {
        pencere.webContents.send(OLAY.mcpIstek, { id: 0, yontem: "iptal", param: { id } });
      }
      reddet(new Error("istemci baglantiyi kopardi"));
    }, { once: true });
  });
}
ipcMain.on(CAGRI.mcpYanit, (_e, { id, sonuc, hata }) => {
  const b = mcpBekleyenler.get(id);
  if (!b) return;                  // süresi dolmuş istek: sessizce bırak
  mcpBekleyenler.delete(id);
  if (hata) b.reddet(new Error(hata)); else b.coz(sonuc);
});

let mcpUcu = null;
function mcpUcuBaslat() {
  if (process.env.ORION_MCP === "0") return;
  const port = Number(process.env.ORION_MCP_PORT || 4800);
  mcpUcu = mcpSunucuKur({
    port,
    role: mcpRole,
    // Yeni ajan oturumu → talimat yeniden gitsin. Aynı röle kanalı, cevap
    // beklenmez (id 0): yeni kanal = yeni preload ucu + yeni tip, kayma riski.
    oturumBasladi: () => {
      if (pencere && !pencere.isDestroyed()) pencere.webContents.send(OLAY.mcpIstek, { id: 0, yontem: "oturum", param: null });
    },
    // dunya_bekle en fazla 120 sn bekliyor; röle sınırı onun üstünde olmalı.
    // 25 sn'den uzatıldı (ölçüm): her "quiet" bir model turu ve ajan onu alınca
    // oturumu bitiriyordu — 25 sn'lik beklemeyle boşta saatte ~$3,4.
    releSiniriMs: 130_000,
  });
  mcpUcu.hazir.then(() => console.log(`[mcp] dunya ucu: http://127.0.0.1:${mcpUcu.port}/mcp`));
}

// ---- ses (Piper) ----------------------------------------------------------
// Kalıcı süreç: cümle başına yeni piper.exe açmak 1.2 sn model yüklemesi demek.
// Renderer'a YOL değil BAYT döndürülür — dev modda http://localhost'tan
// file:// okumak Chromium tarafından engelli.

const ses = new PiperSesi();

// ---- kulak (Nemotron Speech, mikrofon) ---------------------------------------
// Tembel: ilk "baslat"a kadar süreç açılmaz. Renderer'a yalnız çözülmüş metin gider.
const dinleyici = new Dinleyici((olay) => {
  if (pencere && !pencere.isDestroyed()) pencere.webContents.send(OLAY.dinleme, olay);
});
ipcMain.handle(CAGRI.dinleKomut, (_e, komut) => {
  if (komut === "baslat") { dinleyici.baslat(); return true; }
  if (komut === "kayit") return dinleyici.kayit();
  if (komut === "dur") return dinleyici.dur();
  if (komut === "kapat") { dinleyici.kapat(); return true; }
  return false;
});

// ---- ofisteki 3. monitör: groma haritası (host/webMonitor.js) --------------------------------
// Ekran dışı pencere sayfayı yükler, kareler renderer'a JPEG gider. Yalnız yerel adres (webMonitor.adresGecerliMi); ORION_GROMA_URL ile değişir.
const webMonitor = new WebMonitor((olay) => {
  if (pencere && !pencere.isDestroyed()) pencere.webContents.send(OLAY.webmonOlay, olay);
});
ipcMain.handle(CAGRI.webmonKomut, (_e, komut, yuk) => {
  if (komut === "ac") return webMonitor.ac(typeof yuk === "string" && yuk ? yuk : (process.env.ORION_GROMA_URL || GROMA_ADRESI));
  if (komut === "kapat") { webMonitor.kapat(); return true; }
  if (komut === "fare") return webMonitor.fare(yuk);
  return false;
});

ipcMain.handle(CAGRI.sesVarMi, () => ses.kullanilabilir());

ipcMain.handle(CAGRI.sesUret, async (_e, metin) => {
  const r = await ses.uret(metin);
  if (!r.ok) return { ok: false, hata: r.hata };
  try {
    const bayt = fs.readFileSync(r.yol);
    // Üretilen wav tek kullanımlık; okuduktan sonra diski şişirmesin.
    fs.unlink(r.yol, () => {});
    return { ok: true, ses: new Uint8Array(bayt) };
  } catch (err) {
    return { ok: false, hata: `wav okunamadı: ${err?.message ?? err}` };
  }
});

// ---- yaşam döngüsü --------------------------------------------------------

// ── Claude beyni adaptörü ─────────────────────────────────────────────────
//
// NEDEN BURADA. Zihin duvarındaki beyin seçicide Claude seçilemiyordu: seçenek
// `dis` diye anlaşılmaz bir adla duruyordu ve `tools/claude-beyin.ts`i AYRI bir
// terminalde elle başlatmak gerekiyordu. Başlatmadıysan `hazirMi()` düşüyor ve
// seçim sessizce reddediliyor — yani Ozyn için o seçenek hiç yoktu.
//
// Adaptör boşta bekleyen küçük bir Node süreci; `claude -p` yalnızca gerçekten
// düşünülürken çalışır. `ORION_CLAUDE_BEYIN=0` ile kapatılabilir.
let claudeBeyni = null;

function claudeBeyniBaslat() {
  if (process.env.ORION_CLAUDE_BEYIN === "0") return;
  const port = process.env.ORION_CLAUDE_PORT || "4700";
  try {
    claudeBeyni = spawn(
      process.execPath,
      ["--experimental-strip-types", path.join(KOK, "tools", "claude-beyin.ts"),
       `--port=${port}`, "--model=haiku",
       // Çıktı kipi (spec 26 F1): yapisal = tam araç yüzeyi (F0: Haiku beden 1/6 → 5/6); satir = eski 4 eylemli kip.
       `--mod=${process.env.ORION_CLAUDE_MOD || "yapisal"}`],
      { cwd: KOK, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } },
    );
    // Adaptörün sesi ana günlüğe düşsün: sessizce ölürse sebebi görünmeli.
    claudeBeyni.stdout.on("data", (d) => process.stdout.write(`[claude-beyin] ${d}`));
    claudeBeyni.stderr.on("data", (d) => process.stderr.write(`[claude-beyin] ${d}`));
    claudeBeyni.on("exit", (kod) => {
      if (kod !== 0 && kod !== null) console.warn(`[claude-beyin] cikti, kod=${kod}`);
      claudeBeyni = null;
    });
    console.log(`[claude-beyin] baslatildi, port ${port}`);
  } catch (e) {
    // Adaptör açılmazsa oda YİNE ÇALIŞIR — yalnızca o beyin seçeneği düşer.
    console.warn(`[claude-beyin] baslatilamadi: ${e?.message ?? e}`);
  }
}

// ── Ollama ────────────────────────────────────────────────────────────────
//
// Model seçici kurulu yerel modelleri açılışta tarıyor; Ollama kapalıysa
// burada başlatılır (host/ollamaSunucu.js). Pencere BEKLER, çünkü tarama
// pencere açılır açılmaz koşuyor — ama tavan 8 sn ve Ollama kurulu değilse
// ya da zaten ayaktaysa bekleme milisaniyeler. `ORION_OLLAMA=0` ile kapalı.
let ollama = null;

async function ollamaBaslat() {
  try {
    ollama = await ollamaHazirla({ spawn });
  } catch (e) {
    // ollamaHazirla fırlatmaz; yine de açılış hiçbir koşulda buna takılmasın.
    console.warn(`[ollama] hazirlanamadi: ${e?.message ?? e}`);
  }
}

app.whenReady().then(async () => {
  claudeBeyniBaslat();
  mcpUcuBaslat();
  await ollamaBaslat();
  return pencereAc();
});
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) pencereAc(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => {
  ses.kapat();
  dinleyici.kapat();
  webMonitor.kapat();
  for (const p of ptyler.values()) { try { p.kill(); } catch { /* kapanışta önemsiz */ } }
  ptyler.clear();
  // Adaptör bizim başlattığımız süreç: arkada kalıp portu tutmasın.
  if (claudeBeyni) { try { claudeBeyni.kill(); } catch { /* kapanışta önemsiz */ } claudeBeyni = null; }
  if (mcpUcu) { try { mcpUcu.kapat(); } catch { /* kapanışta önemsiz */ } mcpUcu = null; }
  // Yalnızca BİZİM başlattığımız Ollama kapanır; Ozyn'in açtığına dokunulmaz.
  if (ollama) { ollama.kapat(); ollama = null; }
});
