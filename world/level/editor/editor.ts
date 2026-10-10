// world/level/editor/editor.ts — Level editörünün kompozisyon kökü (spec 22).
//
// Parçalar birbirini bilmez; burada bağlanır:
//   cekirdek/ (saf)   durum (tek değişiklik yolu + geçmiş), komutlar, seçim, yaslama, tuş haritası, pano
//   sahne/ (Babylon)  yüzey ışını, editör kamerası, gizmo, vurgu, yüzeyde sürükleme, yerleştirme hayaleti, ızgara
//   arayuz/ (DOM)     araç çubuğu, sahne ağacı, özellikler, varlık tarayıcısı… — `editorArayuzuKur` (ayrı), yalnız
//                     `Editor` API'sini ve durum olaylarını kullanır.
//
// İŞARETÇİ SIRASI (sol tık): kamera (sağ/orta/Alt+sol) → gizmo tutamağı → yerleştirme → fırça → nesne/boşluk.
// Nesneye basıp sürüklemek onu yüzeyde kaydırır (seçili değilse önce seçer); boşlukta sürüklemek kutu seçimidir;
// sürüklemeden bırakmak tıklamadır. Shift ile sürükleme başlarsa önce kopyalar (kopya yerinde kalır).
// Tuşlar tek dinleyiciden `KISAYOLLAR`a sorulur; sağ tıkla bakarken sorulmaz (kamera tutar).
"use strict";
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Level } from "../cekirdek/levelKur.ts";
import type { LevelTanimi, Vec3 } from "../cekirdek/levelTanimi.ts";
import type { Katalog } from "../cekirdek/katalog.ts";
import type { AnlamSozlugu } from "../cekirdek/anlam.ts";
import { kisaAd } from "../cekirdek/katalog.ts";
import { kisaDonus } from "../cekirdek/donusum.ts";
import { onayarUygula, onayarAdi, ONAYAR_ADLARI, paletDuzeniUygula, paletDuzeniAdi, PALET_DUZENI_ADLARI } from "../stil/stilTanimi.ts";
import { editorDurumuKur, type AracAdi, type EditorAyarlari, type EditorDurumu, AYAR_VARSAYILAN } from "./cekirdek/durum.ts";
import * as K from "./cekirdek/komutlar.ts";
import { secimUygula, hepsiniSec, kutudakiler, secilebilir, type SecimKipi } from "./cekirdek/secim.ts";
import { etkin } from "./cekirdek/yaslama.ts";
import { KISAYOLLAR, eslesen, type Eylem } from "./cekirdek/kisayol.ts";
import { parcaAl, parcaMetni, parcaOku, parcaYerlestir, type Parca } from "./cekirdek/pano.ts";
import { yuzeyKur, type Yuzey } from "./sahne/yuzey.ts";
import { editorKamerasiKur, type EditorKamerasi } from "./sahne/kamera.ts";
import { gizmoKatmaniKur } from "./sahne/gizmo.ts";
import { vurguKur } from "./sahne/vurgu.ts";
import { yuzeySuruklemeKur } from "./sahne/yuzeySurukle.ts";
import { yerlestirmeKur, type YerlestirmeKaynagi } from "./sahne/yerlestirme.ts";
import { izgaraKur } from "./sahne/izgara.ts";
import { fircaImleciKur } from "./sahne/firca.ts";
import { cetvelKur, olcumMetni } from "./sahne/cetvel.ts";
import { damgaAdaylari, adaylariEkle, silgiDamgasi } from "./cekirdek/firca.ts";
import { normaleHizaliDonus } from "./cekirdek/yaslama.ts";
import { rastgele } from "../cekirdek/rastgele.ts";
import { araziDamgasiUygula, araziKatmani, araziIslemAdi, nesneleriOturt, rampaKomutu } from "./cekirdek/araziKomutu.ts";
import { bolgeBirlesim } from "../cekirdek/arazi.ts";
import type { Bolge } from "../cekirdek/modul.ts";
import { ZEMIN_VARSAYILAN, zeminTabanYuksekligi, zeminYuksekligi, type ZeminAyari } from "../moduller/zemin.ts";
import { ayarBirlestir } from "../cekirdek/modul.ts";

export interface EditorAyari {
  level: Level;
  kamera: UniversalCamera;
  tuval: HTMLCanvasElement;
  /** Tanımı dosyaya yazar; başarıda yazılan yolu döner, başarısızsa fırlatır. */
  kaydet(t: LevelTanimi): Promise<string>;
  inspektor?(): Promise<boolean>;
  ayarlar?: EditorAyarlari;
}

/** Arayüzün editöre taktığı kancalar (yardım kartı, varlık araması…). */
export interface ArayuzKancalari {
  yardim?(): void;
  varlikAra?(): void;
  /** Orion'un gözü katmanını aç/kapa (spec 23 B). */
  orionGozu?(): void;
  /** Kutu seçimi dikdörtgeni (tuval pikseli); null = gizle. */
  secimKutusu?(k: { x0: number; y0: number; x1: number; y1: number } | null): void;
}

export interface Editor {
  readonly durum: EditorDurumu;
  readonly level: Level;
  readonly sahne: Scene;
  readonly tuval: HTMLCanvasElement;
  readonly yuzey: Yuzey;
  readonly kamera: EditorKamerasi;
  katalog(): Promise<Katalog>;
  /** Orion için anlam sözlüğü (spec 23 B). */
  anlamlar(): Promise<AnlamSozlugu>;
  eylem(e: Eylem, s?: { yuva?: number; shift?: boolean }): void;
  yerlestirmeyeBasla(k: YerlestirmeKaynagi): void;
  yerlestirmeyiBitir(): void;
  yerlestiriliyor(): YerlestirmeKaynagi | null;
  /** Yerleştirme başlayınca/bitince (varlık kartı vurgusu). */
  yerlestirmeDegisince(f: () => void): () => void;
  /** Varlık kartı tuvale sürüklenirken (tuval pikseli) ve bırakılınca. */
  disaridanSurukle(x: number, y: number): void;
  disaridanBirak(x: number, y: number): void;
  /** Seçilen nesnelerin dünya kutuları. */
  kutular(idler: readonly string[]): Map<string, K.Kutu>;
  hizala(eksen: 0 | 1 | 2, yer: K.HizaYeri): void;
  dagit(eksen: 0 | 1 | 2): void;
  /** Sahnedeki seçimi hazır yapı parçası olarak al (kaydetmek için). */
  parca(ad?: string): Parca | null;
  kancalar: ArayuzKancalari;
  /** Son imleç konumu (tuval pikseli; tuval dışındaysa son bilinen). */
  imlec(): { x: number; y: number } | null;
  yokEt(): void;
}

const TEKRARLI: ReadonlySet<Eylem> = new Set(["kaydirSol", "kaydirSag", "kaydirIleri", "kaydirGeri", "kaydirYukari", "kaydirAsagi", "solaDondur", "sagaDondur", "geriAl", "ileriAl"]);
const ARAC_EYLEMI: Partial<Record<Eylem, AracAdi>> = { aracSec: "sec", aracTasi: "tasi", aracDondur: "dondur", aracOlcek: "olcek", aracKutu: "kutu", aracFirca: "firca", aracArazi: "arazi", aracGunes: "gunes", aracOlcu: "olcu" };
const SURUKLEME_ESIGI = 4;

const yazilabilirMi = (h: EventTarget | null): boolean => {
  const e = h as HTMLElement | null;
  if (!e?.matches) return false;
  if (e.isContentEditable) return true;
  if (e.matches("textarea, select")) return true;
  return e.matches("input") && !e.matches("input[type=range], input[type=checkbox], input[type=radio], input[type=color], input[type=button]");
};

export function editorKur(a: EditorAyari): Editor {
  const { level, tuval } = a;
  const sahne = a.kamera.getScene();
  const durum = editorDurumuKur({ oku: () => level.tanim(), uygula: (t) => level.ayarla(t) }, a.ayarlar ?? AYAR_VARSAYILAN);
  const yuzey = yuzeyKur(sahne, a.kamera, level);
  const kamera = editorKamerasiKur(a.kamera, tuval, yuzey, (h) => durum.ayarDegistir((x) => ({ ...x, kameraHizi: h })));
  kamera.hizAyarla(durum.ayarlar().kameraHizi);
  const gizmo = gizmoKatmaniKur(sahne);
  const vurgu = vurguKur(sahne);
  const surukle = yuzeySuruklemeKur(yuzey);
  const yerlestirAsil = yerlestirmeKur(sahne, level, yuzey);
  const yerlestir: typeof yerlestirAsil = {
    ...yerlestirAsil,
    async basla(k) { const s = yerlestirAsil.basla(k); yerlestirmeYay(); await s; },
    bitir() { const vardi = yerlestirAsil.etkin(); yerlestirAsil.bitir(); if (vardi) yerlestirmeYay(); },
  };
  const izgara = izgaraKur(sahne);
  const firca = fircaImleciKur(sahne, yuzey);
  const cetvel = cetvelKur(sahne);
  const kancalar: ArayuzKancalari = {};
  const yerlestirmeDinleyicileri = new Set<() => void>();
  const yerlestirmeYay = () => { for (const f of yerlestirmeDinleyicileri) f(); };

  let ctrl = false, shift = false;
  let imlec: { x: number; y: number } | null = null;
  let imlecOynadi = false;
  let pano: Parca | null = null;
  /** Sürükleme (gizmo/yüzey) başlamadan önceki hâl: bırakınca tek geri al adımı buraya döner. */
  let onceki: ReturnType<EditorDurumu["hal"]> | null = null;
  let bas: { x: number; y: number; id: string | null; tur: "nesne" | "bos" | "yerlestir"; suruklendi: boolean; mod: SecimKipi } | null = null;
  let kutu: { x0: number; y0: number; x1: number; y1: number } | null = null;
  /** Fırça / güneş vuruşu sürüyor: başlangıç hâli (bırakınca tek geri al adımı). */
  let vurus: { tur: "firca" | "gunes" | "arazi"; once: ReturnType<EditorDurumu["hal"]>; silgi: boolean; x: number; saat: number; eklenen: number;
    hedefY: number; bolge: Bolge | null; nokta: Vec3 | null; son: number; damga: number;
    /** Arazi: vuruşun başladığı nokta ve oradaki arazi normali (eğime göre düzle, rampa). */
    bas?: Vec3; normal?: Vec3 } | null = null;
  let rng = rastgele(1);
  let imlecOynadiArazi = false;

  const tuvalNoktasi = (e: { clientX: number; clientY: number }) => { const r = tuval.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const dugumler = (idler: readonly string[]): Map<string, TransformNode> => {
    const m = new Map<string, TransformNode>();
    for (const id of idler) { const d = level.nesneler.dugum(id); if (d) m.set(id, d); }
    return m;
  };
  const nesneAlti = (x: number, y: number): string | null => {
    const p = sahne.pick(x, y, (m) => m.isPickable && m.isEnabled() && level.nesneler.idsi(m) !== null, false, a.kamera);
    const id = p?.hit ? level.nesneler.idsi(p.pickedMesh) : null;
    return id && secilebilir(durum.tanim(), id) ? id : null;
  };
  const ayarlar = () => durum.ayarlar();

  // ── görünüm eşitleme ──
  const vurguYenile = () => {
    vurgu.secili(durum.secim().map((id) => level.nesneler.meshleri(id) as AbstractMesh[]));
  };
  const gizmoYenile = () => {
    const ed = durum.kip() === "editor";
    gizmo.goster(ed);
    gizmo.ayarla({ arac: durum.arac(), uzay: ayarlar().uzay, yaslama: ayarlar().yaslama, ctrl });
    gizmo.bagla([...dugumler(durum.secim()).values()]);
  };
  const sahneyiYenile = () => { vurguYenile(); gizmoYenile(); };
  const abonelikler = [
    durum.abone("secim", sahneyiYenile),
    durum.abone("tanim", sahneyiYenile),
    durum.abone("arac", () => {
      gizmoYenile();
      firca.goster(["firca", "arazi"].includes(durum.arac()) && durum.kip() === "editor");
      if (durum.arac() !== "olcu") cetvel.temizle();
      const ipucu: Partial<Record<AracAdi, string>> = {
        firca: "fırça: sürükleyerek serpiştir · Shift basılı: sil · fırça varlıkları: tarayıcıda kartlara tıkla · ayarlar sağda",
        gunes: level.tanim().zaman ? "güneş: yatay sürükle → saat (zaman tanımlı)" : "güneş: gökyüzüne sürükle → güneş oraya",
        olcu: "ölç: iki noktaya tıkla · Esc temizler",
        arazi: "arazi: basılı tut / sürükle · Shift ters işlem · Ctrl+tekerlek yarıçap · ayarlar sağda (hedef: yükseklik, çim, kaya, dekor)",
      };
      const m = ipucu[durum.arac()];
      if (m) durum.bildir(m);
    }),
    durum.abone("ayarlar", () => { gizmoYenile(); kamera.hizAyarla(ayarlar().kameraHizi); }),
    durum.abone("kip", () => {
      const ed = durum.kip() === "editor";
      kamera.editorKipi(ed);
      vurgu.goster(ed);
      gizmoYenile();
      firca.goster(ed && ["firca", "arazi"].includes(durum.arac()));
      if (!ed) { yerlestir.bitir(); vurgu.ustunde(null); cetvel.temizle(); }
      else if (document.pointerLockElement === tuval) document.exitPointerLock();
    }),
    level.nesneler.yuklenince((id) => { if (durum.secim().includes(id)) vurguYenile(); }),
  ];
  kamera.editorKipi(true);
  kamera.pivotSaglayici(() => {
    const k = [...kutularHesapla(durum.secim()).values()];
    if (!k.length) return null;
    const min = k.reduce((m, b) => Vector3.Minimize(m, new Vector3(...b.min)), new Vector3(Infinity, Infinity, Infinity));
    const max = k.reduce((m, b) => Vector3.Maximize(m, new Vector3(...b.max)), new Vector3(-Infinity, -Infinity, -Infinity));
    const c = min.add(max).scale(0.5);
    return [c.x, c.y, c.z];
  });

  // ── dönüşüm okuma / yazma ──
  const dugumDonusumu = (d: TransformNode): K.Donusum => {
    const r = d.rotationQuaternion ? d.rotationQuaternion.toEulerAngles() : d.rotation;
    return {
      konum: [d.position.x, d.position.y, d.position.z],
      donus: [r.x * 180 / Math.PI, r.y * 180 / Math.PI, r.z * 180 / Math.PI],
      olcek: [d.scaling.x, d.scaling.y, d.scaling.z],
    };
  };
  const dugumleriYaz = (idler: readonly string[], mesaj: string) => {
    const harita = new Map<string, Partial<K.Donusum>>();
    for (const [id, d] of dugumler(idler)) harita.set(id, dugumDonusumu(d));
    const once = onceki ?? undefined;
    onceki = null;
    durum.degistir((t) => K.donusumleriYaz(t, harita).tanim, mesaj, once ? { onceki: once } : {});
  };
  /** Shift ile sürükleme: kopyalar geçmişsiz eklenir (önceki hâl saklı), tutulanlar oynar. */
  const kopyaBirak = () => {
    const idler = durum.secim();
    if (!idler.length) return;
    durum.onizle(K.nesneCogalt(durum.tanim(), idler).tanim);
  };

  gizmo.basinca(() => {
    onceki = durum.hal();
    if (shift) kopyaBirak();
  });
  gizmo.bitince(() => {
    const ad = { tasi: "taşındı", dondur: "döndürüldü", olcek: "ölçeklendi", kutu: "kutuyla değiştirildi" }[durum.arac() as "tasi"] ?? "değişti";
    dugumleriYaz(durum.secim(), `${durum.secim().length} nesne ${ad}`);
  });

  const kutularHesapla = (idler: readonly string[]): Map<string, K.Kutu> => {
    const m = new Map<string, K.Kutu>();
    for (const [id, d] of dugumler(idler)) {
      const s = d.getHierarchyBoundingVectors(true);
      if (!Number.isFinite(s.min.x)) { const p = d.getAbsolutePosition(); m.set(id, { min: [p.x, p.y, p.z], max: [p.x, p.y, p.z] }); continue; }
      m.set(id, { min: [s.min.x, s.min.y, s.min.z], max: [s.max.x, s.max.y, s.max.z] });
    }
    return m;
  };

  // ── yerleştirme ──
  const koy = () => {
    const k = yerlestir.koyulacak();
    if (!k) return;
    if (k.kaynak.tur === "varlik") {
      const ad = k.kaynak.ad;
      durum.degistir((t) => {
        const s = K.nesneEkle(t, [{ varlik: ad, konum: k.konum, donus: kisaDonus(k.donus), olcek: 1 }]);
        sonEklenen = s.idler;
        return s.tanim;
      }, `yerleştirildi: ${kisaAd(ad)}`, { secim: [] });
    } else {
      const p = k.kaynak.parca;
      durum.degistir((t) => { const s = parcaYerlestir(t, p, k.konum, { donusY: k.donus[1] }); sonEklenen = s.idler; return s.tanim; }, `yerleştirildi: ${k.kaynak.ad}`);
    }
  };
  let sonEklenen: string[] = [];

  // ── fırça / güneş / ölçü ──
  const fircaDamgasi = (n: Vec3, silgi: boolean) => {
    const f = ayarlar().firca;
    const t = durum.tanim();
    if (silgi) {
      const s = silgiDamgasi(t, { x: n[0], z: n[2] }, f.yaricap, f.varliklar);
      if (s.idler.length) { durum.onizle(s.tanim); if (vurus) vurus.eklenen -= s.idler.length; }
      return;
    }
    const dolu = (t.nesneler ?? []).map((m) => ({ x: m.konum[0], z: m.konum[2] }));
    const adaylar = damgaAdaylari({ x: n[0], z: n[2] }, f, dolu, rng);
    if (!adaylar.length) return;
    const s = adaylariEkle(t, adaylar, (x) => {
      const y = yuzey.altindaki(x.x, x.z, n[1] + 2);
      return { y, donus: f.normaleHizala ? normaleHizaliDonus(yuzey.araziNormali(x.x, x.z), x.yaw) : [0, x.yaw, 0] };
    });
    durum.onizle(s.tanim);
    if (vurus) vurus.eklenen += s.idler.length;
  };
  /** Arazi: vuruş boyunca her ~90 ms bir damga (fare dursa da basılı tuttukça işler — heykel fırçası). */
  const zeminAyariOf = (t: LevelTanimi): ZeminAyari | null => {
    const i = araziKatmani(t, "yukseklik");
    // Tanımdaki ayar zaten normalleştirilmiş; varsayılanla birleştirmek tipi doğrular (kaçışsız).
    return i < 0 ? null : ayarBirlestir("zemin", ZEMIN_VARSAYILAN, t.katmanlar[i]!.ayar);
  };
  const araziDamgasi = () => {
    if (!vurus || vurus.tur !== "arazi" || !vurus.nokta) return;
    const a = ayarlar().arazi, n = vurus.nokta;
    if (a.hedef === "yukseklik" && a.islem === "rampa") {
      // Rampa: her güncellemede vuruş BAŞINDAKİ tanıma A→imleç rampası (canlı önizleme; bırakınca kalır).
      const t0 = vurus.once.tanim, z0 = zeminAyariOf(t0), A = vurus.bas!;
      if (!z0 || Math.hypot(n[0] - A[0], n[2] - A[2]) < 0.5) return;
      durum.onizle(rampaKomutu(t0, a, { x: A[0], z: A[2], y: A[1] }, { x: n[0], z: n[2], y: n[1] }, zeminTabanYuksekligi(z0)));
      vurus.bolge = bolgeBirlesim({ x0: Math.min(A[0], n[0]) - a.yaricap, z0: Math.min(A[2], n[2]) - a.yaricap, x1: Math.max(A[0], n[0]) + a.yaricap, z1: Math.max(A[2], n[2]) + a.yaricap }, null);
      vurus.son = performance.now();
      vurus.damga = 1;
      return;
    }
    const t = durum.tanim();
    const z = zeminAyariOf(t);
    const taban = z ? zeminTabanYuksekligi(z) : () => 0;
    const nr = vurus.normal, b0 = vurus.bas;
    durum.onizle(araziDamgasiUygula(t, a, { x: n[0], z: n[2], yaricap: a.yaricap, guc: a.guc, sertlik: a.sertlik }, vurus.silgi, taban, {
      hedef: a.hedefHerDamga ? level.yukseklik(n[0], n[2]) : vurus.hedefY,
      ...(a.egimeGore && nr && b0 ? { egim: { x: b0[0], z: b0[2], y: b0[1], nx: nr[0], ny: nr[1], nz: nr[2] } } : {}),
      tohum: 1 + vurus.damga,
    }));
    vurus.bolge = bolgeBirlesim(vurus.bolge, { x0: n[0] - a.yaricap, z0: n[2] - a.yaricap, x1: n[0] + a.yaricap, z1: n[2] + a.yaricap });
    vurus.son = performance.now();
    vurus.damga++;
  };
  /** Güneş: zaman yoksa güneş imlecin gösterdiği yöne; zaman varsa yatay sürükleme saati değiştirir. */
  const gunesSurukle = (p: { x: number; y: number }) => {
    if (!vurus) return;
    const t = vurus.once.tanim;
    if (t.zaman) {
      const saat = (((vurus.saat + ((p.x - vurus.x) / Math.max(1, tuval.clientWidth)) * 12) % 24) + 24) % 24;
      durum.onizle({ ...durum.tanim(), zaman: { ...t.zaman, saat: Math.round(saat * 4) / 4 } });
      durum.bildir(`saat ${String(Math.floor(saat)).padStart(2, "0")}:${String(Math.round((saat % 1) * 60) % 60).padStart(2, "0")} (bırak: kaydet, Esc: iptal)`);
      return;
    }
    const d = yuzey.ekranIsini(p.x, p.y).direction;
    const yon: Vec3 = [d.x, Math.max(0.03, d.y), d.z];
    const x = durum.tanim();
    durum.onizle({ ...x, isik: { ...x.isik, gunes: { ...x.isik.gunes, yon: yon.map((v) => Math.round(v * 1000) / 1000) as Vec3 } } });
  };
  const vurusBitir = () => {
    if (!vurus) return;
    const v = vurus; vurus = null;
    firca.bitir();
    if (v.tur === "arazi") {
      const a = ayarlar().arazi;
      const once = zeminAyariOf(v.once.tanim);
      durum.degistir((t) => {
        const simdi = zeminAyariOf(t);
        // Tabanı eski arazide olan nesneler yeni araziye (havadakilere ve nesne üstündekilere dokunmaz).
        return a.hedef === "yukseklik" && a.nesneleriOturt && v.bolge && once && simdi
          ? nesneleriOturt(t, zeminYuksekligi(once), zeminYuksekligi(simdi), v.bolge) : t;
      }, `arazi: ${araziIslemAdi(a, v.silgi)} (${v.damga} damga)`, { onceki: v.once });
      return;
    }
    const mesaj = v.tur === "gunes" ? (v.once.tanim.zaman ? "saat değişti" : "güneş yönü değişti")
      : v.silgi ? `fırça: ${-v.eklenen} nesne silindi` : `fırça: ${v.eklenen} nesne serpiştirildi`;
    durum.degistir((t) => t, mesaj, { onceki: v.once });
  };

  // ── işaretçi ──
  const asagi = (e: PointerEvent) => {
    if (durum.kip() !== "editor") { if (e.button === 0) void tuval.requestPointerLock?.(); return; }
    if (kamera.isaretciBasladi(e)) { vurgu.ustunde(null); return; }
    if (e.button !== 0) return;
    if (gizmo.ustunde()) return;
    const p = tuvalNoktasi(e);
    const mod: SecimKipi = e.shiftKey ? "ekle" : e.ctrlKey || e.metaKey ? "tersle" : "yeni";
    if (yerlestir.etkin()) { bas = { ...p, id: null, tur: "yerlestir", suruklendi: false, mod }; return; }
    const arac = durum.arac();
    if (arac === "firca") {
      const f = ayarlar().firca;
      if (!f.varliklar.length && !e.shiftKey) { durum.bildir("fırça boş: varlık tarayıcısında kartlara tıklayarak fırçaya varlık ekle", true); return; }
      vurus = { tur: "firca", once: durum.hal(), silgi: e.shiftKey, x: p.x, saat: 0, eklenen: 0, hedefY: 0, bolge: null, nokta: null, son: 0, damga: 0 };
      rng = rastgele((Date.now() % 1e9) | 0);
      firca.basla();
      const n = firca.imlec(p.x, p.y, f.yaricap, e.shiftKey);
      if (n && firca.damgaZamani(n, f.yaricap)) fircaDamgasi(n, e.shiftKey);
      tuval.setPointerCapture?.(e.pointerId);
      return;
    }
    if (arac === "gunes") {
      vurus = { tur: "gunes", once: durum.hal(), silgi: false, x: p.x, saat: level.dunya.saat, eklenen: 0, hedefY: 0, bolge: null, nokta: null, son: 0, damga: 0 };
      gunesSurukle(p);
      tuval.setPointerCapture?.(e.pointerId);
      return;
    }
    if (arac === "arazi") {
      const a = ayarlar().arazi;
      if (araziKatmani(durum.tanim(), a.hedef) < 0) { durum.bildir(`arazi: açık "${a.hedef === "yukseklik" ? "zemin" : a.hedef}" katmanı yok`, true); return; }
      const n = firca.imlec(p.x, p.y, a.yaricap, e.shiftKey, true);
      if (!n) return;
      const y0 = level.yukseklik(n[0], n[2]);
      vurus = { tur: "arazi", once: durum.hal(), silgi: e.shiftKey, x: p.x, saat: 0, eklenen: 0, hedefY: y0, bolge: null, nokta: n, son: 0, damga: 0,
        bas: [n[0], y0, n[2]], normal: yuzey.araziNormali(n[0], n[2]) };
      araziDamgasi();
      tuval.setPointerCapture?.(e.pointerId);
      return;
    }
    if (arac === "olcu") {
      const h = yuzey.ekrandan(p.x, p.y);
      if (!h) return;
      const o = cetvel.tikla(h.nokta);
      durum.bildir(o ? olcumMetni(o) : "ölçü: ikinci noktaya tıkla");
      return;
    }
    const id = nesneAlti(p.x, p.y);
    bas = { ...p, id, tur: id ? "nesne" : "bos", suruklendi: false, mod };
    tuval.setPointerCapture?.(e.pointerId);
  };
  const hareket = (e: PointerEvent) => {
    const p = tuvalNoktasi(e);
    imlec = p; imlecOynadi = true;
    ctrl = e.ctrlKey || e.metaKey;
    if (durum.kip() !== "editor") return;
    if (yerlestir.etkin() && !kamera.bakiyor()) yerlestir.tasi(p.x, p.y, ayarlar().yaslama, ctrl);
    if (durum.arac() === "firca" && !kamera.bakiyor()) {
      const f = ayarlar().firca;
      const n = firca.imlec(p.x, p.y, f.yaricap, vurus ? vurus.silgi : e.shiftKey);
      if (vurus?.tur === "firca" && n && (e.buttons & 1) && firca.damgaZamani(n, f.yaricap)) fircaDamgasi(n, vurus.silgi);
      return;
    }
    if (vurus?.tur === "gunes" && (e.buttons & 1)) { gunesSurukle(p); return; }
    if (durum.arac() === "arazi" && !kamera.bakiyor()) {
      const n = firca.imlec(p.x, p.y, ayarlar().arazi.yaricap, vurus ? vurus.silgi : e.shiftKey, true);
      if (vurus?.tur === "arazi" && n) { vurus.nokta = n; imlecOynadiArazi = true; }
      return;
    }
    if (durum.arac() === "olcu" && !kamera.bakiyor()) {
      const h = yuzey.ekrandan(p.x, p.y);
      const o = cetvel.imlec(h ? h.nokta : null);
      if (o) durum.bildir(olcumMetni(o));
      return;
    }
    if (!bas || !(e.buttons & 1)) return;
    if (!bas.suruklendi && Math.hypot(p.x - bas.x, p.y - bas.y) > SURUKLEME_ESIGI) {
      bas.suruklendi = true;
      if (bas.tur === "nesne" && bas.id && bas.mod !== "tersle") {
        if (!durum.secim().includes(bas.id)) durum.secimAyarla(bas.mod === "ekle" ? [...durum.secim(), bas.id] : [bas.id]);
        onceki = durum.hal();
        if (e.shiftKey) kopyaBirak();
        surukle.basla(dugumler(durum.secim()), bas.id);
        vurgu.ustunde(null);
      } else if (bas.tur !== "yerlestir") {
        kutu = { x0: bas.x, y0: bas.y, x1: p.x, y1: p.y };
      }
    }
    if (surukle.surukleniyor()) surukle.tasi(p.x, p.y, ayarlar().yaslama, ctrl);
    else if (kutu) { kutu.x1 = p.x; kutu.y1 = p.y; kancalar.secimKutusu?.(kutu); }
  };
  const yukari = (e: PointerEvent) => {
    if (e.button === 0 && vurus) { tuval.releasePointerCapture?.(e.pointerId); vurusBitir(); return; }
    if (e.button !== 0 || !bas) return;
    const b = bas; bas = null;
    tuval.releasePointerCapture?.(e.pointerId);
    if (surukle.surukleniyor()) {
      const idler = surukle.bitir();
      if (idler.length) dugumleriYaz(idler, `${idler.length} nesne yüzeyde taşındı`);
      else { if (onceki) durum.onizle(onceki.tanim); onceki = null; }
      return;
    }
    if (kutu) {
      const k = kutu; kutu = null; kancalar.secimKutusu?.(null);
      durum.secimAyarla(secimUygula(durum.secim(), kutudakiler(ekranNoktalari(), k), b.mod));
      return;
    }
    if (b.suruklendi) return;
    if (b.tur === "yerlestir") { koy(); return; }
    durum.secimAyarla(secimUygula(durum.secim(), b.id, b.mod));
  };
  const ciftTik = (e: MouseEvent) => {
    if (durum.kip() !== "editor" || e.button !== 0) return;
    const p = tuvalNoktasi(e);
    const id = nesneAlti(p.x, p.y);
    if (id) odakla([id]);
  };
  /** Sürükleme ya da yerleştirme sürerken tekerlek döndürür (kameranın yaklaşmasından önce yakalanır). */
  const tekerlek = (e: WheelEvent) => {
    if (durum.kip() !== "editor" || kamera.bakiyor()) return;
    const adim = (e.shiftKey ? 90 : ayarlar().yaslama.aci ? ayarlar().yaslama.aciAdim : 15) * Math.sign(e.deltaY || e.deltaX);
    if (surukle.surukleniyor()) surukle.dondur(adim);
    else if (yerlestir.etkin()) yerlestir.dondur(adim);
    else if (durum.arac() === "arazi" && (e.ctrlKey || e.metaKey)) {
      durum.ayarDegistir((a) => ({ ...a, arazi: { ...a.arazi, yaricap: Math.max(0.5, Math.min(80, Math.round(a.arazi.yaricap * (e.deltaY < 0 ? 1.15 : 1 / 1.15) * 10) / 10)) } }));
      if (imlec) firca.imlec(imlec.x, imlec.y, ayarlar().arazi.yaricap, false);
      durum.bildir(`arazi yarıçapı ${ayarlar().arazi.yaricap} m`);
    }
    else if (durum.arac() === "firca" && (e.ctrlKey || e.metaKey)) {
      // Ctrl+tekerlek: fırça yarıçapı (tekerlek tek başına yine kamerayı yaklaştırır).
      durum.ayarDegistir((a) => ({ ...a, firca: { ...a.firca, yaricap: Math.max(0.5, Math.min(60, Math.round(a.firca.yaricap * (e.deltaY < 0 ? 1.15 : 1 / 1.15) * 10) / 10)) } }));
      if (imlec) firca.imlec(imlec.x, imlec.y, ayarlar().firca.yaricap, false);
      durum.bildir(`fırça yarıçapı ${ayarlar().firca.yaricap} m`);
    }
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const sagTikMenusu = (e: MouseEvent) => { if (durum.kip() === "editor") e.preventDefault(); };
  tuval.addEventListener("pointerdown", asagi);
  tuval.addEventListener("pointermove", hareket);
  tuval.addEventListener("pointerup", yukari);
  tuval.addEventListener("dblclick", ciftTik);
  tuval.addEventListener("wheel", tekerlek, { capture: true, passive: false });
  tuval.addEventListener("contextmenu", sagTikMenusu);

  /** Kutu seçimi için yüklü nesnelerin ekran konumu (kutu ortası; kamera arkasındakiler yok). */
  const ekranNoktalari = (): Map<string, [number, number]> => {
    const m = new Map<string, [number, number]>();
    const g = sahne.getTransformMatrix(), w = tuval.clientWidth, h = tuval.clientHeight;
    const vp = a.kamera.viewport.toGlobal(w, h);
    for (const id of hepsiniSec(durum.tanim())) {
      const k = kutularHesapla([id]).get(id);
      if (!k) continue;
      const c = new Vector3((k.min[0] + k.max[0]) / 2, (k.min[1] + k.max[1]) / 2, (k.min[2] + k.max[2]) / 2);
      const p = Vector3.Project(c, Matrix.IdentityReadOnly, g, vp);
      if (p.z > 0 && p.z < 1) m.set(id, [p.x, p.y]);
    }
    return m;
  };

  // ── eylemler ──
  const odakla = (idler: readonly string[]) => {
    const k = [...kutularHesapla(idler.length ? idler : hepsiniSec(durum.tanim())).values()];
    if (!k.length) { durum.bildir("odaklanacak nesne yok"); return; }
    const min: Vec3 = [Math.min(...k.map((b) => b.min[0])), Math.min(...k.map((b) => b.min[1])), Math.min(...k.map((b) => b.min[2]))];
    const max: Vec3 = [Math.max(...k.map((b) => b.max[0])), Math.max(...k.map((b) => b.max[1])), Math.max(...k.map((b) => b.max[2]))];
    kamera.odakla(min, max);
  };
  const kameraEksenleri = () => {
    const f = a.kamera.getDirection(Vector3.Forward());
    const ileri: Vec3 = Math.abs(f.x) > Math.abs(f.z) ? [Math.sign(f.x), 0, 0] : [0, 0, Math.sign(f.z) || 1];
    const sag: Vec3 = [ileri[2], 0, -ileri[0]];
    return { ileri, sag };
  };
  const kaydirma = (yon: Vec3, dikey = false) => {
    const y = ayarlar().yaslama;
    const adim = dikey ? (y.konum ? y.yAdim : 0.1) : y.konum ? y.konumAdim : 0.1;
    const s = durum.secim();
    if (!s.length) return;
    durum.degistir((t) => K.kaydir(t, s, [yon[0] * adim, yon[1] * adim, yon[2] * adim]).tanim, "kaydırıldı", { anahtar: "kaydir" });
  };
  const seciliyle = (f: (ids: readonly string[]) => void, bosMesaj = "önce bir nesne seç") => {
    const s = durum.secim();
    if (!s.length) { durum.bildir(bosMesaj); return; }
    f(s);
  };
  const kopyala = (): boolean => {
    const p = parcaAl(durum.tanim(), durum.secim());
    if (!p) { durum.bildir("kopyalanacak seçim yok"); return false; }
    pano = p;
    void navigator.clipboard?.writeText(parcaMetni(p)).catch(() => undefined);
    durum.bildir(`${p.nesneler.length} nesne kopyalandı`);
    return true;
  };
  const yapistir = async () => {
    let p = pano;
    try { const m = await navigator.clipboard?.readText(); if (m) p = parcaOku(m); } catch { /* izin yok ya da parça değil: iç pano */ }
    if (!p) { durum.bildir("panoda nesne yok"); return; }
    const h = imlec ? yuzey.ekrandan(imlec.x, imlec.y) : null;
    const hedef: Vec3 = h ? h.nokta : (() => { const c = a.kamera.position.add(a.kamera.getDirection(Vector3.Forward()).scale(10)); return [c.x, level.yukseklik(c.x, c.z), c.z] as Vec3; })();
    const parca = p;
    durum.degistir((t) => { const s = parcaYerlestir(t, parca, hedef); sonEklenen = s.idler; return s.tanim; }, `${parca.nesneler.length} nesne yapıştırıldı`);
    durum.secimAyarla(sonEklenen);
  };

  const eylem = (e: Eylem, s: { yuva?: number; shift?: boolean } = {}) => {
    const arac = ARAC_EYLEMI[e];
    if (arac) { durum.aracSec(arac); return; }
    switch (e) {
      case "geriAl": durum.geriAl(); return;
      case "ileriAl": durum.ileriAl(); return;
      case "cogalt": return seciliyle((ids) => {
        const { sag } = kameraEksenleri(), adim = ayarlar().yaslama.konumAdim || 1;
        durum.degistir((t) => { const r = K.nesneCogalt(t, ids, [sag[0] * adim, 0, sag[2] * adim]); sonEklenen = r.idler; return r.tanim; }, `${ids.length} nesne çoğaltıldı`);
        durum.secimAyarla(sonEklenen);
      });
      case "kopyala": kopyala(); return;
      case "kes": if (kopyala()) { const ids = durum.secim(); durum.degistir((t) => K.nesneSil(t, ids).tanim, `${ids.length} nesne kesildi`); } return;
      case "yapistir": void yapistir(); return;
      case "sil": return seciliyle((ids) => { durum.degistir((t) => K.nesneSil(t, ids).tanim, `${ids.length} nesne silindi`); });
      case "hepsiniSec": durum.secimAyarla(hepsiniSec(durum.tanim())); return;
      case "secimiBirak":
        if (vurus) { const v = vurus; vurus = null; firca.bitir(); durum.onizle(v.once.tanim); durum.bildir("iptal"); return; }
        if (durum.arac() === "olcu") { cetvel.temizle(); durum.bildir("ölçü temizlendi"); }
        if (surukle.surukleniyor()) { surukle.iptal(); if (onceki) durum.onizle(onceki.tanim); onceki = null; bas = null; durum.bildir("sürükleme iptal"); return; }
        if (gizmo.iptal()) { if (onceki) durum.onizle(onceki.tanim); onceki = null; durum.bildir("dönüşüm iptal"); return; }
        if (kutu) { kutu = null; bas = null; kancalar.secimKutusu?.(null); return; }
        if (yerlestir.etkin()) { yerlestir.bitir(); durum.bildir("yerleştirme bitti"); return; }
        durum.secimAyarla([]);
        return;
      case "grupla": return seciliyle((ids) => { durum.degistir((t) => K.grupla(t, ids, `grup ${(t.gruplar?.length ?? 0) + 1}`).tanim, `${ids.length} nesne gruplandı`); });
      case "grubuCoz": return seciliyle((ids) => {
        const t = durum.tanim(), gruplar = new Set(ids.map((id) => t.nesneler?.find((n) => n.id === id)?.grup).filter((g): g is string => !!g));
        if (!gruplar.size) { durum.bildir("seçim bir grupta değil"); return; }
        durum.degistir((x) => [...gruplar].reduce((y, g) => K.grubuCoz(y, g), x), `${gruplar.size} grup çözüldü`);
      });
      case "gizle": return seciliyle((ids) => { durum.degistir((t) => K.bayrakAyarla(t, ids, "gizli", true).tanim, `${ids.length} nesne gizlendi (Alt+H hepsini gösterir)`); });
      case "hepsiniGoster": durum.degistir((t) => K.hepsiniGoster(t), "hepsi görünür"); return;
      case "kilitle": return seciliyle((ids) => { durum.degistir((t) => K.bayrakAyarla(t, ids, "kilitli", true).tanim, `${ids.length} nesne kilitlendi (sahne ağacından açılır)`); });
      case "zemineIndir": return seciliyle((ids) => {
        durum.degistir((t) => K.zemineIndir(t, ids, (x, z, id) => {
          const n = t.nesneler?.find((m) => m.id === id);
          return yuzey.altindaki(x, z, n ? n.konum[1] : 1e4, new Set([id]));
        }).tanim, `${ids.length} nesne indirildi`);
      });
      case "uzayDegistir": durum.ayarDegistir((x) => ({ ...x, uzay: x.uzay === "dunya" ? "yerel" : "dunya" })); durum.bildir(`gizmo ekseni: ${ayarlar().uzay === "dunya" ? "dünya" : "yerel"}`); return;
      case "yaslamaAcKapa": durum.ayarDegistir((x) => ({ ...x, yaslama: { ...x.yaslama, konum: !x.yaslama.konum } })); durum.bildir(`ızgara yaslaması ${ayarlar().yaslama.konum ? "açık" : "kapalı"}`); return;
      case "izgara": durum.ayarDegistir((x) => ({ ...x, izgara: !x.izgara })); return;
      case "odakla": odakla(durum.secim()); return;
      case "solaDondur": case "sagaDondur": return seciliyle((ids) => {
        const d = (s.shift ? 90 : 15) * (e === "solaDondur" ? -1 : 1);
        durum.degistir((t) => K.yDondur(t, ids, d).tanim, "döndürüldü", { anahtar: "dondur" });
      });
      case "kaydirSol": case "kaydirSag": case "kaydirIleri": case "kaydirGeri": {
        const { ileri, sag } = kameraEksenleri();
        const yon = e === "kaydirIleri" ? ileri : e === "kaydirGeri" ? ileri.map((v) => -v) as Vec3 : e === "kaydirSag" ? sag : sag.map((v) => -v) as Vec3;
        kaydirma(yon); return;
      }
      case "kaydirYukari": kaydirma([0, 1, 0], true); return;
      case "kaydirAsagi": kaydirma([0, -1, 0], true); return;
      case "yerImiKaydet": {
        const yuva = s.yuva ?? 1, p = a.kamera.position, h = p.add(a.kamera.getDirection(Vector3.Forward()).scale(10));
        durum.degistir((t) => K.yerImiYaz(t, yuva, { konum: [p.x, p.y, p.z], hedef: [h.x, h.y, h.z] }, level.yukseklik(p.x, p.z)), `kamera yer imi ${yuva} kaydedildi`);
        return;
      }
      case "yerImineGit": {
        const y = K.yerImi(durum.tanim(), s.yuva ?? 1);
        if (!y) { durum.bildir(`yer imi ${s.yuva} yok — Ctrl+Shift+${s.yuva} ile kaydet`); return; }
        const m = K.yerImiMutlak(y, level.yukseklik);
        kamera.git(m.konum, m.hedef); durum.bildir(`yer imi ${s.yuva}: ${y.ad}`); return;
      }
      case "kaydet":
        a.kaydet(durum.tanim()).then((yol) => { durum.kaydedildi(); durum.bildir(`kaydedildi → ${yol}`); })
          .catch((err: unknown) => durum.bildir(`kaydedilemedi: ${err instanceof Error ? err.message : String(err)}`, true));
        return;
      case "varlikAra": kancalar.varlikAra?.(); return;
      case "kipDegistir": durum.kipAyarla(durum.kip() === "editor" ? "ucus" : "editor"); return;
      case "yardim": kancalar.yardim?.(); return;
      case "stilSonraki": case "renkSonraki": {
        const t = durum.tanim();
        const sonraki = (l: readonly string[], x: string) => l[(l.indexOf(x) + 1) % l.length]!;
        if (e === "stilSonraki") { const ad = sonraki(ONAYAR_ADLARI, onayarAdi(t)); durum.degistir((x) => onayarUygula(x, ad), `stil: ${ad}`); }
        else { const ad = sonraki(PALET_DUZENI_ADLARI, paletDuzeniAdi(t)); durum.degistir((x) => paletDuzeniUygula(x, ad), `renk düzeni: ${ad}`); }
        return;
      }
      case "sonrasiAtla": level.stil.sonrasiAtla(true); return;
      case "inspektor": void a.inspektor?.(); return;
      case "orionGozu": kancalar.orionGozu?.(); return;
      default: return;
    }
  };

  // ── klavye ──
  const tusBas = (e: KeyboardEvent) => {
    if (e.key === "Control" || e.key === "Meta") { ctrl = true; gizmoYenile(); }
    if (e.key === "Shift") shift = true;
    if (kamera.bakiyor()) return;
    const k = eslesen(KISAYOLLAR, e, durum.kip(), yazilabilirMi(e.target));
    if (!k) return;
    e.preventDefault();
    if (e.repeat && !TEKRARLI.has(k.eylem)) return;
    eylem(k.eylem, { ...(k.yuva !== undefined ? { yuva: k.yuva } : {}), shift: e.shiftKey });
  };
  const tusBirak = (e: KeyboardEvent) => {
    if (e.key === "Control" || e.key === "Meta") { ctrl = false; gizmoYenile(); }
    if (e.key === "Shift") shift = false;
    if (e.code === "KeyB") level.stil.sonrasiAtla(false);
  };
  addEventListener("keydown", tusBas);
  addEventListener("keyup", tusBirak);

  // ── her kare ──
  const kareGozcu = sahne.onBeforeRenderObservable.add(() => {
    const dt = sahne.getEngine().getDeltaTime() / 1000;
    kamera.guncelle(dt);
    // Rampa yalnız imleç oynadıkça (önizleme), diğerleri basılı tutuldukça ~90 ms'de bir damga (Unreal "Apply Without Moving").
    if (vurus?.tur === "arazi" && performance.now() - vurus.son > 90) {
      const a = ayarlar().arazi, rampa = a.hedef === "yukseklik" && a.islem === "rampa";
      if (!rampa || imlecOynadiArazi) { araziDamgasi(); imlecOynadiArazi = false; }
    }
    const ed = durum.kip() === "editor";
    // Üstünde durma vurgusu: karede en çok bir seçim ışını.
    const secmeAraci = !["firca", "gunes", "olcu", "arazi"].includes(durum.arac());
    if (ed && secmeAraci && imlecOynadi && imlec && !bas && !yerlestir.etkin() && !kamera.bakiyor() && !gizmo.surukleniyor()) {
      imlecOynadi = false;
      const id = gizmo.ustunde() ? null : nesneAlti(imlec.x, imlec.y);
      vurgu.ustunde(id && !durum.secim().includes(id) ? level.nesneler.meshleri(id) : null);
    }
    // Izgara: yalnız üzerinde çalışılan bir şey varken (yerleştirme hayaleti, sürüklenen ya da seçili nesne), onun tabanında.
    const etkinDugum = durum.secim().length ? level.nesneler.dugum(durum.secim()[durum.secim().length - 1]!) : null;
    const hayaletYeri = yerlestir.koyulacak()?.konum ?? null;
    const iz = ed && ayarlar().izgara && (!!hayaletYeri || !!etkinDugum);
    izgara.goster(iz);
    if (iz) {
      const p = hayaletYeri ?? [etkinDugum!.position.x, etkinDugum!.position.y, etkinDugum!.position.z];
      izgara.konumla(p[0], p[1], p[2], etkin(ayarlar().yaslama.konum, ctrl) ? ayarlar().yaslama.konumAdim : 1);
    }
  });

  return {
    durum, level, sahne, tuval, yuzey, kamera, kancalar,
    katalog: () => level.nesneler.katalog(),
    anlamlar: () => level.nesneler.anlamlar(),
    eylem,
    yerlestirmeyeBasla(k) {
      durum.secimAyarla([]);
      void yerlestir.basla(k).then(() => { if (imlec) yerlestir.tasi(imlec.x, imlec.y, ayarlar().yaslama, ctrl); });
      durum.bildir(`${k.ad}: tıkla koy · tekerlek döndür (Shift 90°) · Esc bitir`);
    },
    yerlestirmeyiBitir: () => yerlestir.bitir(),
    yerlestiriliyor: () => yerlestir.kaynak(),
    yerlestirmeDegisince(f) { yerlestirmeDinleyicileri.add(f); return () => { yerlestirmeDinleyicileri.delete(f); }; },
    disaridanSurukle(x, y) { imlec = { x, y }; if (yerlestir.etkin()) yerlestir.tasi(x, y, ayarlar().yaslama, ctrl); },
    disaridanBirak(x, y) {
      if (!yerlestir.etkin()) return;
      yerlestir.tasi(x, y, ayarlar().yaslama, ctrl);
      koy();
      yerlestir.bitir();
      durum.secimAyarla(sonEklenen);
    },
    kutular: kutularHesapla,
    hizala(eksen, yer) { seciliyle((ids) => { const k = kutularHesapla(ids); durum.degistir((t) => K.hizala(t, ids, eksen, yer, k).tanim, `${ids.length} nesne hizalandı`); }, "hizalamak için en az iki nesne seç"); },
    dagit(eksen) { seciliyle((ids) => { const k = kutularHesapla(ids); durum.degistir((t) => K.dagit(t, ids, eksen, k).tanim, `${ids.length} nesne dağıtıldı`); }, "dağıtmak için en az üç nesne seç"); },
    parca: (ad) => parcaAl(durum.tanim(), durum.secim(), ad),
    imlec: () => imlec,
    yokEt() {
      for (const f of abonelikler) f();
      sahne.onBeforeRenderObservable.remove(kareGozcu);
      tuval.removeEventListener("pointerdown", asagi);
      tuval.removeEventListener("pointermove", hareket);
      tuval.removeEventListener("pointerup", yukari);
      tuval.removeEventListener("dblclick", ciftTik);
      tuval.removeEventListener("wheel", tekerlek, { capture: true });
      tuval.removeEventListener("contextmenu", sagTikMenusu);
      removeEventListener("keydown", tusBas);
      removeEventListener("keyup", tusBirak);
      yerlestir.bitir(); gizmo.yokEt(); vurgu.yokEt(); izgara.yokEt(); kamera.yokEt(); firca.yokEt(); cetvel.yokEt();
    },
  };
}
