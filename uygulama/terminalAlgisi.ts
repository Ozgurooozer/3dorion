// uygulama/terminalAlgisi.ts — T6b "Orion görsün": masadaki terminali ve dünya olaylarını algıya çeviren boru.
//
// Eskiden uygulama/giris.ts'in içindeydi (mimari düzenleme B1–B2): kabuk işareti dinleyicisi (OSC 133),
// çıktı tamponu, komut bitiş durumu ve 20Hz mantık tikindeki iki blok. Bu durum yalnız bu üç parçanın
// ortak malı olduğundan modül değişkenleri kapanışa girdi; giris.ts yalnız `tikle`yi çağırır.
//
// Bugüne kadar Orion yalnızca Ozyn'in yazdığı metni algılıyordu — odada olanı da, masasındaki terminali de
// görmüyordu. Süzgeç (mind/refleks) beyni boğulmaktan korur.
"use strict";
import type { Monitor } from "../world/surfaces/terminal/monitor.ts";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { Kopru } from "../bridge/kopru.ts";
import { OlayUretici } from "../world/olayUretici.ts";
import { GOVDE_ORTASI } from "./ajanlar/ajanAlgisi.ts";
import { ciktiFarki, kesildiMi } from "../world/surfaces/terminal/ciktiFarki.ts";
import { CiktiToplayici } from "../world/surfaces/terminal/ciktiToplayici.ts";
import { ozetle, type Algi } from "../protocol/algi.ts";
import { UZUN_ISLEM_MS, refleksGirdisi, type KuralRefleksi } from "../mind/refleks.ts";

/** Terminal örnekleme sıklığı: 20Hz'de her 8 tik = ~400 ms. */
const TERMINAL_TIK = 8;

export interface TerminalAlgisiGirdisi {
  monitor: Monitor;
  refleks: KuralRefleksi;
  oyuncu: Oyuncu;
  /** Sonradan atananlar: çağrı anında okunur. */
  orion: () => Avatar | null;
  kopru: () => Kopru | null;
}

export interface TerminalAlgisi {
  /** 20Hz mantık tikinden çağrılır (onay zaman aşımından sonra, benlik/inisiyatif bloğundan önce). */
  tikle(mantikTik: number, msSimdi: number): void;
}

export function terminalAlgisiKur(d: TerminalAlgisiGirdisi): TerminalAlgisi {
  const { monitor, refleks, oyuncu } = d;
  const olayUretici = new OlayUretici();
  const ciktiToplayici = new CiktiToplayici();
  let sonKuyruk = "";
  /**
   * Kabuk "komut bitti" dediğinde dolan çıkış kodu (OSC 133 ; D ; kod).
   * Sessizlik tahmini yerine GERÇEK sınır: komutun bittiğini kabuk söyler.
   */
  let bekleyenKod: number | null = null;
  let bekleyenSure: number | undefined;
  let komutBittiIsareti = false;
  /**
   * Kabuk entegrasyonu CANLI mı? İlk `D` işareti gelince true olur.
   *
   * Önemli: entegrasyon varken sessizlik zamanlayıcısı DEVRE DIŞI kalır.
   * Yoksa yarış oluşuyordu — 800 ms sessizlik, kabuğun "komut bitti"
   * işaretinden önce tamponu boşaltıyor ve çıkış kodu algıya hiç girmiyordu
   * (canlı koşuda gözlendi: bir koşuda kod geldi, diğerinde hiç gelmedi).
   * Zamanlayıcı zaten sınır sinyali YOKKEN kullanılan bir yedekti.
   */
  let kabukEntegrasyonu = false;
  /** Çıktısız ama uzun süren başarılı komut: algı üretilmeyi bekliyor. */
  let sessizBitisBekliyor = false;

  // Kabuk entegrasyonu (OSC 133): komut bitişi + çıkış kodu. Bu sinyal olmadan
  // "başarıyla bitti" bilgisi metinde GÖRÜNMEZ (tsc temiz geçince 0 satır yazar)
  // ve başarısızlık metinden TAHMİN edilmek zorunda kalır.
  monitor.isaretDinle((i) => {
    if (i.tur !== "bitti") return;
    // İlk `D` işareti entegrasyonun canlı olduğunu kanıtlar; bundan sonra
    // sınırı kabuk belirler, zamanlayıcı değil.
    if (!kabukEntegrasyonu) {
      kabukEntegrasyonu = true;
      console.log("[KABUK] entegrasyon canli — komut siniri artik kabuktan geliyor");
    }
    // Açılıştaki ilk istem de `D` yayar ama ortada komut yoktur; boş tamponu
    // raporlamak anlamsız. Kod yine de saklanır ki sonraki blok onu taşısın.
    bekleyenKod = i.kod ?? null;
    bekleyenSure = i.sureMs;
    if (ciktiToplayici.bekleyenSatir === 0) {
      // SESSİZ BAŞARI: çıktı yok ama komut çalıştı. `tsc --noEmit` temiz
      // geçtiğinde tam olarak budur — kod+süre olmadan bu bilgi GÖRÜNMEZDİ.
      // Yalnızca gerçekten beklenmiş işler için algı üretilir.
      sessizBitisBekliyor = i.sureMs !== undefined && i.sureMs >= UZUN_ISLEM_MS;
      return;
    }
    komutBittiIsareti = true;
    console.log(`[KABUK] komut bitti, kod=${i.kod ?? "yok"} sure=${i.sureMs ?? "?"}ms`);
  });

  return {
    tikle(mantikTik, msSimdi) {
      const orion = d.orion();
      const kopru = d.kopru();

      // Oyuncu durumunun (mesafe, "bana bakıyor") Orion'u nerede sandığı: bu bağ T1'den beri hiç kurulmamıştı, Orion hep SANDALYEDE sanılıyordu.
      // Olay üretici ve dünya satırı Orion yürüyünce yanlış mesafe görüyordu.
      if (orion) { const k = orion.durum().konum; oyuncu.orionKonumuAyarla({ x: k.x, y: k.y + GOVDE_ORTASI, z: k.z }); }

      // ── Dünya olayları: sürekli durumdan ayrık olaylar ──────────────────────
      if (orion && kopru) {
        for (const o of olayUretici.ornekle(msSimdi, orion.durum(), oyuncu.oyuncuDurumu())) {
          console.log(`[ALGI] olay: ${o.ad}${o.ayrinti ? " " + JSON.stringify(o.ayrinti) : ""}`);
          kopru.algi({ tur: "olay", ad: o.ad, ayrinti: o.ayrinti });
        }
      }

      // ── Terminal: Orion masasındaki ekrana göz atar ─────────────────────────
      // Akarken susar, akış durunca tek blok gönderir (ölçüm: mind/akis-olcum.ts,
      // parça başına karar 18 uyandırma → sessizlikte toplama 8, ideal 8).
      if (kopru && monitor.acikMi()) {
        // Kabuk "komut bitti" dediyse örnekleme sırasını BEKLEME: çıktı ekranda
        // hazır ama tamponda olmayabilir (örnekleme 400 ms'de bir). Bu yarış
        // canlı koşuda görüldü — işaret boş tampona düşüyor, blok 8 sn'lik
        // güvenlik frenine kalıyor ve Orion geç kalıyordu.
        if (mantikTik % TERMINAL_TIK === 0 || komutBittiIsareti || bekleyenKod !== null) {
          const kuyruk = monitor.kuyruk(24);
          const fark = ciktiFarki(sonKuyruk, kuyruk);
          sonKuyruk = kuyruk;
          if (fark) ciktiToplayici.ekle(fark, msSimdi);
          // İşaret boş tampona düşmüştü ama örnekleme şimdi içerik getirdiyse,
          // bu bloğu o komutun kodu ile raporla.
          if (bekleyenKod !== null && ciktiToplayici.bekleyenSatir > 0) komutBittiIsareti = true;
        }
        // Kabuk komutun bittiğini bildirdiyse sessizlik penceresini BEKLEME:
        // gerçek sınır bu. Tahmini zamanlayıcı yalnızca entegrasyon yoksa çalışır.
        // Entegrasyon canlıysa YALNIZCA kabuk işaretiyle boşalt (azami bekleyiş
        // güvenlik freni hâlâ geçerli: hiç bitmeyen bir süreç Orion'u kör bırakmaz).
        const blok = komutBittiIsareti
          ? ciktiToplayici.zorlaTopla()
          : kabukEntegrasyonu
            ? ciktiToplayici.azamiBekleyistenTopla(msSimdi)
            : ciktiToplayici.topla(msSimdi);
        if (komutBittiIsareti) komutBittiIsareti = false;

        // Sessiz başarı: blok yok ama haber var.
        if (sessizBitisBekliyor && !blok) {
          sessizBitisBekliyor = false;
          const sure = bekleyenSure;
          const kodu = bekleyenKod ?? undefined;
          bekleyenKod = null; bekleyenSure = undefined;
          console.log(`[KABUK] sessiz basari: kod=${kodu ?? "?"} sure=${sure ?? "?"}ms`);
          kopru.algi({ tur: "terminal", kuyruk: "(komut çıktı üretmedi)", kesildi: false, kod: kodu, sureMs: sure });
        }

        if (blok) {
          const kod = bekleyenKod ?? undefined;
          const sure = bekleyenSure;
          bekleyenKod = null;
          bekleyenSure = undefined;
          sessizBitisBekliyor = false;

          // Günlük ve görü kancası köprünün süzgeciyle AYNI kararı görür: beyne
          // giden algının kendisi, köprünün özeti (`ozetle`) ve tek kaynaklı girdi
          // (`refleksGirdisi`). Eskiden burada elle kurulan girdi süreyi taşıyor,
          // köprününki taşımıyordu: `kod_uzun` canlıda ölüydü ama `sessizdene` bu
          // kopyayı ölçtüğü için "geçti" diyordu (karar kaydı, 2026-09-27).
          const algi: Algi = { tur: "terminal", kuyruk: blok, kesildi: kesildiMi(blok), kod, sureMs: sure };
          const gecti = refleks.karar(refleksGirdisi(algi, ozetle(algi)));
          console.log(`[ALGI] terminal blok (${blok.split("\n").length} satir) -> terfi=${gecti.terfi} (${gecti.gerekce})`);
          const kanca = window._goruKanca;
          if (kanca) kanca(blok, gecti.terfi);
          kopru.algi(algi);
        }
      }
    },
  };
}
