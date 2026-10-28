// uygulama/eklentiler/mevcutOzellikler.ts — MEVCUT MOTOR ÖZELLİKLERİ, EKLENTİ OLARAK (spec 40 E3): hafıza yönlendirici, ajanda, Flash, İçerik/Outliner/Önizleme panelleri.
//
// DAVRANIŞ DEĞİŞMEZ: hepsi varsayılan AÇIK (bugünkü motor). Mantık TAŞINMADI; her özelliğin kurulduğu yere tek bir kapı kondu:
//   hafıza yönlendirici  → açılışta `hafizaKipi` (giris.ts HAFIZA_KIPI); yeniden başlat etkili (üç yerde kurulum zamanı okunuyor: köprü, yakın pencere, dünya durumu)
//   ajanda               → `ajanda.tikle` çağrısı eklentiye bakar; anında
//   flash                → ikinci bedenin kurulumu eklentiye bakar; yeniden başlat etkili (beden/sandalye/ajan kaydı kurulumda)
//   paneller             → `DokYoneticisi.gorunur`; anında (kapalıyken panel menüde pasif, I tuşu ve çift tık nedenini söyler)
// `?hafiza=otomatik`, `?flashsiz` ve senaryo kuralları ESKİSİ GİBİ geçerli kalır (eklenti açık olsa bile).
"use strict";
import type { Eklenti } from "../eklenti/eklentiDefteri.ts";

/** Dok yüzünden yalnız `gorunur` gerekir (test sahtesi küçük kalsın). */
export interface DokGorunurluk { gorunur(id: string, g: boolean): void }

export const HAFIZA_YONLENDIRICI = "hafiza-yonlendirici";
export const AJANDA = "ajanda";
export const FLASH_EKLENTISI = "flash";
export const PANEL_ICERIK = "panel-icerik";
export const PANEL_OUTLINER = "panel-outliner";
export const PANEL_ONIZLEME = "panel-onizleme";

/** Dok paneli eklentisi: açıkken görünür (kayıtlıysa), kapalıyken gizli; açılışta kapalıysa `kapaliBaslat` gizler. */
function panelEklentisi(dok: DokGorunurluk, eklentiId: string, panelId: string, ad: string, aciklama: string): Eklenti {
  return {
    bildirim: { id: eklentiId, ad, aciklama, kategori: "arayuz", varsayilan: "acik", etki: "aninda" },
    kur: () => { dok.gorunur(panelId, true); return { kapat: () => dok.gorunur(panelId, false) }; },
    kapaliBaslat: () => dok.gorunur(panelId, false),
  };
}

export function mevcutEklentiler(g: { dok: DokGorunurluk }): Eklenti[] {
  return [
    {
      bildirim: {
        id: HAFIZA_YONLENDIRICI, ad: "Hafıza yönlendirici", kategori: "zihin", varsayilan: "acik", etki: "yeniden_baslat",
        aciklama: "Bağlama yalnız sorulan girer (spec 16): kural yönlendirici + durum defteri + çekmeceli hafıza. Kapalıyken eski 'otomatik' bağlam (her tur ortak kelimeli anılar).",
      },
    },
    {
      bildirim: {
        id: AJANDA, ad: "Ajanda (boşta jest)", kategori: "beden", varsayilan: "acik", etki: "aninda",
        aciklama: "Orion boşta kendiliğinden bakar ve küçük jestler yapar (LLM'siz içgüdü). Kapalıyken heykel gibi durur; Ozyn'in sözleri ve beyin eylemleri etkilenmez.",
      },
    },
    {
      bildirim: {
        id: FLASH_EKLENTISI, ad: "Flash (ikinci ajan)", kategori: "ajan", varsayilan: "acik", etki: "yeniden_baslat",
        aciklama: "LLM'siz NPC ajanı: ikinci beden, kendi şeması ve grafı (spec 33). Kapalıyken hiç kurulmaz (daha az yük).",
      },
    },
    panelEklentisi(g.dok, PANEL_ICERIK, "icerik", "İçerik gezgini paneli", "Content Browser: proje ve motor dosyaları (I tuşu). Kapalıyken panel gizli."),
    panelEklentisi(g.dok, PANEL_OUTLINER, "outliner", "Outliner paneli", "Level Outliner: sahnedeki nesneler. Kapalıyken panel gizli."),
    panelEklentisi(g.dok, PANEL_ONIZLEME, "varlik-onizleme", "Varlık önizleme penceresi", "Karakter/glb/görsel önizleme (İçerik gezgininde çift tık). Kapalıyken açılmaz."),
  ];
}
