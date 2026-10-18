// uygulama/yerlestirmeBaglantisi.ts — OYUN İÇİ ASSET YERLEŞTİRME (spec 30): menü komutlarını level'a uygular. İnce kompozisyon; saf mantık `yerlestirme.ts`te.
//
// Level'ın KAMU API'si kullanılır (`Level.tanim()/ayarla()`, `nesneler.katalog()/anlamlar()/hazir()`; level editörüyle aynı yol): yeni kod `world/level`'a girmez.
// Her değişiklik: yeni durumu hesapla → `level.ayarla` (yeni yerleşim listesiyle) → glb'ler yüklenince Orion'un `Yer`ini YENİDEN ÖLÇ (yeni nesne Orion'un dünyasına girer,
// çarpışma/engel olur) → kaydet. Ardışık komutlar kuyrukta sırayla çalışır (yarış yok). Hata olursa durum eski hâline döner ve nedeni altyazıda söylenir.
"use strict";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { Vec3 } from "../world/level/cekirdek/levelTanimi.ts";
import type { Nesne } from "../world/level/nesneKaydi.ts";
import { kisaAd } from "../world/level/cekirdek/katalog.ts";
import type { Yer } from "../world/yer/yer.ts";
import { assetGruplari, assetKartlari, type AssetGrubu, type AssetKarti } from "./assetListesi.ts";
import { bosDurum, donustur, ekle, eklenenMi, kaldir, tanimaUygula, type Degisim, type YerlestirmeDurumu } from "./yerlestirme.ts";
import type { NesneDuzenleme, Uygunluk } from "./menuKatkilari.ts";
import { yerlestirmeyiKaydet, yerlestirmeyiYukle, type Depo } from "./yerlestirmeKaydi.ts";

export interface YerlestirmeAyari {
  /** Birleşik dünyanın level'ı (hazır değilse null). */
  level: () => Level | null;
  /** Level'dan taze `Yer` ölç (asıl yol: `levelYeriniOlc` + `birlesikYerKur`). */
  yeniYer: (level: Level) => Promise<Yer>;
  /** Taze yeri dünyaya ver (`yerler.ozyn/orion`). */
  yerGuncelle: (yer: Yer) => void;
  altyazi: (metin: string, ms?: number) => void;
  /** Verilmezse localStorage. */
  depo?: Depo | null;
}

export interface Yerlestirme {
  /** Birleşik dünya hazır olunca: kaydı oku, kataloğu yükle, kayıtlı yerleştirmeleri level'a uygula. */
  baslat(): Promise<void>;
  /** Menü için asset grupları (katalog yüklenmediyse null). */
  gruplar(): readonly AssetGrubu[] | null;
  /** Alt çubuk için asset kartları (önizleme + boyut; katalog yüklenmediyse null). Menüyle aynı görünen ad ve kategori. */
  kartlar(): readonly AssetKarti[] | null;
  pano(): { ad: string } | null;
  duzenleme(n: Nesne): NesneDuzenleme;
  /** Varlığı `konum`a koy (taban ortası); `donus` derece (Euler) ya da verilmezse 0. */
  yerlestir(varlik: string, konum: Vec3, donus?: Vec3): Promise<void>;
  yapistir(nokta: { x: number; y: number; z: number }): Promise<void>;
  kopyala(id: string): void;
  /** Gizmo/sürükleme sonucu: nesnelerin yeni konum/dönüş/ölçeği TEK adımda (tek `level.ayarla`). */
  donustur(degisim: ReadonlyMap<string, Degisim>, mesaj: string): Promise<void>;
  kaldir(id: string): Promise<void>;
  /** Testler: bekleyen bütün komutlar bitene dek. */
  bitti(): Promise<void>;
}

interface PanoKaydi { varlik: string; donus: number | Vec3; olcek: number | Vec3; ad: string }

export function yerlestirmeKur(a: YerlestirmeAyari): Yerlestirme {
  const depo = a.depo;   // undefined → localStorage (varsayılan), null → depo yok
  let durum: YerlestirmeDurumu = bosDurum();
  let gruplar: AssetGrubu[] | null = null;
  let kartlar: AssetKarti[] | null = null;
  let anlamAdlari: ReadonlyMap<string, string> = new Map();
  let pano: PanoKaydi | null = null;
  let kuyruk: Promise<void> = Promise.resolve();

  const ad = (varlik: string): string => anlamAdlari.get(varlik) ?? kisaAd(varlik);
  const levelNesnesi = (id: string) => a.level()?.tanim().nesneler?.find((n) => n.id === id) ?? null;
  const gorunenAd = (id: string): string => { const n = levelNesnesi(id); return n ? (n.ad ?? ad(n.varlik)) : id; };

  /** Komutu sıraya al; hata altyazıya ve konsola yazılır, durum eski hâline döner. */
  function sirala(isim: string, f: (onceki: YerlestirmeDurumu) => YerlestirmeDurumu | null, basari: string): Promise<void> {
    const is = kuyruk.then(async () => {
      const onceki = durum;
      try {
        const yeni = f(onceki);
        if (!yeni) return;
        durum = yeni;
        await uygula();
        a.altyazi(basari, 1800);
      } catch (err) {
        durum = onceki;
        const m = err instanceof Error ? err.message : String(err);
        console.error(`[YERLESTIRME] ${isim} başarısız: ${m}`);
        a.altyazi(`${isim} yapılamadı: ${m}`, 4000);
      }
    });
    kuyruk = is;
    return is;
  }

  async function uygula(): Promise<void> {
    const l = a.level();
    if (!l) throw new Error("dünya henüz hazır değil");
    const t = l.tanim();
    l.ayarla({ ...t, nesneler: tanimaUygula(t.nesneler ?? [], durum) });
    await l.nesneler.hazir();
    a.yerGuncelle(await a.yeniYer(l));
    yerlestirmeyiKaydet(durum, depo);
  }

  return {
    async baslat() {
      const l = a.level();
      if (!l) return;
      durum = yerlestirmeyiYukle(depo);
      const [katalog, sozluk] = await Promise.all([l.nesneler.katalog(), l.nesneler.anlamlar().catch(() => null)]);
      gruplar = assetGruplari(katalog, sozluk);
      kartlar = assetKartlari(katalog, sozluk);
      anlamAdlari = new Map(Object.entries(sozluk?.varliklar ?? {}).flatMap(([k, v]) => (v.ad ? [[k, v.ad] as const] : [])));
      // Kayıtlı ama katalogda artık olmayan varlık: yüklenemez, sessiz değil atlanır.
      const katalogAdlari = new Set(katalog.varliklar.map((v) => v.ad));
      const eksik = durum.eklenen.filter((e) => !katalogAdlari.has(e.varlik));
      if (eksik.length) {
        console.warn(`[YERLESTIRME] katalogda olmayan ${eksik.length} varlık atlandı: ${eksik.map((e) => e.varlik).join(", ")}`);
        durum = { ...durum, eklenen: durum.eklenen.filter((e) => katalogAdlari.has(e.varlik)) };
      }
      if (durum.eklenen.length || Object.keys(durum.degisen).length) {
        try { await uygula(); console.log(`[YERLESTIRME] kayıt uygulandı: ${durum.eklenen.length} eklenen, ${Object.keys(durum.degisen).length} değişen`); }
        catch (err) { console.error("[YERLESTIRME] kayıt uygulanamadı:", err instanceof Error ? err.message : err); }
      }
    },
    gruplar: () => gruplar,
    kartlar: () => kartlar,
    pano: () => (pano ? { ad: pano.ad } : null),
    duzenleme(n): NesneDuzenleme {
      const lv = levelNesnesi(n.id);
      const levelDegil: Uygunluk = { uygun: false, neden: "level nesnesi değil (ofis eşyası ya da yüzey)" };
      const kaldirilabilir: Uygunluk = !lv ? levelDegil : eklenenMi(n.id) ? { uygun: true } : { uygun: false, neden: "level dosyasındaki nesne: yalnız menüden eklenenler kaldırılır" };
      return { id: n.id, kopyalanabilir: lv ? { uygun: true } : levelDegil, duzenlenebilir: lv ? { uygun: true } : levelDegil, kaldirilabilir };
    },
    yerlestir(varlik, konum, donus = [0, 0, 0]) {
      return sirala("yerleştirme", (d) => ekle(d, varlik, konum, donus).durum, `yerleştirildi: ${ad(varlik)}`);
    },
    yapistir(nokta) {
      const p = pano;
      if (!p) { a.altyazi("yapıştırılacak bir şey yok: önce Kopyala", 2500); return Promise.resolve(); }
      return sirala("yapıştırma", (d) => ekle(d, p.varlik, [nokta.x, nokta.y, nokta.z], p.donus, p.olcek).durum, `yapıştırıldı: ${p.ad}`);
    },
    kopyala(id) {
      const n = levelNesnesi(id);
      if (!n) { a.altyazi("bu nesne kopyalanamaz (level nesnesi değil)", 2500); return; }
      pano = { varlik: n.varlik, donus: n.donus, olcek: n.olcek, ad: n.ad ?? ad(n.varlik) };
      a.altyazi(`kopyalandı: ${pano.ad} · zemine sağ tık: Yapıştır`, 2500);
    },
    donustur(degisim, mesaj) {
      return sirala("düzenleme", (d) => { let y = d; for (const [id, g] of degisim) y = donustur(y, id, g); return y; }, mesaj);
    },
    kaldir(id) {
      const ismi = gorunenAd(id);
      return sirala("kaldırma", (d) => kaldir(d, id), `kaldırıldı: ${ismi}`);
    },
    bitti: () => kuyruk,
  };
}
