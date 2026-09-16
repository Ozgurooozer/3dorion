// mind/yerelTepki.ts — SAĞ LOB: sol lob susunca Orion'u ayakta tutan katman.
//
// SORUN: iki loblu tasarımın vaadi "dürüst bozulma"ydı — düşünce kapanınca
// Orion aptallaşmaz, KURALLI VARLIK kipinde kalır. Uygulamada o kip yalnızca
// ajandanın rastgele bak/jest önerileriydi: sağlayıcı kotası dolduğunda Orion
// ekranda bir komut patlarken hiçbir şey yapmadan duruyordu.
//
// Bu dosya o boşluğu doldurur: algıdan DOĞRUDAN niyet üretir. Model yok,
// ağ yok, gecikme yok (ölçüm: kural süzgeci 13/13 doğru, 0 ms).
//
// KAPSAM BİLEREK DAR. Sağ lob dil anlamaz, bağlam kurmaz, sohbet etmez.
// Yalnızca kesin ve ucuz olan şeyi yapar:
//   1. Bilinen bir yazım hatası → düzeltme ÖNERİR (onay kapısından geçer)
//   2. Komut hata ile bitti     → ekrana bakar (beden tepkisi)
//   3. Ozyn konuştu             → Ozyn'e bakar (duyduğunu gösterir)
//
// KONUŞMAZ. Sağ lobun ağzından cümle çıkmaz: uydurma bir cevap, sessizlikten
// kötüdür ve "Orion düşünüyor" yanılsaması yaratır. Susmak dürüsttür.
//
// SAF: bağımlılık yok (protokol tipleri hariç), yan etki yok.
"use strict";
import type { Niyet } from "../protocol/niyet.ts";

export interface YerelTepkiGirdi {
  tur: "terminal" | "duydum" | "olay";
  /** Algının tek satırlık özeti. */
  ozet: string;
  /** Terminal çıkış kodu (varsa). */
  kod?: number;
}

/**
 * Sık kullanılan komutlar — yazım hatası düzeltmesi bunlara göre yapılır.
 *
 * Liste bilerek KISA. Uzun liste, yanlış eşleşme olasılığını artırır ve bu
 * katmanın tek değeri "emin olduğunda" konuşmasıdır.
 */
const BILINEN_KOMUTLAR = [
  "git", "npm", "node", "npx", "python", "pip", "code", "cargo", "go",
  "ls", "dir", "cd", "cat", "echo", "mkdir", "rmdir", "copy", "move",
  "curl", "tsc", "docker", "cls", "clear", "where", "type",
] as const;

/**
 * Damerau-Levenshtein mesafesi (optimal dizilim): ekleme, silme, değiştirme
 * ve **yer değiştirme** (transpozisyon).
 *
 * Transpozisyon ŞART, süs değil. Düz Levenshtein'da `gti` → `git` mesafe 2
 * sayılır ve eşiğimizin dışında kalır — oysa canlıda gördüğümüz GERÇEK hata
 * tam olarak buydu. Klavyede en sık yapılan hata iki harfin yer değiştirmesi;
 * onu yakalamayan bir düzeltici, düzeltmesi gereken tek şeyi kaçırır.
 */
export function duzenlemeMesafesi(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Üç satır tutulur: transpozisyon iki satır geriye bakar.
  const n = b.length;
  let ikiOnce: number[] = [];
  let onceki: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const simdiki: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const bedel = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(
        (simdiki[j - 1] ?? 0) + 1,        // ekleme
        (onceki[j] ?? 0) + 1,             // silme
        (onceki[j - 1] ?? 0) + bedel,     // değiştirme
      );
      // Yer değiştirme: "ab" ↔ "ba" tek işlem sayılır.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, (ikiOnce[j - 2] ?? 0) + 1);
      }
      simdiki[j] = d;
    }
    ikiOnce = onceki;
    onceki = simdiki;
  }
  return onceki[n] ?? 0;
}

/**
 * "Tanınmayan komut" hatasından komut adını çıkarır.
 *
 * Hem PowerShell hem POSIX kabuklarını tanır; ikisi de bu projede kullanıldı
 * (kabuk PowerShell'e geçtiğinde risk sınıflandırıcı da aynı şekilde
 * güncellenmişti — bkz. mind/komutRiski.ts).
 */
export function taninmayanKomut(ozet: string): string | null {
  const kaliplar = [
    /The term ['"`]([^'"`]+)['"`] is not recognized/i,   // PowerShell
    /['"`]?([\w.-]+)['"`]?\s*:\s*command not found/i,     // bash/zsh
    /bash:\s*([\w.-]+):\s*command not found/i,
    /['"`]([^'"`]+)['"`] is not recognized as an internal or external command/i, // cmd
  ];
  for (const k of kaliplar) {
    const m = k.exec(ozet);
    const ad = m?.[1]?.trim();
    if (ad) return ad;
  }
  return null;
}

/**
 * Yazım hatası düzeltmesi — YALNIZCA çok eminsek.
 *
 * Eşikler dar tutuldu: tek karakterlik fark ve en az 2 karakter uzunluk.
 * Gevşetilirse "cd" → "go", "rm" → "go" gibi saçma öneriler çıkar ve bu
 * katmanın tek değeri (emin olmadan konuşmamak) kaybolur.
 */
export function duzeltmeOner(yanlis: string): string | null {
  const k = yanlis.toLowerCase();
  if (k.length < 2) return null;
  // Zaten bilinen bir komutsa hata yazımdan değildir (yol, izin, vb.).
  if ((BILINEN_KOMUTLAR as readonly string[]).includes(k)) return null;

  let enIyi: string | null = null;
  let enIyiMesafe = Infinity;
  let berabere = false;

  for (const b of BILINEN_KOMUTLAR) {
    const m = duzenlemeMesafesi(k, b);
    if (m < enIyiMesafe) { enIyiMesafe = m; enIyi = b; berabere = false; }
    else if (m === enIyiMesafe) berabere = true;
  }

  // Tek karakter fark + tek aday: ancak o zaman öneririz.
  if (enIyiMesafe !== 1 || berabere) return null;
  return enIyi;
}

/**
 * Algıdan doğrudan niyet üretir. Yapacak bir şey yoksa `null`.
 *
 * Çağıran bunu YALNIZCA sol lob kapalıyken kullanmalı: ikisi birden çalışırsa
 * niyetler çakışır ve beynin `git`i sağ lobun `bak`ı tarafından kesilir
 * (aynı sınıf hata canlıda bir kez yaşandı — bkz. senaryo kipi).
 */
export function yerelTepki(g: YerelTepkiGirdi): Niyet | null {
  if (g.tur === "duydum") {
    // Cevap veremeyiz ama duyduğumuzu gösterebiliriz. Bu bir nezaket değil,
    // dürüstlük: Orion'un sessizliği "duymadı" gibi görünmemeli.
    return { tur: "bak", hedef: { tip: "oyuncu" } };
  }

  if (g.tur === "terminal") {
    const yanlis = taninmayanKomut(g.ozet);
    if (yanlis) {
      const dogru = duzeltmeOner(yanlis);
      if (dogru) {
        // Komut ÇALIŞMAZ: onay kapısına öneri olarak düşer.
        return {
          tur: "komut",
          metin: dogru,
          gerekce: `'${yanlis}' tanınmadı; '${dogru}' yazım hatası düzeltmesi olabilir`,
        };
      }
    }
    // Düzeltme bilmiyoruz ama bir şeyin bozulduğunu görüyoruz: ekrana bak.
    if (g.kod !== undefined && g.kod !== 0) {
      return { tur: "bak", hedef: { tip: "capa", ad: "monitor" } };
    }
  }

  return null;
}
