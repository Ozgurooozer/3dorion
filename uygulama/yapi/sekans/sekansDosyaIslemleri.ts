// uygulama/yapi/sekans/sekansDosyaIslemleri.ts — SEKANS EDİTÖRÜNDE DOSYA OLAYLARI (spec 36 S2): dosya dışarıda değişti/silindi (JSON penceresi, Sekans
// sekmesi), yeniden adlandırma ve kopya. DOM'suz denetim parçası (editörden ayrıldı: sekansEditoru.ts ≈300 satırı geçmesin).
//
// Kurallar graf editörününkiyle aynı (yapi/graf/sekmeDosyalari.ts): kirli olmayan açık sekme diskteki hâle KENDİLİĞİNDEN yenilenir; kirliyse bant
// ("Diskteki hâli al / Benimkini koru") — Ozyn'in değişikliği sessizce ezilmez; silinen dosyanın sekmesi kaydedilemez (Kopyasını oluştur). Yeniden adlandırma
// kirli sekmede ya da sekans oynarken reddedilir; iş deponun ortak çekirdeğinde (yeni + kaldır, kalıcı silme yok).
"use strict";
import type { SekmeListesi } from "../../duzenleyici/sekmeler.ts";
import type { SekansDeposu } from "../../sekans/sekansDeposu.ts";
import type { SekansOynatici } from "../../sekans/oynatici.ts";
import type { SekansOturumu } from "../../sekans/editor/sekansOturumu.ts";

export interface SekansDosyaAyari {
  sekmeler: SekmeListesi<SekansOturumu>;
  depo: SekansDeposu;
  oynatici: SekansOynatici;
  degisti(): void;
}

export function sekansDosyaIslemleriKur(a: SekansDosyaAyari): { yenidenAdlandir(eski: string, yeni: string): Promise<void>; kopyasiniOlustur(ad: string, yeni: string): Promise<void> } {
  a.depo.dinle((olay) => {
    if (olay.tur === "icerik") {
      const s = a.sekmeler.al(olay.ad), yeni = a.depo.al(olay.ad);
      if (!s || !yeni) return;
      const o = s.icerik;
      // Editörün kendi kaydı da "icerik" yayar: diskteki hâl ekrandakiyle aynıysa dokunulmaz.
      if (JSON.stringify(o.gecmis.simdiki()) === JSON.stringify(yeni)) { o.dis = null; a.degisti(); return; }
      if (!o.gecmis.kirli()) { o.gecmis.sifirla(yeni); o.secim = { tur: "yok" }; o.kareyeGit(o.kare); o.dis = null; }
      else o.dis = "degisti";
      a.degisti();
      return;
    }
    const adlar = new Set(a.depo.liste().map((k) => k.ad));
    for (const s of a.sekmeler.hepsi()) if (!adlar.has(s.ad)) s.icerik.dis = "silindi";
    a.degisti();
  });
  return {
    async yenidenAdlandir(eski, yeni) {
      const s = a.sekmeler.al(eski);
      if (s?.icerik.gecmis.kirli()) throw new Error(`'${eski}' sekmesinde kaydedilmemiş değişiklik var: önce Ctrl+S`);
      if (a.oynatici.durum().calisiyor?.sekans === eski) throw new Error(`'${eski}' oynuyor: önce ■`);
      await a.depo.yenidenAdlandir(eski, yeni);
      const yeniSekans = a.depo.al(yeni);
      if (s && yeniSekans) { a.sekmeler.adDegistir(eski, yeni); s.icerik.gecmis.sifirla(yeniSekans); s.icerik.dis = null; }
      a.degisti();
    },
    async kopyasiniOlustur(ad, yeni) { await a.depo.kopyasiniOlustur(ad, yeni); a.degisti(); },
  };
}
