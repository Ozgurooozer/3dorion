// uygulama/yapi/sekans/kurulum.ts — SEKANS SİSTEMİNİN KURULUMU (spec 36): depo, örnekler, oynatıcı, JSON penceresi, editör, Yapı çubuğu sekmesi ve
// `sekansdene` senaryosunun yüzü. Kompozisyon kökü (`uygulama/giris.ts`) bunu TEK çağrıyla kurar (kablo orada kısa kalsın).
//
// BEDENE BAĞLANTI: bedenler (Orion, Flash) klip bulucusu olarak `katman`ı alır (giris.ts: kütüphane + geçici sekans klipleri). Oynatıcı ajanlara
// grafiğin kullandığı AYNI kapıdan (`kapi`: Orion `niyetiYurut`, Flash kendi bedeni) klipli `jest` niyeti verir — ikinci eylem yolu yok.
// SENARYO YÜZÜ: `sekansdene` (yalnız `?sekansdene=1` URL'siyle yüklenen senaryo) örnekleri gerçek oynatıcıyla oynatır. Yüz HER ZAMAN kurulur ama
// `senaryoKosusu` değilse oynatmayı NEDENLE reddeder (bekçi: sekansBekci.test.ts — buradaki `sekansiOynat(` çağrısından önce bu denetim olmalı).
// Senaryo bağlamı yalnız dinamik yüklenen senaryo modüllerine verilir (window'da değil).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Sekme } from "../../../world/arayuz/altCubuk.ts";
import { editorPenceresiKur, type EditorPenceresi } from "../../../world/arayuz/editorPenceresi.ts";
import type { Sekans } from "../../../protocol/sekans.ts";
import type { Avatar, KlipBulucu } from "../../../world/avatar/index.ts";
import { rigKipiKur, type RigKipi } from "../../rig/rigKipi.ts";
import { kameraOynaticiKur, type KameraOynatici } from "../../sekans/kameraOynatici.ts";
import { fovDerece, fovRadyan, orionKarsisi } from "../../sekans/editor/kameraYardimcilari.ts";
import { serbestKameradan, serbestKonum } from "../../sekans/editor/serbestKamera.ts";
import { serbestKameraGirdisiKur } from "./serbestKameraGirdisi.ts";
import type { GeciciKlipKatmani } from "../../sekans/geciciKlipler.ts";
import { sekansOynaticiKur, type OynatmaDurumu, type OynatmaIstegi, type SekansKapisi, type SekansOynatici } from "../../sekans/oynatici.ts";
import { sekansDeposuKur, sekansKaynaginiSec, type SekansDeposu } from "../../sekans/sekansDeposu.ts";
import { ornekKutuphanesiKur, ornekleriYukle } from "../../sekans/ornekler.ts";
import { sekansEditoruKur, type SekansEditoru } from "./sekansEditoru.ts";
import type { AnaMenu } from "../ortak/anaMenu.ts";
import type { DokYoneticisi } from "../ortak/dok/dokYoneticisi.ts";
import { bosAd, sekansSekmesi } from "./sekansSekmesi.ts";

/** Sekans kamerasının sürdüğü canlı kamera (`KameraRig`in alt kümesi; başsız testte sahte). */
export interface SekansKameraRig {
  sekansKamerasi(konum: Vector3, bakis: Vector3, fov: number): void;
  sekansKamerasiBirak(): void;
  readonly sekansKamerasiAktif: boolean;
  gorunum(): { konum: Vector3; hedef: Vector3; fov: number };
}

export interface SekansKurulumAyari {
  /** Pencere tepesindeki ana menü şeridi (spec 39 D2): editör menülerini ona katar. */
  anaMenu: AnaMenu;
  /** Dok sistemi (spec 39 D3): editörün Ayrıntılar · Rig · Kamera panelleri. */
  dokSistemi: DokYoneticisi;
  /** Control Rig (spec 38) ve kamera (spec 38 §7) için sahne, tuval, bedenler ve canlı kamera. */
  sahne: Scene;
  tuval: HTMLElement;
  /** Ajan kimliği (orion, flash) → beden; bedensiz null. Rig yalnız Orion'un bedenini düzenler. */
  avatar(ajan: string): Avatar | null;
  kameraRig: SekansKameraRig;
  /** Klip KÜTÜPHANESİ (bölüm adları/süreleri; geçici klipler değil). */
  klipler: KlipBulucu;
  /** Bedenlerin klip bulucusu (kütüphane + geçici sekans klipleri). */
  katman: GeciciKlipKatmani;
  kapi(id: string): SekansKapisi | null;
  ajanlar(): readonly string[];
  /** Varlık okuma (`fetch(varlik(yol))`): örnekler `sekans/liste.json`. */
  oku(yol: string): Promise<string>;
  altyazi(metin: string, ms?: number): void;
  izin(): boolean;
  gorunurlukDegisti(acik: boolean): void;
  gunluk(seviye: "bilgi" | "iyi" | "uyari" | "hata", metin: string): void;
  /** Bu koşu `sekansdene` senaryosu mu (URL). Değilse senaryo yüzü oynatmayı reddeder. */
  senaryoKosusu: boolean;
  /** Yapı çubuğunda bir sekmeyi aç (senaryo: Sekans sekmesinin karesi). */
  sekmeAc(id: string): boolean;
}

export interface SekansSenaryoYuzu {
  /** Depo ve örnekler yüklenince çözülür. */
  hazir(): Promise<void>;
  ornekler(): readonly Sekans[];
  oynat(s: Sekans, istek: OynatmaIstegi): { ok: true } | { ok: false; neden: string };
  durdur(): void;
  durum(): OynatmaDurumu;
  /** Yapı çubuğunda Sekans sekmesini aç. */
  sekmeAc(): boolean;
  /** Örneğin kopyasını (senaryo koşusunda geçici klasöre) alıp editörde açar; açılan sekansın adı ya da null. */
  ornegiAc(ad: string): Promise<string | null>;
  readonly editor: SekansEditoru;
  /** Control Rig kipi (rigdene) ve kamera önizlemesi (kameradene). */
  readonly rig: RigKipi;
  readonly kamera: KameraOynatici;
}

export interface SekansSistemi {
  sekme: Sekme;
  pencere: EditorPenceresi;
  editor: SekansEditoru;
  oynatici: SekansOynatici;
  depo: SekansDeposu;
  senaryo: SekansSenaryoYuzu;
  rig: RigKipi;
  kamera: KameraOynatici;
}

export function sekansKur(a: SekansKurulumAyari): SekansSistemi {
  const kaynak = sekansKaynaginiSec();
  let depoHata: string | null = kaynak.hata;
  const depo = sekansDeposuKur(kaynak.kaynak);
  const ornekler = ornekKutuphanesiKur();
  const oynatici = sekansOynaticiKur({ katman: a.katman, kapi: a.kapi, ajanlar: a.ajanlar, gunluk: (s, m) => { a.gunluk(s, m); console.log(`[SEKANS] ${m}`); } });
  const pencere = editorPenceresiKur({
    kaynak: { oku: (ad) => depo.oku(ad), yaz: (ad, metin) => depo.yaz(ad, metin) },
    bilgi: (ad) => { const k = depo.liste().find((x) => x.ad === ad); return !k ? null : k.hata ? `✗ ${k.hata}` : `sekans · ${k.ajanlar.join(", ")} · ▶ editörde`; },
    not: () => "Sekans (JSON): bağlamalar, izler (uzuv: anahtarlar · klip: bölümler), kare = 1/30 sn. Ctrl+S biçimi doğrular (bozuksa kaydetmez).",
    degistiNotu: "kaydedildi (biçim doğrulandı, okunur biçime çevrildi)",
    altyazi: a.altyazi,
  });
  depo.dinle((o) => { if (o.tur === "icerik") void pencere.icerikDegisti(o.ad); pencere.tazele(); });
  const metinAc = (ad: string) => { pencere.ac(ad).catch((e: unknown) => a.altyazi(`${ad} açılamadı: ${e instanceof Error ? e.message : String(e)}`, 4000)); };
  // Serbest kamera (spec 38 §7): editör açıkken orbit/pan/zoom/uç; sekans kamerası yokken canlı kamerayı bu tutar.
  const kareGozcusu = (f: () => void) => { const g = a.sahne.onBeforeRenderObservable.add(f); return () => { a.sahne.onBeforeRenderObservable.remove(g); }; };
  const serbest = serbestKameraGirdisiKur({ tuval: a.tuval, kareGozcusu });
  /** Orion'un karşısından ilk kadraj (Orion yoksa oyuncunun görünümünden). */
  const orionKadraji = () => {
    const o = a.avatar("orion");
    if (o) { const g = orionKarsisi(o.cizimKonumu(), o.cizimYaw(), 3.4); return serbestKameradan(g.konum, g.hedef, 50); }
    const g = a.kameraRig.gorunum();
    return serbestKameradan([g.konum.x, g.konum.y, g.konum.z], [g.hedef.x, g.hedef.y, g.hedef.z], Math.round(fovDerece(g.fov)));
  };
  // Kamera: ▶ sürerken oynatma karesinin, durunca (isteğe bağlı) playhead'in kamerasını canlı kameraya verir (spec 38 §7).
  const kamera = kameraOynaticiKur({
    serbest: () => serbest.poz(),
    oynatici,
    surucu: { uygula: (p) => { if (p) a.kameraRig.sekansKamerasi(new Vector3(...p.konum), new Vector3(...p.hedef), fovRadyan(p.fov)); else a.kameraRig.sekansKamerasiBirak(); } },
    kareGozcusu,
  });
  // Control Rig: sahnede kontrol şekilleri, halka sürükleme, auto-key (spec 38). `editorRef` editör kurulunca dolar (rig önce kurulur: editör onu ister).
  let editorRef: SekansEditoru | null = null;
  const rig = rigKipiKur({
    sahne: a.sahne, tuval: a.tuval, avatar: a.avatar, klipler: a.klipler,
    oynuyor: (ad) => oynatici.durum().calisiyor?.sekans === ad,
    degisti: () => editorRef?.tazele(),
    altyazi: a.altyazi,
  });
  const editor = sekansEditoruKur({
    anaMenu: a.anaMenu, dokSistemi: a.dokSistemi, depo, oynatici, klipler: a.klipler, ajanlar: a.ajanlar, metinAc, altyazi: a.altyazi, izin: a.izin, gorunurlukDegisti: a.gorunurlukDegisti, rig,
    kamera: {
      oynatici: kamera,
      // Önizleme sürerken canlı kamera sekansın kamerasıdır: görünüm yok (null). Serbest kamera açıkken "şu anki görünüm" ONUN gözüdür (orbit ile kurduğun kadraj).
      gorunum: () => {
        if (kamera.onizlemeAcikMi()) return null;
        const sk = serbest.durum();
        if (serbest.aktifMi() && sk) return { konum: serbestKonum(sk), hedef: [...sk.hedef], fov: Math.round(sk.fov) };
        if (a.kameraRig.sekansKamerasiAktif) return null;
        const g = a.kameraRig.gorunum();
        return { konum: [g.konum.x, g.konum.y, g.konum.z], hedef: [g.hedef.x, g.hedef.y, g.hedef.z], fov: Math.round(fovDerece(g.fov)) };
      },
      orion: () => { const o = a.avatar("orion"); return o ? { konum: o.cizimKonumu(), yaw: o.cizimYaw() } : null; },
      serbest: { ac: () => serbest.ac(orionKadraji), kapat: () => serbest.kapat(), odakla: () => serbest.ayarla(orionKadraji()), aktifMi: () => serbest.aktifMi() },
    },
  });
  editorRef = editor;
  const sekme = sekansSekmesi({ depo, ornekler, oynatici, editor, ajanlar: a.ajanlar, metinAc, hata: () => depoHata, bildir: a.altyazi });

  const yuklendi = Promise.all([
    depo.baslat().then(() => console.log(`[SEKANS] ${depo.liste().length} sekans`), (e: unknown) => { depoHata = e instanceof Error ? e.message : String(e); console.error("[SEKANS] yüklenemedi:", depoHata); }),
    ornekleriYukle(a.oku).then((r) => {
      ornekler.doldur(r.ornekler, r.hatalar);
      console.log(`[SEKANS] ${r.ornekler.length} örnek: ${r.ornekler.map((s) => s.ad).join(", ")}`);
      for (const h of r.hatalar) { console.warn(`[SEKANS] örnek ${h.dosya}: ${h.neden}`); a.gunluk("uyari", `sekans örneği ${h.dosya}: ${h.neden}`); }
    }),
  ]).then(() => undefined);

  const senaryo: SekansSenaryoYuzu = {
    hazir: () => yuklendi,
    ornekler: () => ornekler.liste(),
    oynat(s, istek) {
      // Yalnız `?sekansdene=1` koşusunda: üretimde oynatmak editörün ▶'si (gerçek tık).
      if (!a.senaryoKosusu) return { ok: false, neden: "senaryo yüzü yalnız sekansdene koşusunda oynatır" };
      return oynatici.sekansiOynat(s, istek);
    },
    durdur: () => oynatici.durdur(),
    durum: () => oynatici.durum(),
    sekmeAc: () => a.sekmeAc("sekans"),
    async ornegiAc(ad) {
      const s = ornekler.al(ad);
      if (!s) return null;
      const yeni = bosAd((x) => depo.liste().some((k) => k.ad === x), s.ad);
      await depo.yeni({ ...structuredClone(s), ad: yeni });
      return editor.ac(yeni) ? yeni : null;
    },
    editor, rig, kamera,
  };
  return { sekme, pencere, editor, oynatici, depo, senaryo, rig, kamera };
}
