// world/level/cekirdek/nesneSistemi.ts — Elle yerleştirilen varlıklar (`tanim.nesneler`): yükle, örnekle, yerleştir.
//
// Her varlık (katalogdaki glb) oturumda BİR KEZ yüklenir (AssetContainer); her yerleşim onun ÖRNEĞİDİR (Babylon
// InstancedMesh — aynı varlıktan çok sayıda tek çizimde). DİKKAT: `instantiateModelsToScene` varsayılanı KOPYADIR
// (`doNotInstantiate: true`); spec 22 ölçümüne dek öyle kalmıştı — 192 nesnede kare başına 1106 çizim çağrısı.
// Yerleştirme hayaleti bilerek kopya (yarı saydamlığı örnekte bütün aynı varlıklara geçerdi).
//
// BİRLEŞTİRME (çizim çağrısı): glTF her malzemeyi ayrı parça mesh'e böler; şehir parçası 4–7 parça, her biri ana
// çizimde VE her gölge kademesinde ayrı çizilir — 8 nesne çizimi 20'den 156'ya çıkardı (ölçüldü, spec 19). Yüklenince
// parçaların rengi KÖŞE RENGİNE gömülür ve tek mesh'te birleşir; ışıyanlar (neon, ekran — glTF emissive'i olan;
// uyarı boyası hariç) ayrı bir mesh'e. İki ortak malzeme: ışıklı (level fabrikası: güneş, gölge, sis, STİL
// eklentisi işler) ve ışıyan (pişmiş). Varlık başına ≤ 2 kaynak mesh; aynı varlığın bütün yerleşimleri tek örnekli çizim
// (geçiş başına: ana + her gölge kademesi).
//
// KİMLİK (spec 22): yerleşim `id` ile eşleşir (sıra değil): silme ya da araya ekleme diğerlerine dokunmaz. İmza iki
// parça: VARLIK değişirse yeniden yüklenir; yalnız konum/dönüş/ölçek/gizlilik değişirse düğüm YERİNDE güncellenir
// (yükleme yok) — editör sürüklemeyi bitirince binlerce nesnelik level'da bile anında.
//
// Yerleşim konumu = varlığın TABAN ORTASI (Blender betiği pivotu oraya koyar, assets/kaynak/sehir-kiti.py).
// Seçme: düğümde ve örneğin mesh'lerinde `metadata.nesneId` (`idsi` üst zincirde arar).
// Yükleyici paketi ve varlik.ts dinamik import: modül Node testlerinde de yüklenebilsin (sahnesiz yol fetch etmez).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Node } from "@babylonjs/core/node";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Color3 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { GrupTanimi, NesneYeri } from "./levelTanimi.ts";
import { katalogOku, katalogBirlestir, type Katalog, type Varlik } from "./katalog.ts";
import { anlamSozluguOku, anlamBirlestir, type AnlamSozlugu } from "./anlam.ts";
import { donusRadyan, olcekVec } from "./donusum.ts";
import { etkinBayrak } from "./grup.ts";
import type { Renk } from "./renk.ts";

/** Varlık kitleri: her biri assets/<kit>/ altında katalog.json + anlam.json (şehir, yeşil harabe). Katalog bunların birleşimi. */
export const KITLER = ["sehir", "orman"] as const;
export const KATALOG_DOSYALARI = KITLER.map((k) => `${k}/katalog.json`);
/** Varlıkların Orion için anlam sözlüğü (spec 23 B; cekirdek/anlam.ts). */
export const ANLAM_DOSYALARI = KITLER.map((k) => `${k}/anlam.json`);

/** Bir kit dosyasını getirir (varlık yolu çözücüsüyle); yoksa dosya adıyla HATA. */
async function kitDosyasi(ad: string): Promise<unknown> {
  const { varlik } = await import("../../varlik.ts");
  const y = await fetch(varlik(ad));
  if (!y.ok) throw new Error(`${ad}: HTTP ${y.status}`);
  return y.json();
}

/**
 * Varlığın bir örneğini `ust` altına kurar, mesh'lerini döner (test sahte yükleyici verir; asıl yol glb).
 * `kopya`: örnekli değil bağımsız kopya (hayalet: kendi saydamlığı olsun).
 */
export type NesneYukleyici = (ad: string, ust: TransformNode, kopya?: boolean) => Promise<AbstractMesh[]>;

export interface NesneBaglami {
  sahne: Scene;
  /** Level'in malzeme fabrikası: "isikli" (stil eklentili, köşe rengi) ya da "pismis" (ışıyan, köşe rengi). */
  malzeme(ad: string, tur: "isikli" | "pismis"): Material;
  golge(mesh: AbstractMesh, ne: { atar?: boolean; alir?: boolean }): void;
  golgedenCikar(mesh: AbstractMesh): void;
  /** Verilmezse katalog + glb (asıl yol). */
  yukleyici?: NesneYukleyici;
}

export interface NesneSistemi {
  katalog(): Promise<Katalog>;
  /** Anlam sözlüğü (Türkçe ad, tür, eylemler; katalogla aynı önbellek deseni). */
  anlamlar(): Promise<AnlamSozlugu>;
  /** Yerleşimleri tanıma uydurur (kimlikle eşler; gruplar gizliliği verir). Kimliksiz yerleşim atlanır. */
  uygula(nesneler: readonly NesneYeri[], gruplar?: readonly GrupTanimi[]): void;
  /** Tıklanan mesh hangi yerleşim (kimliği; yoksa null). */
  idsi(mesh: Node | null | undefined): string | null;
  /** Yerleşimin sahne düğümü (editör gizmosu buna takılır). Yoksa null. */
  dugum(id: string): TransformNode | null;
  /** Yerleşimin yüklenmiş mesh'leri (vurgu, sınır kutusu). Yüklenmemişse boş. */
  meshleri(id: string): AbstractMesh[];
  /** Yerleşimden bağımsız tek örnek (yerleştirme önizlemesi); çağıran `dispose` eder. */
  ornekOlustur(ad: string): Promise<TransformNode>;
  /** Kurulu yerleşim sayısı ve yüklemesi süren sayı. */
  sayi(): number;
  bekleyen(): number;
  /** Süren bütün yüklemeler bitince (testler, CDP betikleri). */
  hazir(): Promise<void>;
  /** Bir yerleşim yüklenince (kimliğiyle): editör vurguyu/gizmoyu yeniden bağlar. */
  yuklenince(f: (id: string) => void): () => void;
  /** Varlık kaç kez yüklendi (örnek kuruldu) — ölçüm/test: taşıma yeniden yüklememeli. */
  yuklemeSayisi(): number;
  yokEt(): void;
}

interface Kurulu {
  varlik: string;
  donusum: string;
  dugum: TransformNode;
  meshler: AbstractMesh[];
  nesil: number;
  yukleniyor: boolean;
}

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

/** Yerinde güncellenebilen kısım (konum, dönüş, ölçek, gizlilik) — değişirse yükleme YOK. Saf. */
export const donusumImzasi = (n: NesneYeri, gizli: boolean): string => JSON.stringify([n.konum, n.donus, n.olcek, gizli]);

export function nesneSistemiKur(b: NesneBaglami): NesneSistemi {
  const { sahne } = b;
  let katalogSozu: Promise<Katalog> | null = null;
  const kaplar = new Map<string, Promise<AssetContainer>>();
  const malzemeler = new Map<string, Material>();
  const kurulu = new Map<string, Kurulu>();
  const yuklenmeDinleyicileri = new Set<(id: string) => void>();
  const surenler = new Set<Promise<unknown>>();
  let nesil = 0, yuklemeSayaci = 0;

  const katalog = (): Promise<Katalog> => {
    katalogSozu ??= Promise.all(KATALOG_DOSYALARI.map(kitDosyasi)).then((h) => katalogBirlestir(h.map(katalogOku)));
    katalogSozu.catch(() => { katalogSozu = null; });
    return katalogSozu;
  };
  let anlamSozu: Promise<AnlamSozlugu> | null = null;
  const anlamlar = (): Promise<AnlamSozlugu> => {
    anlamSozu ??= Promise.all(ANLAM_DOSYALARI.map(kitDosyasi)).then((h) => anlamBirlestir(h.map(anlamSozluguOku)));
    anlamSozu.catch(() => { anlamSozu = null; });
    return anlamSozu;
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
      // Örnekler gölge almayı KAYNAKTAN okur (InstancedMesh.receiveShadows kaynağınki): burada açık olmalı.
      m.receiveShadows = !isiyan;
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

  /** Asıl yükleyici: katalogdan bul, kabı yükle, örnekle. Bu arada üst düğüm yıkıldıysa örnekleri atar (sızıntı yok). */
  const glbYukleyici: NesneYukleyici = async (ad, ust, kopya = false) => {
    const k = await katalog();
    const v = k.varliklar.find((x) => x.ad === ad);
    if (!v) throw new Error(`katalogda yok: ${ad}`);
    const kap = await kapYukle(v);
    const ornekler = kap.instantiateModelsToScene((n) => `${ad}_${n}`, false, { doNotInstantiate: kopya });
    if (ust.isDisposed()) { for (const r of ornekler.rootNodes) r.dispose(false, false); return []; }
    for (const r of ornekler.rootNodes) r.parent = ust;
    return ust.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0);
  };
  const yukle = b.yukleyici ?? glbYukleyici;

  const yik = (k: Kurulu) => {
    k.nesil = -1;
    for (const m of k.meshler) b.golgedenCikar(m);
    k.dugum.dispose(false, false);
    k.meshler = [];
  };

  const donusumUygula = (d: TransformNode, n: NesneYeri, gizli: boolean) => {
    d.position.set(...n.konum);
    d.rotationQuaternion = null;
    d.rotation.set(...donusRadyan(n.donus));
    d.scaling.set(...olcekVec(n.olcek));
    d.setEnabled(!gizli);
  };

  const kur = (id: string, n: NesneYeri, gizli: boolean): Kurulu => {
    const dugum = new TransformNode(`nesne_${id}_${n.varlik}`, sahne);
    dugum.metadata = { nesneId: id };
    donusumUygula(dugum, n, gizli);
    const k: Kurulu = { varlik: n.varlik, donusum: donusumImzasi(n, gizli), dugum, meshler: [], nesil: ++nesil, yukleniyor: true };
    const benim = k.nesil;
    yuklemeSayaci++;
    const s = yukle(n.varlik, dugum).then((meshler) => {
      if (k.nesil !== benim || dugum.isDisposed()) {
        // Bu arada değişti ya da silindi: geç gelen örnekler sahnede kalmasın.
        for (const m of meshler) if (!m.isDisposed()) m.dispose(false, false);
        return;
      }
      k.yukleniyor = false;
      k.meshler = meshler;
      for (const m of meshler) {
        m.isPickable = true;
        m.metadata = { ...(m.metadata as object | null), nesneId: id };
        b.golge(m, { atar: true, alir: true });
      }
      for (const f of yuklenmeDinleyicileri) f(id);
    }).catch((err: unknown) => {
      k.yukleniyor = false;
      console.error(`[nesneler] ${n.varlik} yüklenemedi:`, err);
    }).finally(() => surenler.delete(s));
    surenler.add(s);
    return k;
  };

  return {
    katalog,
    anlamlar,
    uygula(nesneler, gruplar = []) {
      const istenen = new Set<string>();
      for (const n of nesneler) {
        if (!n.id) continue;
        istenen.add(n.id);
        const gizli = etkinBayrak(n, gruplar, "gizli");
        const k = kurulu.get(n.id);
        if (k && k.varlik === n.varlik) {
          const imza = donusumImzasi(n, gizli);
          if (k.donusum !== imza) { donusumUygula(k.dugum, n, gizli); k.donusum = imza; }
          continue;
        }
        if (k) yik(k);
        kurulu.set(n.id, kur(n.id, n, gizli));
      }
      for (const [id, k] of kurulu) if (!istenen.has(id)) { yik(k); kurulu.delete(id); }
    },
    idsi(dugum) {
      for (let d: Node | null | undefined = dugum; d; d = d.parent) {
        const id = (d.metadata as { nesneId?: string } | null | undefined)?.nesneId;
        if (typeof id === "string") return id;
      }
      return null;
    },
    dugum: (id) => kurulu.get(id)?.dugum ?? null,
    meshleri: (id) => kurulu.get(id)?.meshler ?? [],
    async ornekOlustur(ad) {
      const dugum = new TransformNode(`onizleme_${ad}`, sahne);
      const meshler = await yukle(ad, dugum, true);
      for (const m of meshler) m.isPickable = false;
      return dugum;
    },
    sayi: () => [...kurulu.values()].filter((k) => !k.yukleniyor).length,
    bekleyen: () => [...kurulu.values()].filter((k) => k.yukleniyor).length,
    async hazir() { while (surenler.size) await Promise.allSettled([...surenler]); },
    yuklenince(f) { yuklenmeDinleyicileri.add(f); return () => { yuklenmeDinleyicileri.delete(f); }; },
    yuklemeSayisi: () => yuklemeSayaci,
    yokEt() {
      for (const k of kurulu.values()) yik(k);
      kurulu.clear();
      yuklenmeDinleyicileri.clear();
      for (const p of kaplar.values()) void p.then((k) => k.dispose()).catch(() => undefined);
      kaplar.clear();
      for (const m of malzemeler.values()) m.dispose();
      malzemeler.clear();
    },
  };
}
