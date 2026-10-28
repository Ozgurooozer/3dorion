// uygulama/eklentiler/dusunmeKipi/dusunmeKipi.ts — "DÜŞÜNME KİPİ" eklentisi (spec 40 §6): P = NP (Çözücü) ve P ≠ NP (Doğrulayıcı).
//
// METAFOR, karmaşıklık iddiası değil; bir DENEY KOLU. Varsayılan KAPALI (bugünkü davranış); faydası ölçülene dek (E5) `[YAZILDI-KOŞULMADI]`.
//   P = NP · Çözücü      — "doğrulayabiliyorsan çözebilirsin": talimata tek satır (doğrudan, tek net eylem, gereksiz soru yok). Ek doğrulama YOK.
//   P ≠ NP · Doğrulayıcı — "doğrulamak çözmekten ucuzdur": talimata tek satır + LLM'siz kuralcı doğrulayıcı (`dogrulayici.ts`); ret modele geri döner.
// Eklenti açık/kapalı + seçenek (cozucu|dogrulayici); kancalar köprüde HER TURDA yeniden okunur, yani aç/kapa/seçenek değişimi anında geçerli.
// Talimat eki İngilizce (modele giden çerçeve; spec 06 §6.8). Orion bu kipi değiştiremez: araç yüzeyinde yok, yalnız Ayarlar.
"use strict";
import type { Eklenti } from "../../eklenti/eklentiDefteri.ts";
import type { KopruKancasi } from "../../../bridge/kopruKancalari.ts";
import { ORION_SEMASI, type SemaTanimi } from "../../../world/surfaces/duvar/semaCekirdek.ts";
import { dogrulayiciKur, type DogrulayiciAyari } from "./dogrulayici.ts";

export const DUSUNME_KIPI = "dusunme-kipi";
export const KIP_COZUCU = "cozucu";
export const KIP_DOGRULAYICI = "dogrulayici";

export const COZUCU_EKI = "MODE: solve. Act on the most likely reading right away with one clear action; do not ask clarifying questions unless you are truly blocked.";
export const DOGRULAYICI_EKI = "MODE: verify. Before acting, check your intended action against what you can see in NOW; do not repeat an action that just ran, and give every terminal command a concrete reason. Your actions are checked and may be sent back.";

const ROZET: Readonly<Record<string, string>> = { [KIP_COZUCU]: "P=NP", [KIP_DOGRULAYICI]: "P≠NP" };

/**
 * Zihin duvarı şeması: kapalıyken Orion'un olağan şemasının AYNI nesnesi (anlık görüntü birebir); açıkken yalnız başlığa kip rozeti.
 * Ara düğüm (NİYET → DOĞRULA → BEDEN) bilerek YOK: düğümü yakacak olay bağlanmadan çizmek sahte gösterge olurdu.
 */
export function kipSemasi(etkin: string | null): SemaTanimi {
  const r = etkin ? ROZET[etkin] : undefined;
  return r ? { ...ORION_SEMASI, baslik: `${ORION_SEMASI.baslik} · ${r}` } : ORION_SEMASI;
}

/** Defterden yalnız iki okuma gerekir (test sahtesi küçük kalsın). */
export interface KipDefteri { acikMi(id: string): boolean; secenek(id: string): string | null }

export interface DusunmeKipi {
  eklenti: Eklenti;
  /** Köprüye verilecek kancalar: kapalıyken boş, açıkken seçime göre tek kanca. HER ÇAĞRIDA canlı okunur. */
  kancalar(): readonly KopruKancasi[];
  /** Şu anki etkin kip (şema rozeti için): "cozucu" | "dogrulayici" | null. */
  etkin(): string | null;
}

export function dusunmeKipiKur(defter: KipDefteri, ayar: DogrulayiciAyari = {}): DusunmeKipi {
  const dogrulayici = dogrulayiciKur(ayar);
  const etkin = (): string | null => {
    if (!defter.acikMi(DUSUNME_KIPI)) return null;
    return defter.secenek(DUSUNME_KIPI) === KIP_COZUCU ? KIP_COZUCU : KIP_DOGRULAYICI;
  };
  const cozucu: KopruKancasi = { ad: DUSUNME_KIPI, talimatEki: () => COZUCU_EKI };
  const dogrulayan: KopruKancasi = {
    ad: DUSUNME_KIPI,
    talimatEki: () => DOGRULAYICI_EKI,
    niyetDogrula: (n, b) => dogrulayici.dogrula(n, b.simdi, b.yerler),
  };
  return {
    etkin,
    kancalar() { const k = etkin(); return k === KIP_COZUCU ? [cozucu] : k === KIP_DOGRULAYICI ? [dogrulayan] : []; },
    eklenti: {
      bildirim: {
        id: DUSUNME_KIPI, ad: "Düşünme kipi (P = NP / P ≠ NP)", kategori: "zihin", varsayilan: "kapali", etki: "aninda",
        aciklama: "Deney kolu (metafor, karmaşıklık iddiası değil). Kapalıyken Orion bugünkü gibi düşünür. Faydası ölçülene dek varsayılan KAPALI.",
        secenek: {
          ad: "Kip", varsayilan: KIP_DOGRULAYICI,
          secenekler: [
            { id: KIP_DOGRULAYICI, ad: "P ≠ NP · Doğrulayıcı", aciklama: "Doğrulamak çözmekten ucuzdur: öneri, LLM'siz kurallardan geçer (tekrar eylem, tekrar söz, gerekçesiz komut); ret modele döner." },
            { id: KIP_COZUCU, ad: "P = NP · Çözücü", aciklama: "Doğrulayabiliyorsan çözebilirsin: doğrudan, tek net eylem; ek doğrulama yok." },
          ],
        },
      },
      // Kapatınca doğrulayıcının halkası boşalır: yeniden açılınca eski kabuller sayılmaz.
      kur: () => { dogrulayici.sifirla(); return { kapat: () => dogrulayici.sifirla() }; },
    },
  };
}
