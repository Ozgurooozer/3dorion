// flash/beyinsizBeyin.ts — BEYİNSİZ BEYİN: `Beyin` arayüzünü uygular ama HİÇ model çağırmaz (spec 33).
//
// Flash'ın köprüsü Orion'unkiyle AYNI `Kopru` sınıfıdır: dikkat, komut sözlüğü, takip, sohbet kipi, eylem sırası, karar kaydı aynı
// yoldan geçer. Fark yalnız bu dosya: köprü "düşünmek" istediğinde (söz LLM'siz yollardan hiçbirine uymadı ya da bir adım hata verdi)
// burası cevap verir — model yerine kural:
//   • turda Ozyn'in sözü varsa → "bilmiyorum + seçenek" (flash/secenek.ts);
//   • yalnız bir niyet hatası varsa → "yapamadım: <neden>";
//   • başka her şey (rutin sonuç, olay) → sessizlik: NPC her kıpırtıya konuşmaz.
// Cevap bir `dunya_soyle` araç çağrısıdır (protokolde konuşmak bir eylemdir; köprü düz metni de konuşurdu ama yol aynı kalsın).
//
// MODEL YOK, KANITI: sınıfın hiçbir alanı bir model, adres ya da istemci tutmaz; ağ çağrısı yapamaz. Test bunu dışarıdan da ölçer:
// `globalThis.fetch` sayaçla değiştirilir, Flash köprüsü uçtan uca koşar, sayaç 0 kalmalı (flash/beyinsizBeyin.test.ts).
//
// Turun sözünü ÖZET satırından okur (`OZET_ONEKI`, protokolün tek biçimleyicisi `ozetle`): beyin arayüzü algının kendisini değil
// özetini taşır; `mind/refleks.ts` de satırı aynı önekle tanır. Biçim değişirse test kırılır (özet `ozetle`den üretilerek sınanır).
"use strict";
import { OZET_ONEKI } from "../protocol/algi.ts";
import { turCoz } from "../bridge/araclar.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "../bridge/beyin.ts";
import type { NpcTanimi } from "./npcTanimi.ts";
import { bilmiyorumCumlesi, yapamadimCumlesi } from "./secenek.ts";

/** `Ozyn said: "<metin>"` → metin (iç tırnak korunur: son tırnağa kadar). Söz değilse null. */
export function ozettenSoz(ozet: string): string | null {
  const bas = `${OZET_ONEKI.duydum} "`;
  if (!ozet.startsWith(bas) || !ozet.endsWith("\"") || ozet.length <= bas.length) return null;
  return ozet.slice(bas.length, -1);
}

/** `Intent <id> → hata (<not>)` → not (notsuz hata: ""). Hata değilse null. */
export function ozettenHata(ozet: string): string | null {
  if (!ozet.startsWith(OZET_ONEKI.sonuc)) return null;
  const m = / → hata(?: \(([\s\S]*)\))?$/.exec(ozet);
  return m ? (m[1] ?? "") : null;
}

export interface BeyinsizSayac {
  /** Köprünün düşünme isteği (her biri bir LLM turu OLURDU). */
  dusun: number;
  /** "bilmiyorum + seçenek" cevabı. */
  bilmiyorum: number;
  /** "yapamadım" cevabı. */
  yapamadim: number;
  /** Cevapsız kalınan tur (rutin sonuç, olay). */
  sessiz: number;
}

export class BeyinsizBeyin implements Beyin {
  readonly ad = "beyinsiz";
  private _tanim: NpcTanimi;
  private _sayac: BeyinsizSayac = { dusun: 0, bilmiyorum: 0, yapamadim: 0, sessiz: 0 };

  constructor(tanim: NpcTanimi) { this._tanim = tanim; }

  /** Her zaman hazır: uyandırılacak, yüklenecek bir model yok. */
  async hazirMi(): Promise<boolean> { return true; }

  sayac(): BeyinsizSayac { return { ...this._sayac }; }

  async dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    this._sayac.dusun++;
    const sozler = girdi.ozetler.map(ozettenSoz).filter((s): s is string => s !== null);
    const hatalar = girdi.ozetler.map(ozettenHata).filter((s): s is string => s !== null);
    let metin = "";
    if (sozler.length) { metin = bilmiyorumCumlesi(sozler.at(-1)!, this._tanim.komutlar); this._sayac.bilmiyorum++; }
    else if (hatalar.length) { metin = yapamadimCumlesi(hatalar.at(-1)); this._sayac.yapamadim++; }
    else { this._sayac.sessiz++; return { metin: "", cagrilar: [], bilgi: { beyin: this.ad } }; }
    // Konuşma aracı turda sunulduysa onunla (köprü yalnız SUNULAN aracı kabul eder); sunulmadıysa düz metin — köprü onu konuşur.
    const soyle = girdi.araclar.find((a) => turCoz(a.ad) === "soyle");
    return soyle
      ? { metin: "", cagrilar: [{ ad: soyle.ad, girdi: { metin } }], bilgi: { beyin: this.ad } }
      : { metin, cagrilar: [], bilgi: { beyin: this.ad } };
  }
}
