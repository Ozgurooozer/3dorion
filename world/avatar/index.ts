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
import { vrmIskeletYukle } from "./vrm.ts";
import type { AvatarIskeleti } from "./iskelet.ts";

/** Varsayılan karakter dosyası — vite `publicDir: assets` sayesinde kök altında. */
export const VARSAYILAN_VRM = "/orion.vrm";

export interface AvatarAyari {
  sahne: Scene;
  saat: Saat;
  spawn?: Vec3;
  vrmYolu?: string;
  /**
   * Oyuncu konumu sağlayıcısı (isteğe bağlı). `bak {tip:"oyuncu"}` ve
   * `git {tip:"oyuncu"}` bunu kullanır; verilmezse o hedefler açık bir `hata`
   * döner — sessizce yanlış yere bakmaz.
   */
  oyuncuKonumu?: () => Vec3;
  /** Başlangıç gövde yaw'ı (radyan, 0 = +Z). */
  yaw?: number;
}

export interface Avatar {
  /** Niyet kuyruğa alınır; doğrulama ÇAĞIRANIN işi (protocol/dogrula.ts). */
  niyet(n: Niyet, niyetId: string): void;
  /** Niyet sonuçlarına abone ol; abonelikten çıkma fonksiyonu döner. */
  sonucDinle(cb: (s: NiyetSonucu) => void): () => void;
  /** protocol `OrionDurumu` biçiminde anlık durum — T4 algı yayarken okur. */
  durum(): OrionDurumu;
  agizAyarla(aciklik: number): void;
  yokEt(): void;
  /** Render karesinden çağrılır: yumuşatma + mikro-hareket. MANTIK YOK. */
  cizimGuncelle(dt: number): void;
  /** 1. şahıs kamerada kendi bedenini gizlemek için. */
  gorunur(g: boolean): void;
  /** Hangi iskeletin yüklendiği — HUD/duman testi bunu basar. */
  iskeletBilgisi(): AvatarIskeleti["bilgi"];
}

/**
 * Avatarı kurar. VRM yüklenemezse UYARI basıp prosedürele düşer — sessiz
 * düşme yok (molp kültürü). Hiçbir koşulda `reject` etmez: dünya avatarsız
 * kalmaz.
 */
export async function avatarKur(ayar: AvatarAyari): Promise<Avatar> {
  const yol = ayar.vrmYolu ?? VARSAYILAN_VRM;

  let iskelet: AvatarIskeleti;
  try {
    iskelet = await vrmIskeletYukle(ayar.sahne, yol);
    console.log(`[avatar] VRM yüklendi: ${iskelet.bilgi.kaynak}`);
    if (!iskelet.bilgi.agizDestegi) console.warn("[avatar] ağız senkronu bu iskelette görünmeyecek (blend shape yok).");
    if (!iskelet.bilgi.basDestegi) console.warn("[avatar] baş ayrı dönmeyecek (boyun kemiği yok).");
  } catch (err) {
    const sebep = err instanceof Error ? err.message : String(err);
    console.warn(
      `[avatar] VRM yüklenemedi ('${yol}'): ${sebep}\n` +
      "[avatar] PROSEDÜREL avatara düşülüyor. Dünya avatarsız kalmıyor, ama karakter " +
      "modeli görünmüyor — dosya yolunu ve assets/ içeriğini kontrol et.");
    iskelet = prosedurelIskelet(ayar.sahne);
  }

  const spawn = ayar.spawn ?? { x: 0, y: 0, z: 0 };
  const yurutucu = new Yurutucu({ spawn, yaw: ayar.yaw ?? 0, oyuncuKonumu: ayar.oyuncuKonumu });
  const beden = new Beden(iskelet);
  beden.yerlestir(spawn.x, spawn.y, spawn.z, ayar.yaw ?? 0);

  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();

  // TÜM mantık 20 Hz tikinde. `runRenderLoop` içinde mantık YOK (K1).
  const birak = ayar.saat.dinle((_t, dt) => {
    const sonuclar = yurutucu.ilerle(dt);
    beden.mantikUygula(yurutucu.gorunum());
    for (const s of sonuclar) {
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
    agizAyarla: (a) => yurutucu.agizAyarla(a),
    cizimGuncelle: (dt) => beden.cizimGuncelle(dt),
    gorunur: (g) => beden.gorunur(g),
    iskeletBilgisi: () => iskelet.bilgi,
    yokEt() { birak(); dinleyiciler.clear(); beden.yokEt(); },
  };
}

export { Yurutucu } from "./yurutucu.ts";
export type { AvatarGorunumu } from "./yurutucu.ts";
export { prosedurelIskelet } from "./prosedurel.ts";
export { vrmIskeletYukle } from "./vrm.ts";
export type { AvatarIskeleti, IskeletBilgisi } from "./iskelet.ts";
