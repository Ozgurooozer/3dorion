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
import { nesneSistemiKur, type NesneSistemi } from "./nesneSistemi.ts";
import { stilSistemiKur, type StilSistemi } from "../stil/stilSistemi.ts";
import { ayarBirlestir, type LevelModulu, type ModulBaglami, type ModulOrnegi } from "./modul.ts";

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
  /** Elle yerleştirilen varlıklar (asset tarayıcısı): katalog, seçme, önizleme örneği. */
  readonly nesneler: NesneSistemi;
  /** Kurulu katman sayısı ve mesh sayısı (ölçüm satırı için). */
  sayim(): { katman: number; mesh: number };
  yokEt(): void;
}

interface Kurulu { imza: string; ornek: ModulOrnegi }

const kopya = <T>(v: T): T => structuredClone(v);

/**
 * Her katmanın ayarını modülün varsayılanıyla TAMAMLAR (tanımda `{}` olsa da bütün parametreler görünür:
 * panel düzenleyebilsin, kaydedilen dosya açık olsun). Bilinmeyen modül ya da ayar burada hata verir.
 */
function normallestir(t: LevelTanimi, kayit: ModulKaydi): LevelTanimi {
  return {
    ...t,
    ortam: { ...t.ortam, piksel: t.ortam.piksel ?? 1 },
    isik: { ...t.isik, gunes: { ...t.isik.gunes, golge: { otomatikSinir: true, kip: 0, karisim: 0.1, ...t.isik.gunes.golge } } },
    stil: stilTamamla(t.stil),
    nesneler: t.nesneler ?? [],
    katmanlar: t.katmanlar.map((k) => {
      const modul = kayit.get(k.tur);
      if (!modul) throw new Error(`katman "${k.ad}": bilinmeyen modül "${k.tur}" (bilinenler: ${[...kayit.keys()].join(", ")})`);
      return { ...k, ayar: { ...ayarBirlestir(k.tur, modul.varsayilan, k.ayar) } };
    }),
  };
}

export function levelKur(sahne: Scene, tanimHam: unknown, kayit: ModulKaydi): Level {
  const ilk = levelTanimiDogrula(tanimHam);
  if (!ilk.ok) throw new Error(`level tanımı geçersiz — ${ilk.hata}`);
  let tanim = normallestir(kopya(ilk.deger), kayit);
  const isik = isikSistemiKur(sahne);
  const stil = stilSistemiKur(sahne);
  const nesneler = nesneSistemiKur({
    sahne,
    // Işıklı: stil eklentili (toon, çizgi…); ışıyan: pişmiş ama sise girer (uzak neon ufka karışsın).
    malzeme: (ad, tur) => malzemeKur(sahne, ad, tur, tur === "isikli" ? { stil: stil.isikDurumu } : { sis: true }),
    golge: (m, ne) => isik.golgeyeKat(m, ne),
    golgedenCikar: (m) => isik.golgedenCikar(m),
  });
  const kurulu = new Map<string, Kurulu>();

  const renk = (ad: string) => renkCoz(ad, tanim.palet);
  /** Işık, ortam ve stil: her düzenlemede (ucuz). */
  const gorunusUygula = () => { isik.uygula(tanim.isik, tanim.ortam, renk); stil.uygula(tanim, renk); };
  const baglam: ModulBaglami = {
    sahne,
    renk,
    // Işıklı her malzeme stil eklentisini alır (stil kapalıyken kod dalı atlanır).
    malzeme: (ad, tur, ayar) => malzemeKur(sahne, ad, tur, tur === "isikli" ? { ...ayar, stil: stil.isikDurumu } : ayar),
    golge: (mesh, ne) => isik.golgeyeKat(mesh, ne),
    gunesYonu: () => isik.gunesYonu(),
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

  const katmanKur = (k: KatmanTanimi): ModulOrnegi => {
    const modul = kayit.get(k.tur);
    if (!modul) throw new Error(`katman "${k.ad}": bilinmeyen modül "${k.tur}" (bilinenler: ${[...kayit.keys()].join(", ")})`);
    return modul.kur(baglam, ayarBirlestir(k.tur, modul.varsayilan, k.ayar));
  };
  const yik = (o: ModulOrnegi) => {
    for (const m of o.meshler) isik.golgedenCikar(m);
    o.yokEt();
  };

  /**
   * Katmanları tanıma uydurur: değişeni yık-kur, kalkanı yık, yeniyi kur. Palet değişirse hepsi değişmiş
   * sayılır. KATMAN SIRASI = BAĞIMLILIK SIRASI: bir katman yeniden kurulunca (ya da kalkınca) ondan SONRAKİLER
   * de yeniden kurulur — zemin değişince üstüne oturan kayalar yeniden yerleşsin. `kurulu` sıralı tutulur.
   */
  const katmanlariUydur = () => {
    const paletImza = JSON.stringify(tanim.palet);
    const istenen = tanim.katmanlar.filter((k) => k.acik);
    const istenenAd = new Set(istenen.map((k) => k.ad));
    let zincir = false;
    for (const [ad, k] of kurulu) if (!istenenAd.has(ad)) { yik(k.ornek); kurulu.delete(ad); zincir = true; }
    const eskiler = new Map(kurulu);
    kurulu.clear();
    for (const k of istenen) {
      const imza = paletImza + JSON.stringify([k.tur, k.ayar]);
      const eski = eskiler.get(k.ad);
      eskiler.delete(k.ad);
      if (eski && eski.imza === imza && !zincir) { kurulu.set(k.ad, eski); continue; }
      if (eski) yik(eski.ornek);
      zincir = true;
      kurulu.set(k.ad, { imza, ornek: katmanKur(k) });
    }
  };

  gorunusUygula();
  katmanlariUydur();
  nesneler.uygula(tanim.nesneler ?? []);
  stil.sahneDegisti();

  return {
    tanim: () => kopya(tanim),
    ayarla(yeni) {
      const d = levelTanimiDogrula(yeni);
      if (!d.ok) throw new Error(`level tanımı geçersiz — ${d.hata}`);
      const onceki = tanim;
      tanim = normallestir(kopya(d.deger), kayit);
      try {
        gorunusUygula();
        katmanlariUydur();
        nesneler.uygula(tanim.nesneler ?? []);
        stil.sahneDegisti();
      } catch (err) {
        // Yarım kalmasın: önceki tanıma dön (kurulamayan katman zaten eski hâlinde ya da yıkılmış).
        tanim = onceki;
        gorunusUygula();
        katmanlariUydur();
        nesneler.uygula(tanim.nesneler ?? []);
        stil.sahneDegisti();
        throw err;
      }
    },
    guncelle(dt) { for (const { ornek } of kurulu.values()) ornek.guncelle?.(dt); },
    yukseklik,
    isik,
    stil,
    nesneler,
    sayim: () => ({ katman: kurulu.size, mesh: [...kurulu.values()].reduce((t, k) => t + k.ornek.meshler.length, 0) }),
    yokEt() {
      for (const { ornek } of kurulu.values()) yik(ornek);
      kurulu.clear();
      nesneler.yokEt();
      stil.yokEt();
      isik.yokEt();
    },
  };
}
