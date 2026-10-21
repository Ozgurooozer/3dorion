// uygulama/menuKatkilari.ts — SAĞ TIK MENÜSÜNÜN KATKILARI (spec 29): hangi hedefte hangi öğe, hangi YOLDA. Çekirdek (`world/arayuz/menu/menuModeli.ts`) hedef bilmez;
// hedefi bilen burasıdır. Eylem mantığı (uygun mu, neden gri, hangi niyet) DEĞİŞMEDİ: `nesneEylemleri` / `hedefEylemleri` aynen çağrılır, burada yalnız
// "menüde nereye girer" söylenir. Yeni hedef (terminal, tahta, duvar…) = yeni `hedef.tur` + buraya yeni katkı.
//
// Yollar bir yerde durur (aşağıdaki tablolar): menüdeki adı/yeri değiştirmek tek satırdır. Tek eylem yolu değişmez: yaprak yükü `NesneEylemi`dir,
// çalıştırma `uygulama/nesneEtkilesimi.ts` → `niyetiYurut`.
"use strict";
import type { MenuKatkisi, MenuOgesi } from "../world/arayuz/menu/menuModeli.ts";
import type { NesneEylemi } from "../world/yer/nesneEylemleri.ts";
import type { YurumeAlani } from "../world/yer/yer.ts";
import { zeminEylemleri, orionEylemleri, type OrionBaglami, type ZeminNoktasi } from "../world/yer/hedefEylemleri.ts";
import type { AssetGrubu } from "./assetListesi.ts";

/** Orion'un sohbetini sıkıştıran söz: köprünün `kopru.sikistir` içgüdüsü bunu tam eşleşmeyle tanır (test: `sikistirmaIstegi`). */
export const SIKISTIR_KOMUTU = "/compact";

/** Menü yaprağının yükü: bir hedef eylemi, Ozyn'in yazmış gibi söyleyeceği komut ya da menünün kendi iki komutu. */
export type MenuEylemi =
  | { tur: "eylem"; eylem: NesneEylemi }
  /** Klavyeden yazılmış gibi Orion'a giden söz (aynı yol: `kopru.algi({ tur: "duydum", kesin: true })`, içgüdü karar kaydına yazılır). */
  | { tur: "soz"; metin: string }
  /** Zemin/nesne menüsünden BİR AJANIN BEDENİNE verilen eylem ("Flash ▸ Buraya ▸ Git", "Flash ▸ Otur"): niyet o ajanın kendi beden kapısından geçer (Orion'unkinden ayrı). */
  | { tur: "ajanEylem"; ajan: string; eylem: NesneEylemi }
  /** Belirli bir AJANA giden söz (Flash menüsü, spec 33): `ajan` kimliği; giriş adaptörünün hedef seçimini (sohbet çipleri) atlar, yalnız o ajana gider. */
  | { tur: "ajanSoz"; ajan: string; metin: string }
  // Asset yerleştirme (spec 30): hepsi `uygulama/yerlestirmeBaglantisi.ts`te çalışır; menü yalnız ne istendiğini söyler.
  /** Yerleştir: sağ tıkladığım noktaya hemen koy. Çağır: asset imleci izler, tıklayınca konur (Esc/sağ tık vazgeçer). */
  | { tur: "yerlestir"; varlik: string }
  | { tur: "cagir"; varlik: string }
  | { tur: "yapistir" }
  | { tur: "kopyala"; id: string }
  /** Gizmo ile düzenle: `arac` taşı/döndür/ölçekle; seçili nesneye oklar/halkalar takılır. */
  | { tur: "duzenle"; id: string; arac: DuzenlemeAraci }
  | { tur: "duzenleBitir" }
  | { tur: "kaldir"; id: string }
  | { tur: "ozellikler" }
  | { tur: "secimiKaldir" }
  /** Hafıza sekmesindeki md dosyaları (spec 32): düzenleyicide aç, bağlama ekle/çıkar, içeriği/adı panoya kopyala. */
  | { tur: "mdAc"; ad: string }
  | { tur: "mdAktif"; ad: string; aktif: boolean }
  | { tur: "mdKopyala"; ad: string }
  | { tur: "mdAdKopyala"; ad: string };

export type DuzenlemeAraci = "tasi" | "dondur" | "olcek";

/** Zemin menüsünün asset bilgisi: katalog (yüklenmediyse null), kopyalanmış nesnenin adı. */
export interface ZeminYerlestirme { gruplar: readonly AssetGrubu[] | null; pano: { ad: string } | null }
export interface Uygunluk { uygun: boolean; neden?: string }
/** Nesne menüsünün düzenleme bilgisi: bu nesne için Kopyala / Düzenle (gizmo) / Kaldır yapılabilir mi (gri ise nedeni). */
export interface NesneDuzenleme { id: string; kopyalanabilir: Uygunluk; duzenlenebilir: Uygunluk; kaldirilabilir: Uygunluk }

/** Hafıza sekmesindeki bir md dosyası (sağ tık menüsünün hedefi). */
export interface MdDosyaMenusu { ad: string; aktif: boolean; sistem: boolean }

/** Orion dışındaki bir ajanın bedeni (sağ tık menüsünün hedefi; Flash). */
export interface AjanMenusu { id: string; ad: string; oturuyor: boolean }
/** Zemin/nesne menüsünde komut alabilecek bedenli ajan (Flash): menüde "Flash ▸ …" girişleri çıkar. */
export interface MenuAjani { id: string; ad: string }

export type MenuHedefi =
  | { tur: "zemin"; nokta: ZeminNoktasi; alan: YurumeAlani; yerlestirme?: ZeminYerlestirme; ajanlar?: readonly MenuAjani[] }
  | { tur: "dosya"; dosya: MdDosyaMenusu }
  | { tur: "orion"; orion: OrionBaglami }
  | { tur: "ajan"; ajan: AjanMenusu }
  | { tur: "nesne"; ad: string; eylemler: readonly NesneEylemi[]; duzenleme?: NesneDuzenleme; ajanlar?: readonly MenuAjani[] };

/** Menü çekirdeği ayarı: asset listesi çok uzun (kategori/ad sırasıyla zaten düzenli), "Diğer ▸" ile bölünmez, görünüm kaydırır. */
export const MENU_AYARI = { sinirsizKokler: ["Asset"] } as const;

export interface HedefMenuBaglami { hedef: MenuHedefi }
export type HedefKatkisi = MenuKatkisi<HedefMenuBaglami, MenuEylemi>;

const yuk = (eylem: NesneEylemi): MenuEylemi => ({ tur: "eylem", eylem });
const yapak = (e: NesneEylemi, yol: readonly string[], sira: number, grup: string): MenuOgesi<MenuEylemi> =>
  ({ yol, kimlik: e.kimlik, sira, grup, uygun: e.uygun, ...(e.neden ? { neden: e.neden } : {}), eylem: yuk(e) });

/** Zemin: "Orion ▸ Buraya ▸ Git / Bak". Kimlik → yol tablosu (zeminEylemleri'nin kimlikleri). */
const ZEMIN_YOLU: Readonly<Record<string, readonly string[]>> = { "orion.git": ["Orion", "Buraya", "Git"], "orion.bak": ["Orion", "Buraya", "Bak"] };

const zeminKatkisi: HedefKatkisi = {
  kimlik: "zemin", hedefler: ["zemin"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "zemin") return [];
    return zeminEylemleri(h.nokta, h.alan).flatMap((e, i) => { const y = ZEMIN_YOLU[e.kimlik]; return y ? [yapak(e, y, 10 + i, "orion")] : []; });
  },
};

/** Orion'a tıklayınca: bedensel komutlar doğrudan listede (alt menüsüz; kısa liste). */
const orionKatkisi: HedefKatkisi = {
  kimlik: "orion", hedefler: ["orion"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "orion") return [];
    return orionEylemleri(h.orion).map((e, i) => yapak(e, [e.ad], 10 + i, "orion"));
  },
};

/**
 * Zemine sağ tık: her bedenli ajan için "<Ajan> ▸ Buraya ▸ Git / Bak" (Orion'un girişiyle AYNI eylem verisi: `zeminEylemleri`, yalnız eylem o ajanın bedenine gider).
 * Ozyn, 2026-10-21: "sağ tık menüsünü de unutmuşsun" — Flash eklenince zemin ve nesne menüleri yalnız Orion'u tanıyordu.
 */
const ajanZeminKatkisi: HedefKatkisi = {
  kimlik: "ajanZemin", hedefler: ["zemin"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "zemin" || !h.ajanlar?.length) return [];
    return h.ajanlar.flatMap((a, ai) => zeminEylemleri(h.nokta, h.alan).flatMap((e, i) => {
      const y = ZEMIN_YOLU[e.kimlik];
      return y ? [ajanOgesi(a, e, [a.ad, ...y.slice(1)], 40 + ai * 10 + i)] : [];
    }));
  },
};

/** Nesneye sağ tık: her bedenli ajan için "<Ajan> ▸ <eylem>" (Orion'un "Orion ▸ …" girişleriyle aynı eylemler: git, bak, otur…). */
const ajanNesneKatkisi: HedefKatkisi = {
  kimlik: "ajanNesne", hedefler: ["nesne"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "nesne" || !h.ajanlar?.length) return [];
    return h.ajanlar.flatMap((a, ai) => h.eylemler.filter((e) => e.kim === "orion").map((e, i) => ajanOgesi(a, e, [a.ad, e.ad], 30 + ai * 10 + i)));
  },
};

/** Bir NesneEylemi'ni belirli bir ajanın menü öğesine çevirir (gri ise nedeni aynen taşınır). */
function ajanOgesi(a: MenuAjani, e: NesneEylemi, yol: readonly string[], sira: number): MenuOgesi<MenuEylemi> {
  return { yol, kimlik: `ajan.${a.id}.${e.kimlik}`, sira, grup: `ajan.${a.id}`, uygun: e.uygun, ...(e.neden ? { neden: e.neden } : {}), eylem: { tur: "ajanEylem", ajan: a.id, eylem: e } };
}

/**
 * Orion dışındaki ajanın (Flash) menüsü: bildiği komutlar doğrudan listede, her biri O ajana giden söz (`ajanSoz`). Sözler komut sözlüğünün
 * tam eşleştiği kalıplar (spec 33 §6): menüden basmak ile yazmak aynı kapıdan geçer, yani menü "ne yapabildiğini" de gösterir. Otururken "Kalk",
 * ayaktayken "Otur" (ikisi birden asla çıkmaz).
 */
const ajanKatkisi: HedefKatkisi = {
  kimlik: "ajan", hedefler: ["ajan"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "ajan") return [];
    const a = h.ajan;
    const soz = (yolAdi: string, kimlik: string, sira: number, metin: string): MenuOgesi<MenuEylemi> =>
      ({ yol: [yolAdi], kimlik: `ajan.${kimlik}`, sira, grup: "ajan", uygun: true, eylem: { tur: "ajanSoz", ajan: a.id, metin } });
    return [
      a.oturuyor ? soz("Kalk", "kalk", 10, "kalk") : soz("Otur", "otur", 10, "otur"),
      soz("Bana gel", "gel", 11, "bana gel"),
      soz("Beni takip et", "takip", 12, "beni takip et"),
      soz("Takibi bırak", "takipBirak", 13, "takibi bırak"),
      soz("Pencereye bak", "pencere", 14, "pencereye bak"),
    ];
  },
};

/** Nesne: "Orion ▸ …" (Orion yapsın) ve "Ben ▸ …" (ben yapayım). */
const nesneKatkisi: HedefKatkisi = {
  kimlik: "nesne", hedefler: ["nesne"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "nesne") return [];
    return h.eylemler.map((e, i) => yapak(e, [e.kim === "orion" ? "Orion" : "Ben", e.ad], (e.kim === "orion" ? 10 : 50) + i, e.kim));
  },
};

/** Zemin: `Asset ▸ Kategori ▸ Ad ▸ Yerleştir | Çağır`, Yapıştır. Yerleştir = tıkladığım noktaya hemen, Çağır = imleçle taşınan hayalet, tıklayınca konur (spec 30). */
const assetKatkisi: HedefKatkisi = {
  kimlik: "asset", hedefler: ["zemin"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "zemin" || !h.yerlestirme) return [];
    const y = h.yerlestirme;
    const ogeler: MenuOgesi<MenuEylemi>[] = [];
    if (!y.gruplar) {
      ogeler.push({ yol: ["Asset (yükleniyor…)"], kimlik: "asset.yukleniyor", sira: 20, grup: "asset", uygun: false, neden: "varlık kataloğu henüz yüklenmedi", eylem: { tur: "secimiKaldir" } });
    } else {
      for (const g of y.gruplar) {
        for (const o of g.ogeler) {
          ogeler.push({ yol: ["Asset", g.ad, o.ad, "Yerleştir"], kimlik: `asset.yerlestir.${o.varlik}`, sira: 20, grup: "asset", uygun: true, eylem: { tur: "yerlestir", varlik: o.varlik } });
          ogeler.push({ yol: ["Asset", g.ad, o.ad, "Çağır"], kimlik: `asset.cagir.${o.varlik}`, sira: 21, grup: "asset", uygun: true, eylem: { tur: "cagir", varlik: o.varlik } });
        }
      }
    }
    ogeler.push({ yol: [y.pano ? `Yapıştır (${y.pano.ad})` : "Yapıştır"], kimlik: "asset.yapistir", sira: 30, grup: "asset", uygun: y.pano !== null,
      ...(y.pano ? {} : { neden: "önce bir nesneye sağ tıkla ve Kopyala de" }), eylem: { tur: "yapistir" } });
    // Ağaç/bank/lamba/kaya/çim level'da tek tek nesne değil, katmanın serptiği dekor: seçilemez, o yüzden kopyalanamaz. Sessiz kalmasın, nedeni menüde dursun.
    ogeler.push({ yol: ["Kopyalanamayanlar (ağaç, kaya, çim…)"], kimlik: "asset.kopyalanamaz", sira: 31, grup: "asset", uygun: false,
      neden: "ağaç, bank, sokak lambası, kaya, çim ve su kodla serpilen dekordur, tek tek nesne değil; Asset menüsünden benzerini yerleştir", eylem: { tur: "secimiKaldir" } });
    return ogeler;
  },
};

/** Nesne: Kopyala / Düzenle ▸ Taşı | Döndür | Ölçekle | Bitir / Kaldır (spec 30). Gri ise nedeni menüde: level dosyasındaki nesne kaldırılamaz, ofis eşyası kopyalanıp düzenlenemez. */
const duzenlemeKatkisi: HedefKatkisi = {
  kimlik: "duzenleme", hedefler: ["nesne"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "nesne" || !h.duzenleme) return [];
    const d = h.duzenleme;
    const oge = (ad: string, kimlik: string, sira: number, u: Uygunluk, eylem: MenuEylemi): MenuOgesi<MenuEylemi> =>
      ({ yol: [ad], kimlik, sira, grup: "duzenle", uygun: u.uygun, ...(u.neden ? { neden: u.neden } : {}), eylem });
    return [
      oge("Kopyala", "duzenle.kopyala", 60, d.kopyalanabilir, { tur: "kopyala", id: d.id }),
      { yol: ["Düzenle", "Taşı (oklar)"], kimlik: "duzenle.tasi", sira: 61, grup: "duzenle", uygun: d.duzenlenebilir.uygun, ...(d.duzenlenebilir.neden ? { neden: d.duzenlenebilir.neden } : {}), eylem: { tur: "duzenle", id: d.id, arac: "tasi" } },
      { yol: ["Düzenle", "Döndür (halkalar)"], kimlik: "duzenle.dondur", sira: 62, grup: "duzenle", uygun: d.duzenlenebilir.uygun, ...(d.duzenlenebilir.neden ? { neden: d.duzenlenebilir.neden } : {}), eylem: { tur: "duzenle", id: d.id, arac: "dondur" } },
      { yol: ["Düzenle", "Ölçekle (kutular)"], kimlik: "duzenle.olcek", sira: 63, grup: "duzenle", uygun: d.duzenlenebilir.uygun, ...(d.duzenlenebilir.neden ? { neden: d.duzenlenebilir.neden } : {}), eylem: { tur: "duzenle", id: d.id, arac: "olcek" } },
      { yol: ["Düzenle", "Düzenlemeyi bitir"], kimlik: "duzenle.bitir", sira: 64, grup: "duzenle", uygun: true, eylem: { tur: "duzenleBitir" } },
      oge("Kaldır", "duzenle.kaldir", 65, d.kaldirilabilir, { tur: "kaldir", id: d.id }),
    ];
  },
};

/** Her hedefte: "Sohbet ▸ Sıkıştır (/compact)": Orion'un hafızasını/sohbetini menüden sıkıştır (yazmakla aynı yol). */
const sohbetKatkisi: HedefKatkisi = {
  kimlik: "sohbet", hedefler: ["zemin", "orion", "nesne"],
  ogeler: () => [{ yol: ["Sohbet", `Sıkıştır (${SIKISTIR_KOMUTU})`], kimlik: "menu.sohbet.sikistir", sira: 800, grup: "sohbet", uygun: true, eylem: { tur: "soz", metin: SIKISTIR_KOMUTU } }],
};

/** Her hedefin sonunda: "Özellikler…" (bilgi paneli). */
const ozelliklerKatkisi: HedefKatkisi = {
  kimlik: "ozellikler", hedefler: ["zemin", "orion", "nesne", "ajan"],
  ogeler: () => [{ yol: ["Özellikler…"], kimlik: "menu.ozellikler", sira: 900, grup: "son", uygun: true, eylem: { tur: "ozellikler" } }],
};

/** Yalnız nesne: seçimi kaldır. */
const secimiKaldirKatkisi: HedefKatkisi = {
  kimlik: "secimiKaldir", hedefler: ["nesne"],
  ogeler: () => [{ yol: ["Seçimi kaldır"], kimlik: "menu.secimiKaldir", sira: 910, grup: "son", uygun: true, eylem: { tur: "secimiKaldir" } }],
};

/**
 * Hafıza sekmesindeki md dosyası: Düzenle… (çift tıkla da açılır) | Bağlama ekle / Bağlamdan çıkar | İçeriği kopyala, Adı kopyala.
 * Anlık hafıza (sistem dosyası) da bağlamdan çıkarılabilir (Orion davranışı bozulursa emniyet valfi); bunu menü gri yapmaz, yalnız adı söyler.
 */
const dosyaKatkisi: HedefKatkisi = {
  kimlik: "dosya", hedefler: ["dosya"],
  ogeler: (b) => {
    if (b.hedef.tur !== "dosya") return [];
    const d = b.hedef.dosya;
    return [
      { yol: ["Düzenle…"], kimlik: "md.ac", sira: 10, grup: "dosya", uygun: true, eylem: { tur: "mdAc", ad: d.ad } },
      { yol: [d.aktif ? "Bağlamdan çıkar" : "Bağlama ekle"], kimlik: "md.aktif", sira: 20, grup: "baglam", uygun: true, eylem: { tur: "mdAktif", ad: d.ad, aktif: !d.aktif } },
      { yol: ["İçeriği kopyala"], kimlik: "md.kopyala", sira: 30, grup: "kopya", uygun: true, eylem: { tur: "mdKopyala", ad: d.ad } },
      { yol: ["Adı kopyala"], kimlik: "md.adKopyala", sira: 31, grup: "kopya", uygun: true, eylem: { tur: "mdAdKopyala", ad: d.ad } },
    ];
  },
};

/** Menünün bütün katkıları (kayıt sırası önemsiz: sıra/grup öğelerin kendisinde). */
export const MENU_KATKILARI: readonly HedefKatkisi[] = [zeminKatkisi, orionKatkisi, ajanKatkisi, ajanZeminKatkisi, ajanNesneKatkisi, nesneKatkisi, assetKatkisi, duzenlemeKatkisi, sohbetKatkisi, ozelliklerKatkisi, secimiKaldirKatkisi, dosyaKatkisi];
