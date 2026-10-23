// uygulama/yapi/rig/rigPaneli.ts — RİG PANELİ (spec 38 §6): kontrolleri zincir zincir listeler (sahnede şekle tıklamanın yerine/yanına), seçili kontrolün
// üç dönme kanalını sayı kutusu ve ± düğmeleriyle düzenletir, anahtarı gösterir. DOM katmanı; iş `RigKipi`de (rigKipi.ts).
//
// KURAL: her değişiklik playhead karesine ANAHTAR yazar (auto-key) ve TEK geri al adımıdır. Panel yalnız komut verir (`dondur`, `kanalAyarla`, `sifirla`),
// sekansa kendisi yazmaz. Sayı kutusu "1+1"i reddeder (dokunulmaz alan kuralı `sayiAlani.ts`).
"use strict";
import { KONTROLLER, RIG_EKSENLERI, ZINCIR_ADLARI, dereceYazisi, zincirKontrolleri, type RigEkseni } from "../../../world/avatar/index.ts";
import { sayiMetniCoz } from "../../duzenleyici/sayiAlani.ts";
import type { RigKipi } from "../../rig/rigKipi.ts";
import { dugmeYap, el } from "../ortak/dom.ts";

const dugme = dugmeYap("sk-dugme");

const ZINCIR_ETIKETI: Record<string, string> = {
  omurga: "Omurga", bas_boyun: "Baş · boyun", sol_kol: "Sol kol", sag_kol: "Sağ kol", sol_bacak: "Sol bacak", sag_bacak: "Sağ bacak",
};
const EKSEN_ADI: Record<RigEkseni, string> = { x: "X · yan eksen (öne/arkaya)", y: "Y · dik eksen (sağa/sola)", z: "Z · ön eksen (yana yatır)" };
const ADIM = 5;

export interface RigPaneli {
  kok: HTMLElement;
  ciz(): void;
}

export function rigPaneliKur(rig: RigKipi, bildir: (m: string, tur?: "bilgi" | "iyi" | "uyari" | "hata") => void): RigPaneli {
  const kok = el("div", "rg-kok");

  function sonuc(r: { ok: boolean; mesaj?: string }): void { if (r.mesaj) bildir(r.mesaj, r.ok ? "bilgi" : "hata"); }

  function ciz(): void {
    kok.replaceChildren();
    if (!rig.acikMi()) {
      kok.append(el("div", "sk-baslik2", "Rig kapalı"), el("div", "sk-soluk", "Araç çubuğundaki 🦴 Rig düğmesi karakteri Control Rig kipine alır: sahnede şekillere tıklayıp döndürürsün, değişiklik playhead karesine anahtar olur."));
      return;
    }
    const b = rig.baglama();
    kok.append(el("div", "sk-baslik2", `Control Rig · ${b?.ajan ?? ""}`));

    // Zincir zincir kontrol listesi (kimlikle seçim; sahnede şekle tıklamanın aynısı).
    const secili = rig.secili();
    const liste = el("div", "rg-liste");
    for (const zad of ZINCIR_ADLARI) {
      const satir = el("div", "rg-zincir");
      satir.append(el("span", "rg-zad", ZINCIR_ETIKETI[zad] ?? zad));
      for (const k of zincirKontrolleri(zad)) {
        const d = dugme(k.ad.replace(/^(Sağ|Sol) /, ""), "rg-kontrol");
        d.dataset.taraf = k.taraf; d.dataset.secili = secili?.id === k.id ? "1" : "0"; d.title = `${k.ad} kontrolünü seç`;
        d.addEventListener("click", () => { d.blur(); rig.sec(k.id); });
        satir.append(d);
      }
      liste.append(satir);
    }
    const pelvis = KONTROLLER.find((k) => k.zincir === null);
    if (pelvis) {
      const satir = el("div", "rg-zincir");
      satir.append(el("span", "rg-zad", "Kök"));
      const d = dugme(pelvis.ad, "rg-kontrol"); d.dataset.taraf = pelvis.taraf; d.dataset.secili = secili?.id === pelvis.id ? "1" : "0";
      d.addEventListener("click", () => { d.blur(); rig.sec(pelvis.id); });
      satir.append(d); liste.prepend(satir);
    }
    kok.append(liste);

    if (!secili) {
      kok.append(el("div", "sk-soluk", "Bir kontrol seç: sahnede renkli şekle tıkla ya da yukarıdan seç. Sonra halkaları sürükle (X kırmızı, Y yeşil, Z mavi) ya da aşağıya sayı yaz."));
      return;
    }
    const e = rig.seciliEuler();
    kok.append(el("div", "sk-baslik2", `${secili.ad} · dönme (playhead karesinde)`));
    const alanlar = el("div", "rg-alanlar");
    for (const ek of RIG_EKSENLERI) {
      const girdi = el("input"); girdi.type = "text"; girdi.inputMode = "decimal"; girdi.spellcheck = false; girdi.autocomplete = "off";
      girdi.value = e ? String(Math.round(e[ek] * 10) / 10) : "0";
      girdi.title = "derece; Enter ya da odak kaybıyla uygulanır";
      girdi.addEventListener("change", () => {
        const s = sayiMetniCoz(`donme_${ek}`, girdi.value, { en: -180, cok: 180 });
        if (!s.ok || s.deger === undefined) { bildir(s.ok ? "boş değer: bir sayı yaz (ör. 25 ya da -12,5)" : s.hata, "hata"); ciz(); return; }
        sonuc(rig.kanalAyarla(ek, s.deger));
      });
      girdi.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); girdi.blur(); } });
      const eksi = dugme("−", "rg-adim", `${ADIM}° geri döndür`), arti = dugme("+", "rg-adim", `${ADIM}° ileri döndür`);
      eksi.addEventListener("click", () => { eksi.blur(); sonuc(rig.dondur(ek, -ADIM)); });
      arti.addEventListener("click", () => { arti.blur(); sonuc(rig.dondur(ek, ADIM)); });
      alanlar.append(el("label", "", EKSEN_ADI[ek]), eksi, girdi, arti, el("small", "sk-soluk", e ? dereceYazisi(e[ek]) : ""));
    }
    kok.append(alanlar);
    const sifirla = dugme("Sıfırla", "", "Bu uzvun playhead karesindeki dönmesini 0 yap (anahtar yazar)");
    sifirla.addEventListener("click", () => { sifirla.blur(); sonuc(rig.sifirla()); });
    kok.append(el("div", rig.seciliAnahtarli() ? "sk-iyi" : "sk-soluk", rig.seciliAnahtarli() ? "◆ bu karede bu uzvun anahtarı var" : "◇ bu karede anahtar yok — bir değişiklik anahtar yazar"), sifirla);
    kok.append(el("div", "sk-baslik2", "Nasıl çalışır"), el("div", "sk-soluk", "Playhead'i istediğin kareye al, kontrolü döndür: o karenin toplam dönmesi senin verdiğin olur ve izlere anahtar yazılır. Ctrl+Z geri alır. Kimodo sekansları 64 izle gelir; sahnede göreceğin poz o karedeki gerçek değerdir."));
  }

  rig.dinle(() => { ciz(); });
  return { kok, ciz };
}
