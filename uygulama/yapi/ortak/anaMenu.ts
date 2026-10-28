// uygulama/yapi/ortak/anaMenu.ts — PENCERE TEPESİNDEKİ ANA MENÜ ŞERİDİ (spec 39 D2; Blender/Unreal gibi). DOM katmanı.
//
// TEK şerit, birden çok kaynak: uygulamanın tabanı (Dosya ▸ Yeni proje…/Proje aç…, Pencere) + o an açık editörün KATKISI (Sekans: Dosya, Düzen, Görünüm…).
// Aynı adlı menüler birleşir (`menuBirlestir.ts`, testli). Editörler eskiden menüyü kendi dokunun içinde çiziyordu: dok altta olduğundan menü de
// altta kalıyordu — artık şerit pencerenin TEPESİNDE sabit, açılır listeler sahnenin üstüne iner; editör bir KATKI kaydeder (`katki`) ve kapanınca bırakır.
// GÖRÜNÜRLÜK: imleç kipinde (fare serbestken tıklanabilir; Yapı çubuğuyla aynı kural) ya da bir editör katkısı varken. Görünürken `--editor-ust` yazılır:
// `index.html` tuvali şeridin ALTINDAN başlatır (sahne şeridin altında kalmaz); gizlenince değişken kalkar.
// TUŞLAR OYUNA SIZMAZ: şeritteki keydown/keyup/keypress burada biter; en son katkının `tus` işleyicisi (editörün kısayol tablosu) önce çağrılır.
"use strict";
import { el } from "./dom.ts";
import { UST_SERIT_PX, kabukStiliEkle } from "./kabukStili.ts";
import { menuCubuguKur } from "./menuCubugu.ts";
import { menuleriBirlestir } from "./menuBirlestir.ts";
import type { Menu } from "./menuModeli.ts";

/** Açık bir editörün şeride kattığı: menüleri, tuş işleyicisi ve sağ uçtaki öğeler (sekans adı, kare okuması). */
export interface AnaMenuKatkisi {
  menuler(): readonly Menu[];
  /** Şeride odaklıyken gelen tuş (editörün kısayol tablosu); oyuna ZATEN gitmez. */
  tus?(e: KeyboardEvent): void;
  sag?: readonly HTMLElement[];
}

export interface AnaMenu {
  kok: HTMLElement;
  /** Katkıyı ekler; dönen işlev bırakır (editör gizlenirken). Katkı varken şerit görünür. */
  katki(k: AnaMenuKatkisi): () => void;
  /** İmleç kipi açıldı/kapandı (şerit editör katkısı yoksa buna uyar). */
  imlecKipi(acik: boolean): void;
  /** Menüleri yeniden çöz (durum değişti). */
  ciz(): void;
  /** Açık menü listesini kapat; açık olan vardıysa true (Esc zinciri). */
  kapat(): boolean;
  gorunurMu(): boolean;
  /** Sol ucun yanındaki sabit etiket (açık proje adı). */
  etiket(metin: string): void;
}

export function anaMenuKur(taban: () => readonly Menu[]): AnaMenu {
  kabukStiliEkle();
  const kok = el("div", "kb-ustserit"); kok.dataset.acik = "0";
  const katkilar: AnaMenuKatkisi[] = [];
  const etiketYeri = el("span", "kb-ust-etiket"), sagYeri = el("span", "kb-ust-sag");
  const menu = menuCubuguKur(() => menuleriBirlestir([...katkilar.slice().reverse().map((k) => k.menuler()), taban()]));
  kok.append(etiketYeri, menu.kok, el("span", "kb-bosluk"), sagYeri);
  let imlec = false, gorunur = false;

  function yay(): void {
    const g = imlec || katkilar.length > 0;
    if (g !== gorunur) {
      gorunur = g; kok.dataset.acik = g ? "1" : "0";
      if (g) document.documentElement.style.setProperty("--editor-ust", `${UST_SERIT_PX}px`);
      else { menu.kapat(); document.documentElement.style.removeProperty("--editor-ust"); }
    }
    sagYeri.replaceChildren(...(katkilar[katkilar.length - 1]?.sag ?? []));
    menu.ciz();
  }

  kok.addEventListener("keydown", (e) => { e.stopPropagation(); katkilar[katkilar.length - 1]?.tus?.(e); });
  kok.addEventListener("keyup", (e) => e.stopPropagation());
  kok.addEventListener("keypress", (e) => e.stopPropagation());
  kok.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); });
  if (!kok.isConnected) document.body.append(kok);

  return {
    kok,
    katki(k) { katkilar.push(k); yay(); return () => { const i = katkilar.indexOf(k); if (i >= 0) katkilar.splice(i, 1); yay(); }; },
    imlecKipi(acik) { imlec = acik; yay(); },
    ciz() { menu.ciz(); },
    kapat: () => menu.kapat(),
    gorunurMu: () => gorunur,
    etiket(metin) { etiketYeri.textContent = metin; etiketYeri.title = metin; },
  };
}
