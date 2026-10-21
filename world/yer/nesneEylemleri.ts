// world/yer/nesneEylemleri.ts — Bir nesneyle YAPILABİLECEKLER (spec 28): etkileşim menüsünün beyni. SAF (Babylon ve DOM yok).
//
// İki yönlü: "Orion yapsın" (Orion'a bir `Niyet` gider, tek eylem yolu `niyetiYurut`) ve "ben yapayım" (Ozyn'in kendi etkileşimi: `F` ile aynı). Her satır
// UYGUN mu ve değilse NEDEN değil: Orion'un yapamadığı eylem sessizce gizlenmez ya da sessizce başarısız olmaz, nedenli gri görünür.
//
// Kaynak: nesnenin eylemleri (level nesnesinin anlamı `eylemler`, çapalı nesnenin çapası `eylemler`, ikisi de yoksa yalnız "bak") ve Orion'un YETENEĞİ: Orion
// yalnız `Capa.oturma` geometrisi tanımlı çapaya oturabilir (sandalye, bank: `world/avatar/yurutucu.ts` `_otur`; spec 28 Faz 4), `yaz` metin ister, `al`/`kullan`
// bu menüden denenmedi. Bunlar listelenir ama gri ve nedenli. Çapasız nesneye (ağaç, kaya) adla gidilemez (avatar yalnız çapa çözer): `nokta` hedefi kullanılır.
"use strict";
import type { Niyet } from "../../protocol/niyet.ts";
import type { Hedef } from "../../protocol/temel.ts";
import type { Nesne } from "../level/nesneKaydi.ts";
import { capaBul, mesafeXZ, type Capa } from "../level/capalar.ts";
import { ETKILESIM_MENZILI } from "../player/etkilesim.ts";

export type EylemKimi = "orion" | "ozyn";

export interface NesneEylemi {
  /** Kararlı kimlik: "orion.git", "ozyn.otur". */
  kimlik: string;
  /** Düğme yazısı. */
  ad: string;
  kim: EylemKimi;
  /** Orion için: gönderilecek niyet. */
  niyet?: Niyet;
  /** Ozyn için: başlatılacak etkileşim. */
  etkilesim?: { capa: string; eylem: string };
  uygun: boolean;
  /** `uygun` false ise nedeni (düğmede görünür). */
  neden?: string;
  /** Orion eylemi gri ise Orion'un SÖZLE söyleyeceği tek cümle (birinci ağız; "buraya otur" sözü seçiliyken bunu söyler). */
  soz?: string;
}

export interface EylemBaglami {
  capalar: readonly Capa[];
  /** Ozyn'in konumu (XZ): "ben yapayım" yakınlık denetimi. */
  oyuncu: { x: number; z: number };
}

/** "Ben yapayım" listesine girmeyen çapa eylemleri: bakmak menüde ayrı, kalk/geç anlık durumlar. */
const OZYN_ATLANAN: ReadonlySet<string> = new Set(["bak", "kalk", "gec"]);

const ETIKET: Readonly<Record<string, string>> = { otur: "Otur", odaklan: "Odaklan", yaz: "Yaz", al: "Al", kullan: "Kullan" };

/** Nesnenin eylem listesi: level nesnesi anlamından, çapalı nesne çapasından, yoksa yalnız bak. */
function eylemlerOf(n: Nesne, capa: Capa | null): readonly string[] {
  const l = (n as Nesne & { eylemler?: readonly string[] }).eylemler;
  if (Array.isArray(l)) return l;
  return capa ? capa.eylemler : ["bak"];
}

/**
 * Bir nesneye GİTMEK ve BAKMAK için niyetler. Çapa varsa çapa (durağına gider, yönüne döner); yoksa nesnenin noktası (avatar adla yalnız çapa çözer) ve
 * kutusunun yarıçapı + 0.8 m uzakta durur. Etkileşim menüsü ve düğüm grafiği (spec 35 "Git/Bak: nesne", `uygulama/graf/ajanDugumleri.ts`) AYNI kuralı
 * kullanır: biri değişip öteki eski kalmasın diye tek yerde.
 */
export function nesneHedefleri(n: Nesne, capalar: readonly Capa[]): { git: Extract<Niyet, { tur: "git" }>; bak: Extract<Niyet, { tur: "bak" }> } {
  const capa = n.capa ? capaBul(n.capa, capalar) : null;
  const k = n.kutu;
  const yaricap = Math.max(k.g, k.d) / 2;
  const hedefGit: Hedef = capa ? { tip: "capa", ad: capa.ad } : { tip: "nokta", x: k.x, y: 0, z: k.z };
  const hedefBak: Hedef = capa ? { tip: "capa", ad: capa.ad } : { tip: "nokta", x: k.x, y: k.y, z: k.z };
  return {
    git: capa ? { tur: "git", hedef: hedefGit } : { tur: "git", hedef: hedefGit, mesafe: yaricap + 0.8 },
    bak: { tur: "bak", hedef: hedefBak },
  };
}

export function nesneEylemleri(n: Nesne, b: EylemBaglami): NesneEylemi[] {
  const capa = n.capa ? capaBul(n.capa, b.capalar) : null;
  const eylemler = eylemlerOf(n, capa);
  const cikti: NesneEylemi[] = [];

  // Orion'un yürüyüp bakacağı hedef: `nesneHedefleri` (grafik de aynısını kullanır).
  const hedef = nesneHedefleri(n, b.capalar);
  cikti.push({ kimlik: "orion.git", ad: "Yanına git", kim: "orion", uygun: true, niyet: hedef.git });
  cikti.push({ kimlik: "orion.bak", ad: "Ona bak", kim: "orion", uygun: true, niyet: hedef.bak });

  if (capa && eylemler.includes("odaklan")) {
    cikti.push({ kimlik: "orion.odaklan", ad: "Odaklan", kim: "orion", uygun: true, niyet: { tur: "odaklan", capa: capa.ad } });
  }
  if (capa && eylemler.includes("otur")) {
    const uygun = capa.oturma !== undefined;   // Orion yalnız oturma geometrisi tanımlı çapaya oturur (sandalye, bank; spec 28 Faz 4)
    cikti.push({ kimlik: "orion.otur", ad: "Otur", kim: "orion", uygun, niyet: { tur: "otur", capa: capa.ad },
      ...(uygun ? {} : { neden: "Orion bu çapaya oturamaz (oturma geometrisi tanımlı değil)", soz: "Buraya oturamıyorum." }) });
  }
  if (eylemler.includes("yaz")) {
    cikti.push({ kimlik: "orion.yaz", ad: "Yaz…", kim: "orion", uygun: false, neden: "yazılacak metin ister (sonraki sürüm)", soz: "Ne yazacağımı söylemedin." });
  }
  // Çapasız (level) nesnenin `al`/`kullan` eylemleri: listelenir ama gri. (Çapalı nesnede Orion'un karşılığı `odaklan`.)
  if (!capa) {
    for (const e of ["al", "kullan"]) {
      if (eylemler.includes(e)) cikti.push({ kimlik: `orion.${e}`, ad: ETIKET[e]!, kim: "orion", uygun: false, neden: "Orion bu eylemi menüden henüz yapamıyor", soz: "Bunu henüz yapamıyorum." });
    }
  }

  if (capa) {
    const uzaklik = mesafeXZ(b.oyuncu, capa.konum);
    for (const e of capa.eylemler) {
      if (OZYN_ATLANAN.has(e)) continue;
      const yakin = uzaklik <= ETKILESIM_MENZILI;
      cikti.push({ kimlik: `ozyn.${e}`, ad: ETIKET[e] ?? e, kim: "ozyn", uygun: yakin, etkilesim: { capa: capa.ad, eylem: e },
        ...(yakin ? {} : { neden: `yaklaş (${ETKILESIM_MENZILI} m içinde olmalısın, şimdi ${uzaklik.toFixed(1)} m)` }) });
    }
  }
  return cikti;
}
