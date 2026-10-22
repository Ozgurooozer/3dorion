// uygulama/yapi/sekans/kurulum.ts — SEKANS SİSTEMİNİN KURULUMU (spec 36): depo, örnekler, oynatıcı, JSON penceresi, editör, Yapı çubuğu sekmesi ve
// `sekansdene` senaryosunun yüzü. Kompozisyon kökü (`uygulama/giris.ts`) bunu TEK çağrıyla kurar (kablo orada kısa kalsın).
//
// BEDENE BAĞLANTI: bedenler (Orion, Flash) klip bulucusu olarak `katman`ı alır (giris.ts: kütüphane + geçici sekans klipleri). Oynatıcı ajanlara
// grafiğin kullandığı AYNI kapıdan (`kapi`: Orion `niyetiYurut`, Flash kendi bedeni) klipli `jest` niyeti verir — ikinci eylem yolu yok.
// SENARYO YÜZÜ: `sekansdene` (yalnız `?sekansdene=1` URL'siyle yüklenen senaryo) örnekleri gerçek oynatıcıyla oynatır. Yüz HER ZAMAN kurulur ama
// `senaryoKosusu` değilse oynatmayı NEDENLE reddeder (bekçi: sekansBekci.test.ts — buradaki `sekansiOynat(` çağrısından önce bu denetim olmalı).
// Senaryo bağlamı yalnız dinamik yüklenen senaryo modüllerine verilir (window'da değil).
"use strict";
import type { Sekme } from "../../../world/arayuz/altCubuk.ts";
import { editorPenceresiKur, type EditorPenceresi } from "../../../world/arayuz/editorPenceresi.ts";
import type { Sekans } from "../../../protocol/sekans.ts";
import type { KlipBulucu } from "../../../world/avatar/index.ts";
import type { GeciciKlipKatmani } from "../../sekans/geciciKlipler.ts";
import { sekansOynaticiKur, type OynatmaDurumu, type OynatmaIstegi, type SekansKapisi, type SekansOynatici } from "../../sekans/oynatici.ts";
import { sekansDeposuKur, sekansKaynaginiSec, type SekansDeposu } from "../../sekans/sekansDeposu.ts";
import { ornekKutuphanesiKur, ornekleriYukle } from "../../sekans/ornekler.ts";
import { sekansEditoruKur, type SekansEditoru } from "./sekansEditoru.ts";
import { bosAd, sekansSekmesi } from "./sekansSekmesi.ts";

export interface SekansKurulumAyari {
  /** Klip KÜTÜPHANESİ (bölüm adları/süreleri; geçici klipler değil). */
  klipler: KlipBulucu;
  /** Bedenlerin klip bulucusu (kütüphane + geçici sekans klipleri). */
  katman: GeciciKlipKatmani;
  kapi(id: string): SekansKapisi | null;
  ajanlar(): readonly string[];
  /** Varlık okuma (`fetch(varlik(yol))`): örnekler `sekans/liste.json`. */
  oku(yol: string): Promise<string>;
  altyazi(metin: string, ms?: number): void;
  izin(): boolean;
  gorunurlukDegisti(acik: boolean): void;
  gunluk(seviye: "bilgi" | "iyi" | "uyari" | "hata", metin: string): void;
  /** Bu koşu `sekansdene` senaryosu mu (URL). Değilse senaryo yüzü oynatmayı reddeder. */
  senaryoKosusu: boolean;
  /** Yapı çubuğunda bir sekmeyi aç (senaryo: Sekans sekmesinin karesi). */
  sekmeAc(id: string): boolean;
}

export interface SekansSenaryoYuzu {
  /** Depo ve örnekler yüklenince çözülür. */
  hazir(): Promise<void>;
  ornekler(): readonly Sekans[];
  oynat(s: Sekans, istek: OynatmaIstegi): { ok: true } | { ok: false; neden: string };
  durdur(): void;
  durum(): OynatmaDurumu;
  /** Yapı çubuğunda Sekans sekmesini aç. */
  sekmeAc(): boolean;
  /** Örneğin kopyasını (senaryo koşusunda geçici klasöre) alıp editörde açar; açılan sekansın adı ya da null. */
  ornegiAc(ad: string): Promise<string | null>;
  readonly editor: SekansEditoru;
}

export interface SekansSistemi {
  sekme: Sekme;
  pencere: EditorPenceresi;
  editor: SekansEditoru;
  oynatici: SekansOynatici;
  depo: SekansDeposu;
  senaryo: SekansSenaryoYuzu;
}

export function sekansKur(a: SekansKurulumAyari): SekansSistemi {
  const kaynak = sekansKaynaginiSec();
  let depoHata: string | null = kaynak.hata;
  const depo = sekansDeposuKur(kaynak.kaynak);
  const ornekler = ornekKutuphanesiKur();
  const oynatici = sekansOynaticiKur({ katman: a.katman, kapi: a.kapi, ajanlar: a.ajanlar, gunluk: (s, m) => { a.gunluk(s, m); console.log(`[SEKANS] ${m}`); } });
  const pencere = editorPenceresiKur({
    kaynak: { oku: (ad) => depo.oku(ad), yaz: (ad, metin) => depo.yaz(ad, metin) },
    bilgi: (ad) => { const k = depo.liste().find((x) => x.ad === ad); return !k ? null : k.hata ? `✗ ${k.hata}` : `sekans · ${k.ajanlar.join(", ")} · ▶ editörde`; },
    not: () => "Sekans (JSON): bağlamalar, izler (uzuv: anahtarlar · klip: bölümler), kare = 1/30 sn. Ctrl+S biçimi doğrular (bozuksa kaydetmez).",
    degistiNotu: "kaydedildi (biçim doğrulandı, okunur biçime çevrildi)",
    altyazi: a.altyazi,
  });
  depo.dinle((o) => { if (o.tur === "icerik") void pencere.icerikDegisti(o.ad); pencere.tazele(); });
  const metinAc = (ad: string) => { pencere.ac(ad).catch((e: unknown) => a.altyazi(`${ad} açılamadı: ${e instanceof Error ? e.message : String(e)}`, 4000)); };
  const editor = sekansEditoruKur({ depo, oynatici, klipler: a.klipler, ajanlar: a.ajanlar, metinAc, altyazi: a.altyazi, izin: a.izin, gorunurlukDegisti: a.gorunurlukDegisti });
  const sekme = sekansSekmesi({ depo, ornekler, oynatici, editor, ajanlar: a.ajanlar, metinAc, hata: () => depoHata, bildir: a.altyazi });

  const yuklendi = Promise.all([
    depo.baslat().then(() => console.log(`[SEKANS] ${depo.liste().length} sekans`), (e: unknown) => { depoHata = e instanceof Error ? e.message : String(e); console.error("[SEKANS] yüklenemedi:", depoHata); }),
    ornekleriYukle(a.oku).then((r) => {
      ornekler.doldur(r.ornekler, r.hatalar);
      console.log(`[SEKANS] ${r.ornekler.length} örnek: ${r.ornekler.map((s) => s.ad).join(", ")}`);
      for (const h of r.hatalar) { console.warn(`[SEKANS] örnek ${h.dosya}: ${h.neden}`); a.gunluk("uyari", `sekans örneği ${h.dosya}: ${h.neden}`); }
    }),
  ]).then(() => undefined);

  const senaryo: SekansSenaryoYuzu = {
    hazir: () => yuklendi,
    ornekler: () => ornekler.liste(),
    oynat(s, istek) {
      // Yalnız `?sekansdene=1` koşusunda: üretimde oynatmak editörün ▶'si (gerçek tık).
      if (!a.senaryoKosusu) return { ok: false, neden: "senaryo yüzü yalnız sekansdene koşusunda oynatır" };
      return oynatici.sekansiOynat(s, istek);
    },
    durdur: () => oynatici.durdur(),
    durum: () => oynatici.durum(),
    sekmeAc: () => a.sekmeAc("sekans"),
    async ornegiAc(ad) {
      const s = ornekler.al(ad);
      if (!s) return null;
      const yeni = bosAd((x) => depo.liste().some((k) => k.ad === x), s.ad);
      await depo.yeni({ ...structuredClone(s), ad: yeni });
      return editor.ac(yeni) ? yeni : null;
    },
    editor,
  };
  return { sekme, pencere, editor, oynatici, depo, senaryo };
}
