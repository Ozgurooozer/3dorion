// world/surfaces/sema.ts — Zihin duvarındaki BEYİN ŞEMASI paneli.
//
// Orion'un algıdan eyleme giden yolu, canlı. Hangi durak çalıştı, kaç kez,
// ne kadar sürdü, nerede arıza var — hepsi odada görünür.
//
// Karar ve yerleşim `semaCekirdek.ts`'te (saf, testli), çizim `semaCizim.ts`te
// (Babylon'suz, `sema-deneme.html` ile sahnesiz görülür). Burası durumu,
// seçimi ve tıklamayı tutar; yüzeye bağlar.
// Sürekli boyama AÇIK: parıltılar zamanla söndüğü için her kare yeniden
// çizilmeli — bu, yüzey altyapısının `surekliBoyama` kipidir.
//
// Bağımlılık sınırı (K4): @babylonjs/* + kardeş yüzey modülleri.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { yuzeyKur } from "./yuzey.ts";
import type { Yuzey, YuzeyOlcusu } from "./yuzey.ts";
// K4: `protocol/` sıfır bağımlılıklı, `world/` ondan TİP alabilir. Kayıt
// defterinin KENDİSİ burada kurulmaz — onu kompozisyon kökü (`giris.ts`)
// kurar ve `panoBagla` ile takar. Böylece yüzey `mind/`i hiç görmez.
import type { Pano, DugmeGoruntu } from "../../protocol/pano.ts";
import { semaDurumuKur, semaAlani, dugumBulUv, dugumTanim, uvdenPiksel } from "./semaCekirdek.ts";
import type { Dugum, DugumDurumu, SemaDurumu } from "./semaCekirdek.ts";
import { cizSema, cizDetay, cizTeyit, type Bolge } from "./semaCizim.ts";
import { cizHafizaBulutu, type BulutKelimesi } from "./hafizaBulutu.ts";

export interface SemaAyari {
  sahne: Scene;
  mesh: AbstractMesh;
  genislikM: number;
  yukseklikM: number;
}

export interface SemaPaneli {
  /** Bir durak çalıştı — parıltı yakar, sayacı artırır. */
  vur(ad: string, not?: string): void;
  /** Durum notu (sayacı artırmaz): model adı, kesik süresi, kip. */
  not(ad: string, metin: string): void;
  /** Arıza işaretle/kaldır. */
  ariza(ad: string, arizali: boolean, not?: string): void;
  /** Alt şeritte gösterilecek tek satırlık genel durum. */
  durumYaz(metin: string): void;
  /**
   * Düğümün lobunu değiştir (`null` = tanımdaki). DÜŞÜNCE yerel bir modelle
   * koşarken şema onu bulut renginde göstermesin.
   */
  lob(ad: string, lob: Dugum["lob"] | null): void;

  // ── Okuma ve seçim ───────────────────────────────────────────────────
  //
  // Panel bugüne dek YALNIZCA yazılabiliyordu: `durum` kapanışa gömülüydü,
  // dışarıdan hiçbir şey okunamıyordu. Devre panosu olabilmesi için önce
  // SORGULANABİLİR olması gerek — S3 bunu ekler, yazma yetkisi hâlâ YOK.

  /** Bir düğümün canlı durumu. Kare-güvenli: kopya döner, fırlatmaz. */
  oku(ad: string): DugumDurumu;
  /**
   * Devre panosunu tak. Kompozisyon kökü çağırır; panel olmadan da çalışır
   * (pano takılı değilken detay yalnızca sayaçları gösterir).
   */
  panoBagla(pano: Pano | null): void;
  /**
   * HAFIZA görünümünün kelimeleri (spec 13 Faz 5). Takılıysa HAFIZA düğümüne girince
   * üç kabuklu bulut açılır; takılı değilse eski ayar ekranı. Kompozisyon kökü kurar.
   */
  hafizaBagla(kaynak: (() => readonly BulutKelimesi[]) | null): void;
  /** Detay görünümünde olan düğüm, yoksa `null`. */
  secili(): string | null;
  /** Düğüm seç (`null` = şemaya dön). Bilinmeyen ad SEÇİLMEZ. */
  sec(ad: string | null): void;
  /**
   * Bu UV'nin altında tıklanacak NE var? Yoksa `null`.
   *
   * İmleç biçimi bunu okur. `tikla` ile aynı çözümleyiciyi paylaşır: iki
   * ayrı hesap olsaydı imleç "tıklanır" derken tıklama hiçbir şey yapmayan
   * bir hâl mümkün olurdu.
   */
  hedef(u: number, v: number): string | null;
  /**
   * Doku UV'sine tıklandı. Dönüş: tıklama TÜKETİLDİ mi.
   *
   * `false` dönerse çağıran kendi davranışına devam edebilir (odak bırakma
   * gibi) — panel "her tıklamayı yuttum" demediği için üst katman tıkanmaz.
   */
  tikla(u: number, v: number): boolean;

  yokEt(): void;
}

export function semaKur(ayar: SemaAyari): SemaPaneli {
  const durum: SemaDurumu = semaDurumuKur();
  let altDurum = "";
  /** Detay görünümünde olan düğüm. `null` = şema görünümü. */
  let secim: string | null = null;
  /** Devre panosu. Takılı değilse detay yalnızca düğüm sayaçlarını gösterir. */
  let pano: Pano | null = null;

  /** Detay görünümünün "geri" hedefi. Düğüm adı olamayacak bir değer. */
  const GERI = "\u0000geri";
  /** Son yazma denemesinin sonucu — alt şeritte gösterilir. */
  let sonYazma = "";
  let sonYazmaAn = 0;

  /**
   * SON ÇİZİMDE üretilen tıklama bölgeleri.
   *
   * Vuruş testi burayı okur; geometriyi İKİNCİ KEZ HESAPLAMAZ. Açıklama
   * cümlesinin kaç satır sardığı `measureText`e bağlı, yani canvas olmadan
   * bilinemez — bağımsız bir hesap kaçınılmaz olarak çizimden kayardı ve
   * bastığın yer ile değişen şey farklı olurdu.
   *
   * Bayatlama riski bir kare: `surekliBoyama(true)` her karede çiziyor ve
   * kullanıcı ancak GÖRDÜĞÜ kareye tıklayabilir. Yani bu liste, tıklama
   * anında ekranda duran şeyin ta kendisidir.
   */
  let bolgeler: Bolge[] = [];
  /** Teyit ekranında işaretlenen bağlı eylemler. */
  const secilenEylemler = new Set<string>();

  // ── HAFIZA görünümü (spec 13 Faz 5) ──────────────────────────────────
  let hafizaKaynagi: (() => readonly BulutKelimesi[]) | null = null;
  /** HAFIZA düğümünde: bulut mu, eski ayar ekranı mı. Düğüme her girişte bulut. */
  let hafizaKipi: "bulut" | "ayar" = "bulut";
  let gercekKip = false;
  let seciliKelime: number | null = null;
  /** Kelimeler yarım saniyede bir tazelenir: her kare 160 anıyı kopyalamak gereksiz. */
  let kelimeler: readonly BulutKelimesi[] = [];
  let kelimeAn = 0;

  /** Bölge anahtarı: ad \0 işlem [\0 değer]. Ayraç ad/değerde geçemez. */
  const anahtar = (b: Bolge) => [b.ad, b.islem, ...(b.deger !== undefined ? [b.deger] : [])].join("\u0000");

  /**
   * UV'nin altındaki tıklama hedefi — TEK çözümleyici.
   *
   * Hem imleç (`hedef`) hem eylem (`tikla`) buradan okur. İki kopya olsaydı
   * biri değiştiğinde imleç "tıklanır" der, tıklama hiçbir şey yapmazdı;
   * bu da kullanıcıya "panel bozuk" diye görünürdü.
   */
  function cozumle(u: number, v: number): string | null {
    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
    const o = yuzey.olcu();
    const alan = semaAlani(o.genislik, o.yukseklik);
    const bolgede = (): string | null => {
      const { px, py } = uvdenPiksel(alan, u, v);
      const b = bolgeler.find((b) => px >= b.x && px <= b.x + b.g && py >= b.y && py <= b.y + b.yuk);
      return b ? anahtar(b) : null;
    };

    // Teyit AÇIKKEN panel başka hiçbir şeye tepki vermez: arka plandaki
    // düğümü seçmek ya da geri dönmek, cevaplanmamış bir soruyu ekranda
    // bırakıp başka yere gitmek olurdu.
    if (pano?.bekleyenTeyit()) return bolgede();

    if (secim !== null) {
      // Üst şerit = geri. Her tıklamayı "geri" saymak düğmeleri imkânsız
      // kılardı; hiçbirini saymamak kullanıcıyı panelde hapsederdi.
      const { py } = uvdenPiksel(alan, u, v);
      if (py >= 0 && py <= alan.basYuk) return GERI;
      return bolgede();
    }
    return dugumBulUv(alan, u, v);
  }

  function secimiKur(ad: string | null): void {
    if (ad !== null && !dugumTanim(ad)) {
      // Sessizce yutmak "tıkladım açılmadı" hatasını görünmez yapardı.
      console.warn(`[SEMA] bilinmeyen düğüm seçilmek istendi: ${ad}`);
      return;
    }
    if (secim === ad) return;
    secim = ad;
    hafizaKipi = "bulut";
    seciliKelime = null;
    yuzey.kirlet();
  }

  /**
   * Görünüm çatalı. Panel TEK yüzeydir: detay, şemanın üstüne açılmaz —
   * onun YERİNİ alır. Ozyn'in kararı: "aynı panelin üzerinde".
   */
  function ciz(bag: CanvasRenderingContext2D, o: YuzeyOlcusu): void {
    // `an` (performance.now()) KULLANILMAZ: parıltı `Date.now()` tabanlı çünkü
    // durum vuruşları da onunla damgalanıyor.
    const simdi = Date.now();
    const t = pano?.bekleyenTeyit() ?? null;
    if (t) bolgeler = cizTeyit(bag, o, t, secilenEylemler);
    else if (secim === "hafiza" && hafizaKaynagi && hafizaKipi === "bulut") {
      if (simdi - kelimeAn > 500) {
        try { kelimeler = hafizaKaynagi(); } catch (err) { console.error("[SEMA] hafiza kelimeleri okunamadi:", err); kelimeler = []; }
        kelimeAn = simdi;
      }
      bolgeler = cizHafizaBulutu(bag, o, { kelimeler, secili: seciliKelime, gercek: gercekKip, simdi });
    }
    else if (secim !== null) bolgeler = cizDetay(bag, o, secim, { durum, pano, simdi, sonYazma, sonYazmaAn });
    else bolgeler = cizSema(bag, o, { durum, altDurum, simdi });
  }

  /** Yazma sonucunu alt şeride koy. "teyit bekleniyor" ret değil, sonraki adım. */
  function sonucYaz(s: { oldu: boolean; sebep: string; deger: unknown }, d: DugmeGoruntu): void {
    sonYazma = s.oldu
      ? `${d.etiket} = ${String(s.deger)}${d.birim ? " " + d.birim : ""}`
      : `reddedildi: ${s.sebep}`;
    if (!s.oldu && s.sebep === "teyit bekleniyor") sonYazma = "";
    sonYazmaAn = Date.now();
    yuzey.kirlet();
  }

  const yuzey: Yuzey = yuzeyKur({
    sahne: ayar.sahne,
    mesh: ayar.mesh,
    genislikM: ayar.genislikM,
    yukseklikM: ayar.yukseklikM,
    dikeyPiksel: 512,
    isik: "ekran",
    ad: "sema",
    ciz,
  });
  // Parıltılar zamanla söner: kirli bayrağı yetmez, her kare çizilmeli.
  yuzey.surekliBoyama(true);

  return {
    vur(ad, not) { durum.vur(ad, not); },
    not(ad, metin) { durum.notYaz(ad, metin); },
    ariza(ad, arizali, not) { durum.ariza(ad, arizali, not); },
    durumYaz(metin) { altDurum = metin.replace(/\s+/g, " ").trim(); },
    lob(ad, lob) { durum.lobYaz(ad, lob); },

    oku(ad) { return durum.oku(ad); },
    secili() { return secim; },
    panoBagla(p) { pano = p; yuzey.kirlet(); },
    hafizaBagla(k) { hafizaKaynagi = k; kelimeAn = 0; },
    sec: secimiKur,
    hedef: cozumle,
    tikla(u, v) {
      const h = cozumle(u, v);
      if (h === null) return false;
      if (h === GERI) { secimiKur(null); return true; }

      const [dugmeAdi, islem, secilen] = h.split("\u0000");
      if (islem === undefined) { secimiKur(dugmeAdi!); return true; }
      // HAFIZA bulutu: görünüm değişimi, "Gerçek" kipi, kelime seçimi (pano gerekmez).
      if (islem === "gorunum") { hafizaKipi = secilen === "ayar" ? "ayar" : "bulut"; seciliKelime = null; return true; }
      if (islem === "gercek") { gercekKip = !gercekKip; return true; }
      if (islem === "kelime") {
        const i = Number(secilen);
        seciliKelime = seciliKelime === i ? null : i;
        return true;
      }
      if (!pano) return false;

      if (islem === "eylem") {
        // Bağlı eylem SEÇİMİ — çalıştırma değil. Onayla'ya basılana kadar
        // hiçbir şey olmaz.
        if (secilenEylemler.has(dugmeAdi!)) secilenEylemler.delete(dugmeAdi!);
        else secilenEylemler.add(dugmeAdi!);
        yuzey.kirlet();
        return true;
      }
      if (islem === "teyitIptal") {
        pano.teyitIptal();
        secilenEylemler.clear();
        sonYazma = "teyit iptal edildi";
        sonYazmaAn = Date.now();
        yuzey.kirlet();
        return true;
      }
      if (islem === "teyitOnay") {
        const t = pano.bekleyenTeyit();
        if (!t) return false;
        const s = pano.teyitliYaz(t.jeton, [...secilenEylemler]);
        secilenEylemler.clear();
        sonYazma = s.oldu ? `${t.etiket} = ${String(s.deger)}` : `reddedildi: ${s.sebep}`;
        sonYazmaAn = Date.now();
        yuzey.kirlet();
        return true;
      }

      // Düğme basıldı: pano yazar, panel SONUCU gösterir. Reddedilen bir
      // yazmanın sessiz geçmesi en kötü hâl olurdu.
      const mevcut = pano.goruntu(secim ?? "").flatMap((m) => m.dugmeler)
        .find((d) => d.ad === dugmeAdi);
      if (!mevcut) return false;

      const hedef = islem === "sec" ? (secilen ?? null)
        : sonrakiDeger(mevcut, islem === "artir" ? 1 : -1);
      if (hedef === null || hedef === mevcut.deger) return islem === "sec";
      // Sınıf kapısına göre yol ayrılır: güvenli olan doğrudan yazılır,
      // teyit isteyen teyit ekranını AÇAR. Karar panoda, panelde değil.
      sonucYaz(mevcut.yazilabilir ? pano.yaz(dugmeAdi!, hedef) : pano.teyitIste(dugmeAdi!, hedef), mevcut);
      return true;
    },

    yokEt() { yuzey.yokEt(); },
  };
}

/**
 * −/+ basılınca yazılacak değer. Sayıda adım kadar, metinde listede bir
 * sonraki/önceki (uçta başa döner: iki beyin arasında gidip gelmek tek
 * tuşla olmalı). Ayarlanamayan düğmede `null`.
 */
export function sonrakiDeger(d: DugmeGoruntu, yon: 1 | -1): number | string | null {
  if (typeof d.deger === "number") return d.deger + yon * (d.adim || 1);
  if (typeof d.deger === "string" && d.secenekler.length > 1) {
    const i = d.secenekler.indexOf(d.deger);
    const n = d.secenekler.length;
    // Değer listede yoksa (ör. eski ad) ilk seçeneğe git — kilitlenme yok.
    return d.secenekler[i < 0 ? 0 : (i + yon + n) % n]!;
  }
  return null;
}
