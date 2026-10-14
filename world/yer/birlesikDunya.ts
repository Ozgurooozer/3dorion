// world/yer/birlesikDunya.ts — OFİS OVA'NIN İÇİNDE: tek sahne, tek level, kapıdan ışınlanma yok (spec 27, Ozyn 2026-10-14).
//
// Açılışta kurulur (kapıda değil): ova level'ı + ofis yan yana. Bu dosya iki dünyayı AYNI sahnede barıştıran şeylerdir; her biri
// spike'ın (spec 27 §5) gösterdiği bir kusurun karşılığıdır:
//   1. ofisiOvayaKur: plato, çim maskesi, geçidin kalkması (level/ofisYeri.ts) — ova DOSYASI değişmez.
//   2. Işık ayrımı: ofis ışıkları yalnız ofis (ve ofisin İÇİNDEKİ aktörler); ova güneşi/dolgusu ofisi ve içindekileri aydınlatmaz.
//   3. Görünüm geçişi (look): sahne geneli sis/arka plan/pozlama/kontrast ve ışık sonrası efektler ofiste ofisin, dışarıda ova'nın.
//      Kamera ofisin içindeyken tam ofis; kapıdan çıkarken ~3 m içinde yumuşakça ova'ya karışır (sayılar), efekt zinciri (ton eşleme,
//      bloom, GI, AO…) orta noktada açılıp kapanır. `level.ayarla` (ortam komutları, G penceresi) ova görünümünü yeniden yazar:
//      sarmalanır, yazılan değer ova görünümü olarak saklanır, karışım yeniden uygulanır.
//   4. Kapı kanadı kişi yaklaşınca kendiliğinden açılır/kapanır (level/odaKapisi.ts); boşluk çarpışmada hep yürünür.
//   5. Pencereden GERÇEK ova görünür: sahte şehir resmi ve yağmur gizlenir.
//   6. Gece ufuk katmanı (ışık dili adım 2, `level/ufuk/`): ufukta şehir + terasta iki sokak lambası; level tanımına girmez, burada
//      kurulur (`?ufuk=0` → kurulmaz). Lamba ışıkları OVA ışık grubundadır: ofisi ve içerideki aktörleri aydınlatmaz.
// Tek `Yer` (`birlesikYer.ts`): her aktör aynı yeri görür.
//
// Bilinen sınırlar: ışık ayrımı aktör üyeliğini ~5 Hz günceller; efekt zincirinin orta noktada açılıp kapanması ufak bir takılma
// yapabilir (zincir yeniden kurulur); ofisin DIŞ yüzü hâlâ yalın duvar (görsel iş: spec 27 aşama B).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Light } from "@babylonjs/core/Lights/light";
import { levelKur, type Level } from "../level/cekirdek/levelKur.ts";
import { levelTanimiDogrula } from "../level/cekirdek/levelTanimi.ts";
import { MODULLER } from "../level/moduller/index.ts";
import type { OdaKurulumu } from "../level/oda.ts";
import { ofisiOvayaKur } from "../level/ofisYeri.ts";
import { KAPI_MERKEZI, kapiYakinMi } from "../level/odaKapisi.ts";
import type { Yer } from "./yer.ts";
import { birlesikYerKur, ofisIcindeMi } from "./birlesikYer.ts";
import { levelYeriniOlc } from "./levelOlcumu.ts";
import { ufukKur, ufukTanimi, type Ufuk } from "../level/ufuk/ufuk.ts";

/** `?ufuk=0` okuması (kompozisyon kökü bunu verir; giris.ts level'in iç klasörüne uzanmasın diye buradan). */
export { ufukAcikMi } from "../level/ufuk/ufuk.ts";

// ── Görünüm geçişi (SAF kısım) ─────────────────────────────────────────────

export interface Gorunum {
  sisYogunluk: number;
  sisRenk: readonly [number, number, number];
  arkaPlan: readonly [number, number, number, number];
  pozlama: number;
  kontrast: number;
}

// Uçlar BİREBİR (a + (b−a)·1 ≠ b: kayan nokta; ofiste her kare "neredeyse ofis" değeri yazılmasın).
const lerp = (a: number, b: number, t: number) => (t <= 0 ? a : t >= 1 ? b : a + (b - a) * t);
const yumusak = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };

/** Kapıdan ne kadar uzakta (dışarıda) ofis görünümü tamamen biter ve ova başlar (m). */
export const GECIS_UZAKLIGI = 3;

/**
 * Kameranın "ofis içi" derecesi (SAF): ofisin yer izi içinde 1; dışarıda yalnız KAPI yönünde (kapının önündeki yarım daire) ofisten
 * uzaklaştıkça 1 → 0; duvarın yanında ya da arkasında 0 (dışarıdan duvara bakan kişi ofis havasını görmez).
 */
export function icFaktoru(x: number, z: number): number {
  if (ofisIcindeMi(x, z)) return 1;
  if (z <= KAPI_MERKEZI.z) return 0;                                  // ön duvarın gerisi/yanı: dışarısı
  const d = Math.hypot(x - KAPI_MERKEZI.x, z - KAPI_MERKEZI.z);
  return 1 - yumusak(0.6, GECIS_UZAKLIGI, d);
}

/** İki görünümün karışımı (SAF): ic = 1 → ofis, 0 → ova. */
export function gorunumKaristir(ofis: Gorunum, ova: Gorunum, ic: number): Gorunum {
  const t = ic;   // `lerp` uçlarda (t ≤ 0, t ≥ 1) sıkıştırır
  return {
    sisYogunluk: lerp(ova.sisYogunluk, ofis.sisYogunluk, t),
    sisRenk: [lerp(ova.sisRenk[0], ofis.sisRenk[0], t), lerp(ova.sisRenk[1], ofis.sisRenk[1], t), lerp(ova.sisRenk[2], ofis.sisRenk[2], t)],
    arkaPlan: [lerp(ova.arkaPlan[0], ofis.arkaPlan[0], t), lerp(ova.arkaPlan[1], ofis.arkaPlan[1], t), lerp(ova.arkaPlan[2], ofis.arkaPlan[2], t), 1],
    pozlama: lerp(ova.pozlama, ofis.pozlama, t),
    kontrast: lerp(ova.kontrast, ofis.kontrast, t),
  };
}

// ── Babylon kısmı ──────────────────────────────────────────────────────────

/** Işık ayrımında izlenen aktör (oyuncu gövdesi, Orion): mesh'leri ve XZ konumu. */
export interface Aktor { meshler: readonly AbstractMesh[]; x: number; z: number }

/** OVA ışık grubu: güneş/ay, gök dolgusu ve (kuruluysa) ufuk katmanının sokak lambaları. Ofisi aydınlatmayacak her ışık BURADA. */
export function ovaIsiklari(level: { isik: { gunes: Light; dolgu: Light } }, ufuk: Pick<Ufuk, "isiklar"> | null): Light[] {
  return [level.isik.gunes, level.isik.dolgu, ...(ufuk?.isiklar ?? [])];
}

/**
 * Işık ayrımını yazar: ofis ışıkları YALNIZ ofis mesh'lerini + içerideki aktörleri, ova ışıkları bunlar DIŞINDAKİ her şeyi aydınlatır.
 * (Babylon: `includedOnlyMeshes` / `excludedMeshes`; ayarlayıcılar mesh'lerin ışık listesini yeniden eşler.)
 */
export function isikAyriminiYaz(odaIsiklari: readonly Light[], ova: readonly Light[], odaMeshleri: readonly AbstractMesh[], iceridekiler: readonly AbstractMesh[]): void {
  for (const l of odaIsiklari) l.includedOnlyMeshes = [...odaMeshleri, ...iceridekiler];
  for (const l of ova) l.excludedMeshes = [...odaMeshleri, ...iceridekiler];
}

export interface BirlesikDunyaAyari {
  sahne: Scene;
  /** Ova level tanımı (ham JSON; doğrulanır, ofis için düzenlenir). */
  tanim: unknown;
  oda: OdaKurulumu;
  kamera: Camera;
  /** Güneşin gölgesini düşürecek aktör mesh'leri. */
  golgeAtanlar?: readonly AbstractMesh[];
  /** Şu an var olan aktörler (Orion avatarı asenkron yüklenir: her çağrıda güncel liste). */
  aktorler(): readonly Aktor[];
  /** Gece ufuk katmanı (şehir + sokak lambaları) kurulsun mu (varsayılan evet; `?ufuk=0` → hayır, `ufukAcikMi`). */
  ufuk?: boolean;
}

export interface BirlesikDunya {
  readonly level: Level;
  /** Tek yer: ofis + ova. */
  readonly yer: Yer;
  readonly kurulumMs: number;
  /** Kameranın şu anki "ofis içi" derecesi (0–1). */
  ic(): number;
  yokEt(): void;
}

function gorunumuOku(sahne: Scene): Gorunum {
  const c = sahne.clearColor, f = sahne.fogColor, ip = sahne.imageProcessingConfiguration;
  return { sisYogunluk: sahne.fogDensity, sisRenk: [f.r, f.g, f.b], arkaPlan: [c.r, c.g, c.b, c.a], pozlama: ip.exposure, kontrast: ip.contrast };
}

function gorunumuYaz(sahne: Scene, g: Gorunum): void {
  sahne.fogDensity = g.sisYogunluk;
  sahne.fogColor.set(g.sisRenk[0], g.sisRenk[1], g.sisRenk[2]);
  sahne.clearColor.set(g.arkaPlan[0], g.arkaPlan[1], g.arkaPlan[2], g.arkaPlan[3]);
  const ip = sahne.imageProcessingConfiguration;
  ip.exposure = g.pozlama;
  ip.contrast = g.kontrast;
}

export async function birlesikDunyaKur(a: BirlesikDunyaAyari): Promise<BirlesikDunya> {
  const bas = performance.now();
  const { sahne, oda, kamera } = a;
  const d = levelTanimiDogrula(a.tanim);
  if (!d.ok) throw new Error(`ova: level tanımı bozuk — ${d.hata}`);
  // Ofisin yeri (plato, çim maskesi…) ve ufuk katmanı açıksa onun TEK tanım düzenlemesi (palet haritası sıcak koruması): yükleme anında.
  const tanim = a.ufuk === false ? ofisiOvayaKur(d.deger) : ufukTanimi(ofisiOvayaKur(d.deger));

  // Ofisin görünümü: level kurulmadan ÖNCE sahnede duran (ofis ışığı: mor sis, koyu arka plan, ton eşleme yok).
  const ofisGorunumu = gorunumuOku(sahne);
  const odaIsiklari: Light[] = [...sahne.lights];
  const odaMeshleri = [...new Set<AbstractMesh>([...oda.meshler, ...oda.seffaflar])];
  oda.pencereyiAc();

  const level = levelKur(sahne, tanim, MODULLER);
  await level.nesneler.hazir();
  level.stil.kameraBagla(kamera);
  const maxZ = level.tanim().ortam.kamera.uzak;
  kamera.maxZ = maxZ;
  for (const m of a.golgeAtanlar ?? []) level.isik.golgeyeKat(m, { atar: true });

  // Ova görünümü: level'ın az önce sahneye yazdığı. `ayarla` (ortam komutu, G penceresi) bunu yeniden yazar: sarmala.
  // DİKKAT: zaman tanımlıysa level HER KARE sis rengini/arka planı saatten yeniden yazar (`guncelle` → `zamanUygula`): ova görünümünün
  // sis RENGİ/arka planı her karede level'dan OKUNUR, karışım her karede yeniden yazılır. Yoğunluk, pozlama, kontrast yalnız `ayarla`da yazılır.
  let ovaGorunumu = gorunumuOku(sahne);
  let zamanVar = !!level.tanim().zaman;
  let efektAtla = false;
  const efektleriUydur = (ic: number) => {
    const atla = ic >= 0.5;
    if (atla !== efektAtla) { efektAtla = atla; level.stil.sonrasiAtla(atla); }
  };
  let sonIc = -1;
  const ayarlaEski = level.ayarla.bind(level);
  level.ayarla = (yeni: unknown) => {
    ayarlaEski(yeni);
    ovaGorunumu = gorunumuOku(sahne);   // level yazdı: bu ova'nın görünümü
    zamanVar = !!level.tanim().zaman;
    kamera.maxZ = level.tanim().ortam.kamera.uzak;
  };
  const kamPoz = () => (kamera as { position?: { x: number; z: number } }).position;
  /** Görünümü kameranın konumuna göre yaz (her karede; level sis/arka planı her karede ezer). */
  const gorunumuUygula = () => {
    const cam = kamPoz();
    if (!cam) return;
    // Yoğunluk/pozlama/kontrast level'ın YALNIZ `ayarla`da yazdıkları (her kare okumak kendi karışımımızı geri okurdu); sis RENGİ ve
    // arka plan her karede level'ın saatten yazdığı.
    if (zamanVar) { const g = gorunumuOku(sahne); ovaGorunumu = { ...ovaGorunumu, sisRenk: g.sisRenk, arkaPlan: g.arkaPlan }; }
    const ic = icFaktoru(cam.x, cam.z);
    sonIc = ic;
    efektleriUydur(ic);
    gorunumuYaz(sahne, gorunumKaristir(ofisGorunumu, ovaGorunumu, ic));
  };

  // Gece ufuk katmanı (level'dan bağımsız): ışıkları aşağıdaki ayrımdan ÖNCE var olmalı (ilk karede ofisi aydınlatmasın).
  const ufuk = a.ufuk === false ? null : ufukKur({
    sahne, yukseklik: (x, z) => level.yukseklik(x, z), stil: level.stil.isikDurumu, dunya: level.shaderlar.uniform,
  });
  if (ufuk) console.log(`[UFUK] kuruldu: ${ufuk.sayim.bina} bina, ${ufuk.sayim.pencere} pencere, ${ufuk.sayim.kose} köşe, ${ufuk.isiklar.length} lamba`);

  // Işık ayrımı: ofis ışıkları yalnız ofis mesh'lerini (+ içerideki aktörleri), ova ışıkları ofisi (+ içerideki aktörleri) aydınlatmaz.
  const ovaGrubu = ovaIsiklari(level, ufuk);
  let uyelikImzasi = "";
  const isikUyeliginiGuncelle = () => {
    const iceridekiler: AbstractMesh[] = [];
    for (const ak of a.aktorler()) if (ofisIcindeMi(ak.x, ak.z, 0.3)) iceridekiler.push(...ak.meshler);
    const imza = iceridekiler.map((m) => m.uniqueId).sort().join(",");
    if (imza === uyelikImzasi) return;
    uyelikImzasi = imza;
    isikAyriminiYaz(odaIsiklari, ovaGrubu, odaMeshleri, iceridekiler);
  };
  isikUyeliginiGuncelle();

  // Tek yer: ova'nın ölçülen yeri + ofis.
  const yer = birlesikYerKur(await levelYeriniOlc(level, "ova"));

  await sahne.whenReadyAsync();
  let sonAnMs = performance.now(), uyelikSayaci = 0;
  const gozlemci = sahne.onBeforeRenderObservable.add(() => {
    const simdi = performance.now();
    const dt = Math.min(0.1, (simdi - sonAnMs) / 1000);
    sonAnMs = simdi;
    level.guncelle(dt);
    // Kapı: ofisin kapısına en yakın kişi (Ozyn'in kamerası dahil) yakınsa açık.
    const kisiler = a.aktorler().map((ak) => Math.hypot(ak.x - KAPI_MERKEZI.x, ak.z - KAPI_MERKEZI.z));
    const cam = kamPoz();
    if (cam) kisiler.push(Math.hypot(cam.x - KAPI_MERKEZI.x, cam.z - KAPI_MERKEZI.z));
    if (oda.kapi) { oda.kapi.hedef(kapiYakinMi(oda.kapi.acikMi(), kisiler)); oda.kapi.guncelle(dt); }
    if (++uyelikSayaci >= 12) { uyelikSayaci = 0; isikUyeliginiGuncelle(); }
    gorunumuUygula();   // kameranın ofis içi derecesine göre; level.guncelle'DEN SONRA (o sis/arka planı ezmişti)
    ufuk?.guncelle(level.dunya, zamanVar, [sahne.fogColor.r, sahne.fogColor.g, sahne.fogColor.b]);   // sis karışımdan SONRA: o anki görünüm
  });
  gorunumuUygula();     // ilk kare ova görünümüyle başlamasın (ofisin içinde bir kare pembe sis)
  ufuk?.guncelle(level.dunya, zamanVar, [sahne.fogColor.r, sahne.fogColor.g, sahne.fogColor.b]);

  return {
    level, yer, kurulumMs: Math.round(performance.now() - bas),
    ic: () => (sonIc < 0 ? 0 : sonIc),
    yokEt() {
      sahne.onBeforeRenderObservable.remove(gozlemci);
      ufuk?.yokEt();
      level.yokEt();
      oda.pencereyiKapat();
      gorunumuYaz(sahne, ofisGorunumu);
    },
  };
}
