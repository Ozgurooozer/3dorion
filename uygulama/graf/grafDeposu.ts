// uygulama/graf/grafDeposu.ts — DÜĞÜM GRAFİKLERİ DEPOSU (spec 35 dilim 1): grafikler (`olay`) ve desenler (`fonksiyon`) kalıcı dosya olarak.
//
// Kaynak ortak çekirdekten (`uygulama/dosyaDeposu.ts`): Electron'da host dosyaları (`<userData>/orion-graf/<ad>.json`, host/grafDosyalari.js), `npm run dev`'de
// localStorage. md deposunun kopyası değil; ortak olan (kaynaklar, sıra) orada; aşağıdaki ilk dört kural NPC kayıtlarıyla ORTAK çekirdekte
// (`uygulama/dogruDosyaDeposu.ts`, dilim 3), burada grafiğe özgü olan desen kuralları, yeniden adlandırma ve kopya:
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
import { DosyaHatasi, kaynakSec, yerelDosyaKaynagi, type Depo, type DosyaKaynagi } from "../dosyaDeposu.ts";
import { dogruDepoKur, type DepoOlayi, type DogruKayit } from "../dogruDosyaDeposu.ts";

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

/** Listedeki grafik: okunabildiyse türü ve açıklaması; bozuksa ikisi null ve `hata` nedeni (dosya okunamadı ya da biçimi bozuk). */
export type GrafKaydi = DogruKayit<{ tur: Graf["tur"] | null; aciklama: string | null }>;

export type GrafOlayi = DepoOlayi;

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
  // Ortak kurallar (doğrula → kanonik yaz, ad = dosya adı, bozuk dosya listede nedeniyle, önbellek, iş sırası) çekirdekte (dilim 3'te NPC deposuyla
  // ortaklaştırıldı); burada grafiğe özgü olan: desen kuralları, yeniden adlandırma, kopya.
  const d = dogruDepoKur<Graf, { tur: Graf["tur"] | null; aciklama: string | null }>({
    kaynak, coz: grafMetniCoz, adi: (g) => g.ad, metin: grafMetni, ek: (g) => ({ tur: g?.tur ?? null, aciklama: g?.aciklama ?? null }),
    adGecerli: grafAdiGecerli, etiket: "grafik", adinSozu: "grafın adı", gunluk: "[graf]",
  });

  /** Yeniden adlandırma/kopyanın ortak ön koşulları: kaynak geçerli ve yüklü, yeni ad geçerli ve boş. Yeni adlı grafiği döner (içerik aynı). */
  function yeniAdliKopya(ad: string, yeni: string): Graf {
    if (!grafAdiGecerli(yeni)) throw new DosyaHatasi("gecersiz-ad", `geçersiz grafik adı: ${JSON.stringify(yeni)} (harf, rakam, _ ve -; boşluk yok)`);
    const liste = d.liste();
    if (liste.some((k) => k.ad === yeni)) throw new DosyaHatasi("var", `'${yeni}' adı zaten var`);
    const g = d.al(ad);
    if (!g) throw new DosyaHatasi(liste.some((k) => k.ad === ad) ? "gecersiz-icerik" : "yok", liste.some((k) => k.ad === ad) ? `'${ad}' bozuk: önce düzelt (Metin)` : `'${ad}' yok`);
    return { ...structuredClone(g), ad: yeni };
  }

  const desenKullananlar = (ad: string): string[] => d.gecerliler()
    .filter((g) => g.ad !== ad && g.dugumler.some((x) => x.tip === DESEN_CAGIR_TIPI && x.ayar?.["desen"] === ad)).map((g) => g.ad).sort();

  return {
    baslat: d.baslat,
    liste: d.liste,
    al: d.al,
    desen: (ad) => { const g = d.al(ad); return g && g.tur === "fonksiyon" ? g : null; },
    oku: d.oku,
    yaz: d.yaz,
    yeni: d.yeni,
    sil: d.sil,
    desenKullananlar,
    yenidenAdlandir: (eski, yeni) => d.ic.sirala(async () => {
      if (eski === yeni) return;
      const g = yeniAdliKopya(eski, yeni);
      if (!kaynak.sil) throw new DosyaHatasi("hata", "bu kaynakta kaldırma yok: yeniden adlandırılamaz (Kopyasını oluştur kullan)");
      const kullanan = g.tur === "fonksiyon" ? desenKullananlar(eski) : [];
      if (kullanan.length) throw new DosyaHatasi("hata", `'${eski}' deseni şunlarda kullanılıyor: ${kullanan.join(", ")} — adı değişirse onlar kırılır; önce onlardaki Desen düğümünü değiştir ya da Kopyasını oluştur`);
      await kaynak.yeni(yeni, grafMetni(d.ic.dogrula(yeni, JSON.stringify(g))));
      try { await kaynak.sil(eski); }
      catch (err) {
        await d.ic.tazele();
        throw new DosyaHatasi("hata", `'${yeni}' yazıldı ama '${eski}' kaldırılamadı (ikisi de duruyor): ${err instanceof Error ? err.message : String(err)}`);
      }
      d.ic.unut(eski);
      await d.ic.tazele();
    }),
    kopyasiniOlustur: (ad, yeni) => d.ic.sirala(async () => {
      const g = yeniAdliKopya(ad, yeni);
      await kaynak.yeni(yeni, grafMetni(d.ic.dogrula(yeni, JSON.stringify(g))));
      await d.ic.tazele();
    }),
    dinle: d.dinle,
    bitti: d.bitti,
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
  // Seçim kuralı NPC kayıtlarıyla ortak (`kaynakSec`, dilim 3): kopya yok.
  return kaynakSec(k ? { liste: k.grafListe, oku: k.grafOku, yaz: k.grafYaz, yeni: k.grafYeni, sil: k.grafSil } : undefined, (d) => yerelGrafKaynagi(d), grafHatasi,
    { ne: "grafikler", onek: "[GRAF]" });
}
