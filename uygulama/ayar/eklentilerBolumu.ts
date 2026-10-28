// uygulama/ayar/eklentilerBolumu.ts — AYAR PANELİ · EKLENTİLER bölümü (spec 40): motorun açılıp kapanan parçaları. DOM katmanı; karar `uygulama/eklenti/`de.
//
// Anahtar = defterin `ac`/`kapat`ı: reddedilirse (kilit, bağımlılık, kurulamadı) NEDEN bildirilir, görünüm gerçek duruma döner (iyimser güncelleme yok).
// "Yeniden başlat" etkili eklenti kapatılınca rozet "kapanacak" der: çalışan hâl açılıştaki kalır (sahte anında yok).
"use strict";
import type { AyarBolumu } from "../../world/arayuz/ayarPaneli.ts";
import type { EklentiDefteri } from "../eklenti/eklentiDefteri.ts";
import { gruplariKur, ozetMetni } from "../eklenti/eklentiModeli.ts";
import { el } from "./dom.ts";

export function eklentilerBolumu(defter: EklentiDefteri): AyarBolumu {
  return {
    id: "eklentiler", ad: "Eklentiler", simge: "🧩", sira: 60, ajanlar: ["orion"],
    ipucu: "Motorun açılıp kapanan parçaları: zihin kipi, ajanda, Flash, paneller",
    ozet: () => ozetMetni(defter.durum()),
    kur(govde, arac) {
      const liste = el("div", "ap-eklentiler");
      govde.append(
        el("div", "ap-not", "Kapalı eklenti motorda hiç çalışmaz. 'Yeniden başlat' etiketliler açılışta kurulur: değişiklik kaydedilir, bir sonraki açılışta geçer."),
        liste,
      );
      const bildirSonuc = (s: { ok: true } | { ok: false; neden: string }): void => { if (!s.ok) arac.bildir(s.neden, 3600); };

      function ciz(): void {
        liste.replaceChildren();
        const durumlar = defter.durum();
        for (const g of gruplariKur(durumlar)) {
          liste.append(el("div", "ap-alt-baslik", g.ad));
          for (const s of g.satirlar) {
            const satir = el("div", "ap-satir"); satir.dataset.eklenti = s.id;
            const etiket = el("span", "ap-etiket", s.ad); etiket.title = `${s.aciklama}${s.engel ? `\n(${s.engel})` : ""}${s.etki === "yeniden_baslat" ? "\nyeniden başlatınca geçerli" : ""}`;
            const rozet = el("button", "ap-rozet", s.acik ? "● " + s.rozet : "○ " + s.rozet);
            rozet.type = "button"; rozet.dataset.acik = s.acik ? "1" : "0"; rozet.dataset.tur = s.rozetTuru;
            rozet.disabled = !s.degistirilebilir; rozet.title = s.engel ?? (s.acik ? "kapat" : "aç");
            rozet.addEventListener("click", (e) => { e.stopPropagation(); bildirSonuc(s.acik ? defter.kapat(s.id) : defter.ac(s.id)); });
            satir.append(etiket, rozet);
            liste.append(satir);
            if (s.secenek) {
              const sec = document.createElement("select"); sec.title = s.secenek.ad; sec.dataset.eklentiSecenek = s.id;
              for (const o of s.secenek.secenekler) { const op = document.createElement("option"); op.value = o.id; op.textContent = o.ad; op.title = o.aciklama; sec.append(op); }
              sec.value = s.secenek.secili;
              sec.addEventListener("change", () => bildirSonuc(defter.secenekYaz(s.id, sec.value)));
              liste.append(sec);
              const secili = s.secenek.secenekler.find((o) => o.id === s.secenek!.secili);
              if (secili?.aciklama) liste.append(el("div", "ap-not", secili.aciklama));
            }
            if (durumlar.find((d) => d.bildirim.id === s.id)?.hata) liste.append(el("div", "ap-not", `⚠ ${durumlar.find((d) => d.bildirim.id === s.id)!.hata}`));
          }
        }
        arac.ozet(ozetMetni(durumlar));
      }
      // Seçim kutusu açıkken yeniden çizme (açılır liste kapanır): yalnız defter değişince ve odakta değilse.
      const kes = defter.dinle(() => { if (!liste.contains(document.activeElement) || document.activeElement?.tagName !== "SELECT") ciz(); });
      ciz();
      void kes;
      return { goster: ciz, tazele: () => { if (document.activeElement?.tagName !== "SELECT") ciz(); } };
    },
  };
}
