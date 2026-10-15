// uygulama/webMonitoru.ts — Ofisteki 3. monitör (groma haritası): ana süreçteki ekran dışı pencere ile ekran yüzeyini bağlar.
// Ön kayıt: docs/olcum/on-kayit-groma-monitoru-1.md. Kareler `host/webMonitor.js`ten JPEG gelir, `world/surfaces/web/webEkrani.ts` çizer;
// fare/tekerlek burada normalleştirilmiş (0..1) koordinatla ana sürece gider (sayfa pikseline orada çevrilir). Klavye iletilmez.
"use strict";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Kopru as KabukKoprusu } from "../host/kopru.ts";
import { webEkraniKur, uvdenSayfaya, type WebDurumu, type WebEkrani } from "../world/surfaces/web/webEkrani.ts";
import { GROMA } from "../world/level/olculer.ts";

export type WebKopru = Pick<KabukKoprusu, "webmonKomut" | "webmonDinle">;
export type FareDugmesi = "left" | "right" | "middle";

export interface WebMonitoru {
  readonly ekran: WebEkrani;
  /** Ekran dışı pencereyi açar ve sayfayı yükler. Kabuk yoksa (dev/tarayıcı) false ve ekran "yok" der. */
  baslat(): Promise<boolean>;
  durum(): WebDurumu;
  /** Ekrandaki doku UV'sine fare tıklaması (bas + bırak). Dönüş: iletildi mi (sayfa yoksa false). */
  tikla(u: number, v: number, dugme?: FareDugmesi): boolean;
  bas(u: number, v: number, dugme?: FareDugmesi): boolean;
  birak(u: number, v: number, dugme?: FareDugmesi): boolean;
  hareket(u: number, v: number): boolean;
  tekerlek(u: number, v: number, dy: number, dx?: number): boolean;
  /** Pencereyi yıkar ve aboneliği bırakır (uygulama kapanışı / testler). */
  kapat(): void;
}

export interface WebMonitoruAyari {
  sahne: Scene;
  ekranMesh: AbstractMesh;
  /** Kabuk köprüsü (`window.kopru`); yoksa null → ekran "yok" der. */
  kopru: () => WebKopru | null | undefined;
  /** Hazır ekran (testte sahte; Babylon yüzeyi Node'da kurulamaz). Verilmezse `ekranMesh` üzerine kurulur. */
  ekran?: WebEkrani;
}

export function webMonitoruKur(a: WebMonitoruAyari): WebMonitoru {
  const ekran = a.ekran ?? webEkraniKur({ sahne: a.sahne, mesh: a.ekranMesh, genislikM: GROMA.genislik, yukseklikM: GROMA.yukseklik });
  let durumu: WebDurumu = "baglaniyor";
  let abonelik: (() => void) | null = null;
  const durumYaz = (d: WebDurumu) => { durumu = d; ekran.durum(d); };

  const gonder = (yuk: { tip: "hareket" | "bas" | "birak" | "tekerlek"; x: number; y: number; dugme?: FareDugmesi; dy?: number; dx?: number }): boolean => {
    const k = a.kopru();
    if (!k || durumu === "yok" || durumu === "kapali" || durumu === "baglaniyor") return false;
    void k.webmonKomut("fare", yuk);
    return true;
  };
  const konum = (u: number, v: number) => uvdenSayfaya(u, v);

  return {
    ekran,
    async baslat() {
      const k = a.kopru();
      if (!k) { durumYaz("yok"); return false; }
      abonelik?.();
      abonelik = k.webmonDinle((o) => {
        if (o.olay === "kare") void ekran.kareGeldi(o.jpeg);
        else if (o.d === "acik") durumYaz("acik");
        else if (o.d === "yukleniyor") durumYaz("yukleniyor");
        else durumYaz("kapali");   // kapali / sonlandi
      });
      durumYaz("yukleniyor");
      const tamam = await k.webmonKomut("ac");
      if (!tamam) durumYaz("kapali");
      return tamam;
    },
    durum: () => durumu,
    tikla(u, v, dugme = "left") { const p = konum(u, v); return gonder({ tip: "bas", ...p, dugme }) && gonder({ tip: "birak", ...p, dugme }); },
    bas(u, v, dugme = "left") { return gonder({ tip: "bas", ...konum(u, v), dugme }); },
    birak(u, v, dugme = "left") { return gonder({ tip: "birak", ...konum(u, v), dugme }); },
    hareket(u, v) { return gonder({ tip: "hareket", ...konum(u, v) }); },
    tekerlek(u, v, dy, dx = 0) { return gonder({ tip: "tekerlek", ...konum(u, v), dy, dx }); },
    kapat() {
      abonelik?.(); abonelik = null;
      void a.kopru()?.webmonKomut("kapat");
      ekran.yokEt();
    },
  };
}
