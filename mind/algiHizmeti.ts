// mind/algiHizmeti.ts — Orion'un odayı SORARAK görmesi.
//
// SORU: "Orion odayı görebiliyor mu? Sensör mü tasarlasak, yoksa haritayı anlık
// okuyup veri ileten ara bir adaptör mü?"
//
// CEVAP — ara adaptör, ama görüş kısıtı GERÇEK:
//
//   Sensör simülasyonu (sahte göz, derinlik haritası, görüntü işleme) israf
//   olurdu: veri zaten bellekte duruyor. Bir "göz" yazıp onu yeniden keşfetmek,
//   bildiğimiz şeyi unutup tekrar öğrenmektir.
//
//   Ama düz veri dökümü de yanlış: o zaman Orion duvarın arkasını, kapalı
//   kapının ötesini, arkasındaki tahtayı "görür". Varlığın inandırıcılığı
//   tam burada kırılır — odada olduğunu iddia eden ama fizik tanımayan bir şey.
//
// Bu yüzden: veri doğrudan haritadan okunur (ucuz), ama her nesne GÖRÜŞ
// TESTİNDEN geçer (ışın, `world/player/isinTarama.ts`). Böylece Orion'un
// bildiği şey, bulunduğu yerden gerçekten görülebilen şeydir.
//
// BÜTÇE: her sorunun bir tavanı var. Sınırsız sorgu, bağlamı doldurup asıl
// işi (terminali izlemek) bastırır. Sorgu sonucu tavanı aşarsa KIRPILIR ve
// kırpıldığı SÖYLENİR — sessiz eksiltme, yanlış bilgiden beterdir.
//
// SAF: Babylon yok, dünya nesnesi yok. Her şey enjekte edilir; testlenebilir.
"use strict";
import type { CapaAdi, Vec3 } from "../protocol/temel.ts";
import { BEDEN } from "../protocol/bedenTanimi.ts";

/** Sorulabilecek şeyler. Protokoldeki `sor.ne` ile birebir eşleşir. */
export type Soru = "dunya" | "yakin" | "oyuncu" | "onumde";

/** Hizmetin dünyadan istediği her şey. Dünya tipi BİLİNMEZ. */
export interface DunyaGorusu {
  /** Orion'un ayak konumu. */
  konum: Vec3;
  /** Orion'un baktığı birim yön (XZ düzleminde yeterli). */
  bakis: Vec3;
  /** Orion'un göz yüksekliği — ışın oradan atılır. */
  gozYuksekligi: number;
  /** Odadaki adlandırılmış yerler. */
  capalar: readonly { ad: CapaAdi; konum: Vec3; etiket: string }[];
  /** Ozyn nerede. */
  oyuncu: Vec3;
  /**
   * Görüş testi: `kaynak`tan `hedef`e engelsiz bakılabiliyor mu?
   * Enjekte edilir ki hizmet ışın kütüphanesine bağlanmasın ve test edilsin.
   */
  gorunurMu(kaynak: Vec3, hedef: Vec3): boolean;
}

export interface Cevap {
  /** Beyne verilecek metin. Zaten bütçeye göre kırpılmıştır. */
  metin: string;
  /** Kaç karakter — ölçüm ve panel için. */
  maliyet: number;
  /** Bütçe yüzünden bir şey düştü mü. */
  kirpildi: boolean;
}

/**
 * Soru başına karakter tavanı.
 *
 * "yakin" en dar: sık sorulacak ve her turda bağlama girebilir. "oda" en
 * geniş ama yine de sınırlı — oda dökümü bir paragrafı geçerse Orion'un
 * asıl işi (ekranı izlemek) bağlamda geri plana düşer.
 */
export const BUTCE: Record<Soru, number> = {
  yakin: 160,
  onumde: 90,
  oyuncu: 110,
  dunya: 300,
};

/**
 * Bakış konisinin yarı açısı (radyan). ~40° — insan odak alanına yakın.
 *
 * Künyeden gelir (`protocol/bedenTanimi.ts`): göz gövdenin bir parçası, ama
 * `mind/` ile `world/` birbirini import edemez (K4). Ortak künye ikisinin de
 * bağlı olduğu `protocol/` altında durur — donanımda da datasheet ortak belgedir.
 */
const KONI_YARIM = BEDEN.duyu.koniYarim;

/** XZ düzleminde mesafe. Y yok sayılır: kat farkı olmayan tek odalı dünya. */
function mesafeXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Hedef bakış konisinin içinde mi? */
function konideMi(konum: Vec3, bakis: Vec3, hedef: Vec3): boolean {
  const dx = hedef.x - konum.x, dz = hedef.z - konum.z;
  const u = Math.hypot(dx, dz);
  if (u < 1e-6) return true;
  const bu = Math.hypot(bakis.x, bakis.z) || 1e-6;
  // Nokta çarpımı → aradaki açının kosinüsü.
  const kos = (dx * bakis.x + dz * bakis.z) / (u * bu);
  return Math.acos(Math.max(-1, Math.min(1, kos))) <= KONI_YARIM;
}

/** Mesafeyi insan diline çevirir — Orion "2.34 m" demez, "hemen yanında" der. */
export function mesafeSozu(m: number): string {
  if (m < 1.2) return "hemen yanında";
  if (m < 2.5) return "birkaç adım ötede";
  if (m < 4.5) return "odanın öbür ucunda değil";
  return "uzakta";
}

/** Bütçeye sığdır; kesildiyse bunu SÖYLE — sessiz eksiltme yapma. */
function butceyeSigdir(parcalar: string[], tavan: number): { metin: string; kirpildi: boolean } {
  const tam = parcalar.join(", ");
  if (tam.length <= tavan) return { metin: tam, kirpildi: false };

  const alinan: string[] = [];
  let uzunluk = 0;
  for (const p of parcalar) {
    // +2: ", " ayracı. Son ekin ("… ve dahası") yeri de bırakılır.
    if (uzunluk + p.length + 2 > tavan - 12) break;
    alinan.push(p);
    uzunluk += p.length + 2;
  }
  const dusen = parcalar.length - alinan.length;
  return {
    metin: alinan.length
      ? `${alinan.join(", ")} (+${dusen} tane daha)`
      : `${parcalar.length} şey var ama sığmadı`,
    kirpildi: true,
  };
}

/**
 * Soruyu yanıtlar. Yan etkisiz: dünyayı okur, değiştirmez.
 *
 * Görüş testi her nesne için ayrı çağrılır. Maliyeti düşük (AABB ışını) ve
 * soru sıklığı beynin turu kadar — yani saniyede birkaç kez değil.
 */
export function sorguYanitla(soru: Soru, d: DunyaGorusu): Cevap {
  const goz: Vec3 = { x: d.konum.x, y: d.konum.y + d.gozYuksekligi, z: d.konum.z };
  const tavan = BUTCE[soru];

  const gorunur = d.capalar.filter((c) => d.gorunurMu(goz, c.konum));

  let parcalar: string[];
  switch (soru) {
    case "onumde": {
      // Yalnızca bakış konisindeki EN YAKIN şey. "Ne görüyorsun" sorusunun
      // dürüst cevabı bir liste değil, tek bir şeydir.
      const koni = gorunur
        .filter((c) => konideMi(d.konum, d.bakis, c.konum))
        .sort((a, b) => mesafeXZ(d.konum, a.konum) - mesafeXZ(d.konum, b.konum));
      const oyuncuKonide = d.gorunurMu(goz, d.oyuncu) && konideMi(d.konum, d.bakis, d.oyuncu);
      const oyuncuM = mesafeXZ(d.konum, d.oyuncu);
      const enYakin = koni[0];
      // Ozyn bir eşyadan daha yakınsa önce o söylenir: insan eşyadan önemlidir.
      if (oyuncuKonide && (!enYakin || oyuncuM < mesafeXZ(d.konum, enYakin.konum))) {
        parcalar = [`Ozyn (${mesafeSozu(oyuncuM)})`];
      } else if (enYakin) {
        parcalar = [`${enYakin.etiket} (${mesafeSozu(mesafeXZ(d.konum, enYakin.konum))})`];
      } else {
        parcalar = ["önünde belirgin bir şey yok"];
      }
      break;
    }

    case "yakin": {
      parcalar = gorunur
        .map((c) => ({ c, m: mesafeXZ(d.konum, c.konum) }))
        // Menzil künyeden. `mesafeSozu`daki 2.5 ile aynı sayı olması TESADÜF:
        // orası bir söz merdiveni (1.2 / 2.5 / 4.5), burası duyunun menzili.
        // İkisi ayrı şeyler, bilerek birbirine bağlanmadı.
        .filter((x) => x.m <= BEDEN.duyu.yakinMenzil)
        .sort((a, b) => a.m - b.m)
        .map((x) => `${x.c.etiket} (${mesafeSozu(x.m)})`);
      if (parcalar.length === 0) parcalar = ["yakınında bir şey yok"];
      break;
    }

    case "oyuncu": {
      const m = mesafeXZ(d.konum, d.oyuncu);
      if (!d.gorunurMu(goz, d.oyuncu)) {
        parcalar = ["Ozyn'i göremiyorsun (arada bir engel var)"];
      } else {
        // Ozyn hangi eşyanın yanında? Konum sayısı değil, mekân anlamı verilir.
        const yakin = d.capalar
          .map((c) => ({ c, m: mesafeXZ(d.oyuncu, c.konum) }))
          .filter((x) => x.m <= 1.6)
          .sort((a, b) => a.m - b.m)[0];
        parcalar = [yakin
          ? `Ozyn ${yakin.c.etiket} başında, senden ${mesafeSozu(m)}`
          : `Ozyn senden ${mesafeSozu(m)}`];
      }
      break;
    }

    case "dunya":
    default: {
      // Odanın tamamı — ama yine yalnızca GÖRÜLEBİLENLER.
      parcalar = gorunur
        .map((c) => ({ c, m: mesafeXZ(d.konum, c.konum) }))
        .sort((a, b) => a.m - b.m)
        .map((x) => x.c.etiket);
      const gizli = d.capalar.length - gorunur.length;
      if (gizli > 0) parcalar.push(`(${gizli} şey buradan görünmüyor)`);
      if (gorunur.length === 0) parcalar = ["buradan hiçbir şey görünmüyor"];
      break;
    }
  }

  const { metin, kirpildi } = butceyeSigdir(parcalar, tavan);
  return { metin, maliyet: metin.length, kirpildi };
}
