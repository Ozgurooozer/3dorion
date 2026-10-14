// world/level/gi/isikHacmi.ts — IŞIK HACMİ (GI spike 1, `?gi=hacim`): ofisin otomatik dinamik küresel aydınlatması.
//
// Ozyn: "Ben Lumen gibi bir sistem istiyorum, HAZIR. Biz ışık verince aynı anda realtime çalışacak." Burada el emeği YOK:
//   - geometri kurulumda BİR KEZ voxellenir (CPU, `isikHacmiCekirdek.ts`; ofis 0,1 m);
//   - HER KARE `scene.lights` baştan okunur — yeni ışık (`new PointLight(...)`) kendiliğinden bir sonraki karede girer, kayıt
//     yok; malzemelerin `emissiveColor`/`emissiveIntensity`'si her kare okunur (ışıyan yüzey = ışık kaynağı);
//   - görünürlük voxel içinde ışın yürütmeyle (gölge haritası yok, sahne yeniden çizilmez): ofis/ova ışık üyelik listeleri
//     GI'yi bağlamaz, pencereden/camdan giren ışık gerçekten girer;
//   - sonuç ofis malzemelerine eklentiyle eklenir (`giEklentisi.ts`): ekran uzayı geçişi yok, efekt zincirinden bağımsız.
// Kare başına 5 tam ekran çizim (enjeksiyon, 3 mip, toplama) — atlas dokularına; sahnenin kendisi değil.
//
// Bilinen sınırlar (spike 1): voxelleme statik (kapı kanadı kapalı hâliyle donar; editör/eşya değişince yeniden kurulmalı);
// aktörler (Ozyn, Orion) ne GI alır ne verir; renk uzayı dönüşümü yok (Standard gama, PBR doğrusal — Babylon GIRSM'i de
// yapmıyor); doku ortalaması tek renk (voxel başına doku örneği yok); ışık dizisi 16 (fazlası sayılır, log'a yazılır).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Material } from "@babylonjs/core/Materials/material";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Light } from "@babylonjs/core/Lights/light";
import type { Nullable } from "@babylonjs/core/types";
import { Constants } from "@babylonjs/core/Engines/constants";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { EffectRenderer, EffectWrapper } from "@babylonjs/core/Materials/effectRenderer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import {
  HACIM, IRR_BLOK, ISIK_TURU, atlasDuzeni, birikimKur, birikimiBitir, isikGecerliMi, isikPaketle, izgaraKur, meshVoxelle,
  mipBoyutu, statikAtlaslar, vramTahmini, type Atlas, type IsikVerisi, type Izgara, type Vec3,
} from "./isikHacmiCekirdek.ts";
import { ENJEKSIYON_GLSL, MIP_GLSL, TOPLAMA_GLSL } from "./isikHacmiGlsl.ts";
import { GiHacmiEklentisi, giDurumuYap, type GiDurumu } from "./giEklentisi.ts";

/** `?gi=hacim` (varsayılan KAPALI: hiçbir şey kurulmaz, davranış birebir eski). */
export function giAcikMi(sorgu: string): boolean {
  return new URLSearchParams(sorgu).get("gi") === "hacim";
}

/**
 * Hata ayıklama/ölçüm düğmeleri (URL; yalnız GI açıkken anlamlı): `gikip=1` yalnız GI görünümü, `giguc=<sayı>`,
 * `gisekme=<sayı>`, `gikoni=6` (eksen başına 6 konili yarıküre seti; varsayılan 1 = ön kayıttaki tek koni). Geçersiz değer →
 * varsayılan (kip 0, güç 1, sekme 1, koni 1). Saf: test edilir.
 */
export function giSorguAyari(sorgu: string): { kip: 0 | 1; guc: number; sekme: number; koni: 1 | 6 } {
  const q = new URLSearchParams(sorgu);
  const sayi = (ad: string, v: number) => { const x = Number(q.get(ad)); return q.has(ad) && Number.isFinite(x) && x >= 0 ? x : v; };
  return { kip: q.get("gikip") === "1" ? 1 : 0, guc: sayi("giguc", 1), sekme: sayi("gisekme", 1), koni: q.get("gikoni") === "6" ? 6 : 1 };
}

export interface IsikHacmiAyari {
  sahne: Scene;
  /** Voxellenecek ve GI alacak mesh'ler (ofis). Görünmez/kapalı/saydam olanlar voxellenmez. */
  meshler: readonly AbstractMesh[];
}

export interface IsikHacmiSayim {
  mesh: number;
  ucgen: number;
  voxel: number;
  dolu: number;
  yakin: number;
  malzeme: number;
  eklenti: number;
  n: Vec3;
  atlas: Atlas;
  kurulumMs: number;
  /** Doku boylarından HESAPLANAN VRAM (ölçüm değil). */
  vramMiB: number;
}

export interface GpuOlcumu {
  /** `gl.finish()` arası N tekrarın ortalaması (ms; CPU gönderimi dahil). */
  finishMs: number;
  /** EXT_disjoint_timer_query_webgl2 (yoksa ya da kesintiliyse null) — N tekrarın ortalaması (ms). */
  sorguMs: number | null;
  sorguNotu: string;
  tekrar: number;
  /** Geçiş başına sorgu süreleri (ms/tekrar; teşhis). */
  gecisMs: { enjeksiyon: number; mip: number; toplama: number } | null;
}

export interface IsikHacmi {
  readonly sayim: IsikHacmiSayim;
  readonly izgara: Izgara;
  /** Dolaylı ışığın çarpanı (0 = GI yok; malzeme eklentisi yine bağlı). */
  guc: number;
  /** Çoklu sekme: önceki karenin ışınımı × albedo enjeksiyona eklenir (0 = tek sekme). */
  sekme: number;
  /** 0 = normal, 1 = "yalnız GI" (hata ayıklama görünümü). */
  kip: 0 | 1;
  /** Eksen başına koni: 1 (ön kayıt) ya da 6 (yarıküre seti, `koniSeti`; toplama ~6× pahalı). */
  koni: 1 | 6;
  /** Son karede GI'ye giren ışıklar. */
  sonIsik(): { sayi: number; atlanan: number; adlar: string[] };
  /** Kare başı güncellemenin CPU süresi (ms, üstel ortalama): ışık okuma + ışıma tablosu + 5 geçişin gönderimi. */
  cpuMs(): number;
  /** Geçişlerin GPU süresi (ölçüm kancası; çizim döngüsünün dışında N kez). */
  gpuOlc(tekrar?: number): Promise<GpuOlcumu>;
  yokEt(): void;
}

// ── Malzeme okuma (albedo, ışıma) ─────────────────────────────────────────

interface MalzemeKaydi { mat: Material; albedoDoku: Vec3; isimaDoku: Vec3; difDoku: Vec3 }

/** Dokunun ortalama rengi (bir kez; okunamazsa beyaz — sınır: doku desenli malzemede tek renk). */
async function dokuOrtalamasi(t: Nullable<BaseTexture>): Promise<Vec3> {
  if (!t) return [1, 1, 1];
  try {
    const p = t.readPixels();
    if (!p) return [1, 1, 1];
    const d = await p;
    const olcek = d instanceof Uint8Array || d instanceof Uint8ClampedArray ? 1 / 255 : 1;
    const v: ArrayLike<number> | null = d instanceof Uint8Array || d instanceof Uint8ClampedArray || d instanceof Float32Array ? d : null;
    if (!v) return [1, 1, 1];   // yarım kayan (Uint16) vb.: çözmüyoruz
    const adim = Math.max(4, 4 * Math.floor(v.length / 4 / 4096));
    let r = 0, g = 0, b = 0, s = 0;
    for (let i = 0; i + 3 < v.length; i += adim) { r += v[i]!; g += v[i + 1]!; b += v[i + 2]!; s++; }
    return s ? [(r / s) * olcek, (g / s) * olcek, (b / s) * olcek] : [1, 1, 1];
  } catch { return [1, 1, 1]; }
}

const carp = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];

function albedoOku(k: MalzemeKaydi): Vec3 {
  const m = k.mat;
  if (m instanceof PBRMaterial) return carp([m.albedoColor.r, m.albedoColor.g, m.albedoColor.b], k.albedoDoku);
  if (m instanceof StandardMaterial) return carp([m.diffuseColor.r, m.diffuseColor.g, m.diffuseColor.b], k.difDoku);
  return [0.5, 0.5, 0.5];
}

/** Malzemenin O ANKİ ışıması (her kare okunur). Standard: emissiveColor × ışıma dokusu × diffuse dokusu (Standard'ın kendi
 *  bileşimi: (diffuseBase·diffuseColor + emissive) × baseColor). PBR: emissiveColor × emissiveIntensity × ışıma dokusu. */
function isimaOku(k: MalzemeKaydi): Vec3 {
  const m = k.mat;
  if (m instanceof PBRMaterial) {
    const e = m.emissiveIntensity;
    return carp([m.emissiveColor.r * e, m.emissiveColor.g * e, m.emissiveColor.b * e], k.isimaDoku);
  }
  if (m instanceof StandardMaterial) return carp(carp([m.emissiveColor.r, m.emissiveColor.g, m.emissiveColor.b], k.isimaDoku), k.difDoku);
  return [0, 0, 0];
}

const saydamMi = (m: Material) => m.alpha < 0.99 || m.needAlphaBlending();

// ── Işık okuma ────────────────────────────────────────────────────────────

function isikVerisi(l: Light): IsikVerisi | null {
  const r: Vec3 = [l.diffuse.r * l.intensity, l.diffuse.g * l.intensity, l.diffuse.b * l.intensity];
  const bos: Vec3 = [0, 0, 0];
  if (l instanceof SpotLight) {
    const p = l.getAbsolutePosition(), d = l.direction.normalizeToNew();
    return { tur: ISIK_TURU.spot, konum: [p.x, p.y, p.z], yon: [d.x, d.y, d.z], renk: r, menzil: l.range, cosYari: Math.cos(l.angle / 2), us: l.exponent, zemin: bos };
  }
  if (l instanceof PointLight) {
    const p = l.getAbsolutePosition();
    return { tur: ISIK_TURU.nokta, konum: [p.x, p.y, p.z], yon: [0, -1, 0], renk: r, menzil: l.range, cosYari: 0, us: 1, zemin: bos };
  }
  if (l instanceof DirectionalLight) {
    const d = l.direction.normalizeToNew();
    return { tur: ISIK_TURU.yonlu, konum: bos, yon: [d.x, d.y, d.z], renk: r, menzil: Number.MAX_VALUE, cosYari: 0, us: 1, zemin: bos };
  }
  if (l instanceof HemisphericLight) {
    const d = l.direction.normalizeToNew(), z = l.groundColor;
    return { tur: ISIK_TURU.yarikure, konum: bos, yon: [d.x, d.y, d.z], renk: r, menzil: Number.MAX_VALUE, cosYari: 0, us: 1, zemin: [z.r * l.intensity, z.g * l.intensity, z.b * l.intensity] };
  }
  return null;
}

/** Sahnenin ŞU ANKİ ışıkları (her kare): kayıt yok, `scene.lights` baştan okunur. */
function isiklariTopla(sahne: Scene): { veri: IsikVerisi[]; adlar: string[] } {
  const veri: IsikVerisi[] = [], adlar: string[] = [];
  for (const l of sahne.lights) {
    const yalniz = l.includedOnlyMeshes;
    let gorunen = 0;
    for (const m of yalniz) if (m.isVisible && m.isEnabled()) { gorunen++; break; }
    if (!isikGecerliMi({ etkin: l.isEnabled(), siddet: l.intensity, yalnizListesi: yalniz.length, yalnizGorunen: gorunen })) continue;
    const v = isikVerisi(l);
    if (v) { veri.push(v); adlar.push(l.name); }
  }
  return { veri, adlar };
}

// ── Kurulum ───────────────────────────────────────────────────────────────

export async function isikHacmiKur(a: IsikHacmiAyari): Promise<IsikHacmi> {
  const bas = performance.now();
  const { sahne } = a;
  const motor = sahne.getEngine();

  // 1. Voxellenecekler: açık, görünür, opak, malzemeli, köşeli.
  const secilen = a.meshler.filter((m) => m.isEnabled() && m.isVisible && m.material && m.getTotalVertices() > 0 && !saydamMi(m.material));
  const kayitlar: MalzemeKaydi[] = [];
  const indeksi = new Map<Material, number>();
  for (const m of secilen) {
    const mat = m.material!;
    if (indeksi.has(mat) || kayitlar.length >= 255) continue;
    const pbr = mat instanceof PBRMaterial ? mat : null, std = mat instanceof StandardMaterial ? mat : null;
    const [albedoDoku, isimaDoku, difDoku] = await Promise.all([
      dokuOrtalamasi(pbr?.albedoTexture ?? null), dokuOrtalamasi(pbr?.emissiveTexture ?? std?.emissiveTexture ?? null),
      dokuOrtalamasi(std?.diffuseTexture ?? null),
    ]);
    kayitlar.push({ mat, albedoDoku, isimaDoku, difDoku });
    indeksi.set(mat, kayitlar.length);   // 1..255
  }

  // 2. Izgara: seçilenlerin dünya kutusu.
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const m of secilen) {
    m.computeWorldMatrix(true);
    const k = m.getBoundingInfo().boundingBox;
    min[0] = Math.min(min[0], k.minimumWorld.x); min[1] = Math.min(min[1], k.minimumWorld.y); min[2] = Math.min(min[2], k.minimumWorld.z);
    max[0] = Math.max(max[0], k.maximumWorld.x); max[1] = Math.max(max[1], k.maximumWorld.y); max[2] = Math.max(max[2], k.maximumWorld.z);
  }
  const izgara = izgaraKur(min, max);
  if (izgara.n[0] * izgara.n[1] * izgara.n[2] > 4_000_000) throw new Error(`gi: ızgara çok büyük ${izgara.n.join("×")}`);

  // 3. Voxelleme (bir kez).
  const b = birikimKur(izgara);
  let ucgen = 0;
  for (const m of secilen) {
    const konum = m.getVerticesData(VertexBuffer.PositionKind);
    if (!konum) continue;
    const ki = indeksi.get(m.material!) ?? 0;
    const kayit = kayitlar[ki - 1];
    if (!kayit) continue;
    const e = isimaOku(kayit);
    ucgen += meshVoxelle(b, konum, m.getIndices(), m.getWorldMatrix().m,
      { indeks: ki, albedo: albedoOku(kayit), oncelik: e[0] + e[1] + e[2] }, m.getVerticesData(VertexBuffer.NormalKind));
  }
  const veri = birikimiBitir(b);
  const { s0, s1, atlas } = statikAtlaslar(veri);
  let dolu = 0, yakin = 0;
  for (let i = 0; i < veri.dolu.length; i++) { dolu += veri.dolu[i]!; yakin += veri.yakin[i]!; }

  // 4. Dokular.
  const statik0 = new RawTexture(s0, atlas.en, atlas.boy, Constants.TEXTUREFORMAT_RGBA, sahne, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_UNSIGNED_BYTE);
  const statik1 = new RawTexture(s1, atlas.en, atlas.boy, Constants.TEXTUREFORMAT_RGBA, sahne, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_UNSIGNED_BYTE);
  const tabloVeri = new Float32Array(256 * 4);
  const tablo = new RawTexture(tabloVeri, 256, 1, Constants.TEXTUREFORMAT_RGBA, sahne, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
  const hedef = (ad: string, en: number, boy: number) => {
    const t = new RenderTargetTexture(ad, { width: en, height: boy }, sahne, {
      generateMipMaps: false, generateDepthBuffer: false, generateStencilBuffer: false, type: Constants.TEXTURETYPE_HALF_FLOAT,
      format: Constants.TEXTUREFORMAT_RGBA, samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
    });
    t.wrapU = t.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
    return t;
  };
  const mipN: Vec3[] = [], mipAt: Atlas[] = [];
  for (let L = 0; L < HACIM.mipSayisi; L++) { mipN.push(mipBoyutu(izgara.n, L)); mipAt.push(atlasDuzeni(mipN[L]!)); }
  const seviyeler = mipAt.map((x, L) => hedef(`gi_isima_L${L}`, x.en, x.boy));
  const irr = hedef("gi_irr", IRR_BLOK.sutun * atlas.en, IRR_BLOK.satir * atlas.boy);

  // 5. Geçişler.
  const isleyici = new EffectRenderer(motor);
  const sarici = (ad: string, kaynak: string, uniformNames: string[], samplerNames: string[]) =>
    new EffectWrapper({ engine: motor, name: ad, fragmentShader: kaynak, uniformNames, samplerNames });
  const enj = sarici("gi_enjeksiyon", ENJEKSIYON_GLSL, ["hN", "hAt", "hKoken", "hAyar", "isikA", "isikB", "isikC", "isikD"], ["statik0", "statik1", "isimaTablo", "oncekiIrr"]);
  const mip = sarici("gi_mip", MIP_GLSL, ["kN", "hN"], ["kaynak"]);
  const top = sarici("gi_toplama", TOPLAMA_GLSL, ["mipN", "mipBoyut", "hKoni"], ["statik0", "statik1", "seviye0", "seviye1", "seviye2", "seviye3"]);

  const n4 = (n: Vec3, at: Atlas): [number, number, number, number] => [n[0], n[1], n[2], at.sutun];
  const hN = n4(izgara.n, atlas);
  let paket = isikPaketle([]);
  let sekmeDegeri = 1, mipHedef = 1, koniDegeri = 1;
  enj.onApplyObservable.add(() => {
    const e = enj.effect;
    e.setTexture("statik0", statik0); e.setTexture("statik1", statik1); e.setTexture("isimaTablo", tablo); e.setTexture("oncekiIrr", irr);
    e.setFloat4("hN", ...hN);
    e.setFloat4("hAt", atlas.sutun, atlas.satir, atlas.en, atlas.boy);
    e.setFloat4("hKoken", izgara.koken[0], izgara.koken[1], izgara.koken[2], izgara.voxel);
    e.setFloat4("hAyar", izgara.voxel, sekmeDegeri, paket.sayi, 0);
    e.setFloatArray4("isikA", paket.a); e.setFloatArray4("isikB", paket.b); e.setFloatArray4("isikC", paket.c); e.setFloatArray4("isikD", paket.d);
  });
  mip.onApplyObservable.add(() => {
    const e = mip.effect, L = mipHedef;
    e.setTexture("kaynak", seviyeler[L - 1]!);
    e.setFloat4("kN", ...n4(mipN[L - 1]!, mipAt[L - 1]!));
    e.setFloat4("hN", ...n4(mipN[L]!, mipAt[L]!));
  });
  const mipNDizi = new Float32Array(4 * HACIM.mipSayisi), mipBoyDizi = new Float32Array(4 * HACIM.mipSayisi);
  for (let L = 0; L < HACIM.mipSayisi; L++) {
    mipNDizi.set(n4(mipN[L]!, mipAt[L]!), 4 * L);
    mipBoyDizi.set([mipAt[L]!.en, mipAt[L]!.boy, 0, 0], 4 * L);
  }
  top.onApplyObservable.add(() => {
    const e = top.effect;
    e.setTexture("statik0", statik0); e.setTexture("statik1", statik1);
    for (let L = 0; L < HACIM.mipSayisi; L++) e.setTexture(`seviye${L}`, seviyeler[L]!);
    e.setFloatArray4("mipN", mipNDizi); e.setFloatArray4("mipBoyut", mipBoyDizi);
    e.setFloat4("hKoni", koniDegeri, 0, 0, 0);
  });

  // 6. Malzeme eklentisi: voxellenen VE (saydam bile olsa) ışık alan bütün ofis malzemeleri.
  const durum: GiDurumu = giDurumuYap();
  durum.koken = [izgara.koken[0], izgara.koken[1], izgara.koken[2], izgara.voxel];
  durum.n = hN;
  durum.at = [atlas.en, atlas.boy, 1, 0];
  // Doku eklentiden ÖNCE: donuk malzeme yalnız bir kez hazırlanır — o anda `GIHACIM` tanımı açık olmalı. Yeni hedef dokusu
  // sıfırla başlar; ilk geçişler (shader'lar derlenene kadar atlanır) bitene dek GI 0 okunur.
  durum.doku = irr;
  const eklentiler: GiHacmiEklentisi[] = [];
  const eklenen = new Set<Material>();
  for (const m of a.meshler) {
    const mat = m.material;
    if (!mat || eklenen.has(mat)) continue;
    if (!(mat instanceof PBRMaterial) && !(mat instanceof StandardMaterial)) continue;
    if (mat instanceof StandardMaterial && mat.disableLighting) continue;
    eklenen.add(mat);
    const donuk = mat.isFrozen;
    if (donuk) mat.unfreeze();
    eklentiler.push(new GiHacmiEklentisi(mat, durum));
    if (donuk) mat.freeze();   // freeze() = markDirty + bir kez hazırlık: yeni tanımla bir kez derlenir, sonra yine donuk
  }

  // 7. Her kare.
  let sonAdlar: string[] = [], sonAtlanan = 0, cpuOrt = 0;
  const isimaGuncelle = () => {
    let degisti = false;
    for (let i = 0; i < kayitlar.length; i++) {
      const e = isimaOku(kayitlar[i]!), o = 4 * (i + 1);
      if (tabloVeri[o] !== e[0] || tabloVeri[o + 1] !== e[1] || tabloVeri[o + 2] !== e[2]) {
        tabloVeri[o] = e[0]; tabloVeri[o + 1] = e[1]; tabloVeri[o + 2] = e[2]; tabloVeri[o + 3] = 1;
        degisti = true;
      }
    }
    if (degisti) tablo.update(tabloVeri);
  };
  const gecisler = () => {
    isleyici.render(enj, seviyeler[0]!);
    for (let L = 1; L < HACIM.mipSayisi; L++) { mipHedef = L; isleyici.render(mip, seviyeler[L]!); }
    isleyici.render(top, irr);
  };
  let atlananUyarildi = -1;
  const api: IsikHacmi = {
    sayim: {
      mesh: secilen.length, ucgen, voxel: veri.dolu.length, dolu, yakin, malzeme: kayitlar.length, eklenti: eklentiler.length,
      n: izgara.n, atlas, kurulumMs: 0, vramMiB: vramTahmini(izgara).toplam / 2 ** 20,
    },
    izgara,
    guc: 1, sekme: 1, kip: 0, koni: 1,
    sonIsik: () => ({ sayi: paket.sayi, atlanan: sonAtlanan, adlar: sonAdlar }),
    cpuMs: () => cpuOrt,
    async gpuOlc(tekrar = 200) {
      const gl = motor.getRenderingCanvas()?.getContext("webgl2") ?? null;
      if (!gl) return { finishMs: NaN, sorguMs: null, sorguNotu: "webgl2 bağlamı yok", tekrar, gecisMs: null };
      gl.finish();
      const t0 = performance.now();
      for (let i = 0; i < tekrar; i++) gecisler();
      gl.finish();
      const finishMs = (performance.now() - t0) / tekrar;
      const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
      if (!ext) return { finishMs, sorguMs: null, sorguNotu: "EXT_disjoint_timer_query_webgl2 yok", tekrar, gecisMs: null };
      /** Tek sorgu: `is`in N tekrarının GPU süresi (ms/tekrar); sonuç gelmez ya da kesinti olursa null. */
      const sorgula = async (is: () => void): Promise<number | null> => {
        const q = gl.createQuery();
        if (!q) return null;
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        for (let i = 0; i < tekrar; i++) is();
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        for (let k = 0; k < 120; k++) {
          await new Promise((r) => requestAnimationFrame(r));
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
        }
        const hazir = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) as boolean;
        const kesik = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
        const ns = hazir ? (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) : NaN;
        gl.deleteQuery(q);
        return hazir && !kesik ? ns / 1e6 / tekrar : null;
      };
      const sorguMs = await sorgula(gecisler);
      // Geçiş başına (teşhis): enjeksiyon, 3 mip, toplama ayrı ayrı.
      const enjMs = await sorgula(() => isleyici.render(enj, seviyeler[0]!));
      const mipMs = await sorgula(() => { for (let L = 1; L < HACIM.mipSayisi; L++) { mipHedef = L; isleyici.render(mip, seviyeler[L]!); } });
      const topMs = await sorgula(() => isleyici.render(top, irr));
      const gecisMs = enjMs !== null && mipMs !== null && topMs !== null ? { enjeksiyon: enjMs, mip: mipMs, toplama: topMs } : null;
      return { finishMs, sorguMs, sorguNotu: sorguMs === null ? "sonuç gelmedi ya da kesinti (disjoint)" : "EXT_disjoint_timer_query_webgl2", tekrar, gecisMs };
    },
    yokEt() {
      sahne.onBeforeRenderTargetsRenderObservable.remove(gozlemci);
      for (const e of eklentiler) e.kapat();
      durum.doku = null;
      for (const w of [enj, mip, top]) w.dispose();
      isleyici.dispose();
      for (const t of [statik0, statik1, tablo, irr, ...seviyeler]) t.dispose();
    },
  };
  // DİKKAT: Babylon bu olayı kare başına İKİ kez yayınlar (`scene.render` ve `_renderForCamera` içinde). İlk ölçüm koşusunda
  // geçişler iki kez koştu (+10 çizim, beklenen +5; ön kayıt SAPMALAR 1) → kare kimliğiyle tek sefer.
  let sonKare = -1;
  const gozlemci = sahne.onBeforeRenderTargetsRenderObservable.add(() => {
    const kareNo = sahne.getFrameId();   // getRenderId DEĞİL: o `_renderForCamera` içinde de artar
    if (kareNo === sonKare) return;
    sonKare = kareNo;
    const t = performance.now();
    durum.at[2] = api.guc;
    durum.at[3] = api.kip;
    sekmeDegeri = api.sekme;
    koniDegeri = api.koni;
    const isik = isiklariTopla(sahne);
    paket = isikPaketle(isik.veri);
    sonAdlar = isik.adlar.slice(0, paket.sayi);
    sonAtlanan = paket.atlanan;
    if (paket.atlanan > 0 && atlananUyarildi !== paket.atlanan) {
      atlananUyarildi = paket.atlanan;
      console.warn(`[GI] ${isik.veri.length} ışık var, shader sınırı ${HACIM.isikSiniri}: ${paket.atlanan} ışık GI'ye girmedi`);
    }
    isimaGuncelle();
    gecisler();
    cpuOrt = cpuOrt === 0 ? performance.now() - t : cpuOrt * 0.95 + (performance.now() - t) * 0.05;
  });
  api.sayim.kurulumMs = Math.round(performance.now() - bas);
  return api;
}
