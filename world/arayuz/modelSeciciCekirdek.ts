// world/arayuz/modelSeciciCekirdek.ts — model seçicinin SAF çekirdeği.
//
// Seçici penceresi (`modelSecici.ts`) yalnızca boyar ve tuş dinler; neyin
// hangi sırada, hangi grupta göründüğü ve ok tuşlarının nereye gittiği
// burada — DOM'suz, testli.
//
// Tipler `bridge/beyinKatalogu.ts`teki kart biçiminin AYNISI, ama import
// edilmez (K4: `world/` → `bridge/` yasak). Uyum yapısal: kompozisyon kökü
// (`giris.ts`) kataloğun kartlarını buraya verdiğinde `tsc` iki biçimin
// ayrışmasını derleme hatası olarak yakalar.
"use strict";

export type KartGrubu = "yerel" | "bulut" | "dis";
export type RozetTonu = "iyi" | "uyari" | "kotu" | "notr";

export interface ModelKarti {
  ad: string;
  baslik: string;
  grup: KartGrubu;
  aciklama: string;
  rozetler: readonly { metin: string; ton: RozetTonu }[];
  uygun: boolean;
  sebep?: string;
}

/** Seçicinin o anki geçiş durumu — `SecilebilirBeyin`in okunur özeti. */
export interface SeciciDurumu {
  /** Gerçekten düşünen. */
  aktif: string;
  /** Kullanıcının son seçtiği (sağlık kontrolü sürerken hedef). */
  istenen: string;
  gecis: "sakin" | "kontrol" | "reddedildi";
  /** Reddedildiyse neden. */
  sebep?: string;
  hedef?: string;
}

/** Ollama taramasının özeti — başlıkta tek satır. */
export interface TaramaOzeti {
  ulasildi: boolean;
  surum: string | null;
  modelSayisi: number;
  hata?: string;
  an: number;
}

export interface ModelSeciciKaynagi {
  kartlar(): readonly ModelKarti[];
  durum(): SeciciDurumu;
  /** Geçiş iste; `""` = kabul (sağlık kontrolü başladı), aksi hâlde red sebebi. */
  sec(ad: string): string;
  /** Ollama'yı yeniden tara, yeni modelleri seçeneklere ekle. */
  yenile(): Promise<void>;
  /** Son tarama; hiç taranmadıysa `null`. */
  tarama(): TaramaOzeti | null;
}

/** Grup sırası ve başlıkları: yerel ÖNCE — seçicinin varlık sebebi. */
export const GRUPLAR: readonly { grup: KartGrubu; baslik: string }[] = [
  { grup: "yerel", baslik: "Yerel · Ollama" },
  { grup: "bulut", baslik: "Bulut" },
  { grup: "dis", baslik: "Dış süreç" },
];

export interface KartGrubuGorunumu {
  grup: KartGrubu;
  baslik: string;
  kartlar: readonly ModelKarti[];
}

/**
 * Süz ve grupla. Süzgeç büyük/küçük harf ve Türkçe `İ/ı` duyarsız; başlık,
 * açıklama ve rozetlerde arar ("araç", "GB", "qwen" yazmak işe yarasın).
 * Boş grup DÖNMEZ — başlığı olup kartı olmayan bölüm gürültüdür.
 */
export function suzVeGrupla(kartlar: readonly ModelKarti[], suzgec: string): KartGrubuGorunumu[] {
  const s = kucult(suzgec.trim());
  const uyan = s
    ? kartlar.filter((k) => kucult([k.baslik, k.ad, k.aciklama, ...k.rozetler.map((r) => r.metin)].join(" "))
        .includes(s))
    : kartlar;
  return GRUPLAR
    .map(({ grup, baslik }) => ({ grup, baslik, kartlar: uyan.filter((k) => k.grup === grup) }))
    .filter((g) => g.kartlar.length > 0);
}

/** Görünen sırayla düz liste — ok tuşları bunun üzerinde gezer. */
export function duzListe(gruplar: readonly KartGrubuGorunumu[]): ModelKarti[] {
  return gruplar.flatMap((g) => [...g.kartlar]);
}

/**
 * Ok tuşuyla bir sonraki SEÇİLEBİLİR kart. Uçta durur (dönmez): listenin
 * sonunda aşağı basınca başa atlamak, uzun listede nerede olduğunu kaybettirir.
 * Seçilebilir kart yoksa `-1`.
 */
export function sonrakiIndeks(liste: readonly ModelKarti[], simdiki: number, yon: 1 | -1): number {
  for (let i = simdiki + yon; i >= 0 && i < liste.length; i += yon) {
    if (liste[i]!.uygun) return i;
  }
  if (simdiki >= 0 && simdiki < liste.length && liste[simdiki]!.uygun) return simdiki;
  return liste.findIndex((k) => k.uygun);
}

/** Açılışta imleç: istenen (yoksa aktif) karta; o görünmüyorsa ilk seçilebilire. */
export function baslangicIndeksi(liste: readonly ModelKarti[], d: SeciciDurumu): number {
  const i = liste.findIndex((k) => k.ad === d.istenen);
  if (i >= 0) return i;
  const j = liste.findIndex((k) => k.ad === d.aktif);
  return j >= 0 ? j : liste.findIndex((k) => k.uygun);
}

export type KartHali = "aktif" | "kontrol" | "reddedildi" | "hazir" | "uygunsuz";

/** Bir kartın durumu — rozet ve çerçeve rengi buradan. */
export function kartHali(k: ModelKarti, d: SeciciDurumu): KartHali {
  if (!k.uygun) return "uygunsuz";
  if (d.gecis === "kontrol" && d.hedef === k.ad) return "kontrol";
  if (d.gecis === "reddedildi" && d.hedef === k.ad) return "reddedildi";
  if (d.aktif === k.ad) return "aktif";
  return "hazir";
}

/** Başlık altındaki tek satır: Ollama ne durumda. */
export function taramaSatiri(t: TaramaOzeti | null, simdi: number): string {
  if (!t) return "Ollama taranıyor…";
  if (!t.ulasildi) return `Ollama yok — ${t.hata ?? "ulaşılamadı"} · \`ollama serve\` ile başlat`;
  const once = Math.max(0, Math.round((simdi - t.an) / 1000));
  const zaman = once < 5 ? "az önce" : once < 60 ? `${once} sn önce` : `${Math.round(once / 60)} dk önce`;
  return `Ollama ${t.surum ?? ""}`.trim() + ` · ${t.modelSayisi} model · ${zaman} tarandı`;
}

/** Türkçe duyarlı küçültme: `İ`→`i`, `I`→`ı` değil, aramada `i` sayılır. */
function kucult(s: string): string {
  return s.toLocaleLowerCase("tr").replace(/ı/g, "i");
}
