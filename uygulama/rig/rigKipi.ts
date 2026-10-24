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
import { dunyaEkseniGovdeye, eksenVektorundeDondur, eulerEsit, grupBul, kontrolBul, rigGosterimiKur, surukleAcisi, surukleOtelemesi, uzuvKontrolu, type Avatar, type Euler, type Kontrol, type KlipBulucu, type RigEkseni, type RigGosterimi, type RigUzayi, type V3 } from "../../world/avatar/index.ts";
import type { KomutSonucu, SekansOturumu } from "../sekans/editor/sekansOturumu.ts";
import { baglamaDegerleri, rigDuzenle, rigOtelemeDuzenle, uzuvEuleri, uzuvOtelemesi } from "./anahtarla.ts";
import { bedeniSifirla, grubuSifirla, grubuYansit, pozuOku, pozuYapistir, type RigPozu, type TopluSonuc } from "./grupIslemleri.ts";

/** Gizmo kipi: döndür (halkalar) ya da taşı (oklar; yalnız kök/pelvis: bütün bedeni taşır). Ölçek BİÇİMDE YOK (kanal yok) — arayüz bunu dürüstçe söyler. */
export type RigKipiTuru = "dondur" | "tasi";

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
  /** Panel kaydırıcısı: canlı ÖNİZLEME (geri al yığınına girmez); bırakılınca `kanalAyarla` ile yazılır, `kanalOnizleBirak` önizlemeyi atar. */
  kanalOnizle(eksen: RigEkseni, deger: number): void;
  kanalOnizleBirak(): void;
  /** Gizmo kipi (döndür/taşı) ve yönü (gövde/dünya). */
  kip(): RigKipiTuru;
  kipAyarla(k: RigKipiTuru): void;
  uzay(): RigUzayi;
  uzayAyarla(u: RigUzayi): void;
  /** Taşı seçili kontrol için çalışır mı (yalnız Pelvis/kök); çalışmıyorsa nedeni. */
  tasimaDestegi(): { ok: boolean; neden?: string };
  /** Seçili (kök) kontrolün karedeki toplam ötelemesi (metre; gövde uzayı) ve panelden mutlak değer yazma. */
  seciliOteleme(): { x: number; y: number; z: number } | null;
  otelemeAyarla(eksen: RigEkseni, metre: number): KomutSonucu;
  /** Taşı oku sürüklemesi (gerçek fare ve senaryo aynı yol). */
  otelemeBasla(eksen: RigEkseni): boolean;
  /** Grup işlemleri (hepsi bu karede, TEK geri al adımı): grubu sıfırla, sol↔sağ yansıt, bütün bedeni sıfırla, poz kopyala/yapıştır. */
  grubuSifirla(id: string): KomutSonucu;
  grubuYansit(id: string): KomutSonucu;
  bedeniSifirla(): KomutSonucu;
  pozKopyala(): KomutSonucu;
  pozYapistir(): KomutSonucu;
  panoVar(): boolean;
  /** Bu karede anahtarı olan uzuvlar (panelde ◆ işareti). */
  anahtarliUzuvlar(): ReadonlySet<Uzuv>;
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
  /**
   * Poz önizleme (rig kapalıyken de): verilen sekansın playhead karesindeki poz bedende gösterilir (null = kapalı). Editör açıkken her `tazele`de bildirir:
   * zaman çizelgesinde kare kare ilerlemek, ■ ile durmak ve bir sonraki kareye gitmek bedeni de ilerletir.
   */
  pozOnizleme(o: SekansOturumu | null, ad: string | null): void;
}

/** `@ben` editörden oynatırken çözülmez; rig bunu Orion'a çözer (rig Orion'un bedenini düzenler). */
const ajanaCoz = (a: string): string => (a === "@ben" ? "orion" : a);

export function rigKipiKur(a: RigKipiAyari): RigKipi {
  // Gösterimin kaynağı: AKTİF bağlamanın bedeni. Avatar yoksa konumsuz (şekiller görünmez).
  let oturum: SekansOturumu | null = null, ad: string | null = null, acik = false;
  let bag: { id: string; ajan: string } | null = null;
  let secili: string | null = null;
  let onizleme: Sekans | null = null;
  let surukle: { tur: "dondur" | "otele"; taban: Sekans; kare: number; uzuv: Uzuv; eksen: RigEkseni; nokta: V3; tabanEuler: Euler; tabanOtele: { x: number; y: number; z: number }; toplam: number } | null = null;
  let kipT: RigKipiTuru = "dondur", uzayT: RigUzayi = "govde";
  let pano: RigPozu | null = null;
  const dinleyiciler = new Set<() => void>();
  const yay = () => { for (const f of [...dinleyiciler]) { try { f(); } catch (e) { console.error("[RIG] dinleyici hatası:", e); } } };
  const beden = (): Avatar | null => (bag ? a.avatar(ajanaCoz(bag.ajan)) : null);

  const gosterim = rigGosterimiKur(a.sahne, {
    uzuvKonumu: (u) => beden()?.uzuvKonumu(u) ?? null,
    cizimYaw: () => beden()?.cizimYaw() ?? 0,
  });

  const sekansi = (): Sekans | null => onizleme ?? oturum?.sekans() ?? null;
  const yaw = (): number => beden()?.cizimYaw() ?? 0;
  /** Gizmo ekseninin GÖVDE-UZAYI vektörü: gövde yönünde birim eksen; dünya yönünde dünya ekseni gövdeye çevrilir. */
  const govdeEkseni = (e: RigEkseni): [number, number, number] => {
    const b: [number, number, number] = e === "x" ? [1, 0, 0] : e === "y" ? [0, 1, 0] : [0, 0, 1];
    return uzayT === "govde" ? b : dunyaEkseniGovdeye(b, yaw());
  };
  const tasimaOk = (): { ok: boolean; neden?: string } => {
    const k = secili ? kontrolBul(secili) : null;
    if (!k) return { ok: false, neden: "önce bir kontrol seç" };
    if (k.uzuv !== "kalca") return { ok: false, neden: "Taşı şimdilik yalnız Pelvis (kök) için: bütün bedeni taşır. El/ayak taşımak IK ister (sonraki iş); eklemler için Döndür kullan." };
    return { ok: true };
  };
  /** Gösterimin kipini rig durumuna eşitler (halka/ok, yön). */
  const kipUygula = (): void => gosterim.modAyarla({ halka: kipT === "dondur", ok: kipT === "tasi" && tasimaOk().ok, uzay: uzayT });
  const kare = (): number => oturum?.kare ?? 0;

  // Poz yenileme: sekans (kimliği) ya da kare değişince bedene yeniden verilir.
  // POZ ÖNİZLEME (rig kapalıyken de): editör açıkken beden HER ZAMAN playhead karesindeki pozda (kare kare ilerleme, hata ayıklama). Rig açıksa onun
  // bağlamı (sürükleme önizlemesi dahil), değilse editörün bildirdiği (`pozOnizleme`). ▶ sürerken bırakılır (oynatma klip yolundan gider).
  let pOturum: SekansOturumu | null = null, pAd: string | null = null;
  let sonSekans: Sekans | null = null, sonKare = -1, sonBeden: Avatar | null = null, poz = false;
  const birakPoz = (): void => { if (poz) { sonBeden?.rigPozu(null); poz = false; sonSekans = null; sonBeden = null; } };
  const gozcu = a.sahne.onBeforeRenderObservable.add(() => {
    const rigde = acik && oturum !== null && bag !== null && ad !== null;
    const o = rigde ? oturum : pOturum, adi = rigde ? ad : pAd;
    if (!o || !adi) { birakPoz(); return; }
    const bg = rigde ? bag : bagBul(o.sekans());
    const b = bg ? a.avatar(ajanaCoz(bg.ajan)) : null;
    if (a.oynuyor(adi)) { birakPoz(); return; }
    const s = rigde ? sekansi() : o.sekans();
    if (!s || !b || !bg) { birakPoz(); return; }
    if (!poz || s !== sonSekans || o.kare !== sonKare || b !== sonBeden) {
      if (b !== sonBeden) sonBeden?.rigPozu(null);
      b.rigPozu(baglamaDegerleri(s, bg.id, o.kare, a.klipler));
      sonSekans = s; sonKare = o.kare; sonBeden = b; poz = true;
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

  /** Toplu işlem sonucu → tek geri al adımı. Değişen yoksa söyler (sessiz başarı değil). */
  function topluYaz(r: Sonuc<TopluSonuc>, mesaj: string): KomutSonucu {
    if (!r.ok) return { ok: false, mesaj: r.hata };
    if (r.deger.degisen === 0) return { ok: true, mesaj: "değişen bir şey yok (zaten böyle)" };
    return yaz({ ok: true, deger: { sekans: r.deger.sekans } }, `${mesaj} · ${r.deger.degisen} uzuv`);
  }

  function pointerAsagi(e: PointerEvent): void {
    if (!acik || e.button !== 0 || e.altKey) return;   // Alt + sol tuş = serbest kamera orbit'i (serbestKameraGirdisi.ts)
    e.stopImmediatePropagation(); e.preventDefault();
    if (!e.isTrusted) return;   // yalnız gerçek tık
    const v = gosterim.vurus(e.offsetX, e.offsetY);
    if (!v) { return; }
    if (v.tur === "kontrol") { rig.sec(v.id); return; }
    if (v.tur === "halka") rig.surukleBasla(v.eksen, v.nokta);
    if (v.tur === "ok") rig.otelemeBasla(v.eksen);
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
      kipUygula();
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
      kipUygula();
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
      return euleriDuzenle(eksenVektorundeDondur(e, govdeEkseni(eksen), derece), `${uzuvKontrolu(seciliEksen()!)?.ad ?? ""}: ${eksen.toUpperCase()} ekseninde (${uzayT === "govde" ? "gövde" : "dünya"}) ${derece > 0 ? "+" : ""}${derece}° · kare ${kare()}`);
    },
    kanalOnizle(eksen, deger) {
      const u = seciliEksen(), e = rig.seciliEuler();
      if (!oturum || !bag || !u || !e) return;
      const r = rigDuzenle(oturum.sekans(), bag.id, u, kare(), { ...e, [eksen]: deger }, a.klipler);
      if (r.ok) { onizleme = r.deger.sekans; a.degisti(); }
    },
    kanalOnizleBirak() { if (onizleme) { onizleme = null; a.degisti(); } },
    kip: () => kipT,
    kipAyarla(k) { kipT = k; kipUygula(); yay(); },
    uzay: () => uzayT,
    uzayAyarla(u) { uzayT = u; kipUygula(); yay(); },
    tasimaDestegi: tasimaOk,
    seciliOteleme() {
      const s = sekansi();
      if (!s || !bag || !tasimaOk().ok) return null;
      return uzuvOtelemesi(s, bag.id, "kok", kare(), a.klipler);
    },
    otelemeAyarla(eksen, metre) {
      const t = tasimaOk();
      if (!oturum || !bag || !t.ok) return { ok: false, mesaj: t.neden ?? "taşıma kapalı" };
      const simdi = uzuvOtelemesi(oturum.sekans(), bag.id, "kok", kare(), a.klipler);
      return yaz(rigOtelemeDuzenle(oturum.sekans(), bag.id, kare(), { ...simdi, [eksen]: metre }, a.klipler), `Pelvis (kök): ${eksen.toUpperCase()} konumu ${Math.round(metre * 1000) / 1000} m · kare ${kare()}`);
    },
    otelemeBasla(eksen) {
      if (!oturum || !bag || surukle || !tasimaOk().ok) return false;
      const taban = oturum.sekans();
      surukle = { tur: "otele", taban, kare: kare(), uzuv: "kok", eksen, nokta: [0, 0, 0], tabanEuler: { x: 0, y: 0, z: 0 }, tabanOtele: uzuvOtelemesi(taban, bag.id, "kok", kare(), a.klipler), toplam: 0 };
      return true;
    },
    grubuSifirla(id) {
      const g = grupBul(id);
      if (!g || !oturum || !bag) return { ok: false, mesaj: "grup yok ya da rig kapalı" };
      return topluYaz(grubuSifirla(oturum.sekans(), bag.id, kare(), g, a.klipler), `${g.ad}: sıfırlandı · kare ${kare()}`);
    },
    grubuYansit(id) {
      const g = grupBul(id);
      if (!g || !oturum || !bag) return { ok: false, mesaj: "grup yok ya da rig kapalı" };
      return topluYaz(grubuYansit(oturum.sekans(), bag.id, kare(), g, a.klipler), `${g.ad} → ${grupBul(g.karsi ?? "")?.ad ?? "karşı taraf"}: yansıtıldı · kare ${kare()}`);
    },
    bedeniSifirla() {
      if (!oturum || !bag) return { ok: false, mesaj: "rig kapalı" };
      return topluYaz(bedeniSifirla(oturum.sekans(), bag.id, kare(), a.klipler), `Bütün beden sıfırlandı · kare ${kare()}`);
    },
    pozKopyala() {
      const s = sekansi();
      if (!s || !bag) return { ok: false, mesaj: "rig kapalı" };
      pano = pozuOku(s, bag.id, kare(), a.klipler); yay();
      return { ok: true, mesaj: `poz kopyalandı (kare ${kare()}): başka bir kareye yapıştırabilirsin` };
    },
    pozYapistir() {
      if (!oturum || !bag) return { ok: false, mesaj: "rig kapalı" };
      if (!pano) return { ok: false, mesaj: "panoda poz yok: önce bir karede Pozu kopyala" };
      return topluYaz(pozuYapistir(oturum.sekans(), bag.id, kare(), pano, a.klipler), `poz yapıştırıldı · kare ${kare()}`);
    },
    panoVar: () => pano !== null,
    anahtarliUzuvlar() {
      const s = sekansi(), r = new Set<Uzuv>();
      if (!s || !bag) return r;
      for (const z of s.izler) if (z.tur === "uzuv" && z.baglama === bag.id && z.anahtarlar.some((k) => k.kare === kare())) r.add(z.uzuv);
      return r;
    },
    sifirla() { return euleriDuzenle({ x: 0, y: 0, z: 0 }, `${seciliEksen() ? uzuvKontrolu(seciliEksen()!)?.ad : ""}: sıfırlandı · kare ${kare()}`); },
    surukleBasla(eksen, nokta) {
      const u = seciliEksen();
      if (!oturum || !bag || !u || surukle) return false;
      const taban = oturum.sekans();
      surukle = { tur: "dondur", taban, kare: kare(), uzuv: u, eksen, nokta, tabanEuler: uzuvEuleri(taban, bag.id, u, kare(), a.klipler), tabanOtele: { x: 0, y: 0, z: 0 }, toplam: 0 };
      return true;
    },
    surukleHareket(dx, dy) {
      const s = surukle;
      if (!s || !bag) return;
      const merkez = gosterim.merkez();
      if (!merkez) return;
      // Programlı çağrıda (senaryo) dx/dy doğrudan DERECE/METRE değil piksel: gerçek olayla aynı yol.
      if (s.tur === "otele") {
        s.toplam += surukleOtelemesi(merkez, gosterim.eksenYonu(s.eksen), gosterim.ekranaKoy(), dx, dy);
        const ax = govdeEkseni(s.eksen);
        const hedefO = { x: s.tabanOtele.x + ax[0] * s.toplam, y: s.tabanOtele.y + ax[1] * s.toplam, z: s.tabanOtele.z + ax[2] * s.toplam };
        const ro = rigOtelemeDuzenle(s.taban, bag.id, s.kare, hedefO, a.klipler);
        if (ro.ok) { onizleme = ro.deger.sekans; a.degisti(); yay(); }
        return;
      }
      s.toplam += surukleAcisi(merkez, gosterim.eksenYonu(s.eksen), s.nokta, gosterim.ekranaKoy(), dx, dy) * (180 / Math.PI);
      const hedef = eksenVektorundeDondur(s.tabanEuler, govdeEkseni(s.eksen), s.toplam);
      const r = rigDuzenle(s.taban, bag.id, s.uzuv, s.kare, hedef, a.klipler);
      if (r.ok) { onizleme = r.deger.sekans; a.degisti(); yay(); }
    },
    surukleBitir() {
      const s = surukle;
      surukle = null;
      if (!s || !onizleme || !oturum) { onizleme = null; return null; }
      const u = uzuvKontrolu(s.uzuv);
      const yeni = onizleme;
      const mesaj = s.tur === "otele" ? `Pelvis (kök): ${s.eksen.toUpperCase()} oku ${Math.round(s.toplam * 1000) / 1000} m · kare ${s.kare} (Ctrl+Z geri alır)` : `${u?.ad ?? s.uzuv}: ${s.eksen.toUpperCase()} halkası ${Math.round(s.toplam * 10) / 10}° · kare ${s.kare} (Ctrl+Z geri alır)`;
      return yaz({ ok: true, deger: { sekans: yeni } }, mesaj);
    },
    surukleIptal() { if (!surukle) return false; surukle = null; onizleme = null; a.degisti(); yay(); return true; },
    suruklemede: () => surukle !== null,
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    baglama: () => bag,
    pozOnizleme(o, adi) { pOturum = o; pAd = adi; },
  };
  void gozcu;
  return rig;
}

export type RigKanali = Kanal;
