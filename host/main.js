// host/main.js — Electron ana süreç. Pencere + pty + varlık çözümü.
// ESM (package.json "type":"module"). Electron 44 ESM main destekler.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn as ptySpawn } from "node-pty";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { PiperSesi, piperBul } from "./ses.js";

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

function varsayilanKabuk() {
  if (process.platform === "win32") return process.env.COMSPEC ?? "powershell.exe";
  return process.env.SHELL ?? "/bin/bash";
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
    setTimeout(() => { console.log("[DUMAN] kabuk ayakta, kapatiliyor"); app.quit(); }, 16000);
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
  const p = ptySpawn(kabuk, istek?.argv ?? [], {
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

app.whenReady().then(pencereAc);
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) pencereAc(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => {
  ses.kapat();
  for (const p of ptyler.values()) { try { p.kill(); } catch { /* kapanışta önemsiz */ } }
  ptyler.clear();
});
