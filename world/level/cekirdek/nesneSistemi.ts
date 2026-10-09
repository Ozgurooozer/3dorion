// world/level/cekirdek/nesneSistemi.ts — Elle yerleştirilen varlıklar (`tanim.nesneler`): yükle, örnekle, yerleştir.
//
// Her varlık (katalogdaki glb) oturumda BİR KEZ yüklenir (AssetContainer); her yerleşim onun örneğidir (Babylon
// örnekli mesh — aynı varlıktan çok sayıda ucuz).
//
// BİRLEŞTİRME (çizim çağrısı): glTF her malzemeyi ayrı parça mesh'e böler; şehir parçası 4–7 parça, her biri ana
// çizimde VE her gölge kademesinde ayrı çizilir — 8 nesne çizimi 20'den 156'ya çıkardı (ölçüldü, spec 19). Yüklenince
// parçaların rengi KÖŞE RENGİNE gömülür ve tek mesh'te birleşir; ışıyanlar (neon, ekran — glTF emissive'i olan;
// uyarı boyası hariç) ayrı bir mesh'e. İki ortak malzeme: ışıklı (level fabrikası: güneş, gölge, sis, STİL
// eklentisi işler) ve ışıyan (pişmiş). Varlık başına ≤ 2 çizim; aynı varlığın yerleşimleri örneklemeyle tek çizim.
//
// Yerleşim konumu = varlığın TABAN ORTASI (Blender betiği pivotu oraya koyar, assets/kaynak/sehir-kiti.py).
// Seçme: örneğin mesh'lerinde `metadata.nesneIndeks` (asset tarayıcısı tıklananı bulur).
// Yükleyici paketi ve varlik.ts dinamik import: modül Node testlerinde de yüklenebilsin (sahnesiz yol fetch etmez).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Material } from "@babylonjs/core/Materials/material";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Color3 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { NesneYeri } from "./levelTanimi.ts";
import { katalogOku, type Katalog, type Varlik } from "./katalog.ts";
import type { Renk } from "./renk.ts";

export const KATALOG_DOSYASI = "sehir/katalog.json";

export interface NesneBaglami {
  sahne: Scene;
  /** Level'in malzeme fabrikası: "isikli" (stil eklentili, köşe rengi) ya da "pismis" (ışıyan, köşe rengi). */
  malzeme(ad: string, tur: "isikli" | "pismis"): Material;
  golge(mesh: AbstractMesh, ne: { atar?: boolean; alir?: boolean }): void;
  golgedenCikar(mesh: AbstractMesh): void;
}

export interface NesneSistemi {
  katalog(): Promise<Katalog>;
  uygula(nesneler: readonly NesneYeri[]): void;
  /** Tıklanan mesh hangi yerleşim (yoksa null). */
  indeksi(mesh: AbstractMesh | null | undefined): number | null;
  /** Yerleşimden bağımsız tek örnek (yerleştirme önizlemesi); çağıran `dispose` eder. */
  ornekOlustur(ad: string): Promise<TransformNode>;
  /** Kurulu yerleşim sayısı (yüklenmiş olanlar). */
  sayi(): number;
  yokEt(): void;
}

interface Kurulu { imza: string; dugum: TransformNode | null; nesil: number }

/** glTF doğrusal renk → Standard malzemenin gamma rengi. */
const gamma = (c: Color3): Renk => [c.r ** (1 / 2.2), c.g ** (1 / 2.2), c.b ** (1 / 2.2)];

/** n köşelik rgba dizisi, tek renk (parçanın rengini köşelere gömmek için). Saf. */
export function renkDizisi(n: number, r: Renk): Float32Array {
  const d = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) d.set([r[0], r[1], r[2], 1], i * 4);
  return d;
}

/** glTF malzemesinden parçanın rengi ve ışıyıp ışımadığı. Uyarı boyaları (MH_Warning_*) kaynakta ışıyor ama gündüz
 *  yol çizgisi/koni parlamasın: ışımaz, rengi ışıklı çizilir. Saf (yalnız malzeme alanlarını okur). */
export function parcaRengi(m: { name: string; albedoColor?: Color3; emissiveColor?: Color3 } | null): { renk: Renk; isiyan: boolean } {
  const e = m?.emissiveColor;
  const isiyan = !!m && !!e && e.r + e.g + e.b > 0.01 && !/warning/i.test(m.name);
  if (isiyan && e) return { renk: gamma(e), isiyan: true };
  return { renk: m?.albedoColor ? gamma(m.albedoColor) : [0.7, 0.7, 0.7], isiyan: false };
}

export function nesneSistemiKur(b: NesneBaglami): NesneSistemi {
  const { sahne } = b;
  let katalogSozu: Promise<Katalog> | null = null;
  const kaplar = new Map<string, Promise<AssetContainer>>();
  const malzemeler = new Map<string, Material>();
  const kurulu: Kurulu[] = [];
  let nesil = 0;

  const katalog = (): Promise<Katalog> => {
    katalogSozu ??= import("../../varlik.ts")
      .then(({ varlik }) => fetch(varlik(KATALOG_DOSYASI)))
      .then((y) => { if (!y.ok) throw new Error(`${KATALOG_DOSYASI}: HTTP ${y.status}`); return y.json(); })
      .then(katalogOku);
    katalogSozu.catch(() => { katalogSozu = null; });
    return katalogSozu;
  };

  const ortakMalzeme = (tur: "isikli" | "pismis"): Material => {
    let m = malzemeler.get(tur);
    if (!m) { m = b.malzeme(`nesne_${tur}`, tur); malzemeler.set(tur, m); }
    return m;
  };

  /** Kaptaki parçaları (ışıklı / ışıyan) iki köşe renkli mesh'e birleştirir; eski parçaları ve malzemeleri atar. */
  const birlestir = (kap: AssetContainer, ad: string) => {
    const parcalar = kap.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
    if (parcalar.length === 0) return;
    const ust = parcalar[0]!.parent;
    for (const isiyan of [false, true]) {
      const veriler: VertexData[] = [];
      for (const p of parcalar) {
        const r = parcaRengi(p.material as Parameters<typeof parcaRengi>[0]);
        if (r.isiyan !== isiyan) continue;
        // Parçanın kendi yerel dönüşümü (genelde birim) köşelere: birleşik mesh ortak üst düğüme bağlanır.
        const vd = VertexData.ExtractFromMesh(p, true, true);
        vd.transform(p.computeWorldMatrix(true).multiply((ust?.computeWorldMatrix(true) ?? p.getWorldMatrix()).clone().invert()));
        vd.colors = renkDizisi((vd.positions?.length ?? 0) / 3, r.renk);
        veriler.push(vd);
      }
      if (veriler.length === 0) continue;
      const tum = veriler[0]!;
      if (veriler.length > 1) tum.merge(veriler.slice(1), true);
      const m = new Mesh(`${ad}_${isiyan ? "isiyan" : "govde"}`, sahne);
      tum.applyToMesh(m, false);
      m.parent = ust;
      m.material = ortakMalzeme(isiyan ? "pismis" : "isikli");
      sahne.removeMesh(m);   // sahnede değil kapta dursun (örnekler ondan türer)
      kap.meshes.push(m);
    }
    for (const p of parcalar) { kap.meshes.splice(kap.meshes.indexOf(p), 1); p.dispose(false, false); }
  };

  const kapYukle = (v: Varlik): Promise<AssetContainer> => {
    let p = kaplar.get(v.ad);
    if (!p) {
      p = (async () => {
        const [{ LoadAssetContainerAsync }, , { varlik }] = await Promise.all([
          import("@babylonjs/core/Loading/sceneLoader"), import("@babylonjs/loaders/glTF"), import("../../varlik.ts"),
        ]);
        const kap = await LoadAssetContainerAsync(varlik(v.dosya), sahne, { pluginExtension: ".glb" });
        const eskiler = [...kap.materials];
        birlestir(kap, v.ad);
        kap.materials.length = 0;
        for (const m of eskiler) m.dispose();
        return kap;
      })();
      p.catch(() => kaplar.delete(v.ad));
      kaplar.set(v.ad, p);
    }
    return p;
  };

  const ornek = async (ad: string, ust: TransformNode): Promise<AbstractMesh[]> => {
    const k = await katalog();
    const v = k.varliklar.find((x) => x.ad === ad);
    if (!v) throw new Error(`katalogda yok: ${ad}`);
    const kap = await kapYukle(v);
    const ornekler = kap.instantiateModelsToScene((n) => `${ad}_${n}`, false);
    for (const r of ornekler.rootNodes) r.parent = ust;
    return ust.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0);
  };

  const yik = (k: Kurulu) => {
    if (!k.dugum) return;
    for (const m of k.dugum.getChildMeshes(false)) b.golgedenCikar(m);
    k.dugum.dispose(false, false);
    k.dugum = null;
  };

  return {
    katalog,
    uygula(nesneler) {
      // Fazlaları yık, değişenleri yeniden kur (indeks = kimlik; silme sonrakileri kaydırır — MVP'de kabul).
      while (kurulu.length > nesneler.length) yik(kurulu.pop()!);
      nesneler.forEach((n, i) => {
        const imza = JSON.stringify(n);
        const k = kurulu[i] ??= { imza: "", dugum: null, nesil: 0 };
        if (k.imza === imza) return;
        yik(k);
        k.imza = imza;
        const benim = k.nesil = ++nesil;
        const dugum = new TransformNode(`nesne_${i}_${n.varlik}`, sahne);
        dugum.position.set(...n.konum);
        dugum.rotation.y = (n.donus * Math.PI) / 180;
        dugum.scaling.setAll(n.olcek);
        k.dugum = dugum;
        ornek(n.varlik, dugum).then((meshler) => {
          if (k.nesil !== benim) return;   // bu arada değişti ya da silindi
          for (const m of meshler) {
            m.isPickable = true;
            m.metadata = { ...(m.metadata as object | null), nesneIndeks: i };
            b.golge(m, { atar: true, alir: true });
          }
        }).catch((err: unknown) => console.error(`[nesneler] ${n.varlik} yüklenemedi:`, err));
      });
    },
    indeksi(mesh) {
      for (let m: AbstractMesh | null | undefined = mesh; m; m = m.parent as AbstractMesh | null) {
        const i = (m.metadata as { nesneIndeks?: number } | null | undefined)?.nesneIndeks;
        if (typeof i === "number") return i;
      }
      return null;
    },
    async ornekOlustur(ad) {
      const dugum = new TransformNode(`onizleme_${ad}`, sahne);
      const meshler = await ornek(ad, dugum);
      for (const m of meshler) m.isPickable = false;
      return dugum;
    },
    sayi: () => kurulu.filter((k) => k.dugum).length,
    yokEt() {
      for (const k of kurulu) yik(k);
      kurulu.length = 0;
      for (const p of kaplar.values()) void p.then((k) => k.dispose()).catch(() => undefined);
      kaplar.clear();
      for (const m of malzemeler.values()) m.dispose();
      malzemeler.clear();
    },
  };
}
