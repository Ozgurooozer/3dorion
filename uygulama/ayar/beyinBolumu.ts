// uygulama/ayar/beyinBolumu.ts — AYAR PANELİ · BEYİN MODELİ bölümü: açılır liste, M seçiciyle AYNI kaynak (spec 34). DOM katmanı.
//
// İkinci bir seçim yolu YOK: liste `seciciKaynagiKur`un (uygulama/beyinSecimi.ts) kartlarından kurulur, seçim onun `sec`inden — yani devre panosunun
// `beyin.model` teyit yolundan — geçer. M penceresinin sürtünmesi de aynı: listeden seçmek geçişi KURAR ve bedeli söyler ("sohbet geçmişi taşınmaz"),
// "Geç" düğmesi geçer. Sağlık kontrolü sürerken/reddedilince durum satırı canlı söyler (panel ~1 sn'de bir tazeler).
"use strict";
import type { AyarBolumu } from "../../world/arayuz/ayarPaneli.ts";
import type { ModelSeciciKaynagi } from "../../world/arayuz/modelSeciciCekirdek.ts";
import { beyinGorunumu } from "./ayarModelleri.ts";
import { dugme, el } from "./dom.ts";

export interface BeyinBolumuAyari {
  /** M seçicinin kaynağı (beyin bağlanınca kurulur; o zamana dek null). */
  kaynak: () => ModelSeciciKaynagi | null;
  /** M penceresini aç (kartlar, API anahtarı, süzgeç). */
  pencereAc: () => void;
}

export function beyinBolumu(a: BeyinBolumuAyari): AyarBolumu {
  return {
    id: "beyin", ad: "Beyin modeli", simge: "💭", sira: 10, acik: true, ajanlar: ["orion"],
    ipucu: "Düşünceyi hangi modelin ürettiği — M penceresiyle aynı seçim (devre panosunun teyit yolu)",
    ozet: () => {
      const k = a.kaynak();
      if (!k) return "bağlanıyor…";
      const d = k.durum();
      return k.kartlar().find((x) => x.ad === d.aktif)?.baslik ?? d.aktif;
    },
    kur(govde, arac) {
      const secim = el("select");
      secim.setAttribute("aria-label", "düşünce modeli");
      const durum = el("div", "ap-not");
      const kurulu = el("div");
      const tuslar = el("div", "ap-satir");
      const tara = dugme("↻ Tara", "Ollama ve bulut modellerini yeniden tara", () => {
        const k = a.kaynak(); if (!k) return;
        tara.disabled = true; tara.textContent = "↻ taranıyor…";
        void k.yenile().finally(() => { tara.disabled = false; tara.textContent = "↻ Tara"; tazele(); });
      });
      tuslar.append(tara, dugme("Ayrıntılı seçici (M)", "kartlar, rozetler, API anahtarı", a.pencereAc));
      govde.append(secim, durum, kurulu, tuslar);

      let anahtar = "";
      let bekleyen: string | null = null;
      let mesaj: { metin: string; sinif: string } | null = null;

      const kurulumuKapat = () => { bekleyen = null; kurulu.replaceChildren(); };
      secim.addEventListener("change", () => {
        const k = a.kaynak(); if (!k) return;
        const ad = secim.value;
        if (ad === k.durum().aktif) { kurulumuKapat(); return; }
        bekleyen = ad;
        mesaj = null;
        const baslik = k.kartlar().find((x) => x.ad === ad)?.baslik ?? ad;
        const gec = dugme("Geç", "geçişi başlat (önce sağlık kontrolü)", () => {
          const red = k.sec(ad);
          kurulumuKapat();
          mesaj = red ? { metin: `reddedildi: ${red}`, sinif: "ap-hata" } : { metin: `${baslik} için sağlık kontrolü başladı…`, sinif: "ap-not" };
          if (!red) arac.bildir(`beyin: ${baslik} deneniyor`, 1800);
          tazele();
        });
        gec.dataset.ton = "uyari";
        const satir = el("div", "ap-satir");
        satir.append(gec, dugme("Vazgeç", "seçimi geri al", () => { kurulumuKapat(); tazele(); }));
        kurulu.replaceChildren(el("div", "ap-uyari", `${baslik} seçilecek. Sohbet geçmişi yeni beyne TAŞINMAZ; sağlık kontrolü geçmezse mevcut beyin kalır.`), satir);
      });

      function tazele(): void {
        const k = a.kaynak();
        secim.disabled = !k;
        if (!k) { durum.textContent = "Beyin henüz bağlanmadı."; return; }
        const g = beyinGorunumu(k.kartlar(), k.durum());
        // Liste yalnız seçenekler değişince yeniden kurulur (açık açılır listeyi her saniye kapatmamak için).
        const yeni = JSON.stringify(g.gruplar);
        if (yeni !== anahtar) {
          anahtar = yeni;
          secim.replaceChildren(...g.gruplar.map((gr) => {
            const og = el("optgroup"); og.label = gr.baslik;
            og.append(...gr.secenekler.map((s) => { const o = el("option", "", s.etiket); o.value = s.ad; o.disabled = !s.uygun; return o; }));
            return og;
          }));
        }
        if (bekleyen === null && document.activeElement !== secim) secim.value = g.secili;
        if (mesaj && k.durum().gecis !== "kontrol") mesaj = null;   // kontrol bitti: sonuç durum satırında
        durum.textContent = mesaj?.metin ?? g.durum;
        durum.className = mesaj?.sinif ?? (g.ton === "kotu" ? "ap-hata" : "ap-not");
      }
      return { goster: tazele, tazele };
    },
  };
}
