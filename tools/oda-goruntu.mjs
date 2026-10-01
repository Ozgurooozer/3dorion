// tools/oda-goruntu.mjs — Oda deneme sayfasının sabit açılardan ekran görüntüsünü alır.
//
// Neden: odanın görünüş değişikliği ancak görüntüyle doğrulanır, ve "önce/sonra"
// aynı kamera açılarından alınmazsa karşılaştırılamaz. Tam uygulamayı (Electron +
// beyin) açmaz: karar kaydına satır yazmaz, açık olan Orion'la çakışmaz.
//
// Kullanım (önce `npx vite --port 5273` ayakta olmalı):
//   node tools/oda-goruntu.mjs <çıktı-klasörü> [aci1 aci2 …]   (varsayılan: referans giris masa tahta)
// Her açı için <klasör>/<aci>.png yazar ve sayfanın ölçüm satırını (fps, çizim, mesh) basar.
// Sayfa 30 sn içinde "hazir" demezse o açı HATA ile biter — sessizce boş görüntü yazılmaz.
"use strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error("Chrome/Edge bulunamadı");

const [cikti, ...secilen] = process.argv.slice(2);
if (!cikti) throw new Error("kullanım: node tools/oda-goruntu.mjs <çıktı-klasörü> [açı…]");
const acilar = secilen.length ? secilen : ["referans", "giris", "masa", "tahta"];
const ADRES = process.env.ODA_ADRES ?? "http://localhost:5273/world/level/oda-deneme.html";
const PORT = 9333;

fs.mkdirSync(cikti, { recursive: true });
const profil = fs.mkdtempSync(path.join(os.tmpdir(), "oda-goruntu-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`,
  "--window-size=1280,720", "--hide-scrollbars", "--ignore-gpu-blocklist", "about:blank",
], { stdio: "ignore" });

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

async function hedefAl() {
  for (let i = 0; i < 50; i++) {
    try {
      const liste = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const sayfa = liste.find((t) => t.type === "page");
      if (sayfa) return sayfa.webSocketDebuggerUrl;
    } catch { /* henüz açılmadı */ }
    await bekle(200);
  }
  throw new Error("Chrome hata ayıklama portu açılmadı");
}

function cdp(url) {
  const ws = new WebSocket(url);
  let sira = 0;
  const bekleyen = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && bekleyen.has(m.id)) {
      const { coz, red } = bekleyen.get(m.id);
      bekleyen.delete(m.id);
      m.error ? red(new Error(m.error.message)) : coz(m.result);
    }
  };
  const acik = new Promise((r) => { ws.onopen = r; });
  return {
    acik,
    gonder: (method, params = {}) => new Promise((coz, red) => {
      const id = ++sira;
      bekleyen.set(id, { coz, red });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    kapat: () => ws.close(),
  };
}

let hata = 0;
try {
  const c = cdp(await hedefAl());
  await c.acik;
  for (const aci of acilar) {
    await c.gonder("Page.navigate", { url: `${ADRES}?aci=${encodeURIComponent(aci)}` });
    let baslik = "";
    for (let i = 0; i < 150 && !baslik.startsWith("hazir"); i++) {
      await bekle(200);
      baslik = (await c.gonder("Runtime.evaluate", { expression: "document.title", returnByValue: true })).result.value ?? "";
    }
    if (!baslik.startsWith("hazir")) {
      console.error(`HATA ${aci}: sayfa 30 sn içinde hazır olmadı (başlık: "${baslik}")`);
      hata++;
      continue;
    }
    const { data } = await c.gonder("Page.captureScreenshot", { format: "png" });
    const dosya = path.join(cikti, `${aci}.png`);
    fs.writeFileSync(dosya, Buffer.from(data, "base64"));
    console.log(`${dosya}  ${baslik.slice("hazir ".length)}`);
  }
  c.kapat();
} finally {
  chrome.kill();
}
process.exitCode = hata ? 1 : 0;
