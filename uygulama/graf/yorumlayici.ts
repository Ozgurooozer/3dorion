// uygulama/graf/yorumlayici.ts — GRAFİK YORUMLAYICISI (spec 35): bir olay grafiğini "▶ Başla"dan yürütür. SAF: DOM ve Babylon yok; dünya yalnız düğümlerin
// `yetenek`i üzerinden (kompozisyon kökü verir).
//
// Anlam (UE5 Blueprint ile aynı):
//   • AKIŞ: bir düğüm bitince seçtiği akış çıkışının bağlı olduğu düğüm yürür; bağ yoksa o dal biter. `dallar` sırayla tamamen yürür, sonra `sonra`.
//   • VERİ: bir giriş, bağlıysa kaynaktan okunur — SAF düğüm (akışsız) her istekte YENİDEN hesaplanır, akışlı düğümün çıkışı onun son
//     çalışmasından okunur (henüz çalışmadıysa HATA, sessiz `undefined` değil); bağsızsa düğüm ayarından (aynı ad).
//   • DESEN: `desen.cagir` yeni bir çerçevede fonksiyon grafiğini girdilerle yürütür; "Fonksiyon dönüşü" çıktıları verir ve çerçeveyi bitirir.
// Güvence: çalışmadan ÖNCE tür denetimi (hata varsa hiç başlamaz); adım, süre ve desen derinliği tavanlı; ■ `durdur()` her adımda ve her beklemede
// bakılır. Her düğüm başlarken `olay` yayılır (editördeki aktif düğüm vurgusu, günlük).
// Dilim 1: dünya işi (ajanın yürüyüşü) bir SÖZDÜR, süre değil: düğüm onu `bekleVeyaDur` ile bekler, ■ beklemeyi hemen keser ve `durdurulunca`
// kancaları dünyadaki işi de durdurur (bedene `dur`). Hata, oluştuğu grafikle (desen içindeyse desenin adı) döner.
// Dilim 2: çalışma bir DÜNYA OLAYI düğümünden de başlayabilir (`giris`: dinlemedeki grafik; kim kurdu, ne zaman: grafDinleyici.ts); düğümler grafiğin
// bellekteki değişken alanını (`degiskenler`) ve yerel saati görür.
// Dilim 3 (NPC sınıfı): çalışmanın NPC'si (`ben`: `@ben`in ajanı + parametreler) ve ajanların değişken alanları (`ajanDegiskenleri`) BAĞLAMDADIR;
// grafik metni değiştirilmez (aynı dondurulmuş kopya iki NPC'de çalışır).
"use strict";
import type { Graf, PinUcu } from "../../protocol/graf.ts";
import type { CalismaTetigi, DegiskenAlani, DugumCalismasi, DugumKaydi, DugumSonucu, NpcBaglami, PinOrtami } from "./dugumKaydi.ts";
import { FONKSIYON_DONUS_TIPI, FONKSIYON_GIRIS_TIPI, BASLA_TIPI, dugumleriCoz, grafTurDenetle, type CozulmusDugum } from "./grafTurDenetimi.ts";

export interface CalismaSinirlari {
  /** Toplam düğüm yürütme sayısı (saf düğüm hesapları dahil). */
  adim: number;
  /** Toplam süre (ms). */
  sureMs: number;
  /** İç içe desen çağrısı derinliği. */
  derinlik: number;
}
export const CALISMA_SINIRLARI: Readonly<CalismaSinirlari> = { adim: 1000, sureMs: 120_000, derinlik: 5 };

export type CalismaOlayi =
  | { tur: "dugum"; graf: string; id: string; derinlik: number }
  | { tur: "bitti"; adim: number }
  | { tur: "durdu"; adim: number }
  /** `graf`: hatanın OLDUĞU grafik (desenin içindeyse desenin adı; dilim 1: editör hatalı düğümü doğru grafikte göstersin). */
  | { tur: "hata"; graf: string; id: string | null; mesaj: string };

export interface CalismaAyari<Y> {
  kayit: DugumKaydi<Y>;
  /** Kaydedilmiş desenler (fonksiyon grafikleri). */
  desen(ad: string): Graf | null;
  /** Ajan defterinin kimlikleri (tür denetiminde "Ajan seç" seçenekleri). Verilmezse boş: ajan seçen grafik çalışmaz (bkz. `PinOrtami.ajanlar`). */
  ajanlar?: () => readonly string[];
  yetenek: Y;
  simdi?: () => number;
  /** Bekleme (testte sahte saat). */
  uyu?: (ms: number) => Promise<void>;
  sinir?: Partial<CalismaSinirlari>;
  olay?: (o: CalismaOlayi) => void;
  /**
   * Çalışmanın GİRİŞİ (dilim 2): verilirse çalışma "▶ Başla"dan değil bu DÜNYA OLAYI düğümünden başlar, olayın verisiyle (dinlemedeki grafik).
   * Düğüm bir dünya olayı düğümü olmalı; değilse çalışma hiç başlamaz.
   */
  giris?: { dugum: string; veri?: Readonly<Record<string, unknown>> };
  /** Grafiğin değişken alanı (bellekte, grafik başına). Verilmezse değişken düğümleri nedenle düşer. */
  degiskenler?: DegiskenAlani;
  /** Ajanların değişken alanları (dilim 3, `kapsam: "ajan"`). Verilmezse ajan kapsamlı değişken düğümleri nedenle düşer. */
  ajanDegiskenleri?: (ajan: string) => DegiskenAlani;
  /**
   * Bu çalışmanın NPC'si (dilim 3, `@ben`): dinleyici NPC'nin kaydından verir. Verilmezse NULL sayılır — çalışma anında "Kontrol et"in serbestliği YOK:
   * `@ben`li grafik ▶ ile ya da NPC'siz başlarsa kök çerçevenin denetimi nedenle düşer.
   */
  ben?: NpcBaglami | null;
  /** Yerel saat (0–24); varsayılan bilgisayarın saati. */
  saat?: () => number;
}

export interface CalismaSonucu {
  durum: "bitti" | "durdu" | "hata";
  adim: number;
  hata?: string;
  /** Hatanın düğümü (editör onu kırmızı gösterir). */
  hataDugumu?: string;
  /** Hatalı düğümün grafiği (desenin içindeyse desen; değilse çalışan grafik). */
  hataGrafi?: string;
}

export interface Calisma {
  readonly sonuc: Promise<CalismaSonucu>;
  /** ■ Durdur: süren bekleme hemen kesilir, sıradaki düğüm yürümez. */
  durdur(): void;
}

class Durduruldu extends Error {}
class DugumHatasi extends Error {
  readonly dugum: string | null;
  readonly graf: string | null;
  constructor(dugum: string | null, mesaj: string, graf: string | null = null) { super(mesaj); this.dugum = dugum; this.graf = graf; }
}

interface Cerceve {
  graf: Graf;
  cozum: Map<string, CozulmusDugum>;
  derinlik: number;
  /** Akışlı düğümlerin son çıktıları. */
  ciktilar: Map<string, Record<string, unknown>>;
  /** Fonksiyon girişinin değerleri. */
  girdiler: Readonly<Record<string, unknown>>;
  donus: Record<string, unknown> | null;
  akisHedefi: Map<string, string>;
  veriKaynagi: Map<string, PinUcu>;
}

const anahtar = (id: string, pin: string) => `${id}\u0000${pin}`;

export function grafCalistir<Y>(g: Graf, a: CalismaAyari<Y>): Calisma {
  const sinir: CalismaSinirlari = { ...CALISMA_SINIRLARI, ...a.sinir };
  const simdi = a.simdi ?? (() => Date.now());
  const uyu = a.uyu ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const baslangic = simdi();
  let adim = 0;
  let durdu = false;
  let bitti = false;
  let durmaCoz: () => void = () => {};
  const durma = new Promise<void>((r) => { durmaCoz = r; });
  /** ■ kancaları (`durdurulunca`): dünyadaki süren işi kesenler. Çalışma bitince temizlenir (geç ■ eski bir işi kesmesin). */
  const durunca = new Set<() => void>();

  const ben = a.ben ?? null;
  const ajanlar = (): readonly string[] => a.ajanlar?.() ?? [];
  // `ben` her zaman TANIMLI (NPC ya da null): çalışma anı denetimi Kontrol et'in "@ben serbest" hâline düşmesin.
  const ortam: PinOrtami = { desen: (ad: string) => a.desen(ad), buGraf: null, ajanlar, ben };
  const saat = a.saat ?? (() => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; });
  const tetik: CalismaTetigi | null = a.giris ? { dugum: a.giris.dugum, veri: a.giris.veri ?? {} } : null;

  function cerceveKur(graf: Graf, derinlik: number, girdiler: Readonly<Record<string, unknown>>): Cerceve {
    const hatalar = grafTurDenetle(graf, a.kayit, ortam);
    if (hatalar.length) throw new DugumHatasi(null, `'${graf.ad}' çalıştırılamaz: ${hatalar.join("; ")}`, graf.ad);
    const { cozum } = dugumleriCoz(graf, a.kayit, ortam);
    const akisHedefi = new Map<string, string>(), veriKaynagi = new Map<string, PinUcu>();
    for (const b of graf.baglar) {
      const k = cozum.get(b.kaynak[0])!;
      const tip = k.pinler.cikislar.find((p) => p.ad === b.kaynak[1])!.tip;
      if (tip === "akis") akisHedefi.set(anahtar(...b.kaynak), b.hedef[0]);
      else veriKaynagi.set(anahtar(...b.hedef), b.kaynak);
    }
    return { graf, cozum, derinlik, ciktilar: new Map(), girdiler, donus: null, akisHedefi, veriKaynagi };
  }

  function adimSay(c: Cerceve, id: string): void {
    if (durdu) throw new Durduruldu();
    if (++adim > sinir.adim) throw new DugumHatasi(id, `adım tavanı aşıldı (${sinir.adim}): grafik çok uzun ya da sonsuza yakın tekrar ediyor`, c.graf.ad);
    if (simdi() - baslangic > sinir.sureMs) throw new DugumHatasi(id, `süre tavanı aşıldı (${Math.round(sinir.sureMs / 1000)} sn)`, c.graf.ad);
  }

  async function bekle(ms: number): Promise<void> {
    if (durdu) throw new Durduruldu();
    await Promise.race([uyu(ms), durma]);
    if (durdu) throw new Durduruldu();
  }

  /** Bir sözü ■'ye karşı bekler. Kaybeden söz sonradan reddederse "yakalanmamış ret" olmasın diye ona boş bir yakalayıcı takılır (yarış yine reddi görür). */
  async function bekleVeyaDur<T>(is: Promise<T>): Promise<T> {
    if (durdu) throw new Durduruldu();
    is.catch(() => undefined);
    const r = await Promise.race([is.then((deger) => ({ deger })), durma.then(() => null)]);
    if (r === null || durdu) throw new Durduruldu();
    return r.deger;
  }

  function durdurulunca(f: () => void): () => void {
    if (bitti) return () => {};
    if (durdu) { try { f(); } catch (err) { console.error("[graf] durdurma kancası hatası:", err); } return () => {}; }
    durunca.add(f);
    return () => { durunca.delete(f); };
  }

  /** Veri girişinin değeri. */
  async function girisDegeri(c: Cerceve, id: string, pin: string): Promise<unknown> {
    const kaynak = c.veriKaynagi.get(anahtar(id, pin));
    if (!kaynak) {
      const d = c.cozum.get(id)!.ayar[pin];
      if (d === undefined) throw new DugumHatasi(id, `'${pin}' girişi bağlı değil ve ayarı yok`, c.graf.ad);
      return d;
    }
    const [kid, kpin] = kaynak;
    const k = c.cozum.get(kid)!;
    if (k.tanim.saf) {
      const s = await dugumCalistir(c, kid);
      return s.cikti?.[kpin];
    }
    const cikti = c.ciktilar.get(kid);
    if (!cikti || !(kpin in cikti)) throw new DugumHatasi(id, `'${pin}' girişi '${kid}.${kpin}'den okunuyor ama '${kid}' henüz çalışmadı`, c.graf.ad);
    return cikti[kpin];
  }

  async function dugumCalistir(c: Cerceve, id: string): Promise<DugumSonucu> {
    adimSay(c, id);
    const d = c.cozum.get(id)!;
    a.olay?.({ tur: "dugum", graf: c.graf.ad, id, derinlik: c.derinlik });
    if (d.tanim.tip === FONKSIYON_GIRIS_TIPI) return { cikti: { ...c.girdiler }, sonra: "sonra" };
    if (d.tanim.tip === FONKSIYON_DONUS_TIPI) {
      const donus: Record<string, unknown> = {};
      for (const p of d.pinler.girisler) if (p.tip !== "akis") donus[p.ad] = await girisDegeri(c, id, p.ad);
      return { donus };
    }
    const calisma: DugumCalismasi<Y> = {
      dugumId: id,
      tetik,
      degiskenler: a.degiskenler ?? null,
      ajanDegiskenleri: a.ajanDegiskenleri ?? null,
      ben,
      ajanlar,
      saat,
      ayar: d.ayar,
      giris: (pin) => girisDegeri(c, id, pin),
      girisAdlari: () => d.pinler.girisler.filter((p) => p.tip !== "akis").map((p) => p.ad),
      durduruldu: () => durdu,
      bekle,
      bekleVeyaDur,
      durdurulunca,
      desenCagir: (ad, girdiler) => desenCagir(c, id, ad, girdiler),
      yetenek: a.yetenek,
    };
    try {
      return await d.tanim.calistir(calisma);
    } catch (err) {
      if (err instanceof Durduruldu || err instanceof DugumHatasi) throw err;
      throw new DugumHatasi(id, err instanceof Error ? err.message : String(err), c.graf.ad);
    }
  }

  async function akisYurut(c: Cerceve, ilk: string): Promise<void> {
    let sira: string | null = ilk;
    while (sira !== null && c.donus === null) {
      const id: string = sira;
      const s = await dugumCalistir(c, id);
      if (s.donus) { c.donus = s.donus; return; }
      if (s.cikti) c.ciktilar.set(id, s.cikti);
      for (const dal of s.dallar ?? []) {
        if (dal.cikti) c.ciktilar.set(id, { ...c.ciktilar.get(id), ...dal.cikti });
        const hedef = c.akisHedefi.get(anahtar(id, dal.pin));
        if (hedef) await akisYurut(c, hedef);
        if (c.donus !== null) return;
      }
      sira = s.sonra ? c.akisHedefi.get(anahtar(id, s.sonra)) ?? null : null;
    }
  }

  async function desenCagir(c: Cerceve, id: string, ad: string, girdiler: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> {
    if (c.derinlik + 1 > sinir.derinlik) throw new DugumHatasi(id, `desen derinlik tavanı aşıldı (${sinir.derinlik}): desenler birbirini çok derin ya da döngüyle çağırıyor`, c.graf.ad);
    const d = a.desen(ad);
    if (!d) throw new DugumHatasi(id, `'${ad}' adlı desen yok`, c.graf.ad);
    const alt = cerceveKur(d, c.derinlik + 1, girdiler);
    const giris = d.dugumler.find((x) => x.tip === FONKSIYON_GIRIS_TIPI)!;
    await akisYurut(alt, giris.id);
    return alt.donus ?? {};
  }

  /**
   * Çalışmanın ilk düğümü: olay girişi verildiyse o DÜNYA OLAYI düğümü (başka tür düğümden "başlatmak" akış kuralını atlardı: Eğer'in ortasından
   * başlayan bir program denetimin görmediği bir yol olurdu), yoksa ▶ Başla. Olay grafiğinde Başla yoksa ▶ ile çalışmaz, nedenini söyler.
   */
  function girisBul(kok: Cerceve): string {
    if (a.giris) {
      const d = kok.cozum.get(a.giris.dugum);
      if (!d) throw new DugumHatasi(null, `olay girişi '${a.giris.dugum}' bu grafikte yok`, g.ad);
      if (d.tanim.dunyaOlayi === undefined) throw new DugumHatasi(a.giris.dugum, `'${a.giris.dugum}' bir olay düğümü değil (${d.tanim.tip}): çalışma yalnız ▶ Başla'dan ya da olay düğümünden başlar`, g.ad);
      return a.giris.dugum;
    }
    const basla = g.dugumler.find((x) => x.tip === BASLA_TIPI);
    if (!basla) throw new DugumHatasi(null, `'${g.ad}' olayla çalışır ('▶ Başla' yok): Graf sekmesinde ⚡ Dinlemeye al`, g.ad);
    return basla.id;
  }

  const sonuc = (async (): Promise<CalismaSonucu> => {
    try {
      if (g.tur !== "olay") throw new DugumHatasi(null, `'${g.ad}' bir desen: tek başına çalışmaz, başka bir grafikten 'Desen' düğümüyle çağrılır`, g.ad);
      const kok = cerceveKur(g, 0, {});
      await akisYurut(kok, girisBul(kok));
      a.olay?.({ tur: "bitti", adim });
      return { durum: "bitti", adim };
    } catch (err) {
      if (err instanceof Durduruldu) { a.olay?.({ tur: "durdu", adim }); return { durum: "durdu", adim }; }
      const id = err instanceof DugumHatasi ? err.dugum : null;
      const hataGrafi = (err instanceof DugumHatasi ? err.graf : null) ?? g.ad;
      const mesaj = err instanceof Error ? err.message : String(err);
      a.olay?.({ tur: "hata", graf: hataGrafi, id, mesaj });
      return { durum: "hata", adim, hata: mesaj, ...(id ? { hataDugumu: id } : {}), hataGrafi };
    } finally {
      bitti = true;
      durunca.clear();
    }
  })();

  return {
    sonuc,
    durdur() {
      if (durdu || bitti) return;
      durdu = true;
      durmaCoz();
      // Dünyadaki süren işi kes (ajanın bedenine `dur`, söz): bir kancanın hatası ötekileri kesmez ama sessiz de kalmaz.
      for (const f of [...durunca]) { try { f(); } catch (err) { console.error("[graf] durdurma kancası hatası:", err); } }
      durunca.clear();
    },
  };
}
