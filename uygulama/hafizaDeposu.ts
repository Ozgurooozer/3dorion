// uygulama/hafizaDeposu.ts — Orion'un kalıcı durumunun G/Ç bağları ve eski sürümlerden göç/yedek yardımcıları.
//
// Eskiden uygulama/giris.ts'in ortasındaydı (mimari düzenleme B1–B2, 2026-10-15): hiçbiri modül durumuna
// dokunmuyor, hepsi `globalThis.kopru`yu (host köprüsü, yoksa geliştirme kipi) ve `localStorage`ı okur.
// Karar `mind/hafizaGocu.ts` → `depoYukle`de; burada yalnızca G/Ç bağlanır (spec 07 K4, K7).
"use strict";
import { kabukKoprusu } from "./kabuk.ts";
import { gozlemAnisiMi } from "../mind/hafiza.ts";
import { eskiHafizayiTemizle, eskiSozleriTemizle } from "../mind/aniSuzgeci.ts";
import { depoYukle } from "../mind/hafizaGocu.ts";
import { GOREV_SATIRLARI } from "../mind/gorev.ts";
import type { KararSatiri, OgretimSatiri } from "../mind/kararKaydi.ts";

/** Orion'un anılarının localStorage anahtarı. Sürüm ekli: biçim değişirse
 *  eski kayıt sessizce yanlış yorumlanmak yerine görmezden gelinir. */
const HAFIZA_ANAHTARI = "orion.hafiza.v1";
const HAFIZA_YEDEK = "orion.hafiza.v1.yedek-gozlem-temizligi";

/**
 * TEK SEFERLİK temizlik (spec 06 K2): eski sürümde anlık gözlemler kalıcı
 * hafızaya yazılıyordu ("onumde: beyaz tahta (birkaç adım ötede)"). O
 * kayıtlar bugün getirilip Orion'a dünkü gözlemini anlattırıyor.
 *
 * ÖNCE YEDEK: silme geri alınamaz. Yedek anahtarı bir kez yazılır (varsa
 * dokunulmaz — ikinci koşu temizlenmiş hâli yedeğe basıp aslını ezmesin).
 * Geri dönüş: yedek anahtarı asıl anahtara kopyalamak.
 *
 * Desen dar tutuldu: yalnızca `sonuc` türü VE `onumde|yakin|oyuncu|dunya: `
 * önekiyle başlayanlar. Diğer `sonuc` anıları ("hata: ...") kalır.
 */
function gozlemleriAyikla(aniler: unknown[]): unknown[] {
  const temiz = aniler.filter((a) => !gozlemAnisiMi(a));
  const silinen = aniler.length - temiz.length;
  if (!silinen) return aniler;

  try {
    if (!localStorage.getItem(HAFIZA_YEDEK)) {
      localStorage.setItem(HAFIZA_YEDEK, JSON.stringify(aniler));
    }
  } catch (err) {
    // Yedek yazılamadıysa SİLME. Veri kaybı, kirli hafızadan beterdir.
    console.warn("[hafiza] yedek yazilamadi, temizlik ATLANDI:", err);
    return aniler;
  }
  console.warn(`[hafiza] ${silinen} anlik gozlem anisi temizlendi (yedek: ${HAFIZA_YEDEK})`);
  return temiz;
}

const HAFIZA_GURULTU_YEDEK = "orion.hafiza.v1.yedek-gurultu-temizligi";

/**
 * Yazma süzgecinden (spec 16 F1, mind/aniSuzgeci.ts) ÖNCE yazılmış gürültüyü ayıklar: olay anıları
 * atılır, terminal anıları kırpılır. Desen `gozlemleriAyikla` ile aynı: önce yedek (bir kez),
 * yedeklenemezse DOKUNMA. İkinci açılışta değişecek bir şey kalmaz.
 */
function gurultuyuAyikla(aniler: unknown[]): unknown[] {
  const r = eskiHafizayiTemizle(aniler);
  if (!r.atilan && !r.kirpilan && !r.indirilen) return aniler;
  try {
    if (!localStorage.getItem(HAFIZA_GURULTU_YEDEK)) localStorage.setItem(HAFIZA_GURULTU_YEDEK, JSON.stringify(aniler));
  } catch (err) {
    console.warn("[hafiza] yedek yazilamadi, gurultu temizligi ATLANDI:", err);
    return aniler;
  }
  console.warn(`[hafiza] gurultu temizligi: ${r.atilan} olay atildi, ${r.kirpilan} terminal kirpildi, ${r.indirilen} terminal onemi indirildi (yedek: ${HAFIZA_GURULTU_YEDEK})`);
  return r.aniler;
}

const HAFIZA_SOZ_YEDEK = "orion.hafiza.v1.yedek-soz-temizligi";

/**
 * Söz/sonuç anıları için süzgeç öncesi göç (`eskiSozleriTemizle`): selam ve ortam hatası atılır, komut sözü
 * önemi iner, hata dersi normalleşir. Yedek ÖNCE: host dosyası varsa tarih damgalı kopya (son 5 kalır), yoksa
 * kendi anahtarı (bir kez; `gurultuyuAyikla`nın anahtarı önceki göçte dolmuş olabilir, onu kullanmak yedeksiz silme olurdu).
 * Yedeklenemezse DOKUNMA.
 */
function sozleriAyikla(aniler: unknown[]): unknown[] {
  const r = eskiSozleriTemizle(aniler);
  if (!r.atilan && !r.indirilen && !r.normallesen) return aniler;
  try {
    const k = kabukKoprusu();
    if (k?.hafizaYedekYaz) { if (!k.hafizaYedekYaz(aniler)) throw new Error("dosya yedeği yazılamadı"); }
    else if (!localStorage.getItem(HAFIZA_SOZ_YEDEK)) localStorage.setItem(HAFIZA_SOZ_YEDEK, JSON.stringify(aniler));
  } catch (err) {
    console.warn("[hafiza] yedek yazilamadi, soz temizligi ATLANDI:", err);
    return aniler;
  }
  console.warn(`[hafiza] soz temizligi: ${r.atilan} atildi (selam/ortam hatasi), ${r.indirilen} komut onemi indirildi, ${r.normallesen} ders normallesti (yedek alindi)`);
  return r.aniler;
}

/** `localStorage`'daki eski hafıza — göç kaynağı ve geri dönüş yolu (K5). */
function eskiHafizayiOku(): unknown[] {
  const ham = localStorage.getItem(HAFIZA_ANAHTARI);
  if (!ham) return [];
  try {
    const j = JSON.parse(ham);
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

/**
 * Hafıza deposu (spec 07 K4, K5, K7).
 *
 * Electron varsa hafıza host'un JSON dosyasında yaşar; yoksa (`npm run dev`,
 * yalnız Vite) eskisi gibi `localStorage`da — geliştirme kipi kırılmasın.
 *
 * TEK KURAL, veri güvenliği için: yükleme `eski-yedek` döndüyse (göç
 * başarısız, doğrulanamadı ya da dosya okunamadı) o oturumun YAZIMLARI da
 * `localStorage`a gider, dosyaya DOKUNULMAZ. Aksi hâlde okunamayan ama
 * sağlam olan dosya, oturum boyunca eski veriyle ezilirdi.
 */
/**
 * ÖĞRENEN KAPI (spec 08, toplantı 2026-09-27 K5): kural hafızası kayıttaki
 * öğretim satırlarından kurulur. Host yoksa (tarayıcıda geliştirme) boş doğar;
 * okuma hatası Orion'u durdurmaz ama görünür olur.
 */
export function ogretimleriYukle(): OgretimSatiri[] {
  const k = kabukKoprusu();
  try { return (k?.ogretimOku?.() ?? []) as OgretimSatiri[]; }
  catch (err) { console.warn("[KAPI] ogretimler okunamadi, bos hafizayla basliyor:", err); return []; }
}

/**
 * BECERİ REFLEKSİ (spec 10): beceri defteri geçmiş oturumların görev satırlarından
 * kurulur. Seçim tek kaynaktan (mind/gorev.ts `GOREV_SATIRLARI`), süzme host'ta. Host
 * yoksa ya da okuyamazsa defter geçmişsiz başlar, bu oturumdan öğrenir.
 */
export function gorevSatirlariniYukle(): KararSatiri[] {
  const k = kabukKoprusu();
  try { return (k?.kayitSatirlariOku?.(GOREV_SATIRLARI) ?? []) as KararSatiri[]; }
  catch (err) { console.warn("[BECERI] gorev satirlari okunamadi, gecmissiz basliyor:", err); return []; }
}

/**
 * Durum defterinin deposu (spec 16 F2): host varsa `orion-durum.json`, yoksa (`npm run dev`)
 * localStorage. Hafızadaki göç ve yedek inceliği burada yok: defter küçük ve her an yeniden
 * kurulabilir bilgi tutar; kaybı yalnız "nerede olduğunu bir süre bilmemek"tir.
 */
export function durumDeposuKur(): { oku(): unknown[]; yaz(k: unknown[]): void } {
  const k = kabukKoprusu();
  if (k?.durumOku && k.durumYaz) return { oku: () => k.durumOku!(), yaz: (x) => k.durumYaz!(x) };
  const ANAHTAR = "orion.durum.v1";
  return {
    oku: () => { try { const j = JSON.parse(localStorage.getItem(ANAHTAR) ?? "[]"); return Array.isArray(j) ? j : []; } catch { return []; } },
    yaz: (x) => { try { localStorage.setItem(ANAHTAR, JSON.stringify(x)); } catch { /* geliştirme kipi: önemsiz */ } },
  };
}

/** Sıkıştırma yedeği: yalnız host dosyası varken (yoksa boş → köprü sıkıştırmayı REDDEDER, yedeksiz silme yok). */
export function hafizaYedegiKur(): { hafizaYedegi?: { yaz(aniler: unknown[]): void } } {
  const k = kabukKoprusu();
  const yaz = k?.hafizaYedekYaz?.bind(k);
  if (!yaz) return {};
  return { hafizaYedegi: { yaz: (aniler) => { if (!yaz(aniler)) throw new Error("yedek yazılamadı"); } } };
}

/** Elle unutma teli (duvardaki "Unut…"): host dosya yedeği yoksa HİÇ verilmez, düğme kurulmaz (yedeksiz silme yok). */
export function hafizaUnutTeli(kopru: { hafizaKaydetHemen(): void }): { unut?: { yedekle(aniler: unknown[]): void; kaydet(): void } } {
  const k = kabukKoprusu();
  const yaz = k?.hafizaYedekYaz?.bind(k);
  if (!yaz) return {};
  // "unut" türü: ayrı önek ve 100 yedek sınırı; arka arkaya silmeler sıkıştırma yedeklerini (son 5) döndürüp atmasın.
  return { unut: { yedekle: (aniler) => { if (!yaz(aniler, "unut")) throw new Error("unut yedeği yazılamadı"); }, kaydet: () => kopru.hafizaKaydetHemen() } };
}

export function hafizaDeposuKur(): { oku(): unknown[]; yaz(aniler: unknown[]): void } {
  const k = kabukKoprusu();
  const dosya = k?.hafizaOku && k.hafizaYaz && k.hafizaYazSenkron ? k : null;
  let dosyayaYaz = false;

  return {
    oku() {
      if (!dosya) return sozleriAyikla(gurultuyuAyikla(gozlemleriAyikla(eskiHafizayiOku())));
      const s = depoYukle({
        dosyaOku: () => dosya.hafizaOku!(),
        dosyaYazSenkron: (x) => dosya.hafizaYazSenkron!(x),
        eskiOku: eskiHafizayiOku,
      });
      dosyayaYaz = s.kaynak !== "eski-yedek";
      const satir = `[hafiza] ${s.kayitlar.length} kayit · kaynak=${s.kaynak}${s.not ? ` · ${s.not}` : ""}`;
      if (s.kaynak === "eski-yedek") console.warn(satir); else console.log(satir);
      return sozleriAyikla(gurultuyuAyikla(gozlemleriAyikla(s.kayitlar)));
    },
    yaz(aniler) {
      if (dosya && dosyayaYaz) dosya.hafizaYaz!(aniler);
      else localStorage.setItem(HAFIZA_ANAHTARI, JSON.stringify(aniler));
    },
  };
}
