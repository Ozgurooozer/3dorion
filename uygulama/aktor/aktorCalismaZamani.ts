// uygulama/aktor/aktorCalismaZamani.ts — AKTÖR ÇALIŞMA ZAMANI (spec 45 B4; Unreal'da bileşenlerin tick'i): BESTECİ. Aktör tablosunu, hiyerarşi ezmesini ve kare aşamalarını yönetir;
// işi yöneticilere böler: bağlar `aktorBaglari.ts`, hareket `aktorHareketi.ts`, tetik `aktorTetikleri.ts` (ortak yüz `calismaBaglami.ts`). Kuralların kendisi saf modellerde
// (`tetikModeli.ts`, `hareketModeli.ts`, `hiyerarsiEzmesi.ts`) ve olay yolunda (`aktorOlayYolu.ts`).
//
// Her karede (`kare(dt)`): olay yolunun kare sayacı sıfırlanır → hareket bileşenleri ilerler → hiyerarşi bağları (üst/soket) izlenir → tetik bileşenleri sınanır, olaylar yayınlanır.
//
// HİYERARŞİ: `ust` varken aktörün `konum`/`donus`/`olcek`'i üste göre YEREL'dir (Unreal "relative"). Babylon ebeveynliği DOĞRUDAN kullanılmaz (neden: `aktorBaglari.ts` başlığı):
// her bağlı aktör KENDİ ara düğümünün (`bag_<id>`) çocuğudur. Soket = üst aktörün `soket` bileşeni (yerel konum/dönüş) ya da `beden:<ad>` için bedenin kemik düğümünün dünya matrisi (`bedenSoketi`; B5).
//
// ÇALIŞMA ZAMANI DURUMU: `soketeTak/sokettanAl` ve `hareketEt` level tanımına/diske YAZMAZ; bellekte durur, level yeniden kurulunca (geçişte) gider. Graf alan/değişken yazması gibi
// "çalışma bitince geri alınan" değildir (kılıcı alan graf bitince kılıç elden düşmez); kalıcı olan yalnız Details'teki `ust`/`soket`/`bilesenler`.
// GÜNLÜK VE BAYRAKLAR (`aktorGunlugu.ts`): çözülemeyen bağ gibi DURUM DEĞİŞİKLİKLERİ kodlu uyarı olarak bir kez yazılır (kare başına değil), düzelince "çözüldü"; olay yolu reddi,
// kare aşaması istisnası (aşama başına yalıtılır: biri patlarsa öteki aşamalar sürer) kodlu hata olarak. Ayrıntılı iz (bağ/tetik/hareket/düğüm) bayrakla açılır; `tetik`/`hareket`/`bag`
// bileşen bayrakla KAPATILABİLİR (hata kaynağını ayırmak için). `hataAyiklama()` bütün canlı durumun dökümünü verir.
// TANIM OKUMA: `level.tanim()` kopya döner (büyük level'da pahalı) → aktör listesi 0.25 sn'de bir ve nesne yüklenince yenilenir; kare başına tanım kopyalanmaz.
"use strict";
import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Node } from "@babylonjs/core/node";
import type { Level } from "../../world/level/cekirdek/levelKur.ts";
import type { AktorOlayYolu, AktorOlayYoluAyari } from "../../world/level/cekirdek/aktorOlayYolu.ts";
import { BEDEN_ONEKI } from "../../world/level/cekirdek/bilesenKaydi.ts";
import type { Gozlenen } from "./tetikModeli.ts";
import { etkinHiyerarsi, ustAtamaHatasi, type Ezme } from "./hiyerarsiEzmesi.ts";
import { aktorHatasi, kodOku, kodluHata, kodOnekiniSil } from "../../world/level/cekirdek/aktorHatalari.ts";
import { aktorGunluguKur, type AktorGunlugu, type Kapatilabilir } from "./aktorGunlugu.ts";
import type { Aktor, CalismaBaglami } from "./calismaBaglami.ts";
import { aktorBaglariKur } from "./aktorBaglari.ts";
import { aktorHareketiKur } from "./aktorHareketi.ts";
import { aktorTetikleriKur } from "./aktorTetikleri.ts";

/** Aktör listesinin tanımdan yenilenme aralığı (sn). */
export const YENILEME_ARALIGI_S = 0.25;
/** Tek karede işlenen en büyük dt (sn): uzun takılmadan sonra araba ışınlanmasın. */
export const DT_TAVANI_S = 0.1;

export interface CalismaZamaniGirdisi {
  level: () => Level | null;
  olay: AktorOlayYolu;
  /** Tetiğin gözleyebileceği, aktör OLMAYAN kişiler (Ozyn, ajan gövdeleri); konumları dünya, ayak hizası. Çağrı karede bir kez. */
  gozlenenler?: () => readonly Gozlenen[];
  /** `beden:<ad>` soketi: bedenin adlı noktası (kemik düğümü). Yoksa/bilinmiyorsa null. */
  bedenSoketi?: (beden: string, soket: string) => Matrix | null;
  /** Günlük + bayraklar; verilmezse kendi (sessiz, çıkışsız) günlüğü. */
  gunluk?: AktorGunlugu;
}

export interface HataAyiklamaDokumu {
  aktor: number;
  /** Etkin bağlar (tanım + ezme) ve çözülmüş mü (ara düğüm kurulu). */
  baglar: readonly { aktor: string; ust: string; soket: string | null; kurulu: boolean }[];
  /** Tetik bileşenleri ve içerideki kişiler. */
  tetikler: readonly { aktor: string; bilesen: string; icerde: readonly string[] }[];
  hareketliler: readonly { aktor: string; hiz: number; komut: { hiz: number; donus: number } }[];
  /** Şu an geçerli (çözülmemiş) uyarılar, kodlu. */
  uyarilar: readonly string[];
  /** Bayrakla kapatılmış bileşenler. */
  kapali: readonly Kapatilabilir[];
  olaySayimi: ReturnType<AktorOlayYolu["sayim"]>;
  aboneSayisi: number;
}

export interface AktorCalismaZamani {
  kare(dt: number): void;
  /** Hareket bileşeni olan aktöre komut: ileri hız (m/s) ve dönme hızı (°/s); (0, 0) durdurur. Fırlatır (nedenle). */
  hareketEt(id: string, hiz: number, donus: number): void;
  /** Aktörü `ust` altına (ve varsa üstün soketine) takar. `ust`: aktör kimliği ya da `beden:<ad>`. Fırlatır (nedenle). */
  soketeTak(id: string, ust: string, soket?: string): void;
  /** Aktörü üstünden ayırır (tanımdaki üstten bile). Üstü yoksa fırlatır. */
  sokettanAl(id: string): void;
  /** Etkin hiyerarşi (tanım + çalışma zamanı ezmesi): olay yolu ve graf düğümleri bunu görür. */
  hiyerarsi(): Pick<AktorOlayYoluAyari, "ustu" | "altlari">;
  /** Aktörün etkin üstü ve soketi; yoksa null. */
  bag(id: string): { ust: string; soket: string | null } | null;
  /** Test ve hata ayıklama: sayılar ve çözülemeyen bağlar. */
  durum(): { aktor: number; tetik: number; hareketli: number; bag: number; uyarilar: readonly string[] };
  /** Bütün canlı durumun dökümü (aktorDebug): bağlar, tetik içerdekileri, hareketliler, uyarılar, bayraklar, olay sayımı. */
  hataAyiklama(): HataAyiklamaDokumu;
  yokEt(): void;
}

export function aktorCalismaZamaniKur(g: CalismaZamaniGirdisi): AktorCalismaZamani {
  let aktorler = new Map<string, Aktor>();
  let sonYenileme = -Infinity, zaman = 0, yenile = true;
  let izlenen: Level | null = null, yuklenmeAboneligi: (() => void) | null = null;
  const ezme = new Map<string, Ezme>();
  const gunluk = g.gunluk ?? aktorGunluguKur();
  const kapaliBildirildi = new Set<Kapatilabilir>();

  const dugumu = (a: Aktor): Node | null => {
    const l = g.level();
    if (!l) return null;
    const n: Node | null = a.tur === "nesne" ? l.nesneler.dugum(a.id) : l.isiklar.isik(a.id);
    return n && !n.isDisposed() ? n : null;
  };
  /** Olayı yayınlar; yol reddederse (ad/veri/derinlik/kare tavanı) SESSİZ KALMAZ: kodlu uyarı + sayaç. */
  function olayYolla(aktor: string, ad: string, veri: Record<string, string | number | boolean>): void {
    const r = g.olay.yayinla(aktor, ad, veri);
    if (!r.ok) gunluk.uyari("olay", kodOku(r.neden) ?? "AKT-OLY-001", kodOnekiniSil(r.neden), aktor);
    else gunluk.yaz("bilgi", "olay", `${aktor}.${ad} ${JSON.stringify(veri)} → ${r.iletilen} dinleyici`, { aktor });
  }
  const etkinUst = (a: Aktor): { ust?: string; soket?: string } => {
    const e = ezme.get(a.id);
    if (e === undefined) return { ...(a.ust ? { ust: a.ust } : {}), ...(a.soket ? { soket: a.soket } : {}) };
    return { ...(e.ust ? { ust: e.ust } : {}), ...(e.soket ? { soket: e.soket } : {}) };
  };
  /** Kimlikten aktör; yoksa kodlu hata (komut yüzeyleri: hareket, takma, ayırma). */
  const aktoruGetir = (id: string): Aktor => { const a = aktorler.get(id); if (!a) throw aktorHatasi("AKT-BAG-001", `aktör yok: ${id}`); return a; };

  const baglam: CalismaBaglami = { level: g.level, gunluk, aktorler: () => aktorler, dugumu, olayYolla };
  const bag = aktorBaglariKur(baglam, etkinUst, g.bedenSoketi);
  const hareket = aktorHareketiKur(baglam, (id) => bag.kurulu(id));
  const tetik = aktorTetikleriKur(baglam, g.gozlenenler);

  function tanimdanYenile(): void {
    const l = g.level();
    if (l !== izlenen) {
      yuklenmeAboneligi?.();
      yuklenmeAboneligi = l ? l.nesneler.yuklenince(() => { yenile = true; }) : null;
      izlenen = l;
      ezme.clear(); hareket.sifirla(); tetik.sifirla();
      bag.birak();
    }
    const yeni = new Map<string, Aktor>();
    if (l) {
      const t = l.tanim();
      for (const n of t.nesneler ?? []) {
        if (!n.id) continue;
        yeni.set(n.id, { id: n.id, tur: "nesne", ...(n.ust ? { ust: n.ust } : {}), ...(n.soket ? { soket: n.soket } : {}), bilesenler: n.bilesenler ?? [] });
      }
      for (const i of t.isiklar ?? []) {
        if (!i.id) continue;
        yeni.set(i.id, { id: i.id, tur: "isik", ...(i.ust ? { ust: i.ust } : {}), ...(i.soket ? { soket: i.soket } : {}), bilesenler: i.bilesenler ?? [] });
      }
    }
    aktorler = yeni;
    // Silinen aktörün ezmesi/durumu kalmasın.
    for (const id of [...ezme.keys()]) if (!yeni.has(id)) ezme.delete(id);
    hareket.buda((id) => yeni.has(id));
    tetik.buda();
    sonYenileme = zaman; yenile = false;
  }
  const taze = (): void => { if (yenile || zaman - sonYenileme >= YENILEME_ARALIGI_S) tanimdanYenile(); };

  /**
   * Bir kare aşamasını YALITIR: istisna öteki aşamaları durdurmaz (tetik patlasa hareket sürer), kodlu hata olarak günlüğe gider (aynı hata ardışık gelirse sayaç artar:
   * günlük şişmez). `kapatilabilir` bayrağı kapalıysa aşama atlanır (hata kaynağını ayırmak için) ve bu bir kez bildirilir.
   */
  function asama(ad: string, kategori: "zaman" | "hareket" | "bag" | "tetik", kapatilabilir: Kapatilabilir | null, f: () => void): void {
    if (kapatilabilir && gunluk.kapaliMi(kapatilabilir)) {
      if (!kapaliBildirildi.has(kapatilabilir)) { kapaliBildirildi.add(kapatilabilir); gunluk.uyari("zaman", "AKT-ZMN-002", `'${kapatilabilir}' bileşeni bayrakla kapalı: bu aşama atlanıyor`); }
      return;
    }
    if (kapatilabilir && kapaliBildirildi.delete(kapatilabilir)) gunluk.yaz("iyi", "zaman", `'${kapatilabilir}' bileşeni yeniden açıldı`, { herZaman: true });
    try { f(); } catch (e) { gunluk.hata(kategori, "AKT-ZMN-001", `${ad} aşaması: ${e instanceof Error ? e.message : String(e)}`); }
  }

  return {
    kare(dt) {
      g.olay.kareBasi();
      const d = Number.isFinite(dt) && dt > 0 ? Math.min(dt, DT_TAVANI_S) : 0;
      zaman += d;
      if (!g.level()) { if (izlenen) tanimdanYenile(); return; }
      asama("yenileme", "zaman", null, taze);
      asama("hareket", "hareket", "hareket", () => hareket.ilerlet(d));
      asama("bag", "bag", "bag", () => { bag.uzlastir(); bag.izle(); });
      asama("tetik", "tetik", "tetik", tetik.sina);
      bag.uyariBildir();
    },

    hareketEt(id, hiz, donus) {
      taze();
      hareket.komutVer(aktoruGetir(id), hiz, donus);
    },

    soketeTak(id, ust, soket) {
      taze();
      aktoruGetir(id);
      const h = ustAtamaHatasi(id, ust, (x) => aktorler.has(x), etkinHiyerarsi([...aktorler.values()].map((x) => ({ id: x.id, ust: etkinUst(x).ust })), ezme).ustu);
      if (h) throw kodluHata(`${id}: ${h}`);
      if (ust.startsWith(BEDEN_ONEKI)) {
        if (!soket) throw aktorHatasi("AKT-BAG-007", `${id}: beden soketi adı verilmedi (örn. el_sag)`);
        if (!g.bedenSoketi?.(ust.slice(BEDEN_ONEKI.length), soket)) throw aktorHatasi("AKT-BAG-008", `${id}: '${ust}' bedeninde '${soket}' soketi yok`);
      } else if (soket && !bag.soketMatrisi(aktorler.get(ust)!, soket)) {
        throw aktorHatasi("AKT-BAG-009", `${id}: '${ust}' aktörünün '${soket}' soketi yok (Details ▸ Bileşenler ▸ Soket)`);
      }
      gunluk.yaz("bilgi", "bag", `${id} → ${ust}${soket ? `/${soket}` : ""} takma isteği kabul edildi`, { aktor: id });
      ezme.set(id, { ust, ...(soket ? { soket } : {}) });
      yenile = true;
    },

    sokettanAl(id) {
      taze();
      const a = aktoruGetir(id);
      if (!etkinUst(a).ust) throw aktorHatasi("AKT-BAG-010", `'${id}' bir üste bağlı değil`);
      gunluk.yaz("bilgi", "bag", `${id} ayırma isteği kabul edildi`, { aktor: id });
      ezme.set(id, { ust: null });
      yenile = true;
    },

    hiyerarsi() {
      if (!aktorler.size) tanimdanYenile();
      return etkinHiyerarsi([...aktorler.values()].map((a) => ({ id: a.id, ust: etkinUst(a).ust })), ezme);
    },

    bag(id) {
      const a = aktorler.get(id);
      const e = a ? etkinUst(a) : null;
      return e?.ust ? { ust: e.ust, soket: e.soket ?? null } : null;
    },

    durum: () => ({ aktor: aktorler.size, tetik: tetik.sayi(), hareketli: hareket.sayi(), bag: bag.sayi(), uyarilar: bag.uyarilar() }),

    hataAyiklama: () => ({
      aktor: aktorler.size,
      baglar: [...aktorler.values()].flatMap((a) => { const e = etkinUst(a); return e.ust ? [{ aktor: a.id, ust: e.ust, soket: e.soket ?? null, kurulu: bag.kurulu(a.id) && !bag.cozumsuz(a.id) }] : []; }),
      tetikler: tetik.dokum(),
      hareketliler: hareket.dokum(),
      uyarilar: bag.uyarilar(),
      kapali: gunluk.bayraklar().kapali,
      olaySayimi: g.olay.sayim(),
      aboneSayisi: g.olay.abone(),
    }),

    yokEt() {
      yuklenmeAboneligi?.(); yuklenmeAboneligi = null;
      bag.birak();
      hareket.sifirla(); tetik.sifirla(); ezme.clear();
    },
  };
}
