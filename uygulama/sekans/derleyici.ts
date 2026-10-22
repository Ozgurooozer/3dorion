// uygulama/sekans/derleyici.ts — SEKANSI BEDENE GİDECEK KLİBE DERLER (spec 36): bağlama başına bir `AnimasyonKlibi`. SAF.
//
// Beden yalnız klip oynatır (tek eylem yolu: `jest` niyeti + `klip`; bkz. `geciciKlipler.ts`). Sekansın uzuv izleri, klip bölümleri ve toplama kuralı
// (`degerlendir.ts`) burada HER KARE için değerlendirilir ve bağlamanın bütün kanalları tek bir klibe yazılır: kare k → t = (k − başlangıç) / 30 sn'de
// bir anahtar, arası doğrusal. Derlenmiş klip karelerde değerlendirmenin AYNISIDIR (bekçi test: her karede fark < 1e-6); kareler arası çizim karesinde
// doğrusal ara değerdir (30 kare/sn'de klibin smoothstep'inden sapma çizimde görünmez — ölçülmedi, göz kararı).
//
// SIKIŞTIRMA: aynı doğru üzerindeki ara anahtarlar atılır (sabit ve doğrusal kısımlar iki anahtara iner; eğri kısımda her kare kalır). Hata payı 1e-6
// (derece/metre). Hiç hareket etmeyen kanal (her karede 0) klibe girmez; hiç kanalı olmayan bağlama klip ALMAZ (`bos` listesinde; oynatıcı ona niyet yollamaz).
//
// OYNATMA KARELERİ (`oynatmaKareleri`): döngüsüzde başlangıçtan aralığın sonuna (son kare dahil); DÖNGÜLÜDE başlangıçtan sona, sonra aralığın başından
// başlangıca — "döndürülmüş" tek tur. Böylece playhead ortadayken ▶ döngüde de oradan başlar ve beden klibi kendi süresince sarar (yeni niyet gerekmez).
// Döngü sınırında (bit−1 → bas) değer tek kare boyunca doğrusal geçer (Unreal sıçrar; fark en çok 1/30 sn).
"use strict";
import type { AnimasyonKlibi, KlipIzi } from "../../protocol/animasyon.ts";
import { SEKANS_FPS, type OynatmaAraligi, type Sekans } from "../../protocol/sekans.ts";
import type { KlipBulucu } from "../../world/avatar/index.ts";
import { degerlendir } from "./degerlendir.ts";

/** Derlenmiş klibin anlamı (`jest` zorunlu alan): uzvu olmayan gövde (LED yüz) bunu gösterir; nötr. */
export const SEKANS_JESTI = "bekliyor";
const ESIK = 1e-6;

export interface OynatmaPlani {
  /** Klibin anahtar kareleri sırayla (döngüde son eleman tur başına dönüş: başlangıç karesi). */
  kareler: number[];
  /** Klibin süresi (sn). */
  sure: number;
  dongu: boolean;
}

/**
 * Hangi karelerin hangi sırayla oynanacağı. `baslangic` aralık dışında ya da (döngüsüzde) aralığın sonundaysa aralığın BAŞINDAN oynanır
 * (Unreal: sona gelmiş playhead'de ▶ başa sarar).
 */
export function oynatmaKareleri(aralik: OynatmaAraligi, baslangic: number, dongu: boolean): OynatmaPlani {
  const { bas, bit } = aralik;
  const b = Number.isInteger(baslangic) && baslangic >= bas && baslangic < bit ? baslangic : bas;
  const kareler: number[] = [];
  if (!dongu) {
    for (let k = b; k <= bit; k++) kareler.push(k);
    return { kareler, sure: (bit - b) / SEKANS_FPS, dongu: false };
  }
  for (let k = b; k < bit; k++) kareler.push(k);
  for (let k = bas; k < b; k++) kareler.push(k);
  kareler.push(b);   // tur kapanışı: t = süre'de başlangıç karesinin değeri (sarınca 0'a eşit)
  return { kareler, sure: (bit - bas) / SEKANS_FPS, dongu: true };
}

/** Bir kanalın değer dizisini anahtarlara çevirir: doğrusal/sabit kısımların ara anahtarları atılır (hata ≤ 2·ESIK). */
export function anahtarlariSikistir(degerler: readonly number[], fps = SEKANS_FPS): KlipIzi["anahtarlar"] {
  const n = degerler.length;
  const l: KlipIzi["anahtarlar"] = [];
  let i = 0;
  while (i < n) {
    l.push({ t: i / fps, deger: degerler[i]!, yumusatma: "dogrusal" });
    if (i === n - 1) break;
    const v0 = degerler[i]!, m = degerler[i + 1]! - v0;
    let j = i + 1;
    while (j + 1 < n && Math.abs(degerler[j + 1]! - (v0 + m * (j + 1 - i))) <= ESIK) j++;
    i = j;
  }
  return l;
}

export interface Derleme {
  /** Hareketi olan bağlamaların klipleri (bağlama sırasıyla). */
  klipler: { baglama: string; klip: AnimasyonKlibi }[];
  /** Hiç hareket etmeyen bağlamalar (klip almaz). */
  bos: string[];
  /** Kütüphanede bulunamayan klipler (oynatıcı bunlarla OYNATMAZ). */
  eksikKlipler: string[];
  plan: OynatmaPlani;
}

/** `ad(baglama)`: geçici klip adı (oynatıcı verir: tekil, `sekans__` önekli). */
export function sekansiDerle(s: Sekans, klipler: KlipBulucu, baslangic: number, dongu: boolean, ad: (baglama: string) => string): Derleme {
  const plan = oynatmaKareleri(s.aralik, baslangic, dongu);
  const kanallar = new Map<string, Map<string, { uzuv: KlipIzi["uzuv"]; kanal: KlipIzi["kanal"]; degerler: number[] }>>();
  for (const b of s.baglamalar) kanallar.set(b.id, new Map());
  const eksik = new Set<string>();
  for (const [i, kare] of plan.kareler.entries()) {
    const d = degerlendir(s, kare, klipler);
    for (const e of d.eksikKlipler) eksik.add(e);
    for (const x of d.degerler) {
      const m = kanallar.get(x.baglama)!;
      const k = `${x.uzuv}.${x.kanal}`;
      let c = m.get(k);
      // Kanal ilk kez bu karede görüldü: önceki kareler 0 (bölüm dışı = katkı yok).
      if (!c) { c = { uzuv: x.uzuv, kanal: x.kanal, degerler: new Array<number>(plan.kareler.length).fill(0) }; m.set(k, c); }
      c.degerler[i] = x.deger;
    }
  }
  const sonuc: Derleme = { klipler: [], bos: [], eksikKlipler: [...eksik], plan };
  for (const b of s.baglamalar) {
    const izler: KlipIzi[] = [];
    for (const c of kanallar.get(b.id)!.values()) {
      if (c.degerler.every((v) => Math.abs(v) <= ESIK)) continue;
      izler.push({ uzuv: c.uzuv, kanal: c.kanal, anahtarlar: anahtarlariSikistir(c.degerler) });
    }
    if (!izler.length) { sonuc.bos.push(b.id); continue; }
    sonuc.klipler.push({ baglama: b.id, klip: { surum: 1, ad: ad(b.id), aciklama: `sekans '${s.ad}' · bağlama ${b.id}`, jest: SEKANS_JESTI, sure: plan.sure, dongu: plan.dongu, izler } });
  }
  return sonuc;
}
