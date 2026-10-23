// uygulama/rig/rigKipi.ts — RİG KİPİ DENETLEYİCİSİ (spec 38 §5): seçim, sürükleme, otomatik anahtar, geri al. Parçaları bağlar, kendi mantığı yok:
//   saf çekirdek (`world/avatar/rig/{kontroller,poz,surukleme}.ts`) · sekansa yazma (`anahtarla.ts`) · sahne çizimi (`world/avatar/rig/gosterim.ts`) ·
//   bedene poz (`Avatar.rigPozu`) · geri al yığını (SekansOturumu: her düzenleme TEK adım).
//
// AKIŞ: Sekans editöründe bir sekans açıkken rig kipi açılır; her karede sekansın o karedeki pozu bedene gösterilir (scrub gövdeyi oynatır — Sekans'ın
// eski açığı). Ozyn bir kontrolü tıklar → seçilir, eklemine üç döndürme halkası gelir; halkayı sürükler (ya da panelde sayı yazar) → o karedeki toplam dönme
// değişir ve bu `anahtarla.rigDuzenle` ile uzuv izlerine ANAHTAR olarak yazılır (auto-key: kare = playhead). Sürükleme önizlemedir (bırakınca TEK geri al
// adımı), Esc sürüklemeyi iptal eder. Oynatma (▶) sürerken rig pozu bırakılır: oynatma klip yolundan gider, durunca rig geri gelir.
//
// GÜVENLİK: rig yalnız sekans VERİSİNİ düzenler; çalıştırma yolu (▶) değişmez. Fare olayları yalnız gerçek tıktır (`isTrusted`; senaryo yüzü `programli*` ile
// aynı kodu çağırır ama yalnız rigdene koşusunda kurulur). Orion'un araç yüzeyinde rig yoktur.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Sonuc } from "../../protocol/dogrula.ts";
import { type Kanal, type Uzuv } from "../../protocol/animasyon.ts";
import type { Sekans } from "../../protocol/sekans.ts";
import { eksendeDondur, eulerEsit, kontrolBul, rigGosterimiKur, surukleAcisi, uzuvKontrolu, type Avatar, type Euler, type Kontrol, type KlipBulucu, type RigEkseni, type RigGosterimi, type V3 } from "../../world/avatar/index.ts";
import type { KomutSonucu, SekansOturumu } from "../sekans/editor/sekansOturumu.ts";
import { baglamaDegerleri, rigDuzenle, uzuvEuleri } from "./anahtarla.ts";

export interface RigKipiAyari {
  sahne: Scene;
  tuval: HTMLElement;
  /** Ajan kimliği (orion, flash) → beden; bedensiz ajan null. */
  avatar(ajan: string): Avatar | null;
  klipler: KlipBulucu;
  /** Etkin sekansın bu adı şu an ▶ ile oynuyor mu (oynarken rig pozu bırakılır). */
  oynuyor(sekans: string): boolean;
  /** Bir düzenleme yazıldı/önizlendi: editör yeniden çizsin. */
  degisti(): void;
  altyazi(metin: string, ms?: number): void;
}

export interface RigKipi {
  ac(oturum: SekansOturumu, ad: string): KomutSonucu;
  kapat(): void;
  acikMi(): boolean;
  sec(id: string | null): void;
  secili(): Kontrol | null;
  /** Seçili uzvun playhead karesindeki TOPLAM Euler dönmesi (önizleme dahil). */
  seciliEuler(): Euler | null;
  /** Seçili uzvun playhead karesinde anahtarı var mı. */
  seciliAnahtarli(): boolean;
  /** Panel: bir kanalı mutlak değere ayarla (derece). */
  kanalAyarla(eksen: RigEkseni, deger: number): KomutSonucu;
  /** Panel: gövde ekseni etrafında `derece` döndür. */
  dondur(eksen: RigEkseni, derece: number): KomutSonucu;
  /** Panel: seçili uzvun karedeki dönmesini sıfırla. */
  sifirla(): KomutSonucu;
  /** Sürüklemeyi (halka) başlat/ilerlet/bitir — gerçek fare olayı VE senaryo aynı yolu kullanır. */
  surukleBasla(eksen: RigEkseni, nokta: V3): boolean;
  surukleHareket(dx: number, dy: number): void;
  surukleBitir(): KomutSonucu | null;
  surukleIptal(): boolean;
  suruklemede(): boolean;
  dinle(f: () => void): () => void;
  /** Senaryo ve test: gösterim (şekillerin konumu, tıklama). */
  readonly gosterim: RigGosterimi;
  /** Hangi bağlama/ajan düzenleniyor. */
  baglama(): { id: string; ajan: string } | null;
}

/** `@ben` editörden oynatırken çözülmez; rig bunu Orion'a çözer (rig Orion'un bedenini düzenler). */
const ajanaCoz = (a: string): string => (a === "@ben" ? "orion" : a);

export function rigKipiKur(a: RigKipiAyari): RigKipi {
  // Gösterimin kaynağı: AKTİF bağlamanın bedeni. Avatar yoksa konumsuz (şekiller görünmez).
  let oturum: SekansOturumu | null = null, ad: string | null = null, acik = false;
  let bag: { id: string; ajan: string } | null = null;
  let secili: string | null = null;
  let onizleme: Sekans | null = null;
  let surukle: { taban: Sekans; kare: number; uzuv: Uzuv; eksen: RigEkseni; nokta: V3; tabanEuler: Euler; toplam: number } | null = null;
  const dinleyiciler = new Set<() => void>();
  const yay = () => { for (const f of [...dinleyiciler]) { try { f(); } catch (e) { console.error("[RIG] dinleyici hatası:", e); } } };
  const beden = (): Avatar | null => (bag ? a.avatar(ajanaCoz(bag.ajan)) : null);

  const gosterim = rigGosterimiKur(a.sahne, {
    uzuvKonumu: (u) => beden()?.uzuvKonumu(u) ?? null,
    cizimYaw: () => beden()?.cizimYaw() ?? 0,
  });

  const sekansi = (): Sekans | null => onizleme ?? oturum?.sekans() ?? null;
  const kare = (): number => oturum?.kare ?? 0;

  // Poz yenileme: sekans (kimliği) ya da kare değişince bedene yeniden verilir.
  let sonSekans: Sekans | null = null, sonKare = -1, sonBeden: Avatar | null = null, poz = false;
  const gozcu = a.sahne.onBeforeRenderObservable.add(() => {
    if (!acik || !bag || !ad) return;
    const b = beden();
    const oynuyor = a.oynuyor(ad);
    if (oynuyor) { if (poz) { sonBeden?.rigPozu(null); poz = false; sonSekans = null; } return; }
    const s = sekansi();
    if (!s || !b) return;
    if (!poz || s !== sonSekans || kare() !== sonKare || b !== sonBeden) {
      if (b !== sonBeden) sonBeden?.rigPozu(null);
      b.rigPozu(baglamaDegerleri(s, bag.id, kare(), a.klipler));
      sonSekans = s; sonKare = kare(); sonBeden = b; poz = true;
    }
  });

  function bagBul(s: Sekans): { id: string; ajan: string } | null {
    // Rig Orion'un bedenini düzenler; sekansta Orion bağlaması varsa o, yoksa bedeni olan ilk bağlama.
    return s.baglamalar.find((b) => ajanaCoz(b.ajan) === "orion") ?? s.baglamalar.find((b) => a.avatar(ajanaCoz(b.ajan))) ?? null;
  }

  function seciliEksen(): Uzuv | null { const k = secili ? kontrolBul(secili) : null; return k ? k.uzuv : null; }

  function yaz(r: Sonuc<{ sekans: Sekans }>, mesaj: string): KomutSonucu {
    if (!oturum) return { ok: false, mesaj: "rig kipi kapalı" };
    if (!r.ok) return { ok: false, mesaj: r.hata };
    const s = r.deger.sekans;
    const x = oturum.uygula({ ok: true, deger: s }, mesaj);
    onizleme = null;
    a.degisti(); yay();
    return x;
  }

  function euleriDuzenle(hedef: Euler, mesaj: string): KomutSonucu {
    const u = seciliEksen();
    if (!oturum || !bag || !u) return { ok: false, mesaj: "önce bir kontrol seç (sahnede şekle tıkla)" };
    const s = oturum.sekans();
    const simdi = uzuvEuleri(s, bag.id, u, kare(), a.klipler);
    if (eulerEsit(simdi, hedef, 1e-3)) return { ok: true, mesaj: "değişen bir şey yok" };
    return yaz(rigDuzenle(s, bag.id, u, kare(), hedef, a.klipler), mesaj);
  }

  function pointerAsagi(e: PointerEvent): void {
    if (!acik || e.button !== 0) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (!e.isTrusted) return;   // yalnız gerçek tık
    const v = gosterim.vurus(e.offsetX, e.offsetY);
    if (!v) { return; }
    if (v.tur === "kontrol") { rig.sec(v.id); return; }
    if (v.tur === "halka") rig.surukleBasla(v.eksen, v.nokta);
  }
  let sonX = 0, sonY = 0;
  function pointerHareket(e: PointerEvent): void {
    if (!surukle) return;
    const dx = e.clientX - sonX, dy = e.clientY - sonY;
    sonX = e.clientX; sonY = e.clientY;
    rig.surukleHareket(dx, dy);
  }
  const pointerYukari = (e: PointerEvent): void => { if (surukle && e.button === 0) rig.surukleBitir(); };
  const tiklaYut = (e: Event): void => { if (acik) { e.stopImmediatePropagation(); e.preventDefault(); } };
  const tusIsle = (e: KeyboardEvent): void => {
    // Esc yalnız sürüklemeyi iptal eder (editörün kendi Esc'i editörü gizler; sürükleme sırasında önce o).
    if (acik && surukle && e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); rig.surukleIptal(); }
  };

  const rig: RigKipi = {
    gosterim,
    ac(o, adi) {
      const b = bagBul(o.sekans());
      if (!b) return { ok: false, mesaj: "rig için bedeni olan bir bağlama yok (bağlamanın ajanı orion olsun)" };
      oturum = o; ad = adi; bag = b; acik = true; onizleme = null;
      gosterim.etkin(true);
      a.tuval.addEventListener("pointerdown", pointerAsagi, { capture: true });
      a.tuval.addEventListener("click", tiklaYut, { capture: true });
      a.tuval.addEventListener("contextmenu", tiklaYut, { capture: true });
      addEventListener("pointermove", pointerHareket);
      addEventListener("pointerup", pointerYukari);
      addEventListener("keydown", tusIsle, { capture: true });
      sonSekans = null; sonKare = -1;
      a.altyazi("rig kipi: sahnede bir şekle tıkla, halkayı sürükle · değişiklik playhead karesine anahtar olur", 4000);
      a.degisti(); yay();
      return { ok: true, mesaj: `rig açık · ${b.ajan}` };
    },
    kapat() {
      if (!acik) return;
      rig.surukleIptal();
      acik = false;
      gosterim.etkin(false);
      sonBeden?.rigPozu(null); poz = false; sonBeden = null;
      a.tuval.removeEventListener("pointerdown", pointerAsagi, { capture: true });
      a.tuval.removeEventListener("click", tiklaYut, { capture: true });
      a.tuval.removeEventListener("contextmenu", tiklaYut, { capture: true });
      removeEventListener("pointermove", pointerHareket);
      removeEventListener("pointerup", pointerYukari);
      removeEventListener("keydown", tusIsle, { capture: true });
      secili = null; gosterim.seciliYap(null); oturum = null; ad = null; bag = null;
      a.degisti(); yay();
    },
    acikMi: () => acik,
    sec(id) {
      secili = id && kontrolBul(id) ? id : null;
      gosterim.seciliYap(secili);
      yay();
    },
    secili: () => (secili ? kontrolBul(secili) : null),
    seciliEuler() {
      const u = seciliEksen(), s = sekansi();
      if (!u || !s || !bag) return null;
      return uzuvEuleri(s, bag.id, u, kare(), a.klipler);
    },
    seciliAnahtarli() {
      const u = seciliEksen(), s = sekansi();
      if (!u || !s || !bag) return false;
      return s.izler.some((z) => z.tur === "uzuv" && z.baglama === bag!.id && z.uzuv === u && z.anahtarlar.some((k) => k.kare === kare()));
    },
    kanalAyarla(eksen, deger) {
      const e = rig.seciliEuler();
      if (!e) return { ok: false, mesaj: "önce bir kontrol seç (sahnede şekle tıkla)" };
      return euleriDuzenle({ ...e, [eksen]: deger }, `${uzuvKontrolu(seciliEksen()!)?.ad ?? ""}: donme_${eksen} = ${Math.round(deger * 10) / 10}° · kare ${kare()}`);
    },
    dondur(eksen, derece) {
      const e = rig.seciliEuler();
      if (!e) return { ok: false, mesaj: "önce bir kontrol seç (sahnede şekle tıkla)" };
      return euleriDuzenle(eksendeDondur(e, eksen, derece), `${uzuvKontrolu(seciliEksen()!)?.ad ?? ""}: ${eksen.toUpperCase()} ekseninde ${derece > 0 ? "+" : ""}${derece}° · kare ${kare()}`);
    },
    sifirla() { return euleriDuzenle({ x: 0, y: 0, z: 0 }, `${seciliEksen() ? uzuvKontrolu(seciliEksen()!)?.ad : ""}: sıfırlandı · kare ${kare()}`); },
    surukleBasla(eksen, nokta) {
      const u = seciliEksen();
      if (!oturum || !bag || !u || surukle) return false;
      const taban = oturum.sekans();
      surukle = { taban, kare: kare(), uzuv: u, eksen, nokta, tabanEuler: uzuvEuleri(taban, bag.id, u, kare(), a.klipler), toplam: 0 };
      return true;
    },
    surukleHareket(dx, dy) {
      const s = surukle;
      if (!s || !bag) return;
      const merkez = gosterim.merkez();
      if (!merkez) return;
      // Programlı çağrıda (senaryo) dx/dy doğrudan DERECE değil piksel: gerçek olayla aynı yol.
      s.toplam += surukleAcisi(merkez, gosterim.eksenYonu(s.eksen), s.nokta, gosterim.ekranaKoy(), dx, dy) * (180 / Math.PI);
      const hedef = eksendeDondur(s.tabanEuler, s.eksen, s.toplam);
      const r = rigDuzenle(s.taban, bag.id, s.uzuv, s.kare, hedef, a.klipler);
      if (r.ok) { onizleme = r.deger.sekans; a.degisti(); yay(); }
    },
    surukleBitir() {
      const s = surukle;
      surukle = null;
      if (!s || !onizleme || !oturum) { onizleme = null; return null; }
      const u = uzuvKontrolu(s.uzuv);
      const yeni = onizleme;
      const r = yaz({ ok: true, deger: { sekans: yeni } }, `${u?.ad ?? s.uzuv}: ${s.eksen.toUpperCase()} halkası ${Math.round(s.toplam * 10) / 10}° · kare ${s.kare} (Ctrl+Z geri alır)`);
      return r;
    },
    surukleIptal() { if (!surukle) return false; surukle = null; onizleme = null; a.degisti(); yay(); return true; },
    suruklemede: () => surukle !== null,
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    baglama: () => bag,
  };
  void gozcu;
  return rig;
}

export type RigKanali = Kanal;
