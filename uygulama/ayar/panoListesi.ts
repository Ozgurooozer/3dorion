// uygulama/ayar/panoListesi.ts — Devre panosu düğmelerinin ayar panelindeki satırları (Bağlam ve Refleksler bölümleri). DOM katmanı.
//
// YAZMA YOLU PANONUN KENDİSİ: serbest düğme `pano.yaz`, tehlikeli düğme `teyitIste` → uyarı (istek anında hesaplanmış) → `teyitliYaz` (jetonla);
// sınıf kapısı, aralık, tür ve `[PANO]` günlük satırı aynen geçerli. Ölçülmüş/sabit düğme salt okunur ve nedeni yazar. Mantık `ayarModelleri.ts`te.
// Duvardan ya da Zihin sekmesinden yapılan değişiklik ~1 sn içinde burada görünür (aynı tel; kopya değer tutulmaz).
"use strict";
import type { Deger, Pano } from "../../protocol/pano.ts";
import { panoSatirlari, sayiAdimi, sayiOku, type PanoSatiri } from "./ayarModelleri.ts";
import { dugme, el } from "./dom.ts";

export interface PanoListesi { tazele(): void }

export function panoListesiKur(kap: HTMLElement, pano: () => Pano | null, adlar: readonly string[], bildir: (m: string, ms?: number) => void): PanoListesi {
  const satirKabi = el("div");
  const yok = el("div", "ap-not", "Devre panosu henüz kurulmadı (beyin bağlanınca gelir).");
  kap.append(yok, satirKabi);
  interface Satir { kok: HTMLElement; deger: HTMLElement; girdi: HTMLInputElement | null; rozet: HTMLButtonElement | null; teyit: HTMLElement; mesaj: HTMLElement; s: PanoSatiri }
  const satirlar = new Map<string, Satir>();
  let bekleyenJeton: { ad: string; jeton: string } | null = null;

  function yaz(s: PanoSatiri, deger: Deger): void {
    const p = pano();
    if (!p) return;
    const r = satirlar.get(s.ad)!;
    r.mesaj.textContent = ""; r.mesaj.className = "ap-not";
    if (s.yazim === "serbest") {
      const y = p.yaz(s.ad, deger);
      if (!y.oldu) { r.mesaj.textContent = `olmadı: ${y.sebep}`; r.mesaj.className = "ap-hata"; }
      tazele();
      return;
    }
    if (s.yazim !== "teyit") return;
    const bekleyen = p.bekleyenTeyit();
    if (bekleyen && bekleyen.dugmeAdi === s.ad) p.teyitIptal();   // aynı soru, yeni cevap (M seçicideki kural)
    const t = p.teyitIste(s.ad, deger);
    if (t.sebep !== "teyit bekleniyor") { r.mesaj.textContent = `olmadı: ${t.sebep}`; r.mesaj.className = "ap-hata"; tazele(); return; }
    const acilan = p.bekleyenTeyit();
    if (!acilan || acilan.dugmeAdi !== s.ad) { r.mesaj.textContent = "teyit açılamadı"; r.mesaj.className = "ap-hata"; return; }
    bekleyenJeton = { ad: s.ad, jeton: acilan.jeton };
    const tuslar = el("div", "ap-satir");
    r.teyit.replaceChildren(el("div", "ap-uyari", `${String(acilan.eski)} → ${String(acilan.yeni)}: ${acilan.uyari}`), tuslar);
    const onay = dugme("Onayla", "değişikliği uygula (30 sn içinde)", () => {
      const sonuc = p.teyitliYaz(acilan.jeton);
      bekleyenJeton = null; r.teyit.replaceChildren();
      if (!sonuc.oldu) { r.mesaj.textContent = `olmadı: ${sonuc.sebep}`; r.mesaj.className = "ap-hata"; }
      else bildir(`${s.etiket} = ${String(sonuc.deger)}`, 1800);
      tazele();
    });
    onay.dataset.ton = "uyari";
    tuslar.append(onay, dugme("Vazgeç", "teyidi düşür", () => { p.teyitIptal(); bekleyenJeton = null; r.teyit.replaceChildren(); tazele(); }));
    tazele();
  }

  function satirKur(s: PanoSatiri): Satir {
    const kok = el("div");
    const ust = el("div", "ap-satir");
    const etiket = el("span", "ap-etiket", s.etiket);
    etiket.title = s.aciklama;
    ust.append(etiket);
    const deger = el("span", "ap-birim");
    let girdi: HTMLInputElement | null = null;
    let rozet: HTMLButtonElement | null = null;
    if (s.tur === "sayi" && s.yazim !== "yok") {
      const eksi = dugme("−", `azalt (${s.adim} ${s.birim})`, () => { const g = satirlar.get(s.ad)!.s; if (typeof g.deger === "number") yaz(g, sayiAdimi(g.deger, g.adim, -1, g.aralik)); });
      girdi = el("input"); girdi.type = "number"; girdi.step = String(s.adim);
      if (s.aralik) { girdi.min = String(s.aralik.en); girdi.max = String(s.aralik.cok); }
      girdi.title = s.aralik ? `${s.aralik.en}–${s.aralik.cok} ${s.birim}` : s.birim;
      const g0 = girdi;
      const uygula = () => {
        const g = satirlar.get(s.ad)!.s;
        const r = sayiOku(g0.value, g.aralik);
        if ("hata" in r) { satirlar.get(s.ad)!.mesaj.textContent = r.hata; satirlar.get(s.ad)!.mesaj.className = "ap-hata"; return; }
        if (r.deger !== g.deger) yaz(g, r.deger);
      };
      girdi.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); uygula(); g0.blur(); } });
      girdi.addEventListener("change", uygula);
      const arti = dugme("+", `artır (${s.adim} ${s.birim})`, () => { const g = satirlar.get(s.ad)!.s; if (typeof g.deger === "number") yaz(g, sayiAdimi(g.deger, g.adim, 1, g.aralik)); });
      ust.append(eksi, girdi, arti, deger);
    } else if (s.tur === "anahtar") {
      rozet = el("button", "ap-rozet"); rozet.type = "button";
      rozet.disabled = s.yazim === "yok";
      rozet.addEventListener("click", () => { const g = satirlar.get(s.ad)!.s; yaz(g, g.deger !== true); });
      ust.append(rozet);
    } else {
      ust.append(deger);
    }
    const not = el("div", "ap-not", s.yazim === "yok" && s.neden ? `🔒 ${s.neden}` : "");
    const mesaj = el("div", "ap-not");
    const teyit = el("div");
    kok.append(ust, not, teyit, mesaj);
    return { kok, deger, girdi, rozet, teyit, mesaj, s };
  }

  function tazele(): void {
    const p = pano();
    yok.style.display = p ? "none" : "";
    if (!p) return;
    const liste = panoSatirlari(p, adlar);
    const dugumler: HTMLElement[] = [];
    for (const s of liste) {
      let r = satirlar.get(s.ad);
      if (!r || r.s.yazim !== s.yazim || r.s.tur !== s.tur) { r = satirKur(s); satirlar.set(s.ad, r); }
      r.s = s;
      const metin = s.hata ? `okunamadı: ${s.hata}` : s.deger === null ? "—" : String(s.deger);
      if (r.girdi) {
        if (document.activeElement !== r.girdi) r.girdi.value = typeof s.deger === "number" ? String(s.deger) : "";
        r.deger.textContent = s.birim;
      } else if (r.rozet) {
        r.rozet.textContent = s.deger === true ? "● açık" : "○ kapalı";
        r.rozet.dataset.acik = s.deger === true ? "1" : "0";
        r.rozet.title = s.yazim === "yok" ? s.neden : s.deger === true ? "tıkla: kapat" : "tıkla: aç";
      } else {
        r.deger.textContent = `${metin}${s.birim ? ` ${s.birim}` : ""}`;
      }
      // Teyit süresi dolduysa (30 sn) ya da başka yerden düştüyse kutu kalkar: ekranda bayat bir "Onayla" durmasın.
      if (bekleyenJeton?.ad === s.ad && p.bekleyenTeyit()?.jeton !== bekleyenJeton.jeton) { bekleyenJeton = null; r.teyit.replaceChildren(); }
      dugumler.push(r.kok);
    }
    const ayni = dugumler.length === satirKabi.children.length && dugumler.every((x, i) => satirKabi.children[i] === x);
    if (!ayni) satirKabi.replaceChildren(...dugumler);
  }

  tazele();
  return { tazele };
}
