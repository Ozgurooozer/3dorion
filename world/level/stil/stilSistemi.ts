// world/level/stil/stilSistemi.ts — Tanımdaki stili sahneye uygular: ışık eklentisinin ortak durumu + ekran efektleri.
//
// Işık sisteminin deseni: `uygula` her düzenlemede çağrılır (ucuz). Işık stili yalnız uniform değerleridir
// (bütün ışıklı malzemeler aynı `isikDurumu` nesnesini okur). Ekran efektleri kameraya bağlıdır: kamera
// bağlanınca kurulur; bir efektin AÇIK/KAPALI durumu değişince hepsi sırayla yeniden kurulur (sıra: çizgi → renk —
// palete yuvarlama en sonda olmalı), yalnız değer değişince kurulu efekt yeni değeri sonraki karede okur.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { LevelTanimi } from "../cekirdek/levelTanimi.ts";
import type { Renk } from "../cekirdek/renk.ts";
import { isikStiliDurumuYap, type IsikStiliDurumu } from "./isikEklentisi.ts";
import { VARSAYILAN_STIL, stilTamamla } from "./stilTanimi.ts";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { ShaderSistemi } from "../shader/shaderSistemi.ts";
import type { SonStili } from "./stilTanimi.ts";
import type { Vec3 } from "../cekirdek/levelTanimi.ts";
import { etkinSon, sonImzasi, sonKur, boruHattiGerekli, goruntuIslemeUygula, type SonKurulum } from "./isikSonrasi.ts";
import { cizgiEfektiKur, renkEfektiKur, paletListesi, type CizgiDegerleri, type RenkDegerleri, type Efekt } from "./efektler.ts";

export interface StilSistemi {
  /** Işıklı malzemelerin eklentisinin okuduğu ortak değerler (malzeme fabrikasına verilir). */
  readonly isikDurumu: IsikStiliDurumu;
  uygula(t: LevelTanimi, renk: (ad: string) => Renk): void;
  /** Ekran efektleri bu kameraya kurulur (level kamerayı bilmez; sayfa bağlar). */
  kameraBagla(k: Camera): void;
  /** Katmanlar/nesneler yeniden kurulunca (güneş diski değişmiş olabilir: huzme ve parıltı ona bağlı). */
  sahneDegisti(): void;
  /** Işık yönü değişti (gün/gece akarken her kare). */
  isikYonu(yon: Vec3): void;
  /** B tuşu: basılıyken bütün ışık sonrası kapalı (önce/sonra). */
  sonrasiAtla(atla: boolean): void;
  yokEt(): void;
}

const parlaklik = (r: Renk) => 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2];

/** Tanımdan ışık eklentisinin değerlerini yazar. Saf (durum nesnesini doldurur): test edilir. */
export function isikDurumunuYaz(d: IsikStiliDurumu, t: LevelTanimi, renk: (ad: string) => Renk): void {
  const s = (t.stil ?? VARSAYILAN_STIL).isik, g = t.isik.gunes, f = t.isik.dolgu;
  const l = Math.hypot(...g.yon) || 1;
  d.a = [s.acik ? 1 : 0, Math.max(1, Math.round(s.bant)), s.yumusaklik, s.enKoyu];
  d.b = [s.golgeKarisim, s.parlama, s.parlamaBoyu, s.kenarIsik];
  // Tam ışık = güneşte duran DÜZ ZEMİNİN aldığı (güneş × yüksekliğinin sinüsü + gök dolgusu üstten); basamaklar buna
  // oranlanır. İlk sürüm güneşe dik bakan yüzü aldı: güneş alçakken (28°) düz zemin hiç "aydınlık" basamağa
  // çıkmadı, ova ortası koyu banda düştü (görüntüde yakalandı). Level bir arazi: ölçü zemindir.
  const zemineGunes = Math.max(g.yon[1] / l, 0.2);
  d.c = [s.kenarEsik, s.tarama, g.siddet * parlaklik(renk(g.renk)) * zemineGunes + f.siddet * parlaklik(renk(f.ust)), 1];
  d.golge = [...renk(s.golgeRengi)];
  d.gunes = [g.yon[0] / l, g.yon[1] / l, g.yon[2] / l];
}

export function stilSistemiKur(sahne: Scene, shaderlar: ShaderSistemi | null = null): StilSistemi {
  const isikDurumu = isikStiliDurumuYap();
  const cizgi: CizgiDegerleri = { a: [1, 0.08, 0.4, 0.8], b: [0, 0, 0, 220], renk: [0, 0, 0] };
  const renkD: RenkDegerleri = { a: [0, 0, 0, 1], gren: 0, palet: [] };
  let kamera: Camera | null = null;
  let kurulu: Efekt[] = [];
  let imza = "";
  let son: { t: LevelTanimi; renk: (ad: string) => Renk } | null = null;

  let atla = false;
  let sonKurulum: SonKurulum | null = null;

  const efektleriUydur = () => {
    if (!son) return;
    const t = son.t, s = stilTamamla(t.stil), piksel = t.ortam.piksel ?? 1;
    const e = etkinSon(s.son, piksel, atla);
    goruntuIslemeUygula(sahne, e, t.ortam.tonlama.acik, son.renk, (kamera as { fov?: number } | null)?.fov ?? 0.8);
    if (!kamera) return;
    const gunes = sahne.getMeshByName("gunes_diski");
    const gunesDiski = gunes instanceof Mesh ? gunes : null;
    // Piksel kipinde örnekleme (MSAA) yok: keskin piksel istenir.
    const yeniImza = JSON.stringify([s.cizgi.acik, s.renk.acik, piksel > 1, sonImzasi(e, gunesDiski?.uniqueId ?? null), shaderlar?.ekranImzasi() ?? ""]);
    if (yeniImza !== imza) {
      imza = yeniImza;
      // SIRA: ışık sonrası (GI, AO, huzme, boru hattı) → çizgi → renk/palet (isikSonrasi.ts başı).
      for (const x of kurulu) x.yokEt();
      sonKurulum?.yokEt();
      kurulu = [];
      const ornekleme = piksel > 1 ? 1 : 4;
      sonKurulum = sonKur(sahne, kamera, e, ornekleme, gunesDiski);
      const sonrasiVar = boruHattiGerekli(e) || e.ao.acik || e.huzme.acik;
      if (s.cizgi.acik) kurulu.push(cizgiEfektiKur(sahne, kamera, cizgi, sonrasiVar ? 1 : ornekleme));
      if (s.renk.acik) kurulu.push(renkEfektiKur(kamera, renkD, s.cizgi.acik || sonrasiVar ? 1 : ornekleme));
      // Özel ekran shader'ları (spec 20) zincirin SONUNDA, listedeki sırayla.
      if (shaderlar) kurulu.push(...shaderlar.ekranKur(kamera));
    }
    const g = t.isik.gunes, l = Math.hypot(...g.yon) || 1;
    sonGuncelle = { e, yon: [g.yon[0] / l, g.yon[1] / l, g.yon[2] / l], renk: son.renk(g.renk), siddet: g.siddet };
    sonKurulum?.guncelle(sonGuncelle.e, sonGuncelle.yon, sonGuncelle.renk, sonGuncelle.siddet);
  };
  let sonGuncelle: { e: SonStili; yon: Vec3; renk: Renk; siddet: number } | null = null;

  return {
    isikDurumu,
    uygula(t, renk) {
      son = { t, renk };
      isikDurumunuYaz(isikDurumu, t, renk);
      const s = t.stil ?? VARSAYILAN_STIL;
      cizgi.a = [s.cizgi.kalinlik, s.cizgi.derinlikEsik, s.cizgi.normalEsik, s.cizgi.guc];
      cizgi.b = [s.cizgi.vurgu, s.cizgi.titreme, s.cizgi.kip, s.cizgi.uzaklik];
      cizgi.renk = renk(s.cizgi.renk);
      renkD.a = [s.renk.palet, s.renk.titreme, Math.round(s.renk.posterize), s.renk.doygunluk];
      renkD.gren = s.renk.gren;
      renkD.palet = paletListesi(Object.keys(t.palet).map(renk), renk(s.isik.golgeRengi), s.isik.golgeKarisim);
      efektleriUydur();
    },
    kameraBagla(k) { kamera = k; imza = ""; efektleriUydur(); },
    sahneDegisti() { efektleriUydur(); },
    isikYonu(yon) {
      // Zaman akarken (spec 20): stil eklentisinin parlama/kenar ışığı ve GI/huzme yeni ışık yönünü izlesin.
      isikDurumu.gunes = [...yon];
      if (sonGuncelle) { sonGuncelle.yon = yon; sonKurulum?.guncelle(sonGuncelle.e, yon, sonGuncelle.renk, sonGuncelle.siddet); }
    },
    sonrasiAtla(b) { if (atla !== b) { atla = b; efektleriUydur(); } },
    yokEt() { for (const e of kurulu) e.yokEt(); kurulu = []; sonKurulum?.yokEt(); sonKurulum = null; },
  };
}
