// uygulama/aktorYetenegi.ts — AKTÖR YETENEĞİ (spec 43 A3): graf düğümlerinin (`aktor.*`) level aktörlerine (ışık/nesne) eriştiği dar yüz.
//
// Okuma CANLI durumdan (ışık: Babylon ışığı), yazma Babylon nesnesine DOĞRUDAN ve GEÇİCİ: level tanımına ve diske gitmez (graf `gizli`yi açıp kapatırken
// kullanıcının tanımı sessizce değişmesin). Her ilk yazmada o alanın önceki hâli bir "geri alıcı"ya kaydedilir; çalışma bitince/durdurulunca `geriAl(id)` aktörü
// çalışma öncesi hâline döndürür (tanımdan yeniden okumak değil: palet adlı renk ve ondalıklı değerler birebir döner). Kalıcı olan yalnız Details'te girilen başlangıç değeri.
// Alan kuralı (tür/aralık/hangi alan grafta açık) `bilesen.ts` şemasından: Details, doğrulama ve graf aynı kuralı paylaşır.
//
// Değişken yazması tanımı DEĞİŞTİRMEZ: bellekte bir "ezme" haritasında durur, okuma önce ezmeye bakar; `geriAl` ezmeyi siler (Details'teki başlangıç değeri geri gelir).
"use strict";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import { AKTOR_DEGISKEN_SINIRI } from "../world/level/cekirdek/levelTanimi.ts";
import { aktorBul, alanDegeriHatasi, alanSemasi, degiskenOku as tanimDegiskeni, type AktorTuru } from "../world/level/cekirdek/bilesen.ts";
import type { AktorYetenegi } from "./graf/grafYetenegi.ts";

type Deger = string | number | boolean;

export interface AktorYetenegiKurulu {
  readonly yetenek: AktorYetenegi;
  /** Aktörün çalışma sırasında yapılan geçici yazmalarını (alan + değişken) geri alır. Yazma yoksa no-op. */
  geriAl(id: string): void;
  /** Geçici yazması olan aktörlerin kimlikleri (senaryo ve hata ayıklama). */
  gecici(): string[];
}

const hexMi = (r: unknown): r is string => typeof r === "string" && /^#[0-9a-fA-F]{6}$/.test(r);

export function aktorYetenegiKur(g: { level: () => Level | null }): AktorYetenegiKurulu {
  /** aktör → alan → önceki hâle dönen kapanış (ilk yazmada kaydedilir; sonraki yazmalar ilkini ezmez). */
  const geriAlicilar = new Map<string, Map<string, () => void>>();
  const ezmeler = new Map<string, Map<string, Deger>>();

  const level = (): Level => { const l = g.level(); if (!l) throw new Error("level açık değil"); return l; };
  const tur = (l: Level, id: string): AktorTuru => {
    const y = aktorBul(l.tanim(), id);
    if (!y) throw new Error(`aktör yok: ${id}`);
    return y.tur;
  };
  /** Grafta açık, şemada tanımlı alan; değilse nedenli hata. */
  const sema = (t: AktorTuru, alan: string) => {
    const s = alanSemasi(t, alan);
    if (!s || !s.grafta) throw new Error(`'${alan}' alanı ${t === "isik" ? "ışık" : "nesne"} için grafta açık değil`);
    return s;
  };
  const kaydet = (id: string, alan: string, geri: () => void): void => {
    let m = geriAlicilar.get(id);
    if (!m) { m = new Map(); geriAlicilar.set(id, m); }
    if (!m.has(alan)) m.set(alan, geri);
  };

  const yetenek: AktorYetenegi = {
    var: (id) => g.level() !== null && aktorBul(g.level()!.tanim(), id) !== null,

    alanOku(id, alan) {
      const l = level(), t = tur(l, id);
      sema(t, alan);
      if (t === "isik") {
        const n = l.isiklar.isik(id);
        if (!n) throw new Error(`'${id}' ışığı sahnede kurulu değil`);
        if (alan === "siddet") return n.intensity;
        if (alan === "menzil") return n.range;
        if (alan === "gizli") return !n.isEnabled(false);
        return n.diffuse.toHexString().toLowerCase();   // renk
      }
      const d = l.nesneler.dugum(id);
      if (!d) throw new Error(`'${id}' nesnesi henüz yüklenmedi`);
      return !d.isEnabled(false);   // gizli
    },

    alanYaz(id, alan, deger) {
      const l = level(), t = tur(l, id);
      const s = sema(t, alan);
      const h = alanDegeriHatasi(s, deger);
      if (h) throw new Error(h);
      if (t === "isik") {
        const n = l.isiklar.isik(id);
        if (!n) throw new Error(`'${id}' ışığı sahnede kurulu değil`);
        if (alan === "siddet") { const eski = n.intensity; kaydet(id, alan, () => { n.intensity = eski; }); n.intensity = deger as number; return; }
        if (alan === "menzil") { const eski = n.range; kaydet(id, alan, () => { n.range = eski; }); n.range = deger as number; return; }
        if (alan === "gizli") {
          const eskiAcik = n.isEnabled(false);
          kaydet(id, alan, () => { if (n.isEnabled(false) !== eskiAcik) n.setEnabled(eskiAcik); });
          const acik = deger !== true;
          if (n.isEnabled(false) !== acik) n.setEnabled(acik);   // yalnız durum değişince (spec 38 tuzağı: her çağrı ışıkları yeniden hesaplatır)
          return;
        }
        // renk: yalnız #rrggbb (palet adı level tanımının işi; graf doğrudan ışık rengini yazar)
        if (!hexMi(deger)) throw new Error("renk: #rrggbb olmalı");
        const eski = n.diffuse.clone();
        kaydet(id, alan, () => { n.diffuse = eski; });
        n.diffuse = Color3.FromHexString(deger);
        return;
      }
      const d = l.nesneler.dugum(id);
      if (!d) throw new Error(`'${id}' nesnesi henüz yüklenmedi`);
      const eskiAcik = d.isEnabled(false);
      kaydet(id, alan, () => { if (d.isEnabled(false) !== eskiAcik) d.setEnabled(eskiAcik); });
      const acik = deger !== true;
      if (d.isEnabled(false) !== acik) d.setEnabled(acik);
    },

    degiskenOku(id, ad) {
      const e = ezmeler.get(id)?.get(ad);
      if (e !== undefined) return e;
      const r = tanimDegiskeni(level().tanim(), id, ad);
      if (!r.ok) throw new Error(r.neden);
      return r.deger;
    },

    degiskenYaz(id, ad, deger) {
      const mevcut = yetenek.degiskenOku(id, ad);
      if (mevcut === undefined) throw new Error(`'${ad}' değişkeni '${id}' aktöründe tanımlı değil (Details ▸ Değişkenler'den ekle)`);
      if (typeof deger !== typeof mevcut) throw new Error(`'${ad}' ${typeof mevcut === "number" ? "sayı" : typeof mevcut === "string" ? "metin" : "doğru/yanlış"} (türü değişmez; gelen: ${JSON.stringify(deger)})`);
      if (typeof deger === "number" && !Number.isFinite(deger)) throw new Error(`'${ad}': sayı sonlu olmalı`);
      if (typeof deger === "string" && deger.length > AKTOR_DEGISKEN_SINIRI.metin) throw new Error(`'${ad}': metin en çok ${AKTOR_DEGISKEN_SINIRI.metin} karakter`);
      let m = ezmeler.get(id);
      if (!m) { m = new Map(); ezmeler.set(id, m); }
      m.set(ad, deger);
    },
  };

  return {
    yetenek,
    geriAl(id) {
      const m = geriAlicilar.get(id);
      geriAlicilar.delete(id);
      ezmeler.delete(id);
      if (!m) return;
      for (const geri of m.values()) { try { geri(); } catch (err) { console.error("[aktor] geri alma hatası:", err); } }
    },
    gecici: () => [...new Set([...geriAlicilar.keys(), ...ezmeler.keys()])],
  };
}
