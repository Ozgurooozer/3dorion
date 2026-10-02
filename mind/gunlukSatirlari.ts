// mind/gunlukSatirlari.ts — Karar kaydını zihin duvarı günlüğünün satırlarına çevirir (spec 13 Faz 5).
//
// Ozyn (ortak test 1): "Orion düşünürken ne olduğunu daha detaylı bilmeliyiz." Kapının kararı,
// neyin uyandırdığı, hangi kuralın geçirdiği, ne kadar sürdüğü ve ne seçildiği zaten karar
// kaydında (mind/kararKaydi.ts) — ama yalnız dosyada. Bu biçimleyici kaydın canlı akışını
// (`KararKaydi.dinle`) günlüğe okunur Türkçe satırlar olarak verir. Kayıt davranışı
// değiştirmez; bu da değiştirmez (yalnız gözlem).
//
// Elenen algılar tek tek yazılmaz (20 Hz olmasa da hareket olayları sel olur): sayılır,
// sayı canlı satıra gider.
//
// Saf: girdi kayıt satırı, çıktı günlük satırı ya da null.
"use strict";
import type { KararSatiri } from "./kararKaydi.ts";

export interface GunlukSatiri { seviye: "bilgi" | "iyi" | "uyari" | "hata"; kaynak: string; metin: string }

/** Bir algının günlükte nasıl anıldığı: kısa özet + onu geçiren kural + fail. */
interface AlgiIzi { ozet: string; kural: string; eden?: string }

const IZ_SINIRI = 64;

/** Özetten kalıbı at: 'Ozyn said: "otur"' → Ozyn: "otur"; 'Event: ozyn_yaklasti' → olay ozyn_yaklasti. */
function kisaOzet(ozet: string): string {
  return ozet
    .replace(/^Ozyn said: /, "Ozyn: ")
    .replace(/^Event: /, "olay ")
    .replace(/^You looked \(([^)]*)\): /, "baktı ($1): ")
    .replace(/^Intent (\S+) → /, "sonuç ")
    .replace(/\s+/g, " ")
    .slice(0, 70);
}

function sn(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1).replace(".", ",")} sn`;
}

export function gunlukBicimleyiciKur() {
  const izler = new Map<string, AlgiIzi>();
  let elenen = 0;

  return {
    /** Elenen (beyne çıkmayan) algı sayısı — canlı satıra. */
    get elenen() { return elenen; },

    /** Bir kayıt satırını günlük satırına çevirir; yazılacak bir şey yoksa null. */
    satir(s: KararSatiri): GunlukSatiri | null {
      switch (s.tur) {
        case "algi": {
          izler.set(s.id, { ozet: kisaOzet(s.ozet), kural: s.kapi.kural, ...(s.eden ? { eden: s.eden } : {}) });
          if (izler.size > IZ_SINIRI) izler.delete(izler.keys().next().value!);
          if (!s.kapi.gecti && s.kapi.kural !== "kopru.refleks") elenen++;
          return null;
        }
        case "uyanis": {
          const tetik = s.algilar.map((id) => izler.get(id)).filter((x): x is AlgiIzi => !!x);
          const neden = tetik.length
            ? tetik.map((t) => `${t.ozet} [${t.kural}${t.eden ? ` · ${t.eden}` : ""}]`).join(" + ")
            : s.takip ? "kendi bakışının cevabı" : s.geriBesleme ? "geri besleme" : "?";
          const secti = s.niyetler.map((n) => n.tur).join(" + ") || (s.icSes ? "iç ses" : "hiçbir şey");
          const ek = [
            s.reddedilen ? `${s.reddedilen} çağrı reddedildi` : "",
            s.kurtarilan ? `${s.kurtarilan} metinden kurtarıldı` : "",
            s.susturan ? `sesi kısıldı (${s.susturan})` : "",
            s.hata ? `HATA: ${s.hata.slice(0, 60)}` : "",
          ].filter(Boolean).join(" · ");
          const beyin = s.beyin.replace(/^(yerel|opencode|api):/, "");
          return {
            seviye: s.hata ? "hata" : s.reddedilen ? "uyari" : "bilgi",
            kaynak: s.koken === "inisiyatif" ? "uyandı*" : "uyandı",
            metin: `← ${neden} · ${sn(s.sureMs)} ${beyin} → ${secti}${ek ? ` · ${ek}` : ""}`,
          };
        }
        case "program": {
          const iz = izler.get(s.algi);
          return {
            seviye: "iyi", kaynak: "program",
            metin: `${iz ? `${iz.ozet} → ` : ""}${s.program}: ${s.niyetler.map((n) => n.tur).join(" → ")} (LLM'siz)`,
          };
        }
        case "refleks":
          return { seviye: s.bitis === "basari" ? "iyi" : "uyari", kaynak: "beceri", metin: `${s.beceri}: ${s.bitis}` };
        default:
          return null;
      }
    },
  };
}
