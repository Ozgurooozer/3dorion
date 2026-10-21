// uygulama/ayar/orionAyarlari.ts — ORION'UN AYAR PANELİ (spec 34): çerçeveyi (`world/arayuz/ayarPaneli.ts`) kurar ve Orion'un bölümlerini sırayla ekler.
//
// Bölümler bağımsız modüllerdir (`uygulama/ayar/*Bolumu.ts`); bu dosya yalnız onlara dünyayı verir. Yeni ayar = yeni bölüm dosyası + burada bir `ekle`.
// Flash (spec 33) ya da başka bir ajan için aynı panel kullanılır: bölümü `ajanlar: ["flash"]` ile eklenir, panel `ac({ id: "flash", … })` ile açılır.
// Sonradan kurulan her şey (pano, M seçicinin kaynağı, Orion'un sesi) çağrı ANINDA okunur (giris.ts kurulum sırası sözleşmesi).
"use strict";
import { ayarPaneliKur, type AyarPaneli } from "../../world/arayuz/ayarPaneli.ts";
import type { ModelSeciciKaynagi } from "../../world/arayuz/modelSeciciCekirdek.ts";
import type { Pano } from "../../protocol/pano.ts";
import type { MdDeposu } from "../mdDeposu.ts";
import { beyinBolumu } from "./beyinBolumu.ts";
import { sesBolumu, sesKaynaginiSec } from "./sesBolumu.ts";
import { notlarBolumu } from "./notlarBolumu.ts";
import { reflekslerBolumu } from "./reflekslerBolumu.ts";
import { baglamBolumu } from "./baglamBolumu.ts";
import { kisayollarBolumu } from "./kisayollarBolumu.ts";

export interface OrionAyarlariGirdisi {
  bildir: (metin: string, ms?: number) => void;
  /** ✕/Esc: seçimi de bırak (panel = Orion seçiminin görünümü). */
  kapatildi: () => void;
  pano: () => Pano | null;
  modelKaynagi: () => ModelSeciciKaynagi | null;
  modelPenceresi: () => void;
  /** Orion'un sesiyle söylet (mevcut konuşma yolu). */
  soyle: (metin: string) => Promise<boolean>;
  md: { depo: MdDeposu; ac: (ad: string) => void; hata: () => string | null };
  /** Yapı çubuğunda sekme aç (imleç kipindeyiz: panel yalnız orada görünür). Açılamadıysa false. */
  sekmeAc: (id: "zihin" | "hafiza") => boolean;
  yetki: { beceri: boolean; benlikSuzgec: boolean };
  komut: () => boolean;
  hafiza: { esik: () => number; mdToplam: () => number };
}

export function orionAyarlariKur(g: OrionAyarlariGirdisi): AyarPaneli {
  const panel = ayarPaneliKur({ kapatildi: g.kapatildi, bildir: g.bildir });
  const sekme = (id: "zihin" | "hafiza", ad: string) => (): true | string => (g.sekmeAc(id) ? true : `${ad} sekmesi açılamadı`);
  panel.ekle(beyinBolumu({ kaynak: g.modelKaynagi, pencereAc: g.modelPenceresi }));
  panel.ekle(sesBolumu({ kaynak: sesKaynaginiSec(), dene: g.soyle }));
  panel.ekle(notlarBolumu({ depo: g.md.depo, ac: g.md.ac, hata: g.md.hata, sekmeAc: () => { g.sekmeAc("hafiza"); } }));
  panel.ekle(reflekslerBolumu({ pano: g.pano, yetki: g.yetki, komut: g.komut }));
  panel.ekle(baglamBolumu({ pano: g.pano, esik: g.hafiza.esik, mdToplam: g.hafiza.mdToplam }));
  panel.ekle(kisayollarBolumu([
    { ad: "🧠 Zihin sekmesi", ipucu: "Yapı çubuğu ▸ Zihin: şema ve devre panosu", calistir: sekme("zihin", "Zihin") },
    { ad: "📄 Hafıza sekmesi", ipucu: "Yapı çubuğu ▸ Hafıza: md dosyaları, yeni dosya", calistir: sekme("hafiza", "Hafıza") },
    { ad: "💭 Model seçici (M)", ipucu: "kartlar, API anahtarı", calistir: () => { g.modelPenceresi(); return true; } },
  ]));
  return panel;
}
