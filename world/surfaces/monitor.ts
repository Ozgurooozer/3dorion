// world/surfaces/monitor.ts — Orion'un masasındaki monitör: 3D yüzeyde canlı terminal.
//
// KARAR (ölçümle, bkz. deneme.ts): "aday A — doku" kazandı.
// Ölçümde iki aday okunabilirlik, gecikme ve FPS'te AYIRT EDİLEMEZ çıktı
// (medyan gecikme 19.8 ms / 19.9 ms; FPS 100 / 100). Ayrımı derinlik yaptı:
// CSS bindirme (aday B) WebGL tuvalinin üstünde bir DOM katmanıdır, derinlik
// testi yoktur — monitörün önünden geçen bir nesne terminali KAPATMAZ, terminal
// dünyanın üstünde yüzer. Doku yaklaşımı gerçek bir mesh olduğu için ışık,
// sıralama, gölgeleme ve seçim (picking) bedavaya doğru çalışır.
//
// Çizim yolu: xterm yalnızca VT durum makinesi olarak koşar; hücre ızgarasını
// biz `hucre-boyaci.ts` ile doğrudan DynamicTexture bağlamına boyarız. Ara
// canvas kopyası YOKTUR — @xterm/xterm 6 çekirdeği DOM renderer ile gelir ve
// kopyalanacak bir canvas zaten üretmez (webgl eklentisi kurulu değil).
//
// Bağımlılık sınırı (K4): yalnızca @babylonjs/*, @xterm/*, host/kopru.ts (tip).
// bridge/, mind/, molp — import YOK.
"use strict";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Observer } from "@babylonjs/core/Misc/observable";
import { TerminalCekirdek } from "./terminal-cekirdek.ts";
import { izgaraBoya, olcuUret, uykuBoya } from "./hucre-boyaci.ts";

export interface MonitorAyari {
  sahne: Scene;
  /** Ekran yüzeyi olarak kullanılacak mesh (T1 odada üretir, adı "monitor_ekran"). */
  ekran: AbstractMesh;
  /** Terminalin açılacağı çalışma dizini. */
  cwd?: string;
}

export interface Monitor {
  ac(): Promise<void>;
  kapat(): void;
  acikMi(): boolean;
  odaklan(aktif: boolean): void;
  boyutlandir(): void;
  /** Son N satır çıktı — T4 bunu protocol `algi: "terminal"` olarak yayacak. */
  kuyruk(satir?: number): string;
  yokEt(): void;
}

/** Satır sayısı sabit; sütun sayısı ekranın en/boy oranından türer. */
const ROWS = 24;
const HUCRE_W = 13, HUCRE_H = 28;
/** Uyku hâli nabzı için yeniden boyama sıklığı. Her karede boyamak israftır. */
const UYKU_HZ = 12;

/**
 * Ekranın dünya ölçüsünden, hücreleri kare tutan sütun sayısını çıkarır.
 * Dünya AABB'si DEĞİL yerel kutu × ölçek kullanılır: monitör döndürüldüğünde
 * eksen hizalı kutu küçülür ve sütun sayısı yanlış çıkardı.
 */
function sutunHesapla(ekran: AbstractMesh): number {
  const k = ekran.getBoundingInfo().boundingBox.extendSize;
  const s = ekran.absoluteScaling;
  const en = k.x * 2 * Math.abs(s.x), boy = Math.max(1e-6, k.y * 2 * Math.abs(s.y));
  const sutun = Math.round(ROWS * (en / boy) * (HUCRE_H / HUCRE_W));
  return Math.min(200, Math.max(40, sutun));
}

export function monitorKur(ayar: MonitorAyari): Monitor {
  const { sahne, ekran } = ayar;
  const olcu = olcuUret(HUCRE_W, HUCRE_H);

  // xterm DOM'u ekran dışında ama YERLEŞİK durur. display:none olsaydı xterm
  // hücre ölçüsünü ölçemez ve ızgara çökerdi.
  const kap = document.createElement("div");
  kap.id = "monitor-xterm";
  kap.style.cssText = "position:absolute;left:-30000px;top:0;width:720px;height:432px;";
  document.body.appendChild(kap);

  let cols = sutunHesapla(ekran);
  const cekirdek = new TerminalCekirdek({ kap, cwd: ayar.cwd, cols, rows: ROWS, fontSize: 14 });

  const mat = new StandardMaterial("monitorMat", sahne);
  // Işıksız ekran reçetesi: doku DIFFUSE yuvasına girer, aydınlatmayı beyaz
  // emissiveColor sürer. Doku `emissiveTexture` yuvasına konursa aydınlatma
  // terimi sabit beyaz kalır ve düzlem bembeyaz çıkar (ölçüldü, bkz. deneme).
  mat.specularColor = Color3.Black();
  mat.emissiveColor = Color3.White();
  mat.disableLighting = true;
  ekran.material = mat;

  let doku: DynamicTexture | null = null;
  let bag: CanvasRenderingContext2D | null = null;
  let DW = 0, DH = 0;

  function dokuKur(): void {
    doku?.dispose();
    DW = cols * olcu.w; DH = ROWS * olcu.h;
    doku = new DynamicTexture("monitorDoku", { width: DW, height: DH }, sahne, true,
      Texture.TRILINEAR_SAMPLINGMODE);
    doku.anisotropicFilteringLevel = 16;
    doku.hasAlpha = false;
    bag = doku.getContext() as unknown as CanvasRenderingContext2D;
    mat.diffuseTexture = doku;
  }
  dokuKur();

  let odakli = false;
  let sonUyku = 0;
  let oldu = false;

  function boya(): void {
    if (oldu || !bag || !doku) return;
    const an = performance.now();
    if (cekirdek.acikMi) {
      if (!cekirdek.kirli) return;              // değişim yoksa GPU'ya dokunma
      cekirdek.temizle();
      izgaraBoya(bag, cekirdek.term, olcu, { odakli, an });
    } else {
      if (an - sonUyku < 1000 / UYKU_HZ) return;
      sonUyku = an;
      uykuBoya(bag, DW, DH, an);
    }
    doku.update();
  }
  // Kursör yanıp sönmesi yazı gelmese de kareyi kirletir — saniyede ~2 boyama.
  const yanipZaman = setInterval(() => { if (odakli && cekirdek.acikMi) cekirdek.kirlet(); }, 500);
  const gozlemci: Observer<Scene> | null = sahne.onBeforeRenderObservable.add(boya);
  boya();

  // ---- klavye yönlendirme ---------------------------------------------------
  //
  // Odaklıyken tuşlar xterm'in kendi textarea'sına DOĞAL yoldan gider (IME,
  // ölü tuş, yapıştırma bozulmasın diye sentetik olay üretmiyoruz). Dünyanın
  // aynı tuşları görmesini engellemek için olayı `document` üzerinde, kabarma
  // aşamasında durduruyoruz: o noktada textarea olayı çoktan işlemiştir ama
  // `window`'a bağlı oyuncu dinleyicilerine henüz ulaşmamıştır.
  //
  // Esc bilerek muaf: çıkış tuşudur, hem terminale gitmez hem dünyaya ulaşır.
  const dunyayaGitmesin = (ev: KeyboardEvent): void => {
    if (!odakli || oldu) return;
    if (ev.key === "Escape") return;
    ev.stopPropagation();
  };
  document.addEventListener("keydown", dunyayaGitmesin, false);
  document.addEventListener("keyup", dunyayaGitmesin, false);
  document.addEventListener("keypress", dunyayaGitmesin, false);

  // Odak kaybolmuşsa (tuvale tıklandı vb.) tuşu terminale geri çek.
  const odakToparla = (ev: KeyboardEvent): void => {
    if (!odakli || oldu) return;
    if (ev.key === "Escape") return;
    if (!kap.contains(document.activeElement)) cekirdek.term.focus();
  };
  window.addEventListener("keydown", odakToparla, true);

  // xterm'in kendi tuş süzgeci: odak yokken HİÇBİR tuş terminale girmez,
  // odak varken Esc dışında her şey girer.
  cekirdek.term.attachCustomKeyEventHandler((ev) => {
    if (!odakli) return false;
    return ev.key !== "Escape";
  });

  return {
    async ac(): Promise<void> {
      if (oldu) throw new Error("monitör yok edildi");
      if (cekirdek.acikMi) return;
      await cekirdek.ptyBagla();
      cekirdek.kirlet();
      boya();
    },

    kapat(): void {
      if (oldu) return;
      odakli = false;
      cekirdek.ptyKes();                 // pty gerçekten ölür, dinleyiciler çözülür
      cekirdek.term.reset();             // ekran arabelleği boşalır
      sonUyku = 0;
      boya();                            // uyku yüzeyi hemen görünsün
    },

    acikMi(): boolean { return cekirdek.acikMi; },

    odaklan(aktif: boolean): void {
      if (oldu) return;
      odakli = aktif && cekirdek.acikMi;
      if (odakli) cekirdek.term.focus();
      else cekirdek.term.blur();
      cekirdek.kirlet();
    },

    boyutlandir(): void {
      if (oldu) return;
      const yeni = sutunHesapla(ekran);
      if (yeni !== cols) {
        cols = yeni;
        cekirdek.boyutBildir(cols, ROWS);
        dokuKur();
      }
      cekirdek.kirlet();
      boya();
    },

    kuyruk(satir = 40): string { return cekirdek.kuyruk(satir); },

    yokEt(): void {
      if (oldu) return;
      oldu = true;
      clearInterval(yanipZaman);
      sahne.onBeforeRenderObservable.remove(gozlemci);
      document.removeEventListener("keydown", dunyayaGitmesin, false);
      document.removeEventListener("keyup", dunyayaGitmesin, false);
      document.removeEventListener("keypress", dunyayaGitmesin, false);
      window.removeEventListener("keydown", odakToparla, true);
      cekirdek.yokEt();                  // pty kapatılır, xterm ve dinleyiciler atılır
      if (ekran.material === mat) ekran.material = null;
      mat.diffuseTexture = null;
      doku?.dispose(); doku = null; bag = null;
      mat.dispose();
      kap.remove();
    },
  };
}
