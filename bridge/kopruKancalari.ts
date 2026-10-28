// bridge/kopruKancalari.ts — KÖPRÜ KANCALARI (spec 40): eklentilerin düşünme turuna GÜVENLİ takılma noktaları. SAF (Babylon/DOM yok).
//
// İKİ KANCA, ikisi de isteğe bağlı:
//   talimatEki  — turun talimatının SONUNA eklenir (kimlik/duruş/araç kuralları önce kalır; ek onları geçersiz kılamaz — md notlarıyla aynı ilke).
//   niyetDogrula — beynin DOĞRULANMIŞ bir niyeti dünyaya gitmeden önce sınanır. Ret = mevcut ret yolu: sayaç + modele geri besleme (en çok 2 ardışık, sonra kesilir).
//
// GÜVENLİ TARAF: kanca fırlatırsa atlanır (niyet GEÇER), `console.warn`. Eklenti hatası Orion'u susturmaz (süzgeçteki `kopru.guvenli_taraf` ile aynı ilke).
// Kancalar karar ÖNERİR, eylem yürütmez; çalıştıran yine `niyetiYurut` ve onay kapısıdır. Orion kancaları değiştiremez (araç yüzeyinde yok).
"use strict";
import type { Niyet } from "../protocol/niyet.ts";

export interface KancaBaglami {
  /** Turu ne tetikledi: Ozyn/dünya ("dis") ya da kendiliğinden uyanış ("inisiyatif"). */
  koken: "dis" | "inisiyatif";
  /** Şimdi (ms). Testte sabitlenebilir. */
  simdi: number;
  /** Odadaki adlandırılmış yerler (çapa etiketleri); ret mesajı modele geçerli hedefleri gösterebilsin diye. Boş olabilir. */
  yerler?: readonly string[];
}

export type KancaKarari = { ok: true } | { ok: false; neden: string };

export interface KopruKancasi {
  /** Eklenti kimliği: karar kaydında ve ret mesajında görünür. */
  ad: string;
  talimatEki?(b: KancaBaglami): string | null;
  niyetDogrula?(n: Niyet, b: KancaBaglami): KancaKarari;
}

/** Açık kancaların talimat ekleri (boşlar atılır), tek bloğa. Boşsa "". */
export function kancaTalimati(kancalar: readonly KopruKancasi[], b: KancaBaglami): string {
  const parcalar: string[] = [];
  for (const k of kancalar) {
    if (!k.talimatEki) continue;
    try { const e = k.talimatEki(b); if (e && e.trim()) parcalar.push(e.trim()); }
    catch (err) { console.warn(`[kanca] ${k.ad} talimat eki üretemedi, atlandı:`, err); }
  }
  return parcalar.join("\n");
}

/** İlk reddeden kanca kazanır. Hiçbiri reddetmezse (ya da hepsi fırlatırsa) geçer. */
export function kancaDogrula(kancalar: readonly KopruKancasi[], n: Niyet, b: KancaBaglami): { ok: true } | { ok: false; neden: string; kanca: string } {
  for (const k of kancalar) {
    if (!k.niyetDogrula) continue;
    try {
      const r = k.niyetDogrula(n, b);
      if (!r.ok) return { ok: false, neden: r.neden, kanca: k.ad };
    } catch (err) { console.warn(`[kanca] ${k.ad} doğrulayamadı, niyet geçirildi:`, err); }
  }
  return { ok: true };
}
