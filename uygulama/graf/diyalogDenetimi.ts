// uygulama/graf/diyalogDenetimi.ts — SEÇİMLİ DİYALOG DENETİMCİSİ (spec 35 dilim 2): NPC Ozyn'e sorar, 2–4 seçenek gösterir, Ozyn seçer. SAF: DOM yok.
//
// Oyun NPC'sindeki gibi: "Dur! Parola?" → [1] Ay ışığı [2] Bilmiyorum [3] Sana ne! Grafiğin `diyalog.sec` düğümü bunu açar ve seçimi BEKLER; seçilen
// seçeneğin akış çıkışı yürür. Ekran parçası (`uygulama/diyalogKutusu.ts`) yalnız bunu çizer ve tıklamayı/1–4 tuşunu `sec`e verir.
// Kurallar:
//   • EKRANDA TEK DİYALOG. İkinci istek (başka bir NPC'nin grafiği) nedenle REDDEDİLİR, kuyruğa girmez: Ozyn aynı anda iki soruya cevap veremez ve
//     kuyrukta bekleyen soru, sorulduğu an geçtikten sonra (Ozyn uzaklaşmışken) ekrana gelirdi.
//   • ZAMAN AŞIMI TAVANLI (en çok DIYALOG_SURE_AZAMI_SN): cevap gelmezse diyalog kapanır ve sonuç `zamanAsimi` (grafikte ayrı akış çıkışı) — sonsuza dek
//     açık kalan bir soru grafiği (ve "aynı grafik tek çalışma" kuralıyla bütün dinlemeyi) asardı.
//   • ■ / bırakma `kapat()`: diyalog HEMEN ekrandan kalkar (sonuç `kapandi`). Kapatılmış ya da süresi dolmuş diyaloğa geç gelen seçim yok sayılır.
//   • Seçim yalnız Ozyn'in eli: ekran parçası `isTrusted` olmayan tıklamayı/tuşu `sec`e vermez (betik bir NPC'nin sorusunu Ozyn adına cevaplamasın).
"use strict";

export const DIYALOG_SECENEK_ENAZ = 2;
export const DIYALOG_SECENEK_AZAMI = 4;
/** Sorunun uzunluğu: altyazı kutusu ~62 karakter genişliğinde; 300 beş satırı geçmez. */
export const DIYALOG_METIN_AZAMI = 300;
/** Bir seçeneğin uzunluğu (düğme tek satır kalsın). */
export const DIYALOG_SECENEK_METIN_AZAMI = 80;
export const DIYALOG_SURE_ENAZ_SN = 3;
/** Cevap bekleme tavanı. 60 sn: oyun NPC'sinde soru bundan uzun beklemez; grafiğin 120 sn'lik toplam tavanının yarısı. Ölçülmedi. */
export const DIYALOG_SURE_AZAMI_SN = 60;
export const DIYALOG_SURE_VARSAYILAN_SN = 30;

export interface DiyalogIstegi {
  ajan: { id: string; ad: string };
  /** Başlık rengi (#rrggbb; ajan defterinden). Verilmezse ekran varsayılanı. */
  renk?: string;
  metin: string;
  secenekler: readonly string[];
  sureMs: number;
}

export type DiyalogSonucu = { tur: "secildi"; indeks: number } | { tur: "zamanAsimi" } | { tur: "kapandi" };

export interface DiyalogIsi {
  readonly sonuc: Promise<DiyalogSonucu>;
  /** ■ / bırak: diyaloğu ekrandan kaldırır (zaten kapandıysa hiçbir şey yapmaz). */
  kapat(): void;
}

/** Ekranın çizdiği hâl. `bitis`: zaman aşımının anı (`simdi` ekseni; geri sayım). */
export interface DiyalogGorunumu {
  readonly kimlik: number;
  readonly ajan: { id: string; ad: string };
  readonly renk: string | null;
  readonly metin: string;
  readonly secenekler: readonly string[];
  readonly bitis: number;
}

export interface DiyalogDenetimi {
  /** Diyaloğu açar. Ekranda başka diyalog varsa ya da istek bozuksa FIRLATIR (nedenle; düğüm hatası olur). */
  ac(i: DiyalogIstegi): DiyalogIsi;
  /** Ozyn'in seçimi (0'dan; ekran parçası çağırır, yalnız gerçek tık/tuşta). Açık diyalog yoksa ya da indeks dışıysa false. */
  sec(indeks: number): boolean;
  acik(): DiyalogGorunumu | null;
  dinle(f: (g: DiyalogGorunumu | null) => void): () => void;
}

/** İsteğin biçim hatası; yoksa null. Düğüm denetimde de aynı kuralı kullanır (seçenek yok/boş/uzun/boşluklu). */
export function diyalogHatasi(metin: unknown, secenekler: readonly unknown[], sureMs: unknown): string | null {
  if (typeof metin !== "string" || !metin.trim()) return "diyalog metni boş olamaz (ayar.metin ya da bağ)";
  if (metin.length > DIYALOG_METIN_AZAMI) return `diyalog metni en çok ${DIYALOG_METIN_AZAMI} karakter (gelen: ${metin.length})`;
  if (secenekler.length < DIYALOG_SECENEK_ENAZ || secenekler.length > DIYALOG_SECENEK_AZAMI) return `diyalogda ${DIYALOG_SECENEK_ENAZ}–${DIYALOG_SECENEK_AZAMI} seçenek olmalı (${secenekler.length} var)`;
  for (const [i, s] of secenekler.entries()) {
    if (typeof s !== "string" || !s.trim()) return `seçenek ${i + 1} boş`;
    if (s.length > DIYALOG_SECENEK_METIN_AZAMI) return `seçenek ${i + 1} en çok ${DIYALOG_SECENEK_METIN_AZAMI} karakter (gelen: ${s.length})`;
  }
  if (typeof sureMs !== "number" || !Number.isFinite(sureMs) || sureMs < DIYALOG_SURE_ENAZ_SN * 1000 || sureMs > DIYALOG_SURE_AZAMI_SN * 1000) {
    return `diyalog süresi ${DIYALOG_SURE_ENAZ_SN}–${DIYALOG_SURE_AZAMI_SN} sn olmalı (gelen: ${String(sureMs)} ms)`;
  }
  return null;
}

export interface DiyalogDenetimiAyari {
  simdi?: () => number;
  /** Zamanlayıcı (testte sahte): `f`'yi `ms` sonra çağırır, iptal fonksiyonu döner. */
  zamanla?: (f: () => void, ms: number) => () => void;
}

export function diyalogDenetimiKur(a: DiyalogDenetimiAyari = {}): DiyalogDenetimi {
  const simdi = a.simdi ?? (() => Date.now());
  const zamanla = a.zamanla ?? ((f: () => void, ms: number) => { const t = setTimeout(f, ms); return () => clearTimeout(t); });
  const dinleyiciler = new Set<(g: DiyalogGorunumu | null) => void>();
  let sayac = 0;
  let suan: { gorunum: DiyalogGorunumu; bitir: (s: DiyalogSonucu) => void } | null = null;

  const yay = (): void => {
    const g = suan?.gorunum ?? null;
    for (const f of [...dinleyiciler]) {
      try { f(g); } catch (err) { console.error("[diyalog] dinleyici hatası:", err); }
    }
  };

  return {
    ac(i) {
      const h = diyalogHatasi(i.metin, i.secenekler, i.sureMs);
      if (h) throw new Error(h);
      if (suan) throw new Error(`ekranda başka bir diyalog açık (${suan.gorunum.ajan.ad}: "${suan.gorunum.metin.slice(0, 40)}"): aynı anda tek soru`);
      const kimlik = ++sayac;
      const gorunum: DiyalogGorunumu = { kimlik, ajan: { ...i.ajan }, renk: i.renk ?? null, metin: i.metin, secenekler: [...i.secenekler], bitis: simdi() + i.sureMs };
      let coz: (s: DiyalogSonucu) => void = () => {};
      const sonuc = new Promise<DiyalogSonucu>((r) => { coz = r; });
      let iptalSaat: () => void = () => {};
      // Tek çıkış kapısı: hangi yoldan biterse bitsin (seçim, süre, kapat) ekrandan kalkar, saat iptal edilir, söz bir kez çözülür.
      const bitir = (s: DiyalogSonucu): void => {
        if (suan?.gorunum.kimlik !== kimlik) return;
        suan = null;
        iptalSaat();
        coz(s);
        yay();
      };
      suan = { gorunum, bitir };
      iptalSaat = zamanla(() => bitir({ tur: "zamanAsimi" }), i.sureMs);
      yay();
      return { sonuc, kapat: () => bitir({ tur: "kapandi" }) };
    },
    sec(indeks) {
      if (!suan || !Number.isInteger(indeks) || indeks < 0 || indeks >= suan.gorunum.secenekler.length) return false;
      suan.bitir({ tur: "secildi", indeks });
      return true;
    },
    acik: () => suan?.gorunum ?? null,
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
  };
}
