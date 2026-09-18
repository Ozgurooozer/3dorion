// host/main.js — Electron ana süreç. Pencere + pty + varlık çözümü.
// ESM (package.json "type":"module"). Electron 44 ESM main destekler.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn as ptySpawn } from "node-pty";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { PiperSesi, piperBul } from "./ses.js";
import { hafizaDosyasiOku, hafizaDosyasiYaz } from "./hafizaDosyasi.js";

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
  pencere.webContents.on("console-message", (_e, _sev, mesaj) => console.log(`[renderer] ${mesaj}`));

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
  if (process.env.ORION_TAHTADENE === "1") parcalar.push("tahtadene=1", "sessiz=1");
  if (process.env.ORION_TAHTABEYIN === "1") parcalar.push("tahtabeyin=1", "sessiz=1");
  if (process.env.ORION_ONAYDENE === "1") parcalar.push("onaydene=1", "sessiz=1");
  if (process.env.ORION_TEZDENE === "1") parcalar.push("tezdene=1", "sessiz=1");
  if (process.env.ORION_ZIHINDENE === "1") parcalar.push("zihindene=1", "sessiz=1");
  if (process.env.ORION_ADMINDENE === "1") parcalar.push("admindene=1", "sessiz=1");
  if (process.env.ORION_GORDENE === "1") parcalar.push("gordene=1", "sessiz=1");
  if (process.env.ORION_SENARYODENE === "1") parcalar.push("senaryodene=1", "sessiz=1");
  if (process.env.ORION_SAGLOBDENE === "1") parcalar.push("saglobdene=1", "sessiz=1");
  if (process.env.ORION_ACIDENE === "1") parcalar.push("acidene=1", "sessiz=1");
  if (process.env.ORION_BAKDENE === "1") parcalar.push("bakdene=1", "sessiz=1");
  if (process.env.ORION_ZOOMDENE === "1") parcalar.push("zoomdene=1", "sessiz=1");
  if (process.env.ORION_ZOOM) parcalar.push(`zoom=${encodeURIComponent(process.env.ORION_ZOOM)}`);
  if (process.env.ORION_FPS === "1") parcalar.push("fps=1");
  if (process.env.ORION_RAKIP === "1") parcalar.push("rakip=1");
  if (process.env.ORION_GECMIS) parcalar.push(`gecmis=${process.env.ORION_GECMIS}`);
  // Senaryosuz canlı denemede TTS'i kapatmak için (Ozyn'in hoparlöründen ses çıkmasın).
  if (process.env.ORION_SESSIZ === "1") parcalar.push("sessiz=1");
  // İnisiyatif canlı denemesi: sessizlik eşiği ve refrakter N saniyeye iner.
  if (process.env.ORION_INISIYATIF_SN) parcalar.push(`inisiyatifsn=${encodeURIComponent(process.env.ORION_INISIYATIF_SN)}`);
  // Model karşılaştırması için: aynı ölçüm düzeneği, farklı beyin.
  if (process.env.ORION_MODEL) parcalar.push(`model=${encodeURIComponent(process.env.ORION_MODEL)}`);
  // Sağlayıcı/adres/şifre de dışarıdan: kota dolunca başka bir sağlayıcıya
  // geçmek kod değişikliği gerektirmemeli.
  if (process.env.ORION_SAGLAYICI) parcalar.push(`saglayici=${encodeURIComponent(process.env.ORION_SAGLAYICI)}`);
  // Beyin seçimi: ORION_BEYIN=dis → başka bir dilde yazılmış beyne bağlan.
  if (process.env.ORION_BEYIN) parcalar.push(`beyin=${encodeURIComponent(process.env.ORION_BEYIN)}`);
  if (process.env.ORION_KAYIT === "1") parcalar.push("kayit=1");
  if (process.env.ORION_BEYIN_ADRES) parcalar.push(`beyinadres=${encodeURIComponent(process.env.ORION_BEYIN_ADRES)}`);
  if (process.env.ORION_OPENCODE) parcalar.push(`opencode=${encodeURIComponent(process.env.ORION_OPENCODE)}`);
  if (process.env.OPENCODE_SERVER_PASSWORD) parcalar.push(`sifre=${encodeURIComponent(process.env.OPENCODE_SERVER_PASSWORD)}`);
  const sorgu = parcalar.length ? { search: `?${parcalar.join("&")}` } : {};
  const sunucu = process.env.VITE_DEV_SERVER_URL;
  if (GELISTIRME && sunucu) pencere.loadURL(sunucu + (sorgu.search ?? ""));
  else pencere.loadFile(path.join(KOK, "dist", "index.html"), sorgu);

  pencere.on("closed", () => { pencere = null; });
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

// ---- hafıza dosyası (spec 07 K4) -------------------------------------------
// Orion'un hafızası renderer'ın localStorage'ından buraya taşındı: tarayıcı
// profiline ve köke bağlı kalmasın, ölçüm araçları okuyabilsin, yedeklenebilsin.
// `ORION_HAFIZA_DOSYASI` ile yol değiştirilebilir (deneme/ölçüm için ayrı hafıza).
const HAFIZA_YOLU = process.env.ORION_HAFIZA_DOSYASI
  || path.join(app.getPath("userData"), "orion-hafiza.json");

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

// ---- ses (Piper) ----------------------------------------------------------
// Kalıcı süreç: cümle başına yeni piper.exe açmak 1.2 sn model yüklemesi demek.
// Renderer'a YOL değil BAYT döndürülür — dev modda http://localhost'tan
// file:// okumak Chromium tarafından engelli.

const ses = new PiperSesi();

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
       `--port=${port}`, "--model=haiku"],
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

app.whenReady().then(() => { claudeBeyniBaslat(); return pencereAc(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) pencereAc(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => {
  ses.kapat();
  for (const p of ptyler.values()) { try { p.kill(); } catch { /* kapanışta önemsiz */ } }
  ptyler.clear();
  // Adaptör bizim başlattığımız süreç: arkada kalıp portu tutmasın.
  if (claudeBeyni) { try { claudeBeyni.kill(); } catch { /* kapanışta önemsiz */ } claudeBeyni = null; }
});
