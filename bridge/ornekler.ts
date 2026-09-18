// bridge/ornekler.ts — Modele DOĞRU davranışı GÖSTEREN kısa örnekler.
//
// NEDEN VAR (ölçümle): canlıda terminal hatası çoğu zaman hiçbir konuşma
// olmadan gelir, yani bağlam BOŞTUR. Ölçüm (tools/baglam-olcum.mjs) o soğuk
// başlangıcın en zayıf koşul olduğunu gösterdi:
//
//   geçmiş YOK  -> doğru aracı 1-3/4 çağırıyor, model Çince'ye kayabiliyor
//   geçmiş VAR  -> 4/4
//   ÖRNEK var   -> 4/4  (geçmiş olmasa bile)
//
// Anlatmak yetmiyor, GÖSTERMEK gerekiyor: talimatta "dunya_komut aracını
// ÇAĞIR" yazılı olmasına rağmen model cümle içinde tarif ediyordu. Tek bir
// örnek bunu düzeltti.
//
// DURUMA GÖRE verilir (talimat.ts ile aynı ilke): terminal bağlamı yoksa
// terminal örneği gönderilmez — yoksa model alakasız anlarda komut önermeye
// itilir. Örnekler kısa tutulur; her biri ~60-120 token bağlam demektir.
//
// SAF: girdi bağlam, çıktı mesaj dizisi. Yan etki yok.
"use strict";

/** Ollama `messages` biçimiyle uyumlu tek mesaj. */
export interface OrnekMesaj {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[];
}

export interface OrnekBaglami {
  terminal: boolean;
  konusma: boolean;
}

/** Araç çağrısı yapan bir asistan turu + onun sonucu. */
function aracTuru(ad: string, argumanlar: Record<string, unknown>): OrnekMesaj[] {
  return [
    { role: "assistant", content: "", tool_calls: [{ function: { name: ad, arguments: argumanlar } }] },
    { role: "tool", content: "bitti" },
  ];
}

/**
 * Terminal hatası → komut önerisi.
 *
 * Bilerek FARKLI bir yazım hatası (`pyhton`) kullanılıyor: örnek, sınavdaki
 * `gti` vakasının kopyası olmasın. Yoksa model örneği ezberler ve ölçüm
 * kendi kendini doğrular hale gelir.
 */
const TERMINAL_ORNEGI: OrnekMesaj[] = [
  {
    role: "user",
    content:
      // Bu metin `protocol/algi.ts` → `ozetle`nin ÜRETTİĞİ biçimdir; örnek
      // gerçek biçimi göstermezse modele yanlış kalıp öğretir.
      "In Ozyn's terminal (the screen on your desk), the command finished with an ERROR (exit code 1):\n" +
      "pyhton : The term 'pyhton' is not recognized as the name of a cmdlet.",
  },
  ...aracTuru("dunya_komut", {
    metin: "python --version",
    gerekce: "'pyhton' yazım hatası; doğrusu 'python'",
  }),
];

/** Ozyn konuşunca gerçekten CEVAP VERMEK (susmamak). */
const KONUSMA_ORNEGI: OrnekMesaj[] = [
  { role: "user", content: 'Ozyn said: "orada mısın"' },
  ...aracTuru("dunya_soyle", { metin: "Buradayım Ozyn." }),
];

/**
 * Bağlama uygun örnekleri döner.
 *
 * En fazla bir örnek gönderilir: iki örnek bağlamı iki katına çıkarır ve
 * ölçümde tek örnek zaten 4/4 veriyor. Terminal önceliklidir çünkü ölçümde
 * zayıf olan durum oydu.
 */
export function ornekUret(b: OrnekBaglami): OrnekMesaj[] {
  if (b.terminal) return TERMINAL_ORNEGI;
  if (b.konusma) return KONUSMA_ORNEGI;
  return [];
}
