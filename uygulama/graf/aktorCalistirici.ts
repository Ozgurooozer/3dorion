// uygulama/graf/aktorCalistirici.ts — AKTÖR GRAFI ▶ / ■ (spec 43 A3): bir aktörün Details'inde seçilen grafı O AKTÖRÜN bağlamıyla (`@bu`) çalıştırır. SAF: DOM yok.
//
// Kurallar (Graf sekmesinin tek-çalışma kuralının aktöre uyarlaması):
//   • Aktör başına en çok 1 çalışma (aynı aktörü iki program aynı anda sürmesin; ■ hangisini kesecek belli olsun).
//   • Toplam en çok `AKTOR_CALISMA_TAVANI` (4) eşzamanlı çalışma (kullanıcı ışıkların hepsinde ▶ basıp sahneyi kilitlemesin; aşılırsa nedenle reddedilir).
//   • Çalıştırılan ▶ ANINDAKİ grafın kopyasıdır (çalışırken kaydetmek süren çalışmayı değiştirmez).
//   • Çalışma BİTİNCE (bitti/durdu/hata) aktörün geçici yazmaları geri alınır (`geriAl`): graf ışığı kıstıysa durdurulunca/hata olunca ışık eski hâline döner.
//   • ÇALIŞTIRMA YALNIZ OZYN'İN TUŞUYLA: `calistir` yalnız Details'teki ▶ tıklamasından (`isTrusted`) çağrılır; Orion'un araç yüzeyinde böyle bir yol yoktur
//     (bekçi: aktorCalistirici.test.ts "▶ tek yerden").
"use strict";
import type { Graf } from "../../protocol/graf.ts";
import { calismaBaslat, sonucSatiri, type CalismaTabani, type HataAyiklamaAyari, type SonCalisma, type SuankiDugum } from "./grafCalistirici.ts";
import type { Calisma } from "./yorumlayici.ts";

export const AKTOR_CALISMA_TAVANI = 4;

export interface AktorCalismaDurumu { graf: string; baslangic: number; suan: SuankiDugum | null }

export interface AktorCalistiriciAyari<Y> extends HataAyiklamaAyari {
  tabani: CalismaTabani<Y>;
  /** Çalışma bitince aktörün geçici yazmalarını geri alır (aktör yeteneğinin `geriAl`ı). */
  geriAl: (aktor: string) => void;
  /** Aktör level'da var mı (yoksa ▶ nedenle reddedilir). */
  var: (aktor: string) => boolean;
  /** Toplam eşzamanlı çalışma tavanı (varsayılan 4). */
  tavan?: number;
}

export interface AktorCalistirici {
  /** ▶ (yalnız Ozyn'in tıklaması). Başlamadıysa nedeni. */
  calistir(aktor: string, graf: string): { ok: true } | { ok: false; neden: string };
  /** ■: aktörün süren çalışmasını durdurur; yoksa false. */
  durdur(aktor: string): boolean;
  /** Hepsini durdurur (■ düğmesi; level değişiminde henüz çağrılmaz, bkz. defter R15); durdurulan sayısı. */
  durdurHepsi(): number;
  calisiyor(aktor: string): AktorCalismaDurumu | null;
  /** Aktörün son çalışmasının sonucu (hata ayıklama: Details'te son satır). */
  son(aktor: string): SonCalisma | null;
  sayi(): number;
  dinle(f: () => void): () => void;
  /** Süren bütün çalışmalar bitene dek (yoksa hemen). Testler ve kapanış için. */
  bitti(): Promise<void>;
}

export function aktorCalistiriciKur<Y>(a: AktorCalistiriciAyari<Y>): AktorCalistirici {
  const simdi = a.tabani.simdi ?? (() => Date.now());
  const tavan = a.tavan ?? AKTOR_CALISMA_TAVANI;
  const calisanlar = new Map<string, { durum: AktorCalismaDurumu; calisma: Calisma; bitis: Promise<void> }>();
  const sonlar = new Map<string, SonCalisma>();
  const dinleyiciler = new Set<() => void>();
  const yay = (): void => {
    for (const f of [...dinleyiciler]) { try { f(); } catch (err) { console.error("[aktor] çalıştırıcı dinleyicisi hatası:", err); } }
  };

  return {
    calistir(aktor, ad) {
      if (!a.var(aktor)) return { ok: false, neden: `aktör '${aktor}' level'da yok` };
      if (calisanlar.has(aktor)) return { ok: false, neden: `'${aktor}' zaten '${calisanlar.get(aktor)!.durum.graf}' çalıştırıyor (önce ■ Durdur)` };
      const kaynak = a.tabani.depo.al(ad);
      if (!kaynak) return { ok: false, neden: `'${ad}' yüklenemedi ya da bozuk (Graf sekmesinde Kontrol et)` };
      if (kaynak.tur !== "olay") return { ok: false, neden: `'${ad}' bir desen: tek başına çalışmaz` };
      if (calisanlar.size >= tavan) return { ok: false, neden: `en çok ${tavan} aktör grafı aynı anda çalışır (şu an ${[...calisanlar.keys()].join(", ")}; birini ■ ile durdur)` };
      const g: Graf = structuredClone(kaynak);
      const durum: AktorCalismaDurumu = { graf: g.ad, baslangic: simdi(), suan: null };
      a.tabani.gunluk?.("bilgi", `▶ ${g.ad} · aktör ${aktor}`);
      const b = calismaBaslat(g, a.tabani, {
        aktor, kaynak: `aktör ${aktor}`,
        ...(a.ayiklayici ? { ayiklayici: a.ayiklayici } : {}), ...(a.gunlukDefteri ? { gunlukDefteri: a.gunlukDefteri } : {}),
        suan: (d) => { durum.suan = d; yay(); },
      });
      const bitis = b.bitis.then((sonuc) => {
        calisanlar.delete(aktor);
        // Geri alma ÖNCE: dinleyici (Details yeniden çizimi) aktörü çalışma öncesi hâlde görsün.
        try { a.geriAl(aktor); } catch (err) { console.error("[aktor] geri alma hatası:", err); }
        sonlar.set(aktor, sonuc);
        a.tabani.gunluk?.(sonuc.durum === "bitti" ? "iyi" : sonuc.durum === "durdu" ? "uyari" : "hata", `${sonucSatiri(sonuc)} · aktör ${aktor}`);
        yay();
      });
      calisanlar.set(aktor, { durum, calisma: b.calisma, bitis });
      yay();
      return { ok: true };
    },
    durdur(aktor) {
      const c = calisanlar.get(aktor);
      if (!c) return false;
      c.calisma.durdur();
      return true;
    },
    durdurHepsi() {
      let n = 0;
      for (const c of calisanlar.values()) { c.calisma.durdur(); n++; }
      return n;
    },
    calisiyor: (aktor) => calisanlar.get(aktor)?.durum ?? null,
    son: (aktor) => sonlar.get(aktor) ?? null,
    sayi: () => calisanlar.size,
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    bitti: async () => { await Promise.all([...calisanlar.values()].map((c) => c.bitis)); },
  };
}
