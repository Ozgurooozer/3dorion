// tools/f0.ts — F0 yetenek bataryasının PUANLAMASI (spec 26 §3 F0). Saf: girdi çağrılar + metin + beklenti.
//
// `eylem.ts` yalnız "istenen beden aracı çağrıldı mı"yı sayıyordu. F0 daha geniş sorar: doğru komut mu, uydurma var mı,
// hiçbir şey yapmaması GEREKEN olayda sustu mu, söylediği algıdaki şeyle sınırlı mı. Beklenti bildirimseldir
// (fixtures/f0/senaryolar.json) ve her ihlal NEDENİYLE yazılır: "başarısız" tek başına bir şey söylemez.
"use strict";
import { eylemPuanla, type EylemBeklentisi, type Cagri } from "./eylem.ts";

/** Çağrı: araç + (isteğe bağlı) argüman kalıbı. `arg`: nokta yolu → düzenli ifade (değerin metni eşleşmeli). */
export interface CagriKurali { arac: string; arg?: Record<string, string> }

export interface F0Beklenti {
  /** Beden eylemi (eylem.ts ile aynı anlam). */
  eylem?: EylemBeklentisi;
  /** Hepsi için eşleşen en az bir çağrı olmalı. */
  gerek?: CagriKurali[];
  /** Hiçbiri eşleşmemeli. */
  yasak?: CagriKurali[];
  /** Hiç araç çağrısı olmamalı (tepki gerektirmeyen olay). Düz metin de yok sayılır. */
  bos?: boolean;
  /** Söylenen metin (soyle çağrıları + düz metin) bu kalıpla eşleşmeli / eşleşmemeli. */
  sozdeVar?: string;
  sozdeYok?: string;
}

export interface F0Puani { gecti: boolean; nedenler: string[] }

const al = (o: unknown, yol: string): unknown =>
  yol.split(".").reduce<unknown>((x, k) => (x && typeof x === "object" ? (x as Record<string, unknown>)[k] : undefined), o);

const uyar = (c: Cagri, k: CagriKurali): boolean =>
  c.ad === k.arac && Object.entries(k.arg ?? {}).every(([yol, kalip]) => {
    const v = al(c.girdi, yol);
    return v !== undefined && new RegExp(kalip, "i").test(typeof v === "string" ? v : JSON.stringify(v));
  });

const adi = (k: CagriKurali) => `${k.arac.replace("dunya_", "")}${k.arg ? JSON.stringify(k.arg) : ""}`;

/** Modelin SÖYLEDİĞİ: soyle çağrılarının metni + düz metin. */
export function soylenen(cagrilar: readonly Cagri[], metin: string): string {
  const s = cagrilar.filter((c) => c.ad === "dunya_soyle").map((c) => String(al(c.girdi, "metin") ?? ""));
  return [...s, metin].join(" ").trim();
}

export function f0Puanla(cagrilar: readonly Cagri[], metin: string, b: F0Beklenti): F0Puani {
  const n: string[] = [];
  if (b.bos && cagrilar.length > 0) n.push(`boş kalmalıydı, çağırdı: ${cagrilar.map((c) => c.ad.replace("dunya_", "")).join("+")}`);
  if (b.eylem && !eylemPuanla(cagrilar, b.eylem).dogru) n.push(`eylem yok: ${b.eylem.arac}${b.eylem.capa ? `(${b.eylem.capa})` : ""}`);
  for (const k of b.gerek ?? []) if (!cagrilar.some((c) => uyar(c, k))) n.push(`eksik: ${adi(k)}`);
  for (const k of b.yasak ?? []) if (cagrilar.some((c) => uyar(c, k))) n.push(`yasak çağrı: ${adi(k)}`);
  const soz = soylenen(cagrilar, metin);
  if (b.sozdeVar && !new RegExp(b.sozdeVar, "i").test(soz)) n.push(`sözde yok: /${b.sozdeVar}/`);
  if (b.sozdeYok && new RegExp(b.sozdeYok, "i").test(soz)) n.push(`sözde olmamalı: /${b.sozdeYok}/ → "${soz.slice(0, 80)}"`);
  return { gecti: n.length === 0, nedenler: n };
}
