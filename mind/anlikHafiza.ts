// mind/anlikHafiza.ts — ANLIK HAFIZA DOSYASI (anlik-hafiza.md): sistemin sürekli güncellediği "otomatik bölüm" ve Ozyn'in serbest notları. SAF.
//
// Dosya iki parçalıdır: işaretler arasındaki OTOMATİK BÖLÜM sistemindir (durum defterinden: konum, son iş, son konuşma…), dışı Ozyn'indir.
// Güncelleme yalnız işaretli bölgeyi değiştirir; Ozyn'in yazdığı hiçbir şey ezilmez. İşaretler silinmişse blok dosyanın SONUNA yeniden eklenir (sessizce atlanmaz).
// Satırlarda zaman MUTLAK saattir ("14:32"), "3 dk önce" değil: metin yalnız durum değişince değişir, böylece dosya her tikte yeniden yazılmaz.
"use strict";
import type { DurumKaydi, DurumAnahtari } from "./durumDefteri.ts";

export const ISARET_BASI = "<!-- orion:otomatik -->";
export const ISARET_SONU = "<!-- /orion:otomatik -->";

const ETIKET: Record<DurumAnahtari, string> = {
  konum: "Yer", onceki_konum: "Önceki yer", yapiyor: "Şu an yaptığı", son_is: "Son iş", son_ozyn: "Ozyn'in son sözü", son_orion: "Orion'un son sözü", monitor: "Monitör",
};
/** Bloktaki sıra. */
const SIRA: readonly DurumAnahtari[] = ["konum", "onceki_konum", "yapiyor", "son_is", "son_ozyn", "son_orion", "monitor"];

const saat = (t: number): string => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Durum defteri kayıtlarından otomatik bölümün İÇERİĞİ (işaretsiz). Kayıt yoksa bunu söyler. */
export function otomatikBlok(kayitlar: readonly DurumKaydi[]): string {
  const harita = new Map(kayitlar.map((k) => [k.anahtar, k]));
  const satirlar = SIRA.flatMap((a) => {
    const k = harita.get(a);
    return k && k.deger.trim() ? [`- ${ETIKET[a]}: ${k.deger.replace(/\s*\n\s*/g, " ").trim()} (${saat(k.t)})`] : [];
  });
  return satirlar.length ? satirlar.join("\n") : "- (henüz kaydedilmiş bir durum yok)";
}

/** `metin`deki otomatik bölümü `blok`la değiştirir; işaret yoksa sona ekler. Bölüm dışına dokunmaz. */
export function bolumuGuncelle(metin: string, blok: string): string {
  const yeni = `${ISARET_BASI}\n${blok}\n${ISARET_SONU}`;
  const bas = metin.indexOf(ISARET_BASI);
  const son = bas < 0 ? -1 : metin.indexOf(ISARET_SONU, bas + ISARET_BASI.length);
  if (bas >= 0 && son >= 0) return metin.slice(0, bas) + yeni + metin.slice(son + ISARET_SONU.length);
  // Yarım işaret (yalnız başlangıç kalmış) bozuk bölgeyi çoğaltmasın: kalıntıyı at, bloğu sona ekle.
  const temiz = bas >= 0 ? metin.slice(0, bas) : metin;
  return `${temiz.replace(/\s+$/, "")}\n\n${yeni}\n`;
}

/** Dosyadaki otomatik bölümün içeriği (işaretsiz); yoksa null. */
export function bolumuOku(metin: string): string | null {
  const bas = metin.indexOf(ISARET_BASI);
  const son = bas < 0 ? -1 : metin.indexOf(ISARET_SONU, bas + ISARET_BASI.length);
  return bas >= 0 && son >= 0 ? metin.slice(bas + ISARET_BASI.length, son).replace(/^\n|\n$/g, "") : null;
}

/**
 * Ozyn'in düzenleyicide kaydettiği metin `yeni`, diskteki güncel metin `disk`: otomatik bölüm SİSTEMİN olduğu için Ozyn'in orada yaptığı değişiklik atılır, diskteki bölüm
 * korunur (Ozyn düzenlerken sistem güncellediyse sistem ezilmez, Ozyn'in bölüm dışındaki yazısı ezilmez).
 */
export function kaydetBirlestir(yeni: string, disk: string): string {
  const sistem = bolumuOku(disk);
  return sistem === null ? yeni : bolumuGuncelle(yeni, sistem);
}
