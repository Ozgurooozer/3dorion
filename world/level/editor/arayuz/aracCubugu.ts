// world/level/editor/arayuz/aracCubugu.ts — Üst araç çubuğu (spec 22): araçlar (rakam rozetli), gizmo ekseni,
// yaslama ayarları, geri/ileri al, kaydet, kip, yardım. Her düğmenin ipucunda kısayolu yazar (tuş haritasından).
"use strict";
import type { Editor } from "../editor.ts";
import { ARACLAR, type AracAdi } from "../cekirdek/durum.ts";
import { eylemTusu, type Eylem } from "../cekirdek/kisayol.ts";
import { el, cssEkle } from "./ortak.ts";

const ARAC_BILGI: Record<AracAdi, { ad: string; simge: string; eylem: Eylem; ipucu: string }> = {
  sec: { ad: "Seç", simge: "⬚", eylem: "aracSec", ipucu: "Tıkla seç, sürükle yüzeyde kaydır, boşlukta sürükle kutu seç" },
  tasi: { ad: "Taşı", simge: "✥", eylem: "aracTasi", ipucu: "Eksen okları (renkli kareler: düzlemde). Shift ile sürükle: kopyala" },
  dondur: { ad: "Döndür", simge: "⟳", eylem: "aracDondur", ipucu: "Üç eksen halkası (açı adımına yaslanır)" },
  olcek: { ad: "Ölçek", simge: "⤡", eylem: "aracOlcek", ipucu: "Eksen başına ölçek; ortadaki küp eşit ölçek" },
  kutu: { ad: "Kutu", simge: "▣", eylem: "aracKutu", ipucu: "Sınır kutusu: köşeden ölçek, kenar küresinden döndür" },
  firca: { ad: "Fırça", simge: "✎", eylem: "aracFirca", ipucu: "Fırçadaki varlıkları boyayarak serpiştir (Shift: sil)" },
  arazi: { ad: "Arazi", simge: "⛰", eylem: "aracArazi", ipucu: "Zemini yükselt/alçalt/düzle/yumuşat, çim-kaya boya" },
  gunes: { ad: "Güneş", simge: "☀", eylem: "aracGunes", ipucu: "Gökyüzüne sürükle: güneş oraya (zaman tanımlıysa yatay sürükleme saati değiştirir)" },
  olcu: { ad: "Ölç", simge: "📏", eylem: "aracOlcu", ipucu: "İki noktaya tıkla: aradaki mesafe (yatay/dikey); Esc temizler" },
};

const CSS = `
#ed-ust { position: fixed; left: 0; right: 0; top: 0; height: var(--ed-ust); background: var(--ed-zemin); border-bottom: 1px solid var(--ed-cizgi);
  display: flex; align-items: center; gap: 5px; padding: 0 8px; z-index: 11; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
#ed-ust::-webkit-scrollbar { display: none; }
/* Dar ekranda araç adları gizlenir (simge + rakam kalır; ad ipucunda). */
@media (max-width: 1750px) { #ed-ust .arac .etiket, #ed-ust .uzun { display: none; } }
#ed-ust .ayrac { width: 1px; align-self: stretch; margin: 8px 2px; background: var(--ed-cizgi); }
#ed-ust .arac { position: relative; padding: 4px 9px 4px 8px; }
#ed-ust .arac sup { position: absolute; right: 2px; top: 0; font-size: 9px; color: var(--ed-soluk); }
#ed-ust .arac.secili sup { color: #dfe8ff; }
#ed-ust label.kutu { display: flex; align-items: center; gap: 3px; color: #c3cee2; white-space: nowrap; }
#ed-ust select { padding: 1px 3px; }
#ed-ust .baslik { font-weight: 700; color: #a9bde0; margin-right: 4px; white-space: nowrap; }
#ed-ust .nokta { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #3a4a66; margin-right: 5px; }
#ed-ust .nokta.kirli { background: var(--ed-uyari); }
`;

const KONUM_ADIMLARI = [0.1, 0.25, 0.5, 1, 2, 4, 8];
const Y_ADIMLARI = [0.05, 0.1, 0.25, 0.5, 1, 2, 4];
const ACI_ADIMLARI = [1, 5, 10, 15, 30, 45, 90];
const OLCEK_ADIMLARI = [0.01, 0.05, 0.1, 0.25, 0.5];

export function aracCubuguKur(ed: Editor, ad: string): HTMLElement {
  cssEkle("edAracStil", CSS);
  const { durum } = ed;
  const kok = el("div", "ed-kok"); kok.id = "ed-ust";
  const ipucu = (yazi: string, e: Eylem) => { const t = eylemTusu(e); return t ? `${yazi} (${t})` : yazi; };

  const nokta = el("span", "nokta");
  const baslik = el("span", "baslik"); baslik.append(nokta, document.createTextNode(`Level · ${ad}`));
  kok.append(baslik);

  const aracDugmeleri = new Map<AracAdi, HTMLButtonElement>();
  ARACLAR.forEach((a, i) => {
    const b = ARAC_BILGI[a];
    const d = el("button", "arac", b.simge);
    d.append(el("span", "etiket", ` ${b.ad}`));
    d.append(el("sup", "", String(i + 1)));
    d.title = `${b.ad} (${i + 1}) — ${b.ipucu}`;
    d.onclick = () => { durum.aracSec(a); d.blur(); };
    aracDugmeleri.set(a, d);
    kok.append(d);
  });
  kok.append(el("span", "ayrac"));

  const uzay = el("button");
  uzay.onclick = () => { ed.eylem("uzayDegistir"); uzay.blur(); };
  kok.append(uzay);

  const secim = <T extends number>(degerler: readonly T[], simdiki: T, bicim: (v: T) => string, yazF: (v: T) => void) => {
    const s = el("select");
    for (const v of degerler) s.add(new Option(bicim(v), String(v)));
    if (!degerler.includes(simdiki)) s.add(new Option(bicim(simdiki), String(simdiki)));
    s.value = String(simdiki);
    s.onchange = () => { yazF(Number(s.value) as T); s.blur(); };
    return s;
  };
  const kutu = (yazi: string, baslikMetni: string, acik: boolean, yazF: (v: boolean) => void, ek?: HTMLElement) => {
    const l = el("label", "kutu"); l.title = baslikMetni;
    const c = el("input"); c.type = "checkbox"; c.checked = acik;
    c.onchange = () => { yazF(c.checked); c.blur(); };
    l.append(c, document.createTextNode(yazi));
    if (ek) l.append(ek);
    return l;
  };
  const etiketli = (yazi: string, baslikMetni: string, ek: HTMLElement) => {
    const l = el("label", "kutu"); l.title = baslikMetni;
    l.append(document.createTextNode(yazi), ek);
    return l;
  };
  const yaslamaKap = el("span"); yaslamaKap.style.display = "contents";
  kok.append(yaslamaKap);
  const yaslamaCiz = () => {
    const y = durum.ayarlar().yaslama;
    const yaz = (f: (x: typeof y) => typeof y) => durum.ayarDegistir((a) => ({ ...a, yaslama: f(a.yaslama) }));
    yaslamaKap.replaceChildren(
      kutu("ızgara", ipucu("Konum ızgarasına yasla — Ctrl basılıyken geçici tersine döner", "yaslamaAcKapa"), y.konum, (v) => yaz((x) => ({ ...x, konum: v })),
        secim(KONUM_ADIMLARI, y.konumAdim, (v) => `${v} m`, (v) => yaz((x) => ({ ...x, konumAdim: v })))),
      etiketli("Y", "Dikey kaydırma adımı (PageUp/PageDown); gizmo okları ızgara adımını kullanır",
        secim(Y_ADIMLARI, y.yAdim, (v) => `${v} m`, (v) => yaz((x) => ({ ...x, yAdim: v })))),
      kutu("∠", "Açı yaslaması: döndürme adımı (gizmo, tekerlek, [ ])", y.aci, (v) => yaz((x) => ({ ...x, aci: v })),
        secim(ACI_ADIMLARI, y.aciAdim, (v) => `${v}°`, (v) => yaz((x) => ({ ...x, aciAdim: v })))),
      kutu("⤡", "Ölçek yaslaması: ölçek adımı", y.olcek, (v) => yaz((x) => ({ ...x, olcek: v })),
        secim(OLCEK_ADIMLARI, y.olcekAdim, (v) => `${v}`, (v) => yaz((x) => ({ ...x, olcekAdim: v })))),
      el("span", "ayrac"),
      kutu("yüzey", "Yüzeye otur: yerleştirirken/sürüklerken imlecin altındaki yüzeye (zemin ya da nesne üstü); kapalıysa yükseklik korunur", y.yuzeyeOtur, (v) => yaz((x) => ({ ...x, yuzeyeOtur: v }))),
      kutu("eğ", "Normale hizala: yüzeye otururken yamaca eğik dur (tek nesne)", y.normaleHizala, (v) => yaz((x) => ({ ...x, normaleHizala: v }))),
      kutu("▦", ipucu("Çalışılan nesnenin tabanında yaslama ızgarası", "izgara"), durum.ayarlar().izgara, () => ed.eylem("izgara")),
    );
  };
  kok.append(el("span", "ayrac"));

  const geri = el("button", "", "↶"); geri.onclick = () => { durum.geriAl(); geri.blur(); };
  const ileri = el("button", "", "↷"); ileri.onclick = () => { durum.ileriAl(); ileri.blur(); };
  const kaydet = el("button", "ana", "Kaydet"); kaydet.title = ipucu("Level dosyasına yaz", "kaydet");
  kaydet.onclick = () => { ed.eylem("kaydet"); kaydet.blur(); };
  const kip = el("button", "", "✈"); kip.title = ipucu("Uçuş kipine geç: fare kilitli serbest uçuş, arayüz gizli", "kipDegistir");
  kip.onclick = () => { ed.eylem("kipDegistir"); kip.blur(); };
  const yardim = el("button", "", "?"); yardim.title = ipucu("Kısayol kartı", "yardim");
  yardim.onclick = () => { ed.eylem("yardim"); yardim.blur(); };
  const insp = el("button", "", "🔍"); insp.title = ipucu("Babylon Inspector (sahne ağacı, malzemeler — kaydedilmez)", "inspektor");
  insp.onclick = () => { ed.eylem("inspektor"); insp.blur(); };
  kok.append(geri, ileri, kaydet, el("span", "ayrac"), kip, yardim, insp);

  const ciz = () => {
    for (const [a, d] of aracDugmeleri) d.classList.toggle("secili", a === durum.arac());
    const u = durum.ayarlar().uzay;
    uzay.textContent = u === "dunya" ? "🌐 Dünya" : "◈ Yerel";
    uzay.title = ipucu(`Gizmo ekseni: ${u === "dunya" ? "dünya (kuzey/güney sabit)" : "nesnenin kendi ekseni"}`, "uzayDegistir");
    const g = durum.gecmisSayisi();
    geri.disabled = g.geri === 0; geri.title = ipucu(g.geri ? `Geri al: ${g.mesajlar.at(-1)}` : "Geri al", "geriAl");
    ileri.disabled = g.ileri === 0; ileri.title = ipucu("İleri al", "ileriAl");
    const k = durum.kirli();
    nokta.classList.toggle("kirli", k);
    kaydet.classList.toggle("kirli", k);
    kaydet.textContent = k ? "Kaydet •" : "Kaydet";
  };
  yaslamaCiz();
  ciz();
  durum.abone("arac", ciz);
  durum.abone("ayarlar", () => { ciz(); yaslamaCiz(); });
  durum.abone("gecmis", ciz);
  durum.abone("kirli", ciz);
  document.body.append(kok);
  return kok;
}
