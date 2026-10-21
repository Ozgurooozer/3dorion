// uygulama/ajanlar/girdiAdaptoru.ts — TEK GİRDİ, ÇOK AJAN (spec 33). SAF: DOM ve köprü yok; defter ve seçim dışarıdan gelir.
//
// Ozyn'in sözü iki yerden doğar (sohbet kutusu, mikrofon) ama TEK yerden girer: `giris.ts`teki `sozAlindi` → `ilet`. Burada söz bir
// `duydum` algısına çevrilir ve hedef seçimine (Orion | Flash | ikisi; ileride küme) göre ajanlara dağılır. Ajanların her biri kendi
// kapısından geçer: komut sözlüğü, takip, sohbet kipi, LLM ya da "bilmiyorum". Adaptör karar VERMEZ, yalnız dağıtır.
//
// Orion'un bugünkü davranışı DEĞİŞMEZ: varsayılan hedef "orion", algı nesnesi eskiden `kopru.algi`ya giden nesnenin aynısı.
// Bir ajanın hatası öbürünü kesmez (ikisi birden konuşulurken Flash çökerse Orion yine duyar).
"use strict";
import type { Algi } from "../../protocol/algi.ts";
import { katla } from "../../protocol/temel.ts";
import { hedefCoz, type AjanKaydi, type HedefSecimi } from "./ajanKaydi.ts";

export interface GirdiAdaptoruAyari {
  /** Kayıtlı ajanlar (çağrı ANINDA okunur: Flash sonradan kaydolur). */
  ajanlar: () => readonly AjanKaydi[];
  /** O anki hedef seçimi (sohbet hedef çipleri). */
  hedef: () => HedefSecimi;
}

export interface GirdiAdaptoru {
  /**
   * Şu an sözü alacak ajanlar (iletmeden). Altyazı ÖNCE yazılsın diye ayrı: köprü takip/sohbet onayını `ilet` içinde EŞZAMANLI söyler
   * ("Peşindeyim."); "sen: …" satırı ondan sonra yazılırsa ajanın cevabını ezerdi (eskiden de sıra buydu: önce altyazı, sonra algı).
   */
  hedefler(): AjanKaydi[];
  /** Ozyn'in kesin sözünü hedef ajanlara iletir. Sözü ALAN ajanlar döner (boşsa kimse duymadı: çağıran söyler). */
  ilet(metin: string, kaynak: "klavye" | "mikrofon"): AjanKaydi[];
}

/**
 * Sözün başındaki ajan adını ayıklar: "Flash otur" → "otur", "flash, otur" → "otur". Yalnız BAŞTAKİ ad ve ardından gelen söz varsa
 * (tek başına "Flash" olduğu gibi kalır: ajan "bilmiyorum" der); ortadaki ad ("otur flash") dokunulmaz. Katlama Türkçe-duyarsızdır (Flash/FLASH).
 */
export function hitapAyikla(metin: string, ad: string): string {
  const m = /^\s*([^\s,:;!?]+)\s*[,:;]?\s+(\S[\s\S]*)$/u.exec(metin);
  return m && katla(m[1]!) === katla(ad) ? m[2]!.trim() : metin;
}

export function girdiAdaptoruKur(a: GirdiAdaptoruAyari): GirdiAdaptoru {
  return {
    hedefler: () => hedefCoz(a.ajanlar(), a.hedef()),
    ilet(metin, kaynak) {
      const hedefler = hedefCoz(a.ajanlar(), a.hedef());
      const alanlar: AjanKaydi[] = [];
      for (const ajan of hedefler) {
        // Her ajana AYRI nesne: bir ajanın algıyı değiştirmesi (yapmamalı ama) öbürüne sızmasın.
        const algi: Algi = { tur: "duydum", metin: ajan.hitapAyiklar ? hitapAyikla(metin, ajan.ad) : metin, kesin: true, kaynak };
        try { ajan.algi(algi); alanlar.push(ajan); }
        catch (err) { console.error(`[AJAN] ${ajan.id} sözü alamadı:`, err); }
      }
      return alanlar;
    },
  };
}
