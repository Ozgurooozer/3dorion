// world/avatar/ledYuz.ts — Orion'un yüzü GERÇEK donanımda: üçüncü sürücü.
//
// NEDEN VAR. `AvatarIskeleti` Faz 1'de Babylon'dan kurtuldu; geriye tamamen
// sayısal bir komut seti kaldı. İddia şuydu: bu arayüzü uygulayan şeyin bir
// Babylon sahnesi olmak zorunda değil. Bu dosya o iddianın KANITI — aynı
// `Yurutucu`, aynı arayüz, sahne yerine bir HTTP ucu.
//
// Donanımcıların adı var buna: MIL → SIL → **HIL**. `ros2_control`da
// denetleyici `SystemInterface` ile konuşur ve karşısında Gazebo mu gerçek
// eklem mi olduğunu bilmez. Burada da `Yurutucu` hiçbir şey bilmiyor.
//
// HEDEF DONANIM: `C:\Users\ozigo\led-face-robot`. Bugün 64×32 LED matrisin
// tarayıcıdaki taklidi; ileride ESP32 aynı `{mood, text}` mesajını seri/WiFi
// üzerinden okuyacak (projenin kendi notu böyle diyor). Bizim tarafımız
// değişmiyor: sürücü aynı kalır, altındaki taşıma değişir.
//
// DÜRÜST SINIRLAR — bu bir YÜZ, gövde değil:
//   • Eklem ve servo YOK. Yürüme/duruş/konum uçları sessiz no-op.
//     `IskeletBilgisi` bunu zaten söylüyor (`basDestegi: false`); arayüz
//     kısmi gövdeyi baştan destekliyordu.
//   • Konuşma METNİ bu katmana hiç gelmiyor. Söz `voice/` üzerinden akıyor,
//     iskelet yalnızca ağız AÇIKLIĞINI görüyor. Bu yüzden `text` alanı hiç
//     gönderilmiyor; sunucu dokunulmayan alanı koruyor. Metni de sürmek
//     isteseydik arayüzü TEK sürücü için genişletmek gerekirdi — etmedik.
//
// SAF: Babylon yok, `protocol/` dışında bağımlılık yok.
"use strict";
import type { Jest, Poz } from "../../protocol/niyet.ts";
import type { Vec3 } from "../../protocol/temel.ts";
import type { AvatarIskeleti, IskeletBilgisi } from "./iskelet.ts";

/** LED yüzün tanıdığı ruh hâlleri — donanımın kendi listesi. */
export type YuzHali =
  | "neutral" | "happy" | "sad" | "angry" | "surprised" | "sleepy" | "suspicious";

/**
 * Jest → yüz hâli.
 *
 * Yalnızca yüzde KARŞILIĞI OLAN jestler eşlenir. `el_salliyor` gibi gövde
 * jestlerinin 64×32 bir yüzde karşılığı yok; onlar `neutral` kalır —
 * uydurma bir ifade göstermektense nötr kalmak doğru.
 */
const JEST_HALI: Partial<Record<Jest, YuzHali>> = {
  "gülümsüyor": "happy",
  "kaş_çatıyor": "angry",
  "omuz_silkiyor": "suspicious",
  "bekliyor": "sleepy",
};

export interface LedYuzAyari {
  /** Sunucu adresi. Varsayılan: `led-face-robot`ın portu. */
  adres?: string;
  /**
   * İki gönderim arası asgari süre (ms). Yüz zaten 300 ms'de bir yokluyor;
   * her çizim karesinde POST atmak hattı boğar ve hiçbir şey kazandırmaz.
   */
  asgariAraMs?: number;
  /** Test için: gerçek ağ yerine buraya yazılır. */
  gonder?: (hal: YuzHali) => void;
}

/**
 * LED yüzü bir `AvatarIskeleti` gibi gösterir.
 *
 * Gönderim YALNIZCA hâl DEĞİŞİNCE olur. Aynı hâli tekrar tekrar yollamak
 * donanımda hiçbir şeyi değiştirmez, sadece hattı doldurur.
 */
export function ledYuzKur(ayar: LedYuzAyari = {}): AvatarIskeleti {
  const adres = (ayar.adres ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
  const asgariAra = ayar.asgariAraMs ?? 200;

  const bilgi: IskeletBilgisi = {
    tur: "ledyuz",
    kaynak: `LED yüz (${adres})`,
    agizDestegi: true,
    kirpmaDestegi: true,
    // Gövde ve baş YOK: bu bayrak sayesinde üst katman kafayı döndürmeye
    // çalışmaz. Kısmi gövde arayüzde zaten öngörülmüştü.
    basDestegi: false,
    hamBoy: 0,
  };

  let sonHal: YuzHali | null = null;
  let sonGonderim = 0;
  let jest: Jest | null = null;
  let agiz = 0;

  const gonder = ayar.gonder ?? ((hal: YuzHali) => {
    // Ateşle ve unut: yüz ulaşılamazsa oda DURMAZ. Donanım süsü, omurga değil.
    void fetch(`${adres}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: hal }),
    }).catch((e) => console.warn(`[ledyuz] gonderilemedi: ${e?.message ?? e}`));
  });

  /** Şu anki duruma bakıp yüz hâlini seçer ve gerekiyorsa yollar. */
  function tazele(): void {
    // Konuşurken jest ezilmez: ağız açıksa Orion konuşuyordur ama yüzü
    // hâlâ o anki jestin hâlini taşımalı.
    const hal: YuzHali = (jest && JEST_HALI[jest]) ?? (agiz > 0.1 ? "neutral" : "neutral");
    const simdi = Date.now();
    if (hal === sonHal) return;
    if (simdi - sonGonderim < asgariAra) return;
    sonHal = hal;
    sonGonderim = simdi;
    gonder(hal);
  }

  return {
    bilgi,

    // ── Gövdeye ait uçlar: bu donanımda karşılığı YOK ────────────────────
    // Sessiz no-op, arayüzün kendi kuralı bu ("Desteklenmiyorsa sessiz
    // no-op — `bilgi` söyler"). Yüzün eklemi, bacağı, konumu yok.
    konumUygula(_x: number, _y: number, _z: number): void { /* gövde yok */ },
    cizimKonumu(): Vec3 { return { x: 0, y: 0, z: 0 }; },
    govdeUygula(_yaw: number): void { /* gövde yok */ },
    basUygula(_yaw: number, _pitch: number): void { /* boyun yok — basDestegi:false */ },
    pozUygula(_poz: Poz, _faz: number, _hiz: number): void { /* bacak yok */ },
    bostaUygula(_nefes: number, _agirlik: number): void { /* gövde salınımı yok */ },

    // ── Yüze ait uçlar: gerçekten sürülüyor ──────────────────────────────
    jestUygula(j: Jest | null, _ilerleme: number): void { jest = j; tazele(); },
    agizUygula(aciklik: number): void { agiz = aciklik; tazele(); },
    // Kırpmayı donanım KENDİ yapıyor (firmware'in kendi zamanlayıcısı var).
    // Buradan sürmek 20 Hz'lik bir kırpma akışı yollamak olurdu.
    gozKirp(_kapali: number): void { /* donanim kendi kirpar */ },

    gorunur(g: boolean): void {
      // Görünmezlik = yüzün uyuması. Ekranı kapatmanın donanımdaki karşılığı.
      if (!g) { sonHal = "sleepy"; sonGonderim = Date.now(); gonder("sleepy"); }
    },
    yokEt(): void { sonHal = null; },
  };
}
