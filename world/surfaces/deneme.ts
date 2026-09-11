// world/surfaces/deneme.ts — T3 izole deneme sahnesi + ölçüm koşucusu.
//
// Amaç: "DOM terminali 3D yüzeye nasıl konur" sorusunun iki adayını AYNI
// sahnede, AYNI pty'yle, AYNI kamerayla ölçmek. Karar bu dosyanın bastığı
// sayılarla verilir, sezgiyle değil.
//
// Çalıştırma:
//   npx vite
//   VITE_DEV_SERVER_URL=http://localhost:5273/world/surfaces/deneme.html \
//     ORION_OLCUM=1 electron .
//
// Ölçüm sonucu tek satır JSON olarak konsola basılır (`[OLCUM] {...}`),
// Electron ana süreci bunu stdout'a taşır.
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TerminalCekirdek, TEMA } from "./terminal-cekirdek.ts";
import { izgaraBoya, olcuUret, uykuBoya } from "./hucre-boyaci.ts";
import { bindirmeKur, ekranPikseli, type Bindirme } from "./css-bindirme.ts";
import { monitorKur } from "./monitor.ts";

const COLS = 80, ROWS = 24;
/** 24" 16:10 monitör ≈ 0.52 × 0.32 m. Izgara oranına (1.548) oturtuldu. */
const EKRAN_W = 0.52, EKRAN_H = 0.336;
const GOZ_Y = 1.2;

const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const asamaEl = document.getElementById("asama") as HTMLDivElement;
const bindirmeKap = document.getElementById("bindirme") as HTMLDivElement;
const gizliKap = document.getElementById("gizli") as HTMLDivElement;

// preserveDrawingBuffer: toDataURL ile tuval yakalamak için (aday A kanıtı).
const motor = new Engine(tuval, true, { preserveDrawingBuffer: true, stencil: true }, true);
const sahne = new Scene(motor);
sahne.clearColor = new Color4(0.03, 0.035, 0.06, 1);
new HemisphericLight("isik", new Vector3(0.2, 1, -0.4), sahne).intensity = 0.55;

const kamera = new FreeCamera("kam", new Vector3(0, GOZ_Y, -1.5), sahne);
kamera.setTarget(new Vector3(0, GOZ_Y, 0));
kamera.minZ = 0.05;

// Ekran düzlemi. Ön yüzü -Z'ye bakar (Babylon planeBuilder normali 0,0,-1),
// kamera -Z'de olduğu için doku aynalanmaz.
const ekran: AbstractMesh = CreatePlane("monitor_ekran", { width: EKRAN_W, height: EKRAN_H }, sahne);
ekran.position.set(0, GOZ_Y, 0);

// Referans zemin + masa bloğu: ölçek hissi ve derinlik testi için.
const masa = CreateBox("masa", { width: 1.4, height: 0.04, depth: 0.7 }, sahne);
masa.position.set(0, GOZ_Y - 0.28, 0.02);
const masaMat = new StandardMaterial("masaMat", sahne);
masaMat.diffuseColor = new Color3(0.13, 0.12, 0.15);
masa.material = masaMat;

/** Derinlik testi cismi: monitörün ÖNÜNDE durur. Aday B'nin kırılma noktası. */
const engel = CreateBox("engel", { size: 0.09 }, sahne);
engel.position.set(0.0, GOZ_Y - 0.02, -0.22);
const engelMat = new StandardMaterial("engelMat", sahne);
engelMat.diffuseColor = new Color3(0.85, 0.45, 0.2);
engelMat.emissiveColor = new Color3(0.25, 0.1, 0.02);
engel.material = engelMat;
engel.setEnabled(false);

/** Aday A'nın kare başına boyama maliyeti — FPS vsync'e takılıyken tek dürüst ölçü. */
let boyaToplam = 0, boyaSayi = 0;
function boyaMaliyeti(): { kare: number; ortMs: number } {
  const r = { kare: boyaSayi, ortMs: boyaSayi ? +(boyaToplam / boyaSayi).toFixed(3) : 0 };
  boyaToplam = 0; boyaSayi = 0;
  return r;
}

// ---------------------------------------------------------------- aday arayüzü

interface Aday {
  ad: string;
  cekirdek: TerminalCekirdek;
  ac(): Promise<void>;
  etkin(a: boolean): void;
  /** Yeni pikseller sunulduğu anda çözülen söz — gecikme ölçümü bunu bekler. */
  pikselBekle(): Promise<number>;
  yokEt(): void;
}

// ------------------------------------------------------- ADAY A: doku kopyalama

function adayAKur(): Aday {
  const kap = document.createElement("div");
  const olcu = olcuUret(13, 28);
  kap.style.width = `${COLS * 9}px`;
  kap.style.height = `${ROWS * 18}px`;
  gizliKap.appendChild(kap);

  const cekirdek = new TerminalCekirdek({ kap, cols: COLS, rows: ROWS, fontSize: 14 });
  const DW = COLS * olcu.w, DH = ROWS * olcu.h;

  const doku = new DynamicTexture("monitorDoku", { width: DW, height: DH }, sahne, true,
    Texture.TRILINEAR_SAMPLINGMODE);
  doku.anisotropicFilteringLevel = 16;
  doku.hasAlpha = false;
  const bag = doku.getContext() as unknown as CanvasRenderingContext2D;

  // Işıksız ekran reçetesi: doku DIFFUSE yuvasına girer, emissiveColor beyaz
  // olur ve aydınlatmayı o sürer. `emissiveTexture` yuvası kullanılırsa
  // aydınlatma terimi sabit beyaz kalır ve düzlem bembeyaz çıkar — ölçüldü.
  const mat = new StandardMaterial("monitorMat", sahne);
  mat.diffuseTexture = doku;
  mat.specularColor = Color3.Black();
  mat.emissiveColor = Color3.White();
  mat.disableLighting = true;
  mat.backFaceCulling = false;

  let etkinMi = false;
  let cozucu: ((t: number) => void) | null = null;

  function boya(): void {
    if (!etkinMi) return;
    const an = performance.now();
    if (cekirdek.acikMi) {
      if (!cekirdek.kirli && !cozucu) return;      // kirli değilse GPU'ya dokunmuyoruz
      cekirdek.temizle();
      izgaraBoya(bag, cekirdek.term, olcu, { odakli: true, an });
    } else {
      uykuBoya(bag, DW, DH, an);                   // uyku hâli her karede nabız atar
    }
    doku.update();
    boyaToplam += performance.now() - an;
    boyaSayi++;
    if (boyaSayi === 1) {
      const c = bag.canvas as HTMLCanvasElement;
      const px = bag.getImageData(4, 4, 1, 1).data;
      console.log(`[TANI] tuvalOlcu=${c.width}x${c.height} dokuOlcu=${JSON.stringify(doku.getSize())} ` +
        `hazir=${doku.isReady()} matHazir=${mat.isReady(ekran, false)} piksel=${px[0]},${px[1]},${px[2]},${px[3]}`);
    }
    if (cozucu) {
      const c = cozucu; cozucu = null;
      requestAnimationFrame(() => c(performance.now()));
    }
  }
  const goz = sahne.onBeforeRenderObservable.add(boya);

  return {
    ad: "A-doku",
    cekirdek,
    async ac() { await cekirdek.ptyBagla(); cekirdek.kirlet(); },
    etkin(a) {
      etkinMi = a;
      if (a) { ekran.material = mat; cekirdek.kirlet(); boya(); }
    },
    pikselBekle() { return new Promise<number>((res) => { cozucu = res; cekirdek.kirlet(); }); },
    yokEt() {
      sahne.onBeforeRenderObservable.remove(goz);
      cekirdek.yokEt(); doku.dispose(); mat.dispose(); kap.remove();
    },
  };
}

// --------------------------------------------------- ADAY B: CSS matrix3d bindirme

function adayBKur(): Aday {
  const kap = document.createElement("div");
  kap.style.background = TEMA.background;
  bindirmeKap.appendChild(kap);

  const cekirdek = new TerminalCekirdek({ kap, cols: COLS, rows: ROWS, fontSize: 14 });

  // xterm DOM renderer'ın gerçek hücre ölçüsünü öğren: .xterm-screen'e
  // açık genişlik/yükseklik yazar. Homografinin kaynak dikdörtgeni budur.
  const perde = kap.querySelector(".xterm-screen") as HTMLElement | null;
  const W = perde ? parseFloat(perde.style.width) || perde.offsetWidth : COLS * 9;
  const H = perde ? parseFloat(perde.style.height) || perde.offsetHeight : ROWS * 18;

  // Arkada duracak koyu cam: DOM şeffaf değil ama düzlem de boş kalmasın.
  const uykuOlcu = olcuUret(13, 28);
  const uykuDoku = new DynamicTexture("uykuB", { width: COLS * uykuOlcu.w, height: ROWS * uykuOlcu.h }, sahne, true,
    Texture.TRILINEAR_SAMPLINGMODE);
  const uykuBag = uykuDoku.getContext() as unknown as CanvasRenderingContext2D;
  const mat = new StandardMaterial("monitorMatB", sahne);
  mat.diffuseTexture = uykuDoku;
  mat.specularColor = Color3.Black();
  mat.emissiveColor = Color3.White();
  mat.disableLighting = true;
  mat.backFaceCulling = false;

  let bindirme: Bindirme | null = null;
  let etkinMi = false;
  let cozucu: ((t: number) => void) | null = null;

  const gozUyku = sahne.onBeforeRenderObservable.add(() => {
    if (!etkinMi) return;
    uykuBoya(uykuBag, COLS * uykuOlcu.w, ROWS * uykuOlcu.h, performance.now());
    uykuDoku.update();
  });

  // xterm kendi render'ını bitirdiğinde pikseller DOM'da hazırdır; bir sonraki
  // kare bileşimlemede ekrana çıkar.
  const renderGoz = cekirdek.term.onRender(() => {
    if (!cozucu) return;
    const c = cozucu; cozucu = null;
    requestAnimationFrame(() => c(performance.now()));
  });

  return {
    ad: "B-css",
    cekirdek,
    async ac() {
      await cekirdek.ptyBagla();
      if (!bindirme) bindirme = bindirmeKur({ sahne, ekran, katman: kap, genislik: W, yukseklik: H });
      bindirme.gorunur(etkinMi);
    },
    etkin(a) {
      etkinMi = a;
      if (a) ekran.material = mat;
      kap.style.display = a ? "block" : "none";
      if (bindirme) bindirme.gorunur(a);
      if (a && !bindirme) bindirme = bindirmeKur({ sahne, ekran, katman: kap, genislik: W, yukseklik: H });
    },
    pikselBekle() { return new Promise<number>((res) => { cozucu = res; }); },
    yokEt() {
      sahne.onBeforeRenderObservable.remove(gozUyku);
      renderGoz.dispose();
      bindirme?.yokEt();
      cekirdek.yokEt(); uykuDoku.dispose(); mat.dispose(); kap.remove();
    },
  };
}

// ------------------------------------------------------------------- yardımcılar

const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let kareSayaci = 0;
motor.onEndFrameObservable.add(() => { kareSayaci++; });

/** Gerçek kare sayımıyla FPS. motor.getFps() yumuşatılmış; burada sayıyoruz. */
async function fpsOlc(sure = 3000): Promise<number> {
  const b = kareSayaci, t = performance.now();
  await bekle(sure);
  return (kareSayaci - b) / ((performance.now() - t) / 1000);
}

interface GecikmeSonuc { n: number; ort: number; orta: number; p95: number; enAz: number; enCok: number }

function ozet(d: number[]): GecikmeSonuc {
  const s = [...d].sort((a, b) => a - b);
  const n = s.length;
  const al = (o: number) => s[Math.min(n - 1, Math.max(0, Math.floor(o * n)))] ?? 0;
  return {
    n,
    ort: +(d.reduce((a, b) => a + b, 0) / n).toFixed(2),
    orta: +al(0.5).toFixed(2),
    p95: +al(0.95).toFixed(2),
    enAz: +(s[0] ?? 0).toFixed(2),
    enCok: +(s[n - 1] ?? 0).toFixed(2),
  };
}

/**
 * Girdi gecikmesi: terminale karakter teslim → o karakterin pikselleri sunuldu.
 * pty gidiş-dönüşü (IPC + kabuk yankısı) DAHİLDİR ve iki adayda aynıdır;
 * adaylar arası fark tam olarak "sunum" bacağıdır.
 */
async function gecikmeOlc(a: Aday, n: number): Promise<GecikmeSonuc> {
  const d: number[] = [];
  for (let i = 0; i < n; i++) {
    await bekle(90);
    const s = a.pikselBekle();
    const t0 = performance.now();
    a.cekirdek.yaz("x");
    const t1 = await Promise.race([s, bekle(1500).then(() => -1)]);
    if (t1 > 0) d.push(t1 - t0);
    if ((i + 1) % 20 === 0) { a.cekirdek.yaz("\x1b"); await bekle(120); }   // Esc: cmd girdi satırını temizler
  }
  a.cekirdek.yaz("\x1b");
  return ozet(d);
}

/** Ekranda bir karakter hücresinin kaç piksel yer kapladığı — okunabilirliğin kökü. */
function hucrePikseli(): { yatay: number; dikey: number; hucreW: number; hucreH: number } {
  const p = ekranPikseli(sahne, ekran);
  return {
    yatay: +p.yatay.toFixed(1), dikey: +p.dikey.toFixed(1),
    hucreW: +(p.yatay / COLS).toFixed(2), hucreH: +(p.dikey / ROWS).toFixed(2),
  };
}

function kameraKoy(mesafe: number): void {
  kamera.position.set(0, GOZ_Y, -mesafe);
  kamera.setTarget(new Vector3(0, GOZ_Y, 0));
  sahne.render();
}

/** Kare arabelleğinden merkez pikseli oku — "ekranda gerçekten ne var" kanıtı. */
async function merkezPiksel(): Promise<string> {
  const w = motor.getRenderWidth(), h = motor.getRenderHeight();
  const p = await motor.readPixels(Math.floor(w / 2) - 1, Math.floor(h / 2) - 1, 2, 2);
  const d = new Uint8Array(p.buffer, p.byteOffset, p.byteLength);
  return `${d[0]},${d[1]},${d[2]},${d[3]}`;
}

function asama(m: string): void {
  asamaEl.textContent = m;
  console.log(`[ASAMA] ${m}`);
}

// ------------------------------------------------------------------- koşu

const A = adayAKur();
const B = adayBKur();
const rapor: Record<string, unknown> = {
  pencere: { render: [motor.getRenderWidth(), motor.getRenderHeight()], donanimOlcek: motor.getHardwareScalingLevel() },
  izgara: { cols: COLS, rows: ROWS, ekranMetre: [EKRAN_W, EKRAN_H] },
  dokuA: { w: COLS * 13, h: ROWS * 28, hucre: [13, 28] },
};

motor.runRenderLoop(() => sahne.render());
addEventListener("resize", () => motor.resize());

setInterval(() => {
  hud.textContent = `FPS ${motor.getFps().toFixed(0)}  kare ${kareSayaci}  kopru ${typeof window.kopru}`;
}, 400);

async function kos(): Promise<void> {
  await bekle(900);                                   // xterm ölçüm + ilk kareler

  // ---- 0) çıplak sahne FPS (terminal yok)
  A.etkin(false); B.etkin(false);
  ekran.material = null;
  const fpsCiplak = await fpsOlc(2500);

  // ---- 1) ADAY A
  asama("aday A — pty açılıyor");
  A.etkin(true);
  const fpsAUyku = await fpsOlc(2500);
  await A.ac();
  await bekle(1800);
  A.cekirdek.yaz("chcp 65001 > nul\r");
  await bekle(700);
  A.cekirdek.yaz("echo ORION T3 ADAY A & claude --version\r");
  await bekle(4000);
  rapor["kuyrukA"] = A.cekirdek.kuyruk(12);
  console.log(`[TANI] A merkez piksel = ${await merkezPiksel()}`);
  const fpsABosta = await fpsOlc(2500);
  asama("aday A — gecikme ölçümü");
  rapor["gecikmeA"] = await gecikmeOlc(A, 30);
  rapor["boyaBosta"] = boyaMaliyeti();
  asama("aday A — yoğun çıktı");
  A.cekirdek.yaz("for /L %i in (1,1,1200) do @echo satir %i abcdefghijklmnopqrstuvwxyz 0123456789\r");
  await bekle(400);
  const fpsAYogun = await fpsOlc(2500);
  rapor["boyaYogun"] = boyaMaliyeti();
  await bekle(1500);
  kameraKoy(1.5); ekran.rotation.y = 0; sahne.render();
  const okunA15 = hucrePikseli();
  kameraKoy(0.6); const okunA06 = hucrePikseli();
  kameraKoy(1.5); ekran.rotation.y = Math.PI / 6; sahne.render();
  const aciA30 = hucrePikseli();
  ekran.rotation.y = 0;

  rapor["fps"] = { ciplak: +fpsCiplak.toFixed(1), aUyku: +fpsAUyku.toFixed(1), aBosta: +fpsABosta.toFixed(1), aYogun: +fpsAYogun.toFixed(1) };
  rapor["okunabilirlikA"] = { m15: okunA15, m06: okunA06, aci30: aciA30 };

  // ---- 2) ADAY B
  asama("aday B — pty açılıyor");
  A.etkin(false);
  B.etkin(true);
  const fpsBUyku = await fpsOlc(2500);
  await B.ac();
  await bekle(1800);
  B.cekirdek.yaz("chcp 65001 > nul\r");
  await bekle(700);
  B.cekirdek.yaz("echo ORION T3 ADAY B & claude --version\r");
  await bekle(4000);
  rapor["kuyrukB"] = B.cekirdek.kuyruk(12);
  const fpsBBosta = await fpsOlc(2500);
  asama("aday B — gecikme ölçümü");
  rapor["gecikmeB"] = await gecikmeOlc(B, 30);
  asama("aday B — yoğun çıktı");
  B.cekirdek.yaz("for /L %i in (1,1,1200) do @echo satir %i abcdefghijklmnopqrstuvwxyz 0123456789\r");
  await bekle(400);
  const fpsBYogun = await fpsOlc(2500);
  await bekle(1500);
  kameraKoy(1.5); ekran.rotation.y = 0; sahne.render();
  const okunB15 = hucrePikseli();
  kameraKoy(0.6); const okunB06 = hucrePikseli();
  kameraKoy(1.5); ekran.rotation.y = Math.PI / 6; sahne.render();
  const aciB30 = hucrePikseli();
  ekran.rotation.y = 0;
  (rapor["fps"] as Record<string, number>)["bUyku"] = +fpsBUyku.toFixed(1);
  (rapor["fps"] as Record<string, number>)["bBosta"] = +fpsBBosta.toFixed(1);
  (rapor["fps"] as Record<string, number>)["bYogun"] = +fpsBYogun.toFixed(1);
  rapor["okunabilirlikB"] = { m15: okunB15, m06: okunB06, aci30: aciB30, domPiksel: { w: COLS * 9, h: ROWS * 18 } };

  // ---- 3) kırılganlık: tuval yeniden boyutlanması (pencere resize ile AYNI kod yolu)
  asama("kırılganlık — tuval yeniden boyutlandırma");
  const eskiW = tuval.style.width, eskiH = tuval.style.height;
  tuval.style.width = "62%"; tuval.style.height = "58%";
  motor.resize(); sahne.render(); await bekle(300);
  const kucukB = hucrePikseli();
  const bPencereSonrasiKayma = (() => {
    // Bindirme doğru mu: DOM köşesi ile projeksiyon köşesi arasındaki sapma.
    const perde = (B.cekirdek.term.element as HTMLElement | undefined);
    if (!perde) return null;
    const r = perde.getBoundingClientRect();
    const p = ekranPikseli(sahne, ekran);
    return { domGenislik: +r.width.toFixed(1), projeksiyonGenislik: +p.yatay.toFixed(1) };
  })();
  tuval.style.width = eskiW; tuval.style.height = eskiH;
  motor.resize(); sahne.render(); await bekle(300);
  rapor["kirilganlik"] = { kucukTuvalB: kucukB, bindirmeSapmaB: bPencereSonrasiKayma };

  // ---- 4) derinlik testi: monitörün önüne cisim
  asama("derinlik testi — engel açık (aday B)");
  engel.setEnabled(true);
  await bekle(600);
  // Engel piksellerinin gerçekten görünüp görünmediğini tuvalden okuyamayız
  // (DOM tuvalin üstünde). Bu yüzden ekran görüntüsüyle doğrulanır.
  await bekle(2600);
  asama("derinlik testi — engel açık (aday A)");
  B.etkin(false); A.etkin(true); A.cekirdek.kirlet();
  await bekle(3200);
  engel.setEnabled(false);

  // ---- 5) görsel kanıt turu: sabit takvim, PowerShell bu anlarda yakalar
  asama("GORSEL A 1.5m");   A.etkin(true); B.etkin(false); kameraKoy(1.5); await bekle(3500);
  asama("GORSEL A 0.6m");   kameraKoy(0.6); await bekle(3500);
  asama("GORSEL A 30deg");  kameraKoy(1.5); ekran.rotation.y = Math.PI / 6; await bekle(3500);
  ekran.rotation.y = 0;
  asama("GORSEL B 1.5m");   A.etkin(false); B.etkin(true); kameraKoy(1.5); await bekle(3500);
  asama("GORSEL B 0.6m");   kameraKoy(0.6); await bekle(3500);
  asama("GORSEL B 30deg");  kameraKoy(1.5); ekran.rotation.y = Math.PI / 6; await bekle(3500);
  ekran.rotation.y = 0;
  asama("GORSEL A uyku");   B.etkin(false); A.etkin(true); A.cekirdek.ptyKes(); kameraKoy(1.0); await bekle(3500);

  // ---- 6) sızıntı denetimi: pty gerçekten öldü mü, dinleyici kaldı mı
  rapor["sizinti"] = { aPtyId: A.cekirdek.ptyId, bPtyId: B.cekirdek.ptyId };

  asama("BITTI");
  console.log(`[OLCUM] ${JSON.stringify(rapor)}`);
}


// ================================================================= MONİTÖR KOŞUSU
// `?monitor=1` ile açılırsa aday karşılaştırması yerine GERÇEK monitor.ts
// API'si uçtan uca doğrulanır: ac → odaklan → gerçek tuşlar → claude --version
// → kuyruk → kapat (uyku) → sızıntı denetimi → yokEt.

/** Gerçek klavye olayı üret: xterm'in kendi keydown yolundan geçsin. */
function tusla(hedef: HTMLElement, k: string, kod?: string): void {
  const tek = k.length === 1;
  const kodNo = tek ? k.codePointAt(0) ?? 0 : 0;
  // DİKKAT: keyCode yalnızca harf/rakam için doldurulur. Noktalama için
  // karakterin kodunu keyCode sanmak felakettir — "-" (45) xterm tarafından
  // Insert tuşu olarak okunur ve `claude --version` "claude version" olur.
  const harfRakam = tek && /[A-Za-z0-9]/.test(k);
  const ek = {
    key: k, code: kod ?? (harfRakam ? `Key${k.toUpperCase()}` : tek ? "" : k),
    bubbles: true, cancelable: true, composed: true,
    keyCode: harfRakam ? k.toUpperCase().charCodeAt(0) : tek ? 0 : 13,
    charCode: kodNo, which: kodNo,
  } as KeyboardEventInit;
  // Gerçek tarayıcıda keydown işlenip preventDefault edilirse keypress HİÇ
  // doğmaz. Sentetik dağıtımda bunu elle taklit ediyoruz; yoksa xterm aynı
  // karakteri iki kez alır.
  const islendi = !hedef.dispatchEvent(new KeyboardEvent("keydown", ek));
  if (!islendi && k.length === 1) hedef.dispatchEvent(new KeyboardEvent("keypress", ek));
  hedef.dispatchEvent(new KeyboardEvent("keyup", ek));
}

function yazTusla(hedef: HTMLElement, metin: string): void {
  for (const ch of metin) tusla(hedef, ch);
  tusla(hedef, "Enter");
}

/** Ayrı bir pty açıp tek komut koşturur, düz metin çıktısını döndürür. */
async function komutCiktisi(komut: string, beklemeMs = 1800): Promise<string> {
  const kap = document.createElement("div");
  kap.style.cssText = "position:absolute;left:-30000px;top:0;width:720px;height:432px;";
  gizliKap.appendChild(kap);
  const c = new TerminalCekirdek({ kap, cols: 100, rows: 30, fontSize: 14 });
  await c.ptyBagla();
  await bekle(900);
  c.yaz(`${komut}\r`);
  await bekle(beklemeMs);
  const cikti = c.kuyruk(30);
  c.yokEt(); kap.remove();
  return cikti;
}

/**
 * Kamerayı gözle görülmeyecek kadar (±5 mm) sallar.
 *
 * NEDEN: iki ardışık kare birebir aynıysa Chromium yeni kare sunmuyor ve
 * Windows'un PrintWindow'u WebGL katmanını BOŞ yakalıyor — ekranda metin
 * dururken ekran görüntüsü kapkara çıkıyor (kare arabelleği okumasıyla
 * doğrulandı: 12105 parlak piksel ekranda, 0 piksel PNG'de). Sallama bir
 * ürün davranışı değil, yakalama aracının kusurunu susturan ölçüm düzeneği;
 * gerçek oyunda oyuncu zaten hareket ediyor.
 */
function kameraSalla(): () => void {
  const x0 = kamera.position.x;
  const goz = sahne.onBeforeRenderObservable.add(() => {
    kamera.position.x = x0 + Math.sin(performance.now() / 260) * 0.005;
  });
  return () => { sahne.onBeforeRenderObservable.remove(goz); kamera.position.x = x0; };
}

/**
 * 3D kare arabelleğini PNG olarak konsola döker (base64, parçalı).
 *
 * NEDEN böyle: Windows PrintWindow bu pencerenin WebGL katmanını güvenilmez
 * yakalıyor — kare arabelleğinde 12105 parlak piksel varken PNG'de 0 çıktı.
 * Bu yol tuvalin kendisini okur (`preserveDrawingBuffer: true`), dolayısıyla
 * kanıt işletim sisteminin yakalama kusuruna bağımlı değildir.
 */
function tuvalDok(etiket: string): void {
  const url = (motor.getRenderingCanvas() as HTMLCanvasElement).toDataURL("image/png");
  const b64 = url.slice(url.indexOf(",") + 1);
  const boy = 6000;
  const n = Math.ceil(b64.length / boy);
  for (let i = 0; i < n; i++) {
    console.log(`[PNG ${etiket} ${i} ${n}] ${b64.slice(i * boy, (i + 1) * boy)}`);
  }
}

async function monitorKos(): Promise<void> {
  await bekle(900);
  const mrapor: Record<string, unknown> = {};
  // cwd bilerek ev dizini: 3dorion deposu Claude Code'un "bu klasöre güveniyor
  // musun" onayını tetikliyor ve --version çıktısı o ekranın arkasında kalıyor.
  const mon = monitorKur({ sahne, ekran, cwd: "C:\\Users\\ozigo" });

  kameraKoy(0.6);
  asama("MON uyku");                              // kapalıyken uyku yüzeyi
  mrapor["acikMiBaslangic"] = mon.acikMi();
  await bekle(3500);

  await mon.ac();
  mon.odaklan(true);
  await bekle(1500);
  mrapor["acikMiSonra"] = mon.acikMi();

  const ta = document.querySelector("#monitor-xterm textarea") as HTMLTextAreaElement | null;
  mrapor["textareaVar"] = !!ta;
  mrapor["odakDogru"] = document.activeElement === ta;

  // --- dünya sızdırmazlığı: odaklıyken tuş window'a ULAŞMAMALI
  let dunyaSayac = 0;
  const dunyaDinleyici = (): void => { dunyaSayac++; };
  window.addEventListener("keydown", dunyaDinleyici, false);

  if (ta) {
    yazTusla(ta, "echo ORION T3 MONITOR");
    await bekle(1200);
    mrapor["odakliyken_dunyaya_sizan_tus"] = dunyaSayac;

    tusla(ta, "Escape");                          // Esc dünyaya GİTMELİ
    await bekle(200);
    mrapor["esc_dunyaya_ulasti"] = dunyaSayac > 0;

    const oncekiKuyruk = mon.kuyruk(4);
    mon.odaklan(false);
    await bekle(200);
    const oncekiSayac = dunyaSayac;
    tusla(ta, "w");                               // odak yokken: dünyaya evet, terminale hayır
    await bekle(500);
    mrapor["odaksizken_dunyaya_gecen_tus"] = dunyaSayac - oncekiSayac;
    mrapor["odaksizken_terminal_degismedi"] = mon.kuyruk(4) === oncekiKuyruk;

    mon.odaklan(true);
    await bekle(300);
    yazTusla(ta, "claude --version");
    await bekle(6000);
  }
  window.removeEventListener("keydown", dunyaDinleyici, false);

  const sallamayiDurdur = kameraSalla();
  await bekle(700);
  console.log(`[TANI] MON merkez piksel = ${await merkezPiksel()}`);
  {
    const w = motor.getRenderWidth(), h = motor.getRenderHeight();
    const buf = await motor.readPixels(0, 0, w, h);
    const d = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    let parlak = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! > 60) parlak++;
    console.log(`[TANI] MON kare arabelleginde parlak piksel = ${parlak} / ${w * h}`);
  }
  asama("MON claude");                            // canlı `claude --version` karesi
  mrapor["kuyruk"] = mon.kuyruk(14);
  sahne.render();
  tuvalDok("claude");
  await bekle(3500);
  asama("MON acik");
  await bekle(2000);

  // --- sızıntı denetimi ---------------------------------------------------
  // 1) pty gerçekten ölüyor mu: aç/kapat x3 sonrası cmd.exe sayısı taban
  //    değere dönmeli. Ölçüm probu da bir cmd.exe açtığı için her sayım
  //    kendi probunu içerir; karşılaştırma bu yüzden adildir.
  // 2) dinleyici/gözlemci birikiyor mu: Babylon gözlemci sayısı sabit kalmalı.
  const SAY_KOMUT = 'tasklist /NH /FI "IMAGENAME eq cmd.exe"';
  // tasklist satırları `cmd.exe` ile BAŞLAR; yankılanan komut satırı istem
  // metniyle başladığı için sayıma karışmaz.
  const say = (t: string): number => (t.match(/^cmd\.exe\s/gm) ?? []).length;
  const gozlemciSayisi = (): number => sahne.onBeforeRenderObservable.observers.length;

  mon.kapat();
  await bekle(1500);
  const tabanCmd = say(await komutCiktisi(SAY_KOMUT, 2500));
  const tabanGozlemci = gozlemciSayisi();
  const dongu: Array<{ tur: number; acikken: number; kapaliyken: number; gozlemci: number }> = [];
  for (let i = 1; i <= 3; i++) {
    await mon.ac();
    await bekle(1400);
    const acikken = say(await komutCiktisi(SAY_KOMUT, 2500));
    mon.kapat();
    await bekle(1400);
    dongu.push({
      tur: i, acikken, kapaliyken: say(await komutCiktisi(SAY_KOMUT, 2500)),
      gozlemci: gozlemciSayisi(),
    });
  }
  mrapor["sizinti"] = { tabanCmd, tabanGozlemci, dongu };
  mrapor["acikMiKapatmaSonrasi"] = mon.acikMi();

  asama("MON kapali");
  sahne.render();
  tuvalDok("uyku");
  await bekle(3000);

  sallamayiDurdur();
  mon.yokEt();
  await bekle(400);
  mrapor["yokEtSonrasiMalzeme"] = ekran.material === null;
  mrapor["yokEtSonrasiDom"] = document.getElementById("monitor-xterm") === null;
  mrapor["yokEtSonrasiGozlemci"] = gozlemciSayisi();
  // yokEt dinleyicileri gerçekten söktü mü: artık tuş dünyaya ULAŞMALI.
  let sonSayac = 0;
  const sonDinleyici = (): void => { sonSayac++; };
  window.addEventListener("keydown", sonDinleyici, false);
  tusla(document.body, "w");
  await bekle(200);
  window.removeEventListener("keydown", sonDinleyici, false);
  mrapor["yokEtSonrasiTusDunyayaGecti"] = sonSayac === 1;

  asama("BITTI");
  console.log(`[OLCUM] ${JSON.stringify(mrapor)}`);
}

const secilenKosu = location.search.includes("monitor") ? monitorKos : kos;

secilenKosu().catch((e: unknown) => {
  console.log(`[HATA] ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
  asama(`HATA: ${String(e)}`);
});
