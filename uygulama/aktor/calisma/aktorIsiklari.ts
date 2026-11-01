// uygulama/aktor/calisma/aktorIsiklari.ts — IŞIK BİLEŞENİ ÇALIŞMA ZAMANI (spec 45; `isik` türü): bir aktörün `isik` bileşeni, aktöre BAĞLI bir nokta ışık üretir (konum aktöre göre yerel).
// Işık AKTÖRÜ (`tanim.isiklar`, spec 42) ayrı yoldur ve değişmez: bu modül onun yanına, nesneye ışık TAKMAK içindir (lamba direğine ışık, araba farı).
// Her karede çağrılır ama ucuzdur: ayar imzası değişmedikçe ışığa dokunulmaz, `setEnabled` yalnız durum DEĞİŞİNCE (aksi hâlde ışık yeniden hesaplanır: spec 38 tuzağı).
// TAVAN: ışık aktörleri + bileşen ışıkları birlikte `ISIK_TAVANI`'nı aşamaz (malzeme `maxSimultaneousLights` buna göre ayarlı); aşan kurulmaz ve `AKT-ISK-001` ile bir kez bildirilir,
// yer açılınca kendiliğinden kurulur. Durum bellekte; level tanımına yazılmaz. Babylon düğümü `Aktor` düğümünden alınır (yeni sahne bağımlılığı yok).
"use strict";
import type { Node } from "@babylonjs/core/node";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { bilesenAyari } from "../../../world/level/cekirdek/bilesenKaydi.ts";
import { ISIK_TAVANI } from "../../../world/level/cekirdek/levelTanimi.ts";
import { renkCoz, type Renk } from "../../../world/level/cekirdek/renk.ts";
import { ucluOku, type CalismaBaglami } from "./calismaBaglami.ts";

/** Sahne ışık adı öneki: bileşen ışıkları güneş/dolgu/ışık aktörlerinden ayrılsın. */
export const ISIK_BILESENI_ONEKI = "aktor_isik_";
/** Renk çözülemezse kullanılan renk (bileşen şemasının varsayılanı). */
const YEDEK_RENK: Renk = [1, 0.851, 0.627];

export interface AktorIsiklari {
  /** Tanımdaki `isik` bileşenlerini sahneye uydurur: yeni → kur, değişen → yerinde güncelle, kalkan → yok et. */
  uygula(): void;
  /** Aktörü ya da `isik` bileşeni artık olmayan kayıtları atar (ışık yok edilir). */
  buda(): void;
  /** Hepsini yok eder (level değişimi, yokEt). */
  sifirla(): void;
  /** Sahnede AÇIK bileşen ışığı sayısı. */
  sayi(): number;
  dokum(): { aktor: string; bilesen: string; acik: boolean }[];
}

interface Kayit { isik: PointLight; dugum: Node; imza: string; aktor: string; bilesen: string }

export function aktorIsiklariKur(b: CalismaBaglami): AktorIsiklari {
  const kurulu = new Map<string, Kayit>();
  /** Uyarısı verilen anahtarlar (aynı sorun her karede yeniden bildirilmez); sorun çözülünce silinir. */
  const bildirilen = new Set<string>();

  const bildir = (anahtar: string, kod: "AKT-ISK-001" | "AKT-ISK-002", ayrinti: string, aktor: string): void => {
    if (bildirilen.has(anahtar)) return;
    bildirilen.add(anahtar);
    b.gunluk.uyari("isik", kod, ayrinti, aktor);
  };

  const yoket = (anahtar: string): void => {
    const k = kurulu.get(anahtar);
    if (!k) return;
    if (!k.isik.isDisposed()) k.isik.dispose();
    kurulu.delete(anahtar);
  };

  const rengiCoz = (deger: string, aktor: string, anahtar: string): Renk => {
    try {
      // Palet yalnız ad verilmişse gerekir ve `tanim()` kopya döner (pahalı): hex'te okunmaz.
      return renkCoz(deger, deger.startsWith("#") ? {} : b.level()?.tanim().palet ?? {});
    } catch (e) {
      bildir(`renk#${anahtar}`, "AKT-ISK-002", `${anahtar}: '${deger}': ${e instanceof Error ? e.message : String(e)}`, aktor);
      return YEDEK_RENK;
    }
  };

  /** Ayarı ışığa yazar; yalnız imza değiştiğinde çağrılır. */
  const ayarla = (k: Kayit, ayar: Record<string, unknown>, anahtar: string): void => {
    const konum = ucluOku(ayar["konum"], [0, 1.5, 0]);
    k.isik.position.set(konum[0], konum[1], konum[2]);
    const r = rengiCoz(String(ayar["renk"]), k.aktor, anahtar);
    k.isik.diffuse = new Color3(r[0], r[1], r[2]);
    k.isik.specular = Color3.Black();   // mat lowpoly yüzey (ışık aktörleriyle aynı)
    k.isik.intensity = ayar["siddet"] as number;
    k.isik.range = ayar["menzil"] as number;
    const aciksin = ayar["gizli"] !== true;
    if (k.isik.isEnabled(false) !== aciksin) k.isik.setEnabled(aciksin);
  };

  /** Yok edilmiş ışık (düğümü silinen aktörle gider) sayıma girmez. */
  const canlilar = (): Kayit[] => [...kurulu.values()].filter((k) => !k.isik.isDisposed());
  const acikSayi = (): number => canlilar().filter((k) => k.isik.isEnabled(false)).length;
  /** Level'da şu an açık toplam ışık (ışık aktörleri + bileşen ışıkları). */
  const aciklarToplami = (): number => (b.level()?.isiklar.say() ?? 0) + acikSayi();

  return {
    sayi: acikSayi,
    sifirla() { for (const anahtar of [...kurulu.keys()]) yoket(anahtar); bildirilen.clear(); },
    dokum: () => canlilar().map((k) => ({ aktor: k.aktor, bilesen: k.bilesen, acik: k.isik.isEnabled(false) })),

    uygula() {
      if (!b.level()) return;
      for (const a of b.aktorler().values()) {
        for (const bilesen of a.bilesenler) {
          if (bilesen.tur !== "isik") continue;
          const anahtar = `${a.id}#${bilesen.id}`;
          const n = b.dugumu(a);
          if (!n) continue;   // model henüz yüklenmedi: sonraki karede yeniden denenir
          const ayar = bilesenAyari(bilesen);
          const imza = JSON.stringify(ayar);
          let k = kurulu.get(anahtar);
          if (k && (k.dugum !== n || k.isik.isDisposed())) { yoket(anahtar); k = undefined; }   // nesne yeniden kuruldu (düğüm değişti)
          if (!k) {
            // Gizli ışık tavana sayılmaz; açık olacaksa yer var mı?
            if (ayar["gizli"] !== true && aciklarToplami() >= ISIK_TAVANI) {
              bildir(`tavan#${anahtar}`, "AKT-ISK-001", `${anahtar}: ${ISIK_TAVANI} ışık doldu, bu ışık kurulmadı`, a.id);
              continue;
            }
            bildirilen.delete(`tavan#${anahtar}`);
            const isik = new PointLight(`${ISIK_BILESENI_ONEKI}${anahtar}`, Vector3.Zero(), n.getScene());
            isik.parent = n;
            k = { isik, dugum: n, imza: "", aktor: a.id, bilesen: bilesen.id };
            kurulu.set(anahtar, k);
          }
          if (k.imza !== imza) {
            // Gizliyken açılmaya geçen ışık da tavana tabidir.
            const acilacak = ayar["gizli"] !== true && !k.isik.isEnabled(false);
            if (acilacak && aciklarToplami() >= ISIK_TAVANI) {
              bildir(`tavan#${anahtar}`, "AKT-ISK-001", `${anahtar}: ${ISIK_TAVANI} ışık doldu, ışık açılamadı`, a.id);
              continue;
            }
            bildirilen.delete(`tavan#${anahtar}`);
            ayarla(k, ayar, anahtar);
            k.imza = imza;
          }
        }
      }
    },

    buda() {
      for (const [anahtar, k] of [...kurulu]) {
        const a = b.aktorler().get(k.aktor);
        if (!a || !a.bilesenler.some((x) => x.tur === "isik" && x.id === k.bilesen)) { yoket(anahtar); bildirilen.delete(`tavan#${anahtar}`); bildirilen.delete(`renk#${anahtar}`); }
      }
    },
  };
}
