// uygulama/yapi/level/yeniLevelModeli.ts — YENİ LEVEL MODELİ (spec 42 Y4; Unreal File ▸ New Level): şablon listesi, ad → klasör adı, şablondan tanım üretimi, hata metni. SAF (DOM/Babylon yok).
//
// Şablonlar `world/level/sablon/*.level.json` dosyalarıdır (bekçi: `leveller.test.ts`); buraya yalnız kimlik/ad/açıklama listesi girer, içerik çağıranın `sablonOku`suyla gelir
// (Vite `?url`; testte sahte). "@acik" = açık level'ın nesnesiz kopyası (yeni level'ın görünüşü ve ışığı aynı, içi boş).
"use strict";
import { adDuzelt } from "../../../world/level/depo/levelDeposu.ts";
import { levelTanimiDogrula, type LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";

export const ACIK_LEVEL_KOPYASI = "@acik";

export interface YeniLevelSablonu { id: string; ad: string; aciklama: string }

/** `world/level/sablon/<id>.level.json` ile aynı kimlikler; `yeniLevelModeli.test.ts` dosyalarla ayrışmayı yakalar. */
export const YENI_LEVEL_SABLONLARI: readonly YeniLevelSablonu[] = [
  { id: "bos", ad: "Boş ova", aciklama: "Gök, güneş, bulut, dalgalı zemin ve çim. Hemen güzel görünen başlangıç." },
  { id: "duz-zemin", ad: "Düz zemin", aciklama: "Gök ve güneş, düz tek renk zemin; çim, bulut ve arazi yok. Temiz tuval." },
  { id: "tamamen-bos", ad: "Tamamen boş", aciklama: "Yalnız arka plan ve ışık; zemin yok. Her şeyi sen kurarsın." },
  { id: ACIK_LEVEL_KOPYASI, ad: "Açık level'ın kopyası", aciklama: "Şu an açık level'ın görünüşü ve ışığı; nesneleri kopyalanmaz." },
];

export type Sonuc<T> = { ok: true; deger: T } | { ok: false; neden: string };

/** Yazılan ad → klasör adı (host kuralı: küçük harf, rakam, tire). Boşsa neden döner. */
export function klasorAdi(metin: string): Sonuc<string> {
  const slug = adDuzelt(metin);
  return slug ? { ok: true, deger: slug } : { ok: false, neden: "bir ad yaz (harf ya da rakam)" };
}

/**
 * Şablondan yeni level tanımı: görünen ad yazılan metin; geçerlilik doğrulanır (bozuk şablon diske gitmez). `@acik` kopyasında nesne, grup, ışık aktörü ve geçit temizlenir
 * (kopya yeni bir level: ofis kapısı ve elle konan şeyler taşınmaz).
 */
export function yeniTanim(sablon: unknown, gorunenAd: string, acikKopya = false): Sonuc<LevelTanimi> {
  const ad = gorunenAd.trim();
  if (!ad) return { ok: false, neden: "bir ad yaz" };
  const d = levelTanimiDogrula(sablon);
  if (!d.ok) return { ok: false, neden: `şablon geçersiz — ${d.hata}` };
  const t: LevelTanimi = { ...structuredClone(d.deger), ad };
  if (acikKopya) { delete t.nesneler; delete t.gruplar; delete t.isiklar; delete t.gecitler; }
  return { ok: true, deger: t };
}

const HATA_METINLERI: Readonly<Record<string, string>> = {
  "proje-yok": "açık proje yok (Dosya ▸ Yeni proje…)",
  "409": "bu adda level zaten var",
  "400": "geçersiz ad ya da level metni",
};
/** Host sonucunun hata kodu → Türkçe cümle. Bilinmeyen kod olduğu gibi (mesajla) söylenir. */
export function olusturmaHatasi(kod: string | number, mesaj: string): string {
  return HATA_METINLERI[String(kod)] ?? `level oluşturulamadı: ${mesaj}`;
}
