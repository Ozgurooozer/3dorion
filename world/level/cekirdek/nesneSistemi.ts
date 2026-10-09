// world/level/cekirdek/nesneSistemi.ts — Elle yerleştirilen varlıklar (`tanim.nesneler`): yükle, örnekle, yerleştir.
//
// Her varlık (katalogdaki glb) oturumda BİR KEZ yüklenir (AssetContainer); her yerleşim onun örneğidir (Babylon
// örnekli mesh — aynı varlıktan çok sayıda ucuz). glTF'in PBR malzemeleri yüklenince level'in malzeme fabrikasına
// çevrilir (malzeme adı başına bir kez): böylece güneş, gölge, sis ve STİL eklentisi (toon, çizgi…) bu nesnelere
// de işler. Işıyan malzemeler (neon, ekran) glTF emissive'inden `isima` alır.
//
// Yerleşim konumu = varlığın TABAN ORTASI (Blender betiği pivotu oraya koyar, assets/kaynak/sehir-kiti.py).
// Seçme: örneğin mesh'lerinde `metadata.nesneIndeks` (asset tarayıcısı tıklananı bulur).
// Yükleyici paketi ve varlik.ts dinamik import: modül Node testlerinde de yüklenebilsin (sahnesiz yol fetch etmez).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Color3 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { NesneYeri } from "./levelTanimi.ts";
import { katalogOku, type Katalog, type Varlik } from "./katalog.ts";
import type { Renk } from "./renk.ts";

export const KATALOG_DOSYASI = "sehir/katalog.json";

export interface NesneBaglami {
  sahne: Scene;
  /** Level'in malzeme fabrikası (ışıklı + stil eklentisi): renk ve ışıma. */
  malzeme(ad: string, renk: Renk, isima: Renk | null): Material;
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

  /** glTF malzemesini fabrikaya çevirir (ad başına bir kez). */
  const cevir = (m: Material): Material => {
    const var_ = malzemeler.get(m.name);
    if (var_) return var_;
    const p = m as Material & { albedoColor?: Color3; emissiveColor?: Color3 };
    const renk: Renk = p.albedoColor ? gamma(p.albedoColor) : [0.7, 0.7, 0.7];
    const e = p.emissiveColor;
    // Uyarı boyaları (MH_Warning_*) kaynakta ışıyor: yol çizgisi, koni, bariyer gündüz parlamasın — yalnız neon/ekran ışır.
    const isima = e && e.r + e.g + e.b > 0.01 && !/warning/i.test(m.name) ? gamma(e) : null;
    const yeni = b.malzeme(`nesne_${m.name}`, renk, isima);
    malzemeler.set(m.name, yeni);
    return yeni;
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
        for (const m of kap.meshes) if (m.material) m.material = cevir(m.material);
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
