// uygulama/aktor/calisma/aktorBaglari.ts — HİYERARŞİ BAĞLARI (spec 45 B4/B5): her bağlı aktör KENDİ ara düğümünün (`bag_<id>`) çocuğudur; ara düğüm her karede üstün (ve varsa soketin) dünya matrisini izler.
// Neden doğrudan Babylon ebeveynliği değil: `nesneSistemi` bir düğümü yıkarken ÇOCUKLARINI da yıkar, üstün modeli değişince alt aktörler sessizce silinirdi. Ara düğüm yeni düğümü bulur, çocuk yıkılmaz.
// Çocuğun KENDİ yerel dönüşümüne dokunulmaz: bağ çözülünce kendiliğinden eski yerine döner. Çözülemeyen bağ kodlu uyarıdır (AKT-BAG-011/012/013), durum DEĞİŞİNCE bir kez yazılır.
"use strict";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { BEDEN_ONEKI, bilesenAyari } from "../../../world/level/cekirdek/bilesenKaydi.ts";
import { kodOnekiniSil, kodlu, type AktorKodu } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { ucluOku, type Aktor, type CalismaBaglami } from "./calismaBaglami.ts";

interface Bag { proxy: TransformNode; ust: string; soket: string | null }
interface Uyari { kod: AktorKodu; metin: string; aktor: string }

export interface AktorBaglari {
  /** İstenen bağlarla kurulu olanları eşitler: değişeni sök, yeniyi kur (olay: soket.cikarildi / soket.takildi). */
  uzlastir(): void;
  /** Her karede: ara düğümü üstün (soketin) dünya matrisine taşır. */
  izle(): void;
  /** Uyarı kümesini ÖNCEKİ kareyle karşılaştırır: yeni uyarı bir kez yazılır, kaybolan "çözüldü" diye (kare başına tekrar yok). */
  uyariBildir(): void;
  /** Üst aktörün adlı soketinin yerel matrisi; soket bileşeni yoksa null. */
  soketMatrisi(ust: Aktor, ad: string): Matrix | null;
  kurulu(id: string): boolean;
  sayi(): number;
  /** Şu an geçerli (çözülmemiş) uyarılar, kodlu. */
  uyarilar(): string[];
  /** Aktörün şu an geçerli bir bağ uyarısı var mı (ara düğüm var ama üst/soket çözülemedi). */
  cozumsuz(id: string): boolean;
  /** Bütün ara düğümleri söker ve çocukları serbest bırakır (level değişimi, yokEt). */
  birak(): void;
}

type EtkinUst = (a: Aktor) => { ust?: string; soket?: string };
type BedenSoketi = (beden: string, soket: string) => Matrix | null;

export function aktorBaglariKur(b: CalismaBaglami, etkinUst: EtkinUst, bedenSoketi: BedenSoketi | undefined): AktorBaglari {
  const baglar = new Map<string, Bag>();
  let uyarilar = new Map<string, Uyari>();
  let bildirilen = new Map<string, Uyari>();

  const soketMatrisi = (ust: Aktor, ad: string): Matrix | null => {
    const s = ust.bilesenler.find((x) => x.tur === "soket" && bilesenAyari(x)["ad"] === ad);
    if (!s) return null;
    const a = bilesenAyari(s);
    const konum = ucluOku(a["konum"], [0, 0, 0]), d = ucluOku(a["donus"], [0, 0, 0]).map((x) => x * Math.PI / 180);
    return Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(d[1]!, d[0]!, d[2]!), new Vector3(konum[0], konum[1], konum[2]));
  };
  const uyari = (cocuk: string, kod: AktorKodu, metin: string): void => { uyarilar.set(`${cocuk}|${kod}`, { kod, metin: kodlu(kod, `${cocuk}: ${metin}`), aktor: cocuk }); };

  /** Üstün (ve soketin) dünya matrisi; çözülemezse null (neden `uyari` ile kodlu kaydedilir). */
  function kaynakMatrisi(cocuk: string, ust: string, soket: string | null): Matrix | null {
    if (ust.startsWith(BEDEN_ONEKI)) {
      const m = soket ? bedenSoketi?.(ust.slice(BEDEN_ONEKI.length), soket) ?? null : null;
      if (!m) { uyari(cocuk, "AKT-BAG-012", `beden soketi çözülemedi (${ust}${soket ? `/${soket}` : ""})`); return null; }
      return m;
    }
    const u = b.aktorler().get(ust);
    const n = u ? b.dugumu(u) : null;
    if (!u || !n) { uyari(cocuk, "AKT-BAG-011", `üst aktör henüz sahnede yok (${ust})`); return null; }
    const dunya = n.computeWorldMatrix(true);
    if (!soket) return dunya;
    const s = soketMatrisi(u, soket);
    if (!s) { uyari(cocuk, "AKT-BAG-013", `'${ust}' aktöründe '${soket}' soketi yok`); return null; }
    return s.multiply(dunya);
  }

  const ayir = (id: string, bag: Bag): void => {
    const a = b.aktorler().get(id), n = a ? b.dugumu(a) : null;
    if (a && n && n.parent === bag.proxy) n.parent = null;
    bag.proxy.dispose();
  };

  return {
    soketMatrisi,
    kurulu: (id) => baglar.has(id),
    sayi: () => baglar.size,
    uyarilar: () => [...uyarilar.values()].map((u) => u.metin),
    cozumsuz: (id) => [...uyarilar.values()].some((u) => u.aktor === id),

    uyariBildir() {
      for (const [k, v] of uyarilar) if (!bildirilen.has(k)) b.gunluk.uyari("bag", v.kod, kodOnekiniSil(v.metin), v.aktor);
      for (const [k, v] of bildirilen) if (!uyarilar.has(k)) b.gunluk.yaz("iyi", "bag", `çözüldü: ${v.metin}`, { kod: v.kod, aktor: v.aktor, herZaman: true });
      bildirilen = uyarilar;
    },

    uzlastir() {
      uyarilar = new Map();
      const istenen = new Map<string, { ust: string; soket: string | null }>();
      for (const a of b.aktorler().values()) {
        const e = etkinUst(a);
        if (e.ust) istenen.set(a.id, { ust: e.ust, soket: e.soket ?? null });
      }
      for (const [id, bag] of [...baglar]) {
        const i = istenen.get(id);
        if (i && i.ust === bag.ust && i.soket === bag.soket) continue;
        ayir(id, bag);
        baglar.delete(id);
        b.gunluk.yaz("bilgi", "bag", `${id} ${bag.ust}${bag.soket ? `/${bag.soket}` : ""} bağından ayrıldı`, { aktor: id });
        b.olayYolla(bag.ust, "soket.cikarildi", { kim: id, soket: bag.soket ?? "" });
      }
      for (const [id, i] of istenen) {
        if (baglar.has(id)) continue;
        // Ara düğüm çocuğun sahnesinde kurulur; çocuk henüz yüklenmediyse sonraki kare denenir (olay da o zaman).
        const a = b.aktorler().get(id), n = a ? b.dugumu(a) : null;
        if (!n) continue;
        const proxy = new TransformNode(`bag_${id}`, n.getScene());
        proxy.rotationQuaternion = new Quaternion();
        baglar.set(id, { proxy, ...i });
        b.gunluk.yaz("iyi", "bag", `${id} → ${i.ust}${i.soket ? `/${i.soket}` : ""} bağı kuruldu`, { aktor: id });
        b.olayYolla(i.ust, "soket.takildi", { kim: id, soket: i.soket ?? "" });
      }
    },

    izle() {
      for (const [id, bag] of baglar) {
        const a = b.aktorler().get(id), n = a ? b.dugumu(a) : null;
        if (!a || !n) continue;
        const m = kaynakMatrisi(id, bag.ust, bag.soket);
        if (!m) continue;
        m.decompose(bag.proxy.scaling, bag.proxy.rotationQuaternion!, bag.proxy.position);
        if (n.parent !== bag.proxy) n.parent = bag.proxy;
      }
    },

    birak() {
      for (const [id, bag] of baglar) ayir(id, bag);
      baglar.clear();
    },
  };
}
