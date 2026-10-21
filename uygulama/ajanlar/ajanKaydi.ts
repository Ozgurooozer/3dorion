// uygulama/ajanlar/ajanKaydi.ts — AJAN KAYDI ve HEDEF ÇÖZÜCÜ (spec 33). SAF: DOM, Babylon, köprü yok.
//
// AJAN ≠ BEDEN. Ajan, girdinin gidebileceği bir HEDEFTİR: kimliği, adı, rengi ve bir `algi` kapısı var. Bedeni olabilir de olmayabilir
// de (ileride 300 ajanın çoğu uzakta, soyut). Orion (LLM'li) ve Flash (LLM'siz NPC) bugün iki kayıt; ikisi de aynı imzayla algı alır,
// arkada kim düşünüyorsa (model ya da kural) kayıt bilmez.
//
// NEDEN BİR KAYIT DEFTERİ: Ozyn'in sözü tek yerden girer (sohbet kutusu + mikrofon → `girdiAdaptoru.ts`) ve hedef seçimine göre bir ya da
// birden çok ajana dağılır. Hedefi `if (secim === "flash") … else …` dallarıyla çözmek her yeni ajanda girdi yolunu yeniden yazdırırdı;
// defter + çözücü ile yeni ajan = bir `kaydet`.
//
// KÜME (`kume`): ileride "kategori → departman → ajan" çağırma için YER TUTUCU. Bugün hiçbir ajanın kümesi yok (null) ve arayüzde küme
// seçimi YOK (YAGNI, plan dilim 6). Tip ve çözücü şimdiden küme seçimini anlıyor ki ilk küme geldiğinde girdi yolu değişmesin.
"use strict";
import type { Algi } from "../../protocol/algi.ts";
import type { AjanGovdesi } from "../graf/grafYetenegi.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";

/** Ayrılmış hedef: kayıtlı bütün ajanlar ("ikisi birden"). Bir ajanın kimliği olamaz. */
export const HEPSI = "hepsi";

/** Orion'un ajan kimliği (TEK kaynak: kayıt, çipler, zihin sayfası). Renk: şemanın "bulut" vurgusuna yakın camgöbeği. */
export const ORION_AJANI = { id: "orion", ad: "Orion", renk: "#4fd8ff" } as const;

export interface AjanKaydi {
  /** Tekil kimlik ("orion", "flash"). `HEPSI` olamaz. */
  readonly id: string;
  /** Görünen ad (çip, altyazı). */
  readonly ad: string;
  /** Çip ve bedenin rengi (#rrggbb). */
  readonly renk: string;
  /** Kategori/departman yolu ("destek/kasa" gibi); bugün hep null — yer tutucu. */
  readonly kume: string | null;
  /**
   * Söz ajanın ADIYLA başlıyorsa ("Flash otur", "Flash, otur") ad sözden ayıklanır. Verilmezse söz olduğu gibi gider. NEDEN isteğe bağlı: Orion'un
   * LLM'i sözün tamamını görür ("Orion, nasılsın?" Orion'a hitaptır, metni değişmemeli); kural tabanlı NPC'nin sözlüğü ise yalnız komutu tanır
   * ve hitabı bilmez ("Flash otur" → "bilmiyorum").
   */
  readonly hitapAyiklar?: boolean;
  /**
   * Ajanın bedeni varsa ona NİYET verir (menüden "Flash ▸ Buraya git": hedefi koordinat olan komut sözle söylenemez). Bedensiz ajanda yok.
   * Niyet ajanın KENDİ beden kapısından geçer; sonucu ajanın kendi köprüsüne döner.
   */
  readonly niyet?: (n: Niyet, id: string) => void;
  /**
   * Bedenin niyet sonuçları (`niyet` ile gönderilenlerin `bitti`/`hata`/`iptal`i). Düğüm grafiği (spec 35) eylemin SONUCUNU bekler: bu olmadan
   * "Git" yürüyüş bitmeden "bitti" sayılırdı. Bedensiz ajanda yok.
   */
  readonly sonucDinle?: (cb: (s: NiyetSonucu) => void) => () => void;
  /**
   * Ajanın SÖZ hattı (altyazı; varsa ses): söylenince çözülür. `soyle` bir beden niyeti değildir (avatar reddeder); grafiğin "Söyle"si buradan geçer.
   * Verilmezse ajan grafikten konuşturulamaz (nedenli hata).
   */
  readonly soyle?: (metin: string) => Promise<void>;
  /** Gövdenin anlık durumu (düğüm grafiğinin Dünya değişkenleri okur: konum, meşgul, oturuyor). Bedensiz ajanda yok. */
  readonly govde?: () => AjanGovdesi | null;
  /** Ajanın algı kapısı: söz (ve ileride başka algılar) buradan girer. Hatası öbür ajanları kesmez (adaptör yakalar). */
  algi(a: Algi): void;
}

/**
 * Girdinin hedefi: bir ajan kimliği, `HEPSI`, ya da bir küme (yer tutucu: `{ kume: "destek" }` o kümedeki ve alt kümelerindeki ajanlar).
 * Dizgi tek başına kimliktir; küme bilerek ayrı biçimde (bir ajanın adı "destek" olsa bile küme seçimiyle karışmasın).
 */
export type HedefSecimi = string | { readonly kume: string };

/** Ajanlar defteri: ekleme sırası korunur (çip sırası = kayıt sırası). */
export class AjanDefteri {
  private _ajanlar: AjanKaydi[] = [];
  private _dinleyiciler = new Set<() => void>();

  /** Yeni ajan. Aynı kimlik iki kez ya da `HEPSI` kimliği HATA: sessizce üstüne yazmak bir ajanı girdisiz bırakırdı. */
  kaydet(a: AjanKaydi): void {
    if (a.id === HEPSI) throw new Error(`ajan kimliği '${HEPSI}' olamaz (ayrılmış hedef)`);
    if (this._ajanlar.some((x) => x.id === a.id)) throw new Error(`ajan zaten kayıtlı: ${a.id}`);
    this._ajanlar.push(a);
    this._yay();
  }

  /** Kaydı siler (ajan kapandı). Yoksa false. */
  sil(id: string): boolean {
    const i = this._ajanlar.findIndex((x) => x.id === id);
    if (i < 0) return false;
    this._ajanlar.splice(i, 1);
    this._yay();
    return true;
  }

  al(id: string): AjanKaydi | null { return this._ajanlar.find((x) => x.id === id) ?? null; }
  hepsi(): readonly AjanKaydi[] { return [...this._ajanlar]; }

  /** Kayıt değişince (çip şeridi yeniden çizilsin). Çıkış fonksiyonu döner. */
  dinle(cb: () => void): () => void { this._dinleyiciler.add(cb); return () => { this._dinleyiciler.delete(cb); }; }

  private _yay(): void {
    for (const d of this._dinleyiciler) {
      try { d(); } catch (err) { console.error("[AJAN] defter dinleyicisi hatası:", err); }
    }
  }
}

/** `kume` yolu `ust` kümesinin kendisi ya da altı mı ("destek/kasa" ⊂ "destek"; "destekci" ⊄ "destek"). */
function kumede(kume: string | null, ust: string): boolean {
  return kume !== null && (kume === ust || kume.startsWith(`${ust}/`));
}

/** Seçimin hedeflediği ajanlar, defter sırasıyla. Bilinmeyen kimlik → boş (çağıran "kimse duymadı" der, sessiz düşmez). */
export function hedefCoz(ajanlar: readonly AjanKaydi[], secim: HedefSecimi): AjanKaydi[] {
  if (typeof secim !== "string") return ajanlar.filter((a) => kumede(a.kume, secim.kume));
  if (secim === HEPSI) return [...ajanlar];
  return ajanlar.filter((a) => a.id === secim);
}
