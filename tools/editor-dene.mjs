// tools/editor-dene.mjs — Level editörünün (spec 22) canlı denemesi: başsız Chrome + GERÇEK fare/klavye olayları.
//
//   npm run dev   (ayrı uçbirimde; :5273)
//   node tools/editor-dene.mjs            → etkileşim denemeleri (seç, yüzeyde sürükle, gizmo, geri/ileri al, çoğalt,
//                                           kutu seç, grupla, yerleştir, çatıya koy, fırça + silgi, ölç, güneş,
//                                           hazır yapı kaydet/yerleştir, uçuş kipi, yardım)
//   node tools/editor-dene.mjs --olc      → ölçüm (1920×1080, kare sınırı kapalı): taban / 200 nesne / 50 seçili /
//                                           gizmo sürüklerken — fps ve kare başına çizim çağrısı
//   EDITOR_SS=<klasör>                    → her adımın ekran görüntüsü
// Level dosyasına YAZMAZ (Ctrl+S basılmaz); hazır yapı denemesi kendi dosyasını siler. Çıkış kodu: başarısız adım
// sayısı (0 = hepsi geçti) — çıktı metninde anahtar kelime aranmaz.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ADRES = process.env.EDITOR_ADRES ?? "http://localhost:5273/world/level/ova-deneme.html?aci=tepe";
const OLC = process.argv.includes("--olc");
const SS = process.env.EDITOR_SS ?? null;
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const HAZIR_KLASORU = path.resolve("world/level/hazir");
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// ── başsız Chrome + CDP ──
const [en, boy] = OLC ? [1920, 1080] : [1600, 900];
const port = 9300 + Math.floor(Math.random() * 400);
const profil = fs.mkdtempSync(path.join(os.tmpdir(), "editor-dene-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, `--window-size=${en},${boy}`,
  "--ignore-gpu-blocklist", "--hide-scrollbars", ...(OLC ? ["--disable-frame-rate-limit", "--disable-gpu-vsync"] : []), "about:blank"], { stdio: "ignore" });
let wsAdres;
for (let i = 0; i < 60 && !wsAdres; i++) {
  try { wsAdres = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* açılıyor */ }
  await bekle(200);
}
if (!wsAdres) { console.error("Chrome açılmadı"); chrome.kill(); process.exit(99); }
const ws = new WebSocket(wsAdres);
let sira = 0;
const bekleyen = new Map(), loglar = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m); bekleyen.delete(m.id); }
  else if (m.method === "Runtime.exceptionThrown") loglar.push(`İSTİSNA ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") loglar.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
};
await new Promise((r) => { ws.onopen = r; });
const g = (method, params = {}) => new Promise((r) => { const i = ++sira; bekleyen.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const deg = async (ifade) => {
  const r = await g("Runtime.evaluate", { expression: ifade, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "değerlendirme hatası");
  return r.result?.result?.value;
};
const SHIFT = 8, CTRL = 2;
const tus = async (code, key, vk, mod = 0) => {
  await g("Input.dispatchKeyEvent", { type: "rawKeyDown", code, key, windowsVirtualKeyCode: vk, modifiers: mod }); await bekle(60);
  await g("Input.dispatchKeyEvent", { type: "keyUp", code, key, windowsVirtualKeyCode: vk, modifiers: mod }); await bekle(80);
};
const fare = (type, x, y, mod = 0, buttons = type === "mouseMoved" ? 0 : 1) => g("Input.dispatchMouseEvent", { type, x, y, button: "left", modifiers: mod, clickCount: 1, buttons });
const tikla = async (x, y, mod = 0) => { await fare("mouseMoved", x, y, mod); await fare("mousePressed", x, y, mod); await bekle(40); await fare("mouseReleased", x, y, mod); await bekle(120); };
const surukle = async (x0, y0, x1, y1, adim = 14, mod = 0) => {
  await fare("mouseMoved", x0, y0, mod); await fare("mousePressed", x0, y0, mod); await bekle(60);
  for (let i = 1; i <= adim; i++) { await fare("mouseMoved", x0 + ((x1 - x0) * i) / adim, y0 + ((y1 - y0) * i) / adim, mod, 1); await bekle(30); }
  await fare("mouseReleased", x1, y1, mod); await bekle(150);
};
let ssSira = 0;
const ekran = async (ad) => {
  if (!SS) return;
  fs.mkdirSync(SS, { recursive: true });
  const r = await g("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(SS, `${String(++ssSira).padStart(2, "0")}-${ad}.png`), Buffer.from(r.result.data, "base64"));
};

await g("Runtime.enable");
await g("Page.navigate", { url: ADRES });
for (let i = 0; i < 90; i++) { if (String(await deg("document.title").catch(() => "")).startsWith("hazir")) break; await bekle(500); }
const baslik = await deg("document.title");
if (!String(baslik).startsWith("hazir")) { console.error(`sayfa hazır olmadı: ${baslik}`); ws.close(); chrome.kill(); process.exit(98); }
await deg("window.ova.level.nesneler.hazir()");

// Sayfa içi yardımcılar: nesnenin ekran konumu (kutu ortası ya da tepe), seçim pivotu ve +X yönü.
await deg(`window.__d = {
  ekranda(c){ const t=ova.editor.tuval, r=t.getBoundingClientRect(), V=ova.kamera.position.constructor, M=ova.sahne.getTransformMatrix().constructor;
    const p=V.Project(new V(c[0],c[1],c[2]), M.Identity(), ova.sahne.getTransformMatrix(), ova.kamera.viewport.toGlobal(t.clientWidth,t.clientHeight)); return [r.left+p.x, r.top+p.y]; },
  kutu(id){ return ova.editor.kutular([id]).get(id); },
  orta(id){ const k=this.kutu(id); return this.ekranda([(k.min[0]+k.max[0])/2,(k.min[1]+k.max[1])/2,(k.min[2]+k.max[2])/2]); },
  tepe(id){ const k=this.kutu(id); return { ekran: this.ekranda([(k.min[0]+k.max[0])/2,k.max[1],(k.min[2]+k.max[2])/2]), y: k.max[1] }; },
  pivotOku(){ const ds=ova.editor.durum.secim().map(i=>ova.level.nesneler.dugum(i)); const V=ds[0].position.constructor;
    const c=ds.reduce((a,d)=>a.add(d.position),V.Zero()).scale(1/ds.length); const a=this.ekranda([c.x,c.y,c.z]), b=this.ekranda([c.x+1,c.y,c.z]);
    const l=Math.hypot(b[0]-a[0],b[1]-a[1]); return { p:a, y:[(b[0]-a[0])/l,(b[1]-a[1])/l] }; },
};`);
const T = () => deg("ova.editor.durum.tanim()");
const secim = () => deg("[...ova.editor.durum.secim()]");
const say = async () => (await T()).nesneler.length;
const sonuclar = [];
const kontrol = (ad, kosul, ek = "") => { sonuclar.push({ ad, kosul: !!kosul }); console.log(`${kosul ? "✔" : "✖"} ${ad}${ek ? ` — ${ek}` : ""}`); };

async function etkilesim() {
  await ekran("acilis");
  const ilkYukleme = await deg("ova.level.nesneler.yuklemeSayisi()");
  // seç + yüzeyde sürükle
  const o = await deg(`__d.orta("n2")`);
  await tikla(o[0], o[1]);
  const sid = (await secim())[0];
  kontrol("tık: imlecin altındaki (öndeki) nesne seçilir", (await secim()).length === 1, sid);
  const once = (await T()).nesneler.find((n) => n.id === sid).konum;
  await surukle(o[0], o[1], o[0] + 160, o[1] + 40, 16);
  const sonra = (await T()).nesneler.find((n) => n.id === sid).konum;
  kontrol("sürükle: yüzeyde kayar", Math.hypot(sonra[0] - once[0], sonra[2] - once[2]) > 1, `${once} → ${sonra}`);
  const alt = await deg(`ova.editor.yuzey.altindaki(${sonra[0]}, ${sonra[2]}, ${sonra[1]} + 0.5, new Set(["${sid}"]))`);
  kontrol("sürükle: tabanı alttaki yüzeye oturur", Math.abs(sonra[1] - alt) < 0.01, `y=${sonra[1]} yüzey=${alt.toFixed(3)}`);
  kontrol("sürükle: x/z 1 m ızgarada", Number.isInteger(sonra[0]) && Number.isInteger(sonra[2]));
  kontrol("sürükle: yeniden yükleme yok", (await deg("ova.level.nesneler.yuklemeSayisi()")) === ilkYukleme);
  await ekran("suruklendi");
  await tus("KeyZ", "z", 90, CTRL);
  kontrol("Ctrl+Z: sürükleme tek adımda geri", JSON.stringify((await T()).nesneler.find((n) => n.id === sid).konum) === JSON.stringify(once));
  await tus("KeyY", "y", 89, CTRL);
  kontrol("Ctrl+Y: ileri al", JSON.stringify((await T()).nesneler.find((n) => n.id === sid).konum) === JSON.stringify(sonra));
  // çoğalt / sil
  const n0 = await say();
  await tus("KeyD", "d", 68, CTRL);
  kontrol("Ctrl+D: çoğaltır, kopya seçili", (await say()) === n0 + 1 && !(await secim()).includes(sid));
  await tus("Delete", "Delete", 46);
  kontrol("Del: siler", (await say()) === n0);
  // kutu seçimi + grupla
  const tv = await deg("(()=>{const r=ova.editor.tuval.getBoundingClientRect(); return [r.left, r.top, r.width, r.height];})()");
  // Yuvalar tuvalin üstünde: sahnenin görünen ortası (sol 300, sağ 280, alt 210 yuva varsayılanı) içinde çapraz sürükle.
  await surukle(tv[0] + 330, tv[1] + 80, tv[0] + tv[2] - 310, tv[1] + tv[3] - 260, 10);
  const kutu = await secim();
  kontrol("kutu seçimi: birden çok nesne", kutu.length >= 3, `${kutu.length}`);
  await tus("KeyG", "g", 71, CTRL);
  const t6 = await T();
  kontrol("Ctrl+G: grup", (t6.gruplar ?? []).length === 1 && t6.nesneler.filter((n) => n.grup === t6.gruplar[0].id).length === kutu.length);
  // gizmo X oku
  await tus("Digit2", "2", 50);
  kontrol("2: taşı aracı", (await deg("ova.editor.durum.arac()")) === "tasi");
  await bekle(250);
  await ekran("gizmo");
  const ok = await deg("__d.pivotOku()");
  const uc = [ok.p[0] + ok.y[0] * 48, ok.p[1] + ok.y[1] * 48];
  const xOnce = (await T()).nesneler.filter((n) => n.grup).map((n) => n.konum[0]);
  await fare("mouseMoved", uc[0], uc[1]); await bekle(200);
  await surukle(uc[0], uc[1], uc[0] + ok.y[0] * 120, uc[1] + ok.y[1] * 120, 14);
  const farklar = (await T()).nesneler.filter((n) => n.grup).map((n, i) => +(n.konum[0] - xOnce[i]).toFixed(3));
  kontrol("gizmo X oku: hepsi aynı kadar, ızgara katı", farklar.every((f) => f === farklar[0] && f !== 0 && Number.isInteger(f)), JSON.stringify(farklar.slice(0, 3)));
  await tus("KeyZ", "z", 90, CTRL);
  kontrol("gizmo sürüklemesi tek Ctrl+Z ile geri", JSON.stringify((await T()).nesneler.filter((n) => n.grup).map((n) => n.konum[0])) === JSON.stringify(xOnce));
  await tus("Escape", "Escape", 27);
  kontrol("Esc: seçimi bırakır", (await secim()).length === 0);
  await tus("Digit1", "1", 49);
  // çatıya koy
  const cati = await deg(`__d.tepe("n3")`);
  const koni = await deg(`ova.editor.katalog().then(k=>(k.varliklar.find(v=>/cone/i.test(v.ad))??k.varliklar.find(v=>v.kategori==="esya")).ad)`);
  await deg(`ova.editor.yerlestirmeyeBasla({tur:"varlik", ad:${JSON.stringify(koni)}})`);
  await bekle(1200);
  await fare("mouseMoved", cati.ekran[0], cati.ekran[1] + 6); await bekle(300);
  await ekran("hayalet-cati");
  await tikla(cati.ekran[0], cati.ekran[1] + 6);
  await tus("Escape", "Escape", 27);
  const konan = (await T()).nesneler.at(-1);
  kontrol("yerleştir: çatıya oturur (üst üste koyma)", konan.varlik === koni && Math.abs(konan.konum[1] - cati.y) < 0.6, `y=${konan.konum[1]} çatı=${cati.y.toFixed(2)}`);
  kontrol("Esc: yerleştirme biter", !(await deg("!!ova.editor.yerlestiriliyor()")));
  // fırça + silgi
  await tus("Digit6", "6", 54);
  const firca = await deg(`ova.editor.katalog().then(k=>k.varliklar.filter(v=>v.kategori==="esya").slice(0,2).map(v=>v.ad))`);
  for (const ad of firca) await deg(`[...document.querySelectorAll(".ed-vt .kart")].find(k=>k.title.startsWith(${JSON.stringify(ad)}))?.click()`);
  kontrol("fırça kipinde kart tıklaması fırçaya ekler", JSON.stringify(await deg("ova.editor.durum.ayarlar().firca.varliklar")) === JSON.stringify(firca));
  const f0 = await say();
  const y = tv[1] + tv[3] * 0.62;
  await surukle(tv[0] + tv[2] * 0.35, y, tv[0] + tv[2] * 0.62, y, 20);
  await deg("ova.level.nesneler.hazir()");
  const f1 = await say();
  kontrol("fırça: vuruş serpiştirir", f1 > f0 + 3, `${f0} → ${f1}`);
  await ekran("firca");
  await surukle(tv[0] + tv[2] * 0.35, y, tv[0] + tv[2] * 0.62, y, 20, SHIFT);
  kontrol("fırça: Shift silgi siler", (await say()) < f1, `${f1} → ${await say()}`);
  await tus("KeyZ", "z", 90, CTRL); await tus("KeyZ", "z", 90, CTRL);
  kontrol("fırça: her vuruş tek geri al adımı", (await say()) === f0);
  await deg(`ova.editor.durum.ayarDegistir(a=>({...a, firca:{...a.firca, varliklar:[]}}))`);
  // ölç
  await tus("Digit9", "9", 57);
  await tikla(tv[0] + tv[2] * 0.4, tv[1] + tv[3] * 0.6); await fare("mouseMoved", tv[0] + tv[2] * 0.6, tv[1] + tv[3] * 0.6); await bekle(80);
  await tikla(tv[0] + tv[2] * 0.6, tv[1] + tv[3] * 0.6);
  const olcu = await deg("ova.editor.durum.sonMesaj().metin");
  kontrol("ölç: iki tık mesafe", /^ölçü \d+\.\d+ m/.test(olcu), olcu);
  await tus("Escape", "Escape", 27);
  // güneş (ova'da zaman tanımlı → saat)
  await tus("Digit8", "8", 56);
  const s0 = (await T()).zaman?.saat;
  await surukle(tv[0] + tv[2] * 0.4, tv[1] + 120, tv[0] + tv[2] * 0.6, tv[1] + 120, 10);
  const s1 = (await T()).zaman?.saat;
  kontrol("güneş: sürükleme saati değiştirir", s1 !== s0, `${s0} → ${s1}`);
  await tus("KeyZ", "z", 90, CTRL);
  await tus("Digit1", "1", 49);
  // hazır yapı
  const ad = `deneme-${Date.now() % 100000}`;
  await deg(`ova.editor.durum.secimAyarla(["n2","n3","n4"])`);
  await bekle(300);
  await deg(`(()=>{const i=[...document.querySelectorAll("#ed-sag input[type=text]")].find(x=>x.placeholder.startsWith("ad (ör.")); i.value=${JSON.stringify(ad)};
    [...document.querySelectorAll("#ed-sag button")].find(b=>b.textContent==="Kaydet" && b.title.includes("hazır")).click();})()`);
  await bekle(800);
  const liste = await (await fetch(new URL("/__level/hazir", ADRES))).json();
  kontrol("hazır yapı: kaydedilir", liste.includes(ad));
  await deg(`[...document.querySelectorAll(".ed-vt .ed-sekme")].find(b=>b.textContent==="Hazır yapılar").click()`);
  await bekle(800);
  await deg(`[...document.querySelectorAll(".ed-vt .kart")].find(k=>k.textContent.includes(${JSON.stringify(ad)}))?.click()`);
  await bekle(1500);
  const h0 = await say();
  await fare("mouseMoved", tv[0] + tv[2] * 0.5, tv[1] + tv[3] * 0.62); await bekle(300);
  await tikla(tv[0] + tv[2] * 0.5, tv[1] + tv[3] * 0.62);
  await tus("Escape", "Escape", 27);
  kontrol("hazır yapı: yerleştirilince 3 nesne", (await say()) === h0 + 3);
  await deg(`[...document.querySelectorAll(".ed-vt .ed-sekme")].find(b=>b.textContent==="Varlıklar").click()`);
  fs.rmSync(path.join(HAZIR_KLASORU, `${ad}.hazir.json`), { force: true });
  try { fs.rmdirSync(HAZIR_KLASORU); } catch { /* başka hazır yapı var */ }
  // uçuş kipi + yardım
  await tus("Tab", "Tab", 9);
  kontrol("Tab: uçuş kipi, arayüz gizli", (await deg("ova.editor.durum.kip()")) === "ucus" && await deg("document.body.classList.contains('ed-ucus')"));
  await ekran("ucus");
  await tus("Tab", "Tab", 9);
  await tus("F1", "F1", 112);
  kontrol("F1: kısayol kartı", await deg("document.getElementById('ed-yardim').classList.contains('acik')"));
  await ekran("yardim");
  await tus("F1", "F1", 112);
  kontrol("kirli işareti (kaydedilmedi)", await deg("ova.editor.durum.kirli()"));
  kontrol("sayfada hata yok", loglar.length === 0, loglar.slice(0, 3).join(" | "));
}

/** Kare başına çizim çağrısı + fps (WebGL çizim çağrılarını sayar; 3 sn). */
async function olc(ad, surerken = null) {
  await deg(`(()=>{ if (window.__olc) return; const gl=ova.editor.tuval.getContext("webgl2"); const s={cagri:0};
    for (const f of ["drawElements","drawArrays","drawElementsInstanced","drawArraysInstanced"]) { const asil=gl[f].bind(gl); gl[f]=(...a)=>{ s.cagri++; return asil(...a); }; }
    window.__olc = s; })()`);
  await deg(`(()=>{ window.__olc.cagri=0; window.__olc.kare=0; window.__olc.bas=performance.now(); const say=()=>{ window.__olc.kare++; if (window.__olc.bas) requestAnimationFrame(say); }; requestAnimationFrame(say); })()`);
  if (surerken) await surerken(); else await bekle(3000);
  const r = await deg(`(()=>{ const s=window.__olc, sn=(performance.now()-s.bas)/1000; s.bas=0; return { fps: s.kare/sn, cizim: s.cagri/Math.max(1,s.kare) }; })()`);
  console.log(`[ÖLÇÜLDÜ] ${ad.padEnd(34)} fps ${r.fps.toFixed(0).padStart(4)} · çizim/kare ${r.cizim.toFixed(0)}`);
  return r;
}

async function olcum() {
  await bekle(1500);
  await olc("taban (8 nesne, seçim yok)");
  await deg(`ova.editor.durum.kipAyarla("ucus")`); await bekle(500);
  await olc("uçuş kipi (arayüz/ızgara/vurgu yok)");
  await deg(`ova.editor.durum.kipAyarla("editor")`);
  // 200 nesne: 4 varlıktan ızgarada, ovanın ortasında.
  await deg(`ova.editor.katalog().then(k=>{ const v=k.varliklar.filter(x=>x.kategori==="esya").slice(0,4).map(x=>x.ad);
    ova.editor.durum.degistir(t=>{ const l=[...t.nesneler]; for(let i=0;i<192;i++){ const x=-20+(i%16)*3, z=-25+Math.floor(i/16)*3; l.push({id:"o"+i, varlik:v[i%4], konum:[x, ova.level.yukseklik(x,z), z], donus:(i*37)%360, olcek:1}); } return {...t, nesneler:l}; }, "ölçüm: 192 nesne"); })`);
  await deg("ova.level.nesneler.hazir()"); await bekle(1500);
  await olc("200 nesne, seçim yok");
  await deg(`ova.editor.durum.secimAyarla(Array.from({length:50},(_, i)=>"o"+i))`); await bekle(800);
  await olc("200 nesne, 50 seçili (dış hat)");
  await tus("Digit2", "2", 50); await bekle(400);
  const ok = await deg("__d.pivotOku()");
  const uc = [ok.p[0] + ok.y[0] * 48, ok.p[1] + ok.y[1] * 48];
  await fare("mouseMoved", uc[0], uc[1]); await bekle(200);
  await olc("200 nesne, 50 seçili, gizmo sürüklerken", async () => {
    await fare("mousePressed", uc[0], uc[1]); await bekle(60);
    for (let i = 1; i <= 60; i++) { await fare("mouseMoved", uc[0] + ok.y[0] * i * 3, uc[1] + ok.y[1] * i * 3, 0, 1); await bekle(45); }
    await fare("mouseReleased", uc[0] + ok.y[0] * 180, uc[1] + ok.y[1] * 180);
  });
  const t0 = performance.now();
  await deg(`ova.editor.durum.geriAl()`);
  console.log(`[ÖLÇÜLDÜ] geri al (200 nesnelik level, 50 nesne dönüşümü): ${(performance.now() - t0).toFixed(0)} ms (CDP gidiş-dönüş dahil)`);
  kontrol("ölçüm sırasında sayfa hatası yok", loglar.length === 0, loglar.slice(0, 3).join(" | "));
}

try {
  if (OLC) await olcum(); else await etkilesim();
} catch (err) {
  kontrol("deneme yarıda kaldı", false, err instanceof Error ? err.message : String(err));
}
ws.close();
chrome.kill();
const basarisiz = sonuclar.filter((s) => !s.kosul).length;
console.log(`\n${sonuclar.length - basarisiz}/${sonuclar.length} geçti`);
process.exit(basarisiz);
