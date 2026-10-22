// uygulama/graf/animasyonDugumleri.ts — "ANİMASYON OYNAT" düğümü (spec 35 Dilim 5a; Unreal Blueprint'teki PlayAnimation).
//
// Ozyn grafikle "şu ajan şu klibi oynasın" der. YENİ NİYET YOK: düğüm mevcut `jest` niyetini `klip` alanıyla kurar (alan eklemek kırıcı değil,
// SOZLESME.md), `niyetDogrula`dan geçirir ve ajanın TEK eylem yolundan yürütür — "Jest" düğümüyle AYNI yol (`ajanDugumleri.yurut`, kopya yok).
// Fark: klipli jest süreli bir niyettir (beden `basladi` der, klip bitince `bitti`); düz jest anında biter.
//
// AYARLAR:
//   • klip — seçenekler YÜKLÜ kliplerden, çalışma anında (`assets/animasyon/`; yükleme asenkron, liste sonradan dolar). Bilinmeyen ad Kontrol et'te
//     nedenli hata ("seçenekler: …"); denetimden sonra kütüphane değişirse çalışma anında da bakılır.
//   • bekle — true (varsayılan): klip BİTENE dek bekler (Git'in "varınca devam"ı gibi). false: beden klibi KABUL edince devam eder (yürürken el
//     sallamak: Animasyon → Git). Döngülü klip kendiliğinden bitmez: `bekle` ile birlikte denetimde HATA (sonsuz bekleme yerine nedenli ret).
//   • kim — her ajan düğümü gibi (bağ ya da ayar).
// ■: beklerken ajana `dur` gider (klip `iptal`). `bekle: false`ta da kanca ÇALIŞMANIN SONUNA dek kurulu kalır: ■ grafiğin başka bir yerindeyken de
// sallanan kolu indirir (çalışma bitince yorumlayıcı kancaları temizler: geç ■ eski bir işi kesmez).
"use strict";
import type { KlipOzeti } from "../../protocol/animasyon.ts";
import { niyetDogrula } from "../../protocol/dogrula.ts";
import { AKIS_GIRIS, AKIS_SONRA, type DugumCalismasi, type DugumSonucu, type DugumTanimi } from "./dugumKaydi.ts";
import type { GrafYetenegi } from "./grafYetenegi.ts";
import { KIM, KIM_AYARI, kimOku, yurut } from "./ajanDugumleri.ts";

/** Klip kabul edilince devam (bekle: false). Kabul = bedenin İLK cevabı; `hata` (bilinmeyen klip, bedeni yok) düğüm hatasıdır. */
async function baslat(c: DugumCalismasi<GrafYetenegi>, kim: { id: string; ad: string }, ham: unknown): Promise<DugumSonucu> {
  const r = niyetDogrula(ham);
  if (!r.ok) throw new Error(`niyet reddedildi: ${r.hata}`);
  const is = c.yetenek.niyetYurut(kim.id, r.deger);
  // Kanca bilerek BIRAKILMAZ (bkz. dosya başı): çalışma sürdükçe ■ klibi keser.
  c.durdurulunca(() => is.kes());
  const s = await c.bekleVeyaDur(is.kabul ?? is.sonuc);
  if (s.durum === "hata") throw new Error(`${kim.ad}: ${s.not ?? "klibi oynatamadı (neden söylenmedi)"}`);
  if (s.durum === "iptal") throw new Error(`${kim.ad}: iş kesildi (${s.not ?? "başka bir niyet araya girdi"})`);
  return { sonra: "sonra" };
}

export function animasyonDugumleri(klipler: () => readonly KlipOzeti[]): DugumTanimi<GrafYetenegi>[] {
  const ozet = (ad: unknown): KlipOzeti | null => klipler().find((k) => k.ad === ad) ?? null;
  return [
    {
      tip: "ajan.animasyon", ad: "Animasyon oynat", kategori: "ajan", saf: false,
      aciklama: "Ajan bir animasyon klibi oynatır (assets/animasyon/: el_salla, basla_onayla…). 'bekle' açıksa klip BİTİNCE devam eder, kapalıysa başlayınca. "
        + "Bu gövdede olmayan uzuvların izi atlanır (günlükte yazar).",
      ayarlar: [
        { ad: "klip", tip: "metin", secenekler: () => klipler().map((k) => k.ad), ornek: "el_salla", aciklama: "oynatılacak klip (yüklü kliplerden)" },
        { ad: "bekle", tip: "bool", varsayilan: true, aciklama: "klip bitene kadar bekle (kapalı: başlayınca devam et)" },
        KIM_AYARI,
      ],
      pinler: (a) => {
        if (typeof a["klip"] !== "string" || !a["klip"]) throw new Error("klip seçilmedi (ayar.klip: örn. \"el_salla\")");
        // Bilinmeyen ad burada değil seçenek denetiminde düşer (aynı mesaj biçimi); döngü kuralı yalnız bilinen klipte bakılabilir.
        const o = ozet(a["klip"]);
        if (o?.dongu && a["bekle"] !== false) throw new Error(`'${o.ad}' döngülü klip: kendiliğinden bitmez, beklenemez (bekle: false yap; ■ ya da yeni jest keser)`);
        return { girisler: [AKIS_GIRIS, KIM], cikislar: [AKIS_SONRA] };
      },
      calistir: async (c) => {
        const kim = await kimOku(c);
        const o = ozet(c.ayar["klip"]);
        if (!o) throw new Error(`bilinmeyen klip '${String(c.ayar["klip"])}' (yüklü: ${klipler().map((k) => k.ad).join(", ") || "yok"})`);
        if (o.dongu && c.ayar["bekle"] !== false) throw new Error(`'${o.ad}' döngülü klip: beklenemez (bekle: false yap)`);
        const ham = { tur: "jest", jest: o.jest, klip: o.ad };
        return c.ayar["bekle"] === false ? baslat(c, kim, ham) : yurut(c, kim, ham);
      },
    },
  ];
}
