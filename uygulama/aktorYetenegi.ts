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
import { aktorHiyerarsisi, type AktorOlayYolu } from "../world/level/cekirdek/aktorOlayYolu.ts";
import { aktorHatasi, kodOku, kodluHata, kodOnekiniSil } from "../world/level/cekirdek/aktorHatalari.ts";
import type { AktorGunlugu } from "./aktor/calisma/aktorGunlugu.ts";
import type { AktorCalismaZamani } from "./aktor/calisma/aktorCalismaZamani.ts";
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

/** Level tanımındaki aktör hiyerarşisi (her çağrıda CANLI okunur): üst `ust` alanından, alt onun tersi; `beden:<ad>` üstleri olduğu gibi döner. Level yoksa boş. */
export function levelHiyerarsisi(level: () => Level | null): ReturnType<typeof aktorHiyerarsisi> {
  const t = level()?.tanim();
  return aktorHiyerarsisi(t ? [...(t.nesneler ?? []), ...(t.isiklar ?? [])] : []);
}

export function aktorYetenegiKur(g: { level: () => Level | null; olay?: AktorOlayYolu; zaman?: AktorCalismaZamani; gunluk?: AktorGunlugu }): AktorYetenegiKurulu {
  /** aktör → alan → önceki hâle dönen kapanış (ilk yazmada kaydedilir; sonraki yazmalar ilkini ezmez). */
  const geriAlicilar = new Map<string, Map<string, () => void>>();
  const ezmeler = new Map<string, Map<string, Deger>>();

  const level = (): Level => { const l = g.level(); if (!l) throw aktorHatasi("AKT-YTN-001", "level açık değil"); return l; };
  const tur = (l: Level, id: string): AktorTuru => {
    const y = aktorBul(l.tanim(), id);
    if (!y) throw aktorHatasi("AKT-YTN-002", `aktör yok: ${id}`);
    return y.tur;
  };
  /** Grafta açık, şemada tanımlı alan; değilse nedenli hata. */
  const sema = (t: AktorTuru, alan: string) => {
    const s = alanSemasi(t, alan);
    if (!s || !s.grafta) throw aktorHatasi("AKT-YTN-003", `'${alan}' alanı ${t === "isik" ? "ışık" : "nesne"} için grafta açık değil`);
    return s;
  };
  const kaydet = (id: string, alan: string, geri: () => void): void => {
    let m = geriAlicilar.get(id);
    if (!m) { m = new Map(); geriAlicilar.set(id, m); }
    if (!m.has(alan)) m.set(alan, geri);
  };

  const ham: AktorYetenegi = {
    var: (id) => g.level() !== null && aktorBul(g.level()!.tanim(), id) !== null,

    alanOku(id, alan) {
      const l = level(), t = tur(l, id);
      sema(t, alan);
      if (t === "isik") {
        const n = l.isiklar.isik(id);
        if (!n) throw aktorHatasi("AKT-YTN-004", `'${id}' ışığı sahnede kurulu değil`);
        if (alan === "siddet") return n.intensity;
        if (alan === "menzil") return n.range;
        if (alan === "gizli") return !n.isEnabled(false);
        return n.diffuse.toHexString().toLowerCase();   // renk
      }
      const d = l.nesneler.dugum(id);
      if (!d) throw aktorHatasi("AKT-YTN-005", `'${id}' nesnesi henüz yüklenmedi`);
      return !d.isEnabled(false);   // gizli
    },

    alanYaz(id, alan, deger) {
      const l = level(), t = tur(l, id);
      const s = sema(t, alan);
      const h = alanDegeriHatasi(s, deger);
      if (h) throw aktorHatasi("AKT-YTN-006", h);
      if (t === "isik") {
        const n = l.isiklar.isik(id);
        if (!n) throw aktorHatasi("AKT-YTN-004", `'${id}' ışığı sahnede kurulu değil`);
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
        if (!hexMi(deger)) throw aktorHatasi("AKT-YTN-007", "renk: #rrggbb olmalı");
        const eski = n.diffuse.clone();
        kaydet(id, alan, () => { n.diffuse = eski; });
        n.diffuse = Color3.FromHexString(deger);
        return;
      }
      const d = l.nesneler.dugum(id);
      if (!d) throw aktorHatasi("AKT-YTN-005", `'${id}' nesnesi henüz yüklenmedi`);
      const eskiAcik = d.isEnabled(false);
      kaydet(id, alan, () => { if (d.isEnabled(false) !== eskiAcik) d.setEnabled(eskiAcik); });
      const acik = deger !== true;
      if (d.isEnabled(false) !== acik) d.setEnabled(acik);
    },

    degiskenOku(id, ad) {
      const e = ezmeler.get(id)?.get(ad);
      if (e !== undefined) return e;
      const r = tanimDegiskeni(level().tanim(), id, ad);
      if (!r.ok) throw aktorHatasi("AKT-YTN-002", r.neden);
      return r.deger;
    },

    degiskenYaz(id, ad, deger) {
      const mevcut = yetenek.degiskenOku(id, ad);
      if (mevcut === undefined) throw aktorHatasi("AKT-YTN-008", `'${ad}' değişkeni '${id}' aktöründe tanımlı değil (Details ▸ Değişkenler'den ekle)`);
      if (typeof deger !== typeof mevcut) throw aktorHatasi("AKT-YTN-009", `'${ad}' ${typeof mevcut === "number" ? "sayı" : typeof mevcut === "string" ? "metin" : "doğru/yanlış"} (türü değişmez; gelen: ${JSON.stringify(deger)})`);
      if (typeof deger === "number" && !Number.isFinite(deger)) throw aktorHatasi("AKT-YTN-010", `'${ad}': sayı sonlu olmalı`);
      if (typeof deger === "string" && deger.length > AKTOR_DEGISKEN_SINIRI.metin) throw aktorHatasi("AKT-YTN-011", `'${ad}': metin en çok ${AKTOR_DEGISKEN_SINIRI.metin} karakter`);
      let m = ezmeler.get(id);
      if (!m) { m = new Map(); ezmeler.set(id, m); }
      m.set(ad, deger);
    },

    olayYayinla(id, ad, veri, yon) {
      if (!g.olay) throw aktorHatasi("AKT-OLY-007", "aktör olay yolu kurulu değil");
      const r = yon === "ust" ? g.olay.ustuneYayinla(id, ad, veri) : yon === "alt" ? g.olay.altlaraYayinla(id, ad, veri) : g.olay.yayinla(id, ad, veri);
      if (!r.ok) throw kodluHata(r.neden);   // olay yolunun kendi kodu (AKT-OLY-…) korunur
    },
    // Level yokken boş dönmek "üstü yok" derdi: sessiz yanlış; öteki üyeler gibi nedenle fırlatır.
    // Etkin hiyerarşi (çalışma zamanı ezmesi dahil) varsa o; yoksa yalnız tanım.
    ustBul: (id) => { level(); return (g.zaman?.hiyerarsi() ?? levelHiyerarsisi(g.level)).ustu(id) ?? null; },
    altlar: (id) => { level(); return (g.zaman?.hiyerarsi() ?? levelHiyerarsisi(g.level)).altlari(id); },
    hareketEt(id, hiz, donus) { if (!g.zaman) throw aktorHatasi("AKT-YTN-012", "aktör çalışma zamanı kurulu değil"); g.zaman.hareketEt(id, hiz, donus); },
    soketeTak(id, ust, soket) { if (!g.zaman) throw aktorHatasi("AKT-YTN-012", "aktör çalışma zamanı kurulu değil"); g.zaman.soketeTak(id, ust, soket); },
    sokettanAl(id) { if (!g.zaman) throw aktorHatasi("AKT-YTN-012", "aktör çalışma zamanı kurulu değil"); g.zaman.sokettanAl(id); },
  };

  // GÜNLÜK SARMALAYICISI: her yetenek çağrısı hata verirse KODLU ve aktör adıyla günlüğe düşer (graf düğümü hatayı yine alır: fırlatma korunur), ayrıntılı `dugum` bayrağı
  // açıksa başarılı çağrılar da izlenir. Salt okuma (`var`/`alanOku`/`degiskenOku`/`ustBul`/`altlar`) başarıda sessizdir: grafın her karesi günlüğü doldurmasın.
  const yetenek = g.gunluk ? gunlukluYetenek(ham, g.gunluk) : ham;

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


/**
 * Yetenek nesnesini günlüğe bağlar (saf sarmalayıcı: çağrı/dönüş değişmez; hata kodlanır ve aktör adıyla yazılıp YENİDEN fırlatılır). Aktör kimliği her metodun ilk
 * bağımsız değişkenidir. `yazan` metotlar başarıda da (ayrıntılı `dugum` bayrağı açıksa) izlenir; salt okuma sessizdir: grafın her karesi günlüğü doldurmasın.
 * Kodsuz hata (beklenmeyen istisna) uydurma koda bağlanmaz: kod alanı boş, metin olduğu gibi.
 */
export function gunlukluYetenek(ham: AktorYetenegi, gunluk: AktorGunlugu): AktorYetenegi {
  function iz<A extends [string, ...unknown[]], R>(ad: string, f: (...a: A) => R, yazan: boolean): (...a: A) => R {
    return (...a: A): R => {
      try {
        const sonuc = f(...a);
        if (yazan) gunluk.yaz("bilgi", "dugum", `${ad}(${a.map((x) => JSON.stringify(x)).join(", ")})`, { aktor: a[0] });
        return sonuc;
      } catch (e) {
        const metin = e instanceof Error ? e.message : String(e);
        const kod = kodOku(metin);
        if (kod) gunluk.hata("dugum", kod, `${ad}: ${kodOnekiniSil(metin)}`, a[0]);
        else gunluk.yaz("hata", "dugum", `${ad}: ${metin}`, { kod: null, aktor: a[0] });
        throw e;
      }
    };
  }
  return {
    var: iz("var", (id: string) => ham.var(id), false),
    alanOku: iz("alanOku", (id: string, alan: string) => ham.alanOku(id, alan), false),
    alanYaz: iz("alanYaz", (id: string, alan: string, d: Deger) => ham.alanYaz(id, alan, d), true),
    degiskenOku: iz("degiskenOku", (id: string, ad: string) => ham.degiskenOku(id, ad), false),
    degiskenYaz: iz("degiskenYaz", (id: string, ad: string, d: Deger) => ham.degiskenYaz(id, ad, d), true),
    ...(ham.olayYayinla ? { olayYayinla: iz("olayYayinla", (id: string, ad: string, v: Readonly<Record<string, Deger>>, y: "aktor" | "ust" | "alt") => ham.olayYayinla!(id, ad, v, y), true) } : {}),
    ...(ham.ustBul ? { ustBul: iz("ustBul", (id: string) => ham.ustBul!(id), false) } : {}),
    ...(ham.altlar ? { altlar: iz("altlar", (id: string) => ham.altlar!(id), false) } : {}),
    ...(ham.hareketEt ? { hareketEt: iz("hareketEt", (id: string, h: number, d: number) => ham.hareketEt!(id, h, d), true) } : {}),
    ...(ham.soketeTak ? { soketeTak: iz("soketeTak", (id: string, u: string, so?: string) => ham.soketeTak!(id, u, so), true) } : {}),
    ...(ham.sokettanAl ? { sokettanAl: iz("sokettanAl", (id: string) => ham.sokettanAl!(id), true) } : {}),
  };
}
