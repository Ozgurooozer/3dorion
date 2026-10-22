// world/avatar/klipKutuphanesi.ts — KLİP KÜTÜPHANESİ ve yükleyici (spec 35 Dilim 5a). SAF: dosya okuma DIŞARIDAN verilir (oyunda `fetch`, testte
// `fs`), Babylon yok.
//
// DEPO: repodaki `assets/animasyon/` (Vite `publicDir`: oyunda `animasyon/…` yolundan okunur). Kullanıcı verisi klasörü YOK (bugün klipleri Ozyn
// repoda düzenler; Orion'un yazması ileride, grafik deposu gibi). Klasör listelenemediği için (tarayıcıda dizin okuma yok) içerik `liste.json`dadır;
// bekçi test listenin klasörle AYNI olduğunu sınar (unutulan dosya da, listede olup diskte olmayan da kırmızı).
//
// BOZUK KLİP NEDENLİ HATADIR: okunamayan, JSON olmayan, biçimi bozuk ya da adı dosya adından farklı klip kütüphaneye GİRMEZ; nedeni `hatalar()`da
// dosya adıyla durur (günlük basar). Sağlam klipler yine yüklenir — tek bozuk dosya bütün kütüphaneyi düşürmez.
//
// KÜTÜPHANE BİR KAP: avatar ve grafik kurulurken boş verilir, yükleme bitince dolar (yükleme asenkron, bedenler beklemesin). Bu yüzden herkes
// çağrı ANINDA okur (`bul`, `adlar`), kopyalayıp dondurmaz.
"use strict";
import { klipAdiGecerli, klipDogrula, klipOzeti, type AnimasyonKlibi, type KlipOzeti } from "../../protocol/animasyon.ts";
import type { Sonuc } from "../../protocol/dogrula.ts";

/** `assets/` altındaki klasör (oyunda varlık yolu). */
export const KLIP_DIZINI = "animasyon";
/** Klasörün içerik listesi: klip adları dizisi. */
export const KLIP_LISTESI = "liste.json";
/** Liste tavanı: bozuk bir liste yüzlerce istek atmasın. */
export const KLIP_LISTE_AZAMI = 64;

export interface KlipHatasi { dosya: string; neden: string }

/** Yürütücünün ve düğümün gördüğü yüz (salt okunur). */
export interface KlipBulucu {
  bul(ad: string): AnimasyonKlibi | null;
  adlar(): readonly string[];
}

export interface KlipKutuphanesi extends KlipBulucu {
  ozetler(): readonly KlipOzeti[];
  /** Son yüklemenin bozuk dosyaları (nedenli). */
  hatalar(): readonly KlipHatasi[];
  /** Yüklemeyi kaba koyar (öncekinin yerine). Aynı ad iki kez gelirse ikincisi hatadır. */
  doldur(klipler: readonly AnimasyonKlibi[], hatalar?: readonly KlipHatasi[]): void;
}

export function klipKutuphanesiKur(): KlipKutuphanesi {
  let harita = new Map<string, AnimasyonKlibi>();
  let hatalar: KlipHatasi[] = [];
  return {
    bul: (ad) => harita.get(ad) ?? null,
    adlar: () => [...harita.keys()],
    ozetler: () => [...harita.values()].map(klipOzeti),
    hatalar: () => hatalar,
    doldur(klipler, h = []) {
      const yeni = new Map<string, AnimasyonKlibi>();
      const yeniHata = [...h];
      for (const k of klipler) {
        if (yeni.has(k.ad)) { yeniHata.push({ dosya: `${k.ad}.json`, neden: `'${k.ad}' adında ikinci klip (ilki kullanılıyor)` }); continue; }
        yeni.set(k.ad, k);
      }
      harita = yeni;
      hatalar = yeniHata;
    },
  };
}

/** Bir klip dosyasının metnini çözer: JSON → biçim → ad = dosya adı. */
export function klipMetniCoz(dosyaAdi: string, metin: string): Sonuc<AnimasyonKlibi> {
  let ham: unknown;
  try { ham = JSON.parse(metin); }
  catch (err) { return { ok: false, hata: `JSON okunamadı: ${err instanceof Error ? err.message : String(err)}` }; }
  const r = klipDogrula(ham);
  if (!r.ok) return r;
  const beklenen = dosyaAdi.replace(/\.json$/, "");
  // Ad = dosya adı (grafik deposunun kuralı): grafik klibi adıyla çağırır, dosyayı değil; ikisi ayrışırsa hangi dosyanın oynadığı belirsizleşir.
  if (r.deger.ad !== beklenen) return { ok: false, hata: `ad '${r.deger.ad}' dosya adıyla ('${beklenen}') aynı olmalı` };
  return r;
}

/** `liste.json` metnini çözer: tekil, geçerli adlar dizisi. `adGecerli` verilmezse klip adı kuralı (sekans örnekleri kendi ad kuralını verir, spec 36). */
export function klipListesiCoz(metin: string, adGecerli: (ad: unknown) => ad is string = klipAdiGecerli): Sonuc<string[]> {
  let ham: unknown;
  try { ham = JSON.parse(metin); }
  catch (err) { return { ok: false, hata: `JSON okunamadı: ${err instanceof Error ? err.message : String(err)}` }; }
  if (!Array.isArray(ham)) return { ok: false, hata: "klip adları dizisi olmalı (örn. [\"el_salla\"])" };
  if (ham.length > KLIP_LISTE_AZAMI) return { ok: false, hata: `en çok ${KLIP_LISTE_AZAMI} klip` };
  const adlar: string[] = [];
  for (const [i, a] of ham.entries()) {
    if (!adGecerli(a)) return { ok: false, hata: `[${i}]: klip adı geçersiz: ${JSON.stringify(a)}` };
    if (adlar.includes(a)) return { ok: false, hata: `'${a}' iki kez` };
    adlar.push(a);
  }
  return { ok: true, deger: adlar };
}

/**
 * LİSTELİ VARLIK KLASÖRÜ yükleyicisi (genel): `<dizin>/liste.json` + her ad için `<dizin>/<ad>.json`. İki kullanıcı: klipler (aşağıda) ve sekans örnekleri
 * (`assets/sekans/`, spec 36 — `uygulama/sekans/ornekler.ts`); ikinci kopya yazılmasın diye genel. Liste okunamazsa HİÇ öğe yok ve tek hata listenin
 * hatasıdır; tek bir dosya okunamazsa yalnız o düşer (nedeni dosya adıyla). Hiç fırlatmaz. Sıra liste sırasıdır.
 */
export async function listeliKlasoruYukle<T extends { ad: string }>(
  oku: (yol: string) => Promise<string>, dizin: string, coz: (dosya: string, metin: string) => Sonuc<T>, adGecerli?: (ad: unknown) => ad is string,
): Promise<{ ogeler: T[]; hatalar: KlipHatasi[] }> {
  const neden = (err: unknown): string => (err instanceof Error ? err.message : String(err));
  let liste: string[];
  try {
    const r = klipListesiCoz(await oku(`${dizin}/${KLIP_LISTESI}`), adGecerli);
    if (!r.ok) return { ogeler: [], hatalar: [{ dosya: KLIP_LISTESI, neden: r.hata }] };
    liste = r.deger;
  } catch (err) {
    return { ogeler: [], hatalar: [{ dosya: KLIP_LISTESI, neden: `okunamadı: ${neden(err)}` }] };
  }
  const ogeler: T[] = [];
  const hatalar: KlipHatasi[] = [];
  await Promise.all(liste.map(async (ad) => {
    const dosya = `${ad}.json`;
    try {
      const r = coz(dosya, await oku(`${dizin}/${dosya}`));
      if (r.ok) ogeler.push(r.deger); else hatalar.push({ dosya, neden: r.hata });
    } catch (err) {
      hatalar.push({ dosya, neden: `okunamadı: ${neden(err)}` });
    }
  }));
  // Liste sırası korunur (Promise.all bitiş sırasıyla iterdi): seçenek listesi her açılışta aynı sırada.
  ogeler.sort((a, b) => liste.indexOf(a.ad) - liste.indexOf(b.ad));
  hatalar.sort((a, b) => a.dosya.localeCompare(b.dosya));
  return { ogeler, hatalar };
}

/** Klip klasörünü yükler (genel yükleyici + klip çözücü). Hiç fırlatmaz: sonuç her zaman bir rapor. */
export async function klipleriYukle(oku: (yol: string) => Promise<string>, dizin = KLIP_DIZINI): Promise<{ klipler: AnimasyonKlibi[]; hatalar: KlipHatasi[] }> {
  const r = await listeliKlasoruYukle(oku, dizin, klipMetniCoz);
  return { klipler: r.ogeler, hatalar: r.hatalar };
}
