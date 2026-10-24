// uygulama/yapi/sekans/serbestKameraGirdisi.ts — EDİTÖR SERBEST KAMERASININ FARE/KLAVYE GİRDİSİ (spec 38 §7). DOM katmanı; matematik `serbestKamera.ts`te (saf, testli).
//
// Blender/Unreal viewport düzeni (sol tuş RİG'e ve seçime ayrılmış olduğundan): SAĞ tuş sürükle = orbit, ORTA tuş sürükle = pan, TEKERLEK = yakınlaş,
// Alt + sol tuş = orbit (dokunmatik/trackpad), SAĞ tuş BASILIYKEN W A S D = ileri/sol/geri/sağ, Q/E = aşağı/yukarı (Shift: 3× hızlı).
// Yalnız editör açıkken (`ac`/`kapat`) ve yalnız tuvalin üstünde çalışır; olaylar oyuna ve oyunun sağ tık menüsüne GİTMEZ (capture + stopImmediatePropagation).
// WASD editörün kendi tuş işleyicisinde karşılığı olmayan tuşlardır (K, N, F, ←/→… ayrı); klavye dinleyicisi editör açılmadan ÖNCE kurulur ve olayı DURDURMAZ,
// editörün yakalayıcısı sonra yutsa da basılı tuşlar burada sayılmıştır.
"use strict";
import type { Nokta3 } from "../../../protocol/sekans.ts";
import type { KameraPozu } from "../../sekans/kameraDegerlendir.ts";
import { orbit, pan, serbestKonum, uc, zoom, type SerbestKamera } from "../../sekans/editor/serbestKamera.ts";

export interface SerbestKameraGirdisi {
  /** Editör açıldı: kamera `baslangic` ile başlar (daha önce kullanıldıysa son kalınan yer korunur). */
  ac(baslangic: () => SerbestKamera | null): void;
  kapat(): void;
  aktifMi(): boolean;
  /** Şu anki poz (kameraOynatici'nın `serbest` kaynağı); kapalıysa null. */
  poz(): KameraPozu | null;
  durum(): SerbestKamera | null;
  /** Kamerayı verilen konuma al (Orion'a odakla, preset). */
  ayarla(k: SerbestKamera): void;
}

const HIZ_M_SN = 2.2;

export function serbestKameraGirdisiKur(a: { tuval: HTMLElement; kareGozcusu: (f: () => void) => () => void }): SerbestKameraGirdisi {
  let kam: SerbestKamera | null = null, aktif = false;
  let surukle: { mod: "orbit" | "pan"; id: number } | null = null, sonX = 0, sonY = 0;
  const basili = new Set<string>();
  let sagTus = false;

  // Klavye: editör açılmadan önce kurulur, olayı durdurmaz.
  addEventListener("keydown", (e) => { if (aktif) basili.add(e.code); }, { capture: true });
  addEventListener("keyup", (e) => { basili.delete(e.code); }, { capture: true });
  addEventListener("blur", () => { basili.clear(); sagTus = false; });

  const yut = (e: Event): void => { e.stopImmediatePropagation(); e.preventDefault(); };

  a.tuval.addEventListener("pointerdown", (e) => {
    if (!aktif || !kam) return;
    const mod = e.button === 2 ? "orbit" : e.button === 1 ? "pan" : e.button === 0 && e.altKey ? "orbit" : null;
    if (!mod) return;
    yut(e);
    surukle = { mod, id: e.pointerId }; sonX = e.clientX; sonY = e.clientY;
    if (e.button === 2) sagTus = true;
    try { a.tuval.setPointerCapture(e.pointerId); } catch { /* sentetik olay: yakalama yok */ }
  }, { capture: true });
  a.tuval.addEventListener("pointermove", (e) => {
    if (!surukle || !kam || e.pointerId !== surukle.id) return;
    const dx = e.clientX - sonX, dy = e.clientY - sonY;
    sonX = e.clientX; sonY = e.clientY;
    kam = surukle.mod === "orbit" ? orbit(kam, dx, dy) : pan(kam, dx, dy, a.tuval.clientHeight);
  }, { capture: true });
  const birak = (e: PointerEvent): void => {
    if (!surukle || e.pointerId !== surukle.id) return;
    surukle = null; sagTus = false;
    try { a.tuval.releasePointerCapture(e.pointerId); } catch { /* yakalama yoktu */ }
  };
  a.tuval.addEventListener("pointerup", birak, { capture: true });
  a.tuval.addEventListener("pointercancel", birak, { capture: true });
  a.tuval.addEventListener("wheel", (e) => {
    if (!aktif || !kam) return;
    yut(e);
    kam = zoom(kam, Math.max(-3, Math.min(3, e.deltaY / 100)));
  }, { capture: true, passive: false });
  // Sağ tık oyunun bağlam menüsünü açmasın.
  a.tuval.addEventListener("contextmenu", (e) => { if (aktif) yut(e); }, { capture: true });
  a.tuval.addEventListener("auxclick", (e) => { if (aktif && e.button === 1) yut(e); }, { capture: true });

  // Uçuş: sağ tuş basılıyken WASD/QE; kare başına dt ile.
  let sonT = performance.now();
  a.kareGozcusu(() => {
    const t = performance.now(), dt = Math.min(0.1, (t - sonT) / 1000);
    sonT = t;
    if (!aktif || !kam || !sagTus) return;
    const ileri = (basili.has("KeyW") ? 1 : 0) - (basili.has("KeyS") ? 1 : 0);
    const sag = (basili.has("KeyD") ? 1 : 0) - (basili.has("KeyA") ? 1 : 0);
    const yukari = (basili.has("KeyE") ? 1 : 0) - (basili.has("KeyQ") ? 1 : 0);
    const hiz = HIZ_M_SN * (basili.has("ShiftLeft") || basili.has("ShiftRight") ? 3 : 1);
    kam = uc(kam, ileri, sag, yukari, hiz, dt);
  });

  const pozDen = (k: SerbestKamera): KameraPozu => ({ konum: serbestKonum(k) as Nokta3, hedef: [...k.hedef], fov: k.fov, kamera: "serbest" });
  return {
    ac(baslangic) { aktif = true; if (!kam) kam = baslangic(); },
    kapat() { aktif = false; surukle = null; sagTus = false; basili.clear(); },
    aktifMi: () => aktif,
    poz: () => (aktif && kam ? pozDen(kam) : null),
    durum: () => kam,
    ayarla(k) { kam = k; },
  };
}
