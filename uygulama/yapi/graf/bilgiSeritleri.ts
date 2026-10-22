// uygulama/yapi/graf/bilgiSeritleri.ts — EDİTÖRÜN BİLGİ ŞERİTLERİ (spec 35 dilim 2b): ilk açılış ipucu, dış değişiklik bandı, alt şerit (mesaj + denetim
// hataları, tıkla: düğüme git) ve kısayol yardımı. DOM katmanı; içerik saf modüllerden (kısayol listesi tek kaynak: kisayollar.ts).
"use strict";
import type { Graf } from "../../../protocol/graf.ts";
import type { EditorOturumu } from "../../graf/editor/editorOturumu.ts";
import { KISAYOLLAR } from "../../graf/editor/kisayollar.ts";
import type { MesajTuru } from "./editorBaglami.ts";
import { dugme, el } from "./dom.ts";

const IPUCU_ANAHTARI = "orion.grafEditoru.ipucu.v1";

/** "Ne yapabilirim" şeridi: ilk açılışta görünür, "Anladım" saklanır (depo yoksa her açılışta görünür: zararsız, kalıcı durum değil). */
export function ipucuSeridiKur(): HTMLElement {
  const kok = el("div", "ge-ipucu");
  const gizli = (() => { try { return localStorage.getItem(IPUCU_ANAHTARI) === "1"; } catch { return false; } })();
  if (gizli) kok.style.display = "none";
  const anladim = dugme("Anladım", "", "Bu ipucunu bir daha gösterme");
  anladim.addEventListener("click", () => { kok.style.display = "none"; try { localStorage.setItem(IPUCU_ANAHTARI, "1"); } catch { /* depo yok: yalnız bu oturum */ } });
  kok.append(el("span", "", "Sağ tık ya da Boşluk: düğüm ekle · pinden sürükle: bağla (boşluğa bırak: uyan düğümler) · tekerlek: yakınlaş · F: sığdır · Ctrl+S kaydet · ▶ kaydedilmiş hâli çalıştırır · ? kısayollar"), anladim);
  return kok;
}

/** Dış değişiklik bandı: dosya editör dışında değişti (kirli sekmede) ya da kalktı. */
export function bantKur(a: { al(ad: string): Graf | null; yeniden(o: EditorOturumu, g: Graf): void; bildir(m: string): void; tazele(): void }): { kok: HTMLElement; ciz(s: { ad: string; icerik: EditorOturumu } | null): void } {
  const kok = el("div", "ge-bant");
  return {
    kok,
    ciz(s) {
      kok.replaceChildren();
      const o = s?.icerik;
      kok.dataset.acik = o?.dis ? "1" : "0";
      if (!s || !o?.dis) return;
      if (o.dis === "silindi") {
        kok.append(el("span", "", `'${s.ad}' dosyası artık yok (silindi ya da adı değişti): bu sekme kaydedilemez. Gerekirse Kopyasını oluştur.`));
        return;
      }
      const al = dugme("Diskteki hâli al", "", "Benim değişikliklerim gider (geri al yığını sıfırlanır)");
      al.addEventListener("click", () => { const g = a.al(s.ad); if (g) { a.yeniden(o, g); o.dis = null; a.bildir("diskteki hâl alındı"); a.tazele(); } });
      const koru = dugme("Benimkini koru", "", "Kaydedince benim hâlim yazılır");
      koru.addEventListener("click", () => { o.dis = null; a.tazele(); });
      kok.append(el("span", "", "Dosya editör dışında değişti (JSON penceresi ya da başka yer) ve sende kaydedilmemiş değişiklik var."), al, koru);
    },
  };
}

/** Alt şerit: son mesaj (renkli) ve denetim hataları; hatalı satıra tık düğüme götürür. */
export function altSeritKur(git: (id: string) => void): { kok: HTMLElement; bildir(m: string, tur?: MesajTuru): void; ciz(o: EditorOturumu | null): void } {
  const kok = el("div", "ge-alt");
  const mesaj = el("div", "ge-mesaj"), liste = el("div", "ge-hatalar");
  kok.append(mesaj, liste);
  return {
    kok,
    bildir(m, tur = "bilgi") { mesaj.textContent = m; mesaj.dataset.tur = tur; mesaj.title = m; },
    ciz(o) {
      liste.replaceChildren();
      if (!o) return;
      if (!o.hatalar.length) { liste.append(el("span", "ge-iyi", "✓ denetim: sorun yok")); return; }
      liste.append(el("span", "ge-hata", `✗ ${o.hatalar.length} sorun (tıkla: düğüme git)`));
      for (const h of o.hatalar) {
        const s = el("div", "", h.mesaj); s.title = h.mesaj;
        if (h.dugum) { const id = h.dugum; s.addEventListener("click", () => git(id)); }
        liste.append(s);
      }
    },
  };
}

/** Kısayol yardımı (? / F1): liste kisayollar.ts'ten. */
export function yardimKutusuKur(): { kok: HTMLElement; acikMi(): boolean; degistir(acik?: boolean): void } {
  const kok = el("div", "ge-yardim");
  const tablo = el("table");
  for (const k of KISAYOLLAR) { const tr = el("tr"); tr.append(el("td", "", k.tus), el("td", "", k.aciklama)); tablo.append(tr); }
  kok.append(el("div", "ge-baslik2", "Kısayollar"), tablo,
    el("p", "ge-soluk", "Renkler: başlık = kategori (olay, akış, ajan, dünya, veri, desen); pin = tür (akış beyaz üçgen). Kırmızı çerçeve: denetim hatası (üzerine gel)."));
  return {
    kok,
    acikMi: () => kok.dataset.acik === "1",
    degistir(acik) { kok.dataset.acik = (acik ?? kok.dataset.acik !== "1") ? "1" : "0"; },
  };
}
