// world/avatar/vrm.ts — VRM/GLB karakter yükleyici.
//
// molp `Terminal/scene/VRMLoader.ts` referans alındı, KOPYALANMADI. Oradaki
// `registerBeforeRender` + kendi t sayacı + poz fonksiyonları burada YOK:
// animasyon kararını `yurutucu.ts` verir, bu dosya yalnızca uygular.
//
// ÖLÇÜLEN GERÇEK (assets/orion.vrm, 2026-09-12):
//   magic=glTF, extensionsUsed=YOK, morph target=YOK, mesh adı "Cesium_Man",
//   kök düğüm "Z_UP", pozisyon bbox 1.5065 birim (Z ekseninde).
//   → Dosya .vrm uzantılı olmasına rağmen GERÇEK BİR VRM DEĞİL, Cesium_Man
//     örnek GLB'si. Bu yüzden:
//       • blend shape ile ağız senkronu YAPILAMAZ (`agizDestegi: false`)
//       • göz kırpma YAPILAMAZ (`kirpmaDestegi: false`)
//       • model Z-yukarı: yüklenince YATIK gelir, düzeltilmesi gerekir
//   Bunlar SESSİZ geçilmez: yükleyici her birini uyarı olarak basar.
//
// Bu yüzden yükleyici "kör" değil ÖLÇEREK çalışır: bbox'a bakar, hangi eksenin
// yukarı olduğuna karar verir, boyu hedefe normalize eder. Böylece asset
// değiştiğinde (gerçek bir VRM konduğunda) kod değişmeden doğru çalışır.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { BoneLookController } from "@babylonjs/core/Bones/boneLookController";
import type { Bone } from "@babylonjs/core/Bones/bone";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import "@babylonjs/loaders/glTF";
import type { Jest, Poz } from "../../protocol/niyet.ts";
import type { AvatarIskeleti, IskeletBilgisi } from "./iskelet.ts";
import { BOY } from "./prosedurel.ts";

/** VRM 0.x blend shape preset adayları — ağız açıklığı için sırayla aranır. */
const AGIZ_ADLARI = ["a", "aa", "vrc.v_aa", "mouth_a", "jawopen", "viseme_aa", "fcl_mth_a"];
/** Göz kırpma blend shape adayları. */
const KIRPMA_ADLARI = ["blink", "blink_l", "eyeblink", "vrc.blink", "fcl_eye_close"];

/** Boyun/baş kemiği adayları — büyük/küçük harf duyarsız parça eşleşmesi. */
const BAS_KEMIK_DESENI = /(head|neck|boyun|kafa|bas)/i;

function morphBul(meshler: readonly AbstractMesh[], adaylar: readonly string[]): MorphTarget[] {
  const bulunan: MorphTarget[] = [];
  for (const m of meshler) {
    const y = m.morphTargetManager;
    if (!y) continue;
    for (let i = 0; i < y.numTargets; i++) {
      const h = y.getTarget(i);
      const ad = h.name.toLowerCase();
      if (adaylar.some((a) => ad === a || ad.endsWith(a))) bulunan.push(h);
    }
  }
  return bulunan;
}

/**
 * VRM/GLB iskeleti yükler. BAŞARISIZ OLURSA FIRLATIR — çağıran (`index.ts`)
 * uyarı basıp prosedürele düşer. Burada sessiz yedekleme YOK: hangi katmanın
 * düştüğü loglanabilir kalmalı.
 */
export async function vrmIskeletYukle(sahne: Scene, yol: string): Promise<AvatarIskeleti> {
  const sonuc = await ImportMeshAsync(yol, sahne, { pluginExtension: ".glb" });
  if (sonuc.meshes.length === 0) throw new Error(`VRM boş geldi: ${yol}`);

  const kok = new TransformNode("orion_vrm_kok", sahne);
  // Babylon glTF yükleyicisi bir `__root__` düğümü üretir; onu kendi kökümüze
  // bağlıyoruz ki konum/yaw'ı tek yerden sürelim.
  const disKok = sonuc.meshes[0]!;
  const ayar = new TransformNode("orion_vrm_ayar", sahne);
  ayar.parent = kok;
  disKok.parent = ayar;

  // ── Ölçüm: yön ve boy ───────────────────────────────────────────────────
  disKok.computeWorldMatrix(true);
  for (const m of sonuc.meshes) m.computeWorldMatrix(true);
  const kucuk = new Vector3(Infinity, Infinity, Infinity);
  const buyuk = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of sonuc.meshes) {
    if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
    const s = m.getBoundingInfo().boundingBox;
    kucuk.minimizeInPlace(s.minimumWorld);
    buyuk.maximizeInPlace(s.maximumWorld);
  }
  const boyut = buyuk.subtract(kucuk);
  const olculebilir = Number.isFinite(boyut.y) && boyut.y > 0;

  let hamBoy = olculebilir ? boyut.y : BOY;
  if (olculebilir && boyut.z > boyut.y * 1.4) {
    // Z-yukarı asset (Cesium_Man böyledir): ayakta durması için -90° X dönüşü.
    console.warn(
      `[avatar/vrm] '${yol}' Z-yukarı görünüyor (y=${boyut.y.toFixed(2)} z=${boyut.z.toFixed(2)}); ` +
      "-90° X dönüşüyle ayağa kaldırılıyor. Gerçek bir VRM bu düzeltmeye ihtiyaç duymaz.");
    ayar.rotation.x = -Math.PI / 2;
    hamBoy = boyut.z;
  }

  const olcek = hamBoy > 0.01 ? BOY / hamBoy : 1;
  ayar.scaling.setAll(olcek);
  // Ayakları y=0'a oturt: kök konumu "ayak hizası" sözleşmesindedir.
  ayar.computeWorldMatrix(true);
  for (const m of sonuc.meshes) m.computeWorldMatrix(true);
  let altY = Infinity;
  for (const m of sonuc.meshes) {
    if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
    altY = Math.min(altY, m.getBoundingInfo().boundingBox.minimumWorld.y);
  }
  if (Number.isFinite(altY)) ayar.position.y -= altY;

  // ── Animasyon klipleri ──────────────────────────────────────────────────
  // glTF yükleyicisi ilk klibi kendiliğinden oynatır; durdur. Yürüme klibi
  // varsa poz "yürüyor" olduğunda çalınır.
  const klipler: AnimationGroup[] = sonuc.animationGroups;
  for (const g of klipler) g.stop();
  const yurumeKlibi =
    klipler.find((g) => /walk|yuru|yürü/i.test(g.name)) ?? klipler[0] ?? null;
  const bostaKlibi = klipler.find((g) => /idle|bosta|boşta/i.test(g.name)) ?? null;
  if (!yurumeKlibi) {
    console.warn(`[avatar/vrm] '${yol}' içinde yürüme klibi yok; yürürken gövde kayacak.`);
  }

  // ── Baş kemiği ──────────────────────────────────────────────────────────
  let basKemigi: Bone | null = null;
  const iskelet = sonuc.skeletons[0] ?? null;
  if (iskelet) {
    // En derindeki eşleşme baş, üsttekiler boyun — sonuncuyu seç.
    const adaylar = iskelet.bones.filter((b) => BAS_KEMIK_DESENI.test(b.name));
    basKemigi = adaylar.length > 0 ? adaylar[adaylar.length - 1]! : null;
  }
  let bakKontrol: BoneLookController | null = null;
  const bakHedefi = new Vector3(0, BOY * 0.9, 1);
  if (basKemigi && iskelet) {
    const taşıyıcı = sonuc.meshes.find((m) => m.skeleton === iskelet) ?? disKok;
    bakKontrol = new BoneLookController(taşıyıcı, basKemigi, bakHedefi, {
      maxYaw: Math.PI / 2, minYaw: -Math.PI / 2,
      maxPitch: Math.PI / 3, minPitch: -Math.PI / 3,
    });
    bakKontrol.slerpAmount = 0.35;
  } else {
    console.warn(
      `[avatar/vrm] '${yol}' içinde baş/boyun kemiği bulunamadı (${BAS_KEMIK_DESENI}); ` +
      "baş ayrı dönmeyecek, bakış yalnızca gövdeye uygulanacak.");
  }

  // ── Blend shape'ler ─────────────────────────────────────────────────────
  const agizHedefleri = morphBul(sonuc.meshes, AGIZ_ADLARI);
  const kirpmaHedefleri = morphBul(sonuc.meshes, KIRPMA_ADLARI);
  if (agizHedefleri.length === 0) {
    console.warn(
      `[avatar/vrm] '${yol}' içinde ağız blend shape'i yok (arananlar: ${AGIZ_ADLARI.join(", ")}). ` +
      "Ses senkronu bu iskelette GÖRÜNMEZ — gerçek bir VRM koyulduğunda kendiliğinden çalışır.");
  }
  if (kirpmaHedefleri.length === 0) {
    console.warn(`[avatar/vrm] '${yol}' içinde göz kırpma blend shape'i yok.`);
  }

  const bilgi: IskeletBilgisi = {
    tur: "vrm",
    kaynak: `${yol} (${sonuc.meshes.length} mesh, ${klipler.length} klip, kemik ${iskelet?.bones.length ?? 0})`,
    agizDestegi: agizHedefleri.length > 0,
    kirpmaDestegi: kirpmaHedefleri.length > 0,
    basDestegi: bakKontrol !== null,
    hamBoy,
  };

  // ── Durum uygulama ──────────────────────────────────────────────────────

  let govdeYaw = 0;
  let oynayan: AnimationGroup | null = null;

  function klipOynat(g: AnimationGroup | null, hizOrani: number): void {
    if (oynayan === g) {
      if (g) g.speedRatio = hizOrani;
      return;
    }
    if (oynayan) {
      oynayan.stop();
      // `stop()` kemikleri son değerlendirilen KAREDE bırakır: yürüme klibi
      // durdurulduğunda karakter bacakları açık donar. Dinlenme pozuna dönmek
      // şart — bu, ilk canlı denemede ekran görüntüsünde yakalandı.
      if (!g) iskelet?.returnToRest();
    }
    oynayan = g;
    if (g) { g.speedRatio = hizOrani; g.start(true); }
  }

  function govdeUygula(yaw: number): void {
    govdeYaw = yaw;
    kok.rotation.y = yaw;
  }

  function basUygula(yaw: number, pitch: number): void {
    if (!bakKontrol) return;
    // Bakış hedefini kök konumundan 3 m ileriye, istenen açıyla koy.
    const mutlak = govdeYaw + yaw;
    const cp = Math.cos(pitch);
    bakHedefi.set(
      kok.position.x + Math.sin(mutlak) * cp * 3,
      kok.position.y + BOY * 0.88 + Math.sin(pitch) * 3,
      kok.position.z + Math.cos(mutlak) * cp * 3,
    );
    bakKontrol.update();
  }

  function pozUygula(poz: Poz, _faz: number, hiz: number): void {
    if (poz === "yürüyor" || poz === "koşuyor") {
      klipOynat(yurumeKlibi, Math.max(0.4, hiz / 1.25));
    } else if (bostaKlibi) {
      klipOynat(bostaKlibi, 1);
    } else {
      klipOynat(null, 1);
    }
    // Oturma/eğilme klibi yok: gövdeyi kabaca eğerek en azından DOĞRU bilgi ver.
    ayar.rotation.z = poz === "oturuyor" ? 0 : 0;
    disKok.rotation.x = poz === "eğiliyor" ? 0.4 : 0;
  }

  function jestUygula(_jest: Jest | null, _ilerleme: number): void {
    // Klip yok — jest bu iskelette görünmez. Sessiz değil: `bilgi.kaynak`
    // klip sayısını taşıyor ve HUD onu basıyor.
  }

  function agizUygula(aciklik: number): void {
    const a = Math.min(1, Math.max(0, aciklik));
    for (const h of agizHedefleri) h.influence = a;
  }

  function bostaUygula(nefes: number, _agirlik: number): void {
    // Klip yoksa en azından nefes görünsün: gövde ölçeği çok hafif oynar.
    if (oynayan) return;
    ayar.scaling.y = olcek * (1 + nefes * 0.006);
  }

  function gozKirp(kapali: number): void {
    for (const h of kirpmaHedefleri) h.influence = Math.min(1, Math.max(0, kapali));
  }

  function gorunur(g: boolean): void { kok.setEnabled(g); }

  function yokEt(): void {
    for (const g of klipler) g.dispose();
    for (const s of sonuc.skeletons) s.dispose();
    for (const m of sonuc.meshes) m.dispose();
    ayar.dispose();
    kok.dispose();
  }

  // Kök kapanışın içinde kalır — sürücü arayüzü Babylon tipine bağlanmasın.
  function konumUygula(x: number, y: number, z: number): void { kok.position.set(x, y, z); }
  function cizimKonumu() { return { x: kok.position.x, y: kok.position.y, z: kok.position.z }; }

  return {
    bilgi, konumUygula, cizimKonumu,
    govdeUygula, basUygula, pozUygula, jestUygula,
    agizUygula, bostaUygula, gozKirp, gorunur, yokEt,
  };
}
