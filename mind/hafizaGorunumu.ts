// mind/hafizaGorunumu.ts — Hafıza bulutunun kelimeleri GERÇEK kayıtlardan (spec 13 Faz 5).
//
// Zihin duvarındaki HAFIZA görünümü (world/surfaces/hafizaBulutu.ts) yalnız çizer; neyin
// görüneceği burada, saf ve testli. Spec 05 "panel süs eklemiyor": her kelime bir kayıt.
//   SABİT (0): içgüdüler (mind/icgudu.ts) — kimliği ve açıklamasıyla
//   ANLIK (1): benliğin yaptıkları ve bekledikleri, çalışma belleği, konuşma penceresi
//   DERİN (2): anılar — en fazla `enFazlaDerin` tanesi, önem ve tazelikle seçilir;
//              önem → boyut, yaş → soluklık; bu turda getirilenler kırmızı
//
// Tip, world/ tarafındakiyle YAPISAL olarak aynı (K4: world mind'i import etmez).
"use strict";
import type { Ani, GetirSonucu } from "./hafiza.ts";
import type { BenlikGoruntusu } from "./benlik.ts";
import { oncesiSozu } from "./zaman.ts";

export interface HafizaKelimesi {
  kabuk: 0 | 1 | 2; metin: string; not: string; boyut: number; soluk: number; kirmizi?: boolean; sayi: string;
}

export interface HafizaGirdisi {
  icguduler: readonly { id: string; aciklama: string; ezilebilir: boolean }[];
  benlik: BenlikGoruntusu;
  calisma: readonly string[];
  gecmis: readonly { rol: "kullanici" | "orion"; metin: string; cagri?: { ad: string } }[];
  derin: readonly Ani[];
  getirilen: readonly GetirSonucu[];
  simdi: number;
  enFazlaDerin?: number;
}

const kisa = (m: string, n = 26) => (m.length > n ? m.slice(0, n - 1) + "…" : m);
const GUN = 24 * 3600_000;

export function hafizaKelimeleri(g: HafizaGirdisi): HafizaKelimesi[] {
  const k: HafizaKelimesi[] = [];

  for (const i of g.icguduler) {
    k.push({ kabuk: 0, metin: i.id, not: `içgüdü · ${i.ezilebilir ? "ezilebilir" : "ezilemez"} · ${i.aciklama}`,
      boyut: 0.5, soluk: 0, sayi: i.ezilebilir ? "◐" : "●" });
  }

  const b = g.benlik;
  for (const y of b.yapiyorum) k.push({ kabuk: 1, metin: y.ozet, not: `benlik · yapıyorum (${y.eden})`, boyut: 0.7, soluk: 0, sayi: `${Math.round((b.an - y.basladi) / 1000)} sn` });
  if (b.bekliyorum) k.push({ kabuk: 1, metin: `bekliyor: ${kisa(b.bekliyorum.ozet, 22)}`, not: `benlik · ${b.bekliyorum.ne === "onay" ? "onayını bekliyor" : "sonucunu bekliyor"}: ${b.bekliyorum.ozet}`, boyut: 0.7, soluk: 0, sayi: `${Math.round((b.an - b.bekliyorum.basladi) / 1000)} sn` });
  if (b.dusunce.uyanik) k.push({ kabuk: 1, metin: "düşünüyor", not: `benlik · ${b.dusunce.beyin}`, boyut: 0.7, soluk: 0, sayi: `${Math.round((b.an - b.dusunce.basladi) / 1000)} sn` });
  for (const c of g.calisma) k.push({ kabuk: 1, metin: kisa(c), not: `çalışma belleği · ${c}`, boyut: 0.5, soluk: 0.2, sayi: "30 sn" });
  for (const m of g.gecmis.slice(-8)) {
    const metin = m.cagri ? m.cagri.ad.replace(/^dunya_/, "→ ") : m.metin;
    if (!metin.trim()) continue;
    k.push({ kabuk: 1, metin: kisa(metin), not: `konuşma penceresi · ${m.rol === "kullanici" ? "Ozyn" : "Orion"}: ${metin}`, boyut: 0.4, soluk: 0.35, sayi: m.rol === "kullanici" ? "Ozyn" : "Orion" });
  }

  // DERİN: getirilenler her zaman; kalan yer önem + tazelikle.
  const getirilenMetin = new Set(g.getirilen.map((x) => x.ani.metin));
  const puan = (a: Ani) => a.onem / 10 + Math.max(0, 1 - (g.simdi - a.sonErisim) / (14 * GUN));
  const secilen = [...g.derin].sort((a, b) => (getirilenMetin.has(b.metin) ? 1 : 0) - (getirilenMetin.has(a.metin) ? 1 : 0) || puan(b) - puan(a))
    .slice(0, g.enFazlaDerin ?? 60);
  for (const a of secilen) {
    const yas = g.simdi - a.olusma;
    const getir = g.getirilen.find((x) => x.ani.metin === a.metin);
    k.push({
      kabuk: 2, metin: kisa(a.metin),
      not: `anı · ${a.tur} · önem ${a.onem} · ${oncesiSozu(yas)} · son erişim ${oncesiSozu(g.simdi - a.sonErisim)}${getir ? ` · BU TURDA HATIRLANDI (skor ${getir.skor.toFixed(2)})` : ""} · "${a.metin}"`,
      boyut: Math.max(0, Math.min(1, a.onem / 10)),
      soluk: Math.max(0, Math.min(1, Math.log10(1 + yas / 3600_000) / Math.log10(1 + (30 * GUN) / 3600_000))),
      ...(getir ? { kirmizi: true } : {}),
      sayi: getir ? getir.skor.toFixed(2) : `ö${a.onem}`,
    });
  }
  return k;
}
