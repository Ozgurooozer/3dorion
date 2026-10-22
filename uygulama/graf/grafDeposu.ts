// uygulama/graf/grafDeposu.ts — DÜĞÜM GRAFİKLERİ DEPOSU (spec 35 dilim 1): grafikler (`olay`) ve desenler (`fonksiyon`) kalıcı dosya olarak.
//
// Kaynak ortak çekirdekten (`uygulama/dosyaDeposu.ts`): Electron'da host dosyaları (`<userData>/orion-graf/<ad>.json`, host/grafDosyalari.js), `npm run dev`'de
// localStorage. md deposunun kopyası değil; ortak olan (kaynaklar, sıra) orada, burada grafiğe özgü olan:
//   • YAZMADAN ÖNCE `grafDogrula` (biçim): bozuk JSON ya da biçim hatası diske GİTMEZ, hata metni düzenleyicide görünür. Tür denetimi ("Kontrol et") yazmayı
//     ENGELLEMEZ: yarım bir programı kaydedebilmek gerekir; çalıştırmayı yorumlayıcının kendi denetimi engeller.
//   • Dosyanın adı grafın ADIDIR (`desen.cagir` desenleri adla bulur): içerikteki `ad` dosya adından farklıysa kaydedilmez (başka adla kayıt = ＋ Yeni).
//   • Kanonik metin: kaydedilen metin temiz kopyanın (bilinmeyen alanlar atılmış) okunur biçimidir; düğüm ve bağ başına bir satır.
//   • Bellek önbelleği: yorumlayıcı desenleri SENKRON ister (`PinOrtami.desen`); başlangıçta hepsi okunur, her yazımdan sonra o dosya tazelenir.
//     Bozuk dosya listeden DÜŞMEZ: hatasıyla görünür (sessiz kayıp yok), ama çalıştırılamaz/çağrılamaz.
"use strict";
import { grafAdiGecerli, grafDogrula, type Graf } from "../../protocol/graf.ts";
import type { Sonuc } from "../../protocol/dogrula.ts";
import { kabukKoprusu } from "../kabuk.ts";
import { DESEN_CAGIR_TIPI } from "./grafTurDenetimi.ts";
import {
  DosyaHatasi, calismayanDosyaKaynagi, ipcDosyaKaynagi, isSirasi, tarayiciDeposu, yerelDosyaKaynagi,
  type Depo, type DosyaBilgisi, type DosyaIpcYuzu, type DosyaKaynagi,
} from "../dosyaDeposu.ts";

export const YEREL_GRAF_ANAHTARI = "orion.graf.v1";

const grafHatasi = (kod: string, mesaj: string): Error => new DosyaHatasi(kod, mesaj);

/** Grafiğin okunur, kanonik JSON metni: üst alanlar ayrı satırda, her düğüm ve her bağ tek satırda (düzenleyicide satır satır okunur). */
export function grafMetni(g: Graf): string {
  const s = (v: unknown) => JSON.stringify(v);
  const liste = (l: readonly unknown[]) => (l.length ? `[\n${l.map((x) => `    ${s(x)}`).join(",\n")}\n  ]` : "[]");
  const satirlar = [
    `  "surum": ${s(g.surum)}`, `  "ad": ${s(g.ad)}`, `  "tur": ${s(g.tur)}`,
    ...(g.aciklama !== undefined ? [`  "aciklama": ${s(g.aciklama)}`] : []),
    `  "girisler": ${s(g.girisler)}`, `  "cikislar": ${s(g.cikislar)}`,
    `  "dugumler": ${liste(g.dugumler)}`, `  "baglar": ${liste(g.baglar)}`,
  ];
  return `{\n${satirlar.join(",\n")}\n}\n`;
}

/** Metni grafiğe çevirir: JSON hatası ve biçim hatası NEDENLE (düzenleyici bunu "KAYDEDİLEMEDİ: …" diye gösterir). */
export function grafMetniCoz(metin: string): Sonuc<Graf> {
  let ham: unknown;
  try { ham = JSON.parse(metin); }
  catch (err) { return { ok: false, hata: `JSON okunamadı: ${err instanceof Error ? err.message : String(err)}` }; }
  const r = grafDogrula(ham);
  return r.ok ? r : { ok: false, hata: `biçim: ${r.hata}` };
}

export interface GrafKaydi {
  ad: string;
  /** Okunabildiyse türü; bozuksa null. */
  tur: Graf["tur"] | null;
  /** Dosya okunamadı ya da biçimi bozuk: nedeni. */
  hata: string | null;
  aciklama: string | null;
  boyut: number;
  degisti: number;
}

export type GrafOlayi = { tur: "liste" } | { tur: "icerik"; ad: string };

export interface GrafDeposu {
  /** Listeyi ve bütün grafikleri yükler. Liste alınamazsa fırlatır (çağıran altyazıyla söyler). */
  baslat(): Promise<void>;
  liste(): readonly GrafKaydi[];
  /** Geçerli grafik (bozuksa ya da yoksa null). */
  al(ad: string): Graf | null;
  /** Geçerli DESEN (fonksiyon grafiği); başka türse null. */
  desen(ad: string): Graf | null;
  /** Diskten taze metin (düzenleyici). */
  oku(ad: string): Promise<string>;
  /** Doğrulayıp kaydeder; diske yazılan kanonik metni döner. Biçim hatası, ad uyuşmazlığı fırlatır (diske gitmez). */
  yaz(ad: string, metin: string): Promise<string>;
  /** Yeni grafik (adı grafın adı; varsa hata). */
  yeni(g: Graf): Promise<void>;
  /** Grafiği/deseni KALDIRIR (host'ta `.silinenler/`e taşınır, kalıcı silme değil). Kaynak silmeyi bilmiyorsa nedenli hata. */
  sil(ad: string): Promise<void>;
  /** Bu deseni `Desen` düğümüyle çağıran grafikler/desenler (silmeden önce uyarı). Bozuk dosyalar bakılamaz, sayılmaz. */
  desenKullananlar(ad: string): string[];
  /**
   * YENİDEN ADLANDIR (dilim 2b): yeni adla YENİ dosya + eskisini KALDIR (`.silinenler/`e taşınır; kalıcı silme yok, host'a yeni işlem gerekmedi).
   * Başka grafiklerin çağırdığı DESEN yeniden adlandırılmaz (nedenle reddedilir): `desen.cagir` adla bulur, çağıranlar sessizce kırılırdı — onları
   * kendiliğinden güncellemek başka dosyalara Ozyn'in görmediği yazım olurdu. Bozuk dosya, var olan ad ve kaldırmayı bilmeyen kaynak da reddedilir.
   */
  yenidenAdlandir(eski: string, yeni: string): Promise<void>;
  /** KOPYASINI OLUŞTUR: aynı içerik yeni adla (varsa hata). Bozuk dosyanın kopyası alınmaz. */
  kopyasiniOlustur(ad: string, yeni: string): Promise<void>;
  dinle(f: (o: GrafOlayi) => void): () => void;
  /** Testler: bekleyen yazma işleri bitene dek. */
  bitti(): Promise<void>;
}

export function grafDeposuKur(kaynak: DosyaKaynagi): GrafDeposu {
  let liste: GrafKaydi[] = [];
  const grafikler = new Map<string, Graf>();
  const dinleyiciler = new Set<(o: GrafOlayi) => void>();
  const sira = isSirasi();
  const yay = (o: GrafOlayi) => { for (const f of [...dinleyiciler]) { try { f(o); } catch (err) { console.error("[graf] depo dinleyicisi hatası:", err); } } };

  /** Bir dosyayı oku ve önbelleğe al; kaydı döner (hatalıysa nedeniyle). */
  async function yukle(d: DosyaBilgisi): Promise<GrafKaydi> {
    const temel = { ad: d.ad, boyut: d.boyut, degisti: d.degisti };
    let metin: string;
    try { metin = await kaynak.oku(d.ad); }
    catch (err) { grafikler.delete(d.ad); return { ...temel, tur: null, aciklama: null, hata: `okunamadı: ${err instanceof Error ? err.message : String(err)}` }; }
    const r = grafMetniCoz(metin);
    if (!r.ok) { grafikler.delete(d.ad); return { ...temel, tur: null, aciklama: null, hata: r.hata }; }
    if (r.deger.ad !== d.ad) { grafikler.delete(d.ad); return { ...temel, tur: r.deger.tur, aciklama: r.deger.aciklama ?? null, hata: `içerikteki ad '${r.deger.ad}' dosya adıyla aynı değil` }; }
    grafikler.set(d.ad, r.deger);
    return { ...temel, tur: r.deger.tur, aciklama: r.deger.aciklama ?? null, hata: null };
  }

  async function tazele(): Promise<void> {
    const dosyalar = await kaynak.liste();
    const kayitlar = await Promise.all(dosyalar.map(yukle));
    const adlar = new Set(dosyalar.map((d) => d.ad));
    for (const ad of [...grafikler.keys()]) if (!adlar.has(ad)) grafikler.delete(ad);
    liste = kayitlar.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
    yay({ tur: "liste" });
  }

  /** Yeniden adlandırma/kopyanın ortak ön koşulları: kaynak geçerli ve yüklü, yeni ad geçerli ve boş. Yeni adlı grafiği döner (içerik aynı). */
  function yeniAdliKopya(ad: string, yeni: string): Graf {
    if (!grafAdiGecerli(yeni)) throw new DosyaHatasi("gecersiz-ad", `geçersiz grafik adı: ${JSON.stringify(yeni)} (harf, rakam, _ ve -; boşluk yok)`);
    if (liste.some((k) => k.ad === yeni)) throw new DosyaHatasi("var", `'${yeni}' adı zaten var`);
    const g = grafikler.get(ad);
    if (!g) throw new DosyaHatasi(liste.some((k) => k.ad === ad) ? "gecersiz-icerik" : "yok", liste.some((k) => k.ad === ad) ? `'${ad}' bozuk: önce düzelt (Metin)` : `'${ad}' yok`);
    return { ...structuredClone(g), ad: yeni };
  }

  const desenKullananlar = (ad: string): string[] => [...grafikler.values()]
    .filter((g) => g.ad !== ad && g.dugumler.some((d) => d.tip === DESEN_CAGIR_TIPI && d.ayar?.["desen"] === ad)).map((g) => g.ad).sort();

  function dogrula(ad: string, metin: string): Graf {
    if (!grafAdiGecerli(ad)) throw new DosyaHatasi("gecersiz-ad", `geçersiz grafik adı: ${JSON.stringify(ad)}`);
    const r = grafMetniCoz(metin);
    if (!r.ok) throw new DosyaHatasi("gecersiz-icerik", r.hata);
    if (r.deger.ad !== ad) throw new DosyaHatasi("gecersiz-icerik", `grafın adı ('${r.deger.ad}') dosyanın adıyla ('${ad}') aynı olmalı: başka adla kaydetmek için ＋ Yeni`);
    return r.deger;
  }

  return {
    baslat: () => sira.sirala(tazele),
    liste: () => liste,
    al: (ad) => grafikler.get(ad) ?? null,
    desen: (ad) => { const g = grafikler.get(ad); return g && g.tur === "fonksiyon" ? g : null; },
    oku: (ad) => kaynak.oku(ad),
    yaz: (ad, metin) => sira.sirala(async () => {
      const g = dogrula(ad, metin);
      const yazilan = grafMetni(g);
      await kaynak.yaz(ad, yazilan);
      await tazele();
      yay({ tur: "icerik", ad });
      return yazilan;
    }),
    yeni: (g) => sira.sirala(async () => {
      const yazilan = grafMetni(dogrula(g.ad, JSON.stringify(g)));
      await kaynak.yeni(g.ad, yazilan);
      await tazele();
    }),
    sil: (ad) => sira.sirala(async () => {
      if (!grafAdiGecerli(ad)) throw new DosyaHatasi("gecersiz-ad", `geçersiz grafik adı: ${JSON.stringify(ad)}`);
      if (!kaynak.sil) throw new DosyaHatasi("hata", "bu kaynakta silme yok");
      await kaynak.sil(ad);
      grafikler.delete(ad);
      await tazele();
    }),
    desenKullananlar,
    yenidenAdlandir: (eski, yeni) => sira.sirala(async () => {
      if (eski === yeni) return;
      const g = yeniAdliKopya(eski, yeni);
      if (!kaynak.sil) throw new DosyaHatasi("hata", "bu kaynakta kaldırma yok: yeniden adlandırılamaz (Kopyasını oluştur kullan)");
      const kullanan = g.tur === "fonksiyon" ? desenKullananlar(eski) : [];
      if (kullanan.length) throw new DosyaHatasi("hata", `'${eski}' deseni şunlarda kullanılıyor: ${kullanan.join(", ")} — adı değişirse onlar kırılır; önce onlardaki Desen düğümünü değiştir ya da Kopyasını oluştur`);
      await kaynak.yeni(yeni, grafMetni(dogrula(yeni, JSON.stringify(g))));
      try { await kaynak.sil(eski); }
      catch (err) {
        await tazele();
        throw new DosyaHatasi("hata", `'${yeni}' yazıldı ama '${eski}' kaldırılamadı (ikisi de duruyor): ${err instanceof Error ? err.message : String(err)}`);
      }
      grafikler.delete(eski);
      await tazele();
    }),
    kopyasiniOlustur: (ad, yeni) => sira.sirala(async () => {
      const g = yeniAdliKopya(ad, yeni);
      await kaynak.yeni(yeni, grafMetni(dogrula(yeni, JSON.stringify(g))));
      await tazele();
    }),
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    bitti: () => sira.bitti(),
  };
}

/** localStorage kaynağı (Electron'suz geliştirme): ortak yerel kaynak, ek alan yok. Ad kuralı protokolün. */
export function yerelGrafKaynagi(depo: Depo, simdi: () => number = Date.now): DosyaKaynagi {
  return yerelDosyaKaynagi<Record<never, never>>(depo, {
    anahtar: YEREL_GRAF_ANAHTARI, adGecerli: grafAdiGecerli, hata: grafHatasi, etiket: "grafik", adEtiketi: "grafik adı",
    yeniEk: () => ({}), ekAl: () => ({}),
  }, simdi);
}

/** Çalışma ortamına göre kaynak: Electron'da host dosyaları (IPC), değilse localStorage; ikisi de yoksa nedenli çalışmayan kaynak. */
export function grafKaynaginiSec(): { kaynak: DosyaKaynagi; hata: string | null } {
  const k = kabukKoprusu();
  const liste = k?.grafListe, oku = k?.grafOku, yaz = k?.grafYaz, yeni = k?.grafYeni, sil = k?.grafSil;   // preload işlevleri ok işlevi: `this` gerekmez
  if (liste && oku && yaz && yeni) {
    const y: DosyaIpcYuzu<DosyaBilgisi> = { liste: () => liste(), oku: (ad) => oku(ad), yaz: (ad, m) => yaz(ad, m), yeni: (ad, m) => yeni(ad, m), ...(sil ? { sil: (ad) => sil(ad) } : {}) };
    return { kaynak: ipcDosyaKaynagi(y, grafHatasi), hata: null };
  }
  const depo = tarayiciDeposu();
  if (!depo) { const neden = "grafikler için ne kabuk ne localStorage var"; return { kaynak: calismayanDosyaKaynagi(neden, grafHatasi), hata: neden }; }
  console.warn("[GRAF] kabuk yok (npm run dev): grafikler tarayıcı deposunda tutulur");
  return { kaynak: yerelGrafKaynagi(depo), hata: null };
}
