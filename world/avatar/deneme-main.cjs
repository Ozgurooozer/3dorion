// world/avatar/deneme-main.cjs — T2 deneme sahnesinin Electron koşucusu.
//
// `host/main.js` paralel şeflerin ortak dosyası; T2 kanıtı için ona ekran
// görüntüsü kancası eklemek yerine AYRI ve tek amaçlı bir ana süreç yazıldı.
// Yaptığı tek şey: pencereyi aç, renderer konsolunu stdout'a taşı, verilen
// sürede ekran görüntüsü al, kapan.
//
//   npx vite                                            (ayrı terminalde)
//   npx electron world/avatar/deneme-main.cjs
//   npx electron world/avatar/deneme-main.cjs --vrm=/yok.vrm --etiket=bozuk
"use strict";
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const argv = process.argv.slice(2);
const arg = (ad, varsayilan) => {
  const e = argv.find((a) => a.startsWith(`--${ad}=`));
  return e ? e.slice(ad.length + 3) : varsayilan;
};

const SUNUCU = arg("sunucu", "http://localhost:5273");
const VRM = arg("vrm", "");
const ETIKET = arg("etiket", "normal");
const YAKALAMA_MS = Number(arg("yakalama", "17000"));
const KOK = path.resolve(__dirname, "..", "..");

const sorgu = new URLSearchParams();
if (VRM) sorgu.set("vrm", VRM);
const KAMERA = arg("kamera", "");
if (KAMERA) sorgu.set("kamera", KAMERA);
sorgu.set("duman", String(Math.max(1000, YAKALAMA_MS - 500)));
const url = `${SUNUCU}/world/avatar/deneme.html${sorgu.toString() ? `?${sorgu}` : ""}`;

app.commandLine.appendSwitch("disable-gpu-vsync"); // FPS ölçümü tavana takılmasın

function pencereAc() {
  const pencere = new BrowserWindow({
    width: 1280, height: 800,
    backgroundColor: "#07070d",
    show: true,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });

  pencere.webContents.on("console-message", (_e, _sev, mesaj) => console.log(`[renderer] ${mesaj}`));
  pencere.webContents.on("did-fail-load", (_e, kod, acik) => {
    console.error(`[hata] sayfa yüklenemedi (${kod}): ${acik} — vite çalışıyor mu? ${SUNUCU}`);
  });

  console.log(`[kosucu] yükleniyor: ${url}`);
  pencere.loadURL(url);

  setTimeout(async () => {
    try {
      const kare = await pencere.webContents.capturePage();
      const dosya = path.join(KOK, "world", "avatar", `t2-${ETIKET}.png`);
      fs.writeFileSync(dosya, kare.toPNG());
      console.log(`[kosucu] ekran görüntüsü: ${dosya}`);
    } catch (err) {
      console.error("[kosucu] ekran görüntüsü alınamadı:", err && err.message ? err.message : err);
    }
    setTimeout(() => app.quit(), 800);
  }, YAKALAMA_MS);
}

app.whenReady().then(pencereAc);
app.on("window-all-closed", () => app.quit());
