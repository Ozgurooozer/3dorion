// uygulama/yapi/graf/ayrintiPaneli.ts — SAĞ PANEL "AYRINTILAR" (spec 35 dilim 2b). DOM katmanı.
//
//   • Tek düğüm seçiliyse: türü, açıklaması (kütüphaneden), kimliği, BÜTÜN ayarları (türe uygun girdi: sayı/metin/doğru-yanlış/liste; seçenekler çalışma
//     anında), ayarın hata mesajı ve düğümün denetim hataları. Bağlı girişin alanı "bağdan gelir" der (değer yazılabilir ama kullanılmaz).
//   • Hiçbir düğüm seçili değilse: GRAFİĞİN ayarları — ad (salt okunur: ad = dosya adı; yeniden adlandırma üst çubukta), tür (olay / fonksiyon), açıklama,
//     desenin giriş/çıkış pinleri (ad + tür). Pin listesi değişince Fonksiyon girişi/dönüşü düğümlerinin kalkan pinlerine giden bağlar budanır ve söylenir.
// Değerler `alanlar.ts`ten doğrulanır (sayı eval edilmez); komutlar editorOturumu'ndan (tek geri al adımı).
"use strict";
import { PIN_TIPLERI, grafAdiGecerli, type PinTanimi, type PinTipi } from "../../../protocol/graf.ts";
import { DESEN_CAGIR_TIPI } from "../../graf/grafTurDenetimi.ts";
import { alanDegeriCoz, dugumAlanlari, type AlanTanimi } from "../../graf/editor/alanlar.ts";
import { ayarKomutu, grafBilgisiKomutu, silKomutu } from "../../graf/editor/editorOturumu.ts";
import { KATEGORI_ADI } from "../../graf/editor/palet.ts";
import { PIN_TIP_ADI } from "../../graf/editor/bagKurali.ts";
import type { EditorBaglami } from "./editorBaglami.ts";
import { alanGirdisi, dugme, el } from "./dom.ts";

const VERI_TIPLERI = PIN_TIPLERI.filter((t): t is Exclude<PinTipi, "akis"> => t !== "akis");

export function ayrintiPaneliKur(b: EditorBaglami): { kok: HTMLElement; ciz(): void } {
  const kok = el("div", "ge-sag");

  function dugumCiz(id: string): void {
    const o = b.oturum()!;
    const d = o.graf().dugumler.find((x) => x.id === id);
    if (!d) return;
    const c = o.cozum().get(id);
    const t = c?.tanim ?? b.kayit.al(d.tip);
    kok.append(el("div", "ge-baslik2", "Düğüm"));
    kok.append(el("div", "", t ? `${t.ad}` : `bilinmeyen tür`), el("div", "ge-soluk", `${d.tip}${t ? ` · ${KATEGORI_ADI[t.kategori]}${t.saf ? " · saf (akışsız, her okunuşta hesaplanır)" : ""}` : ""}`));
    if (t) kok.append(el("p", "", t.aciklama));
    kok.append(el("div", "ge-soluk", `kimlik: ${d.id}`));
    if (d.tip === DESEN_CAGIR_TIPI && typeof d.ayar?.["desen"] === "string") {
      const ac = dugme("Deseni aç", "", "Bu deseni yeni sekmede aç (düğüme çift tık da açar)");
      const ad = d.ayar["desen"];
      ac.addEventListener("click", () => { ac.blur(); b.desenAc(ad); });
      kok.append(ac);
    }
    if (t) {
      const alanlar = dugumAlanlari(t, c?.pinler ?? null, o.ortam());
      const bagli = new Set(o.graf().baglar.filter((x) => x.hedef[0] === id).map((x) => x.hedef[1]));
      kok.append(el("div", "ge-baslik2", alanlar.length ? "Ayarlar" : "Ayar yok"));
      const izgara = el("div", "ge-alanlar");
      for (const a of alanlar) izgara.append(...alanSatiri(id, a, bagli.has(a.ad)));
      kok.append(izgara);
    }
    const hatalar = o.hatalar.filter((h) => h.dugum === id);
    if (hatalar.length) {
      kok.append(el("div", "ge-baslik2", `✗ ${hatalar.length} sorun`));
      for (const h of hatalar) kok.append(el("div", "ge-hata", h.mesaj));
    }
  }

  function alanSatiri(id: string, a: AlanTanimi, bagli: boolean): HTMLElement[] {
    const o = b.oturum()!;
    const deger = o.graf().dugumler.find((x) => x.id === id)?.ayar?.[a.ad];
    const etiket = el("label", "", a.ad);
    etiket.title = [a.aciklama, a.en !== undefined || a.cok !== undefined ? `aralık ${a.en ?? "-∞"}–${a.cok ?? "∞"}` : "", a.varsayilan !== undefined ? `varsayılan: ${String(a.varsayilan)}` : ""].filter(Boolean).join(" · ");
    const kutu = el("div", "ge-oge");
    const girdi = alanGirdisi(a, deger, (ham) => {
      const r = alanDegeriCoz(a, ham);
      if (!r.ok) { b.bildir(r.hata, "hata"); b.tazele(); return; }
      b.sonuc(ayarKomutu(o, b.kayit, id, a.ad, r.deger));
    });
    girdi.style.flex = "1";
    kutu.append(girdi);
    if (deger !== undefined) {
      const sil = dugme("↺", "", "Ayarı kaldır (varsayılana / bağa döner)");
      sil.addEventListener("click", () => { sil.blur(); b.sonuc(ayarKomutu(o, b.kayit, id, a.ad, undefined)); });
      kutu.append(sil);
    }
    const satir = [etiket, kutu];
    if (bagli) { const n = el("div", "ge-soluk", "↳ bağlı: değer bağdan gelir"); n.style.gridColumn = "2"; satir.push(n); }
    return satir;
  }

  function pinListesi(baslik: string, alan: "girisler" | "cikislar"): void {
    const o = b.oturum()!;
    const pinler = o.graf()[alan];
    const yaz = (yeni: readonly PinTanimi[]) => b.sonuc(grafBilgisiKomutu(o, b.kayit, { [alan]: yeni }));
    const bas = el("div", "ge-baslik2", baslik);
    const ekle = dugme("＋", "", `${baslik}: yeni pin`);
    ekle.addEventListener("click", () => {
      ekle.blur();
      let n = pinler.length + 1;
      while (pinler.some((p) => p.ad === `pin${n}`)) n++;
      yaz([...pinler, { ad: `pin${n}`, tip: "sayi" }]);
    });
    bas.append(ekle);
    kok.append(bas);
    if (!pinler.length) kok.append(el("div", "ge-soluk", "yok"));
    for (const [i, p] of pinler.entries()) {
      const s = el("div", "ge-oge");
      const ad = el("input"); ad.value = p.ad; ad.spellcheck = false; ad.style.width = "110px";
      ad.addEventListener("change", () => {
        const v = ad.value.trim();
        if (!grafAdiGecerli(v)) { b.bildir(`pin adı geçersiz: ${JSON.stringify(v)} (harf, rakam, _ ve -)`, "hata"); b.tazele(); return; }
        yaz(pinler.map((x, j) => (j === i ? { ...x, ad: v } : x)));
      });
      const tip = el("select");
      for (const t of VERI_TIPLERI) { const op = el("option", "", PIN_TIP_ADI[t]); op.value = t; op.selected = t === p.tip; tip.append(op); }
      tip.addEventListener("change", () => yaz(pinler.map((x, j) => (j === i ? { ...x, tip: tip.value as PinTipi } : x))));
      const sil = dugme("✕", "", "Pini kaldır (ona giden bağlar da kalkar)");
      sil.addEventListener("click", () => { sil.blur(); yaz(pinler.filter((_, j) => j !== i)); });
      s.append(ad, tip, sil);
      kok.append(s);
    }
  }

  function grafCiz(): void {
    const o = b.oturum()!;
    const g = o.graf();
    kok.append(el("div", "ge-baslik2", "Grafik"));
    kok.append(el("div", "", `ad: ${g.ad}`), el("div", "ge-soluk", "ad = dosya adı (değiştirmek için üstte 'Yeniden adlandır')"));
    const tur = el("select");
    for (const [v, ad] of [["olay", "olay grafiği (▶ / ⚡ ile çalışır)"], ["fonksiyon", "desen (fonksiyon: başka grafikten çağrılır)"]] as const) {
      const op = el("option", "", ad); op.value = v; op.selected = g.tur === v; tur.append(op);
    }
    tur.addEventListener("change", () => b.sonuc(grafBilgisiKomutu(o, b.kayit, { tur: tur.value as "olay" | "fonksiyon" })));
    const aciklama = el("textarea"); aciklama.value = g.aciklama ?? ""; aciklama.placeholder = "Bu grafik ne yapar? (Graf sekmesindeki kartta görünür)";
    aciklama.addEventListener("change", () => b.sonuc(grafBilgisiKomutu(o, b.kayit, { aciklama: aciklama.value })));
    kok.append(el("div", "ge-baslik2", "Tür"), tur, el("div", "ge-baslik2", "Açıklama"), aciklama);
    if (g.tur === "fonksiyon") {
      pinListesi("Desenin girişleri", "girisler");
      pinListesi("Desenin çıkışları", "cikislar");
      kok.append(el("div", "ge-soluk", "Girişler 'Fonksiyon girişi' düğümünün çıkışlarıdır; çıkışlar 'Fonksiyon dönüşü'nün girişleri. Bu deseni çağıran grafikler kendi denetiminde uyarılır."));
    }
    kok.append(el("div", "ge-baslik2", "Özet"), el("div", "", `${g.dugumler.length} düğüm · ${g.baglar.length} bağ · ${o.hatalar.length ? `✗ ${o.hatalar.length} sorun` : "✓ sorun yok"}`));
    kok.append(el("div", "ge-soluk", "Bir düğüme tıkla: ayarları burada."));
  }

  return {
    kok,
    ciz() {
      kok.replaceChildren();
      const o = b.oturum();
      if (!o) { kok.append(el("div", "ge-soluk", "Açık grafik yok.")); return; }
      if (o.secim.size === 1) { dugumCiz([...o.secim][0]!); return; }
      if (o.secim.size > 1) {
        kok.append(el("div", "ge-baslik2", "Seçim"), el("div", "", `${o.secim.size} düğüm seçili`));
        const sil = dugme("Sil (bağlarıyla)", "", "Delete");
        sil.addEventListener("click", () => { sil.blur(); b.sonuc(silKomutu(o)); });
        kok.append(sil, el("div", "ge-soluk", "Ctrl+C kopyala · Ctrl+D çoğalt · sürükle: hepsini taşı"));
        return;
      }
      grafCiz();
    },
  };
}
