// uygulama/graf/npcDugumleri.ts — NPC DÜĞÜMLERİ (spec 35 dilim 3, NPC sınıfı): `npc.parametre` — örnek başına düzenlenebilir değer. SAF.
//
// Unreal'ın "Instance Editable" değişkeni: aynı Nöbetçi grafiği iki NPC'de çalışır, parolası NPC KAYDINDAN gelir (`protocol/npc.ts` `parametreler`).
// Grafik parolayı bilmez; kayıt bilir. Kurallar:
//   • Yalnız bir NPC'nin çalışmasında okunur (`@ben` gibi): ▶ ve NPC'siz dinlemede NEDENLİ hata (sessizce varsayılana düşmek, Ozyn'in "neden hep aynı
//     parola" sorusunu cevapsız bırakırdı). Kontrol et'te (NPC'siz SINIF denetimi) geçerlidir.
//   • Kayıtta yoksa `varsayilan` (giriş pini: bağsızsa ayar). Varsayılan zorunludur: kaydı eksik bir NPC de çalışsın, ne olacağı grafikte yazsın.
//   • TÜR düğümde (`tip`); kayıttaki değer başka türdeyse HATA — denetimde (dinlemeye alırken, NPC bilindiğinde) ve çalışmada (ikinci savunma).
"use strict";
import { grafAdiGecerli, type GrafDegeri } from "../../protocol/graf.ts";
import type { DugumTanimi, PinOrtami } from "./dugumKaydi.ts";
import { BOOL, DEGISKEN_TIPLERI, TUR_ADI, turuMu, type DegiskenTipi } from "./durumDugumleri.ts";
import { npcGerekli } from "./benAjani.ts";

export const NPC_PARAMETRE_TIPI = "npc.parametre";

const turu = (v: unknown): string => (typeof v === "number" ? TUR_ADI.sayi : typeof v === "string" ? TUR_ADI.metin : typeof v === "boolean" ? TUR_ADI.bool : typeof v);

function adVeTip(a: Readonly<Record<string, GrafDegeri>>): { ad: string; tip: DegiskenTipi } {
  const ad = a["ad"];
  if (typeof ad !== "string" || !ad) throw new Error("parametre adı verilmedi (ayar.ad: örn. \"parola\")");
  if (!grafAdiGecerli(ad)) throw new Error(`parametre adı geçersiz: ${JSON.stringify(ad)} (harf, rakam, _ ve -)`);
  const tip = a["tip"] ?? "metin";
  if (!DEGISKEN_TIPLERI.includes(tip as DegiskenTipi)) throw new Error(`tip: '${String(tip)}' geçersiz (seçenekler: ${DEGISKEN_TIPLERI.join(", ")})`);
  return { ad, tip: tip as DegiskenTipi };
}

/** Kayıttaki değerin tür hatası (yoksa null). Denetim ve çalışma AYNI metni söyler. */
function kayitHatasi(npc: string, ad: string, tip: DegiskenTipi, v: unknown): string | null {
  return turuMu(tip, v) ? null : `'${ad}': NPC '${npc}' kaydında ${turu(v)} (${JSON.stringify(v)}) ama düğüm ${TUR_ADI[tip]} bekliyor (kaydı ya da düğümün 'tip'ini düzelt)`;
}

export function npcDugumleri<Y>(): DugumTanimi<Y>[] {
  return [
    {
      tip: NPC_PARAMETRE_TIPI, ad: "NPC parametresi", kategori: "veri", saf: true,
      aciklama: "Bu grafiği çalıştıran NPC'nin kaydındaki parametre (parola, saat…): aynı grafik iki NPC'de iki değer. Kayıtta yoksa 'varsayilan'; "
        + "'kayitta' kayıttan mı geldiğini söyler. Yalnız NPC şeridinden ⚡ dinlemeye alınınca çalışır.",
      ayarlar: [
        { ad: "ad", tip: "metin", aciklama: "parametrenin adı (NPC kaydındaki 'parametreler' anahtarı)", ornek: "parola" },
        { ad: "tip", tip: "metin", varsayilan: "metin", secenekler: DEGISKEN_TIPLERI, aciklama: "parametrenin türü" },
      ],
      pinler: (a, o: PinOrtami) => {
        const { ad, tip } = adVeTip(a);
        npcGerekli(o, `NPC parametresi '${ad}'`);
        const d = a["varsayilan"];
        if (d !== undefined && d !== null && !turuMu(tip, d)) throw new Error(`varsayilan: ${TUR_ADI[tip]} olmalı (tip: ${tip}; gelen: ${JSON.stringify(d)})`);
        // NPC biliniyorsa (dinlemeye alırken) kaydın türü ŞİMDİ denetlenir: yanlış türlü parola dinlemeyi kurdurmaz, ilk yaklaşmada patlamaz.
        if (o.ben && o.ben.parametreler[ad] !== undefined) { const h = kayitHatasi(o.ben.ad, ad, tip, o.ben.parametreler[ad]); if (h) throw new Error(h); }
        return { girisler: [{ ad: "varsayilan", tip }], cikislar: [{ ad: "deger", tip }, BOOL("kayitta")] };
      },
      calistir: async (c) => {
        const { ad, tip } = adVeTip(c.ayar);
        if (!c.ben) throw new Error(`NPC parametresi '${ad}' yalnız bir NPC'nin çalışmasında okunur (▶ ve NPC'siz dinleme NPC'yi bilmez)`);
        const v = c.ben.parametreler[ad];
        if (v === undefined) {
          const d = await c.giris("varsayilan");
          if (!turuMu(tip, d)) throw new Error(`varsayilan: ${TUR_ADI[tip]} olmalı (gelen: ${JSON.stringify(d)})`);
          return { cikti: { deger: d, kayitta: false } };
        }
        const h = kayitHatasi(c.ben.ad, ad, tip, v);
        if (h) throw new Error(h);
        return { cikti: { deger: v, kayitta: true } };
      },
    },
  ];
}
