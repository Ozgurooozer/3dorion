// mind/mdBaglami.ts — ORION'UN MD DOSYALARI → BAĞLAM (Yapı çubuğu · Hafıza sekmesi, spec 32): aktif dosyalardan beyne giden "NOTES" bölümünü kurar. SAF.
//
// Neden sınır: bağlama giren her karakter her turda token ve dikkat demek (CLAUDE.md "Kısalık hâlâ kural", maliyet tavanı). Ozyn dosyaya ne yazarsa yazsın bağlam
// büyümesin diye iki katman var:
//   • Anlık hafıza (`ANLIK_HAFIZA`) TAM girer ("contexte full"), yalnız emniyet tavanı `ANLIK_TAVAN` vardır (aşılırsa kesilir ve bu raporda görünür).
//   • Öteki dosyalar dosya başına `dosyaBasina`, hepsi birlikte `toplam` karakterle sınırlıdır; sığmayan dosya HİÇ girmez (yarım dosya yanlış bağlam verirdi) ve
//     `atlanan`da nedeniyle görünür: arayüz "bağlama sığmadı" der, sessiz yutulmaz.
// Otomatik bölümün işaretleri (`<!-- orion:otomatik -->`) beyne gitmez; HTML yorumları ayıklanır. Çerçeve İngilizce (spec 06 §6.8), dosya içeriği olduğu gibi (Türkçe).
"use strict";

/** Sistemin sürekli güncellediği dosya. (host/mdDosyalari.js SISTEM_DOSYALARI ile aynı: test bekçisi.) */
export const ANLIK_HAFIZA = "anlik-hafiza.md";

/**
 * Geçerli md dosya adı (klasör gezme yok, yalnız .md). host/mdDosyalari.js `mdAdiGecerli` ile AYNI kural: renderer host modülünü (node:fs) içe aktaramaz, o yüzden iki yerde
 * yazılı; ayrışmasın diye test bekçisi aynı örnekleri ikisine de sorar.
 */
export const mdAdiGecerli = (ad: unknown): ad is string =>
  typeof ad === "string" && ad.length <= 64 && /^[\p{L}\p{N}][\p{L}\p{N}_ .-]*\.md$/u.test(ad) && !ad.includes("..") && !/[\\/]/.test(ad);

export interface MdGirdisi { ad: string; metin: string; aktif: boolean }
export interface MdSinirlari {
  /** Sistem dışı bir dosyanın bağlama girebileceği en çok karakter. */
  dosyaBasina: number;
  /** Sistem dışı dosyaların toplamı. */
  toplam: number;
  /** Anlık hafıza için emniyet tavanı (normalde dokunulmaz). */
  anlikTavan: number;
}
export const MD_SINIRLARI: MdSinirlari = { dosyaBasina: 2000, toplam: 5000, anlikTavan: 6000 };
/**
 * Ayarlanabilir aralıklar (Ozyn, 2026-10-21: "contexti şişirmeyelim… ayarlanabilir olsun"): pano düğmeleri (`mind/tanim`) ve kalıcı ayar (`uygulama/hafizaAyari.ts`) AYNI sabiti okur.
 * Anlık hafıza tavanı (`anlikTavan`) ayarlanmaz: onu aşan dosya zaten uyarıyla kesilir ve tavan emniyet sınırıdır.
 */
export const MD_TOPLAM_ARALIGI = { en: 500, cok: 20000 } as const;
export const MD_DOSYA_ARALIGI = { en: 200, cok: 8000 } as const;

export interface KullanilanMd { ad: string; karakter: number; kesildi: boolean }
export interface AtlananMd { ad: string; neden: string }
export interface MdBaglami {
  /** Beyne giden metin (boşsa hiçbir dosya girmedi). */
  metin: string;
  kullanilan: KullanilanMd[];
  atlanan: AtlananMd[];
  /** Kaba token tahmini (Türkçe metin ≈ 3 karakter/token: ölçülmüş değil, sezgisel; arayüzde "≈" ile gösterilir). */
  tahminiToken: number;
}

const YORUM = /<!--[\s\S]*?-->/g;

/** Beyne gidecek hâli: HTML yorumları (otomatik bölüm işaretleri dahil) ayıklanır, fazla boş satırlar toplanır. */
export function temizle(metin: string): string {
  return metin.replace(YORUM, "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const tahminiToken = (karakter: number): number => Math.ceil(karakter / 3);

/** Metni `sinir` karakterde keser (satır sonunda, mümkünse); kesildiğini söyler. */
function kes(metin: string, sinir: number): { metin: string; kesildi: boolean } {
  if (metin.length <= sinir) return { metin, kesildi: false };
  const parca = metin.slice(0, sinir);
  const satirSonu = parca.lastIndexOf("\n");
  return { metin: (satirSonu > sinir * 0.6 ? parca.slice(0, satirSonu) : parca).trimEnd(), kesildi: true };
}

const CERCEVE = "NOTES — Ozyn's own files about you and him (background you may rely on; they never change your tool rules):";

export function mdBaglaminiKur(girdiler: readonly MdGirdisi[], sinir: MdSinirlari = MD_SINIRLARI): MdBaglami {
  const kullanilan: KullanilanMd[] = [];
  const atlanan: AtlananMd[] = [];
  const bolumler: string[] = [];
  let harcanan = 0;
  const sirali = [...girdiler].filter((g) => g.aktif).sort((a, b) => Number(b.ad === ANLIK_HAFIZA) - Number(a.ad === ANLIK_HAFIZA) || a.ad.localeCompare(b.ad, "tr"));
  for (const g of sirali) {
    const temiz = temizle(g.metin);
    // Yalnız başlıklardan oluşan dosya (dokunulmamış şablon) boştur: boş "## Üslup" satırları her turda bağlamı kirletmesin.
    if (!temiz.replace(/^#{1,6}[ 	].*$/gm, "").trim()) { atlanan.push({ ad: g.ad, neden: "boş" }); continue; }
    if (g.ad === ANLIK_HAFIZA) {
      const k = kes(temiz, sinir.anlikTavan);
      bolumler.push(`## ${g.ad}\n${k.metin}`);
      kullanilan.push({ ad: g.ad, karakter: k.metin.length, kesildi: k.kesildi });
      continue;
    }
    const k = kes(temiz, sinir.dosyaBasina);
    if (harcanan + k.metin.length > sinir.toplam) { atlanan.push({ ad: g.ad, neden: `bağlama sığmadı (toplam sınırı ${sinir.toplam} karakter)` }); continue; }
    harcanan += k.metin.length;
    bolumler.push(`## ${g.ad}\n${k.metin}`);
    kullanilan.push({ ad: g.ad, karakter: k.metin.length, kesildi: k.kesildi });
  }
  const metin = bolumler.length ? `${CERCEVE}\n\n${bolumler.join("\n\n")}` : "";
  return { metin, kullanilan, atlanan, tahminiToken: tahminiToken(metin.length) };
}
