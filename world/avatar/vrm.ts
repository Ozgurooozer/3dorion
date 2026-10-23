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
import type { AvatarIskeleti, IskeletBilgisi, IskeletGorunusu } from "./iskelet.ts";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { BOY } from "./prosedurel.ts";
import { uzuvlariCoz } from "./uzuvEslemesi.ts";
import { uzuvSurucusuKur } from "./uzuvSurucusu.ts";
import type { UzuvDegeri } from "./klipOrnekleyici.ts";
import type { Uzuv } from "../../protocol/animasyon.ts";

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
export async function vrmIskeletYukle(sahne: Scene, yol: string, gorunus: IskeletGorunusu = {}): Promise<AvatarIskeleti> {
  const sonuc = await ImportMeshAsync(yol, sahne, { pluginExtension: ".glb" });
  if (sonuc.meshes.length === 0) throw new Error(`VRM boş geldi: ${yol}`);
  const onek = gorunus.onek ?? "orion";

  const kok = new TransformNode(`${onek}_vrm_kok`, sahne);
  // Babylon glTF yükleyicisi bir `__root__` düğümü üretir; onu kendi kökümüze
  // bağlıyoruz ki konum/yaw'ı tek yerden sürelim.
  const disKok = sonuc.meshes[0]!;
  const ayar = new TransformNode(`${onek}_vrm_ayar`, sahne);

  // RENK (spec 33, ikinci beden): her yükleme KENDİ malzemesini üretir (başsız ölçüm 2026-10-21: iki yüklemede ortak malzeme 0),
  // yani boyamak öbür bedene sızmaz. PBR'de doku varsa renk onu çarpar; Oyuncu bedeniyle aynı dönüşüm (sRGB → doğrusal).
  if (gorunus.renk) {
    const renk = Color3.FromHexString(gorunus.renk);
    for (const m of sonuc.meshes) {
      if (m.material instanceof PBRMaterial) m.material.albedoColor = renk.toLinearSpace();
      else if (m.material instanceof StandardMaterial) m.material.diffuseColor = renk.clone();
    }
  }
  // Klip kökü (Dilim 5a): kök ile ölçek/yön düzeltmesi ARASINDA, ayak hizasında ve metre ölçeğinde. Klibin `kok` uzvu (eğilme, zıplama) buna yazılır
  // ve kol/baş dönmeleri bunun çerçevesinde okunur; kökün kendisi konum/yaw taşımaya devam eder.
  const klipKok = new TransformNode(`${onek}_klip_kok`, sahne);
  klipKok.parent = kok;
  ayar.parent = klipKok;
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
  // Oturma üçlüsü (assets/orion-lowpoly.glb, 2026-09-26). Süreleri yürütücünün
  // kök hareketine EŞİT yazıldı: `otur` 0.8 s = OTURMA_SURESI, `kalk` 0.7 s =
  // KALKMA_SURESI. Kök o sürede doğrusal kayıp 0.16 m yükselirken klipteki
  // ayaklar bunu tersine telafi eder — ayak zeminde sabit kalır. Süre
  // değişirse klip yeniden bake edilmeli (kaynak: assets/kaynak/orion-lowpoly.blend).
  // `otur` ve `oturuyor` ayrı regex: /otur/ ikisini de yakalardı.
  const oturKlibi = klipler.find((g) => /^otur$|sit_?down/i.test(g.name)) ?? null;
  const oturuyorKlibi = klipler.find((g) => /^oturuyor$|sit(ting)?_?idle/i.test(g.name)) ?? null;
  const kalkKlibi = klipler.find((g) => /^kalk$|stand_?up/i.test(g.name)) ?? null;
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

  function klipOynat(g: AnimationGroup | null, hizOrani: number, dongu = true): void {
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
    if (g) { g.speedRatio = hizOrani; g.start(dongu); }
  }

  // Tek seferlik geçiş (otur/kalk) bitene kadar döngü klibine geçilmez; yoksa
  // 20 Hz tik ilk karede döngüye atlar ve geçiş hiç görünmez. Yürüme ise
  // geçişi KESER: kalkarken `git` gelirse bacaklar beklemez.
  let oncekiPoz: Poz | null = null;
  let gecis: AnimationGroup | null = null;

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
    const yuruyor = poz === "yürüyor" || poz === "koşuyor";
    if (oncekiPoz !== null && poz !== oncekiPoz) {
      if (poz === "oturuyor" && oturKlibi) gecis = oturKlibi;
      else if (oncekiPoz === "oturuyor" && !yuruyor && kalkKlibi) gecis = kalkKlibi;
      else gecis = null;
      if (gecis) { klipOynat(null, 1); klipOynat(gecis, 1, false); }
    }
    oncekiPoz = poz;
    if (gecis && gecis.isPlaying && !yuruyor) {
      // geçiş sürüyor — döngüye dokunma
    } else if (yuruyor) {
      gecis = null;
      klipOynat(yurumeKlibi, Math.max(0.4, hiz / 1.25));
    } else if (poz === "oturuyor" && oturuyorKlibi) {
      klipOynat(oturuyorKlibi, 1);
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
    // Modelde jest klibi yok — yordamsal jest bu iskelette görünmez. Sessiz değil: `bilgi.kaynak` klip sayısını taşıyor ve HUD onu basıyor.
    // GÖRÜNEN YOL (Dilim 5a): `jest` niyetinin `klip` alanı → JSON klibi kemiklere `klipUygula` ile biner (aşağıda).
  }

  // ── JSON klip (Dilim 5a) ────────────────────────────────────────────────
  // Kemikler glTF'te TransformNode'a bağlı; ad BU YÜKLEMENİN düğümlerinde aranır (sahnede aranmaz: Orion ile Flash aynı glb'den aynı adları taşır,
  // `getTransformNodeByName` ilkini dönüp Flash'ın klibini Orion'un koluna uygulardı).
  const kemikDugumleri = uzuvlariCoz("vrm", (ad) => sonuc.transformNodes.find((n) => n.name === ad) ?? null);
  if (kemikDugumleri.eksik.length > 0) {
    console.warn(`[avatar/vrm] '${yol}' içinde klip uzuvlarının kemiği yok: ${kemikDugumleri.eksik.join(", ")} — bu izler atlanacak.`);
  }
  const surucu = uzuvSurucusuKur(klipKok, kemikDugumleri.dugumler);
  let bekleyenKlip: readonly UzuvDegeri[] = [];
  // ZAMANLAMA: kemikleri `bosta`/`yuru` klibi her karede `scene.animate()` içinde yazar. Orion'un çizim güncellemesi `scene.render()`dan ÖNCE koşar
  // (giris.ts döngüsü), Flash'ınki `onBeforeRender`da (animasyondan sonra, bakış denetleyicisiyle). Klip ikisinin de ÜSTÜNE binsin diye değerler
  // burada saklanır ve render hedeflerinden hemen önce (animasyon + bütün onBeforeRender işleri bittikten sonra, iskelet hazırlanmadan önce) uygulanır.
  const klipGozcusu = sahne.onBeforeRenderTargetsRenderObservable.add(() => surucu.uygula(bekleyenKlip));
  function klipUygula(degerler: readonly UzuvDegeri[]): void { bekleyenKlip = degerler; }
  /** Control Rig: eklem noktasının dünya konumu (animasyon yazdıktan sonraki hâl; zincir kökten tazelenir). */
  function uzuvKonumu(u: Uzuv): { x: number; y: number; z: number } | null {
    const d = kemikDugumleri.dugumler.get(u);
    if (!d) return null;
    const zincir: TransformNode[] = [];
    for (let x: TransformNode | null = d; x; x = x.parent as TransformNode | null) zincir.push(x);
    for (let i = zincir.length - 1; i >= 0; i--) zincir[i]!.computeWorldMatrix(true);
    const p = d.getAbsolutePosition();
    return { x: p.x, y: p.y, z: p.z };
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
    sahne.onBeforeRenderTargetsRenderObservable.remove(klipGozcusu);
    for (const g of klipler) g.dispose();
    for (const s of sonuc.skeletons) s.dispose();
    for (const m of sonuc.meshes) m.dispose();
    ayar.dispose();
    klipKok.dispose();
    kok.dispose();
  }

  // Kök kapanışın içinde kalır — sürücü arayüzü Babylon tipine bağlanmasın.
  function konumUygula(x: number, y: number, z: number): void { kok.position.set(x, y, z); }
  function cizimKonumu() { return { x: kok.position.x, y: kok.position.y, z: kok.position.z }; }

  return {
    bilgi, konumUygula, cizimKonumu,
    govdeUygula, basUygula, pozUygula, jestUygula,
    agizUygula, bostaUygula, gozKirp, gorunur, yokEt,
    klipUzuvlari: surucu.uzuvlar, klipUygula, uzuvKonumu,
  };
}
