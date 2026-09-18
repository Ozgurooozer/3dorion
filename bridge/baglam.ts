// bridge/baglam.ts — BAĞLAM SÖZLEŞMESİ: beyne giden metin ve beyinden dönen metin.
//
// NEDEN AYRI DOSYA (spec 06 K8): bağlam biçimi beyinden bağımsız olmalı.
// Önce `opencode.ts`'in içindeydi; Claude Haiku beyni (Faz 1b) aynı biçimi
// kullanmak zorunda, yoksa "hangi model daha sadık" ölçümü aslında "hangi
// istem daha sadık" ölçümüne dönüşür. İki beyin, tek metin.
//
// Bağımlılık: beyin.ts, satirSozlesmesi.ts, araclar.ts, metinKurtarma.ts.
"use strict";
import type { BeyinGirdisi, BeyinCikti, AracCagrisi } from "./beyin.ts";
import { yanitAyir, cagrilaraCevir, SOZLESME_TALIMATI } from "./satirSozlesmesi.ts";
import { araclariUret } from "./araclar.ts";
import { metinKurtar } from "./metinKurtarma.ts";

export interface BaglamSecenek {
  /**
   * Konuşma geçmişi metne girsin mi.
   *
   * Oturum tutan beyin (OpenCode, kalıcı oturum) geçmişi zaten biliyor;
   * metne eklemek bağlamı ikiye katlar. DURUMSUZ beyin (her tur yeni `claude
   * -p`, tekrar oynatma) geçmişi başka hiçbir yerden göremez — eklenmezse
   * "You looked: ..." satırının neye cevap olduğunu bilmez.
   */
  gecmis?: boolean;
}

export function baglamMetni(girdi: BeyinGirdisi, s: BaglamSecenek = {}): { sistem: string; kullanici: string } {
  const sistem = [girdi.talimat, girdi.sabit, SOZLESME_TALIMATI].filter(Boolean).join("\n");
  const kullanici = [
    ...(s.gecmis ? gecmisSatirlari(girdi.gecmis) : []),
    girdi.dunya,
    ...(girdi.anilar?.length ? [`You remember: ${girdi.anilar.join(" | ")}`] : []),
    ...girdi.ozetler,
  ].filter(Boolean).join("\n");
  return { sistem, kullanici };
}

/**
 * Geçmişi okunur satırlara çevirir.
 *
 * Orion'un sözü köprüde iki kez kaydediliyor: düz metin ve `arac: true`
 * (gerçekten söylenen). Art arda aynı söz tek satıra iner — iki kez görmek
 * modele "iki kez konuştun" dedirtir.
 */
function gecmisSatirlari(gecmis: BeyinGirdisi["gecmis"]): string[] {
  if (!gecmis?.length) return [];
  const satirlar: string[] = [];
  let onceki = "";
  for (const g of gecmis) {
    const s = g.rol === "kullanici" ? `Ozyn: ${g.metin}` : `You: ${g.metin}`;
    if (s !== onceki) satirlar.push(s);
    onceki = s;
  }
  return ["Earlier conversation:", ...satirlar, ""];
}

/**
 * Modelin ham metnini eyleme çevirir: satır sözleşmesi + sızan JSON kurtarma.
 *
 * `opencode.ts`'ten taşındı — gerekçeler orada ölçümle yazılmıştı:
 * `format: json_schema` bu sağlayıcıda askıda kalıyordu, şemasız istek
 * doğru cevabı veriyordu; model eski alışkanlıkla söz içine JSON araç
 * çağrısı sızdırabiliyor ve temizlenmezse Orion bunu SESLİ okuyor.
 */
export function hamdanCikti(ham: string, bilgi: Record<string, unknown>): BeyinCikti {
  const bilinen = araclariUret().map((a) => a.ad);
  const ayrik = yanitAyir(ham);

  let ekCagrilar: AracCagrisi[] = [];
  if (ayrik.soz.includes("{") && bilinen.some((ad) => ayrik.soz.includes(ad))) {
    const k = metinKurtar(ayrik.soz, bilinen);
    ayrik.soz = k.konusulabilir;
    // `dunya_soyle` hariç: söz aşağıda satır sözleşmesinden zaten üretiliyor.
    ekCagrilar = (k.cagrilar as AracCagrisi[]).filter((c) => c.ad !== "dunya_soyle");
  }

  const cagrilar: AracCagrisi[] = [...ekCagrilar, ...(cagrilaraCevir(ayrik) as AracCagrisi[])];
  if (cagrilar.length === 0 && ham) {
    console.warn(`[beyin] yanittan eylem cikmadi: "${ham.replace(/\s+/g, " ").slice(0, 100)}"`);
  }
  // `metin` yalnızca günlük/panel içindir; ses `dunya_soyle` çağrısından gider.
  return { metin: ayrik.soz, cagrilar, bilgi };
}
