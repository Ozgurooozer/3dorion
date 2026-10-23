// uygulama/yapi/sekans/kameraPaneli.ts — KAMERA SEKMESİ (spec 38 §7): isimli kameralar, kamera kesmeleri, canlı önizleme. DOM katmanı; işlemler `kameraIslemleri.ts`te
// (saf, testli), geometri `kameraYardimcilari.ts`te, sahneye vurma `kameraOynatici.ts`te.
//
// KAMERA NEREDEN GELİR: (1) oyuncunun şu anki görünümünden (editörü kapatıp kadrajı kur, tekrar aç ya da önizlemeyi kapat) — 3 m önü hedef olur; (2) Orion'un
// karşısına / yanına hazır kadraj; sonra SAYILARLA ve yörünge düğmeleriyle (◀ ▶ ▲ ▼ ＋ −) ince ayar. Önizleme canlıdır: sahne seçili kameranın gözüyle görünür.
// KESME: playhead karesine "şu kameraya geç" (ani ya da yumuşak). Kesmeler zaman çizelgesindeki 🎥 satırında da görünür, orada sürüklenir.
"use strict";
import { KAMERA_GECISLERI, type KameraGecisi, type Nokta3, type Sekans } from "../../../protocol/sekans.ts";
import { sayiMetniCoz } from "../../duzenleyici/sayiAlani.ts";
import type { KameraOynatici } from "../../sekans/kameraOynatici.ts";
import { kameraAyarla, kameraEkle, kameraSil, kesmeEkle, kesmeSil } from "../../sekans/editor/kameraIslemleri.ts";
import { kuresel, orionKarsisi, orionYanindan, YORUNGE_ADIMI, yorungele, type KameraGeometrisi } from "../../sekans/editor/kameraYardimcilari.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import type { SekansBaglami } from "./editorBaglami.ts";

const dugme = dugmeYap("sk-dugme");

export interface KameraPaneliAyari {
  b: SekansBaglami;
  /** Oyuncunun şu anki görünümü (derece görüş alanı); önizleme sürerken bu görünüm sekans kamerası olduğundan null. */
  gorunum(): { konum: Nokta3; hedef: Nokta3; fov: number } | null;
  /** Orion'un dünya konumu ve gövde yaw'ı; yoksa null. */
  orion(): { konum: { x: number; y: number; z: number }; yaw: number } | null;
  onizleme: KameraOynatici;
}

export interface KameraPaneli { kok: HTMLElement; ciz(): void; seciliKamera(): string | null; kapat(): void }

type OnizlemeKipi = "kapali" | "kamera" | "sekans";
const yuvarla = (n: number): number => Math.round(n * 100) / 100;

export function kameraPaneliKur(a: KameraPaneliAyari): KameraPaneli {
  const { b } = a;
  const kok = el("div", "kp-kok");
  let secili: string | null = null;
  let kip: OnizlemeKipi = "kapali";

  function onizlemeKur(): void {
    if (kip === "kapali") { a.onizleme.onizleme(null); return; }
    a.onizleme.onizleme(() => {
      const o = b.oturum();
      if (!o) return null;
      const s = o.sekans();
      if (kip === "sekans") return { sekans: s, kare: b.oynayanKare() ?? o.kare };
      const k = (s.kameralar ?? []).find((x) => x.id === secili);
      return k ? { sekans: { kameralar: [k], kesmeler: [{ kare: 0, kamera: k.id, gecis: "kesme", gecis_kare: 0 }] }, kare: 0 } : null;
    });
  }

  function yaz(r: { ok: boolean; mesaj?: string }): void { b.sonuc(r); }

  function sayiAlani(etiket: string, deger: number, en: number, cok: number, uygula: (n: number) => void): HTMLInputElement {
    const i = el("input"); i.type = "text"; i.inputMode = "decimal"; i.spellcheck = false; i.autocomplete = "off"; i.value = String(yuvarla(deger)); i.title = `${etiket} (${en} … ${cok})`;
    i.addEventListener("change", () => {
      const r = sayiMetniCoz(etiket, i.value, { en, cok });
      if (!r.ok || r.deger === undefined) { b.bildir(r.ok ? `${etiket}: boş bırakılamaz` : r.hata, "hata"); ciz(); return; }
      uygula(r.deger);
    });
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } });
    return i;
  }

  function sekansKameralar(s: Sekans) { return s.kameralar ?? []; }

  function ekle(g: KameraGeometrisi & { fov: number }, kaynak: string): void {
    const o = b.oturum();
    if (!o) return;
    const r = kameraEkle(o.sekans(), g);
    if (!r.ok) { b.bildir(r.hata, "hata"); return; }
    secili = r.deger.id;
    yaz(o.uygula({ ok: true, deger: r.deger.sekans }, `kamera eklendi: ${r.deger.id} (${kaynak})`));
  }

  function ciz(): void {
    const o = b.oturum();
    kok.replaceChildren();
    if (!o) { kok.append(el("div", "sk-soluk", "Açık sekans yok.")); return; }
    const s = o.sekans();
    const kameralar = sekansKameralar(s);
    if (secili && !kameralar.some((k) => k.id === secili)) secili = null;
    if (!secili && kameralar[0]) secili = kameralar[0].id;

    // ── Önizleme ──
    kok.append(el("div", "sk-baslik2", "Önizleme"));
    const onizSatir = el("div", "kp-satir");
    const sec = el("select");
    for (const [v, t] of [["kapali", "Kapalı (oyunun kendi kamerası)"], ["kamera", "Seçili kamera"], ["sekans", "Sekansın kamerası (playhead)"]] as const) { const x = el("option", "", t); x.value = v; if (v === kip) x.selected = true; sec.append(x); }
    sec.addEventListener("change", () => { kip = sec.value as OnizlemeKipi; onizlemeKur(); ciz(); });
    onizSatir.append(sec);
    kok.append(onizSatir);

    // ── Kamera ekle ──
    kok.append(el("div", "sk-baslik2", "Kameralar"));
    const ekleSatir = el("div", "kp-satir");
    const canli = a.gorunum(), orion = a.orion();
    const gorunumD = dugme("＋ Şu anki görünümden", "", "Oyuncunun şu anki kamerası: konum ve 3 m önündeki nokta (önizleme kapalıyken)");
    gorunumD.disabled = !canli;
    gorunumD.addEventListener("click", () => { gorunumD.blur(); const g = a.gorunum(); if (!g) { b.bildir("önizleme açıkken oyuncunun görünümü yok: önizlemeyi kapat", "uyari"); return; } ekle(g, "şu anki görünüm"); });
    const karsiD = dugme("＋ Orion'un karşısı", "", "Orion'un baktığı yönde 2,4 m önünde, göz hizasında");
    karsiD.disabled = !orion;
    karsiD.addEventListener("click", () => { karsiD.blur(); const q = a.orion(); if (q) ekle({ ...orionKarsisi(q.konum, q.yaw), fov: 45 }, "Orion'un karşısı"); });
    const yanD = dugme("＋ Orion'un yanı", "", "Profil: Orion'un sağ tarafından 3 m");
    yanD.disabled = !orion;
    yanD.addEventListener("click", () => { yanD.blur(); const q = a.orion(); if (q) ekle({ ...orionYanindan(q.konum, q.yaw), fov: 45 }, "Orion'un yanı"); });
    ekleSatir.append(gorunumD, karsiD, yanD);
    kok.append(ekleSatir);

    // ── Liste ──
    const liste = el("div", "kp-liste");
    if (!kameralar.length) liste.append(el("div", "sk-soluk", "Kamera yok. Yukarıdan bir tane ekle; sonra sayılarla ince ayar yap."));
    for (const k of kameralar) {
      const r = el("div", "kp-oge"); r.dataset.secili = k.id === secili ? "1" : "0";
      const ad = el("span", "kp-ad", `🎥 ${k.ad}`); ad.title = `${k.id}: konum ${k.konum.map(yuvarla).join(", ")} · fov ${k.fov}°`;
      const sil = el("button", "sk-bayrak", "✕"); sil.title = "Kamerayı ve ona bağlı kesmeleri sil (Ctrl+Z geri getirir)";
      sil.addEventListener("click", (e) => { e.stopPropagation(); const x = kameraSil(o.sekans(), k.id); yaz(x.ok ? o.uygula({ ok: true, deger: x.deger.sekans }, `kamera silindi: ${k.id}${x.deger.kesme ? ` (${x.deger.kesme} kesmesiyle)` : ""} (Ctrl+Z geri getirir)`) : { ok: false, mesaj: x.hata }); });
      r.addEventListener("click", () => { secili = k.id; onizlemeKur(); ciz(); });
      r.append(ad, sil);
      liste.append(r);
    }
    kok.append(liste);

    // ── Seçili kameranın ayarları ──
    const k = kameralar.find((x) => x.id === secili);
    if (k) {
      kok.append(el("div", "sk-baslik2", `Ayarlar · ${k.ad}`));
      const g = el("div", "kp-alanlar");
      const ad = el("input"); ad.type = "text"; ad.value = k.ad; ad.maxLength = 32; ad.spellcheck = false;
      ad.addEventListener("change", () => { const x = kameraAyarla(o.sekans(), k.id, { ad: ad.value }); yaz(o.uygula(x, "kamera adı değişti")); });
      ad.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ad.blur(); } });
      g.append(el("label", "", "ad"), ad);
      for (const [alan, etiket] of [["konum", "konum (m)"], ["hedef", "baktığı nokta (m)"]] as const) {
        const satir = el("div", "kp-uclu");
        k[alan].forEach((v, i) => satir.append(sayiAlani(`${etiket} ${"xyz"[i]}`, v, -1000, 1000, (n) => {
          const yeni = [...k[alan]] as Nokta3; yeni[i] = n;
          const x = kameraAyarla(o.sekans(), k.id, { [alan]: yeni });
          yaz(o.uygula(x, `${etiket} değişti`));
        })));
        g.append(el("label", "", etiket), satir);
      }
      g.append(el("label", "", "görüş alanı (°)"), sayiAlani("görüş alanı", k.fov, 10, 120, (n) => { const x = kameraAyarla(o.sekans(), k.id, { fov: n }); yaz(o.uygula(x, "görüş alanı değişti")); }));
      kok.append(g);

      // Yörünge düğmeleri: hedef sabit, konum döner.
      const adim = (d: [number, number, number], ipucu: string, simge: string): HTMLButtonElement => {
        const x = dugme(simge, "kp-adim", ipucu);
        x.addEventListener("click", () => {
          x.blur();
          const yeni = yorungele({ konum: k.konum, hedef: k.hedef }, d[0], d[1], d[2]);
          const r = kameraAyarla(o.sekans(), k.id, { konum: yeni });
          yaz(o.uygula(r, "kamera yörüngesi"));
        });
        return x;
      };
      const yor = el("div", "kp-satir");
      yor.append(
        adim([-YORUNGE_ADIMI.aci, 0, 0], "hedefin etrafında sola dön (10°)", "◀"), adim([YORUNGE_ADIMI.aci, 0, 0], "hedefin etrafında sağa dön (10°)", "▶"),
        adim([0, YORUNGE_ADIMI.yukseklik, 0], "yukarı çık (10°)", "▲"), adim([0, -YORUNGE_ADIMI.yukseklik, 0], "aşağı in (10°)", "▼"),
        adim([0, 0, -YORUNGE_ADIMI.mesafe], "hedefe yaklaş (25 cm)", "＋"), adim([0, 0, YORUNGE_ADIMI.mesafe], "hedeften uzaklaş (25 cm)", "−"),
      );
      kok.append(el("div", "sk-soluk", `yörünge · mesafe ${yuvarla(kuresel({ konum: k.konum, hedef: k.hedef }).mesafe)} m`), yor);
      const araSatir = el("div", "kp-satir");
      const orionaBak = dugme("Orion'a bak", "", "Baktığı noktayı Orion'un göğsüne al (konum sabit)");
      orionaBak.disabled = !orion;
      orionaBak.addEventListener("click", () => { orionaBak.blur(); const q = a.orion(); if (!q) return; const x = kameraAyarla(o.sekans(), k.id, { hedef: [q.konum.x, q.konum.y + 1.15, q.konum.z] }); yaz(o.uygula(x, "kamera Orion'a bakıyor")); });
      const yaz2 = dugme("Şu anki görünümü yaz", "", "Bu kameranın konumunu, hedefini ve görüş alanını oyuncunun şu anki görünümüyle değiştir (önizleme kapalıyken)");
      yaz2.disabled = !canli;
      yaz2.addEventListener("click", () => { yaz2.blur(); const gv = a.gorunum(); if (!gv) return; const x = kameraAyarla(o.sekans(), k.id, { konum: gv.konum, hedef: gv.hedef, fov: gv.fov }); yaz(o.uygula(x, "kamera güncellendi (şu anki görünüm)")); });
      araSatir.append(orionaBak, yaz2);
      kok.append(araSatir);
    }

    // ── Kesmeler ──
    kok.append(el("div", "sk-baslik2", "Kesmeler"));
    const kesmeSatir = el("div", "kp-satir");
    const gecis = el("select"); for (const t of KAMERA_GECISLERI) { const x = el("option", "", t === "kesme" ? "ani kesme" : "yumuşak geçiş"); x.value = t; gecis.append(x); }
    const sure = sayiAlani("geçiş süresi", 15, 1, 90, () => undefined); sure.style.width = "46px"; sure.title = "yumuşak geçiş süresi (kare; 30 = 1 sn)";
    const kesmeD = dugme(`＋ Kesme (kare ${o.kare})`, "", "Playhead karesine: bu kareden itibaren seçili kamera");
    kesmeD.disabled = !k;
    kesmeD.addEventListener("click", () => {
      kesmeD.blur();
      if (!k) return;
      const t = gecis.value as KameraGecisi;
      const n = sayiMetniCoz("geçiş süresi", sure.value, { en: 1, cok: 90, tamsayi: true });
      const gk = n.ok && n.deger !== undefined ? n.deger : 15;
      yaz(o.uygula(kesmeEkle(o.sekans(), o.kare, k.id, t, gk), `kamera kesmesi: kare ${o.kare} → ${k.ad}`, { tur: "kesme", kare: o.kare }));
    });
    kesmeSatir.append(gecis, sure, kesmeD);
    kok.append(kesmeSatir);
    const kl = el("div", "kp-liste");
    if (!(s.kesmeler ?? []).length) kl.append(el("div", "sk-soluk", "Kesme yok: ilk kesmeye dek oyunun kendi kamerası sürer. Bir kamera seçip playhead'i istediğin kareye al, ＋ Kesme."));
    for (const x of s.kesmeler ?? []) {
      const kam = kameralar.find((y) => y.id === x.kamera);
      const r = el("div", "kp-oge"); r.dataset.secili = o.secim.tur === "kesme" && o.secim.kare === x.kare ? "1" : "0";
      r.append(el("span", "kp-ad", `kare ${x.kare} → ${kam?.ad ?? x.kamera}${x.gecis === "yumusak" ? ` ↝ ${x.gecis_kare}k` : ""}`));
      const sil = el("button", "sk-bayrak", "✕"); sil.title = "Kesmeyi sil";
      sil.addEventListener("click", (e) => { e.stopPropagation(); yaz(o.uygula(kesmeSil(o.sekans(), x.kare), `kesme silindi: kare ${x.kare}`, { tur: "yok" })); });
      r.addEventListener("click", () => { o.secim = { tur: "kesme", kare: x.kare }; o.kareyeGit(x.kare); b.tazele(); });
      r.append(sil);
      kl.append(r);
    }
    kok.append(kl);
    kok.append(el("div", "sk-baslik2", "Nasıl çalışır"), el("div", "sk-soluk", "Kamera = konum + baktığı nokta + görüş alanı. Kesmeler sırayla hangi kameranın ne zaman sahneyi gösterdiğini söyler; ▶ oynarken kamera buna göre gezer. Kameralar bu sekansın dosyasında saklanır."));
  }

  return { kok, ciz, seciliKamera: () => secili, kapat() { kip = "kapali"; a.onizleme.onizleme(null); } };
}
