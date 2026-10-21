// uygulama/yerGecisi.ts — Ozyn ile Orion'un bulunduğu YER, kapıdan geçiş ve birleşik dünyanın açılışı.
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Yerler (`ozyn`, `orion`) iki aktörün AYRI yerde
// olabildiği (spec 24) paylaşılan referanslardır: giris.ts ve başka modüller onları `yerler.ozyn` / `yerler.orion`
// diye okur (eski `let ozynYeri` gibi canlı), yazma yalnız bu modülde. `yerlerKur` Oyuncu kurulmadan ÖNCE
// çağrılır (oyuncu `yer` geri çağrısını kurucuda okuyabilir); geçiş mantığı (`yerGecisiKur`) oyuncu, kamera ve
// ortam nesneleri hazır olunca kurulur.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Yer } from "../world/yer/yer.ts";
import { ODA_YERI } from "../world/yer/odaYeri.ts";
import { levelSahnesiKur, type LevelSahnesi } from "../world/yer/levelSahnesi.ts";
import { birlesikDunyaKur, ufukAcikMi, giAcikMi, type BirlesikDunya } from "../world/yer/birlesikDunya.ts";
import { gecitVarisi } from "../world/yer/levelYeri.ts";
import { carpisiyorMu } from "../world/level/olculer.ts";
import { capaBul } from "../world/level/capalar.ts";
// `?url`: vite dosyayı pakete kopyalar ve adresini verir (Electron file:// yüklemesinde de çözülür).
import ovaAdresi from "../world/level/ova/ova.level.json?url";
import type { KameraRig } from "../world/engine/kamera.ts";
import type { OdaKurulumu } from "../world/level/oda.ts";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { GunlukEkrani } from "../world/surfaces/duvar/gunluk.ts";
import type { stilPenceresiKur } from "../world/arayuz/stilPenceresi.ts";
import type { ortamBaglantisiKur } from "./ortamBaglantisi.ts";
import type { OrtamGunlugu } from "./ortamDeposu.ts";

/** Ozyn'in ve Orion'un yeri. Okuma serbest; yazma yalnız bu modülde (geçişler ve birleşik dünya açılışı). */
export interface Yerler { ozyn: Yer; orion: Yer }

export function yerlerKur(): Yerler { return { ozyn: ODA_YERI, orion: ODA_YERI }; }

export interface YerGecisiGirdisi {
  yerler: Yerler;
  sahne: Scene;
  oda: OdaKurulumu;
  rig: KameraRig;
  oyuncu: Oyuncu;
  gunluk: GunlukEkrani;
  altyaziGoster: (metin: string, ms?: number) => void;
  /** Birleşik dünya kuruldu (level hazır, `yerler` verildi): asset yerleştirme kayıtlı yerleştirmeleri uygular (spec 30). Hatası dünyayı bozmaz. */
  birlesikKuruldu?: (b: BirlesikDunya) => void;
  /**
   * Orion ve Ozyn DIŞINDAKİ bedenler (Flash, spec 33): birleşik dünyanın ışık üyeliği (ofis ışığı içeridekini aydınlatır) ve kapısı
   * onları da görsün. Çağrı anında okunur; verilmezse yalnız Ozyn ve Orion (eski davranış).
   */
  ekAktorler?: () => readonly { meshler: AbstractMesh[]; x: number; z: number }[];
  /** Sonradan atananlar / giris.ts'te sonra kurulanlar: çağrı anında okunur. */
  orion: () => Avatar | null;
  ortamBaglantisi: () => ReturnType<typeof ortamBaglantisiKur>;
  ortamGunlugu: () => OrtamGunlugu;
  stilPenceresi: () => ReturnType<typeof stilPenceresiKur> | null;
}

export interface YerGecisi {
  birlesik(): BirlesikDunya | null;
  disari(): LevelSahnesi | null;
  ovayaCik(): Promise<boolean>;
  odayaDon(): boolean;
  kapidanGec(): Promise<boolean>;
  /** Açılışta ova level'ını ofisin yanına kurar (spec 27); en sonda, senaryolar yüklendikten sonra çağrılır. */
  birlesikDunyayiAc(): void;
  /** Birleşik yer yeniden ölçüldü (asset yerleştirme, spec 30): bu yerde duran aktörlerin yerini tazeler; başka yerdekilere (ofis tek başına) dokunmaz. */
  birlesikYeriniYenile(yer: Yer): void;
}

export function yerGecisiKur(d: YerGecisiGirdisi): YerGecisi {
  const { yerler, sahne, oda, rig, oyuncu, gunluk, altyaziGoster } = d;
  // ── KAPIDAN OVAYA (spec 24) ────────────────────────────────────────────────
  // Ofisin kapısının öbür yanı ova level'ı. Geçişte oda gizlenir, ova AYNI sahneye kurulur (world/yer/levelSahnesi.ts);
  // dönüşte ova yıkılır, oda birebir geri gelir. Ozyn ve Orion birlikte geçer; Orion'un kendi başına çıkması C6.
  let disari: LevelSahnesi | null = null;
  let gecisSuruyor = false;

  /**
   * ISINLANMA (ileride kullanılacak; spec 27'den beri KAPI bunu çağırmaz): ofisi gizleyip ova'yı AYRI kuran eski kapı geçişi.
   * Ofis ova'nın içinde olduğundan şimdilik hiçbir yol bunu tetiklemez; `window.dunya.kapidanGec` hata ayıklama için bağlı.
   */
  async function isinlanmaOvayaCik(): Promise<boolean> {
    if (disari || gecisSuruyor) return false;
    gecisSuruyor = true;
    try {
      const tanim: unknown = await (await fetch(ovaAdresi)).json();
      disari = await levelSahnesiKur({ sahne, tanim, ad: "ova", oda, kamera: rig.kamera, golgeAtanlar: [oyuncu.govde] });
      const yer = disari.yer;
      // Orion, Ozyn'le AYNI yerdeyse beraber çıkar (Ozyn'in kararı, 2026-10-11); kendi başına başka yerdeyse kalır (C6).
      const orionGelir = yerler.orion === yerler.ozyn;
      yerler.ozyn = yer;
      if (orionGelir) yerler.orion = yer;
      const v = disari.gecit ? gecitVarisi(disari.gecit, yer.yukseklik) : { konum: { x: 0, y: 0, z: 0 }, yaw: 0 };
      oyuncu.isinla(v.konum.x, v.konum.z, v.yaw);
      // Orion Ozyn'in yanında belirir: önce sağı, kapalıysa solu, o da kapalıysa önü.
      const sag = { x: Math.cos(v.yaw), z: -Math.sin(v.yaw) }, ileri = { x: Math.sin(v.yaw), z: Math.cos(v.yaw) };
      const adaylar = [1.2, -1.2].map((k) => ({ x: v.konum.x + sag.x * k, z: v.konum.z + sag.z * k }))
        .concat([{ x: v.konum.x + ileri.x * 1.4, z: v.konum.z + ileri.z * 1.4 }]);
      const o = adaylar.find((p) => !carpisiyorMu(p.x, p.z, 0.4, yer)) ?? adaylar[0]!;
      if (orionGelir) d.orion()?.isinla(o.x, o.z, v.yaw);
      orionGorunurlugu();
      d.ortamBaglantisi().ova(disari.level);
      // Kaydedilmiş ortam komutları taze ova'nın ÜSTÜNE oynatılır (dosya değişse bile günlük bozulmaz).
      const oynat = d.ortamBaglantisi().oynat(d.ortamGunlugu().komutlar());
      if (oynat.uygulanan || oynat.atlanan.length) console.log(`[ORTAM] günlük oynatıldı (${d.ortamGunlugu().kip}): ${oynat.uygulanan} komut${oynat.atlanan.length ? `, atlanan: ${oynat.atlanan.join(" | ")}` : ""}`);
      d.stilPenceresi()?.ova(disari.level);   // oynatmadan SONRA: düğmeler hatırlanan duruma göre çizilsin
      gunluk.ekle("bilgi", "yer", `ovaya çıkıldı (${disari.kurulumMs} ms)`);
      console.log(`[YER] ova kuruldu ${disari.kurulumMs} ms · engel ${yer.engeller.length} · nesne ${yer.nesneler.length} · çapa ${yer.capalar.map((c) => c.ad).join(",")}`);
      return true;
    } catch (err) {
      console.error("[YER] ovaya çıkılamadı:", err);
      altyaziGoster("dışarı çıkılamadı — oda yerinde");
      return false;
    } finally {
      gecisSuruyor = false;
    }
  }

  function isinlanmaOdayaDon(): boolean {
    if (!disari || gecisSuruyor) return false;
    const orionGelir = yerler.orion === yerler.ozyn;
    // Sahne yıkılır, ova yeri (saf veri) kalır: Orion dışarıda kaldıysa orada yürümeye devam eder (C6).
    d.stilPenceresi()?.ova(null);
    d.ortamBaglantisi().ova(null);
    disari.yokEt();
    disari = null;
    yerler.ozyn = ODA_YERI;
    if (orionGelir) yerler.orion = ODA_YERI;
    // Kapının içinde, odaya dönük (çapa `kapi`nın durağı); Orion yanında.
    const kapi = capaBul("kapi")!;
    oyuncu.isinla(kapi.durak.x, kapi.durak.z, Math.PI);
    if (orionGelir) d.orion()?.isinla(kapi.durak.x - 1.0, kapi.durak.z - 0.4, Math.PI);
    orionGorunurlugu();
    gunluk.ekle("bilgi", "yer", "ofise dönüldü");
    console.log("[YER] ofise dönüldü");
    return true;
  }

  /**
   * BİRLEŞİK DÜNYA (spec 27): ofis ova'nın İÇİNDE, tek sahne, tek level, tek `Yer`; kapı gerçek bir kapı (kendiliğinden açılır).
   * `ovayaCik` artık "dünyanın hazır olmasını bekle" demektir (senaryolar ve `dunya.ovayaCik` aynı sözleşmeyle çalışır);
   * `odayaDon` yok (ofisten ayrılınmıyor) ve false döner.
   */
  let birlesik: BirlesikDunya | null = null;
  /** Birleşik dünyanın GÜNCEL yeri: açılışta `b.yer`; asset yerleştirme yeniden ölçtükçe değişir (`birlesikYeriniYenile`). */
  let birlesikYer: Yer | null = null;
  let birlesikBitti!: () => void;
  const birlesikHazir = new Promise<void>((r) => { birlesikBitti = r; });
  async function ovayaCik(): Promise<boolean> { await birlesikHazir; return birlesik !== null; }
  function odayaDon(): boolean { return false; }

  /** Orion'un bedeni yalnız Ozyn'le aynı yerdeyse görünür (başka yerin koordinatında hayalet olmasın). */
  function orionGorunurlugu(): void { d.orion()?.gorunur(yerler.orion === yerler.ozyn); }

  // ── KAPIDAN GEÇİŞ: kısa kararma (Ozyn'in kararı) ──
  // Kararma, ovanın kurulumunu (~1 sn, tik takılır) ve kameranın ışınlanmasını örter. Süre CSS geçişiyle aynı.
  const KARARMA_MS = 320;
  const kararma = document.createElement("div");
  kararma.id = "kararma";
  Object.assign(kararma.style, {
    position: "fixed", inset: "0", background: "#000", opacity: "0", pointerEvents: "none", zIndex: "60",
    transition: `opacity ${KARARMA_MS}ms ease`,
  });
  document.body.append(kararma);
  let kapiGecisi = false;

  /** Kapıdan geç: odadaysa ovaya, ovadaysa ofise. Kararma → geçiş → sahne hazır → aydınlanma. */
  async function kapidanGec(): Promise<boolean> {
    if (kapiGecisi) return false;
    kapiGecisi = true;
    try {
      kararma.style.opacity = "1";
      await new Promise((r) => setTimeout(r, KARARMA_MS + 30));
      const oldu = disari ? isinlanmaOdayaDon() : await isinlanmaOvayaCik();
      await sahne.whenReadyAsync();
      // İki kare: ilk kare yeni yerin gölge haritasını ve kamerayı oturtur.
      await new Promise<void>((r) => { let n = 0; const g = sahne.onAfterRenderObservable.add(() => { if (++n >= 2) { sahne.onAfterRenderObservable.remove(g); r(); } }); });
      return oldu;
    } finally {
      kararma.style.opacity = "0";
      kapiGecisi = false;
    }
  }

  // ── BİRLEŞİK DÜNYA AÇILIŞI (spec 27) ───────────────────────────────────────
  // Ofis ova'nın içinde: açılışta ova level'ı ofisin yanına kurulur (kapıda değil). Hazır olunca tek `Yer` herkese verilir, ortam aracı
  // ve G penceresi bağlanır. Kurulamazsa (hata) ofis tek başına yaşar: sessiz değil, konsola yazılır.
  function birlesikDunyayiAc(): void {
    void (async () => {
      try {
        await oda.hazir;
        const tanim: unknown = await (await fetch(ovaAdresi)).json();
        const orionKok = () => sahne.getTransformNodeByName("orion_vrm_kok") ?? sahne.getTransformNodeByName("orion_kok");
        const b = await birlesikDunyaKur({
          sahne, tanim, oda, kamera: rig.kamera, golgeAtanlar: [oyuncu.govde], ufuk: ufukAcikMi(location.search),
          gi: giAcikMi(location.search),
          aktorler: () => {
            const o = oyuncu.oyuncuDurumu().konum;
            const liste: { meshler: AbstractMesh[]; x: number; z: number }[] = [{ meshler: [oyuncu.govde], x: o.x, z: o.z }];
            const ok = orionKok(), od = d.orion()?.durum();
            if (ok && od) liste.push({ meshler: ok.getChildMeshes(false), x: od.konum.x, z: od.konum.z });
            for (const ek of d.ekAktorler?.() ?? []) liste.push(ek);
            return liste;
          },
        });
        birlesik = b;
        birlesikYer = b.yer;
        yerler.ozyn = b.yer;
        yerler.orion = b.yer;
        d.ortamBaglantisi().ova(b.level);
        // Kaydedilmiş ortam komutları taze level'ın ÜSTÜNE oynatılır (dosya değişse bile günlük bozulmaz).
        const oynat = d.ortamBaglantisi().oynat(d.ortamGunlugu().komutlar());
        if (oynat.uygulanan || oynat.atlanan.length) console.log(`[ORTAM] günlük oynatıldı (${d.ortamGunlugu().kip}): ${oynat.uygulanan} komut${oynat.atlanan.length ? `, atlanan: ${oynat.atlanan.join(" | ")}` : ""}`);
        d.stilPenceresi()?.ova(b.level);   // pencere dünyadan sonra kurulduysa orada bağlanır
        gunluk.ekle("bilgi", "yer", `birleşik dünya kuruldu (${b.kurulumMs} ms)`);
        console.log(`[YER] birleşik dünya kuruldu ${b.kurulumMs} ms · engel ${b.yer.engeller.length} · nesne ${b.yer.nesneler.length} · çapa ${b.yer.capalar.length}`);
        try { d.birlesikKuruldu?.(b); } catch (e) { console.error("[YER] birleşik dünya sonrası bağlama hatası:", e); }
      } catch (e) {
        console.error("[YER] birleşik dünya kurulamadı, ofis tek başına:", e);
      } finally {
        birlesikBitti();
      }
    })();
  }

  function birlesikYeriniYenile(yer: Yer): void {
    const eski = birlesikYer;
    if (yerler.ozyn === eski) yerler.ozyn = yer;
    if (yerler.orion === eski) yerler.orion = yer;
    birlesikYer = yer;
  }

  return {
    birlesik: () => birlesik,
    disari: () => disari,
    ovayaCik, odayaDon, kapidanGec, birlesikDunyayiAc, birlesikYeriniYenile,
  };
}
