// world/level/depo/levelDeposu.ts — Level'ların nerede saklandığını bilmeyen depo ARAYÜZÜ (spec 23 A). Saf.
//
// Editör ve sayfa yalnız bunu görür; uygulama kompozisyon kökünde seçilir (mimari: world/ host'tan yalnız TİP
// alır, dosyaya kendisi dokunmaz):
//   • httpDeposu.ts — geliştirme: vite uç noktaları (/__level/*, tools/vite-level.ts) → host/levelDosyasi.js
//   • (spec 23 A sonrası) IPC deposu — Electron'da editör açılınca: main.js aynı host/levelDosyasi.js'i çağırır
// Diske yazmak her zaman insanın eylemidir (Ctrl+S, "yeni", "farklı kaydet"); depo kendiliğinden yazmaz.
// İçerik doğrulaması sunucuda (geçersiz tanım yazılmaz); burada yalnız ad kuralı.
"use strict";

export interface LevelOzeti { ad: string; bayt: number; degisme: number }

export interface LevelDeposu {
  /** Yazabilir mi (salt-okunur kaynakta false: arayüz kaydet/yeni düğmelerini kapatır). */
  readonly yazilabilir: boolean;
  liste(): Promise<LevelOzeti[]>;
  sablonlar(): Promise<string[]>;
  oku(ad: string): Promise<unknown>;
  sablonOku(ad: string): Promise<unknown>;
  /** Var olan level'ı günceller (yoksa hata); yazılan yolu döner. */
  kaydet(ad: string, tanim: unknown): Promise<string>;
  /** Yeni level (aynı adda varsa `VarHatasi`). */
  olustur(ad: string, tanim: unknown): Promise<string>;
  hazirListe(): Promise<string[]>;
  hazirOku(ad: string): Promise<unknown>;
  /** Hazır yapı yazar; varsa ve `ez` değilse `VarHatasi`. */
  hazirKaydet(ad: string, parca: unknown, ez: boolean): Promise<string>;
}

/** Aynı adda kayıt var (arayüz "üstüne yazılsın mı?" sorar). */
export class VarHatasi extends Error {}

/**
 * Kullanıcının yazdığı adı level KLASÖR adına çevirir: Türkçe harfler sadeleşir, küçük harf, boşluk/simge → tire,
 * baştaki/sondaki/yinelenen tire atılır, en çok 48 karakter. Bir şey kalmazsa "". (host/levelDosyasi.js kuralı:
 * /^[a-z0-9][a-z0-9-]{0,47}$/.)
 */
export function adDuzelt(metin: string): string {
  // Türkçe küçük harf (İ→i, I→ı), noktasız ı → i; diğer işaretli harfler (ç ğ ö ş ü â) NFD ile işaretini bırakır.
  const k = metin.toLocaleLowerCase("tr").replace(/ı/g, "i")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return k.slice(0, 48).replace(/-+$/, "");
}
