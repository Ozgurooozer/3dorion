// uygulama/graf/grafYetenegi.ts — GRAFİĞİN DÜNYAYA TEK KAPISI (spec 35 dilim 1). SAF: DOM, Babylon, köprü yok; kompozisyon kökü (giris.ts) bağlar.
//
// Ajan düğümleri dünyaya YALNIZ bu dar arayüzden dokunur: ajan listesi, bir ajana niyet yürütüp sonucunu beklemek, Ozyn'in yerindeki nesneler ve çapalar,
// ve (dilim 2) Ozyn'e seçimli diyalog açmak.
// Burada olmayan şey grafikten yapılamaz (sınır budur): terminal/komut, hafıza (`hatirla`), doktor, ortam, tahta (`yaz`), güvenlik/onay ayarları, protokol,
// level DOSYASI yoktur.
//
// TEK EYLEM YOLU KORUNUR: niyet ajanın KENDİ kapısından geçer (Orion: `niyetiYurut` — yakınlık kuralı, şema, kısaltma aynı yerde; Flash: `AjanKaydi.niyet`
// = kendi bedeni). Sonuç bedenin `sonucDinle`sinden okunur; bekleme `avatarAdimi`nın aynısıdır (kopya yok: dinleyici GÖNDERMEDEN önce kurulur, zaman
// aşımı var). Kimlik öneki `elle`: grafiği Ozyn'in ▶'si yürütür; hatası Orion'un LLM'ini uyandırmaz ve kayıtta "Ozyn yaptı" diye geçer.
//
// `soyle` bir beden niyeti DEĞİLDİR (avatar onu "ses hattının işi" diye reddeder; Orion'un `niyetiYurut`u onu sessizce bırakır çünkü köprü konuşmayı zaten
// TTS'e vermiştir). Grafiğin "Söyle"si bu yüzden ajanın SÖZ hattına gider (`AjanKapisi.soyle`: Orion'da altyazı + Piper, Flash'ta altyazı) — yine kapının arkasında.
//
// ■ DURDUR: düğüm sonucu `bekleVeyaDur` ile bekler; ■ beklemeyi keser ve `kes()` dünyadaki işi durdurur: beden niyetinde ajana AYNI kapıdan `dur` gider
// (yürüyüş `iptal` olur), sözde ses susturulur. Karar: `dur` her ■'de gönderilir, iş bitmiş olsa bile — `dur` zararsızdır (boştaki bedeni durdurur) ve
// "bitti mi" sorusu yarış doğurur (sonuç aynı tikte gelebilir).
"use strict";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import { kimlik } from "../../protocol/temel.ts";
import type { Capa } from "../../world/level/capalar.ts";
import type { Nesne } from "../../world/level/nesneKaydi.ts";
import { avatarAdimi } from "../niyetYurutucu.ts";
import type { DiyalogIsi, DiyalogIstegi } from "./diyalogDenetimi.ts";

/** Grafiğin ajan niyetlerinin kimlik öneki: Ozyn'in eli (bkz. `mind/refleks.ts` `refleks.sonuc.elle_hata`, `mind/benlik.ts` `eden`). */
export const GRAF_NIYET_ONEKI = "elle";
/**
 * Tek ajan adımının tavanı. Grafiğin toplam tavanı 120 sn (yorumlayıcı) ama o yalnız düğüm BAŞLARKEN bakılır; bozuk ya da sıkışmış bir beden grafiği
 * orada asmasın diye her adımın kendi tavanı var. 60 sn: ova'da uzun bir yürüyüşe yeter (Orion'un program adımı 30 sn, oda ölçeğinde). Ölçülmedi.
 */
export const GRAF_ADIM_SINIRI_MS = 60_000;

/** Sözün okunma süresi (ms): ses yokken (Flash; Piper kurulu değil) sonraki düğüm sözü EZMESİN diye beklenir. Kaba kestirim, ölçülmedi. */
export function okumaSuresiMs(metin: string): number {
  return Math.min(8000, Math.max(1500, metin.length * 60));
}

/** Bir ajanın grafiğe açtığı kapı (bedeni olan ajan). */
export interface AjanKapisi {
  readonly id: string;
  readonly ad: string;
  /** Ajanın TEK eylem yolu (Orion: `niyetiYurut`; Flash: kendi beden kapısı). */
  niyet(n: Niyet, id: string): void;
  /** Bedenin niyet sonuçları. */
  sonucDinle(cb: (s: NiyetSonucu) => void): () => void;
  /** Söz hattı: söylenince (çalınınca/okununca) çözülür; söyleyemezse fırlatır. */
  soyle(metin: string): Promise<void>;
  /** Sözü kes (■). Verilmezse söz kesilmez (altyazı kendi süresinde gider). */
  sus?(): void;
}

export interface AjanSecenegi { readonly id: string; readonly ad: string }

/** Başlamış bir ajan işi: sonucu ve ■ için kesici. */
export interface AjanIsi {
  readonly sonuc: Promise<NiyetSonucu>;
  kes(): void;
}

/** Düğümlerin gördüğü dünya (dar). */
export interface GrafYetenegi {
  /** Ajan defterindeki ajanlar (Ajan seç seçenekleri). */
  ajanlar(): readonly AjanSecenegi[];
  /** Niyeti `kim`in kapısından yürütür. Hiç fırlatmaz: bilinmeyen/bedensiz ajan `hata` sonucu olur (nedeniyle). */
  niyetYurut(kim: string, n: Niyet): AjanIsi;
  /** Ozyn'in bulunduğu yerin nesneleri (Nesne bul) ve çapaları (nesneye giden hedef: `nesneHedefleri`). */
  nesneler(): readonly Nesne[];
  capalar(): readonly Capa[];
  /**
   * Seçimli diyalog (dilim 2): ajan Ozyn'e sorar, Ozyn seçer. Ekranda başka diyalog varsa ya da bu dünyada diyalog arayüzü yoksa FIRLATIR (nedenle).
   * Ozyn'in seçimi bir NİYET değildir (bedene gitmez): grafiğin hangi dalı yürüyeceğini söyler.
   */
  diyalogAc(i: DiyalogIstegi): DiyalogIsi;
}

export interface GrafYetenegiAyari {
  ajanlar(): readonly AjanSecenegi[];
  /** Ajanın kapısı; bedeni yoksa/henüz kurulmadıysa null. Çağrı ANINDA okunur (Orion'un bedeni ve Flash sonradan gelir). */
  kapi(id: string): AjanKapisi | null;
  nesneler(): readonly Nesne[];
  capalar(): readonly Capa[];
  /** Tek adımın tavanı (ms); varsayılan `GRAF_ADIM_SINIRI_MS`. */
  adimSiniriMs?: number;
  /** Diyalog ekranı (diyalogDenetimi.ts); verilmezse diyalog düğümü nedenle düşer (senaryo/test dünyası). */
  diyalog?: (i: DiyalogIstegi) => DiyalogIsi;
}

const hemen = (niyet_id: string, not: string): AjanIsi => ({ sonuc: Promise.resolve({ niyet_id, durum: "hata", not }), kes: () => {} });

export function grafYetenegiKur(a: GrafYetenegiAyari): GrafYetenegi {
  const sinir = a.adimSiniriMs ?? GRAF_ADIM_SINIRI_MS;
  return {
    ajanlar: () => a.ajanlar(),
    nesneler: () => a.nesneler(),
    capalar: () => a.capalar(),
    diyalogAc(i) {
      if (!a.diyalog) throw new Error("bu dünyada diyalog ekranı yok (seçimli diyalog gösterilemez)");
      return a.diyalog(i);
    },
    niyetYurut(kim, n) {
      const kapi = a.kapi(kim);
      if (!kapi) {
        const var_ = a.ajanlar().some((x) => x.id === kim);
        return hemen(kimlik(GRAF_NIYET_ONEKI), var_ ? `${kim}: bedeni hazır değil (henüz yüklenmedi ya da bedensiz ajan)` : `bilinmeyen ajan: '${kim}'`);
      }
      if (n.tur === "soyle") {
        const id = kimlik(GRAF_NIYET_ONEKI);
        const sonuc = kapi.soyle(n.metin).then(
          (): NiyetSonucu => ({ niyet_id: id, durum: "bitti" }),
          (err: unknown): NiyetSonucu => ({ niyet_id: id, durum: "hata", not: `${kapi.ad} söyleyemedi: ${err instanceof Error ? err.message : String(err)}` }));
        return { sonuc, kes: () => kapi.sus?.() };
      }
      // Bekleme `avatarAdimi`nın aynısı: kapı (niyet + sonucDinle) bir beden gibi davranır. Zaman aşımı BURADA (avatarAdimi'nınkinin iki katı tavanla
      // yedekte): aşılınca beden de durdurulur — yoksa grafik "zaman aşımı" derken Flash yürümeye devam ederdi; `dur`un `iptal`i avatarAdimi'nın
      // dinleyicisini de kapatır.
      const kes = (): void => kapi.niyet({ tur: "dur" }, kimlik(GRAF_NIYET_ONEKI));
      const is = avatarAdimi({ niyet: (x, id) => kapi.niyet(x, id), sonucDinle: (cb) => kapi.sonucDinle(cb) }, n, sinir * 2, GRAF_NIYET_ONEKI);
      let saat: ReturnType<typeof setTimeout> | undefined;
      const asim = new Promise<NiyetSonucu>((coz) => {
        saat = setTimeout(() => { kes(); coz({ niyet_id: kimlik(GRAF_NIYET_ONEKI), durum: "hata", not: `zaman aşımı (${Math.round(sinir / 1000)} sn): ${kapi.ad} durduruldu` }); }, sinir);
      });
      const sonuc = Promise.race([is, asim]).finally(() => clearTimeout(saat));
      return { sonuc, kes };
    },
  };
}
