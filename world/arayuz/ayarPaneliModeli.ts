// world/arayuz/ayarPaneliModeli.ts — AJAN AYAR PANELİ MODELİ (spec 34): bölüm kaydı + panel açık/kapalı + hangi ajanın paneli + bölümlerin açık/kapalı hâli. SAF.
//
// Panel bir ÇERÇEVEDİR (Yapı panellerinin sekme kaydıyla aynı fikir, `uygulama/yapi/ortak/yapiPaneli.ts`): içerik bölümlerden gelir (`uygulama/ayar/*`), yeni özellik = yeni bölüm.
// Çekirdek bölümleri TANIMAZ; yalnız kimlik, ad, sıra ve hangi ajanlara ait olduklarını bilir. Bugün yalnız Orion'un paneli var; Flash (spec 33) ya da sonraki
// ajan aynı kayda kendi bölümünü `ajanlar: ["flash"]` diye ekler — çekirdek değişmez.
//   • Sıra: `sira` küçük önce; eşitse ekleme sırası. Aynı kimlik iki kez eklenemez (HATA: sessizce üstüne yazmak bölümü kaybettirirdi).
//   • Ajan süzgeci: `ajanlar` verilmemişse bölüm her ajanda görünür; verilmişse yalnız listedekilerde. Bölümü olmayan ajanın paneli AÇILMAZ (boş pencere yok).
//   • Akordeon: her bölüm bağımsız açılır/kapanır (birini açmak ötekini kapatmaz: Ozyn sesi ve modeli yan yana görebilsin). İlk hâl `acik` alanından.
//   • Kalıcılık: yalnız bölümlerin açık/kapalı hâli saklanır (panelin kendisi her açılışta KAPALI başlar: seçim olmadan panel yok). Bozuk kayıt HATA (çağıran uyarır).
"use strict";

export interface BolumBilgisi {
  readonly id: string;
  /** Bölüm başlığındaki ad. */
  readonly ad: string;
  /** Adın yanındaki kısa simge. */
  readonly simge: string;
  /** Yukarıdan aşağı sıra (küçük önce). */
  readonly sira: number;
  /** Başlığın üzerine gelince açıklama. */
  readonly ipucu?: string;
  /** Hangi ajanların panelinde görünür (verilmezse hepsinde). */
  readonly ajanlar?: readonly string[];
  /** İlk açılışta (kayıt yokken) bölüm açık mı. Varsayılan kapalı. */
  readonly acik?: boolean;
}

export interface AjanKimligi { readonly id: string; readonly ad: string; readonly renk?: string }
export interface AyarPaneliDurumu { readonly acik: boolean; readonly ajan: AjanKimligi | null }

export interface AyarPaneliModeli {
  ekle(b: BolumBilgisi): void;
  /** Ajanın bölümleri, sıraya göre. */
  bolumler(ajanId: string): readonly BolumBilgisi[];
  durum(): AyarPaneliDurumu;
  /** Ajanın panelini aç. Bölümü yoksa açılmaz (false). */
  ac(ajan: AjanKimligi): boolean;
  kapat(): boolean;
  bolumAcikMi(id: string): boolean;
  /** Bölümü aç/kapat (bilinmeyen kimlik HATA). Değiştiyse true. */
  bolumAyarla(id: string, acik: boolean): boolean;
  bolumDegistir(id: string): boolean;
  dinle(f: () => void): () => void;
  yaz(): string;
  /** Saklanmış hâli oku (bozuksa HATA). Kaldırılmış bölümün kaydı sessizce düşer. */
  yukle(metin: string | null): void;
}

export function ayarPaneliModeliKur(): AyarPaneliModeli {
  const liste: { bilgi: BolumBilgisi; sira: number }[] = [];
  const acikBolumler = new Map<string, boolean>();
  const dinleyiciler = new Set<() => void>();
  let acik = false;
  let ajan: AjanKimligi | null = null;

  const bul = (id: string): BolumBilgisi => {
    const b = liste.find((x) => x.bilgi.id === id);
    if (!b) throw new Error(`ayar paneli: "${id}" adlı bölüm yok`);
    return b.bilgi;
  };
  const yay = () => { for (const f of [...dinleyiciler]) f(); };
  const ajanin = (ajanId: string) => liste
    .filter((x) => !x.bilgi.ajanlar || x.bilgi.ajanlar.includes(ajanId))
    .sort((a, b) => a.bilgi.sira - b.bilgi.sira || a.sira - b.sira)
    .map((x) => x.bilgi);

  const m: AyarPaneliModeli = {
    ekle(b) {
      if (liste.some((x) => x.bilgi.id === b.id)) throw new Error(`ayar paneli: "${b.id}" bölümü zaten ekli`);
      liste.push({ bilgi: b, sira: liste.length });
    },
    bolumler: ajanin,
    durum: () => ({ acik, ajan }),
    ac(a) {
      if (ajanin(a.id).length === 0) return false;
      if (acik && ajan?.id === a.id) return true;
      acik = true; ajan = a; yay();
      return true;
    },
    kapat() {
      if (!acik) return false;
      acik = false; ajan = null; yay();
      return true;
    },
    bolumAcikMi: (id) => acikBolumler.get(id) ?? bul(id).acik ?? false,
    bolumAyarla(id, ac) {
      if (m.bolumAcikMi(id) === ac) return false;
      acikBolumler.set(id, ac); yay();
      return true;
    },
    bolumDegistir: (id) => m.bolumAyarla(id, !m.bolumAcikMi(id)),
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    yaz: () => JSON.stringify({ surum: 1, bolumler: Object.fromEntries(acikBolumler) }),
    yukle(metin) {
      if (!metin) return;
      const v: unknown = JSON.parse(metin);
      if (typeof v !== "object" || v === null) throw new Error("ayar paneli kaydı nesne değil");
      const o = v as Record<string, unknown>;
      if (o["surum"] !== 1) throw new Error(`ayar paneli kaydı sürümü desteklenmiyor: ${String(o["surum"])}`);
      const b = o["bolumler"];
      if (typeof b !== "object" || b === null || Array.isArray(b)) throw new Error("ayar paneli kaydı: bölümler bozuk");
      for (const [id, d] of Object.entries(b as Record<string, unknown>)) {
        if (typeof d !== "boolean") throw new Error(`ayar paneli kaydı: "${id}" açık/kapalı değil`);
        if (liste.some((x) => x.bilgi.id === id)) acikBolumler.set(id, d);
      }
    },
  };
  return m;
}
