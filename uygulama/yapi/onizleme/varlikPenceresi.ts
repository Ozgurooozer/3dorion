// uygulama/yapi/onizleme/varlikPenceresi.ts — VARLIK / KARAKTER ÖNİZLEME PENCERESİ (spec 39 D5; Unreal Blueprint editörünün Viewport sekmesi). DOM + Babylon; saf mantık
// `varlikModeli.ts`/`varlikOzeti.ts`te (testli).
//
// Düzen: solda BİLEŞENLER (mesh · iskelet+kemik ağacı · malzeme · animasyon), ortada VIEWPORT (kendi canvas'ı), sağda AYRINTILAR (dosya, üçgen, köşe, boyut, kemik…). Düzenleme yok (salt okunur;
// beden değiştirme D7'dir). Pencere dok sisteminde YÜZER panel olarak açılır (id `varlik-onizleme`), istenirse bir bölgeye sekme olarak alınır; ilk açılışta kapalıdır.
//
// ANA SAHNEYE DOKUNMAZ: kendi Engine'i, kendi Scene'i, kendi canvas'ı. Babylon'un "son oluşturulan sahne/motor" kayıtları ikinci motor yüzünden ana sahneyi gölgelemesin
// diye kurulumdan ve her yüklemeden sonra eski değerine döndürülür (örtük sahne kullanan kod yanlış sahneye yazmasın). Pencere görünmezken çizim yapılmaz.
// Karakter (`*.karakter.json`): tanımın `beden` adresindeki glb yüklenir; boşta/idle animasyonu varsa döngüde oynar. Dosyalar `icerikIkili` ile gelir (renderer dosya yolu görmez).
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { EngineStore } from "@babylonjs/core/Engines/engineStore";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import "@babylonjs/loaders/glTF";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../world/arayuz/arayuzJetonlari.ts";
import type { Kopru } from "../../../host/kopru.ts";
import { boyutMetni, dosyaAdi, govdeAdi } from "../../icerik/icerikModeli.ts";
import { el } from "../ortak/dom.ts";
import type { DokYoneticisi } from "../ortak/dok/dokYoneticisi.ts";
import { karakterTanimiOku, olcuMetni, onizlemeTuru, sayiMetni, type KarakterTanimi } from "./varlikModeli.ts";
import { varlikOzetle, type VarlikOzeti } from "./varlikOzeti.ts";

export const VARLIK_PENCERESI_KIMLIGI = "varlik-onizleme";
const ZEMIN = new Color4(0.055, 0.075, 0.125, 1);
const KEMIK_SATIRI_TAVANI = 160;

export interface VarlikPenceresiAyari {
  kopru: Pick<Kopru, "icerikIkili" | "icerikMetin">;
  dok: DokYoneticisi;
  altyazi: (metin: string, ms?: number) => void;
}

export interface VarlikDurumu {
  adres: string | null;
  tur: "karakter" | "model" | "gorsel" | null;
  /** Yükleme bitti, sahne kuruldu (hata varsa false). */
  hazir: boolean;
  hata: string | null;
  ozet: VarlikOzeti | null;
  karakter: KarakterTanimi | null;
  meshToplam: number;
  /** `isReady()` olan mesh sayısı (shader/doku hazır; hazır değilse çizilmez). */
  meshHazir: number;
  kemikGorunur: boolean;
  izgaraGorunur: boolean;
  /** Oynayan animasyonun adı (yoksa null). */
  animasyon: string | null;
  /** Bu pencerenin çizdiği kare sayısı (görünürken artar). */
  kare: number;
}

export interface VarlikPenceresi {
  readonly kok: HTMLElement;
  /** Varlığı yükler ve pencereyi açar. Yüklenemezse neden `durum().hata`da, dönüş false. */
  ac(adres: string): Promise<boolean>;
  kapat(): void;
  durum(): VarlikDurumu;
  kemikleriGoster(g: boolean): void;
  izgaraGoster(g: boolean): void;
  animasyonSec(ad: string | null): void;
  sigdir(): void;
  /** Viewport'un zemin renginden FARKLI piksellerin oranı (0..1): sahne gerçekten bir şey çizdi mi (senaryo ölçüsü). Canvas görünmezse -1. */
  doluluk(): number;
}

const CSS = `
.vp-kok { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; background: #0c111e; color: ${R.yazi}; font: ${YAPI_YAZI.govde}; user-select: none; }
.vp-arac { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-bottom: 1px solid ${R.cizgi}; flex: none; }
.vp-arac .vp-baslik { font-weight: 600; color: ${R.yaziParlak}; margin-right: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
.vp-arac .vp-bosluk { flex: 1; }
.vp-arac button, .vp-arac select { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 9px; font: inherit; cursor: pointer; }
.vp-arac button:hover { border-color: ${R.vurgu}; color: ${R.yaziParlak}; } .vp-arac button[data-acik="1"] { border-color: ${R.vurgu}; background: rgba(88,193,255,0.14); color: ${R.yaziParlak}; }
.vp-govde { flex: 1; min-height: 0; display: flex; }
.vp-yan { width: 210px; flex: none; overflow: auto; padding: 4px 0; }
.vp-yan.vp-sol { border-right: 1px solid ${R.cizgi}; } .vp-yan.vp-sag { border-left: 1px solid ${R.cizgi}; width: 220px; }
.vp-baslik2 { padding: 5px 10px 2px; color: ${R.yaziSoluk}; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.vp-satir { display: flex; gap: 6px; padding: 1px 10px; white-space: nowrap; cursor: default; }
.vp-satir:hover { background: rgba(255,255,255,0.05); } .vp-satir[data-secili="1"] { background: rgba(88,193,255,0.16); color: ${R.yaziParlak}; }
.vp-satir .vp-sag-metin { margin-left: auto; color: ${R.yaziSoluk}; }
.vp-ayrinti { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; padding: 2px 10px; }
.vp-ayrinti dt { color: ${R.yaziSoluk}; } .vp-ayrinti dd { margin: 0; color: ${R.yaziParlak}; overflow-wrap: anywhere; }
.vp-orta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.vp-sekmeler { display: flex; border-bottom: 1px solid ${R.cizgi}; background: #0a0f1b; flex: none; }
.vp-sekme { padding: 3px 14px; color: ${R.yaziParlak}; border-bottom: 2px solid ${R.vurgu}; background: rgba(88,193,255,0.08); }
.vp-gorunum { flex: 1; min-height: 0; position: relative; }
.vp-gorunum canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none; touch-action: none; }
.vp-gorunum img { position: absolute; inset: 0; margin: auto; max-width: 100%; max-height: 100%; object-fit: contain; }
.vp-mesaj { position: absolute; left: 10px; bottom: 8px; right: 10px; color: ${R.yaziOrta}; font-size: 12px; pointer-events: none; text-shadow: 0 1px 2px #000; }
.vp-mesaj[data-tur="hata"] { color: ${R.hata}; }
`;
let stilEklendi = false;

export function varlikPenceresiKur(a: VarlikPenceresiAyari): VarlikPenceresi {
  if (!stilEklendi) { const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); stilEklendi = true; }

  // ── iskelet ──
  const kok = el("div", "vp-kok");
  const baslik = el("span", "vp-baslik", "Önizleme");
  const dugme = (m: string, ip: string): HTMLButtonElement => { const b = el("button", "", m); b.type = "button"; b.title = ip; return b; };
  const kemikD = dugme("🦴 Kemikler", "İskeleti çizgilerle göster"), izgaraD = dugme("▦ Izgara", "Zemin ızgarası"), sigdirD = dugme("⟲ Sığdır", "Kamerayı varlığa sığdır");
  const animSec = el("select"); animSec.title = "Animasyon";
  const arac = el("div", "vp-arac"); arac.append(baslik, el("span", "vp-bosluk"), animSec, kemikD, izgaraD, sigdirD);
  const sol = el("div", "vp-yan vp-sol"), sag = el("div", "vp-yan vp-sag"), orta = el("div", "vp-orta");
  const sekmeler = el("div", "vp-sekmeler"); sekmeler.append(el("div", "vp-sekme", "Viewport"));
  const gorunum = el("div", "vp-gorunum"), canvas = el("canvas"); canvas.tabIndex = 0;
  const mesajKutusu = el("div", "vp-mesaj");
  gorunum.append(canvas, mesajKutusu); orta.append(sekmeler, gorunum);
  const govde = el("div", "vp-govde"); govde.append(sol, orta, sag);
  kok.append(arac, govde);

  // ── durum ──
  let adres: string | null = null, tur: VarlikDurumu["tur"] = null, hazir = false, hata: string | null = null;
  let ozet: VarlikOzeti | null = null, karakter: KarakterTanimi | null = null, dosyaBoyutu = 0;
  let kemikGorunur = false, izgaraGorunur = true, animasyon: string | null = null, kare = 0;
  let secili: { tur: "mesh" | "kemik" | "malzeme" | "anim"; ad: string } | null = null;

  interface Sahne { motor: Engine; sahne: Scene; kamera: ArcRotateCamera; izgara: LinesMesh }
  let s3: Sahne | null = null;
  let meshler: readonly AbstractMesh[] = [], iskeletler: readonly Skeleton[] = [], animGruplari: readonly AnimationGroup[] = [];
  let kemikGorunumu: SkeletonViewer | null = null;
  let yukleSirasi = 0;

  const mesajVer = (m: string, t = ""): void => { mesajKutusu.textContent = m; mesajKutusu.dataset.tur = t; };
  const gorunurMu = (): boolean => a.dok.ekrandaMi(VARLIK_PENCERESI_KIMLIGI) && canvas.clientWidth > 0 && canvas.clientHeight > 0;

  /** Babylon'un örtük "son sahne/motor" kayıtlarını ANA sahneye döndürür (ikinci motor onları gölgelemesin). */
  function anaKayitlariKoru<T>(is: () => T): T {
    const sahne0 = EngineStore.LastCreatedScene;
    try { return is(); } finally {
      if (sahne0) EngineStore._LastCreatedScene = sahne0;
      if (s3) { const i = EngineStore.Instances.indexOf(s3.motor); if (i > 0) { EngineStore.Instances.splice(i, 1); EngineStore.Instances.unshift(s3.motor); } }
    }
  }

  function sahneKur(): Sahne {
    if (s3) return s3;
    return anaKayitlariKoru(() => {
      const motor = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: false, antialias: true });
      const sahne = new Scene(motor);
      sahne.clearColor = ZEMIN;
      const kamera = new ArcRotateCamera("onizleme_kamera", -Math.PI / 2.4, Math.PI / 2.35, 4, new Vector3(0, 0.9, 0), sahne);
      kamera.lowerRadiusLimit = 0.15; kamera.upperRadiusLimit = 80; kamera.minZ = 0.01; kamera.wheelDeltaPercentage = 0.02; kamera.panningSensibility = 600;
      kamera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");   // WASD önizlemede kamera sürmesin (tuşlar oyuna da gitmez)
      kamera.attachControl(canvas, true);
      const hemi = new HemisphericLight("onizleme_hemi", new Vector3(0.2, 1, 0.3), sahne); hemi.intensity = 0.95; hemi.groundColor = new Color3(0.18, 0.2, 0.26);
      const gun = new DirectionalLight("onizleme_gun", new Vector3(-0.5, -1, -0.6), sahne); gun.intensity = 0.7;
      const cizgiler: Vector3[][] = [];
      for (let i = -8; i <= 8; i++) { const t = i * 0.25; cizgiler.push([new Vector3(-2, 0, t), new Vector3(2, 0, t)], [new Vector3(t, 0, -2), new Vector3(t, 0, 2)]); }
      const izgara = MeshBuilder.CreateLineSystem("onizleme_izgara", { lines: cizgiler }, sahne);
      izgara.color = new Color3(0.2, 0.26, 0.38); izgara.isPickable = false;
      izgara.setEnabled(izgaraGorunur);
      motor.runRenderLoop(() => { if (!gorunurMu()) return; sahne.render(); kare++; });
      new ResizeObserver(() => { if (gorunurMu()) motor.resize(); }).observe(gorunum);
      s3 = { motor, sahne, kamera, izgara };   // anaKayitlariKoru bunu okur (motor sırasını düzeltir)
      return s3;
    });
  }

  function temizle(): void {
    kemikGorunumu?.dispose(); kemikGorunumu = null;
    for (const g of animGruplari) g.dispose();
    for (const m of meshler) m.dispose(false, true);
    for (const s of iskeletler) s.dispose();
    meshler = []; iskeletler = []; animGruplari = []; animasyon = null; ozet = null; hazir = false; secili = null;
    gorunum.querySelector("img")?.remove();
  }

  // ── çizim: bileşenler ve ayrıntılar ──
  function satir(metin: string, sagMetin: string, hedef: HTMLElement, sec?: { tur: NonNullable<typeof secili>["tur"]; ad: string }, girinti = 10): HTMLElement {
    const r = el("div", "vp-satir"); r.style.paddingLeft = `${girinti}px`;
    r.append(el("span", "", metin)); if (sagMetin) r.append(el("span", "vp-sag-metin", sagMetin));
    if (sec) {
      r.dataset.secili = secili?.tur === sec.tur && secili.ad === sec.ad ? "1" : "0";
      r.addEventListener("click", () => { secili = sec; if (sec.tur === "anim") animasyonSec(sec.ad); bilesenleriCiz(); ayrintilariCiz(); });
    }
    hedef.append(r); return r;
  }

  function bilesenleriCiz(): void {
    sol.replaceChildren(el("div", "vp-baslik2", "Bileşenler"));
    if (!ozet) { sol.append(el("div", "vp-satir", gorunum.querySelector("img") ? "(görsel)" : "yüklenmedi")); return; }
    sol.append(el("div", "vp-baslik2", `Mesh (${ozet.meshler.length})`));
    for (const m of ozet.meshler) satir(`📦 ${m.ad}`, `${sayiMetni(m.ucgen)}△`, sol, { tur: "mesh", ad: m.ad });
    if (ozet.iskeletler.length) {
      sol.append(el("div", "vp-baslik2", `İskelet (${ozet.iskeletler.reduce((t, i) => t + i.kemik, 0)} kemik)`));
      for (const k of ozet.kemikler.slice(0, KEMIK_SATIRI_TAVANI)) satir(`${"· ".repeat(Math.min(k.derinlik, 8))}🦴 ${k.ad}`, "", sol, { tur: "kemik", ad: k.ad }, 10);
      if (ozet.kemikler.length > KEMIK_SATIRI_TAVANI) sol.append(el("div", "vp-satir", `… ${ozet.kemikler.length - KEMIK_SATIRI_TAVANI} kemik daha`));
    }
    if (ozet.malzemeler.length) { sol.append(el("div", "vp-baslik2", `Malzeme (${ozet.malzemeler.length})`)); for (const m of ozet.malzemeler) satir(`🎨 ${m.ad}`, m.tur, sol, { tur: "malzeme", ad: m.ad }); }
    if (ozet.animasyonlar.length) { sol.append(el("div", "vp-baslik2", `Animasyon (${ozet.animasyonlar.length})`)); for (const m of ozet.animasyonlar) satir(`🏃 ${m.ad}`, `${m.saniye.toFixed(1)} sn`, sol, { tur: "anim", ad: m.ad }); }
  }

  function ayrintilariCiz(): void {
    sag.replaceChildren(el("div", "vp-baslik2", "Ayrıntılar"));
    const dl = el("dl", "vp-ayrinti");
    const ekle = (k: string, v: string): void => { dl.append(el("dt", "", k), el("dd", "", v)); };
    if (adres) { ekle("Dosya", dosyaAdi(adres)); ekle("Adres", adres); if (dosyaBoyutu) ekle("Boyut (dosya)", boyutMetni(dosyaBoyutu)); }
    if (karakter) { ekle("Karakter", karakter.ad); ekle("Beden", karakter.beden); if (karakter.iskelet) ekle("İskelet türü", karakter.iskelet); }
    if (ozet) {
      ekle("Üçgen", sayiMetni(ozet.ucgen)); ekle("Köşe", sayiMetni(ozet.kose)); ekle("Mesh", String(ozet.meshler.length));
      ekle("Kemik", String(ozet.iskeletler.reduce((t, i) => t + i.kemik, 0))); ekle("Malzeme", String(ozet.malzemeler.length)); ekle("Animasyon", String(ozet.animasyonlar.length));
      ekle("Ölçü", olcuMetni(ozet.boyut));
    }
    if (secili && ozet) {
      dl.append(el("dt", "", "—"), el("dd", "", `${secili.tur}: ${secili.ad}`));
      if (secili.tur === "mesh") { const m = ozet.meshler.find((x) => x.ad === secili!.ad); if (m) { ekle("Mesh üçgen", sayiMetni(m.ucgen)); ekle("Mesh köşe", sayiMetni(m.kose)); ekle("Malzeme", m.malzeme ?? "yok"); ekle("İskeletli", m.kemikli ? "evet" : "hayır"); } }
      if (secili.tur === "kemik") { const k = ozet.kemikler.find((x) => x.ad === secili!.ad); if (k) { ekle("Üst kemik", k.ust ?? "—"); ekle("Çocuk", String(k.cocuk)); ekle("Derinlik", String(k.derinlik)); } }
    }
    sag.append(dl);
  }

  function araciCiz(): void {
    kemikD.dataset.acik = kemikGorunur ? "1" : "0"; izgaraD.dataset.acik = izgaraGorunur ? "1" : "0";
    kemikD.disabled = !ozet || ozet.iskeletler.length === 0; sigdirD.disabled = !ozet;
    animSec.replaceChildren();
    const duragan = document.createElement("option"); duragan.value = ""; duragan.textContent = "Duruş"; animSec.append(duragan);
    for (const g of ozet?.animasyonlar ?? []) { const o = document.createElement("option"); o.value = g.ad; o.textContent = g.ad; animSec.append(o); }
    animSec.value = animasyon ?? ""; animSec.disabled = !ozet || ozet.animasyonlar.length === 0;
  }

  // ── işlemler ──
  function sigdir(): void {
    if (!s3 || meshler.length === 0) return;
    const { min, max } = s3.sahne.getWorldExtends((m) => meshler.includes(m) && m.getTotalVertices() > 0);
    const merkez = min.add(max).scale(0.5), boy = max.subtract(min);
    const yaricap = Math.max(0.2, Math.max(boy.x, boy.y, boy.z));
    s3.kamera.setTarget(merkez);
    s3.kamera.radius = yaricap * 1.9;
    s3.kamera.alpha = -Math.PI / 2.4; s3.kamera.beta = Math.PI / 2.35;
  }

  function animasyonSec(ad: string | null): void {
    for (const g of animGruplari) g.stop();
    animasyon = null;
    const g = ad ? animGruplari.find((x) => x.name === ad) : undefined;
    if (g) { g.start(true); animasyon = g.name; }
    animSec.value = animasyon ?? "";
  }

  function kemikleriGoster(g: boolean): void {
    if (g && (!s3 || iskeletler.length === 0)) { kemikGorunur = false; araciCiz(); return; }
    kemikGorunur = g;
    kemikGorunumu?.dispose(); kemikGorunumu = null;
    if (g && s3) {
      const sk = iskeletler[0]!, mesh = meshler.find((m) => m.skeleton === sk) ?? meshler[0]!;
      anaKayitlariKoru(() => { kemikGorunumu = new SkeletonViewer(sk, mesh, s3!.sahne, false, 3, { displayMode: SkeletonViewer.DISPLAY_LINES, pauseAnimations: false }); });
      kemikGorunumu!.isEnabled = true;
    }
    araciCiz();
  }

  function izgaraGoster(g: boolean): void { izgaraGorunur = g; s3?.izgara.setEnabled(g); araciCiz(); }

  async function ikiliYukle(ad: string): Promise<{ url: string; boyut: number } | string> {
    const r = await a.kopru.icerikIkili(ad);
    if (!r.ok) return `${ad} okunamadı: ${r.mesaj}`;
    return { url: `data:model/gltf-binary;base64,${r.deger.base64}`, boyut: r.deger.boyut };
  }

  async function ac(yeniAdres: string): Promise<boolean> {
    const t = onizlemeTuru(yeniAdres);
    if (!t) { a.altyazi(`önizleme yok: ${dosyaAdi(yeniAdres)}`, 2600); return false; }
    const sira = ++yukleSirasi;
    const ilk = !a.dok.duzen().yuzerKonum[VARLIK_PENCERESI_KIMLIGI];
    a.dok.sec(VARLIK_PENCERESI_KIMLIGI);
    if (ilk) a.dok.yuzerAyarla(VARLIK_PENCERESI_KIMLIGI, { x: 150, y: 80, g: 860, yuk: 500 });
    temizle();
    adres = yeniAdres; tur = t; hata = null; karakter = null; dosyaBoyutu = 0;
    baslik.textContent = govdeAdi(yeniAdres) || dosyaAdi(yeniAdres);
    mesajVer("yükleniyor…");
    bilesenleriCiz(); ayrintilariCiz(); araciCiz();
    const basarisiz = (neden: string): false => { hata = neden; mesajVer(neden, "hata"); a.altyazi(neden, 3200); bilesenleriCiz(); ayrintilariCiz(); araciCiz(); return false; };

    if (t === "gorsel") {
      const r = await a.kopru.icerikIkili(yeniAdres);
      if (sira !== yukleSirasi) return false;
      if (!r.ok) return basarisiz(`${dosyaAdi(yeniAdres)} okunamadı: ${r.mesaj}`);
      const uz = dosyaAdi(yeniAdres).split(".").pop()!.toLowerCase();
      const im = document.createElement("img"); im.src = `data:image/${uz === "jpg" ? "jpeg" : uz};base64,${r.deger.base64}`; im.alt = dosyaAdi(yeniAdres);
      gorunum.append(im); dosyaBoyutu = r.deger.boyut; hazir = true; mesajVer(`${dosyaAdi(yeniAdres)} · ${boyutMetni(r.deger.boyut)}`);
      bilesenleriCiz(); ayrintilariCiz(); araciCiz();
      return true;
    }

    let bedenAdresi = yeniAdres;
    if (t === "karakter") {
      const m = await a.kopru.icerikMetin(yeniAdres);
      if (sira !== yukleSirasi) return false;
      if (!m.ok) return basarisiz(`karakter tanımı okunamadı: ${m.mesaj}`);
      const k = karakterTanimiOku(m.deger, govdeAdi(yeniAdres));
      if (!k.ok) return basarisiz(`karakter tanımı geçersiz: ${k.neden}`);
      karakter = k.tanim; bedenAdresi = k.tanim.beden; baslik.textContent = k.tanim.ad;
    }
    const y = await ikiliYukle(bedenAdresi);
    if (sira !== yukleSirasi) return false;
    if (typeof y === "string") return basarisiz(y);
    dosyaBoyutu = y.boyut;
    try {
      const sk = sahneKur();
      const r = await anaKayitlariKoru(() => ImportMeshAsync(y.url, sk.sahne, { pluginExtension: ".glb" }));
      if (sira !== yukleSirasi) { for (const m of r.meshes) m.dispose(); return false; }
      meshler = r.meshes; iskeletler = r.skeletons; animGruplari = r.animationGroups;
      for (const g of animGruplari) g.stop();
      ozet = varlikOzetle(r);
      // Karakter: boşta/idle animasyonu döngüde; model: animasyon varsa ilkini değil DURUŞU göster (kullanıcı seçer).
      const bosta = animGruplari.find((g) => /bosta|boşta|idle/i.test(g.name));
      if (t === "karakter" && bosta) animasyonSec(bosta.name);
      sigdir();
      hazir = true;
      mesajVer(`${ozet.meshler.length} mesh · ${sayiMetni(ozet.ucgen)} üçgen · ${ozet.iskeletler.reduce((n, i) => n + i.kemik, 0)} kemik`);
      kemikGorunur = false;
    } catch (e) {
      return basarisiz(`${dosyaAdi(bedenAdresi)} yüklenemedi: ${e instanceof Error ? e.message : String(e)}`);
    }
    bilesenleriCiz(); ayrintilariCiz(); araciCiz();
    return true;
  }

  // ── olaylar ──
  kemikD.addEventListener("click", () => kemikleriGoster(!kemikGorunur));
  izgaraD.addEventListener("click", () => izgaraGoster(!izgaraGorunur));
  sigdirD.addEventListener("click", sigdir);
  animSec.addEventListener("change", () => animasyonSec(animSec.value || null));
  // Tuşlar pencerede kalır (oyuna/yürümeye sızmaz): dok kökü zaten durdurur; canvas odaktayken F tuşu sığdırır.
  canvas.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "f") { e.preventDefault(); sigdir(); } });
  canvas.addEventListener("pointerdown", () => canvas.focus());
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  a.dok.kaydet({
    kayit: { id: VARLIK_PENCERESI_KIMLIGI, ad: "Önizleme", bolgeler: ["sol", "sag", "alt", "yuzer"], varsayilan: "yuzer", baslangicKapali: true },
    icerik: kok, gorunur: true, ipucu: "Varlık / karakter önizlemesi (İçerik gezgininde çift tık)",
  });
  bilesenleriCiz(); ayrintilariCiz(); araciCiz();

  const piksel = document.createElement("canvas"); piksel.width = 64; piksel.height = 64;
  return {
    kok, ac,
    kapat: () => a.dok.kapat(VARLIK_PENCERESI_KIMLIGI),
    durum: () => ({
      adres, tur, hazir, hata, ozet, karakter,
      meshToplam: ozet?.meshler.length ?? 0, meshHazir: meshler.filter((m) => m.getTotalVertices() > 0 && m.isReady(true)).length,
      kemikGorunur, izgaraGorunur, animasyon, kare,
    }),
    kemikleriGoster, izgaraGoster, animasyonSec, sigdir,
    doluluk() {
      if (!s3 || !gorunurMu()) return -1;
      s3.sahne.render();
      const c = piksel.getContext("2d", { willReadFrequently: true });
      if (!c) return -1;
      c.drawImage(canvas, 0, 0, 64, 64);
      const d = c.getImageData(0, 0, 64, 64).data;
      const z = [Math.round(ZEMIN.r * 255), Math.round(ZEMIN.g * 255), Math.round(ZEMIN.b * 255)];
      let farkli = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i]! - z[0]!) + Math.abs(d[i + 1]! - z[1]!) + Math.abs(d[i + 2]! - z[2]!) > 36) farkli++;
      return farkli / (64 * 64);
    },
  };
}
