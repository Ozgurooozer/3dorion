// uygulama/ajanlar/ajanAlgisi.ts — BİR AJANIN DÜNYADAN ALDIĞI ALGI (spec 33): Flash'ın "gözü".
//
// Orion'un dünya olayları (`ozyn_yaklasti`, `ozyn_sana_bakti`…) `terminalAlgisi.ts`'te ORION'UN gövdesine göre üretilir ve yalnız Orion'un köprüsüne
// gider; Flash'ın köprüsüne dünyadan HİÇBİR şey gelmiyordu (yalnız Ozyn'in yazdığı söz ve kendi bedeninin sonuçları). Burası aynı olay üreticisini
// (`world/olayUretici.ts`, histerezis ve soğuma dahil) AJANIN KENDİ gövdesine göre koşturur: kopya yok, kural aynı, bakış noktası farklı.
//
// Mesafe ve "Ozyn bana bakıyor" her ajan için ayrıdır, o yüzden Oyuncu'nun ham durumu (`oyuncuDurumu()`, Orion'a göre hesaplı) burada ajanın
// gövdesine göre YENİDEN hesaplanır (`ajandanOyuncu`). Bakış konisi oyuncu.ts'in sabitidir (ikinci kopya yok).
//
// Tepki VERİDİR (`flash/npcTanimi.ts` `tepkiler`): olay adı → niyet. Kod NPC'yi tanımaz; ikinci bir NPC = ikinci bir tanım. Tepki yalnız gövde BOŞKEN
// verilir: yürüyen, oturmaya giden, grafiğin sürdüğü bir beden ("kapıya git" ortasında) kendiliğinden başını çevirip işini bölmez.
"use strict";
import type { Niyet } from "../../protocol/niyet.ts";
import type { Algi, OrionDurumu, OyuncuDurumu } from "../../protocol/algi.ts";
import type { Vec3 } from "../../protocol/temel.ts";
import { OlayUretici, type UretilenOlay } from "../../world/olayUretici.ts";
import { BAKIS_KOSINUS } from "../../world/player/bakis.ts";
import type { NpcTepkisi } from "../../flash/npcTanimi.ts";

/** Gövdenin "bakılan nokta"sı (zeminden m): Orion'un varsayılanı (oturma + 0.5) ile aynı sınıftan, göğüs hizası. */
export const GOVDE_ORTASI = 1.0;

/** Oyuncunun ham durumunu (Orion'a göre) `ben` gövdesinin gözünden yeniden hesaplar: mesafe ve "bana bakıyor". Konum/bakış/etkileşim aynen kalır. */
export function ajandanOyuncu(ham: OyuncuDurumu, ben: Vec3): OyuncuDurumu {
  const dx = ben.x - ham.konum.x, dy = ben.y + GOVDE_ORTASI - ham.konum.y, dz = ben.z - ham.konum.z;
  const mesafe = Math.hypot(dx, dy, dz);
  const kosinus = mesafe > 1e-3 ? (ham.bakis.x * dx + ham.bakis.y * dy + ham.bakis.z * dz) / mesafe : 0;
  return { ...ham, mesafe, bakiyor: mesafe > 1e-3 && kosinus >= BAKIS_KOSINUS };
}

export interface AjanAlgisiGirdisi {
  /** Ajanın gövdesi (yoksa algı üretilmez). */
  beden: () => { durum(): OrionDurumu } | null;
  /** Oyuncunun ham durumu (`oyuncu.oyuncuDurumu()`). */
  oyuncu: () => OyuncuDurumu;
  /** Ajanın köprüsüne algı ver. */
  algi: (a: Algi) => void;
  /** Olaya bedensel tepki (veri: NPC tanımı). Verilmezse algı yalnız köprüye gider. */
  tepkiler?: readonly NpcTepkisi[];
  /** Tepkinin niyeti (ajanın gövdesine, kendi niyet kimliğiyle). */
  niyet?: (n: Niyet) => void;
  /** Günlük/konsol izi (olay adı). */
  iz?: (olay: string) => void;
}

export interface AjanAlgisi {
  /** 20 Hz mantık tikinden çağrılır. */
  tikle(msSimdi: number): void;
  /**
   * Olay ABONESİ (spec 35 dilim 2: dinlemedeki düğüm grafikleri). Aynı üretilen olay hem köprüye hem aboneye gider — ikinci bir olay üreticisi YOK
   * (iki üretici iki ayrı histerezis/soğuma tutar ve "Flash'a yaklaştı" köprüde ve grafikte farklı anlarda olurdu). Çıkış fonksiyonu döner.
   */
  olayDinle(cb: (o: UretilenOlay) => void): () => void;
}

export function ajanAlgisiKur(g: AjanAlgisiGirdisi): AjanAlgisi {
  const uretici = new OlayUretici();
  const aboneler = new Set<(o: UretilenOlay) => void>();
  return {
    tikle(ms) {
      const b = g.beden();
      if (!b) return;
      const d = b.durum();
      for (const o of uretici.ornekle(ms, d, ajandanOyuncu(g.oyuncu(), d.konum))) {
        g.iz?.(o.ad);
        g.algi({ tur: "olay", ad: o.ad, ...(o.ayrinti ? { ayrinti: o.ayrinti } : {}) });
        const tepki = g.tepkiler?.find((t) => t.olay === o.ad);
        // Beden boş değilse tepki YOK (yürüyüşü bölmez); köprüye giden algı yine gitti.
        if (tepki && g.niyet && !d.mesgul) g.niyet(tepki.niyet);
        // Aboneler TEPKİDEN SONRA: grafiğin ilk niyeti tepkinin niyetinden sonra bedene ulaşsın (sonraki niyet öncekini keser; tersi olsaydı refleksin
        // "bak"ı grafiğin "bak"ını iptal eder, grafik "iş kesildi" diye düşerdi). Bir abonenin hatası ötekileri ve köprüyü kesmez.
        for (const cb of [...aboneler]) {
          try { cb(o); } catch (err) { console.error("[ALGI] olay abonesi hatası:", err); }
        }
      }
    },
    olayDinle(cb) { aboneler.add(cb); return () => { aboneler.delete(cb); }; },
  };
}
