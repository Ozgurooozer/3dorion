// uygulama/yapi/rig/rigPaneli.ts — RİG PANELİ (spec 38 §6, §8): gizmo kipi (Döndür / Taşı / Ölçek) ve yönü (Gövde / Dünya), kontroller GRUPLAR hâlinde, grup işlemleri
// (sıfırla, sol↔sağ yansıt), poz kopyala/yapıştır, seçili kontrolün kaydırıcılı ve sayılı alanları. DOM katmanı; iş `RigKipi`de (rigKipi.ts).
//
// KURAL: her değişiklik playhead karesine ANAHTAR yazar (auto-key) ve TEK geri al adımıdır. Kaydırıcı sürülürken yalnız ÖNİZLEME (geri al yığınına girmez), bırakınca
// yazılır. Sayı kutusu "1+1"i reddeder (`sayiAlani.ts`). ÖLÇEK kipi biçimde ölçek kanalı olmadığından KAPALI ve nedeni söylenir (sahte düğme yok). TAŞI yalnız Pelvis (kök)
// için çalışır; diğer kontroller için nedeni söyler (el/ayak taşımak IK ister).
"use strict";
import { KONTROL_GRUPLARI, RIG_EKSENLERI, dereceYazisi, grupBul, kontrolBul, type RigEkseni } from "../../../world/avatar/index.ts";
import { sayiMetniCoz } from "../../duzenleyici/sayiAlani.ts";
import type { RigKipi } from "../../rig/rigKipi.ts";
import { dugmeYap, el } from "../ortak/dom.ts";

const dugme = dugmeYap("sk-dugme");

const EKSEN_ADI: Record<RigEkseni, string> = { x: "X · yan eksen (öne/arkaya)", y: "Y · dik eksen (sağa/sola)", z: "Z · ön eksen (yana yatır)" };
const OTELEME_ADI: Record<RigEkseni, string> = { x: "X · sağa/sola", y: "Y · yukarı/aşağı", z: "Z · öne/arkaya" };
const ADIM = 5;
const ADIM_METRE = 0.05;

export interface RigPaneli { kok: HTMLElement; ciz(): void }

export function rigPaneliKur(rig: RigKipi, bildir: (m: string, tur?: "bilgi" | "iyi" | "uyari" | "hata") => void): RigPaneli {
  const kok = el("div", "rg-kok");
  const sonuc = (r: { ok: boolean; mesaj?: string }): void => { if (r.mesaj) bildir(r.mesaj, r.ok ? "bilgi" : "hata"); };

  /** Kaydırıcı + sayı kutusu + −/+ + sıfırla: bir kanalın bütün denetimleri. */
  function kanalSatiri(etiket: string, deger: number, en: number, cok: number, kaydirmaAdimi: number, ondalik: number, birim: string, canliOnizle: (n: number) => void, yaz: (n: number) => void, artir: (yon: -1 | 1) => void, sifirla: () => void): HTMLElement {
    const satir = el("div", "rg-kanal");
    const baslik = el("div", "rg-kanal-baslik"); baslik.append(el("span", "", etiket), el("span", "sk-soluk", `${deger.toFixed(ondalik)}${birim}`));
    const kay = el("input"); kay.type = "range"; kay.min = String(en); kay.max = String(cok); kay.step = String(kaydirmaAdimi); kay.value = String(deger); kay.className = "rg-kaydirici";
    kay.addEventListener("input", () => canliOnizle(Number(kay.value)));
    kay.addEventListener("change", () => yaz(Number(kay.value)));
    const girdi = el("input"); girdi.type = "text"; girdi.inputMode = "decimal"; girdi.spellcheck = false; girdi.autocomplete = "off"; girdi.value = String(Math.round(deger * 1000) / 1000); girdi.className = "rg-sayi";
    girdi.title = `${birim === "°" ? "derece" : "metre"}; Enter ya da odak kaybıyla uygulanır`;
    girdi.addEventListener("change", () => {
      const s = sayiMetniCoz(etiket, girdi.value, { en, cok });
      if (!s.ok || s.deger === undefined) { bildir(s.ok ? "boş değer: bir sayı yaz (ör. 25 ya da -12,5)" : s.hata, "hata"); ciz(); return; }
      yaz(s.deger);
    });
    girdi.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); girdi.blur(); } });
    const eksi = dugme("−", "rg-adim", "geri"), arti = dugme("+", "rg-adim", "ileri"), sf = dugme("↺", "rg-adim", "bu kanalı sıfırla");
    eksi.addEventListener("click", () => { eksi.blur(); artir(-1); }); arti.addEventListener("click", () => { arti.blur(); artir(1); }); sf.addEventListener("click", () => { sf.blur(); sifirla(); });
    const alt = el("div", "rg-kanal-alt"); alt.append(eksi, girdi, arti, sf);
    satir.append(baslik, kay, alt);
    return satir;
  }

  function ciz(): void {
    kok.replaceChildren();
    if (!rig.acikMi()) {
      kok.append(el("div", "sk-baslik2", "Rig kapalı"), el("div", "sk-soluk", "Araç çubuğundaki 🦴 Rig düğmesi karakteri Control Rig kipine alır: sahnede şekillere tıklayıp döndürürsün, değişiklik playhead karesine anahtar olur."));
      return;
    }
    const b = rig.baglama();
    const secili = rig.secili();
    const anahtarli = rig.anahtarliUzuvlar();
    kok.append(el("div", "sk-baslik2", `Control Rig · ${b?.ajan ?? ""}`));

    // ── Gizmo: kip ve yön ──
    const kipSatiri = el("div", "rg-segment");
    kipSatiri.append(el("span", "rg-etiket", "Gizmo"));
    const kipDugmesi = (ad: string, k: "dondur" | "tasi", ipucu: string): HTMLButtonElement => {
      const d = dugme(ad, "rg-seg", ipucu); d.dataset.secili = rig.kip() === k ? "1" : "0";
      d.addEventListener("click", () => { d.blur(); rig.kipAyarla(k); }); return d;
    };
    const olcek = dugme("⤢ Ölçek", "rg-seg", "Kapalı: sekans biçiminde ölçek kanalı YOK (yalnız dönme ve kökte öteleme). Eklemek biçim ve sürücü değişikliği ister."); olcek.disabled = true;
    kipSatiri.append(kipDugmesi("🔄 Döndür", "dondur", "Halkaları sürükle: X kırmızı, Y yeşil, Z mavi"), kipDugmesi("✥ Taşı", "tasi", "Oklar: Pelvis'i (kök) taşır, bütün beden gider"), olcek);
    const uzaySatiri = el("div", "rg-segment");
    uzaySatiri.append(el("span", "rg-etiket", "Yön"));
    for (const [u, ad, ipucu] of [["govde", "Gövde", "Eksenler gövdeyle döner (animasyon eksenleri)"], ["dunya", "Dünya", "Eksenler sahneye sabit: dünya X/Y/Z"]] as const) {
      const d = dugme(ad, "rg-seg", ipucu); d.dataset.secili = rig.uzay() === u ? "1" : "0";
      d.addEventListener("click", () => { d.blur(); rig.uzayAyarla(u); }); uzaySatiri.append(d);
    }
    kok.append(kipSatiri, uzaySatiri);

    // ── Gruplar ──
    kok.append(el("div", "sk-baslik2", "Gruplar"));
    const liste = el("div", "rg-gruplar");
    for (const g of KONTROL_GRUPLARI) {
      const kutu = el("div", "rg-grup");
      const ust = el("div", "rg-grup-ust");
      ust.append(el("span", "rg-grup-ad", g.ad));
      const sifirla = dugme("Sıfırla", "rg-mini", `${g.ad}: bu karedeki değerleri 0 yap (tek geri al adımı)`);
      sifirla.addEventListener("click", () => { sifirla.blur(); sonuc(rig.grubuSifirla(g.id)); });
      ust.append(sifirla);
      if (g.karsi) {
        const kars = grupBul(g.karsi);
        const yansit = dugme(`⇄ ${kars?.ad.split(" ").pop() ?? ""}`, "rg-mini", `${g.ad} duruşunu ${kars?.ad ?? "karşı tarafa"} YANSIT (bu karede; y ve z işaret değiştirir)`);
        yansit.addEventListener("click", () => { yansit.blur(); sonuc(rig.grubuYansit(g.id)); });
        ust.append(yansit);
      }
      kutu.append(ust);
      const cipler = el("div", "rg-cipler");
      for (const u of g.uzuvlar) {
        const k = kontrolBul(`k_${u}`);
        if (!k) continue;
        const d = dugme(`${anahtarli.has(u) ? "◆ " : ""}${k.ad.replace(/^(Sağ|Sol) /, "")}`, "rg-kontrol", `${k.ad} kontrolünü seç${anahtarli.has(u) ? " · bu karede anahtarı var" : ""}`);
        d.dataset.taraf = k.taraf; d.dataset.secili = secili?.id === k.id ? "1" : "0"; d.dataset.anahtar = anahtarli.has(u) ? "1" : "0";
        d.addEventListener("click", () => { d.blur(); rig.sec(k.id); });
        cipler.append(d);
      }
      kutu.append(cipler);
      liste.append(kutu);
    }
    kok.append(liste);

    // ── Poz (bütün beden) ──
    kok.append(el("div", "sk-baslik2", "Poz · bu kare"));
    const pozSatiri = el("div", "kp-satir");
    const kop = dugme("Pozu kopyala", "", "Bu karedeki bütün bedenin duruşunu panoya al"), yap = dugme("Yapıştır", "", "Panodaki duruşu bu kareye yaz (playhead'i istediğin kareye al)"), tum = dugme("Hepsini sıfırla", "", "Bütün bedeni bu karede 0 yap");
    yap.disabled = !rig.panoVar();
    kop.addEventListener("click", () => { kop.blur(); sonuc(rig.pozKopyala()); }); yap.addEventListener("click", () => { yap.blur(); sonuc(rig.pozYapistir()); }); tum.addEventListener("click", () => { tum.blur(); sonuc(rig.bedeniSifirla()); });
    pozSatiri.append(kop, yap, tum);
    kok.append(pozSatiri);

    if (!secili) {
      kok.append(el("div", "sk-soluk", "Bir kontrol seç: sahnede renkli şekle tıkla ya da yukarıdan seç. Sonra halkaları sürükle (Döndür) ya da aşağıdaki kaydırıcı ve sayıları kullan."));
      return;
    }

    // ── Seçili kontrol ──
    kok.append(el("div", "sk-baslik2", `${secili.ad} · ${rig.kip() === "tasi" ? "konum" : "dönme"} (playhead karesinde)`));
    if (rig.kip() === "tasi") {
      const t = rig.tasimaDestegi(), o = rig.seciliOteleme();
      if (!t.ok || !o) { kok.append(el("div", "sk-uyari", `✥ Taşı: ${t.neden ?? "kapalı"}`)); }
      else {
        for (const ek of RIG_EKSENLERI) {
          kok.append(kanalSatiri(OTELEME_ADI[ek], o[ek], -0.5, 0.5, 0.005, 3, " m",
            () => undefined, (n) => sonuc(rig.otelemeAyarla(ek, n)), (yon) => sonuc(rig.otelemeAyarla(ek, o[ek] + yon * ADIM_METRE)), () => sonuc(rig.otelemeAyarla(ek, 0))));
        }
        kok.append(el("div", "sk-soluk", "Biçim sınırı ±0,5 m (kök ötelemesi). Büyük hareket için birden çok anahtar ya da yürüyüş klibi."));
      }
    } else {
      const e = rig.seciliEuler();
      for (const ek of RIG_EKSENLERI) {
        const d = e ? e[ek] : 0;
        kok.append(kanalSatiri(EKSEN_ADI[ek], d, -180, 180, 0.5, 1, "°",
          (n) => rig.kanalOnizle(ek, n), (n) => { rig.kanalOnizleBirak(); sonuc(rig.kanalAyarla(ek, n)); }, (yon) => sonuc(rig.dondur(ek, yon * ADIM)), () => sonuc(rig.kanalAyarla(ek, 0))));
      }
      const sifirla = dugme("Bu kontrolü sıfırla", "", "Bu uzvun karedeki dönmesini 0 yap (anahtar yazar)");
      sifirla.addEventListener("click", () => { sifirla.blur(); sonuc(rig.sifirla()); });
      kok.append(sifirla);
      if (e) kok.append(el("div", "sk-soluk", `değerler: X ${dereceYazisi(e.x)} · Y ${dereceYazisi(e.y)} · Z ${dereceYazisi(e.z)} (gövde uzayı; ±düğmeleri ${rig.uzay() === "dunya" ? "DÜNYA" : "gövde"} ekseninde ${ADIM}° döndürür)`));
    }
    kok.append(el("div", rig.seciliAnahtarli() ? "sk-iyi" : "sk-soluk", rig.seciliAnahtarli() ? "◆ bu karede bu uzvun anahtarı var" : "◇ bu karede anahtar yok — bir değişiklik anahtar yazar"));
    kok.append(el("div", "sk-baslik2", "Nasıl çalışır"), el("div", "sk-soluk", "Playhead'i istediğin kareye al, kontrolü döndür: o karenin toplam dönmesi senin verdiğin olur ve izlere anahtar yazılır. Ctrl+Z geri alır. ◆ işareti bu karede anahtarı olan kontrolleri gösterir."));
  }

  rig.dinle(() => { ciz(); });
  return { kok, ciz };
}
