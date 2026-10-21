// flash/flashKur.ts — FLASH KÖPRÜSÜ: aynı `Kopru` sınıfı, beyin = `BeyinsizBeyin` (spec 33).
//
// KOPYA YOK (CLAUDE.md "kopya kod: kural değil bekçi"): Orion'un LLM'siz yolları (`mind/komutSozlugu.ts`, `mind/takipSozu.ts`,
// `mind/sohbetKipi.ts`, dikkat, eylem sırası, karar kaydı) bu klasöre taşınmaz; köprünün kendisi kullanılır. Flash'ı Orion'dan ayıran
// yalnız ayarlar:
//   • beyin modelsiz; hafıza diske gitmez (depo yok), getirme kapalı — NPC'nin uzun hafızası yok (bugün);
//   • KARAR KAYDI KONSOLA YAZILMAZ: köprünün varsayılan kaydı satırı `[KARAR] {json}` olarak konsola basar ve host onu ORION'UN
//     günlük dosyasına ekler (host/kararDosyasi.js). Flash'ın satırları oraya düşseydi Orion'un ölçümleri (kullanım defteri, beceri
//     defteri, komut-tara) Flash'ın sözleriyle kirlenirdi. Satırlar yalnız `kayitYaz`/`kararDinle` ile dışarı çıkar;
//   • ortam yetkisi yok (ova ışığı/stili Orion'un işi): ortam sözü sözlüğe takılmaz, "bilmiyorum"a düşer;
//   • niyetler NPC TANIMINA göre ayrılır (`niyetYonu`): bedenin yapabildiği bedene, konuşma ses hattına (köprü konuşmayı zaten
//     `konusmaDinle` ile verdi), geri kalanı (odaklan, komut, yaz…) açık bir "yapamam" hatasıyla köprüye döner — sessiz düşme yok,
//     Flash "Yapamadım: …" der.
"use strict";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";
import { Kopru } from "../bridge/kopru.ts";
import type { KopruAyari } from "../bridge/kopru.ts";
import { KararKaydi, type KararSatiri } from "../mind/kararKaydi.ts";
import { KuralRefleksi, refleksGirdisi } from "../mind/refleks.ts";
import { BeyinsizBeyin } from "./beyinsizBeyin.ts";
import type { NpcTanimi } from "./npcTanimi.ts";

/** Niyetin gideceği yer: beden, ses hattı (zaten konuşuldu) ya da NPC'nin yapamadığı. */
export type NiyetYonu = "beden" | "ses" | "yapamaz";

export function niyetYonu(tanim: NpcTanimi, n: Niyet): NiyetYonu {
  if (n.tur === "soyle") return "ses";
  return tanim.bedenNiyetleri.has(n.tur) ? "beden" : "yapamaz";
}

/** Yapamadığı niyetin hata notu (Flash bunu "Yapamadım: …" diye söyler). */
export function yapamazNotu(tanim: NpcTanimi, n: Niyet): string {
  return `${tanim.ad} bunu yapamaz (${n.tur}): bu bir NPC, yalnız yürür, oturur, bakar ve konuşur.`;
}

export interface FlashAyari {
  tanim: NpcTanimi;
  /** Bedenin niyet kapısı; beden yoksa (yüklenmedi) null → niyet hata sonucuyla döner. */
  beden: () => { niyet(n: Niyet, id: string): void } | null;
  simdi?: () => number;
  /** Anlık benlik için gövde okuması (köprü karar anında çeker). */
  bedenDurumu?: KopruAyari["bedenDurumu"];
  /** "Beni takip et" açıldı/kapandı (yürüyüşü dünya tarafı yapar). */
  takipDinle?: KopruAyari["takipDinle"];
  /** Karar kaydının ham satırı (önekli); verilmezse hiçbir yere yazılmaz. */
  kayitYaz?: (satir: string) => void;
  /** Her niyet ve yönü (şema, günlük için gözlem; hatası yutulur). */
  niyetDinle?: (n: Niyet, yon: NiyetYonu) => void;
  /**
   * Ozyn'in seçtiği nesne (Tab + sol tık, spec 28): "buraya otur", "buna bak". Verilmezse bu sözlere Flash "Hangisi? … seç" der ve seçimden
   * sonra da ANLAMAZ (ölçümde 1 gerçek söz: "buraya otur"). Menüdeki eylemler bedene özgü değil (niyet verisi), Flash'ın bedeni de aynı.
   */
  secili?: KopruAyari["secili"];
  /** Söz dışı algının (niyet hatası) toplanma penceresi, ms. Varsayılan 300: NPC hatayı Orion'dan (900) çabuk söyler; testler kısaltır. */
  toplamaMs?: number;
}

export interface Flash {
  kopru: Kopru;
  beyin: BeyinsizBeyin;
  kayit: KararKaydi;
  /** Karar satırlarını dinle (diske gidenin aynısı); çıkış fonksiyonu döner. */
  kararDinle(cb: (s: KararSatiri) => void): () => void;
}

export function flashKur(a: FlashAyari): Flash {
  const beyin = new BeyinsizBeyin(a.tanim);
  const kayit = new KararKaydi({ yaz: a.kayitYaz ?? (() => {}), ...(a.simdi ? { simdi: a.simdi } : {}) });
  // İçerik süzgeci Orion'unkiyle aynı kural seti (mind/refleks.ts): yalnız HATA sonucu terfi eder, rutin "bitti" beyni uyandırmaz.
  const refleks = new KuralRefleksi();
  let kopru: Kopru;
  const hataDon = (id: string, not: string): void => {
    const s: NiyetSonucu = { niyet_id: id, durum: "hata", not };
    // Mikro görev: köprü `niyetGonder`in içindeyken kendi `sonuc`una yeniden girmesin (eylem sırası adımı henüz kurmadı).
    queueMicrotask(() => kopru.sonuc(s));
  };
  kopru = new Kopru({
    beyin,
    kararKaydi: kayit,
    dunyaDurumu: () => "",
    hafizaGetirme: 0,
    komutYetkisi: true,
    toplamaMs: a.toplamaMs ?? 300,
    ...(a.simdi ? { simdi: a.simdi } : {}),
    ...(a.bedenDurumu ? { bedenDurumu: a.bedenDurumu } : {}),
    ...(a.takipDinle ? { takipDinle: a.takipDinle } : {}),
    ...(a.secili ? { secili: a.secili } : {}),
    suzgec: (algi, ozet) => {
      const k = refleks.karar(refleksGirdisi(algi, ozet));
      return { gecsin: k.terfi, kural: k.kural, gerekce: k.gerekce };
    },
    niyetGonder: (n, id) => {
      const yon = niyetYonu(a.tanim, n);
      try { a.niyetDinle?.(n, yon); } catch (err) { console.error("[FLASH] niyet dinleyicisi hatası:", err); }
      if (yon === "ses") return;
      if (yon === "yapamaz") { hataDon(id, yapamazNotu(a.tanim, n)); return; }
      const b = a.beden();
      if (!b) { hataDon(id, "bedenim henüz yüklenmedi"); return; }
      b.niyet(n, id);
    },
  });
  return { kopru, beyin, kayit, kararDinle: (cb) => kayit.dinle(cb) };
}
