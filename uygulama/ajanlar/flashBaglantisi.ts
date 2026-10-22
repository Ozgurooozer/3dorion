// uygulama/ajanlar/flashBaglantisi.ts — FLASH'IN DÜNYAYA BAĞLANMASI (spec 33 dilim 3): ikinci beden + Flash köprüsü + ajan kaydı.
//
// giris.ts'in tek-ajan kablolaması (yol.al("orion"), yerler.orion, durum defteri, monitör, şema) SİLİNMEDİ, yeniden yazılmadı:
// Flash buraya PARALEL, ayrı bir kablo olarak kurulur. Orion'dan aldığı tek şey ortak kurallardır (koltuk defteri, Yer, saat).
//   beden    : aynı avatar kodu (`avatarKur`), önek "flash", NPC tanımının rengi;
//   köprü    : flash/flashKur.ts (aynı Kopru, beyinsiz beyin); karar kaydı konsola gitmez (Orion'un dosyası kirlenmesin);
//   sonuç    : bedenin sonucu köprüye (eylem sırası ilerler, hata "Yapamadım: …" olur);
//   konuşma  : altyazı + günlük ("Flash: …"); TTS YOK (Orion'un sesi Orion'undur; Flash'a ses sonra);
//   takip    : Orion'un `Takipci`si, Flash'ın bedeniyle (`avatarAdimi`: Orion'un beden adımının aynısı);
//   ajanda   : boşta bak/jest (mind/ajanda.ts), Orion'dan AYRI tohumla (iki beden aynı ritimde kıpırdamasın).
// Senaryo koşularında (`?sessiz`) ve `?flashsiz` ile KURULMAZ: bütün *dene senaryoları bugünkü tek bedenli dünyayı görür.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { avatarKur, type Avatar } from "../../world/avatar/index.ts";
import type { Saat } from "../../world/engine/tik.ts";
import type { Yer } from "../../world/yer/yer.ts";
import type { GunlukEkrani } from "../../world/surfaces/duvar/gunluk.ts";
import type { Vec3 } from "../../protocol/temel.ts";
import type { OyuncuDurumu } from "../../protocol/algi.ts";
import { kimlik } from "../../protocol/temel.ts";
import { Ajanda, AJANDA_ONEKI } from "../../mind/ajanda.ts";
import { mesgulMu } from "../../mind/benlik.ts";
import type { SeciliNesne } from "../../mind/komutSozlugu.ts";
import { flashKur, type Flash } from "../../flash/flashKur.ts";
import { FLASH } from "../../flash/npcTanimi.ts";
import { Takipci } from "../takip.ts";
import { avatarAdimi } from "../niyetYurutucu.ts";
import { govdeDurumundan, okumaSuresiMs } from "./ajanGovdesi.ts";
import { ajanAlgisiKur } from "./ajanAlgisi.ts";
import type { UretilenOlay } from "../../world/olayUretici.ts";
import type { AjanDefteri } from "./ajanKaydi.ts";
import type { FlashSemaKancasi } from "./flashSemasi.ts";
import type { Koltuklar } from "./koltuklar.ts";

/** Flash'ın doğduğu yer: ofiste, Orion'un (0.9, −1.2) ve Ozyn'in (1.6, 1.9) doğumundan uzak, serbest (bekçi: flashBaglantisi.test.ts). */
export const FLASH_DOGUM = { x: -1.2, z: 0.6 } as const;
/** Ajanda tohumu: Orion 0 kullanır (varsayılan). */
const FLASH_AJANDA_TOHUMU = 7;

export interface FlashBaglantisiGirdisi {
  sahne: Scene;
  saat: Saat;
  vrmYolu: string;
  yer: () => Yer;
  oyuncuKonumu: () => Vec3;
  koltuklar: Koltuklar;
  ajanlar: AjanDefteri;
  altyazi: (metin: string, ms?: number) => void;
  /** Verilirse Flash cevabı ajan satırı olarak yığılır (Orion ile aynı anda konuşursa ezmez); verilmezse düz altyazı ("Flash: …"). */
  altyaziEkle?: (ad: string, metin: string, ms?: number, adHep?: boolean) => void;
  gunluk: Pick<GunlukEkrani, "ekle">;
  secili?: () => SeciliNesne | null;
  sema?: FlashSemaKancasi;
  /** Oyuncunun ham durumu (`oyuncu.oyuncuDurumu()`): Flash'ın "gözü" bunu KENDİ gövdesine göre yeniden hesaplar (ajanAlgisi.ts). Verilmezse Flash dünyayı görmez. */
  oyuncuDurumu?: () => OyuncuDurumu;
}

export interface FlashBaglantisi {
  avatar: Avatar;
  flash: Flash;
  /** Birleşik dünyanın aktör listesi için (ışık üyeliği, kapı): bedenin mesh'leri ve konumu. */
  aktor(): { meshler: AbstractMesh[]; x: number; z: number } | null;
  /**
   * Flash'ın gözünün olay abonesi (spec 35 dilim 2: dinlemedeki grafikler). Gözü yoksa (`oyuncuDurumu` verilmedi) null: o zaman Flash'ın olayları
   * grafiğe açılmaz (sessiz "hiç tetiklenmeyen dinleme" yerine kurulurken nedenli ret).
   */
  olayDinle: ((cb: (o: UretilenOlay) => void) => () => void) | null;
}

export async function flashBaglantisiKur(g: FlashBaglantisiGirdisi): Promise<FlashBaglantisi> {
  const avatar = await avatarKur({
    sahne: g.sahne, saat: g.saat,
    spawn: { x: FLASH_DOGUM.x, y: 0, z: FLASH_DOGUM.z },
    vrmYolu: g.vrmYolu,
    vrmZorla: true,   // Orion'la aynı karar (giris.ts): low-poly beden, yüz sonra
    yer: g.yer,
    oyuncuKonumu: g.oyuncuKonumu,
    ad: FLASH.id, renk: FLASH.renk,
    koltukDolu: (c) => g.koltuklar.dolu(c, FLASH.ad),
  });
  g.koltuklar.kaydet(FLASH.ad, () => avatar.koltugu());

  const takipci = new Takipci({
    orionKonumu: () => avatar.durum().konum,
    ozynKonumu: () => g.oyuncuKonumu(),
    bedenAdimi: (n) => avatarAdimi(avatar, n),
  });
  const flash = flashKur({
    tanim: FLASH,
    beden: () => avatar,
    bedenDurumu: () => { const d = avatar.durum(); return { poz: d.poz, oturuyor: d.oturuyor_mu }; },
    takipDinle: (aktif) => {
      if (aktif) takipci.baslat(); else takipci.birak();
      g.gunluk.ekle("bilgi", "flash", aktif ? "Ozyn'i takip ediyor" : "takip bitti");
    },
    ...(g.secili ? { secili: g.secili } : {}),
    niyetDinle: (n, yon) => { g.sema?.niyet(n, yon); },
  });
  if (g.sema) { const s = g.sema; flash.kararDinle((satir) => s.karar(satir)); }

  avatar.sonucDinle((s) => {
    if (s.durum === "hata") g.gunluk.ekle("uyari", "flash", `${s.niyet_id} başarısız: ${s.not ?? "sebep yok"}`);
    flash.kopru.sonuc(s);
  });
  // Flash'ın sözü: köprünün cevabı da düğüm grafiğinin "Söyle"si de (spec 35) AYNI satırdan çıkar (altyazı + günlük; TTS yok).
  const konus = (m: string): void => {
    if (g.altyaziEkle) g.altyaziEkle(FLASH.ad, m, 3500, true); else g.altyazi(`${FLASH.ad}: ${m}`, 3500);
    g.gunluk.ekle("bilgi", "flash", m);
  };
  flash.kopru.konusmaDinle(konus);

  // Boşta kıpırtı + takip: 20 Hz mantık saatinde (çizimde değil, K1). Meşgul: köprü düşünüyor/yürüyor ya da takip yürüyüşü sürüyor.
  const ajanda = new Ajanda({ tohum: FLASH_AJANDA_TOHUMU });
  // Flash'ın gözü: dünya olayları (Ozyn yaklaştı/uzaklaştı/baktı/yüzeye geçti) KENDİ gövdesine göre köprüsüne gider; tepki NPC tanımından (veri).
  // Tepki niyeti ajanda önekiyle gider: köprü sonucunu sessiz yutar (kıpırtı, uyanış sebebi değil).
  const goz = g.oyuncuDurumu ? ajanAlgisiKur({
    beden: () => avatar, oyuncu: g.oyuncuDurumu, algi: (a) => flash.kopru.algi(a),
    ...(FLASH.tepkiler ? { tepkiler: FLASH.tepkiler } : {}),
    niyet: (n) => { avatar.niyet(n, kimlik(AJANDA_ONEKI)); },
    iz: (ad) => console.log(`[ALGI] flash olay: ${ad}`),
  }) : null;
  g.saat.dinle((t) => {
    takipci.tik();
    goz?.tikle(t * 1000);
    const mesgul = mesgulMu(flash.kopru.benlik.oku()).mesgul || takipci.yuruyor;
    const oneri = ajanda.tikle(t * 1000, mesgul);
    if (oneri) avatar.niyet(oneri, kimlik(AJANDA_ONEKI));
  });
  // Görsel yumuşatma her çizim karesinde (Orion'unki giris.ts'in çizim döngüsünde; Flash'ınki kendi gözlemcisinde, MANTIK YOK).
  g.sahne.onBeforeRenderObservable.add(() => avatar.cizimGuncelle(Math.min(g.sahne.getEngine().getDeltaTime(), 100) / 1000));

  // Grafiğin kapısı (spec 35): niyet bedenin kendisine, sonuç bedenden, söz yukarıdaki satırdan. Ses yok: söz okuma süresi kadar bekletilir ki sonraki düğüm
  // altyazıyı hemen ezmesin (`okumaSuresiMs`, ajanGovdesi.ts).
  g.ajanlar.kaydet({
    id: FLASH.id, ad: FLASH.ad, renk: FLASH.renk, kume: null, hitapAyiklar: true,
    niyet: (n, id) => { avatar.niyet(n, id); }, sonucDinle: (cb) => avatar.sonucDinle(cb),
    soyle: (m) => { konus(m); return new Promise<void>((r) => setTimeout(r, okumaSuresiMs(m))); },
    govde: () => govdeDurumundan(avatar.durum()),
    algi: (a) => flash.kopru.algi(a),
  });
  g.gunluk.ekle("bilgi", "flash", `${FLASH.ad} odada (LLM'siz NPC)`);
  console.log(`[FLASH] beden hazır (${avatar.iskeletBilgisi().tur}), ajan kaydedildi`);

  return {
    avatar, flash,
    olayDinle: goz ? (cb) => goz.olayDinle(cb) : null,
    aktor() {
      const kok = g.sahne.getTransformNodeByName(`${FLASH.id}_vrm_kok`) ?? g.sahne.getTransformNodeByName(`${FLASH.id}_kok`);
      if (!kok) return null;
      const k = avatar.durum().konum;
      return { meshler: kok.getChildMeshes(false), x: k.x, z: k.z };
    },
  };
}
