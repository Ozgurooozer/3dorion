// uygulama/zihinDuvari.ts — Zihin duvarının (günlük + akış şeması) beyne bağlanması
// (spec 14 R4: world/giris.ts `beyniBagla`dan taşındı; gövde aynı).
//
// Duvar `world/surfaces/` içinde ve beyni GÖRMEZ (K4). Beynin ne yaptığını ona taşıyan kablolar
// burada: karar kaydı → günlük satırları, anlık benlik → canlı satır ve DÜŞÜNCE hapı, devre
// kesici → arıza işareti, köprünün aşama/iç ses/söz-eylem bildirimleri → şema ve günlük, hafıza
// görünümü → HAFIZA bulutu. Hepsi YALNIZ GÖZLEM: köprünün kararını değiştirmez.
"use strict";
import type { GunlukEkrani } from "../world/surfaces/gunluk.ts";
import type { SemaPaneli } from "../world/surfaces/sema.ts";
import type { Kopru, KopruAyari } from "../bridge/kopru.ts";
import { KararKaydi } from "../mind/kararKaydi.ts";
import { gunlukBicimleyiciKur } from "../mind/gunlukSatirlari.ts";
import { hafizaKelimeleri } from "../mind/hafizaGorunumu.ts";
import { ICGUDULER } from "../mind/icgudu.ts";
import { durumSatiri } from "../mind/benlik.ts";

export interface ZihinDuvariBaglami {
  sema: Pick<SemaPaneli, "ariza" | "durumYaz" | "not" | "vur" | "hafizaBagla">;
  gunluk: Pick<GunlukEkrani, "ekle" | "canli">;
  /** Köprü avatar yüklendikten sonra kurulur: çağrı anında okunur. */
  kopru(): Kopru | null;
  /** Devre kesicinin kalan saniyesi (0 = düşünce açık). */
  kesikSn(): number;
  /** Panel notu için kısa beyin adı. */
  kisaAd(ad: string): string;
}

/** Köprüye verilecek kayıt ve dinleyiciler (`new Kopru({...})` ayarına yayılır). */
export type ZihinDuvariKancalari =
  Required<Pick<KopruAyari, "kararKaydi" | "asamaDinle" | "icSesDinle" | "sozEylemDinle">>;

export function zihinDuvariniBagla(b: ZihinDuvariBaglami): ZihinDuvariKancalari & { durdur(): void } {
  const { sema, gunluk } = b;

  // Devre kesik olduğu sürece şemada GÖRÜNSÜN: sessizce beklemek, arızanın
  // kendisinden beter. Sayaç saniye saniye iner.
  const kesikSaati = setInterval(() => {
    const kalan = b.kesikSn();
    if (kalan > 0) {
      sema.ariza("beyin", true, `kesik ${kalan} sn`);
      sema.durumYaz(`düşünce kapalı — ${kalan} sn sonra yeniden denenecek`);
    }
  }, 1000);

  // ZİHİN AKIŞI GÜNLÜĞE (spec 13 Faz 5): karar kaydı burada kurulup köprüye verilir
  // (köprünün kendi kurduğunun aynısı: konsola `[KARAR]`, host dosyaya yazar) ve canlı
  // akışı günlüğe Türkçe satır olarak düşer — neyin uyandırdığı, hangi kural, kim, ne
  // kadar, ne seçildi. Yalnız gözlem: kayıt ve köprü davranışı değişmez.
  const kararKaydi = new KararKaydi();
  const gunlukBicim = gunlukBicimleyiciKur();
  kararKaydi.dinle((s) => {
    try {
      const g = gunlukBicim.satir(s);
      if (g) gunluk.ekle(g.seviye, g.kaynak, g.metin);
    } catch (err) { console.error("[GUNLUK] kayit satiri bicimlenemedi:", err); }
  });

  // CANLI SATIR: Orion'un şu anki hâli (anlık benlikten), 4 Hz; değişmediyse çizilmez.
  const canliSaat = setInterval(() => {
    const kopru = b.kopru();
    if (!kopru) return;
    const bn = kopru.benlik.oku();
    const d = durumSatiri(bn);
    gunluk.canli(gunlukBicim.elenen ? `${d.metin}  · elenen algı ${gunlukBicim.elenen}` : d.metin, d.ton);
    // ŞEMA (spec 12 §4.5'in sade hâli): DÜŞÜNCE hapında canlı saniye, alt şeritte BENLİK
    // satırı. Devre kesikken alt şerit kesiğin mesajında kalır (o daha önemli).
    if (bn.dusunce.uyanik) {
      sema.not("beyin", `${b.kisaAd(bn.dusunce.beyin)} · düşünüyor ${((bn.an - bn.dusunce.basladi) / 1000).toFixed(1).replace(".", ",")} sn`);
    }
    if (b.kesikSn() === 0) sema.durumYaz(`benlik · ${d.metin}`);
  }, 250);

  // HAFIZA GÖRÜNÜMÜ (spec 13 Faz 5): şemada HAFIZA'ya girince üç kabuklu bulut — her
  // kelime gerçek bir kayıt (mind/hafizaGorunumu.ts). Yalnız okuma.
  const icguduListesi = Object.entries(ICGUDULER).map(([id, v]) => ({ id, aciklama: v.aciklama, ezilebilir: v.ezilebilir }));
  sema.hafizaBagla(() => {
    const kopru = b.kopru();
    if (!kopru) return [];
    const h = kopru.hafizaGorunumu();
    return hafizaKelimeleri({
      icguduler: icguduListesi, benlik: kopru.benlik.oku(), calisma: h.calisma, gecmis: h.gecmis,
      derin: h.derin, getirilen: h.getirilen, simdi: Date.now(), durum: h.durum,
    });
  }, () => b.kopru()?.hafiza.sayi ?? 0);

  return {
    kararKaydi,
    /** Sayaçları durdurur (testler; uygulama ömür boyu açık tutar). */
    durdur: () => { clearInterval(kesikSaati); clearInterval(canliSaat); },
    // İÇ SES (spec 13): sesli okunmayan söz ve düz metin günlükte görünür — Orion'un
    // ne düşündüğü, hareket zincirinde ne demeyi seçtiği.
    icSesDinle: (metin) => gunluk.ekle("bilgi", "iç ses", metin.slice(0, 200)),
    // "Söyledi ama yapmadı" (mind/sozEylem.ts): Ozyn'in gördüğü yerde, yalnız gözlem.
    sozEylemDinle: (eksik, soz) =>
      gunluk.ekle("uyari", "söz-eylem", `"${soz.slice(0, 60)}" dedi ama ${eksik.join(", ")} yapmadı`),
    // Şemanın bulut lobu: düşünme başladı/bitti ve hafıza getirimi.
    asamaDinle: (asama, not) => {
      if (asama === "beyin") { sema.vur("beyin", "düşünüyor…"); sema.durumYaz("düşünüyor"); return; }
      if (asama === "beyin:bitti") {
        sema.vur("beyin", not ?? "");
        sema.durumYaz(`son düşünce ${not ?? "?"}`);
        return;
      }
      sema.vur(asama, not);
    },
  };
}
