// uygulama/niyetYurutucu.ts — TEK niyet yönlendirme noktası (spec 14 R4: uygulama/giris.ts'ten taşındı).
//
// Neden tek: yönlendirme önce yalnızca köprünün `niyetGonder` yolundaydı. Sonuç olarak `yaz` niyeti
// GELDİĞİ YOLA GÖRE farklı davranıyordu — köprüden gelince tahtaya, `window.dunya.niyet()` ya da 1-6
// tuşlarından gelince doğrudan avatara gidip "benim işim değil" hatası alıyordu. Canlı tahta
// denemesi bu kusuru ortaya çıkardı. Artık her yol buradan geçer: avatar, ses hattı, tahta, onay
// kapısı ve algı hizmeti burada ayrılır.
//
// Neden ayrı dosya: giris.ts'in içindeyken bu yönlendirme yalnız canlı koşuyla (`*dene`)
// sınanabiliyordu. Bağımlılıklar artık `YurutucuBaglami` ile verilir; testte sahteleri geçer
// (`niyetYurutucu.test.ts`). Gövde aynı — yalnız modül değişkenleri bağlamdan okunur.
"use strict";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";
import type { Algi } from "../protocol/algi.ts";
import { kimlik } from "../protocol/temel.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { Tahta } from "../world/surfaces/tahta/tahta.ts";
import type { Monitor } from "../world/surfaces/terminal/monitor.ts";
import type { GunlukEkrani } from "../world/surfaces/duvar/gunluk.ts";
import type { SemaPaneli } from "../world/surfaces/duvar/sema.ts";
import { yaklastiMi, type Capa } from "../world/level/capalar.ts";
import { bilgisayariAc } from "../world/bilgisayar.ts";
import type { OnayKapisi } from "../mind/onayKapisi.ts";
import { onaysizCalissinMi, type KomutKipi } from "./komutKipi.ts";
import type { Cevap, Soru } from "../mind/algiHizmeti.ts";
import type { Doktor } from "./doktor.ts";

/** Yürütücünün dünyadan gördüğü kadarı. Sonradan atananlar (beden, köprü) fonksiyondur. */
export interface YurutucuBaglami {
  beden(): Pick<Avatar, "durum" | "niyet" | "sonucDinle"> | null;
  kopru(): { sonuc(s: NiyetSonucu): void; algi(a: Algi): void } | null;
  tahta: Pick<Tahta, "yaz">;
  monitor: Pick<Monitor, "acikMi" | "ac">;
  onayKapisi: Pick<OnayKapisi, "oner" | "bekleyen">;
  sema: Pick<SemaPaneli, "vur">;
  gunluk: Pick<GunlukEkrani, "ekle">;
  algiSor(ne: Soru): Cevap;
  altyazi(metin: string, ms?: number): void;
  onayPaneliCiz(): void;
  /**
   * Komut kipi (spec 26 F2) ve bekleyen komutu Ozyn'in tuşu OLMADAN onaylayan işlev (giris.ts `onayKarari(true, true)`).
   * Verilmezse eski davranış: her komut onay bekler.
   */
  komutKipi?(): KomutKipi;
  otomatikOnay?(): void;
  /** `hatirla` niyeti (spec 26 F3): olguyu kalıcı hafızaya yazar. Verilmezse hafıza kapalı sayılır. */
  olguHatirla?(anahtar: string, deger: string): "yeni" | "guncellendi" | "ayni" | null;
  /**
   * `ortam` niyeti (ova'nın ışığı/stili/zamanı): `uygulama/ortamBaglantisi.ts`. Verilmezse dürüstçe "yok" denir
   * (sessiz yutma yok). Beden işi değil: yürümez, sırada beklemez.
   */
  ortam?: { uygula(k: Extract<Niyet, { tur: "ortam" }>): { ok: boolean; not: string } };
  /** `doktor` niyeti (Orion Doktor, `uygulama/doktor.ts`): kendi bedenini/dünyasını muayene eder. Verilmezse dürüstçe "yok" denir. */
  doktor?: Pick<Doktor, "muayene">;
  /**
   * `emret` niyeti (spec 33): başka bir ajana (Flash) komut teslim eder. `ok: false` nedenle döner (ajan yok, kendine emir…): Orion'un modeline gider. Verilmezse
   * dürüstçe "yok" denir. Teslim edildi demektir, yapıldı değil (NPC'nin işi asenkron).
   */
  emret?: (kime: string, soz: string) => { ok: boolean; not: string };
  /** `sor` cevabı beyne gitti (`bakdene` yedeği: zincir kendiliğinden işledi mi?). */
  gordumBildir(): void;
  /**
   * Orion'un bulunduğu yerin çapaları (spec 24). Verilmezse oda. Ovada tahta yok: "tahtanın yanında mı" sorusu
   * odanın tahta koordinatına denk gelen bir ova noktasında yanlışlıkla "evet" demesin.
   */
  orionCapalari?(): readonly Capa[];
  /**
   * GÖRME (spec 25 Faz 2): Orion'un gözü (dünya) ve görme modeli (köprü). Verilmezse `sor gor` dürüstçe
   * "gözün bağlı değil" der ve algıyla cevaplar.
   */
  goz?: {
    /** Orion'un gözünden kare (base64 PNG); beden yoksa null. */
    kare(): Promise<string | null>;
    /** Kare + algı metni → betim. Fırlatabilir (model yok, zaman aşımı, boş cevap). */
    gor(png: string, algi: string): Promise<string>;
  };
  /**
   * GÖZ MUAYENESİ (`uygulama/gozlem.ts`, Ozyn 2026-10-15): verilirse `sor gor` BU yoldan gider: düz Türkçe görme sorgusu (rol/algı/sohbet YOK), iki yönlü sıra
   * (beyin düşünürken bekler; bakarken beyin yeni tur başlatmaz), panelde önizleme + cevap. Döngü: söz/araç → bakış → `gordum` algısı → beyin cevaplar.
   * Verilmezse eski `goz` yolu (algılı, İngilizce betim) çalışır.
   */
  gozlem?: { bak(): Promise<{ metin: string } | null>; sonHata(): string | null };
}

/** Son görmenin kaydı: canlı ölçüm (`gozdene`, spec 25 §7) ve günlük için. */
export interface GormeKaydi {
  niyetId: string;
  /** Modele bağlam olarak giden algı metni. */
  algi: string;
  /** Beyne giden `gordum` metni (başarısızsa dürüst yedek). */
  metin: string;
  /** Niyetten `gordum`a kadar (kare + model). */
  sureMs: number;
  hata?: string;
}

export interface NiyetYurutucu {
  niyetiYurut(n: Niyet, id: string): void;
  /** Bir programın ara adımı: niyeti avatara verir, sonucu gelince çözülür. */
  bedenAdimi(n: Niyet, sinirMs?: number): Promise<NiyetSonucu>;
  /** Son `sor gor`un kaydı (henüz bakılmadıysa null). */
  sonGorme(): GormeKaydi | null;
}

export function niyetYurutucusuKur(b: YurutucuBaglami): NiyetYurutucu {
  function niyetiYurut(n: Niyet, id: string): void {
    // `soyle` ses hattının işi; köprü onu zaten `konusmaDinle` ile TTS'e verdi.
    // Avatara göndermek sahte bir "yapamadım" üretirdi.
    if (n.tur === "soyle") return;

    // `yaz` tahtanın işi — ama UZAKTAN YAZILMAZ. Kural talimatta zaten yazılı
    // ("tahtaya yazmak için önce tahtanın önüne git"); burada GERÇEKTEN
    // uygulanıyor ve reddin gerekçesi beyne geri besleniyor.
    if (n.tur === "yaz") {
      const yeri = b.beden()?.durum().konum;
      if (!yeri || !yaklastiMi("tahta", yeri, b.orionCapalari?.())) {
        // ROBOT İLKESİ (spec 13): uzaktan YAZILMAZ ama Orion reddedilip beklemez —
        // önce tahtaya KENDİSİ yürür, varınca yazar (`otur`un sandalyeye yürümesi gibi).
        // Ortak test 3 (2026-10-02): lfm25-tb uzaktan 15 kez `yaz` denedi, her seferinde
        // "önce git" reddi aldı ve hiç yürümedi.
        console.log(`[TAHTA] uzakta (${yeri ? `${yeri.x.toFixed(1)},${yeri.z.toFixed(1)}` : "konum yok"}): once tahtaya yuruyor`);
        void bedenAdimi({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }).then((s) => {
          const varis = b.beden()?.durum().konum;
          if (s.durum !== "bitti" || !varis || !yaklastiMi("tahta", varis, b.orionCapalari?.())) {
            b.kopru()?.sonuc({ niyet_id: id, durum: "hata", not: `tahtaya yürüyemedim: ${s.not ?? s.durum}` });
            b.altyazi("Orion tahtaya ulaşamadı", 2000);
            return;
          }
          tahtayaYaz(n, id);
        });
        return;
      }
      tahtayaYaz(n, id);
      return;
    }

    // `hatirla` bedene gitmez: damıtılmış olgu kalıcı hafızaya yazılır (aynı anahtar eskisini günceller).
    if (n.tur === "hatirla") {
      const s = b.olguHatirla?.(n.anahtar, n.deger) ?? null;      // null: hafıza yok/kapalı — "hatırladım" yalanı söylenmez
      if (!s) { b.kopru()?.sonuc({ niyet_id: id, durum: "hata", not: "memory is not available" }); return; }
      b.gunluk.ekle("bilgi", "hafıza", `hatırladı (${s}): ${n.anahtar} = ${n.deger}`);
      b.kopru()?.sonuc({ niyet_id: id, durum: "bitti", not: `Remembered (${s}).` });
      return;
    }

    // `ortam` bedene gitmez: dünyanın görünümü değişir (ışık, stil, zaman). Sonuç köprüye döner; başarı sessizdir
    // (`bitti` beyni uyandırmaz = token yok), ret `hata`dır ve metni modele gider (ova'da değilse "ova'da değilim").
    if (n.tur === "ortam") {
      const r = b.ortam?.uygula(n) ?? { ok: false, not: "world look control is not available" };
      b.gunluk.ekle("bilgi", "ortam", r.ok ? r.not : `reddedildi: ${r.not}`);
      b.kopru()?.sonuc({ niyet_id: id, durum: r.ok ? "bitti" : "hata", not: r.not });
      return;
    }

    // `doktor` bedene gitmez: Orion kendi bedenini/dünyasını muayene eder (token'sız; söz yolu LLM'siz). "Tam" ~35 sn sürer ve eylem
    // sırasının adım zaman aşımından uzundur: niyet HEMEN `bitti` döner (sıra tıkanmaz), rapor ASENKRON gelir — altyazı, günlük ve Orion'un
    // sesi. Sağlıklıysa başka hiçbir şey olmaz (beyin uyanmaz = token yok); HASTAYSA ayrı bir `hata` sonucu modele gider (neyin bozuk olduğunu
    // söylesin diye). Aynı anda tek muayene (ikinci istek "zaten ediyorum" der).
    if (n.tur === "doktor") {
      const d = b.doktor;
      if (!d) { b.kopru()?.sonuc({ niyet_id: id, durum: "hata", not: "doctor is not available" }); return; }
      b.altyazi(n.kapsam === "tam" ? "Orion tam muayene oluyor (~35 sn)…" : "Orion kendini muayene ediyor…", 2500);
      b.kopru()?.sonuc({ niyet_id: id, durum: "bitti", not: "Check started; the report follows." });
      void d.muayene(n.kapsam ?? "hizli").then((r) => {
        for (const s of r.ayrinti) console.log("[DOKTOR] " + s);
        b.gunluk.ekle(r.saglikli ? "iyi" : "hata", "doktor", `${r.ozet} (${r.sureMs} ms)`);
        b.altyazi(r.ozet, 5000);
        void bedenAdimi({ tur: "soyle", metin: r.ozet });
        if (!r.saglikli) b.kopru()?.sonuc({ niyet_id: `${id}_rapor`, durum: "hata", not: r.modelNotu });
      });
      return;
    }

    // `emret` bedene gitmez: komut başka bir ajanın girdisine teslim edilir (Orion yürümez, sırada beklemez). Başarı sessizdir (`bitti` beyni uyandırmaz),
    // ret `hata`dır ve nedeni modele gider. Ozyn Orion'un emrini GÖRSÜN diye altyazı ve günlük yazılır.
    if (n.tur === "emret") {
      const r = b.emret?.(n.kime, n.soz) ?? { ok: false, not: "there is no other character to command" };
      b.gunluk.ekle(r.ok ? "bilgi" : "uyari", "emir", r.ok ? `Orion → ${n.kime}: ${n.soz}` : `Orion → ${n.kime}: reddedildi (${r.not})`);
      if (r.ok) b.altyazi(`Orion → ${n.kime}: ${n.soz}`, 2200);
      b.kopru()?.sonuc({ niyet_id: id, durum: r.ok ? "bitti" : "hata", not: r.not });
      return;
    }

    // `komut` her zaman ONAY KAPISINA girer (tek tehlikeli yetenek: tek yol, her karar kayda geçer). Kip `onayli` ise
    // çalıştıran Ozyn'in tuşudur; `otomatik`/`tam` kipinde (spec 26 F2, Ozyn'in kararı) kapı komutu hemen onaylar —
    // aynı yol, aynı kayıt, yalnız tuşa basan sistemdir. Yıkıcı sınıf `otomatik`te yine bekler (komutKipi.ts).
    if (n.tur === "komut") {
      const r = b.onayKapisi.oner(id, n.metin, n.gerekce);
      if (!r.kabul) {
        console.log(`[ONAY] oneri kabul edilmedi: ${r.sebep}`);
        b.kopru()?.sonuc({ niyet_id: id, durum: "hata", not: r.sebep ?? "oneri kabul edilmedi" });
        return;
      }
      const bk = b.onayKapisi.bekleyen;
      if (bk && b.otomatikOnay && onaysizCalissinMi(b.komutKipi?.() ?? "onayli", bk.risk.seviye)) {
        console.log(`[ONAY] OTOMATIK (${bk.risk.seviye}, kip ${b.komutKipi?.()}): ${n.metin}  | gerekce: ${n.gerekce}`);
        b.otomatikOnay();
        return;
      }
      console.log(`[ONAY] ONERILDI (${bk?.risk.seviye}): ${n.metin}  | gerekce: ${n.gerekce}`);
      b.sema.vur("onay", `bekliyor (${bk?.risk.seviye ?? "?"})`);
      b.gunluk.ekle(bk?.risk.seviye === "yikici" ? "hata"
        : bk?.risk.seviye === "degistirir" ? "uyari" : "bilgi", "onay",
        `önerildi: ${n.metin} — ${n.gerekce}`);
      b.onayPaneliCiz();
      b.altyazi("Orion bir komut oneriyor — Y onayla, N reddet", 4000);
      return;
    }

    // `sor` DÜNYAYA DEĞİL ALGI HİZMETİNE gider: bedeni ilgilendirmez, salt
    // okunur bir sorgudur ve cevabı doğrudan beyne geri beslenir.
    //
    // Bu, "Orion odayı görebiliyor mu" sorusunun cevabı: veriyi haritadan
    // okur (ucuz) ama her nesneyi GÖRÜŞ TESTİNDEN geçirir (gerçek ışın).
    // Böylece bildiği şey, durduğu yerden gerçekten görülebilen şeydir.
    if (n.tur === "sor") {
      // GÖRME ayrı yol: yavaş (1–3 sn), asenkron; tik'i bekletmez.
      if (n.ne === "gor") { void gozleBak(id); return; }
      const c = b.algiSor(n.ne);
      console.log(`[SOR] ${n.ne} → "${c.metin}" (${c.maliyet} krk${c.kirpildi ? ", kırpıldı" : ""})`);
      b.sema.vur("bakis", n.ne);
      b.gunluk.ekle("bilgi", "algi", `sor(${n.ne}): ${c.metin}`);
      // İKİ ayrı mesaj, ikisi de gerekli:
      //   `sonuc` niyeti kapatır (rutin, beyne çıkmaz),
      //   `gordum` CEVABI taşır ve beyne mutlaka ulaşır.
      // Önceden yalnızca `sonuc` gönderiliyordu ve cevap süzgeçte ölüyordu:
      // Orion soruyordu, algı hizmeti yanıtlıyordu, beyin hiç öğrenmiyordu.
      b.kopru()?.sonuc({ niyet_id: id, durum: "bitti", not: c.metin });
      b.kopru()?.algi({ tur: "gordum", ne: n.ne, metin: c.metin });
      b.gordumBildir();
      return;
    }

    // `odaklan` (spec 13 Faz 2a): eskiden avatara gidiyor ve "avatarın işi değil" diye
    // reddediliyordu (ortak test 2: Orion üç kez doğru aracı seçti, hiçbiri yürümedi).
    if (n.tur === "odaklan") { odaklanYurut(n, id); return; }

    // Beden gerçekten harekete geçti: şemanın son durağı.
    b.sema.vur("beden", n.tur);
    b.beden()?.niyet(n, id);
  }

  let bakiyor = false;
  let sonGorme: GormeKaydi | null = null;

  /**
   * `sor gor` (spec 25 Faz 2): ALGI (kesin, koddan) + Orion'un gözünden KARE → görme modeli → `gordum`.
   * Algı modelin BAĞLAMIDIR: adlar ve konumlar ondan gelir, görme onların üstüne ışığı, rengi, ekranı, Ozyn'i ekler.
   * Model çalışmazsa Orion bunu BİLİR: `gordum` "gözlerin çalışmıyor" der ve algıyı verir — görme ekstra, algı kalır.
   * Aynı anda tek bakış: ikincisi "zaten bakıyorum" hatasıyla kapanır (kart belleği ve sıra korunur).
   */
  async function gozleBak(id: string): Promise<void> {
    if (bakiyor) {
      b.kopru()?.sonuc({ niyet_id: id, durum: "hata", not: "zaten bakıyorum" });
      return;
    }
    bakiyor = true;
    const bas = Date.now();
    const algi = `${b.algiSor("dunya").metin}. Ozyn: ${b.algiSor("oyuncu").metin}`;
    b.sema.vur("bakis", "gor");
    let metin: string;
    let hata: string | undefined;
    try {
      if (b.gozlem) {
        const k = await b.gozlem.bak();
        if (!k) throw new Error(b.gozlem.sonHata() ?? "göz muayenesi cevap vermedi");
        metin = k.metin;
      } else {
        if (!b.goz) throw new Error("gözün bağlı değil");
        const png = await b.goz.kare();
        if (!png) throw new Error("bedenin hazır değil");
        metin = await b.goz.gor(png, algi);
      }
    } catch (e) {
      hata = (e as Error).message;
      metin = `Your eyes are not working right now (${hata}). Your perception: ${algi}`;
    } finally {
      bakiyor = false;
    }
    const sureMs = Date.now() - bas;
    sonGorme = { niyetId: id, algi, metin, sureMs, ...(hata ? { hata } : {}) };
    console.log(`[GOR] ${(sureMs / 1000).toFixed(1)} sn${hata ? ` HATA ${hata}` : ""} → "${metin}"`);
    b.gunluk.ekle(hata ? "uyari" : "bilgi", "algi", hata ? `göz çalışmadı: ${hata}` : `gördü: ${metin}`);
    b.kopru()?.sonuc({ niyet_id: id, durum: hata ? "hata" : "bitti", not: hata ?? metin });
    b.kopru()?.algi({ tur: "gordum", ne: "gor", metin });
    b.gordumBildir();
  }

  /** Tahtanın önündeyken yazar ve sonucu köprüye bildirir. */
  function tahtayaYaz(n: Extract<Niyet, { tur: "yaz" }>, id: string): void {
    const r = b.tahta.yaz(n.metin, n.temizle ?? false);
    console.log(`[TAHTA] yazildi: +${r.eklenen} satir${r.dusen ? `, ${r.dusen} eski satir dustu` : ""}`);
    b.kopru()?.sonuc({ niyet_id: id, durum: "bitti",
      not: `tahtaya ${r.eklenen} satır yazıldı${r.dusen ? `, ${r.dusen} eski satır kaydı` : ""}` });
  }

  /**
   * `odaklan`: monitör = "bilgisayarı aç" programı (world/bilgisayar.ts) — sandalyeye otur,
   * terminali aç, Ozyn'in kamerasına dokunma. Başka bir yüzey = oraya yürü. Sonuç `id` ile
   * köprüye döner: eylem sırası (bridge/eylemSirasi.ts) onu bekler.
   */
  function odaklanYurut(n: Extract<Niyet, { tur: "odaklan" }>, id: string): void {
    if (n.capa !== "monitor") {
      b.sema.vur("beden", `odaklan → ${n.capa}`);
      b.beden()?.niyet({ tur: "git", hedef: { tip: "capa", ad: n.capa } }, id);
      return;
    }
    b.sema.vur("beden", "bilgisayar");
    void bilgisayariAc({
      oturuyorMu: () => b.beden()?.durum().oturuyor_mu ?? false,
      otur: () => bedenAdimi({ tur: "otur" }),
      monitorAcikMi: () => b.monitor.acikMi(),
      monitorAc: () => b.monitor.ac(),
    }).then((s) => {
      console.log(`[BILGISAYAR] ${s.durum}: ${s.not}`);
      b.gunluk.ekle(s.durum === "bitti" ? "iyi" : "uyari", "beden",
        s.durum === "bitti" ? "Orion bilgisayarı açtı" : `bilgisayar açılamadı: ${s.not}`);
      b.kopru()?.sonuc({ niyet_id: id, durum: s.durum, not: s.not });
    });
  }

  /**
   * Bir programın ara adımı: niyeti avatara verir, sonucu (bitti/hata/iptal) gelince çözülür.
   * Dinleyici GÖNDERMEDEN önce kurulur: avatar sonucu senkron da verebilir. Kimlik öneki
   * `program`: köprü bu adımı kendi sırası sanmaz.
   */
  function bedenAdimi(n: Niyet, sinirMs = 30_000): Promise<NiyetSonucu> { return avatarAdimi(b.beden(), n, sinirMs); }

  return { niyetiYurut, bedenAdimi, sonGorme: () => sonGorme };
}

/**
 * Bir bedene tek adım: niyeti verir, sonucu (bitti/hata/iptal) gelince çözülür. Orion'un `bedenAdimi`'nın gövdesiydi; Flash'ın takibi
 * (spec 33) aynısını kendi bedeniyle çağırır — kopya yazılmaz. Dinleyici GÖNDERMEDEN önce kurulur: avatar sonucu senkron da verebilir.
 * Kimlik öneki `program`: köprü bu adımı kendi sırası sanmaz.
 */
export function avatarAdimi(o: Pick<Avatar, "niyet" | "sonucDinle"> | null, n: Niyet, sinirMs = 30_000): Promise<NiyetSonucu> {
  const id = kimlik("program");
  return new Promise((coz) => {
    if (!o) { coz({ niyet_id: id, durum: "hata", not: "beden henüz yüklenmedi" }); return; }
    let bitti = false;
    const bitir = (s: NiyetSonucu): void => {
      if (bitti) return;
      bitti = true;
      clearTimeout(saat);
      cik();
      coz(s);
    };
    const cik = o.sonucDinle((s) => { if (s.niyet_id === id && s.durum !== "basladi") bitir(s); });
    const saat = setTimeout(() => bitir({ niyet_id: id, durum: "hata", not: "zaman aşımı" }), sinirMs);
    o.niyet(n, id);
  });
}
