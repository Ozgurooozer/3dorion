// uygulama/ayar/notlarBolumu.ts — AYAR PANELİ · HAFIZA NOTLARI bölümü: Orion'un md dosyaları — bağlama ekle/çıkar, düzenle (spec 34). DOM katmanı.
//
// Kopya YOK: aynı md deposu (`uygulama/mdDeposu.ts`) ve aynı düzenleyici penceresi (`ac` → editorPenceresi); simge ve bütçe uyarıları Hafıza sekmesinden
// (`mdSimgesi`, `baglamUyarilari`). Bu bölüm kısayoldur: yeni dosya, sağ tık menüsü, kopyalama Hafıza sekmesinde (düğmeyle açılır).
// Çift tık satırı düzenleyicide açar; klavyeyle aynı iş "✎" düğmesinde (çift tık klavyeyle yapılamaz).
"use strict";
import type { AyarBolumu } from "../../world/arayuz/ayarPaneli.ts";
import type { MdDeposu } from "../mdDeposu.ts";
import { baglamUyarilari, mdSimgesi } from "../yapi/hafizaSekmesi.ts";
import { dugme, el, hataMetni } from "./dom.ts";

export interface NotlarBolumuAyari {
  depo: MdDeposu;
  /** Düzenleyici penceresinde aç. */
  ac: (ad: string) => void;
  /** Yapı çubuğunda Hafıza sekmesini aç. */
  sekmeAc: () => void;
  hata: () => string | null;
}

export function notlarBolumu(a: NotlarBolumuAyari): AyarBolumu {
  return {
    id: "notlar", ad: "Hafıza notları", simge: "📄", sira: 30, ajanlar: ["orion"],
    ipucu: "Orion'un her turda okuduğu md notları: bağlama ekle/çıkar, çift tık düzenle",
    ozet: () => {
      const l = a.depo.liste();
      return l.length ? `${l.filter((d) => d.aktif).length}/${l.length} bağlamda` : "";
    },
    kur(govde, arac) {
      const liste = el("div");
      const ozet = el("div", "ap-not");
      const uyari = el("div", "ap-uyari");
      const alt = el("div", "ap-satir");
      alt.append(dugme("Hafıza sekmesinde aç", "yeni dosya, menü, kopyala: Yapı çubuğu ▸ Hafıza", a.sekmeAc));
      govde.append(liste, ozet, uyari, alt);

      function ciz(): void {
        const l = a.depo.liste();
        const b = a.depo.baglam();
        arac.ozet(l.length ? `${l.filter((d) => d.aktif).length}/${l.length} bağlamda` : "");
        ozet.textContent = l.length ? `≈${b.tahminiToken} token her turda (yalnız aktif notlar; hafızanın geri kalanı sorulunca gelir)` : "";
        uyari.textContent = baglamUyarilari(b).join(" · ");
        if (!l.length) { const h = a.hata(); liste.replaceChildren(el("div", "ap-not", h ? `Dosyalar yüklenemedi: ${h}` : "Henüz not yok — Hafıza sekmesinde ＋ Yeni dosya.")); return; }
        liste.replaceChildren(...l.map((d) => {
          const satir = el("div", "ap-satir");
          satir.title = `${d.ad}\nÇift tık: düzenle`;
          satir.addEventListener("dblclick", () => a.ac(d.ad));
          const ad = el("span", "ap-etiket", `${mdSimgesi(d)} ${d.ad}`);
          const rozet = el("button", "ap-rozet", d.aktif ? "● bağlamda" : "○ kapalı");
          rozet.type = "button";
          rozet.dataset.acik = d.aktif ? "1" : "0";
          rozet.title = d.aktif ? "Orion her turda okuyor — tıkla: çıkar" : "Orion okumuyor — tıkla: bağlama ekle";
          rozet.addEventListener("click", (e) => {
            e.stopPropagation();
            void a.depo.aktifYap(d.ad, !d.aktif).then(() => arac.bildir(!d.aktif ? `${d.ad}: Orion artık okuyor` : `${d.ad}: bağlamdan çıkarıldı`, 1800),
              (err: unknown) => arac.bildir(`${d.ad}: ${hataMetni(err)}`, 4000));
          });
          rozet.addEventListener("dblclick", (e) => e.stopPropagation());
          satir.append(ad, rozet, dugme("✎", "düzenleyicide aç", () => a.ac(d.ad)));
          return satir;
        }));
      }
      // Abonelik bölüm ömrü boyunca: Hafıza sekmesinden ya da menüden yapılan değişiklik burada da görünür.
      a.depo.dinle((o) => { if (o.tur === "liste") ciz(); });
      ciz();
      return { goster: ciz };
    },
  };
}
