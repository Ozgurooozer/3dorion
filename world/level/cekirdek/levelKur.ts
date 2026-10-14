// world/level/cekirdek/levelKur.ts — Level tanımını (veri) sahneye kurar ve canlı tutar.
//
// Akış: tanım → doğrula → ışık sistemi `uygula` → her açık katman için kayıttaki modülü bul, ayarı
// varsayılanla birleştir, `kur`. Canlı düzenlemede (`ayarla`) ışık/ortam her seferinde uygulanır (ucuz);
// katmanlardan yalnız DEĞİŞENLER (ayar, açık/kapalı, palet) yıkılıp yeniden kurulur — kamera yerinde kalır,
// sahne yeniden yüklenmez.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { levelTanimiDogrula, type LevelTanimi, type KatmanTanimi } from "./levelTanimi.ts";
import { isikSistemiKur, type IsikSistemi } from "./isikSistemi.ts";
import { malzemeKur } from "./malzeme.ts";
import { renkCoz } from "./renk.ts";
import { stilTamamla } from "../stil/stilTanimi.ts";
import { nesneSistemiKur, type NesneSistemi, type NesneYukleyici } from "./nesneSistemi.ts";
import { kimlikleriDoldur } from "./kimlik.ts";
import { shaderSistemiKur, shaderlariNormallestir, type ShaderSistemi, type ShaderKaydi } from "../shader/shaderSistemi.ts";
import { SHADERLAR } from "../shader/moduller/index.ts";
import { dunyaDurumuYap, durumuSaateGoreYaz, zamanIlerle, paletZamanda, type DunyaDurumu } from "../shader/dunyaDurumu.ts";
import { dunyaPaleti } from "../shader/paletler.ts";
import { stilSistemiKur, type StilSistemi } from "../stil/stilSistemi.ts";
import { ayarBirlestir, type Bolge, type LevelModulu, type ModulBaglami, type ModulOrnegi } from "./modul.ts";

export type ModulKaydi = ReadonlyMap<string, LevelModulu>;

export interface Level {
  /** Şu an kurulu tanımın kopyası (panel bunu düzenler, `ayarla` ile geri verir). */
  tanim(): LevelTanimi;
  ayarla(yeni: unknown): void;
  guncelle(dt: number): void;
  /** Zemin modülünün yüksekliği; zemin yoksa 0. */
  yukseklik(x: number, z: number): number;
  readonly isik: IsikSistemi;
  /** Görsel stil (ışık bantları, çizgi, renk efektleri); efektler için sayfa `stil.kameraBagla` çağırır. */
  readonly stil: StilSistemi;
  /** Anlık dünya durumu (saat, gece, palet) — gün/gece ve özel shader'lar (spec 20). */
  readonly dunya: DunyaDurumu;
  readonly shaderlar: ShaderSistemi;
  /** Elle yerleştirilen varlıklar (asset tarayıcısı): katalog, seçme, önizleme örneği. */
  readonly nesneler: NesneSistemi;
  /** Kurulu katman sayısı ve mesh sayısı (ölçüm satırı için). */
  sayim(): { katman: number; mesh: number };
  yokEt(): void;
}

interface Kurulu { imza: string; palet: string; ornek: ModulOrnegi }

const kopya = <T>(v: T): T => structuredClone(v);

/**
 * Her katmanın ayarını modülün varsayılanıyla TAMAMLAR (tanımda `{}` olsa da bütün parametreler görünür:
 * panel düzenleyebilsin, kaydedilen dosya açık olsun). Bilinmeyen modül ya da ayar burada hata verir.
 */
function normallestir(t: LevelTanimi, kayit: ModulKaydi, shaderKaydi: ShaderKaydi): LevelTanimi {
  return {
    ...t,
    ortam: { ...t.ortam, piksel: t.ortam.piksel ?? 1 },
    isik: { ...t.isik, gunes: { ...t.isik.gunes, golge: { otomatikSinir: true, kip: 0, karisim: 0.1, ...t.isik.gunes.golge } } },
    stil: stilTamamla(t.stil),
    shaderlar: shaderlariNormallestir(t.shaderlar ?? [], shaderKaydi),
    // Kimliksiz yerleşime kimlik (editör seçimi ve sahne düğümü eşleşmesi kimlikle; eski dosyalar kimliksiz).
    nesneler: kimlikleriDoldur(t.nesneler ?? []),
    gruplar: t.gruplar ?? [],
    kameraYerleri: t.kameraYerleri ?? [],
    katmanlar: t.katmanlar.map((k) => {
      const modul = kayit.get(k.tur);
      if (!modul) throw new Error(`katman "${k.ad}": bilinmeyen modül "${k.tur}" (bilinenler: ${[...kayit.keys()].join(", ")})`);
      return { ...k, ayar: { ...ayarBirlestir(k.tur, modul.varsayilan, k.ayar) } };
    }),
  };
}

export interface LevelSecenekleri {
  /** Nesne yükleyicisi (testler sahte verir; verilmezse katalog + glb). */
  nesneYukleyici?: NesneYukleyici;
}

export function levelKur(sahne: Scene, tanimHam: unknown, kayit: ModulKaydi, shaderKaydi: ShaderKaydi = SHADERLAR, secenek: LevelSecenekleri = {}): Level {
  const ilk = levelTanimiDogrula(tanimHam);
  if (!ilk.ok) throw new Error(`level tanımı geçersiz — ${ilk.hata}`);
  let tanim = normallestir(kopya(ilk.deger), kayit, shaderKaydi);
  const isik = isikSistemiKur(sahne);
  // Özel shader'lar (spec 20) ve dünya durumu (saat, gece, palet): her karede ilerler, tanım yeniden kurulmaz.
  const shaderlar = shaderSistemiKur(sahne, shaderKaydi);
  const dunya = dunyaDurumuYap();
  let sonTanimSaati: number | null = null;
  const stil = stilSistemiKur(sahne, shaderlar);
  const nesneler = nesneSistemiKur({
    sahne,
    // Işıklı: stil eklentili (toon, çizgi…); ışıyan: pişmiş ama sise girer (uzak neon ufka karışsın).
    malzeme: (ad, tur) => malzemeKur(sahne, ad, tur, { ...(tur === "isikli" ? { stil: stil.isikDurumu } : { sis: true }), dunya: shaderlar.uniform }),
    golge: (m, ne) => isik.golgeyeKat(m, ne),
    golgedenCikar: (m) => isik.golgedenCikar(m),
    ...(secenek.nesneYukleyici ? { yukleyici: secenek.nesneYukleyici } : {}),
  });
  const nesneleriUygula = () => nesneler.uygula(tanim.nesneler ?? [], tanim.gruplar ?? []);
  const kurulu = new Map<string, Kurulu>();

  const renk = (ad: string) => renkCoz(ad, tanim.palet);
  /** Işık, ortam ve stil: her düzenlemede (ucuz). */
  /** Zaman tanımlıysa dünya durumunu o saate kurar ve ışığa uygular (tanımdaki saat değişince oradan başlar). */
  const zamanaGore = () => {
    const z = tanim.zaman;
    if (!z) { dunya.gunesYonu = isik.gunesYonu(); return; }
    if (z.saat !== sonTanimSaati) { sonTanimSaati = z.saat; dunya.saat = z.saat; }
    durumuSaateGoreYaz(dunya, dunya.saat, z.egim);
    dunya.kareler = dunyaPaleti(z.dunya).kareler;
    dunya.palet = paletZamanda(dunya.kareler, dunya.saat);
    isik.zamanUygula(dunya);
  };
  /** Işık, zaman, özel shader'lar, stil: her düzenlemede (ucuz). */
  const gorunusUygula = () => {
    isik.uygula(tanim.isik, tanim.ortam, renk);
    zamanaGore();
    shaderlar.uygula(tanim.shaderlar ?? [], renk);
    stil.uygula(tanim, renk, tanim.zaman ? dunya.saat : undefined);
    stil.isikYonu(isik.isikYonu());
  };
  const baglam: ModulBaglami = {
    sahne,
    renk,
    // Işıklı her malzeme stil eklentisini alır (stil kapalıyken kod dalı atlanır).
    malzeme: (ad, tur, ayar) => malzemeKur(sahne, ad, tur, { ...ayar, ...(tur === "isikli" ? { stil: stil.isikDurumu } : {}), dunya: shaderlar.uniform }),
    golge: (mesh, ne) => isik.golgeyeKat(mesh, ne),
    gunesYonu: () => isik.gunesYonu(),
    dunya: () => dunya,
    yukseklik: (x, z) => yukseklik(x, z),
    zeminRengi: (x, z) => {
      for (const { ornek } of kurulu.values()) if (ornek.renk) return ornek.renk(x, z);
      return null;
    },
  };

  const yukseklik = (x: number, z: number): number => {
    for (const { ornek } of kurulu.values()) if (ornek.yukseklik) return ornek.yukseklik(x, z);
    return 0;
  };

  const ayarlari = (k: KatmanTanimi) => {
    const modul = kayit.get(k.tur);
    if (!modul) throw new Error(`katman "${k.ad}": bilinmeyen modül "${k.tur}" (bilinenler: ${[...kayit.keys()].join(", ")})`);
    return ayarBirlestir(k.tur, modul.varsayilan, k.ayar);
  };
  const katmanKur = (k: KatmanTanimi): ModulOrnegi => kayit.get(k.tur)!.kur(baglam, ayarlari(k));
  const yik = (o: ModulOrnegi) => {
    for (const m of o.meshler) isik.golgedenCikar(m);
    o.yokEt();
  };

  /**
   * Katmanları tanıma uydurur: değişeni yık-kur (ya da modül yapabiliyorsa YERİNDE güncelle), kalkanı yık, yeniyi
   * kur. Palet değişirse hepsi değişmiş sayılır. KATMAN SIRASI = BAĞIMLILIK SIRASI: zemini SAĞLAYAN bir katman
   * (yukseklik/renk veren) yeniden kurulunca ya da bir katman kalkınca, ondan sonraki ZEMİNE BAĞLI katmanlar da
   * yeniden kurulur — zemin değişince üstüne oturan kayalar yeniden yerleşsin. Kaya değişince çim kurulmaz
   * (çim kayayı okumaz; eskiden her sonraki kuruluyordu: kaya tohumu 887 ms, çoğu çim — ölçüldü, spec 22).
   * Zemin yalnız bir BÖLGEDE değiştiyse (arazi fırçası) sonrakiler o bölgeyi yeniler (`bolgeYenile`).
   */
  const katmanlariUydur = () => {
    const paletImza = JSON.stringify(tanim.palet);
    const istenen = tanim.katmanlar.filter((k) => k.acik);
    const istenenAd = new Set(istenen.map((k) => k.ad));
    let zincir = false;
    const bolgeler: Bolge[] = [];
    for (const [ad, k] of kurulu) if (!istenenAd.has(ad)) { yik(k.ornek); kurulu.delete(ad); zincir = true; }
    const eskiler = new Map(kurulu);
    kurulu.clear();
    for (const k of istenen) {
      const imza = paletImza + JSON.stringify([k.tur, k.ayar]);
      const eski = eskiler.get(k.ad);
      eskiler.delete(k.ad);
      const bagli = kayit.get(k.tur)?.zemineBagli !== false;
      const kur = () => {
        if (eski) yik(eski.ornek);
        const ornek = katmanKur(k);
        kurulu.set(k.ad, { imza, palet: paletImza, ornek });
        if (ornek.yukseklik || ornek.renk) zincir = true;   // zemini sağlayan değişti: bağlılar yeniden kurulsun
      };
      if (!eski) { kur(); continue; }
      if (zincir && bagli) { kur(); continue; }
      if (eski.imza !== imza) {
        // Yerinde güncelleme: palet aynıysa ve modül yapabiliyorsa (yalnız arazi verisi değişti gibi).
        const r = eski.palet === paletImza && eski.ornek.ayarGuncelle ? eski.ornek.ayarGuncelle(ayarlari(k)) : false;
        if (r === false) { kur(); continue; }
        if (r) bolgeler.push(r);
      }
      if (bolgeler.length && bagli && !(eski.ornek.yukseklik || eski.ornek.renk)) {
        if (!eski.ornek.bolgeYenile) { kur(); continue; }
        for (const b of bolgeler) eski.ornek.bolgeYenile(b);
      }
      kurulu.set(k.ad, { imza, palet: paletImza, ornek: eski.ornek });
    }
  };

  gorunusUygula();
  katmanlariUydur();
  nesneleriUygula();
  stil.sahneDegisti();

  return {
    tanim: () => kopya(tanim),
    ayarla(yeni) {
      const d = levelTanimiDogrula(yeni);
      if (!d.ok) throw new Error(`level tanımı geçersiz — ${d.hata}`);
      const onceki = tanim;
      tanim = normallestir(kopya(d.deger), kayit, shaderKaydi);
      try {
        gorunusUygula();
        katmanlariUydur();
        nesneleriUygula();
        stil.sahneDegisti();
      } catch (err) {
        // Yarım kalmasın: önceki tanıma dön (kurulamayan katman zaten eski hâlinde ya da yıkılmış).
        tanim = onceki;
        gorunusUygula();
        katmanlariUydur();
        nesneleriUygula();
        stil.sahneDegisti();
        throw err;
      }
    },
    guncelle(dt) {
      if (tanim.zaman) {
        zamanIlerle(dunya, tanim.zaman, dt, dunyaPaleti(tanim.zaman.dunya).kareler);
        isik.zamanUygula(dunya);
        stil.isikYonu(isik.isikYonu());
        stil.saatDegisti(dunya.saat);
      } else {
        dunya.sure += dt;
        dunya.gunesYonu = isik.gunesYonu();
      }
      shaderlar.kare(dunya);
      for (const { ornek } of kurulu.values()) ornek.guncelle?.(dt);
    },
    dunya,
    shaderlar,
    yukseklik,
    isik,
    stil,
    nesneler,
    sayim: () => ({ katman: kurulu.size, mesh: [...kurulu.values()].reduce((t, k) => t + k.ornek.meshler.length, 0) }),
    yokEt() {
      for (const { ornek } of kurulu.values()) yik(ornek);
      kurulu.clear();
      nesneler.yokEt();
      shaderlar.yokEt();
      stil.yokEt();
      isik.yokEt();
    },
  };
}
