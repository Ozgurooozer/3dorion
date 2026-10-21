// flash/secenek.ts — "BİLMİYORUM + SEÇENEK": NPC'nin anlamadığı söze verdiği cevap (spec 33). SAF.
//
// Oyunlardaki NPC anlamadığı şeyi uydurmaz; bildiği diyalog seçeneklerini sunar. Flash da öyle: söz LLM'siz yollardan hiçbirine
// uymadıysa (komut sözlüğü, takip, sohbet) "bilmiyorum" der ve bildiği komutlardan sözüne EN YAKIN olanı önerir; yakın yoksa
// bildiklerini sayar. Model yok, rastgelelik yok: aynı söz hep aynı cevabı alır (test edilebilir, Ozyn öğrenebilir).
//
// YAKINLIK neden kök öneki: Türkçe sondan eklemeli. "oturabilir misin", "oturmak", "otursana" hepsi "otur" köküyle başlar;
// "pencereden" ile "pencereye" ortak "pencere"yle. Harf düzeltme (Levenshtein) "otur" ile "oyun"u da yakın bulurdu. Kelimeler
// komut sözlüğünün kendi normalleştirmesinden geçer (`sozuNormalle`: katlama, dolgu atma) — kopya normalleştirme yazılmaz.
"use strict";
import { sozuNormalle } from "../mind/komutSozlugu.ts";
import type { NpcKomutu } from "./npcTanimi.ts";

/** Ortak önek en az bu kadar harf olmalı ("bi", "ve" gibi kısa sözcükler eşleşmesin). */
const EN_AZ_KOK = 3;
/** Bir komut, kelimelerinin en az bu payı sözde kök olarak geçiyorsa "yakın" sayılır. */
export const YAKINLIK_ESIGI = 0.5;
/** "Bildiklerim" listesinde en çok kaç komut sayılır (altyazı taşmasın). */
export const LISTE_AZAMI = 6;

/**
 * ZAYIF kelimeler: zamir ve edatlar. Ortalamaya girerler ama bir öneriyi TEK BAŞINA taşıyamazlar — "bana bir şiir yaz" "bana gel"e
 * yakın değildir (keşif, 2026-10-21: gerçek sözlerde bu yüzden 'bana gel | bana bak' öneriliyordu).
 */
const ZAYIF: ReadonlySet<string> = new Set(["bana", "beni", "benim", "sana", "the", "to", "me", "at", "up"]);

/** Ünsüz yumuşaması: komut kökünün SON harfi sözde yumuşamış olabilir ("git" → "gidebilir", "dolap" → "dolabı"); katlanmış biçimde ğ → g. */
const YUMUSAK: Readonly<Record<string, string>> = { t: "d", k: "g", p: "b" };

/**
 * Komut kelimesinin (`w`) sözdeki kelimeye (`s`) kök benzerliği 0..1 = ortak önek / KOMUT kelimesinin boyu. ASİMETRİK, bilerek:
 * "otur" ⊂ "oturabilir" tam benzer (1), ama sözdeki kısa "bir" komuttaki "birak"ın yalnız 3/5'i (keşifte "bir şiir oku" "takibi
 * bırak"a yakın çıkıyordu). En az `EN_AZ_KOK` harf ortak olmalı.
 */
function kokBenzerligi(w: string, s: string): number {
  // Yumuşama yalnız ünlüyle başlayan ekten önce olur ("gid-ebilir"); "bags…" ile "bak" aynı kök değildir.
  const yumusamis = (i: number): boolean => i === w.length - 1 && YUMUSAK[w[i]!] === s[i] && /[aeiou]/.test(s[i + 1] ?? "");
  let p = 0;
  while (p < w.length && p < s.length && (w[p] === s[p] || yumusamis(p))) p++;
  if (p < EN_AZ_KOK) return 0;
  return p / w.length;
}

/**
 * Komutun bir biçiminin söze yakınlığı: biçimdeki her kelimenin sözdeki en benzer kelimeyle benzerliği, ortalama. En az bir ZAYIF
 * olmayan kelime TAM (1) eşleşmeliyse yakınlık sayılır; yoksa 0.
 */
function bicimYakinligi(bicim: string, sozKelimeleri: readonly string[]): number {
  const k = sozuNormalle(bicim).split(" ").filter(Boolean);
  if (k.length === 0 || sozKelimeleri.length === 0) return 0;
  const puanlar = k.map((w) => Math.max(0, ...sozKelimeleri.map((s) => kokBenzerligi(w, s))));
  if (!k.some((w, i) => puanlar[i] === 1 && !ZAYIF.has(w))) return 0;
  return puanlar.reduce((t, p) => t + p, 0) / k.length;
}

/** Söze en yakın komutlar (yakınlık sırası; eşitlikte tanımdaki sıra), en çok `adet`. Yakın yoksa boş. */
export function enYakinKomutlar(soz: string, komutlar: readonly NpcKomutu[], adet = 2): NpcKomutu[] {
  const kelimeler = sozuNormalle(soz).split(" ").filter(Boolean);
  return komutlar
    .map((k, sira) => ({ k, sira, puan: Math.max(...[k.soz, ...(k.esler ?? [])].map((b) => bicimYakinligi(b, kelimeler))) }))
    .filter((x) => x.puan >= YAKINLIK_ESIGI)
    .sort((a, b) => b.puan - a.puan || a.sira - b.sira)
    .slice(0, adet)
    .map((x) => x.k);
}

/** Anlaşılmayan söze NPC cevabı: en yakın öneri(ler) ya da bildiklerinin listesi. */
export function bilmiyorumCumlesi(soz: string, komutlar: readonly NpcKomutu[]): string {
  const yakin = enYakinKomutlar(soz, komutlar);
  if (yakin.length === 1) return `Bunu bilmiyorum. Şunu mu demek istedin: «${yakin[0]!.soz}»?`;
  if (yakin.length > 1) return `Bunu bilmiyorum. Şunlardan biri mi: ${yakin.map((k) => `«${k.soz}»`).join(" ya da ")}?`;
  const liste = komutlar.slice(0, LISTE_AZAMI).map((k) => k.soz).join(", ");
  return `Bunu bilmiyorum. Bildiklerim: ${liste}${komutlar.length > LISTE_AZAMI ? "…" : "."}`;
}

/** Bedenin yapamadığı bir adımın cevabı: nedenin ilk cümlesi, kısa. */
export function yapamadimCumlesi(not: string | undefined): string {
  const ilk = (not ?? "").split(/(?<=[.!?])\s/)[0]!.trim();
  if (!ilk) return "Yapamadım.";
  return `Yapamadım: ${ilk.length > 110 ? `${ilk.slice(0, 109)}…` : ilk}`;
}
