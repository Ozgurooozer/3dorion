// uygulama/sekans/degerlendir.ts — SEKANSIN DEĞERLENDİRİLMESİ (spec 36): verilen KAREDE her (bağlama, uzuv, kanal) değeri. SAF ve DURUMSUZ.
//
// Unreal Sequencer'daki "evaluate"in karşılığı ve oynatma/scrub/geri sarmanın TEK kaynağı: aynı sekans, aynı kare → hep aynı sonuç (önceki kareye,
// oynatma yönüne, geçmişe bakılmaz). Editör playhead'in altındaki değeri, derleyici (`derleyici.ts`) bedene gidecek klibi BURADAN okur.
//
// KURALLAR:
//   • Uzuv izi: anahtarlar arası değer klibin örnekleyicisinden (`izDegeri`: yumuşatma segmentin BAŞINDAKİ anahtardan; ilk anahtardan önce ilk değer,
//     sondan sonra son değer) — kopya enterpolasyon yok. Anahtarsız iz katkı vermez.
//   • Klip izi: karenin düştüğü bölüm (baslangic ≤ kare < baslangic + uzunluk) klibi klibin İÇ zamanında (ofset dahil) örnekler (`klipOrnekle`: döngüsüz
//     klip süresinde kısılır = son değerinde durur, döngülü sarar). Bölüm dışında katkı yok. Klip kütüphanede yoksa katkı yok ve adı `eksikKlipler`de
//     (sessiz yutma yok: editör bölümü kırmızı çizer, oynatıcı nedenle reddeder).
//   • `gizli` iz değerlendirilmez.
//   • KATMANLAMA: aynı (bağlama, uzuv, kanal) birden çok izden gelirse değerler TOPLANIR (klip "duruşun üstüne eklenir" kuralının sekans hâli: klip + elle
//     yazılmış baş izi birlikte). Toplam klibin tavanına KISILIR (±180°, ±0.5 m): iki iz toplanınca beden tavanın ötesine gitmesin.
"use strict";
import { KLIP_SINIRLARI, otelemeMi, type Kanal, type Uzuv } from "../../protocol/animasyon.ts";
import { SEKANS_FPS, type Sekans, type SekansKlipIzi, type UzuvIzi } from "../../protocol/sekans.ts";
import { izDegeri, klipOrnekle, type KlipBulucu } from "../../world/avatar/index.ts";

export interface SekansDegeri {
  baglama: string;
  uzuv: Uzuv;
  kanal: Kanal;
  /** Derece (dönme) ya da metre (öteleme). */
  deger: number;
}

export interface Degerlendirme {
  /** Bağlama sırasıyla, her bağlamada ilk görülme sırasıyla (sıra sabit: aynı sekans → aynı dizi). */
  degerler: SekansDegeri[];
  /** Bu karede bölümü olan ama kütüphanede bulunamayan klipler (tekil). */
  eksikKlipler: string[];
}

const kis = (kanal: Kanal, v: number): number => { const s = otelemeMi(kanal) ? KLIP_SINIRLARI.oteleme : KLIP_SINIRLARI.donme; return Math.max(-s, Math.min(s, v)); };

/** Uzuv izinin karedeki değeri (anahtarsızsa null). Klibin örnekleyicisi kare cinsinden çalıştırılır (`t` = kare). */
export function uzuvIziDegeri(iz: Pick<UzuvIzi, "anahtarlar">, kare: number): number | null {
  if (!iz.anahtarlar.length) return null;
  return izDegeri({ anahtarlar: iz.anahtarlar.map((a) => ({ t: a.kare, deger: a.deger, yumusatma: a.yumusatma })) }, kare);
}

/** Klip izinin karede ETKİN bölümü (yoksa null). Bölümler sıralı ve ayrık (biçim). */
export function etkinBolum(iz: Pick<SekansKlipIzi, "bolumler">, kare: number): SekansKlipIzi["bolumler"][number] | null {
  return iz.bolumler.find((b) => kare >= b.baslangic_kare && kare < b.baslangic_kare + b.uzunluk_kare) ?? null;
}

export function degerlendir(s: Sekans, kare: number, klipler: KlipBulucu): Degerlendirme {
  const toplam = new Map<string, SekansDegeri>();
  const eksik: string[] = [];
  const ekle = (baglama: string, uzuv: Uzuv, kanal: Kanal, deger: number) => {
    const k = `${baglama}\u0000${uzuv}\u0000${kanal}`;
    const x = toplam.get(k);
    if (x) x.deger += deger; else toplam.set(k, { baglama, uzuv, kanal, deger });
  };
  // Bağlama sırası korunur: bütün izler bağlama sırasına göre gezilir (iz dizisinin sırası bağlamalar arasında karışık olabilir).
  for (const b of s.baglamalar) {
    for (const iz of s.izler) {
      if (iz.baglama !== b.id || iz.gizli) continue;
      if (iz.tur === "uzuv") {
        const v = uzuvIziDegeri(iz, kare);
        if (v !== null) ekle(b.id, iz.uzuv, iz.kanal, v);
        continue;
      }
      const bolum = etkinBolum(iz, kare);
      if (!bolum) continue;
      const klip = klipler.bul(bolum.klip);
      if (!klip) { if (!eksik.includes(bolum.klip)) eksik.push(bolum.klip); continue; }
      const gecen = (kare - bolum.baslangic_kare + bolum.ofset_kare) / SEKANS_FPS;
      for (const d of klipOrnekle(klip, gecen)) ekle(b.id, d.uzuv, d.kanal, d.deger);
    }
  }
  return { degerler: [...toplam.values()].map((d) => ({ ...d, deger: kis(d.kanal, d.deger) })), eksikKlipler: eksik };
}

/** Sekansın bütün bölümlerinde adı geçen ama kütüphanede olmayan klipler (oynatmadan ÖNCE nedenle ret; editör kırmızı çizer). */
export function eksikKlipler(s: Sekans, klipler: KlipBulucu): string[] {
  const l: string[] = [];
  for (const iz of s.izler) if (iz.tur === "klip" && !iz.gizli) for (const b of iz.bolumler) if (!klipler.bul(b.klip) && !l.includes(b.klip)) l.push(b.klip);
  return l;
}
