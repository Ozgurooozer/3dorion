// world/surfaces/gunluk.ts — Zihin duvarındaki OLAY GÜNLÜĞÜ ekranı.
//
// Orion'un iç işleyişi odada görünür olsun diye. Karar mantığı yok: ne
// tutulacağı ve nasıl sarılacağı `gunlukCekirdek.ts`'te (saf, testli); burası
// yalnızca boyar.
//
// Bağımlılık sınırı (K4): @babylonjs/* + kardeş yüzey modülleri. Köprü yok,
// protokol yok — günlüğe ne yazılacağına kompozisyon kökü karar verir.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { yuzeyKur, RENK, YAZI, zeminDoldur } from "./yuzey.ts";
import type { Yuzey, YuzeyOlcusu } from "./yuzey.ts";
import { gunlukCekirdegiKur, saatBicimle } from "./gunlukCekirdek.ts";
import type { Seviye } from "./gunlukCekirdek.ts";

export interface GunlukAyari {
  sahne: Scene;
  mesh: AbstractMesh;
  genislikM: number;
  yukseklikM: number;
  /** Kaç satır gösterilsin. Yazı boyu bundan türer. */
  satir?: number;
}

export interface GunlukEkrani {
  /** Yeni olay yaz. En yeni altta görünür. */
  ekle(seviye: Seviye, kaynak: string, metin: string): void;
  /** Ekrandaki satırlar — ölçüm ve deneme için. */
  satirlar(): string[];
  temizle(): void;
  yokEt(): void;
}

/** Seviyeden renk. Tek yerde durur ki şema paneliyle aynı dili konuşsun. */
const SEVIYE_RENK: Record<Seviye, string> = {
  bilgi: RENK.metin,
  iyi: RENK.iyi,
  uyari: RENK.uyari,
  hata: RENK.kotu,
};

export function gunlukKur(ayar: GunlukAyari): GunlukEkrani {
  const SATIR = Math.max(6, ayar.satir ?? 16);
  const cekirdek = gunlukCekirdegiKur(300);

  // Dikey piksel: satır başına ~26 piksel + başlık şeridi. Doku çözünürlüğü
  // okunabilirliği belirler; monitörde ölçülen "hücre başına ~11 piksel"
  // eşiği burada da geçerli (bkz. giris.ts monitoreGec notu).
  const dikeyPiksel = Math.min(1024, SATIR * 26 + 64);

  let yuzey: Yuzey;
  let sutun = 40;          // ilk çizimde gerçek ölçüden yeniden hesaplanır
  let sonSatirlar: string[] = [];

  function ciz(bag: CanvasRenderingContext2D, o: YuzeyOlcusu): void {
    zeminDoldur(bag, o, RENK.ekranZemin);

    const kenar = Math.round(o.yukseklik * 0.035);
    const basYuk = Math.round(o.yukseklik * 0.10);

    // ── Başlık şeridi ────────────────────────────────────────────────────
    bag.fillStyle = "#0d1220";
    bag.fillRect(0, 0, o.genislik, basYuk);
    bag.fillStyle = RENK.vurgu;
    bag.font = `600 ${Math.round(basYuk * 0.46)}px ${YAZI.duz}`;
    bag.textBaseline = "middle";
    bag.textAlign = "left";
    bag.fillText("ORION · GÜNLÜK", kenar, basYuk / 2);

    // Sağda: toplam olay ve düşen sayısı. Sessiz kayıp görünür olmalı.
    const sayac = cekirdek.dusen > 0
      ? `${cekirdek.olaylar().length} olay · ${cekirdek.dusen} düştü`
      : `${cekirdek.olaylar().length} olay`;
    bag.fillStyle = RENK.soluk;
    bag.font = `${Math.round(basYuk * 0.36)}px ${YAZI.tek}`;
    bag.textAlign = "right";
    bag.fillText(sayac, o.genislik - kenar, basYuk / 2);

    bag.strokeStyle = RENK.cerceve;
    bag.lineWidth = Math.max(1, Math.round(o.yukseklik * 0.004));
    bag.beginPath();
    bag.moveTo(0, basYuk); bag.lineTo(o.genislik, basYuk); bag.stroke();

    // ── Satırlar ─────────────────────────────────────────────────────────
    const alan = o.yukseklik - basYuk - kenar;
    const satirYuk = alan / SATIR;
    const punto = Math.max(9, Math.round(satirYuk * 0.66));
    bag.font = `${punto}px ${YAZI.tek}`;
    bag.textAlign = "left";

    // Sütun sayısı GERÇEK yazı ölçüsünden: tek aralıklı yazıda 'M' genişliği
    // güvenilir bir hücre ölçüsüdür. Tahminle sarmak taşmaya yol açıyordu.
    const hucre = bag.measureText("M").width || punto * 0.6;
    sutun = Math.max(8, Math.floor((o.genislik - kenar * 2) / hucre));

    const gorunum = cekirdek.gorunum(sutun, SATIR);
    sonSatirlar = gorunum.map((s) => (s.baslik ? `${s.baslik} ${s.metin}` : s.metin));

    // En yeni ALTTA: son satır tabana oturur.
    const tabanY = o.yukseklik - kenar;
    for (let i = gorunum.length - 1; i >= 0; i--) {
      const s = gorunum[i]!;
      const y = tabanY - (gorunum.length - 1 - i) * satirYuk - satirYuk / 2;
      let x = kenar;
      if (s.baslik) {
        bag.fillStyle = RENK.soluk;
        bag.fillText(s.baslik, x, y);
        x += bag.measureText(`${s.baslik} `).width;
      } else {
        // Devam satırı: başlık genişliği kadar içeri girer ki blok okunsun.
        x += hucre * 2;
      }
      bag.fillStyle = SEVIYE_RENK[s.seviye];
      bag.fillText(s.metin, x, y);
    }

    if (gorunum.length === 0) {
      bag.fillStyle = RENK.soluk;
      bag.font = `${punto}px ${YAZI.duz}`;
      bag.fillText("— henüz olay yok —", kenar, basYuk + alan / 2);
    }
  }

  yuzey = yuzeyKur({
    sahne: ayar.sahne,
    mesh: ayar.mesh,
    genislikM: ayar.genislikM,
    yukseklikM: ayar.yukseklikM,
    dikeyPiksel,
    isik: "ekran",
    ad: "gunluk",
    ciz,
  });

  return {
    ekle(seviye, kaynak, metin) {
      const temiz = metin.replace(/\s+/g, " ").trim();
      if (!temiz) return;
      cekirdek.ekle({ ts: Date.now(), seviye, kaynak, metin: temiz });
      yuzey.kirlet();
    },
    satirlar: () => [...sonSatirlar],
    temizle() { cekirdek.temizle(); yuzey.kirlet(); },
    yokEt() { yuzey.yokEt(); },
  };
}

export { saatBicimle };
