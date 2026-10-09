// world/level/editor/sahne/kamera.ts — Editör kamerası (spec 22): fare öncelikli, araçlarla çakışmasız.
//
//   Sağ tık BASILI + fare  → etrafa bak; basılıyken W A S D uç, Space/E yukarı, Q/C aşağı, Shift hızlı,
//                            tekerlek uçuş hızını değiştirir. Bırakınca tuşlar yine editörün (rakamlar, Ctrl…).
//   Orta tık sürükle       → kaydır (pan), tutulan nokta imlecin altında kalır.
//   Tekerlek               → imlecin altındaki noktaya doğru yaklaş/uzaklaş (mesafeyle orantılı).
//   Alt + sol sürükle      → pivot çevresinde dön (seçim varsa onun ortası, yoksa imlecin altındaki nokta).
//
// Babylon'un kendi kamera girdileri editör kipinde SÖKÜLÜR (detachControl) — uçuş kipine (Tab) geçince geri
// takılır; böylece iki denetim aynı tuşu hiçbir zaman birlikte okumaz. Sağ tık bakarken fare kilitlenir
// (ekran kenarına takılmasın); kilit alınamazsa (başsız tarayıcı) imleç farkıyla çalışır.
"use strict";
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Vec3 } from "../../cekirdek/levelTanimi.ts";
import type { Yuzey } from "./yuzey.ts";

export interface EditorKamerasi {
  /** Editör kipinde mi (false: Babylon'un uçuş girdileri takılı). */
  editorKipi(acik: boolean): void;
  /** Bu işaretçi olayını kamera aldı mı (sağ/orta tık, Alt+sol): editör seçime vermesin. */
  isaretciBasladi(e: PointerEvent): boolean;
  /** Sağ tık bakışı sürüyor mu (tuş haritası sorulmaz). */
  bakiyor(): boolean;
  /** Kutuyu (dünya) ekrana sığdır, bakış yönü korunur. */
  odakla(min: Vec3, max: Vec3): void;
  /** Konuma git ve hedefe bak (yer imleri), yumuşak. */
  git(konum: Vec3, hedef: Vec3): void;
  /** Alt+sol dönüşün pivotunu verir (seçim ortası); yoksa imleç altı. */
  pivotSaglayici(f: () => Vec3 | null): void;
  hiz(): number;
  hizAyarla(h: number): void;
  /** Her kare (dt sn). */
  guncelle(dt: number): void;
  yokEt(): void;
}

const UCUS_TUSLARI = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "KeyC", "Space", "ShiftLeft", "ShiftRight"]);

export function editorKamerasiKur(kamera: UniversalCamera, tuval: HTMLCanvasElement, yuzey: Yuzey, hizDegisti: (h: number) => void): EditorKamerasi {
  let editorde = false;
  let kip: "yok" | "bak" | "kaydir" | "don" = "yok";
  let sonX = 0, sonY = 0;
  let hiz = 1;
  const basili = new Set<string>();
  let kaydirNokta: Vector3 | null = null, kaydirUzaklik = 10;
  let pivot: Vector3 | null = null;
  let pivotVer: () => Vec3 | null = () => null;
  let gecis: { k0: Vector3; k1: Vector3; h0: Vector3; h1: Vector3; t: number } | null = null;

  const ileri = () => kamera.getDirection(Vector3.Forward());
  const sag = () => kamera.getDirection(Vector3.Right());
  const yukari = () => kamera.getDirection(Vector3.Up());
  const hedefNoktasi = () => kamera.position.add(ileri().scale(10));

  const fark = (e: PointerEvent): [number, number] => {
    if (document.pointerLockElement === tuval) return [e.movementX, e.movementY];
    const d: [number, number] = [e.clientX - sonX, e.clientY - sonY];
    sonX = e.clientX; sonY = e.clientY;
    return d;
  };
  const bak = (dx: number, dy: number) => {
    kamera.rotation.y += dx * 0.0035;
    kamera.rotation.x = Math.max(-1.55, Math.min(1.55, kamera.rotation.x + dy * 0.0035));
  };

  const isaretciBasladi = (e: PointerEvent): boolean => {
    if (!editorde) return false;
    sonX = e.clientX; sonY = e.clientY;
    gecis = null;
    if (e.button === 2) {
      kip = "bak";
      try { void tuval.requestPointerLock?.()?.catch?.(() => undefined); } catch { /* başsız: kilitsiz */ }
    } else if (e.button === 1) {
      kip = "kaydir";
      const r = tuval.getBoundingClientRect();
      const h = yuzey.ekrandan(e.clientX - r.left, e.clientY - r.top);
      kaydirNokta = h ? new Vector3(...h.nokta) : hedefNoktasi();
      kaydirUzaklik = Math.max(1, Vector3.Distance(kamera.position, kaydirNokta));
    } else if (e.button === 0 && e.altKey) {
      kip = "don";
      const p = pivotVer();
      const r = tuval.getBoundingClientRect();
      const h = p ? null : yuzey.ekrandan(e.clientX - r.left, e.clientY - r.top);
      pivot = p ? new Vector3(...p) : h ? new Vector3(...h.nokta) : hedefNoktasi();
    } else return false;
    tuval.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    return true;
  };

  const hareket = (e: PointerEvent) => {
    if (kip === "yok") return;
    const [dx, dy] = fark(e);
    if (kip === "bak") bak(dx, dy);
    else if (kip === "kaydir") {
      // Tutulan nokta imleçle kaysın: piksel başına dünya = uzaklık × görüş açısı / ekran yüksekliği.
      const olcek = (2 * kaydirUzaklik * Math.tan(kamera.fov / 2)) / Math.max(1, tuval.clientHeight);
      kamera.position.addInPlace(sag().scale(-dx * olcek)).addInPlace(yukari().scale(dy * olcek));
    } else if (kip === "don" && pivot) {
      const ofset = kamera.position.subtract(pivot);
      const yaw = dx * 0.005, egim = dy * 0.005;
      // Yatay: dünya Y çevresinde; dikey: kameranın sağ ekseni çevresinde (kutuptan geçmesin).
      const r = Math.hypot(ofset.x, ofset.z), aciY = Math.atan2(ofset.x, ofset.z) + yaw;
      let aciX = Math.atan2(ofset.y, r) + egim;
      aciX = Math.max(-1.45, Math.min(1.45, aciX));
      const l = ofset.length();
      kamera.position.copyFrom(pivot.add(new Vector3(Math.sin(aciY) * Math.cos(aciX) * l, Math.sin(aciX) * l, Math.cos(aciY) * Math.cos(aciX) * l)));
      kamera.setTarget(pivot);
    }
  };
  const birak = (e: PointerEvent) => {
    if (kip === "yok") return;
    if (kip === "bak" && document.pointerLockElement === tuval) document.exitPointerLock();
    kip = "yok";
    basili.clear();
    tuval.releasePointerCapture?.(e.pointerId);
  };

  const tekerlek = (e: WheelEvent) => {
    if (!editorde) return;
    e.preventDefault();
    if (kip === "bak") {
      hiz = Math.max(0.05, Math.min(20, hiz * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      hizDegisti(hiz);
      return;
    }
    const r = tuval.getBoundingClientRect();
    const h = yuzey.ekrandan(e.clientX - r.left, e.clientY - r.top);
    const hedef = h ? new Vector3(...h.nokta) : hedefNoktasi();
    const yon = hedef.subtract(kamera.position);
    const l = yon.length();
    const adim = Math.sign(-e.deltaY) * Math.max(0.15, l * 0.15);
    if (adim > 0 && l - adim < 0.3) return;   // noktanın içine girme
    kamera.position.addInPlace(yon.normalize().scale(adim));
  };

  const tusBas = (e: KeyboardEvent) => { if (kip === "bak" && UCUS_TUSLARI.has(e.code)) { basili.add(e.code); e.preventDefault(); e.stopImmediatePropagation(); } };
  const tusBirak = (e: KeyboardEvent) => { basili.delete(e.code); };

  tuval.addEventListener("pointermove", hareket);
  tuval.addEventListener("pointerup", birak);
  tuval.addEventListener("pointercancel", birak);
  tuval.addEventListener("wheel", tekerlek, { passive: false });
  // Yakalama aşamasında: sağ tık bakışındaki tuşlar editörün kısayollarına HİÇ ulaşmaz.
  addEventListener("keydown", tusBas, true);
  addEventListener("keyup", tusBirak, true);

  return {
    editorKipi(acik) {
      editorde = acik;
      if (acik) kamera.detachControl(); else kamera.attachControl(tuval, true);
      kip = "yok"; basili.clear(); gecis = null;
    },
    isaretciBasladi,
    bakiyor: () => kip === "bak",
    odakla(min, max) {
      const a = new Vector3(...min), b = new Vector3(...max);
      const merkez = a.add(b).scale(0.5), yaricap = Math.max(0.5, Vector3.Distance(a, b) / 2);
      const uzak = (yaricap / Math.sin(kamera.fov / 2)) * 1.15;
      const k1 = merkez.subtract(ileri().scale(uzak));
      gecis = { k0: kamera.position.clone(), k1, h0: hedefNoktasi(), h1: merkez, t: 0 };
    },
    git(konum, hedef) {
      gecis = { k0: kamera.position.clone(), k1: new Vector3(...konum), h0: hedefNoktasi(), h1: new Vector3(...hedef), t: 0 };
    },
    pivotSaglayici(f) { pivotVer = f; },
    hiz: () => hiz,
    hizAyarla(h) { hiz = h; },
    guncelle(dt) {
      if (gecis) {
        gecis.t = Math.min(1, gecis.t + dt / 0.3);
        const s = gecis.t * gecis.t * (3 - 2 * gecis.t);
        kamera.position.copyFrom(Vector3.Lerp(gecis.k0, gecis.k1, s));
        kamera.setTarget(Vector3.Lerp(gecis.h0, gecis.h1, s));
        if (gecis.t >= 1) gecis = null;
      }
      if (kip !== "bak" || basili.size === 0) return;
      const v = 8 * hiz * dt * (basili.has("ShiftLeft") || basili.has("ShiftRight") ? 3 : 1);
      const d = Vector3.Zero();
      if (basili.has("KeyW")) d.addInPlace(ileri());
      if (basili.has("KeyS")) d.subtractInPlace(ileri());
      if (basili.has("KeyD")) d.addInPlace(sag());
      if (basili.has("KeyA")) d.subtractInPlace(sag());
      if (basili.has("KeyE") || basili.has("Space")) d.y += 1;
      if (basili.has("KeyQ") || basili.has("KeyC")) d.y -= 1;
      if (d.lengthSquared() > 0) kamera.position.addInPlace(d.normalize().scale(v));
    },
    yokEt() {
      tuval.removeEventListener("pointermove", hareket);
      tuval.removeEventListener("pointerup", birak);
      tuval.removeEventListener("pointercancel", birak);
      tuval.removeEventListener("wheel", tekerlek);
      removeEventListener("keydown", tusBas, true);
      removeEventListener("keyup", tusBirak, true);
    },
  };
}
