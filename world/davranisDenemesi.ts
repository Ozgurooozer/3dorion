// world/davranisDenemesi.ts — "Hat çalışıyor" ile "davranış iyi" aynı şey değil.
//
// T6b algı borusunun bağlandığını kanıtladı: Orion masasındaki terminali
// görüyor, gürültüyü eliyor. Ama ilk canlı koşuda gerçek bir kabuk hatasını
// gördüğünde HİÇBİR ŞEY SÖYLEMEDİ — bir niyet üretti ama `soyle` değildi.
// Kullanıcı açısından bu "Orion bozuk" demektir; sayaçlar yeşilken bile.
//
// Bu dosya davranışı ÖLÇER, sahneyi değil: her senaryoda Orion ne söyledi,
// hangi niyetleri üretti, kaç saniyede. Yargıyı insana bırakır — otomatik
// "iyi/kötü" vermez, çünkü konuşma kalitesi eşikle ölçülmez. Ama sessizliği
// ve araçsız düz metni AÇIKÇA işaretler: ikisi de nesnel kusurdur.
"use strict";

export interface SenaryoSonucu {
  ad: string;
  /** Orion'un gerçekten SESLENDİRDİĞİ cümleler (dunya_soyle niyetleri). */
  soyledi: string[];
  /** Üretilen tüm niyetlerin türü. */
  niyetler: string[];
  /** Modelin araç çağırmadan ürettiği düz metin — DUYULMAZ. */
  duyulmayanMetin: string[];
  /** Senaryonun toplam bekleme penceresi (ölçüm süresi, Orion'un hızı DEĞİL). */
  gecenMs: number;
  /**
   * İlk tepkiye kadar geçen süre. `null` = hiç tepki gelmedi.
   *
   * İlk sürümde gecikme olarak `gecenMs` kullanılıyordu — o BENİM bekleme
   * penceremdi, Orion'un yanıt süresi değil; her senaryo sabit "22.0 sn"
   * çıkıyordu ve "yavaş" kusuru anlamsızdı. Gerçek gecikme budur.
   */
  ilkTepkiMs: number | null;
}

export interface DavranisKaydi {
  soyle(metin: string): void;
  niyet(tur: string): void;
  duyulmayan(metin: string): void;
}

/**
 * Senaryo boyunca olan biteni toplayan basit kayıt defteri.
 * Kompozisyon kökü bunu köprünün dinleyicilerine bağlar.
 */
export class DavranisDefteri {
  private _soyledi: string[] = [];
  private _niyetler: string[] = [];
  private _duyulmayan: string[] = [];
  private _basladi = 0;
  private _ilkTepki: number | null = null;
  private _simdi: () => number;

  constructor(simdi: () => number = () => Date.now()) { this._simdi = simdi; }

  private _isaretle(): void {
    if (this._ilkTepki === null) this._ilkTepki = this._simdi() - this._basladi;
  }

  kayit(): DavranisKaydi {
    return {
      soyle: (m) => { this._isaretle(); this._soyledi.push(m); },
      niyet: (t) => { this._isaretle(); this._niyetler.push(t); },
      duyulmayan: (m) => { this._isaretle(); this._duyulmayan.push(m); },
    };
  }

  /** Yeni senaryo: sayaçları ve başlangıç anını sıfırlar. */
  sifirla(): void {
    this._soyledi = []; this._niyetler = []; this._duyulmayan = [];
    this._ilkTepki = null;
    this._basladi = this._simdi();
  }

  topla(ad: string, gecenMs: number): SenaryoSonucu {
    return {
      ad,
      soyledi: [...this._soyledi],
      niyetler: [...this._niyetler],
      duyulmayanMetin: [...this._duyulmayan],
      gecenMs,
      ilkTepkiMs: this._ilkTepki,
    };
  }
}

/** "En fazla iki cümle" talimatının kaba karakter karşılığı. */
export const AZAMI_KONUSMA_KARAKTER = 180;

/**
 * Orion'un terminaldeki komutu KENDİSİNİN yazdığını sanması.
 *
 * Ölçümde ısrarla tekrar etti ("yazdığım komut tanınmıyor", "ben komut
 * verdim") — oysa komutu Ozyn yazıyor. Bu bir üslup meselesi değil: Orion
 * kendi yapmadığı bir şeyi üstlenirse odadaki rolü yanlış kurulur.
 */
export const YANLIS_ATIF_DESEN =
  // Dizge birlestirmesi KULLANILMAZ: "\s" bir TS dizgesinde yalnizca 's'
  // demektir ve desen sessizce bozulur (bir kez basimiza geldi).
  // Gecmis zaman + SIMDIKI zaman birlikte; ikincisini ilk surum kacirmisti.
  /(yazdığım|verdiğim|girdiğim|çalıştırdığım)\s+komut|komut(u|ları)?\s+(ben|yanlış)\s*(yazdım|verdim|girdim)|komut\s+(veriyorum|yazıyorum|çalıştırıyorum|giriyorum|deniyorum)/i;

/** Nesnel kusurlar: yargı değil, sayılabilir eksiklikler. */
export interface Kusur {
  tur: "sessiz" | "araci_yok" | "yavas" | "konudan_sapma" | "gevezelik" | "yanlis_atif";
  aciklama: string;
}

/**
 * Konu ilgisi — KABA ama nesnel bir ölçü.
 *
 * Konuşma kalitesini otomatik puanlamak mümkün değil; ama "gerçek bir kabuk
 * hatası gördü ve sadece 'merhaba, nasıl yardımcı olabilirim' dedi" durumu
 * nesnel olarak yakalanabilir: beklenen konu kelimelerinden HİÇBİRİ geçmiyorsa
 * cevap gördüğü şeyle ilgili değildir.
 *
 * Sınırı açıkça yazıyorum: kelime örtüşmesi anlam ölçmez. Yanlış negatif
 * verebilir (doğru cevap farklı kelimelerle kurulmuş olabilir). Bu yüzden
 * yalnızca beklenen kelime listesi VERİLDİĞİNDE çalışır ve tek başına
 * "kötü cevap" kanıtı değil, incelenmesi gereken bir işarettir.
 */
export function konudanSapti(soylenenler: string[], beklenenKelimeler: readonly string[]): boolean {
  if (beklenenKelimeler.length === 0 || soylenenler.length === 0) return false;
  const metin = soylenenler.join(" ").toLocaleLowerCase("tr");
  return !beklenenKelimeler.some((k) => metin.includes(k.toLocaleLowerCase("tr")));
}

/**
 * Bir senaryonun nesnel kusurlarını çıkarır.
 *
 * `konusmaBekleniyor` — bu senaryoda Orion'un bir şey SÖYLEMESİ gerekiyor mu?
 * (Ozyn'e hitap, ya da masada gördüğü bir başarısızlık.) Beklenen yerde
 * sessizlik nesnel bir kusurdur; beklenmeyen yerde sessizlik doğru davranıştır.
 */
export function kusurlar(
  s: SenaryoSonucu,
  konusmaBekleniyor: boolean,
  secenek: { yavasEsikMs?: number; beklenenKelimeler?: readonly string[] } = {},
): Kusur[] {
  const yavasEsikMs = secenek.yavasEsikMs ?? 12_000;
  const c: Kusur[] = [];
  if (konusmaBekleniyor && s.soyledi.length === 0) {
    c.push({ tur: "sessiz", aciklama: "konuşması beklenirken hiçbir şey söylemedi" });
  }
  if (s.duyulmayanMetin.length > 0 && s.soyledi.length === 0) {
    c.push({
      tur: "araci_yok",
      aciklama: `model araç çağırmak yerine düz metin üretti (${s.duyulmayanMetin.length} kez) — kullanıcı bunu DUYMAZ`,
    });
  }
  if (konusmaBekleniyor && konudanSapti(s.soyledi, secenek.beklenenKelimeler ?? [])) {
    c.push({
      tur: "konudan_sapma",
      aciklama: `gördüğü şeyle ilgisiz cevap: beklenen konudan hiçbir kelime geçmiyor (${(secenek.beklenenKelimeler ?? []).join("/")})`,
    });
  }
  // Gevezelik: talimat "EN FAZLA İKİ CÜMLE" diyor. Buna uyulmadığını
  // ölçmek nesneldir — kalite yargısı değil, verilen kurala uyum denetimi.
  // Metriğin ilk hali bunu görmüyordu ve 5 cümlelik oda tarifini "kusursuz"
  // sayıyordu; körlüğü kapatmak için eklendi.
  const enUzun = s.soyledi.reduce((m, x) => Math.max(m, x.length), 0);
  if (enUzun > AZAMI_KONUSMA_KARAKTER) {
    c.push({ tur: "gevezelik", aciklama: `en uzun cümle ${enUzun} karakter (tavan ${AZAMI_KONUSMA_KARAKTER})` });
  }

  if (s.soyledi.some((x) => YANLIS_ATIF_DESEN.test(x))) {
    c.push({ tur: "yanlis_atif", aciklama: "terminaldeki komutu kendisinin yazdığını sanıyor (komutu Ozyn yazıyor)" });
  }

  // Gecikme ölçüsü ilk TEPKİ anıdır; ölçüm penceresi değil.
  if (s.ilkTepkiMs !== null && s.ilkTepkiMs > yavasEsikMs) {
    c.push({ tur: "yavas", aciklama: `ilk tepki ${(s.ilkTepkiMs / 1000).toFixed(1)} sn sürdü` });
  }
  return c;
}

/** Sonuçları okunur biçimde basar. */
export function raporla(
  sonuclar: { sonuc: SenaryoSonucu; konusmaBekleniyor: boolean; beklenenKelimeler?: readonly string[] }[],
): void {
  let toplamKusur = 0;
  for (const { sonuc, konusmaBekleniyor, beklenenKelimeler } of sonuclar) {
    const k = kusurlar(sonuc, konusmaBekleniyor, { beklenenKelimeler });
    toplamKusur += k.length;
    const tepki = sonuc.ilkTepkiMs === null ? "tepki yok" : `${(sonuc.ilkTepkiMs / 1000).toFixed(1)} sn`;
    console.log(`[DAVRANIS] ── ${sonuc.ad} (ilk tepki ${tepki}) ──`);
    console.log(`[DAVRANIS]   niyetler: ${sonuc.niyetler.join(", ") || "(yok)"}`);
    for (const s of sonuc.soyledi) console.log(`[DAVRANIS]   SOYLEDI: "${s}"`);
    for (const m of sonuc.duyulmayanMetin) console.log(`[DAVRANIS]   duyulmayan metin: "${m.slice(0, 100)}"`);
    for (const x of k) console.log(`[DAVRANIS]   KUSUR(${x.tur}): ${x.aciklama}`);
    if (k.length === 0) console.log(`[DAVRANIS]   kusur yok`);
  }
  console.log(`[DAVRANIS] TOPLAM KUSUR: ${toplamKusur}`);
}
