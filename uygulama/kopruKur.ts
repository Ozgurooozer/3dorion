// uygulama/kopruKur.ts — Köprü (`Kopru`) kurulumu: beyin, hafıza/durum depoları, süzgeç, ayar telleri ve dinleyici bağları.
//
// Eskiden uygulama/giris.ts'teki `beyniBagla`nın içindeydi (mimari düzenleme B1–B2). Seçenek nesnesi ve yorumları
// olduğu gibi taşındı; dünya nesneleri parametre olarak gelir, sonradan atananlar (`orion`, `inisiyatifSimdi`) çağrı
// anında okunur. Köprü dünyayı da beyni de import etmez; ikisini kompozisyon katmanı (burası) bağlar.
"use strict";
import { Kopru } from "../bridge/kopru.ts";
import { konumluSabitBilgi } from "../world/yer/birlesikYer.ts";
import { yerelTepki } from "../mind/yerelTepki.ts";
import { refleksGirdisi, type KuralRefleksi } from "../mind/refleks.ts";
import type { SeciliNesne } from "../mind/komutSozlugu.ts";
import type { Inisiyatif } from "../mind/inisiyatif.ts";
import type { OrtamSozlugu } from "../mind/ortamSozlugu.ts";
import { kimlik } from "../protocol/temel.ts";
import type { Niyet } from "../protocol/niyet.ts";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { SemaPaneli } from "../world/surfaces/duvar/sema.ts";
import type { GunlukEkrani } from "../world/surfaces/duvar/gunluk.ts";
import type { DavranisDefteri } from "../world/davranisDenemesi.ts";
import { PANO_TELLERI } from "./devrePanosu.ts";
import {
  ogretimleriYukle, gorevSatirlariniYukle, durumDeposuKur, hafizaYedegiKur, hafizaDeposuKur,
} from "./hafizaDeposu.ts";
import type { beyinSeciminiKur } from "./beyinSecimi.ts";
import type { zihinDuvariniBagla } from "./zihinDuvari.ts";
import type { Takipci } from "./takip.ts";
import type { ortamBaglantisiKur } from "./ortamBaglantisi.ts";
import type { Yerler } from "./yerGecisi.ts";

export interface KopruGirdisi {
  duvar: ReturnType<typeof zihinDuvariniBagla>;
  secim: ReturnType<typeof beyinSeciminiKur>;
  sema: SemaPaneli;
  gunluk: GunlukEkrani;
  oyuncu: Oyuncu;
  yerler: Yerler;
  refleks: KuralRefleksi;
  takipci: Takipci;
  inisiyatif: Inisiyatif;
  ortamBaglantisi: ReturnType<typeof ortamBaglantisiKur>;
  ortamSozlugu: OrtamSozlugu;
  /** Tek karar→eylem yolu (uygulama/niyetYurutucu.ts). */
  niyetiYurut: (n: Niyet, id: string) => void;
  /** Davranış ölçümü açıkken kayıt defterine erişim (yoksa null). */
  davranisKayit: () => ReturnType<DavranisDefteri["kayit"]> | null;
  dunyaDurumu: () => string;
  hafizaKipi: "otomatik" | "yonlendirici";
  inisiyatifEski: boolean;
  /** Sonradan atananlar: çağrı anında okunur. */
  orion: () => Avatar | null;
  inisiyatifSimdi: () => number;
  /** Göz muayenesi sürerken beyin yeni tur başlatmasın (iki yönlü sıra; uygulama/gozlem.ts). */
  beyinKapisi?: () => boolean;
  /** Seçili nesne (spec 28): söz sözlüğü "buraya otur" gibi sözleri buna göre çözer. */
  secili?: () => SeciliNesne | null;
}

export function kopruKur(g: KopruGirdisi): Kopru {
  const { duvar, secim, sema, gunluk, oyuncu, yerler, refleks, takipci, inisiyatif, ortamBaglantisi, ortamSozlugu, niyetiYurut, davranisKayit } = g;
  const { kesikSn } = secim;
  return new Kopru({
      kararKaydi: duvar.kararKaydi,
      // Dikkat'in yazılabilir ayarları TELDEN gelir: karar yolu ile devre
      // panosu artık aynı nesneyi okur.
      dikkat: {
        tekrarPenceresiMs: PANO_TELLERI.dikkat.tekrar,
        terminalKisMs: PANO_TELLERI.dikkat.terminalKis,
        dakikaBasinaAzami: PANO_TELLERI.dikkat.azami,
      },
      beyin: secim.kopruBeyni,
      niyetGonder: (n, id) => {
        // Davranış ölçümü için: hangi niyet üretildi, yalnızca kimliği değil.
        // Kimlik tek başına "Orion ne yaptı" sorusuna cevap vermiyordu.
        const govde = JSON.stringify(n).slice(0, 120);
        console.log(`[BEYIN→NIYET] ${id} ${govde}`);
        gunluk.ekle("bilgi", "niyet", `${n.tur} ${govde.slice(0, 90)}`);
        sema.vur("niyet", n.tur);
        davranisKayit()?.niyet(n.tur);

        // YÖNLENDİRME (kompozisyon kökünün işi): `soyle` avatarın değil ses
        // hattının niyetidir. Köprü onu zaten `konusmaDinle` üzerinden TTS'e
        // verdi; bir de avatara göndermek avatarın onu HATA ile reddetmesine
        // yol açıyordu ve bu sahte başarısızlık beyne geri besleniyordu —
        // yani Orion doğru konuşurken "konuşamadım" diye öğreniyordu.
        // Ağız senkronu ayrı yoldan (orionSesi → agizAyarla) zaten yürüyor.
        niyetiYurut(n, id);
      },
      dunyaDurumu: g.dunyaDurumu,
      // Çapa adları DEĞİŞMEZ: sistem mesajında bir kez söylenir. Her turun
      // sonuna eklendiğinde model onları son algı sanıp geri okuyordu.
      // GÖRÜNEN adlar (spec 06 K3): iç kimlik (`admin`, `sema`) modele hiçbir
      // şey anlatmıyordu; algı hizmeti "yönetim terminali" derken sabit liste
      // "admin" diyordu ve model ikisini aynı şey saymıyordu.
      // Çapa ETİKETLERİ Türkçe kalır: onlar odadaki şeylerin ADI, çerçeve değil.
      sabitBilgi: () => { const k = g.orion()?.durum().konum ?? { x: 0.9, z: -1.2 }; return konumluSabitBilgi(yerler.orion, k.x, k.z); },
      toplamaMs: 900,
      // Ölçüm için ayarlanabilir: kısa pencere hipotezi (anı, alakasız sohbetin
      // altında gömülüyor mu?) tek değişkenle sınanabilsin.
      gecmisSiniri: Number(new URLSearchParams(location.search).get("gecmis") ?? 12) || 12,
      // HAFIZA OTURUMLAR ARASI KALICI.
      //
      // Önceden yalnızca bellekteydi: her açılışta Orion sizi ilk kez
      // görüyordu. "Odada yaşayan biri" iddiası, dünü hatırlamayan biriyle
      // tutmuyor. localStorage yeterli — Electron renderer'ında kalıcı, IPC
      // gerektirmiyor ve depo arayüzü dar olduğu için ileride dosyaya
      // taşımak tek fonksiyon değişikliği.
      //
      // DOSYAYA TAŞINDI (spec 07 K4, 2026-09-19). Yukarıdaki not doğru çıktı:
      // arayüz dar olduğu için değişiklik bu blokla sınırlı (K7). Karar
      // `mind/hafizaGocu.ts` → `depoYukle`de; burada yalnızca G/Ç bağlanır.
      hafizaDeposu: hafizaDeposuKur(),
      // Sıkıştırma yedeği (spec 26 F3-C): host dosyası yoksa (geliştirme kipi) yedek de yok → sıkıştırma yapılmaz.
      ...hafizaYedegiKur(),
      // Kendiliğinden uyanışlar: bütçe (model-saniye/token) köprüden beslenir; özerk tur dar araç kümesiyle (T2-K4/K5).
      inisiyatifButcesi: { sonuc: (_t, sureMs, token, eylemli) => inisiyatif.butce.sonuc(g.inisiyatifSimdi(), sureMs, token, eylemli) },
      ozerkTur: !g.inisiyatifEski,
      aniPolitikasi: new URLSearchParams(location.search).get("anipolitikasi") === "eski" ? "eski" : "yeni",
      ...(g.beyinKapisi ? { beyinKapisi: g.beyinKapisi } : {}),
      hafizaKapasite: PANO_TELLERI.hafiza.kapasite,
      // SPEC 16: bağlama yalnız SORULAN girer (konum, son iş, eski konuşma…), yakın pencere küçük.
      // `?hafiza=otomatik` eski davranışı geri getirir — kıyas ölçüsü için (spec 16 P1).
      hafizaKipi: g.hafizaKipi,
      ...(g.hafizaKipi === "yonlendirici" ? { yakinPencere: { kayit: 4, yasMs: 10 * 60_000 } } : {}),
      yerAdlari: () => yerler.orion.capalar.map((c) => c.etiket),
      // "BENİ TAKİP ET" (içgüdü `kopru.takip`): köprü sözü tanır, dünya (Takipci) yürütür.
      takipDinle: (aktif) => {
        if (aktif) takipci.baslat(); else takipci.birak();
        gunluk.ekle("bilgi", "takip", aktif ? "Ozyn'i takip ediyor" : "takip bitti");
      },
      durumDeposu: durumDeposuKur(),
      // ÖĞRENEN KAPI (K3, K5): gölgede — kapının kararını değiştirmez, kayda yazar.
      ogretimler: ogretimleriYukle(),
      // BECERİ REFLEKSİ (spec 10, Faz C): gölgede — kesin sözde hafızanın ne yapacağını
      // söz satırına yazar; kapı, uyanış ve niyetler değişmez.
      gorevSatirlari: gorevSatirlariniYukle(),
      // BECERİ YETKİSİ (Faz D): ANAHTAR, varsayılan KAPALI. Yalnız `?beceri=1` (ORION_BECERI=1)
      // ile açılır; açılması ön-kayıtlı barı geçmeye bağlı (spec 10).
      beceriYetkisi: new URLSearchParams(location.search).has("beceri"),
      // DOĞUŞTAN KOMUT PROGRAMLARI (spec 13 Faz 2b): elle açılışta AÇIK (Ozyn: "ölçüm geçince
      // açık"; gerçek sözlerde yanlış eşleşme 0). Senaryolarda (`sessiz=1`) KAPALI: `tahtadene`,
      // `becerdene` LLM'in ve becerinin yolunu ölçer, program onları değiştirmesin. `?komut=0|1` zorlar.
      // SÜZGEÇ MERCEĞİNİN YETKİSİ (spec 12 Faz 5): ANAHTAR, varsayılan KAPALI (gölgede yazar).
      // `?benliksuzgec=1` açar; gerçek kullanımda açılması gölge ölçüsüne bağlı (Ozyn).
      benlikSuzgecYetkisi: new URLSearchParams(location.search).has("benliksuzgec"),
      // ANLIK BENLİK (spec 12): gövde karar anında ÇEKİLİR.
      bedenDurumu: () => {
        const d = g.orion()?.durum();
        return d ? { poz: d.poz, oturuyor: d.oturuyor_mu } : null;
      },
      // Ortam sözleri ("gece yap") yalnız ova'dayken sözlükten geçer; ofiste LLM'e gider (mind/ortamKomutlari.ts).
      ortamKullanilabilir: () => ortamBaglantisi.kullanilabilirMi(),
      ...(g.secili ? { secili: g.secili } : {}),
      ortamOgrenilen: (soz) => ortamSozlugu.esle(soz),
      ortamOgren: (soz, komutlar) => {
        const r = ortamSozlugu.ogren(soz, komutlar);
        console.log(`[ORTAM] sözlük: "${soz}" → ${r}${r === "reddedildi" ? "" : ` (${komutlar.map((k) => `${k.ne}${k.deger ? ` ${k.deger}` : ""}${k.sayi !== undefined ? ` ${k.sayi}` : ""}`).join(", ")})`}`);
      },
      komutYetkisi: (() => {
        const q = new URLSearchParams(location.search);
        return q.has("komut") ? q.get("komut") !== "0" : !q.has("sessiz");
      })(),
      // BAĞLAM (K4): algı anında Ozyn nerede, Orion'a bakıyor mu, hangi yüzeyde.
      // Yapısal — dünya metni ayrıştırılmaz. Öğrenen kapının durum koduna girer.
      baglam: () => {
        const o = oyuncu.oyuncuDurumu();
        return { mesafe: o.mesafe, bakiyor: o.bakiyor, yuzey: o.etkilesim };
      },
      // İçerik süzgeci: hangi algının beyne değeceğine karar verir.
      // Kural tabanlı; ÖLÇÜLDÜ (mind/akis-olcum.ts, 12 gerçek komut çıktısı,
      // 12/12 ideal uyandırma). Spec'in önerdiği 270M model ölçümde elendi:
      // 31/31 geçersiz JSON, 13.8 sn azami gecikme, sıfır bilgi katkısı.
      suzgec: (a, ozet) => {
          // ── SAĞ LOB ─────────────────────────────────────────────────────────
        // Sol lob (OpenCode) kapalıysa Orion tamamen ölmez: yerel, kuralcı ve
        // anlık bir tepki üretir. `dürüst bozulma` vaadi ancak böyle gerçek olur.
        //
        // KOŞUL ŞART: ikisi birden çalışırsa niyetler çakışır ve beynin `git`i
        // sağ lobun `bak`ı tarafından kesilir — aynı sınıf hata bu oturumda bir
        // kez yaşandı (bkz. senaryo kipi).
        if (kesikSn() > 0 && a.tur !== "olay") {
          const n = yerelTepki({
            tur: a.tur === "duydum" ? "duydum" : a.tur === "terminal" ? "terminal" : "olay",
            ozet, kod: a.tur === "terminal" ? a.kod : undefined,
          });
          if (n) {
            const id = kimlik("saglob");
            console.log(`[SAGLOB] ${n.tur} ← ${ozet.slice(0, 70)}`);
            sema.vur("refleks", "sağ lob");
            gunluk.ekle("uyari", "sağ lob", `${n.tur}: ${ozet.slice(0, 60)}`);
            niyetiYurut(n, id);
          }
        }

      // Şema besleme noktası: her algı buradan geçiyor, dallanma da burada.
        // Köprünün içine kanca koymak yerine buradan okunuyor çünkü bu geri
        // çağrı ZATEN her algıda ve tam karar anında çalışıyor.
        sema.vur("algi", a.tur);
        sema.vur("suzgec");
        // Girdi tek kaynaktan (mind/refleks.ts `refleksGirdisi`): süre, çıkış kodu
        // ve niyetin kaynağı algıdan gelir, burada elle kurulmaz.
        const k = refleks.karar(refleksGirdisi(a, ozet));
        sema.vur(k.terfi ? "dikkat" : "refleks", k.terfi ? "" : "süzüldü");
        // Kimlik de döner: karar kaydı hangi içgüdünün karar verdiğini yazar (spec 08).
        return { gecsin: k.terfi, kural: k.kural, gerekce: k.gerekce };
      },
      metinDinle: (metin, aracVarMi) => { if (!aracVarMi) davranisKayit()?.duyulmayan(metin); },
      icSesDinle: duvar.icSesDinle,
      sozEylemDinle: duvar.sozEylemDinle,
      asamaDinle: duvar.asamaDinle,
    });
}
