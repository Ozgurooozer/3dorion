// world/avatar/index.ts — Avatarın dışa verdiği TEK yüzey.
//
// `giris.ts` yalnızca burayı çağırır. İçeride ne olduğu (VRM mi prosedürel mi,
// hangi yol bulma, hangi durum makinesi) birleştirme noktasını ilgilendirmez.
//
// KATI SINIR (K4): bu dizin `bridge/`, `mind/`, `voice/` ya da molp'tan hiçbir
// şey import ETMEZ. Ses senkronu `agizAyarla()` kancasıyla DIŞARIDAN sürülür —
// `voice/` import edilseydi dünya beyne bağımlı olurdu.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Vec3 } from "../../protocol/temel.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import type { OrionDurumu } from "../../protocol/algi.ts";
import type { Saat } from "../engine/tik.ts";
import { Yurutucu } from "./yurutucu.ts";
import { Beden } from "./beden.ts";
import { prosedurelIskelet } from "./prosedurel.ts";
import { iskeletSec } from "./iskeletSecim.ts";
import { vrmIskeletYukle } from "./vrm.ts";
import type { AvatarIskeleti } from "./iskelet.ts";
import type { Yer } from "../yer/yer.ts";
import type { KlipBulucu } from "./klipKutuphanesi.ts";
import type { Uzuv } from "../../protocol/animasyon.ts";
import type { UzuvDegeri } from "./klipOrnekleyici.ts";

/**
 * Varsayılan karakter dosyası — vite `publicDir: assets` sayesinde kök altında.
 *
 * 2026-09-27: low-poly beden (kaynak `assets/kaynak/orion-lowpoly.blend`,
 * üretim `tools/avatar-blender/`). 52 kemik VRM humanoid adlı, 5 klip
 * (bosta/yuru/otur/oturuyor/kalk). Eski `/orion.vrm` Cesium_Man örneğiydi.
 */
export const VARSAYILAN_VRM = "/orion-lowpoly.glb";

export interface AvatarAyari {
  sahne: Scene;
  saat: Saat;
  spawn?: Vec3;
  vrmYolu?: string;
  /**
   * Görünüşü ifadeye tercih et: ağzı oynamayan bir VRM olsa bile kullan.
   * Varsayılan false — konuşma bu projenin çekirdek yeteneği.
   */
  vrmZorla?: boolean;
  /**
   * Oyuncu konumu sağlayıcısı (isteğe bağlı). `bak {tip:"oyuncu"}` ve
   * `git {tip:"oyuncu"}` bunu kullanır; verilmezse o hedefler açık bir `hata`
   * döner — sessizce yanlış yere bakmaz.
   */
  oyuncuKonumu?: () => Vec3;
  /** Başlangıç gövde yaw'ı (radyan, 0 = +Z). */
  yaw?: number;
  /** Orion'un bulunduğu yer (spec 24); yürütücüye geçer. Varsayılan oda. */
  yer?: () => Yer;
  /**
   * Düğüm/malzeme adlarının ÖNEKİ (varsayılan "orion"). İkinci beden (Flash, spec 33) kendi önekini alır. NEDEN: başsız deneme
   * (2026-10-21) — iki yüklemede de kök `orion_vrm_kok` adını aldı; `getTransformNodeByName` (uygulama/yerGecisi.ts) İLKİNİ döner,
   * yükleme sırası değişince Orion yerine Flash'ı bulurdu.
   */
  ad?: string;
  /** Gövde rengi (#rrggbb). Verilmezse modelin kendi rengi — Orion'un görünüşü değişmez. Her yükleme kendi malzemesini üretir (ölçüldü). */
  renk?: string;
  /** Oturma izni (spec 33): çapa başka bir bedenin koltuğuysa onun adı, boşsa null; yürütücüye geçer. Verilmezse her koltuk boş. */
  koltukDolu?: (capa: string) => string | null;
  /**
   * JSON animasyon klipleri (spec 35 Dilim 5a): `jest` niyetinin `klip`i buradan aranır. Kap boş verilip sonradan doldurulabilir (yükleme asenkron).
   * Verilmezse klipli jest nedenle `hata` döner.
   */
  klipler?: KlipBulucu;
}

export interface Avatar {
  /** Niyet kuyruğa alınır; doğrulama ÇAĞIRANIN işi (protocol/dogrula.ts). */
  niyet(n: Niyet, niyetId: string): void;
  /** Niyet sonuçlarına abone ol; abonelikten çıkma fonksiyonu döner. */
  sonucDinle(cb: (s: NiyetSonucu) => void): () => void;
  /** protocol `OrionDurumu` biçiminde anlık durum — T4 algı yayarken okur. */
  durum(): OrionDurumu;
  /** Başka bir noktaya taşı (kapıdan geçiş, spec 24); süren iş `iptal` sonucu yayar. */
  isinla(x: number, z: number, yaw: number): void;
  agizAyarla(aciklik: number): void;
  yokEt(): void;
  /** Render karesinden çağrılır: yumuşatma + mikro-hareket. MANTIK YOK. */
  cizimGuncelle(dt: number): void;
  /** 1. şahıs kamerada kendi bedenini gizlemek için. */
  gorunur(g: boolean): void;
  /** Hangi iskeletin yüklendiği — HUD/duman testi bunu basar. */
  iskeletBilgisi(): AvatarIskeleti["bilgi"];
  /** Avatarın ekranda göründüğü konum — mantık konumundan ayrı. */
  cizimKonumu(): Vec3;
  /** Tuttuğu koltuk (kanonik çapa adı) ya da null — oturmaya giderken de tutar (spec 33). */
  koltugu(): string | null;
  /**
   * CONTROL RIG (spec 38): uzuv değerleri (gövde uzayı, derece/metre) klibin YERİNE her karede uygulanır — sekansın bir karesini bedende göstermek,
   * rig ile pozu düzenlemek için. null = rig modu kapalı. Karar vermez; yalnız sunum (jest/klip niyet yolu değişmez).
   */
  rigPozu(degerler: readonly UzuvDegeri[] | null): void;
  /** Uzvun eklem noktasının dünya konumu (rig kontrol şekilleri buraya konur); gövdede yoksa null. */
  uzuvKonumu(u: Uzuv): Vec3 | null;
  /** Gövdenin ÇİZİLEN yaw'ı (radyan, dünya): rig şekilleri gövdeyle hizalansın. */
  cizimYaw(): number;
}

/**
 * Avatarı kurar. VRM yüklenemezse UYARI basıp prosedürele düşer — sessiz
 * düşme yok (molp kültürü). Hiçbir koşulda `reject` etmez: dünya avatarsız
 * kalmaz.
 */
export async function avatarKur(ayar: AvatarAyari): Promise<Avatar> {
  const yol = ayar.vrmYolu ?? VARSAYILAN_VRM;
  const gorunus = { ...(ayar.ad ? { onek: ayar.ad } : {}), ...(ayar.renk ? { renk: ayar.renk } : {}) };

  // Seçim ölçütü "yüklendi mi" DEĞİL, "ifade edebiliyor mu" — bkz.
  // iskeletSecim.ts. Yüklenen ama ağzı oynamayan bir model eskiden kabul
  // ediliyor, yalnızca uyarı basılıyordu; sonuç olarak ölçülmüş ağız senkronu
  // (tepe_agiz=1.000) ekranda HİÇ görünmüyordu.
  let vrmIskelet: AvatarIskeleti | null = null;
  try {
    vrmIskelet = await vrmIskeletYukle(ayar.sahne, yol, gorunus);
    console.log(`[avatar] VRM okundu: ${vrmIskelet.bilgi.kaynak}`);
  } catch (err) {
    const sebep = err instanceof Error ? err.message : String(err);
    console.warn(`[avatar] VRM yüklenemedi ('${yol}'): ${sebep}`);
  }

  const karar = iskeletSec(vrmIskelet?.bilgi ?? null, { vrmZorla: ayar.vrmZorla ?? false });
  console.log(`[avatar] iskelet=${karar.secim} — ${karar.gerekce}`);

  let iskelet: AvatarIskeleti;
  if (karar.secim === "vrm" && vrmIskelet) {
    iskelet = vrmIskelet;
  } else {
    // Reddedilen VRM sahnede KALMASIN: mesh'leri yok edilir. Yoksa görünmeyen
    // ama yüklenmiş bir iskelet bellekte ve çizim listesinde durur.
    vrmIskelet?.yokEt();
    iskelet = prosedurelIskelet(ayar.sahne, gorunus);
  }

  const spawn = ayar.spawn ?? { x: 0, y: 0, z: 0 };
  const yurutucu = new Yurutucu({
    spawn, yaw: ayar.yaw ?? 0, oyuncuKonumu: ayar.oyuncuKonumu, yer: ayar.yer, ...(ayar.koltukDolu ? { koltukDolu: ayar.koltukDolu } : {}),
    ...(ayar.klipler ? { klipler: ayar.klipler } : {}),
    // Uzvu olmayan gövde (LED yüz) boş küme: her iz "uygulanamadı" sayılır, klibin anlamı jest olarak görünür.
    klipUzuvlari: iskelet.klipUzuvlari ?? new Set(),
  });
  const beden = new Beden(iskelet);
  beden.yerlestir(spawn.x, spawn.y, spawn.z, ayar.yaw ?? 0);

  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  /** Uygulanamayan izleri günlüğe BİR KEZ (klip başına) yaz: el sallayan grafik her turda aynı satırı basmasın. */
  const bildirilenKlipler = new Set<string>();
  const atlananiBildir = (s: NiyetSonucu): void => {
    if (s.durum !== "basladi" || !s.veri || !("atlanan" in s.veri)) return;
    const v = s.veri as { klip?: unknown; atlanan?: unknown };
    if (!Array.isArray(v.atlanan) || v.atlanan.length === 0 || typeof v.klip !== "string" || bildirilenKlipler.has(v.klip)) return;
    bildirilenKlipler.add(v.klip);
    console.warn(`[avatar] ${ayar.ad ?? "orion"} gövdesinde (${iskelet.bilgi.tur}) '${v.klip}' klibinin ${v.atlanan.length} izi uygulanamadı: ${v.atlanan.join(", ")} (bu gövdede o uzuv yok)`);
  };

  // TÜM mantık 20 Hz tikinde. `runRenderLoop` içinde mantık YOK (K1).
  const birak = ayar.saat.dinle((_t, dt) => {
    const sonuclar = yurutucu.ilerle(dt);
    beden.mantikUygula(yurutucu.gorunum());
    for (const s of sonuclar) {
      atlananiBildir(s);
      for (const d of dinleyiciler) {
        // Bir dinleyicinin hatası dünyayı durdurmaz ama SESSİZ de kalmaz.
        try { d(s); } catch (err) { console.error("[avatar] sonuç dinleyicisi hatası:", err); }
      }
    }
  });

  return {
    niyet: (n, id) => yurutucu.niyet(n, id),
    sonucDinle(cb) { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; },
    durum: () => yurutucu.durum(),
    isinla(x, z, yaw) {
      const sonuclar = yurutucu.isinla(x, z, yaw);
      const k = yurutucu.durum().konum;
      beden.yerlestir(k.x, k.y, k.z, yaw);
      for (const s of sonuclar) for (const d of dinleyiciler) {
        try { d(s); } catch (err) { console.error("[avatar] sonuç dinleyicisi hatası:", err); }
      }
    },
    agizAyarla: (a) => yurutucu.agizAyarla(a),
    cizimGuncelle: (dt) => beden.cizimGuncelle(dt),
    gorunur: (g) => beden.gorunur(g),
    iskeletBilgisi: () => iskelet.bilgi,
    /** Avatarın EKRANDA göründüğü konum (mantık konumu değil). Testler için. */
    cizimKonumu: () => iskelet.cizimKonumu(),
    koltugu: () => yurutucu.koltugu(),
    rigPozu: (d) => beden.rigPozu(d),
    uzuvKonumu: (u) => iskelet.uzuvKonumu?.(u) ?? null,
    cizimYaw: () => beden.cizimYaw(),
    yokEt() { birak(); dinleyiciler.clear(); beden.yokEt(); },
  };
}

export { Yurutucu } from "./yurutucu.ts";
export type { AvatarGorunumu } from "./yurutucu.ts";
export { prosedurelIskelet } from "./prosedurel.ts";
export { vrmIskeletYukle } from "./vrm.ts";
export type { AvatarIskeleti, IskeletBilgisi } from "./iskelet.ts";
export { orionGozuKur } from "./goz.ts";
// JSON animasyon klipleri (spec 35 Dilim 5a): kütüphane + yükleyici kompozisyon kökünde kurulur (okuma `fetch`), gövde tablosu belge/ölçüm için.
export { klipKutuphanesiKur, klipleriYukle, listeliKlasoruYukle, KLIP_DIZINI, KLIP_LISTESI } from "./klipKutuphanesi.ts";
// Sekans (spec 36): değerlendirici klibin örnekleyicisini KULLANIR (yumuşatma ve zaman kuralı tek yerde; kopya yok).
export { izDegeri, klipOrnekle, klipZamani } from "./klipOrnekleyici.ts";
export type { UzuvDegeri } from "./klipOrnekleyici.ts";
export type { KlipBulucu, KlipKutuphanesi, KlipHatasi } from "./klipKutuphanesi.ts";
export { UZUV_ESLEMESI } from "./uzuvEslemesi.ts";
// Control Rig (spec 38): kontrol kaydı, poz/sürükleme matematiği, sahne gösterimi ve kanonik zincirler uygulama katmanına BU yüzden açılır (alt-sistem kamu yüzü).
export { rigGosterimiKur } from "./rig/gosterim.ts";
export type { RigGosterimi, RigKaynagi, RigModu, RigUzayi, RigVurusu } from "./rig/gosterim.ts";
export { KONTROLLER, KONTROL_GRUPLARI, grupBul, karsiUzuv, kontrolBul, uzuvGrubu, uzuvKontrolu, zincirKontrolleri } from "./rig/kontroller.ts";
export type { Kontrol, KontrolGrubu } from "./rig/kontroller.ts";
export { RIG_EKSENLERI, dereceYazisi, dunyaEkseniGovdeye, eksendeDondur, eksenVektorundeDondur, eulerEsit, kisEuler, yansit } from "./rig/poz.ts";
export type { Euler, RigEkseni } from "./rig/poz.ts";
export { surukleAcisi, surukleOtelemesi } from "./rig/surukleme.ts";
export type { V3 } from "./rig/surukleme.ts";
export { ZINCIR_ADLARI } from "./zincirler.ts";
