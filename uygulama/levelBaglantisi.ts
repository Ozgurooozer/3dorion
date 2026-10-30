// uygulama/levelBaglantisi.ts — YENİ LEVEL + IŞIKLAR PANELİ kablolaması (spec 42 Y4). İnce kompozisyon: saf mantık `yapi/level/*Modeli.ts`te, DOM `yeniLevelPenceresi.ts`/`isiklarPaneli.ts`te.
//
// `giris.ts` büyümesin diye ayrı dosya (teknik borç: kökte iş mantığı). Level'ın KAMU API'si kullanılır (`Level.tanim()/ayarla()`; asset yerleştirmeyle aynı yol).
// Şablonlar Vite `?url` ile pakete kopyalanır (Electron file:// yüklemesinde de çözülür; ova.level.json gibi).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { Vec3 } from "../world/level/cekirdek/levelTanimi.ts";
import type { Kopru } from "../host/kopru.ts";
import type { DokYoneticisi } from "./yapi/ortak/dok/dokYoneticisi.ts";
import { yeniLevelPenceresiKur, type YeniLevelPenceresi } from "./yapi/level/yeniLevelPenceresi.ts";
import { ISIKLAR_PANELI_KIMLIGI, isiklarPaneliKur, type IsiklarPaneli } from "./yapi/level/isiklarPaneli.ts";
import { nesnelerPaneliKur, type NesnelerPaneli } from "./yapi/level/nesnelerPaneli.ts";
import { isikGizmosuKur, type IsikGizmosu } from "./isikGizmosu.ts";
import { aktorYetenegiKur, type AktorYetenegiKurulu } from "./aktorYetenegi.ts";
import type { AktorCalistirici } from "./graf/aktorCalistirici.ts";
import { sonucSatiri } from "./graf/grafCalistirici.ts";
import { dugmeYap, el } from "./yapi/ortak/dom.ts";
import bosAdresi from "../world/level/sablon/bos.level.json?url";
import duzZeminAdresi from "../world/level/sablon/duz-zemin.level.json?url";
import tamamenBosAdresi from "../world/level/sablon/tamamen-bos.level.json?url";

const SABLON_ADRESLERI: Readonly<Record<string, string>> = { "bos": bosAdresi, "duz-zemin": duzZeminAdresi, "tamamen-bos": tamamenBosAdresi };
/** Yeni ışık kamera önünde bu kadar uzakta, zeminden en az bu kadar yüksekte (m). */
const ONUNDE_M = 3, EN_AZ_YUKSEKLIK_M = 1.5;

export interface LevelBaglantisiGirdisi {
  dok: DokYoneticisi;
  /** Işık işaretleri ve taşı gizmosu için sahne ve tuval. */
  sahne: Scene;
  tuval: HTMLCanvasElement;
  level: () => Level | null;
  kamera: FreeCamera;
  /** `window.kopru` (Electron'suz ortamda yok: yazma ve oluşturma pasif). */
  kopru: Kopru | undefined;
  /** Fare serbest olsun (imleç kipi); false dönerse açılmaz. */
  imlecIzni: () => boolean;
  altyazi: (metin: string, ms?: number) => void;
  /** Grafik deposundaki olay grafiklerinin adları (Details'te aktör grafı seçimi); çağrı anında okunur. */
  grafAdlari?: () => readonly string[];
}
export interface LevelBaglantisi {
  yeniLevel: YeniLevelPenceresi; isiklar: IsiklarPaneli; nesneler: NesnelerPaneli; isikGizmosu: IsikGizmosu;
  /** Aktör yeteneği (spec 43 A3): graf `aktor.*` düğümlerinin level aktörlerine erişimi + çalışma bitince geçici yazmaları geri alma. */
  aktor: AktorYetenegiKurulu;
  /** Aktör grafı çalıştırıcısını bağlar (graf tabanından SONRA kurulur; Details'teki ▶ ■ ve canlı satır buna konuşur). */
  aktorCalistiriciBagla(c: AktorCalistirici): void;
}

const dugme = dugmeYap("");

export function levelBaglantisiKur(g: LevelBaglantisiGirdisi): LevelBaglantisi {
  const aktor = aktorYetenegiKur({ level: g.level });
  let aktorCalistirici: AktorCalistirici | null = null;
  /** Details'te graf satırının yanındaki ▶ ■ ve durum yazısı. ▶ YALNIZ gerçek tıklamayla (spec 35 §1: çalıştıran Ozyn'in tuşu). */
  const grafEylemleri = (id: string, graf: string | null): HTMLElement[] => {
    const c = aktorCalistirici;
    const calisiyor = c?.calisiyor(id) ?? null;
    const oynat = dugme("▶", "", graf ? "Bu aktörün grafını çalıştır (@bu = bu aktör; yazmalar geçicidir)" : "Önce bir graf seç");
    const durdur = dugme("■", "", "Bu aktörün süren grafını durdur (aktör eski hâline döner)");
    oynat.disabled = !c || !graf || calisiyor !== null;
    durdur.disabled = calisiyor === null;
    oynat.addEventListener("click", (e) => {
      oynat.blur();
      // YALNIZ GERÇEK TIKLAMA: betikten üretilen tık grafı başlatmaz (Orion'un araç yüzeyinde aktör grafı çalıştıran yol yoktur).
      if (!e.isTrusted) return;
      if (!aktorCalistirici || !graf) return;
      const r = aktorCalistirici.calistir(id, graf);
      if (!r.ok) g.altyazi(`çalıştırılamadı: ${r.neden}`, 4000);
    });
    durdur.addEventListener("click", () => { durdur.blur(); aktorCalistirici?.durdur(id); });
    const son = c?.son(id) ?? null;
    const metin = calisiyor ? `▶ ${calisiyor.suan ? `${calisiyor.suan.id} (${calisiyor.suan.ad})` : "başlıyor…"}` : son ? sonucSatiri(son) : "";
    const durum = el("span", "il-degisken-ad", metin);
    durum.title = metin;
    return [oynat, durdur, durum];
  };
  const yeniLevel = yeniLevelPenceresiKur({
    kopru: { projeLevelOlustur: (ad, metin) => g.kopru!.projeLevelOlustur(ad, metin) },
    sablonOku: async (id) => {
      const adres = SABLON_ADRESLERI[id];
      if (!adres) throw new Error(`bilinmeyen şablon: ${id}`);
      const r = await fetch(adres);
      if (!r.ok) throw new Error(`${id}: ${r.status}`);
      return r.json() as Promise<unknown>;
    },
    acikTanim: () => g.level()?.tanim() ?? null,
    izin: g.imlecIzni,
    altyazi: g.altyazi,
  });
  const isiklar = isiklarPaneliKur({
    dok: g.dok,
    level: g.level,
    yeniKonum: (l): Vec3 => {
      const p = g.kamera.globalPosition, d = g.kamera.getForwardRay(1).direction;
      const x = p.x + d.x * ONUNDE_M, z = p.z + d.z * ONUNDE_M;
      return [x, Math.max(p.y + d.y * ONUNDE_M, l.yukseklik(x, z) + EN_AZ_YUKSEKLIK_M), z];
    },
    ...(g.kopru?.projeLevelKaydet ? { kopru: g.kopru } : {}),
    altyazi: g.altyazi,
    ...(g.grafAdlari ? { grafAdlari: g.grafAdlari } : {}),
    grafEylemleri,
  });
  const nesneler = nesnelerPaneliKur({
    dok: g.dok, level: g.level, altyazi: g.altyazi,
    ...(g.grafAdlari ? { grafAdlari: g.grafAdlari } : {}),
    grafEylemleri,
  });
  const isikGizmosu = isikGizmosuKur({
    sahne: g.sahne, tuval: g.tuval, level: g.level,
    secili: () => isiklar.secili(),
    gorunur: () => g.dok.ekrandaMi(ISIKLAR_PANELI_KIMLIGI),
    sec: (id) => isiklar.sec(id),
    tasindi: (id, konum) => isiklar.konumla(id, konum),
    altyazi: g.altyazi,
  });
  return {
    yeniLevel, isiklar, nesneler, isikGizmosu, aktor,
    aktorCalistiriciBagla(c) {
      aktorCalistirici = c;
      // Çalışma ilerledikçe/bitince Details tazelenir; yazı alanında yazarken tazeleme yok (giriş kaybolmasın).
      c.dinle(() => {
        if (!isiklar.kok.contains(document.activeElement)) isiklar.tazele();
        if (!nesneler.kok.contains(document.activeElement)) nesneler.tazele();
      });
    },
  };
}
