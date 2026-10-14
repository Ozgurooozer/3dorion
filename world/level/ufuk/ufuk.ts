// world/level/ufuk/ufuk.ts — Ova gecesinin ufuk katmanı, Babylon tarafı: uzak şehir (tek mesh), sokak lambaları (direk + başlık +
// nokta ışık). Saf çekirdek `ufukSehri.ts`; neden/nerede orada.
//
// Level tanımından BAĞIMSIZ: `ova.level.json`a ve level modül kaydına girmez (Ozyn'in dosyası; karar 6 "ova'ya dokunulmaz").
// Birleşik dünya kurar (`yer/birlesikDunya.ts`), her kare `guncelle` ile gece ağırlığını ve sahnenin O ANKİ sis rengini verir;
// `?ufuk=0` ile hiç kurulmaz. Lambaların ışığı OVA ışık grubuna girer (ofis mesh'leri ve içerideki aktörler hariç) — bunu
// birleşik dünya yazar; bu dosya ışıkları yalnız sağlar (`isiklar`).
//
// Çizgi/GI: şehir ve başlıklar pişmiş (ışıksız) → stil çizgisi ve GI (`stil/efektler.ts cizgiyeUygun`) onları zaten almaz; şehre
// `cizgisiz` ayrıca yazılır (açık olsun). Direkler ışıklı: ova'nın dekor lambaları gibi çizgi ve GI'ye girer.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { malzemeKur } from "../cekirdek/malzeme.ts";
import { hex, type Renk } from "../cekirdek/renk.ts";
import type { IsikStiliDurumu } from "../stil/isikEklentisi.ts";
import type { DunyaUniformlari } from "../shader/dunyaEklentisi.ts";
import {
  GECE_ESIGI, LAMBA, SEHIR, SOKAK_LAMBALARI, geceAgirligi, lambaKafasi, sehirGeometrisi, sinifRenkleri, ufukBinalari,
} from "./ufukSehri.ts";

export { ufukAcikMi, ufukTanimi } from "./ufukSehri.ts";

export interface UfukAyari {
  sahne: Scene;
  /** Zemin yüksekliği (lambalar terasa oturur); verilmezse 0. */
  yukseklik?: (x: number, z: number) => number;
  /** Level'in ortak ışık stili durumu: direkler toon/cel bantlarını ova ile aynı alsın. */
  stil?: IsikStiliDurumu;
  /** Özel shader'ların ortak değerleri (direk malzemesi ova malzemeleriyle aynı eklentileri alsın). */
  dunya?: DunyaUniformlari;
  tohum?: number;
}

/** `guncelle`nin okuduğu dünya durumu (level/shader/dunyaDurumu.ts `DunyaDurumu`nun alt kümesi). */
export interface UfukDunyasi { gece: number; alacakaranlik: number; palet: Readonly<Record<string, Renk>> }

export interface Ufuk {
  /** Sokak lambalarının nokta ışıkları (birleşik dünya bunları OVA ışık grubuna koyar). */
  readonly isiklar: readonly PointLight[];
  readonly meshler: readonly Mesh[];
  /** Şehrin köşe ve pencere sayısı (ölçüm satırı). */
  readonly sayim: { kose: number; ucgen: number; pencere: number; bina: number };
  /** Her kare: gece ağırlığı ve sahnenin o anki sis rengi (ofisten bakınca ofis havası, dışarıda ova'nın gece ufku). */
  guncelle(d: UfukDunyasi, zamanVar: boolean, sis: Renk): void;
  /** Son uygulanan gece ağırlığı. */
  agirlik(): number;
  yokEt(): void;
}

/** İki renk tablosu "aynı" mı (köşe rengini boşuna yeniden yazmamak için). */
const ayni = (a: readonly Renk[], b: readonly Renk[]) =>
  a.length === b.length && a.every((r, i) => Math.abs(r[0] - b[i]![0]) + Math.abs(r[1] - b[i]![1]) + Math.abs(r[2] - b[i]![2]) < 0.004);

export function ufukKur(a: UfukAyari): Ufuk {
  const { sahne } = a;
  const zemin = a.yukseklik ?? (() => 0);

  // ── Şehir: tek mesh, köşe rengi sınıf tablosundan ──
  const binalar = ufukBinalari(a.tohum ?? SEHIR.tohum);
  const g = sehirGeometrisi(binalar);
  const kose = g.konum.length / 3;
  const renkler = new Float32Array(kose * 4).fill(1);
  const sehir = new Mesh("ufuk_sehir", sahne);
  const v = new VertexData();
  v.positions = g.konum; v.normals = g.normal; v.indices = g.indeks; v.colors = renkler;
  v.applyToMesh(sehir, true);
  sehir.isPickable = false;
  sehir.infiniteDistance = true;            // gök gibi kameraya yapışık: kubbenin (480 m) içinde kalır, yürüyünce arkasına düşmez
  sehir.metadata = { cizgisiz: true };
  const sehirMalzeme = malzemeKur(sahne, "ufuk_sehir", "pismis", { sis: false });   // sis 450 m'de %3 görünürlük bırakırdı: atmosfer renkte
  sehir.material = sehirMalzeme;

  // ── Sokak lambaları: direkler (ışıklı, tek mesh) + başlıklar (pişmiş, tek mesh) + nokta ışıklar ──
  const direkKonum: number[] = [], direkIndeks: number[] = [], basKonum: number[] = [], basIndeks: number[] = [];
  /** Eksene hizalı kutu (6 yüz, köşe paylaşımlı) — Babylon normal hesabı yeter (lowpoly değil, ince direk). */
  const kutu = (konum: number[], indeks: number[], mn: [number, number, number], mx: [number, number, number]) => {
    const t = konum.length / 3;
    for (let i = 0; i < 8; i++) konum.push(i & 1 ? mx[0] : mn[0], i & 2 ? mx[1] : mn[1], i & 4 ? mx[2] : mn[2]);
    // Yüzler (köşe bitleri: x=1, y=2, z=4); her dörtlüde (q−p)×(r−p) dışa bakar. Babylon (sol elli) ön yüzü bunun TERSİ sırada
    // (p, r, q) — `cekirdek/geometri.ts flatGeometri`deki not.
    for (const [p, q, r, s] of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]] as const) {
      indeks.push(t + p, t + r, t + q, t + p, t + s, t + r);
    }
  };
  const isiklar: PointLight[] = [];
  SOKAK_LAMBALARI.forEach((l, i) => {
    const y0 = zemin(l.x, l.z), d = LAMBA.direk / 2;
    kutu(direkKonum, direkIndeks, [l.x - d, y0 - 0.3, l.z - d], [l.x + d, y0 + LAMBA.boy, l.z + d]);
    const kolUc = l.x + l.kol * LAMBA.kol;
    kutu(direkKonum, direkIndeks, [Math.min(l.x, kolUc) - 0.05, y0 + LAMBA.boy - 0.1, l.z - 0.05], [Math.max(l.x, kolUc) + 0.05, y0 + LAMBA.boy, l.z + 0.05]);
    const k = lambaKafasi(l, y0);
    kutu(basKonum, basIndeks, [k[0] - 0.26, k[1] - 0.1, k[2] - 0.18], [k[0] + 0.26, k[1] + 0.06, k[2] + 0.18]);
    const isik = new PointLight(`ufuk_lamba_isik_${i}`, new Vector3(k[0], k[1] - LAMBA.kafaAlti, k[2]), sahne);
    isik.diffuse = Color3.FromArray([...hex(LAMBA.renk)]);
    isik.specular = Color3.Black();
    isik.range = LAMBA.menzil;
    isik.intensity = 0;
    isiklar.push(isik);
  });
  const meshYap = (ad: string, konum: number[], indeks: number[], renk: Renk) => {
    const m = new Mesh(ad, sahne);
    const vd = new VertexData();
    vd.positions = konum; vd.indices = indeks;
    const n: number[] = [];
    VertexData.ComputeNormals(konum, indeks, n);
    vd.normals = n;
    vd.colors = Array.from({ length: konum.length / 3 }, () => [renk[0], renk[1], renk[2], 1]).flat();
    vd.applyToMesh(m, false);
    m.isPickable = false;
    return m;
  };
  const direk = meshYap("ufuk_direk", direkKonum, direkIndeks, hex("#2b2e33"));
  const direkMalzeme = malzemeKur(sahne, "ufuk_direk", "isikli", { ...(a.stil ? { stil: a.stil } : {}), ...(a.dunya ? { dunya: a.dunya } : {}) });
  direk.material = direkMalzeme;
  const bas = meshYap("ufuk_lamba", basKonum, basIndeks, hex(LAMBA.renk));
  const basMalzeme = malzemeKur(sahne, "ufuk_lamba", "pismis", { sis: true });
  bas.material = basMalzeme;

  const meshler = [sehir, direk, bas];
  let agirlik = -1, acik: boolean | null = null, tablo: Renk[] = [];
  const goster = (ac: boolean) => {
    if (ac === acik) return;
    acik = ac;
    // Işığı aç/kapa: malzemelerin ışık sayısı değişir (yeniden derleme) — yalnız eşik geçilince (saat atlayınca), her kare değil.
    for (const m of meshler) m.setEnabled(ac);
    for (const l of isiklar) l.setEnabled(ac);
  };
  goster(false);

  return {
    isiklar, meshler,
    sayim: { kose, ucgen: g.indeks.length / 3, pencere: g.pencere, bina: binalar.length },
    guncelle(d, zamanVar, sis) {
      const w = geceAgirligi(d, zamanVar);
      goster(w > GECE_ESIGI);
      if (!acik) { agirlik = w; return; }
      if (Math.abs(w - agirlik) > 1e-3) {
        for (const l of isiklar) l.intensity = LAMBA.siddet * w;
        const k = 0.2 + 0.8 * w;
        basMalzeme.emissiveColor.set(k, k, k);
      }
      agirlik = w;
      const yeni = sinifRenkleri(d.palet, sis, w);
      if (ayni(yeni, tablo)) return;
      tablo = yeni;
      for (let i = 0; i < kose; i++) {
        const r = yeni[g.sinif[i]!]!;
        renkler[i * 4] = r[0]; renkler[i * 4 + 1] = r[1]; renkler[i * 4 + 2] = r[2];
      }
      sehir.updateVerticesData(VertexBuffer.ColorKind, renkler);
    },
    agirlik: () => Math.max(0, agirlik),
    yokEt() {
      for (const l of isiklar) l.dispose();
      for (const m of meshler) m.dispose();
      sehirMalzeme.dispose(); direkMalzeme.dispose(); basMalzeme.dispose();
    },
  };
}
