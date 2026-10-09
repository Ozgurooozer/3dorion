// world/level/editor/varlikTarayici.ts — Asset tarayıcısı: katalogdan varlık seç, sahneye yerleştir, seç/döndür/sil.
//
// Altta bir şerit: kategori çipleri, arama, ızgara adımı, önizleme kartları. Karta tıkla → YERLEŞTİRME kipi:
// varlığın yarı saydam önizlemesi fareyi zeminde izler; sol tık koyar (kip sürer, art arda konur), Q/E 15°
// döndürür (Shift ile 90°), sağ tık ya da Esc bırakır. Kip yokken sahnedeki bir nesneye tıkla → SEÇİLİR:
// Q/E döndürür, Del siler, Esc bırakır. Her değişiklik level tanımına (`nesneler`) gider — panelin geri alma
// geçmişinden ve Kaydet'ten geçer (sayfa `degistir`i panele bağlar).
//
// Kamera: sürükleyince bakış döner (UniversalCamera); tıklama ile sürükleme 5 px eşiğiyle ayrılır. Tarayıcı
// açıkken sayfa fare kilidi istemez (`acikMi`).
"use strict";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
// Işın seçimi (createPickingRay, pick) yan etki importu ister — yoksa "Ray needs to be imported" (denemede yakalandı).
import "@babylonjs/core/Culling/ray";
import type { Level } from "../cekirdek/levelKur.ts";
import type { LevelTanimi, NesneYeri } from "../cekirdek/levelTanimi.ts";
import { donusVec, kisaDonus } from "../cekirdek/donusum.ts";
import { yeniId } from "../cekirdek/kimlik.ts";
import { KATEGORI_ADLARI, kisaAd, yasla, type Katalog, type Varlik } from "../cekirdek/katalog.ts";
import { varlik } from "../../varlik.ts";

export interface TarayiciAyari {
  level: Level;
  kamera: Camera;
  tuval: HTMLCanvasElement;
  /** Tanımı değiştirir (geri alma + kirli işareti panelden). */
  degistir(yeni: (t: LevelTanimi) => LevelTanimi, mesaj: string): void;
}

const STIL = `
#vt { position: fixed; left: 348px; right: 8px; bottom: 26px; height: 228px; background: #11141bee; color: #dde5f2;
  border-radius: 10px; font: 12px system-ui, sans-serif; display: flex; flex-direction: column; z-index: 6; }
#vt.gizli { display: none; }
#vt .ust { display: flex; gap: 6px; align-items: center; padding: 8px 10px 4px; flex-wrap: wrap; }
#vt .ust b { margin-right: 4px; }
#vt button { background: #232a38; color: #dde5f2; border: 1px solid #2f3848; border-radius: 6px; padding: 3px 8px; font: inherit; cursor: pointer; }
#vt button.secili { background: #3b6fd8; border-color: #8fb4ff; color: #fff; }
#vt input, #vt select { background: #0b101a; color: #dde5f2; border: 1px solid #2f3848; border-radius: 6px; padding: 3px 6px; font: inherit; }
#vt .durum { color: #8a97ad; padding: 0 10px 4px; }
#vt .izgara { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; padding: 4px 10px 10px; }
#vt .kart { background: #1a1f2a; border: 1px solid #2a3140; border-radius: 8px; padding: 4px; cursor: pointer; text-align: center; }
#vt .kart:hover { border-color: #8fb4ff; }
#vt .kart.secili { border-color: #3b6fd8; background: #1d2a44; }
#vt .kart img { width: 72px; height: 72px; object-fit: contain; display: block; margin: 0 auto; }
#vt .kart span { display: block; font-size: 10px; color: #b7c2d6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#vt .kart i { display: block; font-size: 10px; color: #6f7c93; font-style: normal; }
`;


export function varlikTarayiciKur(a: TarayiciAyari): { acikMi(): boolean; acKapa(): void } {
  if (!document.getElementById("vtStil")) { const s = document.createElement("style"); s.id = "vtStil"; s.textContent = STIL; document.head.append(s); }
  const el = <K extends keyof HTMLElementTagNameMap>(e: K, sinif = "", metin = "") => {
    const x = document.createElement(e); if (sinif) x.className = sinif; if (metin) x.textContent = metin; return x;
  };
  const { level, kamera, tuval } = a;
  const sahne = kamera.getScene();
  const kok = el("div", "gizli"); kok.id = "vt"; document.body.append(kok);
  const ust = el("div", "ust"), durum = el("div", "durum", "katalog yükleniyor…"), izgara = el("div", "izgara");
  kok.append(ust, durum, izgara);

  let katalog: Katalog | null = null;
  let kategori = "", arama = "", adim = 0;
  let secilenVarlik: Varlik | null = null;   // yerleştirme kipi
  let hayalet: TransformNode | null = null;
  let hayaletNesil = 0;
  let donus = 0;
  let secilenNesne: string | null = null;     // seçme kipi (yerleşim kimliği)
  const durumYaz = (m: string) => { durum.textContent = m; };

  // ── üst şerit ──
  const kategoriKap = el("span");
  const araKutu = el("input"); araKutu.placeholder = "Ara…"; araKutu.oninput = () => { arama = araKutu.value.trim().toLowerCase(); ciz(); };
  const adimSec = el("select");
  for (const [d, ad] of [[0, "ızgara yok"], [1, "ızgara 1 m"], [2, "ızgara 2 m"], [4, "ızgara 4 m"], [8, "ızgara 8 m"]] as const) adimSec.add(new Option(ad, String(d)));
  adimSec.onchange = () => { adim = Number(adimSec.value); };
  ust.append(el("b", "", "Varlıklar"), kategoriKap, araKutu, adimSec);

  const ciz = () => {
    if (!katalog) return;
    kategoriKap.replaceChildren();
    const sayilar = new Map<string, number>();
    for (const v of katalog.varliklar) sayilar.set(v.kategori, (sayilar.get(v.kategori) ?? 0) + 1);
    for (const [k, ad] of [["", `tümü (${katalog.varliklar.length})`], ...[...sayilar].map(([k, n]) => [k, `${KATEGORI_ADLARI[k] ?? k} (${n})`])] as [string, string][]) {
      const d = el("button", k === kategori ? "secili" : "", ad);
      d.onclick = () => { kategori = k; ciz(); };
      kategoriKap.append(d);
    }
    izgara.replaceChildren(...katalog.varliklar
      .filter((v) => (!kategori || v.kategori === kategori) && (!arama || v.ad.toLowerCase().includes(arama)))
      .map((v) => {
        const k = el("div", `kart${secilenVarlik?.ad === v.ad ? " secili" : ""}`);
        k.title = `${v.ad}\n${v.boyut.map((x) => x.toFixed(1)).join(" × ")} m · ${v.ucgen} üçgen`;
        const r = el("img"); r.src = varlik(v.onizleme); r.alt = ""; r.loading = "lazy";
        k.append(r, el("span", "", kisaAd(v.ad)), el("i", "", `${v.boyut[0].toFixed(0)}×${v.boyut[2].toFixed(0)}×${v.boyut[1].toFixed(0)} m`));
        k.onclick = () => { void yerlestirmeyeBasla(v); };
        return k;
      }));
  };

  // ── yerleştirme ──
  const hayaletiBirak = () => { hayaletNesil++; hayalet?.dispose(false, false); hayalet = null; };
  const yerlestirmeyiBitir = () => { secilenVarlik = null; hayaletiBirak(); ciz(); durumYaz("Bir varlığa tıkla → zemine yerleştir. Sahnedeki nesneye tıkla → seç."); };
  const yerlestirmeyeBasla = async (v: Varlik) => {
    seciliBirak();
    hayaletiBirak();
    secilenVarlik = v;
    ciz();
    durumYaz(`${kisaAd(v.ad)} — sol tık koy · Q/E döndür (Shift 90°) · sağ tık / Esc bırak`);
    const benim = ++hayaletNesil;
    try {
      const h = await level.nesneler.ornekOlustur(v.ad);
      if (benim !== hayaletNesil) { h.dispose(false, false); return; }
      for (const m of h.getChildMeshes(false)) m.visibility = 0.55;
      hayalet = h;
      hayaletiTasi();
    } catch (err) { durumYaz(`yüklenemedi: ${err instanceof Error ? err.message : err}`); }
  };

  /** Fare ışını ile zemin kesişimi (zemin yüksekliğine birkaç adımda yakınsar). */
  const zemindeNokta = (): [number, number, number] | null => {
    const isin = sahne.createPickingRay(sahne.pointerX, sahne.pointerY, Matrix.Identity(), kamera);
    const o = isin.origin, d = isin.direction;
    if (d.y > -1e-4) return null;
    let x = o.x, z = o.z, y = 0;
    for (let i = 0; i < 4; i++) { y = level.yukseklik(x, z); const t = (y - o.y) / d.y; x = o.x + d.x * t; z = o.z + d.z * t; }
    x = yasla(x, adim); z = yasla(z, adim);
    return [x, level.yukseklik(x, z), z];
  };
  const hayaletiTasi = () => {
    if (!hayalet) return;
    const p = zemindeNokta();
    hayalet.setEnabled(!!p);
    if (p) hayalet.position.set(...p);
    hayalet.rotation.y = (donus * Math.PI) / 180;
  };
  const koy = () => {
    const p = zemindeNokta();
    if (!secilenVarlik || !p) return;
    const n: NesneYeri = { varlik: secilenVarlik.ad, konum: p.map((x) => Math.round(x * 100) / 100) as [number, number, number], donus, olcek: 1 };
    a.degistir((t) => ({ ...t, nesneler: [...(t.nesneler ?? []), { id: yeniId((t.nesneler ?? []).map((x) => x.id ?? "")), ...n }] }), `yerleştirildi: ${kisaAd(n.varlik)}`);
  };

  // ── seçme ──
  const vurgula = (id: string | null, acik: boolean) => {
    if (id === null) return;
    for (const m of level.nesneler.meshleri(id)) m.showBoundingBox = acik;
  };
  const seciliBirak = () => { vurgula(secilenNesne, false); secilenNesne = null; };
  const sec = () => {
    const p = sahne.pick(sahne.pointerX, sahne.pointerY, (m) => m.isPickable && level.nesneler.idsi(m) !== null, false, kamera);
    seciliBirak();
    const id = level.nesneler.idsi(p?.pickedMesh);
    if (id === null) { durumYaz("Bir varlığa tıkla → zemine yerleştir. Sahnedeki nesneye tıkla → seç."); return; }
    secilenNesne = id;
    vurgula(id, true);
    const n = level.tanim().nesneler?.find((x) => x.id === id);
    durumYaz(`seçili: ${n ? kisaAd(n.varlik) : id} — Q/E döndür (Shift 90°) · Del sil · Esc bırak`);
  };
  const seciliyiDegistir = (f: (n: NesneYeri) => NesneYeri | null, mesaj: string) => {
    const i = secilenNesne;
    if (i === null) return;
    vurgula(i, false);
    a.degistir((t) => {
      const liste = (t.nesneler ?? []).flatMap((n) => (n.id === i ? (f(n) ?? []) : n));
      return { ...t, nesneler: liste };
    }, mesaj);
    if (mesaj.startsWith("silindi")) secilenNesne = null;
    else setTimeout(() => vurgula(i, true), 300);   // yeniden kurulan örnek yüklenince
  };

  // ── girdi ──
  let basla: { x: number; y: number } | null = null;
  tuval.addEventListener("pointermove", () => { if (hayalet) hayaletiTasi(); });
  tuval.addEventListener("pointerdown", (e) => { if (acikMi()) basla = { x: e.clientX, y: e.clientY }; });
  tuval.addEventListener("pointerup", (e) => {
    if (!acikMi() || !basla) return;
    const surukle = Math.hypot(e.clientX - basla.x, e.clientY - basla.y) > 5;
    basla = null;
    if (surukle) return;
    if (e.button === 2) { if (secilenVarlik) yerlestirmeyiBitir(); return; }
    if (e.button !== 0) return;
    if (secilenVarlik) koy(); else sec();
  });
  tuval.addEventListener("contextmenu", (e) => { if (acikMi()) e.preventDefault(); });
  addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement | null)?.matches?.("input, select, textarea")) return;
    if (e.code === "KeyV" && !e.ctrlKey) { acKapa(); return; }
    if (!acikMi()) return;
    const adimD = e.shiftKey ? 90 : 15;
    if (e.code === "KeyQ" || e.code === "KeyE") {
      const yon = e.code === "KeyQ" ? -1 : 1;
      if (secilenVarlik) { donus = (donus + yon * adimD + 360) % 360; hayaletiTasi(); }
      else seciliyiDegistir((n) => { const d = donusVec(n.donus); d[1] += yon * adimD; return { ...n, donus: kisaDonus(d) }; }, "döndürüldü");
    } else if (e.code === "Escape") {
      if (secilenVarlik) yerlestirmeyiBitir(); else seciliBirak();
    } else if ((e.code === "Delete" || e.code === "Backspace") && secilenNesne !== null) {
      seciliyiDegistir(() => null, "silindi");
    }
  });

  const acikMi = () => !kok.classList.contains("gizli");
  function acKapa() {
    kok.classList.toggle("gizli");
    if (acikMi()) {
      if (document.pointerLockElement) document.exitPointerLock();
      if (!katalog) {
        level.nesneler.katalog().then((k) => { katalog = k; ciz(); yerlestirmeyiBitir(); })
          .catch((err: unknown) => durumYaz(`katalog yok: ${err instanceof Error ? err.message : err} — assets/kaynak/sehir-kiti.py ile üret`));
      }
    } else { yerlestirmeyiBitir(); seciliBirak(); }
  }
  return { acikMi, acKapa };
}
