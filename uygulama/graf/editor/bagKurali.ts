// uygulama/graf/editor/bagKurali.ts — EDİTÖRDE BAĞ ÇEKME KURALI (spec 35 dilim 2b): pinden pine sürüklenen bağ kabul mü, değilse NEDEN. SAF.
//
// KOPYA KURAL YOK: tür uyumu, tek-bağ ucu ve döngü denetimi `grafTurDenetimi.ts`ten gelir (`uyumlu`, `tekBagUcu`, `donguVarMi`) — "Kontrol et" ile
// editör aynı kuralı söyler (bekçi: bagKurali.test.ts her tür çiftinde ikisini karşılaştırır). Editörün EKİ yalnız kullanım kolaylığıdır:
//   • yön serbest: girişten çıkışa sürüklemek de olur (uçlar çevrilir);
//   • tek-bağ kuralı çiğnenmez, ESKİ BAĞ DEĞİŞTİRİLİR (Blueprint gibi): bir veri girişine yeni bağ eskisini, bir akış çıkışından yeni bağ eskisini atar
//     — değişen bağ çağırana döner ki kullanıcıya "eski bağ kaldırıldı" denebilsin (sessiz kayıp yok);
//   • döngü kuracak bağ çekilirken reddedilir (denetim zaten reddederdi; çekerken söylemek daha anlaşılır).
"use strict";
import type { Graf, GrafBagi, PinTipi } from "../../../protocol/graf.ts";
import { donguVarMi, tekBagUcu, uyumlu, type CozulmusDugum } from "../grafTurDenetimi.ts";
import type { PinYonu } from "./dugumGeometrisi.ts";

export interface PinRef { dugum: string; pin: string; yon: PinYonu }

export type BagDenemesi =
  | { ok: true; bag: GrafBagi; degisen: GrafBagi[] }
  | { ok: false; neden: string };

/** Pin türünün Türkçe adı (mesajlar ve ipuçları). */
export const PIN_TIP_ADI: Readonly<Record<PinTipi, string>> = {
  akis: "akış", nesne: "nesne", ajan: "ajan", konum: "konum", sayi: "sayı", metin: "metin", bool: "doğru/yanlış", herhangi: "herhangi",
};

const ayni = (a: GrafBagi, b: GrafBagi) => a.kaynak[0] === b.kaynak[0] && a.kaynak[1] === b.kaynak[1] && a.hedef[0] === b.hedef[0] && a.hedef[1] === b.hedef[1];

function pinTipi(cozum: ReadonlyMap<string, CozulmusDugum>, r: PinRef): PinTipi | null {
  const c = cozum.get(r.dugum);
  return (r.yon === "giris" ? c?.pinler.girisler : c?.pinler.cikislar)?.find((p) => p.ad === r.pin)?.tip ?? null;
}

/** Bağın türü (kaynak pinin türü); uçlar çözülemezse null. */
export function bagTipi(cozum: ReadonlyMap<string, CozulmusDugum>, b: GrafBagi): PinTipi | null {
  return pinTipi(cozum, { dugum: b.kaynak[0], pin: b.kaynak[1], yon: "cikis" });
}

/** Döngü olur mu: bağlar (yeni bağ dahil) aynı türden (akış ya da veri) kenarlarla. */
function donguKurar(g: Graf, cozum: ReadonlyMap<string, CozulmusDugum>, baglar: readonly GrafBagi[], akis: boolean): string | null {
  const kenar = new Map<string, string[]>();
  for (const b of baglar) {
    const t = bagTipi(cozum, b);
    if (t === null || (t === "akis") !== akis) continue;
    // Denetimle AYNI yön: akış kaynaktan hedefe, veri hedeften kaynağa (grafTurDenetimi.ts).
    const [a, z] = akis ? [b.kaynak[0], b.hedef[0]] : [b.hedef[0], b.kaynak[0]];
    (kenar.get(a) ?? kenar.set(a, []).get(a)!).push(z);
  }
  return donguVarMi(g.dugumler.map((d) => d.id), kenar);
}

/**
 * İki pin arasında bağ dene. `cozum` grafiğin çözülmüş düğümleri (`dugumleriCozYapili`). Kabulse yeni bağ ve tek-bağ kuralı yüzünden DEĞİŞEN eski bağlar
 * (grafikten çıkarılacaklar) döner; değilse kısa, nedenli Türkçe mesaj.
 */
export function bagDenetle(g: Graf, cozum: ReadonlyMap<string, CozulmusDugum>, u1: PinRef, u2: PinRef): BagDenemesi {
  if (u1.dugum === u2.dugum) return { ok: false, neden: "düğüm kendi pinine bağlanamaz" };
  if (u1.yon === u2.yon) return { ok: false, neden: u1.yon === "giris" ? "iki giriş birbirine bağlanamaz (bir çıkıştan girişe çek)" : "iki çıkış birbirine bağlanamaz (bir çıkıştan girişe çek)" };
  const [k, h] = u1.yon === "cikis" ? [u1, u2] : [u2, u1];
  const kt = pinTipi(cozum, k), ht = pinTipi(cozum, h);
  if (kt === null) return { ok: false, neden: `'${k.dugum}.${k.pin}' çıkışı yok (düğüm çözülemedi ya da pin kalktı)` };
  if (ht === null) return { ok: false, neden: `'${h.dugum}.${h.pin}' girişi yok (düğüm çözülemedi ya da pin kalktı)` };
  if (!uyumlu(kt, ht)) {
    const ipucu = kt === "akis" || ht === "akis" ? " — akış (beyaz) yalnız akışla bağlanır" : "";
    return { ok: false, neden: `tür uyuşmuyor: ${PIN_TIP_ADI[kt]} → ${PIN_TIP_ADI[ht]}${ipucu}` };
  }
  const bag: GrafBagi = { kaynak: [k.dugum, k.pin], hedef: [h.dugum, h.pin] };
  if (g.baglar.some((b) => ayni(b, bag))) return { ok: false, neden: "bu bağ zaten var" };
  const uc = tekBagUcu(kt);
  const degisen = g.baglar.filter((b) => (uc === "kaynak"
    ? b.kaynak[0] === bag.kaynak[0] && b.kaynak[1] === bag.kaynak[1]
    : b.hedef[0] === bag.hedef[0] && b.hedef[1] === bag.hedef[1]));
  const sonraki = [...g.baglar.filter((b) => !degisen.some((d) => ayni(d, b))), bag];
  const dongu = donguKurar(g, cozum, sonraki, kt === "akis");
  if (dongu) return { ok: false, neden: kt === "akis" ? `akış döngüsü olur ('${dongu}' üzerinden): tekrar için Tekrar düğümü` : `veri döngüsü olur ('${dongu}' üzerinden)` };
  return { ok: true, bag, degisen };
}

/** Düğümün bu pine bağlanabilecek İLK pini (palette'ten eklenen düğüm sürüklenen bağa kendiliğinden takılsın). Akışta "giris"/"sonra" önce. */
export function uyumluIlkPin(pinler: { girisler: readonly { ad: string; tip: PinTipi }[]; cikislar: readonly { ad: string; tip: PinTipi }[] }, kaynak: { yon: PinYonu; tip: PinTipi }): string | null {
  // Sürüklenen bir ÇIKIŞsa yeni düğümün GİRİŞİ aranır, tersi de.
  const aday = kaynak.yon === "cikis" ? pinler.girisler : pinler.cikislar;
  const uygun = aday.filter((p) => (kaynak.yon === "cikis" ? uyumlu(kaynak.tip, p.tip) : uyumlu(p.tip, kaynak.tip)));
  // Önce aynı tür (herhangi'ye düşmeden önce tam eşleşme), sonra herhangi.
  return (uygun.find((p) => p.tip === kaynak.tip) ?? uygun[0])?.ad ?? null;
}
