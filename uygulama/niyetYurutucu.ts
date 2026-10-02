// uygulama/niyetYurutucu.ts — TEK niyet yönlendirme noktası (spec 14 R4: world/giris.ts'ten taşındı).
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
import type { Tahta } from "../world/surfaces/tahta.ts";
import type { Monitor } from "../world/surfaces/monitor.ts";
import type { GunlukEkrani } from "../world/surfaces/gunluk.ts";
import type { SemaPaneli } from "../world/surfaces/sema.ts";
import { yaklastiMi } from "../world/level/capalar.ts";
import { bilgisayariAc } from "../world/bilgisayar.ts";
import type { OnayKapisi } from "../mind/onayKapisi.ts";
import type { Cevap, Soru } from "../mind/algiHizmeti.ts";

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
  /** `sor` cevabı beyne gitti (`bakdene` yedeği: zincir kendiliğinden işledi mi?). */
  gordumBildir(): void;
}

export interface NiyetYurutucu {
  niyetiYurut(n: Niyet, id: string): void;
  /** Bir programın ara adımı: niyeti avatara verir, sonucu gelince çözülür. */
  bedenAdimi(n: Niyet, sinirMs?: number): Promise<NiyetSonucu>;
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
      if (!yeri || !yaklastiMi("tahta", yeri)) {
        // ROBOT İLKESİ (spec 13): uzaktan YAZILMAZ ama Orion reddedilip beklemez —
        // önce tahtaya KENDİSİ yürür, varınca yazar (`otur`un sandalyeye yürümesi gibi).
        // Ortak test 3 (2026-10-02): lfm25-tb uzaktan 15 kez `yaz` denedi, her seferinde
        // "önce git" reddi aldı ve hiç yürümedi.
        console.log(`[TAHTA] uzakta (${yeri ? `${yeri.x.toFixed(1)},${yeri.z.toFixed(1)}` : "konum yok"}): once tahtaya yuruyor`);
        void bedenAdimi({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }).then((s) => {
          const varis = b.beden()?.durum().konum;
          if (s.durum !== "bitti" || !varis || !yaklastiMi("tahta", varis)) {
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

    // `komut` TERMINALE GITMEZ: onay kapisina girer. Orion hicbir kosulda
    // komut CALISTIRMAZ; calistiran sey Ozyn'in tusudur.
    if (n.tur === "komut") {
      const r = b.onayKapisi.oner(id, n.metin, n.gerekce);
      if (!r.kabul) {
        console.log(`[ONAY] oneri kabul edilmedi: ${r.sebep}`);
        b.kopru()?.sonuc({ niyet_id: id, durum: "hata", not: r.sebep ?? "oneri kabul edilmedi" });
        return;
      }
      const bk = b.onayKapisi.bekleyen;
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
  function bedenAdimi(n: Niyet, sinirMs = 30_000): Promise<NiyetSonucu> {
    const id = kimlik("program");
    return new Promise((coz) => {
      const o = b.beden();
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

  return { niyetiYurut, bedenAdimi };
}
