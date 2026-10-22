// uygulama/yapi/sekans/izListesi.ts — SEKANS EDİTÖRÜNÜN SOL SÜTUNU (spec 36 S2; Unreal'daki Outliner): bağlamalar ve izler, satır başına playhead'deki
// değer, 👁 gizle (oynatılmaz) / 🔒 kilitle (değişmez), ✕ sil, ＋ iz, ＋ bağlama. DOM katmanı.
//
// HİZA: satırlar zaman çizelgesiyle AYNI listeden (`izDuzeni.satirlar`) ve aynı yüksekliklerle çizilir; ikisi aynı dikey kaydırma kabının içinde
// (sekansEditoru.ts) — ayrı ayrı kaydırılıp kayamazlar. İşlemlerin kuralları (kilit, tekil kimlik, çakışma) `sekansIslemleri.ts`te.
"use strict";
import { KANALLAR, UZUVLAR, otelemeMi, type Kanal, type Uzuv } from "../../../protocol/animasyon.ts";
import { BEN, SEKANS_FPS } from "../../../protocol/sekans.ts";
import { etkinBolum, uzuvIziDegeri } from "../../sekans/degerlendir.ts";
import { satirlar } from "../../sekans/editor/izDuzeni.ts";
import { baglamaEkle, baglamaSil, izBayrak, izSil, klipIziEkle, uzuvIziEkle } from "../../sekans/editor/sekansIslemleri.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import type { SekansBaglami } from "./editorBaglami.ts";

const dugme = dugmeYap("sk-dugme");

export function izListesiKur(b: SekansBaglami): { kok: HTMLElement; ciz(): void } {
  const kok = el("div", "sk-sol");
  const bas = el("div", "sk-sol-bas");
  bas.append(el("span", "sk-soluk", "İZLER · playhead'deki değer"));
  const liste = el("div");
  const alt = el("div", "sk-sol-alt");
  kok.append(bas, liste, alt);

  // ＋ iz formu (bir bağlamanın "＋ iz"inden açılır) ve ＋ bağlama.
  const form = el("div", "sk-iz-formu");
  const tur = el("select"); for (const [v, t] of [["uzuv", "uzuv izi (anahtarlar)"], ["klip", "klip izi (bölümler)"]] as const) { const o = el("option", "", t); o.value = v; tur.append(o); }
  const uzuv = el("select"); for (const u of UZUVLAR) { const o = el("option", "", u); o.value = u; uzuv.append(o); }
  const kanal = el("select");
  const ekle = dugme("Ekle"), vazgec = dugme("Vazgeç");
  form.append(tur, uzuv, kanal, ekle, vazgec);
  let formBaglama: string | null = null;
  const kanallariDoldur = () => {
    const onceki = kanal.value;
    kanal.replaceChildren(...KANALLAR.filter((k) => uzuv.value === "kok" || !otelemeMi(k)).map((k) => { const o = el("option", "", k); o.value = k; return o; }));
    if ([...kanal.options].some((o) => o.value === onceki)) kanal.value = onceki;
  };
  uzuv.addEventListener("change", kanallariDoldur);
  tur.addEventListener("change", () => { uzuv.style.display = kanal.style.display = tur.value === "uzuv" ? "" : "none"; });
  kanallariDoldur();
  vazgec.addEventListener("click", () => { form.dataset.acik = "0"; });
  ekle.addEventListener("click", () => {
    const o = b.oturum();
    if (!o || !formBaglama) return;
    const r = tur.value === "klip" ? klipIziEkle(o.sekans(), formBaglama) : uzuvIziEkle(o.sekans(), formBaglama, uzuv.value as Uzuv, kanal.value as Kanal);
    if (!r.ok) { b.bildir(r.hata, "hata"); return; }
    form.dataset.acik = "0";
    b.sonuc(o.uygula({ ok: true, deger: r.deger.sekans }, `iz eklendi: ${r.deger.iz}${tur.value === "klip" ? " (satıra çift tık: bölüm ekle)" : " (K ya da çift tık: anahtar ekle)"}`, { tur: "iz", iz: r.deger.iz }));
  });
  const ajanSec = el("select");
  const baglamaDugme = dugme("＋ Bağlama", "", "Sekansa bir ajan daha bağla (izleri bu bağlamaya eklenir)");
  baglamaDugme.addEventListener("click", () => {
    const o = b.oturum();
    if (!o) return;
    const r = baglamaEkle(o.sekans(), ajanSec.value);
    if (!r.ok) { b.bildir(r.hata, "hata"); return; }
    b.sonuc(o.uygula({ ok: true, deger: r.deger.sekans }, `bağlama eklendi: ${r.deger.id} → ${ajanSec.value}`, { tur: "baglama", id: r.deger.id }));
  });
  alt.append(form, ajanSec, baglamaDugme);

  function ciz(): void {
    const o = b.oturum();
    liste.replaceChildren();
    if (!o) return;
    const s = o.sekans(), k = b.oynayanKare() ?? o.kare;
    const secenekler = [...new Set([...b.ajanlar(), BEN])].filter((a) => !s.baglamalar.some((x) => x.ajan === a));
    const onceki = ajanSec.value;   // her çizimde (oynarken 33 ms'de bir) seçim kaybolmasın
    ajanSec.replaceChildren(...secenekler.map((a) => { const x = el("option", "", a); x.value = a; return x; }));
    if (secenekler.includes(onceki)) ajanSec.value = onceki;
    baglamaDugme.disabled = !secenekler.length;
    for (const r of satirlar(s)) {
      const satir = el("div", "sk-ssatir"); satir.style.height = `${r.h}px`; satir.dataset.tur = r.tur;
      if (r.tur === "baglama") {
        const id = r.baglama.id;
        satir.dataset.secili = o.secim.tur === "baglama" && o.secim.id === id ? "1" : "0";
        const izEkle = dugme("＋ iz", "", "Bu bağlamaya uzuv izi ya da klip izi ekle");
        izEkle.addEventListener("click", (e) => { e.stopPropagation(); formBaglama = id; form.dataset.acik = "1"; });
        const sil = el("button", "sk-bayrak", "✕"); sil.title = "Bağlamayı İZLERİYLE kaldır (Ctrl+Z geri getirir)";
        sil.addEventListener("click", (e) => { e.stopPropagation(); const x = baglamaSil(o.sekans(), id); b.sonuc(x.ok ? o.uygula({ ok: true, deger: x.deger.sekans }, `bağlama '${id}' ${x.deger.iz} iziyle kaldırıldı (Ctrl+Z geri getirir)`, { tur: "yok" }) : { ok: false, mesaj: x.hata }); });
        satir.append(el("span", "sk-ad", `👤 ${r.baglama.ajan}  (${id})`), izEkle, sil);
        satir.addEventListener("click", () => { o.secim = { tur: "baglama", id }; b.tazele(); });
      } else {
        const iz = r.iz, id = iz.id;
        satir.dataset.secili = o.seciliIz() === id ? "1" : "0";
        satir.dataset.gizli = iz.gizli ? "1" : "0";
        let deger = "";
        if (iz.tur === "uzuv") { const v = uzuvIziDegeri(iz, k); deger = v === null ? "—" : `${v.toFixed(otelemeMi(iz.kanal) ? 3 : 1)}${otelemeMi(iz.kanal) ? " m" : "°"}`; }
        else { const bl = etkinBolum(iz, k); deger = bl ? `${bl.klip} ${((k - bl.baslangic_kare + bl.ofset_kare) / SEKANS_FPS).toFixed(2)} sn` : "—"; }
        const ad = el("span", "sk-ad", iz.tur === "uzuv" ? `🦴 ${iz.uzuv}.${iz.kanal}` : `🎞 klip · ${id}`);
        ad.title = iz.tur === "uzuv" ? `uzuv izi '${id}': ${iz.anahtarlar.length} anahtar` : `klip izi '${id}': ${iz.bolumler.length} bölüm`;
        const d = el("span", "sk-deger", deger); d.title = "playhead'deki değer (bu izin katkısı)";
        const bayrak = (simge: string, ad2: "gizli" | "kilitli", ipucu: string) => {
          const x = el("button", "sk-bayrak", simge); x.dataset.acik = iz[ad2] ? "1" : "0"; x.title = ipucu;
          x.addEventListener("click", (e) => { e.stopPropagation(); b.sonuc(o.uygula(izBayrak(o.sekans(), id, ad2, !iz[ad2]), `${id}: ${ad2 === "gizli" ? (iz.gizli ? "görünür (oynatılır)" : "gizlendi (oynatılmaz)") : iz.kilitli ? "kilit açıldı" : "kilitlendi"}`)); });
          return x;
        };
        const sil = el("button", "sk-bayrak", "✕"); sil.title = "İzi sil (Ctrl+Z geri getirir)";
        sil.addEventListener("click", (e) => { e.stopPropagation(); b.sonuc(o.uygula(izSil(o.sekans(), id), `iz silindi: ${id} (Ctrl+Z geri getirir)`, { tur: "yok" })); });
        satir.append(ad, d, bayrak(iz.gizli ? "◌" : "👁", "gizli", "gizle: bu iz oynatılmaz ve değerlendirilmez"), bayrak("🔒", "kilitli", "kilitle: bu iz değiştirilemez"), sil);
        satir.addEventListener("click", () => { o.secim = { tur: "iz", iz: id }; b.tazele(); });
      }
      liste.append(satir);
    }
    if (!s.baglamalar.length) liste.append(el("div", "sk-bos", "Bağlama yok: aşağıdan bir ajan seç → ＋ Bağlama."));
    // Satır yükseklikleri izDuzeni'nden; CSS ile ayrışırsa hiza bozulur — yükseklik satır başına AÇIKÇA yazıldı (yukarıda), toplam burada denetlenir.
    liste.style.minHeight = `${satirlar(s).reduce((t, x) => t + x.h, 0)}px`;
  }
  return { kok, ciz };
}
