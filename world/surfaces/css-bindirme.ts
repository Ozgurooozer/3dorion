// world/surfaces/css-bindirme.ts — Aday B: gerçek DOM'u 3D düzlemin üstüne oturt.
//
// Yaklaşım: kameranın iç yapısını taklit etmeye çalışmıyoruz. Düzlemin dört
// köşesini Babylon'un kendi projeksiyonuyla ekran koordinatına indiriyor,
// sonra "kaynak dikdörtgen → hedef dörtgen" düzlemsel homografisini çözüp
// CSS `matrix3d` olarak basıyoruz. Böylece FOV, ortografik/perspektif,
// viewport ve pencere ölçeği değişse de bindirme doğru kalır.
//
// Bilinen yapısal zaaf (ölçümde doğrulanacak): DOM katmanı WebGL tuvalinin
// ÜSTÜNDEDİR; derinlik testi yoktur. Monitörün önüne geçen bir nesne
// terminali kapatmaz. Bu, "dünyaya gömülü" hissini kıran kusurdur.
"use strict";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Scene } from "@babylonjs/core/scene";

/** 3×3 homografiyi 8 bilinmeyenli doğrusal sistemi çözerek bulur. */
function homografiCoz(
  kaynak: readonly [number, number][],
  hedef: readonly [number, number][],
): number[] | null {
  // X = (a·x + b·y + c) / (g·x + h·y + 1),  Y = (d·x + e·y + f) / (g·x + h·y + 1)
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const k = kaynak[i]!, hd = hedef[i]!;
    const [x, y] = k, [X, Y] = hd;
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); B.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); B.push(Y);
  }
  // Kısmi pivotlu Gauss eliminasyonu. 8×8, kare başına bir kez: maliyeti ihmal edilebilir.
  const n = 8;
  for (let s = 0; s < n; s++) {
    let en = s;
    for (let r = s + 1; r < n; r++) if (Math.abs(A[r]![s]!) > Math.abs(A[en]![s]!)) en = r;
    if (Math.abs(A[en]![s]!) < 1e-9) return null;        // tekil: düzlem kenardan görünüyor
    if (en !== s) {
      const t = A[s]!; A[s] = A[en]!; A[en] = t;
      const tb = B[s]!; B[s] = B[en]!; B[en] = tb;
    }
    const piv = A[s]![s]!;
    for (let r = s + 1; r < n; r++) {
      const f = A[r]![s]! / piv;
      if (f === 0) continue;
      for (let c = s; c < n; c++) A[r]![c] = A[r]![c]! - f * A[s]![c]!;
      B[r] = B[r]! - f * B[s]!;
    }
  }
  const h = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let acc = B[r]!;
    for (let c = r + 1; c < n; c++) acc -= A[r]![c]! * h[c]!;
    h[r] = acc / A[r]![r]!;
  }
  return h;
}

export interface BindirmeAyari {
  sahne: Scene;
  ekran: AbstractMesh;
  /** Bindirilecek DOM kökü (xterm kabı). */
  katman: HTMLElement;
  /** Katmanın CSS piksel ölçüsü. Homografinin kaynak dikdörtgeni. */
  genislik: number;
  yukseklik: number;
  /** Babylon'un varsayılan düzlemi -Z'ye bakar; ayna gerekirse true. */
  aynala?: boolean;
}

export interface Bindirme {
  guncelle(): void;
  gorunur(g: boolean): void;
  /** Son karede düzlem kameraya arkasını mı dönmüştü. */
  arkaMi(): boolean;
  yokEt(): void;
}

export function bindirmeKur(ayar: BindirmeAyari): Bindirme {
  const { sahne, ekran, katman } = ayar;
  const kutu = ekran.getBoundingInfo().boundingBox;
  const enk = kutu.minimum, ens = kutu.maximum;

  // Yerel XY düzlemindeki dört köşe. Sıra: SolÜst, SağÜst, SağAlt, SolAlt.
  const yerel: Vector3[] = [
    new Vector3(enk.x, ens.y, 0), new Vector3(ens.x, ens.y, 0),
    new Vector3(ens.x, enk.y, 0), new Vector3(enk.x, enk.y, 0),
  ];
  if (ayar.aynala) { const t = yerel[0]!; yerel[0] = yerel[1]!; yerel[1] = t; const u = yerel[3]!; yerel[3] = yerel[2]!; yerel[2] = u; }

  const W = ayar.genislik, H = ayar.yukseklik;
  const kaynak: [number, number][] = [[0, 0], [W, 0], [W, H], [0, H]];
  katman.style.transformOrigin = "0 0";
  katman.style.position = "absolute";
  katman.style.left = "0";
  katman.style.top = "0";
  katman.style.width = `${W}px`;
  katman.style.height = `${H}px`;

  let arka = false;
  let gorunurMu = true;

  function guncelle(): void {
    if (!gorunurMu) return;
    const kam: Camera | null = sahne.activeCamera;
    const motor = sahne.getEngine();
    if (!kam) return;
    const vp = kam.viewport.toGlobal(motor.getRenderWidth(), motor.getRenderHeight());
    const olcek = motor.getHardwareScalingLevel();   // CSS piksel = render piksel × ölçek
    const dunya = ekran.getWorldMatrix();
    const donusum = sahne.getTransformMatrix();

    const hedef: [number, number][] = [];
    for (const v of yerel) {
      const p = Vector3.Project(v, dunya, donusum, vp);
      hedef.push([p.x * olcek, p.y * olcek]);
    }
    // İşaretli alan: negatifse düzlem arkasını dönmüş → DOM aynalanır, gizle.
    const [a, b, c] = [hedef[0]!, hedef[1]!, hedef[2]!];
    const alan = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    arka = alan <= 0;
    if (arka) { katman.style.visibility = "hidden"; return; }

    const h = homografiCoz(kaynak, hedef);
    if (!h) { katman.style.visibility = "hidden"; return; }
    katman.style.visibility = "visible";
    // CSS matrix3d sütun-öncelikli; 2D homografi w bileşenine gömülür.
    katman.style.transform =
      `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
  }

  const gozlemci = sahne.onAfterRenderObservable.add(guncelle);
  // Matris çözümü kameranın o karedeki son hâlini kullanır; render sonrası
  // güncellemek DOM ile WebGL arasındaki bir kare gecikmesini kabul eder.

  return {
    guncelle,
    gorunur(g) {
      gorunurMu = g;
      katman.style.visibility = g ? "visible" : "hidden";
      if (g) guncelle();
    },
    arkaMi() { return arka; },
    yokEt() {
      sahne.onAfterRenderObservable.remove(gozlemci);
      katman.style.transform = "";
    },
  };
}

/** Ölçüm için: düzlemin ekranda kapladığı yatay/dikey piksel uzunluğu. */
export function ekranPikseli(sahne: Scene, ekran: AbstractMesh): { yatay: number; dikey: number } {
  const kam = sahne.activeCamera;
  const motor = sahne.getEngine();
  if (!kam) return { yatay: 0, dikey: 0 };
  const vp = kam.viewport.toGlobal(motor.getRenderWidth(), motor.getRenderHeight());
  const kutu = ekran.getBoundingInfo().boundingBox;
  const d = ekran.getWorldMatrix();
  const t: Matrix = sahne.getTransformMatrix();
  const p = (x: number, y: number) => Vector3.Project(new Vector3(x, y, 0), d, t, vp);
  const su = p(kutu.minimum.x, kutu.maximum.y), sg = p(kutu.maximum.x, kutu.maximum.y);
  const au = p(kutu.minimum.x, kutu.minimum.y);
  return {
    yatay: Math.hypot(sg.x - su.x, sg.y - su.y),
    dikey: Math.hypot(au.x - su.x, au.y - su.y),
  };
}
