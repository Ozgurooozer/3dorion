// world/arayuz/gozPaneli.ts — GÖZ MUAYENESİ paneli (O tuşu): Orion'un gözünden alınan karenin ÖNİZLEMESİ + görme modelinin cevabı.
//
// Odanın ÜSTÜNDE küçük bir pencere (modelSecici gibi): önizleme resmi, durum satırı ("kare çekiliyor…", "beyin düşünüyor, sıra bekleniyor…",
// "gemma4:e4b bakıyor…"), cevap, model + süre + saat. Sohbetle ilgisi yok: Orion'un konuşma penceresi ya da zihin duvarı değil, yalnız bu bakışın sonucu.
// O tuşu (kutu kapalıyken açar ve bakar; açıkken yeniden bakar), Esc kapatır. Kutu odaktayken/yazı yazarken O bir harftir: `tusSerbest`.
// Karar/sıra mantığı `uygulama/gozlem.ts`te (saf, testli); burası yalnız boyar. Bağımlılık sınırı (K4): yalnız DOM.
"use strict";

export interface GozPaneli {
  ac(): void;
  kapat(): void;
  acikMi(): boolean;
  durum(mesaj: string): void;
  onizleme(dataUrl: string, en: number, boy: number): void;
  cevap(metin: string, model: string, ms: number): void;
  hata(mesaj: string): void;
}

export interface GozPaneliAyari {
  /** O tuşu (ya da [yeniden bak] düğmesi) basılınca çağrılır: yeni bir bakış iste. */
  istek: () => void;
  /** O tuşu şu an serbest mi (terminal/sohbet yazarken harf). */
  tusSerbest?: () => boolean;
  /** Pencere açılınca çağrılır (fare kilidini bırakmak için: düğmeler tıklanabilsin). */
  acildi?: () => void;
  /** Ana kap; verilmezse document.body. */
  ata?: HTMLElement;
}

const CSS = `
#gozPaneli { position: fixed; top: 64px; right: calc(16px + var(--dok-sag, 0px));   /* dok sağ bölgesinin dışında (spec 41) */ width: min(520px, calc(100vw - 32px)); z-index: 55; display: none; flex-direction: column; gap: 8px;
  background: rgba(10,14,24,0.96); color: #d7dcea; border: 1px solid #2a3246; border-radius: 10px; padding: 12px 14px; font: 13px/1.45 'Segoe UI', system-ui, sans-serif;
  box-shadow: none; }
#gozPaneli[data-acik="1"] { display: flex; }
#gozPaneli .gp-baslik { display: flex; align-items: center; gap: 8px; }
#gozPaneli .gp-baslik b { color: #58c1ff; font-size: 14px; font-weight: 600; flex: 1; }
#gozPaneli button { background: #121726; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 9px; font: inherit; cursor: pointer; }
#gozPaneli button:hover { border-color: #58c1ff; }
#gozPaneli kbd { font: 11px 'Cascadia Mono', Consolas, monospace; color: #7c88a6; border: 1px solid #2a3246; border-radius: 4px; padding: 0 4px; }
#gozPaneli .gp-durum { color: #7c88a6; min-height: 18px; }
#gozPaneli .gp-durum[data-tur="bekle"] { color: #ffc857; }
#gozPaneli .gp-durum[data-tur="hata"] { color: #ff7a70; }
#gozPaneli .gp-resim { display: none; width: 100%; border-radius: 6px; border: 1px solid #2a3246; background: #07080e; image-rendering: auto; }
#gozPaneli .gp-resim[data-var="1"] { display: block; }
#gozPaneli .gp-boyut { color: #7c88a6; font-size: 11px; margin-top: -4px; }
#gozPaneli .gp-cevap { white-space: pre-wrap; user-select: text; color: #eef1fa; }
#gozPaneli .gp-meta { color: #7c88a6; font: 11px 'Cascadia Mono', Consolas, monospace; }
`;

export function gozPaneliKur(ayar: GozPaneliAyari): GozPaneli {
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);

  const kok = document.createElement("div");
  kok.id = "gozPaneli";
  kok.dataset.acik = "0";
  const olustur = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif: string, metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); e.className = sinif; if (metin) e.textContent = metin; return e;
  };

  const baslik = olustur("div", "gp-baslik");
  const baslikYazi = olustur("b", "", "Orion'un gözü");
  const yenile = olustur("button", "", "Yeniden bak"); yenile.append(" ", Object.assign(document.createElement("kbd"), { textContent: "O" }));
  const kapatDugme = olustur("button", "", "Kapat"); kapatDugme.append(" ", Object.assign(document.createElement("kbd"), { textContent: "Esc" }));
  baslik.append(baslikYazi, yenile, kapatDugme);

  const durumSatiri = olustur("div", "gp-durum", "O tuşuyla bak");
  const resim = olustur("img", "gp-resim"); resim.alt = "Orion'un gözünden kare";
  const boyut = olustur("div", "gp-boyut");
  const cevapKutusu = olustur("div", "gp-cevap");
  const meta = olustur("div", "gp-meta");
  kok.append(baslik, durumSatiri, resim, boyut, cevapKutusu, meta);
  (ayar.ata ?? document.body).append(kok);

  let acik = false;
  function ac(): void {
    if (!acik) {
      acik = true;
      kok.dataset.acik = "1";
      ayar.acildi?.();
    }
  }
  function kapat(): void { acik = false; kok.dataset.acik = "0"; }
  const durumYaz = (m: string, tur = "") => { durumSatiri.textContent = m; if (tur) durumSatiri.dataset.tur = tur; else delete durumSatiri.dataset.tur; };

  yenile.addEventListener("click", () => ayar.istek());
  kapatDugme.addEventListener("click", kapat);

  addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const h = e.target as HTMLElement | null;
    if (h && (h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.isContentEditable)) return;
    if (e.key === "Escape" && acik) { kapat(); return; }
    if (e.key !== "o" && e.key !== "O") return;
    if (ayar.tusSerbest && !ayar.tusSerbest()) return;
    e.preventDefault();
    ayar.istek();
  });

  return {
    ac, kapat, acikMi: () => acik,
    durum(m) { durumYaz(m, /sıra bekleniyor/.test(m) ? "bekle" : ""); },
    onizleme(dataUrl, en, boy) {
      resim.src = dataUrl; resim.dataset.var = "1";
      boyut.textContent = `${en}×${boy} · Orion'un şu anki gözünden`;
      cevapKutusu.textContent = ""; meta.textContent = "";
    },
    cevap(metin, model, ms) {
      durumYaz("hazır");
      cevapKutusu.textContent = metin;
      meta.textContent = `${model} · ${(ms / 1000).toFixed(1).replace(".", ",")} sn · ${new Date().toLocaleTimeString("tr-TR")}`;
    },
    hata(mesaj) { durumYaz(mesaj, "hata"); cevapKutusu.textContent = ""; meta.textContent = ""; },
  };
}
