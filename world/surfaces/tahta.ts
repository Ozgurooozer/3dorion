// world/surfaces/tahta.ts — Beyaz tahta yüzeyi: Orion odada iz bırakabilsin.
//
// Odadaki `tahta_yuzey` mesh'i bugüne kadar YER TUTUCUYDU (oda.ts'in kendi
// yorumu öyle diyordu) ve `yaz` niyeti her çağrıldığında hata dönüyordu.
// Protokol yeteneği vardı, araç LLM'e sunuluyordu, uygulaması yoktu.
//
// Çizim yolu monitörle AYNI desen: DynamicTexture + kirli-bayrak. Ama monitör
// hücre ızgarası boyar (terminal), tahta normal metin yazar — insan okuması
// için orantılı yazı tipi ve marker rengi.
//
// Bağımlılık sınırı (K4): yalnızca @babylonjs/*. bridge/, mind/ import YOK.
"use strict";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import { TahtaMetni, tahtaOlcusu, type YazmaSonucu } from "./tahtaYazisi.ts";
import { yuzeyKur, zeminDoldur, type Yuzey, type YuzeyOlcusu } from "./yuzey.ts";

export interface TahtaAyari {
  sahne: Scene;
  /** `tahta_yuzey` mesh'i (world/level/oda.ts üretir). */
  yuzey: AbstractMesh;
  /** Tahtanın dünya ölçüsü (metre) — sütun/satır bundan türer. */
  genislikM: number;
  yukseklikM: number;
}

export interface Tahta {
  /** Tahtaya yaz. `temizle` önce siler. */
  yaz(metin: string, temizle?: boolean): YazmaSonucu;
  sil(): void;
  /** Tahtadaki satırlar — test ve tanılama için. */
  satirlar(): string[];
  /** Kaç sütun × kaç satır sığıyor. */
  olcu(): { sutun: number; satir: number };
  yokEt(): void;
}

/** Doku çözünürlüğü: satır başına piksel. Okunurluk/bellek dengesi. */
const SATIR_PIKSEL = 64;
/** Marker rengi — saf siyah değil, koyu mavi-gri: beyaz tahta kalemi böyle. */
const MARKER = "#1d2733";
const TAHTA_ZEMIN = "#f2f4f1";
/** El yazısına yakın ama okunur bir yığın; hiçbiri yoksa sans-serif'e düşer. */
const YAZI_TIPI = "'Segoe Print', 'Comic Sans MS', 'Trebuchet MS', sans-serif";

export function tahtaKur(ayar: TahtaAyari): Tahta {
  const { sutun, satir } = tahtaOlcusu(ayar.genislikM, ayar.yukseklikM, 10);
  const metin = new TahtaMetni({ sutun, satir });

  /** Ortak altyapi: mesh + doku + kirli-boyama (world/surfaces/yuzey.ts). */
  const yuzey: Yuzey = yuzeyKur({
    sahne: ayar.sahne,
    mesh: ayar.yuzey,
    genislikM: ayar.genislikM,
    yukseklikM: ayar.yukseklikM,
    dikeyPiksel: satir * SATIR_PIKSEL,
    isik: "pano",
    ad: "tahta",
    ciz: (bag, olcu) => cizTahta(bag, olcu, metin.satirlar()),
  });

  /** Tahtayi boyar. Yalnizca icerik; altyapi yuzey.ts'te. */
  function cizTahta(bag: CanvasRenderingContext2D, olcu: YuzeyOlcusu, satirlar: string[]): void {
    zeminDoldur(bag, olcu, TAHTA_ZEMIN);
    const satirYuksekligi = olcu.yukseklik / satir;

    // Ust kenarda ince kalem kanali - tahta hissi.
    bag.fillStyle = "#dfe3de";
    bag.fillRect(0, olcu.yukseklik - satirYuksekligi * 0.18, olcu.genislik, satirYuksekligi * 0.18);

    bag.font = `${Math.round(satirYuksekligi * 0.62)}px ${YAZI_TIPI}`;
    bag.fillStyle = MARKER;
    bag.textBaseline = "top";
    const solBosluk = Math.round(olcu.genislik * 0.03);
    for (let i = 0; i < satirlar.length; i++) {
      bag.fillText(satirlar[i] ?? "", solBosluk, i * satirYuksekligi + satirYuksekligi * 0.18);
    }
    metin.temizlendi();
  }

  return {
    yaz(m, temizle = false) {
      const r = metin.yaz(m, temizle);
      if (metin.kirli) yuzey.kirlet();
      return r;
    },
    sil() { metin.sil(); yuzey.kirlet(); },
    satirlar: () => metin.satirlar(),
    olcu: () => ({ sutun, satir }),
    yokEt() { yuzey.yokEt(); },
  };
}
