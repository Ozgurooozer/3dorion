// protocol/algi.ts — Dünya → Beyin. Orion'un dünya hakkında bildiği her şey.
//
// İki kanal ayrımı burada hayata geçer (bkz. temel.ts Kanal):
//   `tik`    yalnızca "yerel" — 20Hz, mind/ tüketir, LLM görmez.
//   diğerleri "beyin" kanalına terfi edilebilir, ama terfiyi mind/dikkat verir.
"use strict";
import type { Kanal, Vec3 } from "./temel.ts";
import type { Poz, NiyetSonucu } from "./niyet.ts";

export interface OrionDurumu {
  konum:  Vec3;
  /** Bakış yönü, birim vektör. */
  bakis:  Vec3;
  poz:    Poz;
  /** Süreli bir niyet işliyor mu — mind yeni niyet üretmeden önce buna bakar. */
  mesgul: boolean;
  elinde: string | null;
  oturuyor_mu: boolean;
}

export interface OyuncuDurumu {
  konum:   Vec3;
  bakis:   Vec3;
  /** Oyuncu Orion'a bakıyor mu (konik tolerans dahilinde). */
  bakiyor: boolean;
  /** Orion'a metre cinsinden uzaklık. */
  mesafe:  number;
  /** Oyuncunun etkileşimde olduğu yüzey — "monitor" ise terminalde çalışıyor. */
  etkilesim: string | null;
}

export interface YakinNesne {
  ad:      string;
  konum:   Vec3;
  mesafe:  number;
  /** Bu nesneyle ne yapılabilir: "al" | "otur" | "odaklan" | "yaz" ... */
  eylemler: string[];
}

export type Algi =
  /**
   * Yüksek frekanslı dünya nabzı. KANAL: yalnızca "yerel".
   * Beyin kanalına asla doğrudan yazılmaz.
   */
  | { tur: "tik";      t: number; dt: number; orion: OrionDurumu; oyuncu: OyuncuDurumu }
  /** Tam dünya anlık görüntüsü — `sor` niyetine yanıt, ya da oturum başı. */
  | { tur: "dunya";    orion: OrionDurumu; oyuncu: OyuncuDurumu; nesneler: YakinNesne[]; capalar: string[] }
  | { tur: "yakin";    nesneler: YakinNesne[] }
  /** Mikrofondan gelen konuşma. `kesin` false ise ara tanıma sonucu. */
  | { tur: "duydum";   metin: string; kesin: boolean; guven?: number }
  /** Oyuncunun dünyadaki eylemi: odaya girdi, masaya oturdu, monitörü açtı. */
  | { tur: "olay";     ad: string; ayrinti?: Record<string, unknown> }
  /** Monitördeki terminalin son çıktısı — Orion kendi çalıştırdığı işi görür. */
  | { tur: "terminal"; kuyruk: string; kesildi: boolean }
  /** Gönderilmiş bir niyetin akıbeti. */
  | { tur: "sonuc";    sonuc: NiyetSonucu };

export type AlgiTur = Algi["tur"];

/** Varsayılan kanal ataması. mind/dikkat bunu yalnızca daraltabilir, genişletemez. */
export const VARSAYILAN_KANAL: Record<AlgiTur, Kanal> = {
  tik:      "yerel",
  dunya:    "beyin",
  yakin:    "yerel",
  duydum:   "beyin",
  // Dünya olayları beyni ilgilendirir: "Ozyn odaya girdi", "masaya oturdu"
  // tam da Orion'un tepki vermesi gereken şeylerdir. Gürültülü olanları
  // (kamera değişti, ipucu) mind/dikkat DARALTARAK eler — sözleşme gereği
  // daraltmak serbest, genişletmek yasak.
  olay:     "beyin",
  terminal: "beyin",
  sonuc:    "yerel",
};

/**
 * Beyin kanalına giden algıyı LLM'in okuyacağı tek satıra indirir.
 * Amaç: JSON şişkinliğini bağlamdan uzak tutmak. Token cimriliği burada başlar.
 */
export function ozetle(a: Algi): string {
  switch (a.tur) {
    case "duydum":
      return `Ozyn dedi: "${a.metin}"`;
    case "terminal":
      return `Terminal çıktısı${a.kesildi ? " (kısaltıldı)" : ""}:\n${a.kuyruk}`;
    case "dunya": {
      const n = a.nesneler.slice(0, 6).map((x) => `${x.ad}(${x.mesafe.toFixed(1)}m)`).join(", ");
      return `Dünya: ${a.orion.poz}, Ozyn ${a.oyuncu.mesafe.toFixed(1)}m ${a.oyuncu.bakiyor ? "sana bakıyor" : "başka yöne bakıyor"}. Yakında: ${n}`;
    }
    case "yakin":
      return `Yakında: ${a.nesneler.map((x) => x.ad).join(", ")}`;
    case "olay":
      return `Olay: ${a.ad}`;
    case "sonuc":
      return `Niyet ${a.sonuc.niyet_id} → ${a.sonuc.durum}${a.sonuc.not ? ` (${a.sonuc.not})` : ""}`;
    case "tik":
      // Bilerek boş: tik beyin kanalına girmez. Buraya düşmek bir hatadır.
      return "";
  }
}
