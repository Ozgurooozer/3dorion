// uygulama/senaryolar/becerdene.ts — `3dorion.bat becerdene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import type { Kopru } from "../../bridge/kopru.ts";

// ── BECERİ denemesi (?becerdene=1) — spec 10, Faz C/D ─────────────────────
// Aynı çerçeveli üç söz. 1: "pencereye git" — LLM planlar, görev biter, beceri doğar.
// 2: "sandalyeye git" — Faz C'de gölge söz satırına yazılır ve LLM yine planlar; Faz D'de
// (`?beceri=1`) refleks yürütür, LLM uyanmaz. 3: "pencereye git" yine.
// Kanıt kayıtta: ORION_KARAR_DOSYASI ile ayrı dosya; `tools/beceri-deney.ts` okur (ölçü +
// gölge denetimi). Çapalar görünen etiketi iç adıyla aynı olanlar (pencere, sandalye): LLM
// etiketi ad diye verirse "bilinmeyen çapa" (BY39-2d) görevi düşürmesin.
// Sözler ve her birinden sonraki bekleme `?becerdenesoz=soz@ms|soz@ms|…` ile değişir (ORION_BECERDENE_SOZLER;
// spec 10 çürütme bataryası L1/L2: kesme için kısa bekleme, başarısız refleks için başka söz).
const BECERDENE_VARSAYILAN = "pencereye git@16000|sandalyeye git@16000|pencereye git@16000";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(2500);
  const k = d.kopru as Kopru | null;
  if (!k) { console.log("[BECERDENE] KALDI kopru yok"); return; }
  const sozler = (new URLSearchParams(location.search).get("becerdenesoz") ?? BECERDENE_VARSAYILAN).split("|").map((p) => {
    const [soz, ms] = p.split("@");
    return { soz: (soz ?? "").trim(), ms: Number(ms) || 16_000 };
  });
  for (const [i, { soz, ms }] of sozler.entries()) {
    const once = k.sayac().dusunme;
    k.algi({ tur: "duydum", kesin: true, metin: soz });
    await bekle(ms);
    const konum = (d.orion as Avatar | null)?.durum().konum;
    console.log(`[BECERDENE] ${i + 1}. soz "${soz}" · uyanis +${k.sayac().dusunme - once} · refleks toplam ${k.sayac().refleks}`
      + ` · konum=${konum ? `${konum.x.toFixed(1)},${konum.z.toFixed(1)}` : "?"} · beceri=${k.beceriHafizasi.beceriler.length}`);
  }
  const beceriler = k.beceriHafizasi.beceriler.map((b) => `${b.id} "${b.ornek}" basari ${b.sayac.basari} hata ${b.sayac.hata}`);
  console.log(`[BECERDENE] bitti · beceriler: ${beceriler.join(" | ") || "yok"}`);
}
