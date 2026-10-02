// uygulama/senaryolar/saglobdene.ts — `3dorion.bat saglobdene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── SAĞ LOB denemesi (?saglobdene=1) ──────────────────────────────────────
// Tezin ikinci yarısı: sol lob ÖLÜYKEN Orion hâlâ işe yarıyor mu?
//
// Sağlayıcı kotası dolu olduğu için bu deneme şu an GERÇEK koşullarda koşuyor:
// beyin gerçekten kapalı, taklit yok.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { monitor, onayKapisi, monitoreGec } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // `?senaryobekle=N`: spec 05 R1 kapısı — MCP ajanı bağlanıp ÖLDÜRÜLSÜN,
  // hata ondan SONRA gelsin. Sağ lob ölü ajanın yerini alıyor mu?
  await bekle(Number(new URLSearchParams(location.search).get("senaryobekle") ?? 0) * 1000);
  await bekle(2500);
  await monitoreGec();
  await bekle(1800);

  // Ozyn yazım hatası yapar. Sol lob kapalıysa sağ lob yakalamalı.
  monitor.yaz("gti status" + String.fromCharCode(13));
  await bekle(6000);

  const b = onayKapisi.bekleyen;
  console.log(`[SAGLOBDENE] oneri=${b ? `"${b.komut}" gerekce="${b.gerekce}"` : "YOK"}`);
  console.log(`[SAGLOBDENE] ${b && b.komut === "git" ? "GECTI" : "KALDI"} `
    + `sol lob kapaliyken duzeltme onerildi`);

  // Ve öneri ÇALIŞMADI: onay kapısı hâlâ bekliyor olmalı.
  console.log(`[SAGLOBDENE] ${onayKapisi.durum === "bekliyor" ? "GECTI" : "KALDI"} `
    + `oneri ONAYSIZ calismadi (durum=${onayKapisi.durum})`);
}
