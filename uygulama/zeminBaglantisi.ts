// uygulama/zeminBaglantisi.ts — OYUN İÇİ ZEMİN ŞEKİLLENDİRME (Yapı çubuğu · Zemin sekmesi): kalemin bitirdiği vuruşları kayda, geri al yığınına ve Orion'un dünyasına işler.
//
// Kalem (`zeminKalemi.ts`) vuruş boyunca level'ı canlı değiştirir; vuruş BİTİNCE buraya gelir:
//   şekil kaydedilir → geri al adımı eklenir → araziye oturan nesneler yerleştirme kaydına yazılır (açılışta eski yüksekliğe dönmesinler) →
//   Orion'un `Yer`i yeniden ölçülür (yürüdüğü zemin değişti). Geri al/ileri al aynı yolu tersine işler: zemin + o vuruşta oynayan nesneler birlikte.
// Ardışık komutlar kuyrukta sırayla çalışır (yarış yok); hata olursa neden altyazıda söylenir, geçmiş işaretçisi geri sarılır.
"use strict";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { Vec3 } from "../world/level/cekirdek/levelTanimi.ts";
import type { Bolge } from "../world/level/cekirdek/modul.ts";
import type { Yer } from "../world/yer/yer.ts";
import type { Degisim } from "./yerlestirme.ts";
import type { Depo } from "./yerlestirmeKaydi.ts";
import { oturanlar, zeminEsit, zeminGecmisiKur, zeminOku, zeminYaz, type Oturan, type ZeminKaydi } from "./zemin.ts";
import { zeminiKaydet, zeminiYukle } from "./zeminKaydi.ts";

/** Bütün haritayı kapsayan bölge ("dosyadaki zemine dön": her yerdeki nesneler yeniden oturur). */
const HER_YER: Bolge = { x0: -1e9, z0: -1e9, x1: 1e9, z1: 1e9 };

export interface ZeminBaglantisiAyari {
  /** Birleşik dünyanın level'ı (hazır değilse null). */
  level: () => Level | null;
  /** Level'dan taze `Yer` ölç. */
  yeniYer: (level: Level) => Promise<Yer>;
  /** Taze yeri dünyaya ver. */
  yerGuncelle: (yer: Yer) => void;
  /** Araziye oturan nesnelerin yeni konumunu yerleştirme kaydına yaz (`yerlestirme.donustur`; kendi içinde `Yer`i de yeniler). */
  nesneleriTasi: (degisim: ReadonlyMap<string, Degisim>, mesaj: string) => Promise<void>;
  altyazi: (metin: string, ms?: number) => void;
  /** Verilmezse localStorage; null: depo yok. */
  depo?: Depo | null;
}

/** Kalemin bitirdiği bir vuruş. */
export interface Vurus {
  /** Vuruş başlamadan önceki şekil. */
  once: ZeminKaydi;
  /** Değişen alan (m); yoksa null. */
  bolge: Bolge | null;
  /** Geri al listesinde görünen ad ("yükselt", "düzle"…). */
  ad: string;
  nesneleriOturt: boolean;
}

export interface ZeminBaglantisi {
  /** Birleşik dünya hazır olunca: dosyadaki zemini hatırla, kayıtlı şekli uygula. */
  baslat(): Promise<void>;
  vurusBitti(v: Vurus): Promise<void>;
  geriAl(): Promise<void>;
  ileriAl(): Promise<void>;
  /** Benim şeklimi at, level dosyasındaki zemine dön (geri alınabilir). */
  dosyadakineDon(): Promise<void>;
  /** Kaydedilmiş bir şekil var mı (dosyadakinden farklı). */
  sekilVar(): boolean;
  sayilar(): { geri: number; ileri: number };
  /** Geçmiş ya da şekil durumu değişince (düğmeler tazelensin). */
  degistiginde(f: () => void): () => void;
  /** Testler: bekleyen bütün komutlar bitene dek. */
  bitti(): Promise<void>;
}

export function zeminBaglantisiKur(a: ZeminBaglantisiAyari): ZeminBaglantisi {
  const depo = a.depo;   // undefined → localStorage (varsayılan), null → depo yok
  const gecmis = zeminGecmisiKur();
  /** Level dosyasındaki (Ozyn'in) zemin: "dosyadaki hâle dön" ve "kayıt dosyayla aynı" kararı bunun üzerinden. */
  let taban: ZeminKaydi | null = null;
  /** Benim şeklim; null = dokunulmamış (dosyadaki zemin geçerli). */
  let kayit: ZeminKaydi | null = null;
  let kuyruk: Promise<void> = Promise.resolve();
  const dinleyiciler = new Set<() => void>();
  const yay = () => { for (const f of [...dinleyiciler]) f(); };

  function sirala(isim: string, f: () => Promise<void>): Promise<void> {
    const is = kuyruk.then(async () => {
      try { await f(); }
      catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        console.error(`[ZEMIN] ${isim} başarısız: ${m}`);
        a.altyazi(`${isim} yapılamadı: ${m}`, 4000);
      }
      yay();
    });
    kuyruk = is;
    return is;
  }

  /** Şekli level'a yaz, kaydı güncelle; oynayan nesneler varsa yerleştirme kaydına, yoksa yalnız Yer'i yenile. */
  async function uygula(l: Level, k: ZeminKaydi, nesneler: readonly { id: string; konum: Vec3 }[], nesneMesaji: string): Promise<void> {
    l.ayarla(zeminYaz(l.tanim(), k));
    kayit = taban && zeminEsit(k, taban) ? null : k;
    zeminiKaydet(kayit, depo);
    if (nesneler.length) await a.nesneleriTasi(new Map(nesneler.map((n) => [n.id, { konum: n.konum }])), nesneMesaji);
    else a.yerGuncelle(await a.yeniYer(l));
  }
  const oturtMesaji = (n: number) => `${n} nesne araziye oturtuldu`;

  /** Bir geçmiş adımını `yon`a uygula; hata olursa işaretçiyi geri sar. */
  async function adimUygula(yon: "geri" | "ileri"): Promise<void> {
    const l = a.level();
    if (!l) throw new Error("dünya henüz hazır değil");
    const adim = yon === "geri" ? gecmis.geriAl() : gecmis.ileriAl();
    if (!adim) { a.altyazi(yon === "geri" ? "geri alınacak zemin adımı yok" : "ileri alınacak zemin adımı yok", 1800); return; }
    try {
      const hedef = yon === "geri" ? adim.once : adim.sonra;
      const nesneler = adim.oturan.map((o: Oturan) => ({ id: o.id, konum: yon === "geri" ? o.once : o.sonra }));
      await uygula(l, hedef, nesneler, oturtMesaji(nesneler.length));
      a.altyazi(`${yon === "geri" ? "geri alındı" : "ileri alındı"}: ${adim.ad}`, 1800);
    } catch (err) {
      if (yon === "geri") gecmis.ileriAl(); else gecmis.geriAl();
      throw err;
    }
  }

  return {
    async baslat() {
      const l = a.level();
      if (!l) return;
      taban = zeminOku(l.tanim());
      const k = zeminiYukle(depo);
      if (!k) return;
      if (!taban) { console.warn("[ZEMIN] kayıtlı şekil var ama level'da zemin katmanı yok; atlandı"); return; }
      if (zeminEsit(k, taban)) return;
      try {
        l.ayarla(zeminYaz(l.tanim(), k));
        kayit = k;
        a.yerGuncelle(await a.yeniYer(l));
        console.log(`[ZEMIN] kayıtlı zemin şekli uygulandı: ${k.duzenleme.length / 2} hücre`);
      } catch (err) { console.error("[ZEMIN] kayıt uygulanamadı:", err instanceof Error ? err.message : err); }
      yay();
    },
    vurusBitti(v) {
      return sirala("zemin vuruşu", async () => {
        const l = a.level();
        if (!l) throw new Error("dünya henüz hazır değil");
        const simdi = zeminOku(l.tanim());
        if (!simdi || zeminEsit(simdi, v.once)) return;   // hiçbir şey değişmedi: geçmişe adım yok
        const oturan = v.nesneleriOturt && v.bolge ? oturanlar(l.tanim(), v.once, simdi, v.bolge) : [];
        gecmis.ekle({ ad: v.ad, once: v.once, sonra: simdi, oturan });
        try {
          kayit = taban && zeminEsit(simdi, taban) ? null : simdi;
          zeminiKaydet(kayit, depo);
          if (oturan.length) await a.nesneleriTasi(new Map(oturan.map((o) => [o.id, { konum: o.sonra }])), oturtMesaji(oturan.length));
          else a.yerGuncelle(await a.yeniYer(l));
        } catch (err) {
          // Zemin zaten sahnede ve kayıtta; yalnız nesne/Yer güncellemesi başarısız oldu: adım kalır (geri alınabilir), neden söylenir.
          throw new Error(`zemin şekillendi ama nesneler/Yer güncellenemedi (${err instanceof Error ? err.message : String(err)})`);
        }
      });
    },
    geriAl: () => sirala("geri alma", () => adimUygula("geri")),
    ileriAl: () => sirala("ileri alma", () => adimUygula("ileri")),
    dosyadakineDon() {
      return sirala("dosyadaki zemine dönme", async () => {
        const l = a.level();
        if (!l) throw new Error("dünya henüz hazır değil");
        const simdi = zeminOku(l.tanim());
        if (!taban || !simdi) throw new Error("level'da zemin katmanı yok");
        if (zeminEsit(simdi, taban)) { a.altyazi("zemin zaten dosyadaki hâlinde", 1800); return; }
        const oturan = oturanlar(l.tanim(), simdi, taban, HER_YER);
        gecmis.ekle({ ad: "dosyadaki zemine dönüş", once: simdi, sonra: taban, oturan });
        await uygula(l, taban, oturan.map((o) => ({ id: o.id, konum: o.sonra })), oturtMesaji(oturan.length));
        a.altyazi("dosyadaki zemine dönüldü (geri alınabilir)", 2500);
      });
    },
    sekilVar: () => kayit !== null,
    sayilar: () => gecmis.sayilar(),
    degistiginde(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    bitti: () => kuyruk,
  };
}
