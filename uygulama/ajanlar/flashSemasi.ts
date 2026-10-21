// uygulama/ajanlar/flashSemasi.ts — FLASH'IN ZİHİN HARİTASI (spec 33 dilim 4): şema tanımı + karar kaydından şemaya kanca. SAF.
//
// Orion'un şemasında DÜŞÜNCE (LLM) düğümü var; Flash'ta YOK — haritanın kendisi "burada model yok" der. Akış:
//   ALGI → DİKKAT → KOMUT → BEDEN          doğuştan program, takip, sohbet kipi (0 token)
//                 ↘ BİLMİYORUM → SÖZ      anlaşılmayan söz: "bilmiyorum + seçenek" (kural, model değil)
// Şema Flash'ın KENDİ karar kaydından beslenir (diske gitmeyen kayıt; flash/flashKur.ts): her satır bir düğümü yakar. Köprünün içine
// kanca konmaz — Orion'un şeması da süzgeç geri çağrısından okunuyor (uygulama/kopruKur.ts), aynı ilke: gözlem, karar yolu değil.
"use strict";
import type { Dugum, SemaTanimi } from "../../world/surfaces/duvar/semaCekirdek.ts";
import type { Niyet } from "../../protocol/niyet.ts";
import type { KararSatiri } from "../../mind/kararKaydi.ts";
import type { NiyetYonu } from "../../flash/flashKur.ts";

const DUGUMLER: readonly Dugum[] = [
  { ad: "algi", etiket: "ALGI", lob: "yerel", sutun: 0, satir: 0,
    aciklama: "Ozyn'in sözü (sohbet, mikrofon) ve bedenin sonuçları buradan girer." },
  { ad: "dikkat", etiket: "DİKKAT", lob: "yerel", sutun: 1, satir: 0,
    aciklama: "Süzgeç + dikkat: rutin sonuç geçmez; yalnız söz ve hata ilerler." },
  { ad: "komut", etiket: "KOMUT", lob: "yerel", sutun: 2, satir: 0,
    aciklama: "Doğuştan programlar: komut sözlüğü, takip, sohbet kipi. 0 token." },
  { ad: "secenek", etiket: "BİLMİYORUM", lob: "yerel", sutun: 2, satir: 1,
    aciklama: "Anlaşılmayan söz: 'bilmiyorum' + en yakın komut. Model çağrısı YOK." },
  { ad: "beden", etiket: "BEDEN", lob: "ortak", sutun: 3, satir: 0,
    aciklama: "Avatar yürür, oturur, bakar; yapamadığını söyler." },
  { ad: "soz", etiket: "SÖZ", lob: "ortak", sutun: 3, satir: 1,
    aciklama: "Söylediği: altyazı ve günlük (sesi yok)." },
];

export const FLASH_SEMASI: SemaTanimi = {
  baslik: "FLASH · ZİHİN AKIŞI · LLM YOK",
  dugumler: DUGUMLER,
  oklar: [["algi", "dikkat"], ["dikkat", "komut"], ["dikkat", "secenek"], ["komut", "beden"], ["secenek", "soz"]],
  sutunAdlari: ["GİRİŞ", "SÜZME", "KARAR", "EYLEM"],
  toplamlar: [["algı", "algi"], ["komut", "komut"], ["bilmiyorum", "secenek"]],
};

/** Şemanın yazılabilen yüzü (semaTuvali'nin bir kısmı; testte sahte). */
export interface SemaYazici {
  vur(ad: string, not?: string): void;
  ariza(ad: string, arizali: boolean, not?: string): void;
  durumYaz(metin: string): void;
}

/** Flash bağlantısının şemaya verdiği iki olay akışı. */
export interface FlashSemaKancasi {
  karar(s: KararSatiri): void;
  niyet(n: Niyet, yon: NiyetYonu): void;
}

/** Kapı kuralı → KOMUT düğümünün notu (doğuştan programın kendi satırı yoksa: takip, sohbet). */
const KOMUT_YOLU: Readonly<Record<string, string>> = { "kopru.takip": "takip", "kopru.sohbet": "sohbet kipi" };

const kirp = (m: string, n = 28) => (m.length > n ? `${m.slice(0, n - 1)}…` : m);

export function flashSemaKancasi(s: SemaYazici): FlashSemaKancasi {
  return {
    karar(satir) {
      switch (satir.tur) {
        case "algi": {
          s.vur("algi", satir.algi);
          if (!satir.kapi.gecti) return;
          s.vur("dikkat");
          const yol = KOMUT_YOLU[satir.kapi.kural];
          if (yol) s.vur("komut", yol);
          return;
        }
        // Doğuştan program: adı not olarak ("komut:otur" → "otur").
        case "program": s.vur("komut", satir.program.replace(/^komut:/, "")); return;
        // Beyinsiz beynin turu: "bilmiyorum" ya da "yapamadım" (cevabın kendisi SÖZ düğümünde görünür).
        case "uyanis": s.vur("secenek"); return;
        default: return;
      }
    },
    niyet(n, yon) {
      if (yon === "ses") { if (n.tur === "soyle") { s.vur("soz", kirp(n.metin)); s.durumYaz(`Flash: ${n.metin}`); } return; }
      if (yon === "yapamaz") { s.ariza("beden", true, `yapamaz: ${n.tur}`); return; }
      s.vur("beden", n.tur);
    },
  };
}
