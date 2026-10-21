// uygulama/yolTipleri.ts — kompozisyon kökünün YOL TABLOSU: kökteki bütün sonradan kurulan canlı nesneler (SERVİSLER) ve modüller arası olaylar (OLAYLAR).
//
// Bu dosya iletişim ağının haritasıdır: bir servis ya da konu yolda dolaşıyorsa burada yazılıdır; yazılı değilse yoldan geçmiyordur. Yeni olay ya da
// canlı nesne eklemek = buraya bir satır. Tablo yalnız TİP taşır (`import type`), çalışma anında hiçbir modülü yüklemez. Yol'un kendisi: `uygulama/yol.ts`.
"use strict";
import type { Avatar } from "../world/avatar/index.ts";
import type { Kopru } from "../bridge/kopru.ts";
import type { Pano } from "../protocol/pano.ts";
import type { modelSeciciKur } from "../world/arayuz/modelSecici.ts";
import type { ModelSeciciKaynagi } from "../world/arayuz/modelSeciciCekirdek.ts";
import type { stilPenceresiKur } from "../world/arayuz/stilPenceresi.ts";
import type { EtkilesimOlayi, Ipucu } from "../world/player/etkilesim.ts";
import type { Nesne } from "../world/level/nesneKaydi.ts";
import type { Yol } from "./yol.ts";

/**
 * Sonradan kurulan canlı nesneler: avatar ve köprü asenkron/ardışık kurulur, tüketiciler kurulumdan ÖNCE bağlanır. `yol.al(ad)` kurulana kadar null verir
 * (eskiden modül kapsamlı `let x: T | null` + `() => x` getter'ı). Aynı ad ikinci kez kaydedilemez.
 */
export interface Servisler {
  /** Orion'un bedeni; `avatarKur` bitince kaydolur. */
  orion: Avatar;
  /** Beyin ↔ dünya köprüsü; avatar hazır olunca `beyniBagla` kurar. */
  kopru: Kopru;
  /** Devre panosu kayıt defteri (teyit/Esc yığını ve senaryolar okur); köprüyle birlikte kurulur. */
  pano: Pano;
  /** Model seçici penceresi (M); beyin bağlanınca kurulur. */
  modelSecici: ReturnType<typeof modelSeciciKur>;
  /** M seçicinin kaynağı (kartlar, durum, `sec` → devre panosunun teyit yolu): ayar paneli · Beyin modeli AYNI kaynağı kullanır (spec 34). */
  modelKaynagi: ModelSeciciKaynagi;
  /** Ova stil deneme araçları (G); beyin bağlanınca kurulur. */
  stilPenceresi: ReturnType<typeof stilPenceresiKur>;
}

/**
 * Modüller arası olaylar. Dünya yayıcıları (world/ yolu GÖRMEZ, K4) kökte bir adaptörle yola çevrilir; abone olan uygulama modülleri yalnız yolu bilir.
 * `tik` ve diğer `world/` içi yayıcılar (Saat, kararKaydi …) burada YOK: `uygulama/`da tek aboneleri var, yoldan geçirmek abonelik sayısını azaltmaz.
 */
export interface Olaylar {
  /** Oyuncu etkileşim tuşuyla (`F`) bir çapayla etkileşime girdi (`world/player/etkilesim.ts`). */
  "etkilesim.basladi": EtkilesimOlayi;
  /** Aktif etkileşim bitti. */
  "etkilesim.bitti": EtkilesimOlayi;
  /** Ekranda gösterilecek ipucu değişti; `null` = ipucu yok. */
  "etkilesim.ipucu": Ipucu | null;
  /** Fareyle seçilen nesne değişti (spec 28); `null` = seçim kalktı. Vurgu ve HUD abone. */
  "nesne.secildi": Nesne | null;
}

/** Kökün yolu: bu iki tabloyla kurulmuş `Yol`. Modüller yolu bu adla alır. */
export type KokYolu = Yol<Olaylar, Servisler>;
