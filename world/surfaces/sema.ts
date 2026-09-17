// world/surfaces/sema.ts — Zihin duvarındaki BEYİN ŞEMASI paneli.
//
// Orion'un algıdan eyleme giden yolu, canlı. Hangi durak çalıştı, kaç kez,
// ne kadar sürdü, nerede arıza var — hepsi odada görünür.
//
// Karar ve yerleşim `semaCekirdek.ts`'te (saf, testli). Burası yalnızca boyar.
// Sürekli boyama AÇIK: parıltılar zamanla söndüğü için her kare yeniden
// çizilmeli — bu, yüzey altyapısının `surekliBoyama` kipidir.
//
// Bağımlılık sınırı (K4): @babylonjs/* + kardeş yüzey modülleri.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { yuzeyKur, RENK, YAZI, zeminDoldur, yuvarlakKutu } from "./yuzey.ts";
import type { Yuzey, YuzeyOlcusu } from "./yuzey.ts";
// K4: `protocol/` sıfır bağımlılıklı, `world/` ondan TİP alabilir. Kayıt
// defterinin KENDİSİ burada kurulmaz — onu kompozisyon kökü (`giris.ts`)
// kurar ve `panoBagla` ile takar. Böylece yüzey `mind/`i hiç görmez.
import type { Pano, ModulGoruntu, DugmeGoruntu, Sinif, Etki, Teyit } from "../../protocol/pano.ts";
import {
  DUGUMLER, OKLAR, semaDurumuKur, semaAlani, semaYerlesimi, dugumBulUv, dugumTanim, uvdenPiksel,
} from "./semaCekirdek.ts";
import type { Dugum, DugumDurumu, Kutu, SemaAlani, SemaDurumu } from "./semaCekirdek.ts";

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

/** Lob renkleri: yerel hızlı (yeşilimsi), bulut yavaş (mavi), ortak nötr. */
const LOB_RENK: Record<Dugum["lob"], string> = {
  yerel: "#4fd8a0",
  bulut: RENK.vurgu,
  ortak: "#b9a6ff",
};

export function semaKur(ayar: SemaAyari): SemaPaneli {
  const durum: SemaDurumu = semaDurumuKur();
  let altDurum = "";
  /** Detay görünümünde olan düğüm. `null` = şema görünümü. */
  let secim: string | null = null;
  /** Devre panosu. Takılı değilse detay yalnızca düğüm sayaçlarını gösterir. */
  let pano: Pano | null = null;

  /**
   * Seçimi değiştirir. `this`e bağlı DEĞİL: dönen nesnenin metodu parçalanıp
   * (`const { tikla } = panel`) ayrı çağrılabilsin diye yerel fonksiyon.
   */
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
  type BolgeIslem = "artir" | "azalt" | "eylem" | "teyitOnay" | "teyitIptal";
  interface Bolge { ad: string; islem: BolgeIslem; x: number; y: number; g: number; yuk: number }
  let bolgeler: Bolge[] = [];
  /** Teyit ekranında işaretlenen bağlı eylemler. */
  const secilenEylemler = new Set<string>();

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

    // Teyit AÇIKKEN panel başka hiçbir şeye tepki vermez: arka plandaki
    // düğümü seçmek ya da geri dönmek, cevaplanmamış bir soruyu ekranda
    // bırakıp başka yere gitmek olurdu.
    if (pano?.bekleyenTeyit()) {
      const { px, py } = uvdenPiksel(alan, u, v);
      for (const b of bolgeler) {
        if (px >= b.x && px <= b.x + b.g && py >= b.y && py <= b.y + b.yuk) {
          return `${b.ad}\u0000${b.islem}`;
        }
      }
      return null;
    }

    if (secim !== null) {
      const { px, py } = uvdenPiksel(alan, u, v);
      // Üst şerit = geri. Her tıklamayı "geri" saymak düğmeleri imkânsız
      // kılardı; hiçbirini saymamak kullanıcıyı panelde hapsederdi.
      if (py >= 0 && py <= alan.basYuk) return GERI;
      // Son çizimin kaydettiği −/+ bölgeleri.
      for (const b of bolgeler) {
        if (px >= b.x && px <= b.x + b.g && py >= b.y && py <= b.y + b.yuk) {
          return `${b.ad}\u0000${b.islem}`;
        }
      }
      return null;
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
    yuzey.kirlet();
  }

  // `an` (performance.now()) KULLANILMAZ: parıltı `Date.now()` tabanlı çünkü
  // durum vuruşları da onunla damgalanıyor. İki saat karıştırılırsa parıltı
  // ya hiç sönmez ya hep sönük çıkar.
  /**
   * Görünüm çatalı. Panel TEK yüzeydir: detay, şemanın üstüne açılmaz —
   * onun YERİNİ alır. Ozyn'in kararı: "aynı panelin üzerinde".
   *
   * Duvara ikinci bir pencere açmak odada iki ayrı dikdörtgen demekti;
   * uzaktan bakınca hangisinin canlı olduğu anlaşılmıyordu.
   */
  function ciz(bag: CanvasRenderingContext2D, o: YuzeyOlcusu): void {
    const t = pano?.bekleyenTeyit() ?? null;
    if (t) cizTeyit(bag, o, t);
    else if (secim !== null) cizDetay(bag, o, secim);
    else cizSema(bag, o);
  }

  function cizSema(bag: CanvasRenderingContext2D, o: YuzeyOlcusu): void {
    const simdi = Date.now();
    bolgeler = [];
    zeminDoldur(bag, o, RENK.ekranZemin);

    // Geometri TEK KAYNAKTAN: `semaCekirdek.semaAlani`. Bu oranlar eskiden
    // burada hesaplanıyordu; tıklama testi de aynı sayılara ihtiyaç duyduğu
    // için çekirdeğe taşındı — iki kopya er geç birbirinden kayardı.
    const alan: SemaAlani = semaAlani(o.genislik, o.yukseklik);
    const { kenar, basYuk, altYuk } = alan;

    // ── Başlık ───────────────────────────────────────────────────────────
    bag.fillStyle = "#0d1220";
    bag.fillRect(0, 0, o.genislik, basYuk);
    bag.textBaseline = "middle";
    bag.textAlign = "left";
    bag.fillStyle = RENK.vurgu;
    bag.font = `600 ${Math.round(basYuk * 0.44)}px ${YAZI.duz}`;
    bag.fillText("ORION · ZİHİN AKIŞI", kenar, basYuk / 2);

    // Sağda lob göstergesi — iki katmanlı beynin okunur özeti.
    bag.textAlign = "right";
    bag.font = `${Math.round(basYuk * 0.32)}px ${YAZI.tek}`;
    bag.fillStyle = LOB_RENK.yerel;
    bag.fillText("● yerel", o.genislik - kenar - Math.round(o.genislik * 0.09), basYuk / 2);
    bag.fillStyle = LOB_RENK.bulut;
    bag.fillText("● bulut", o.genislik - kenar, basYuk / 2);

    bag.strokeStyle = RENK.cerceve;
    bag.lineWidth = Math.max(1, Math.round(o.yukseklik * 0.004));
    bag.beginPath();
    bag.moveTo(0, basYuk); bag.lineTo(o.genislik, basYuk); bag.stroke();

    // ── Şema alanı ───────────────────────────────────────────────────────
    const kutular = semaYerlesimi(alan);

    // Oklar ÖNCE: kutuların altında kalsınlar.
    for (const [a, b] of OKLAR) {
      const ka = kutular.get(a), kb = kutular.get(b);
      if (!ka || !kb) continue;
      // Ok canlılığı KAYNAĞIN parıltısı: veri oradan aktı.
      const p = durum.parilti(a, simdi);
      bag.strokeStyle = p > 0 ? karistir(RENK.cerceve, LOB_RENK.ortak, p) : RENK.cerceve;
      bag.lineWidth = Math.max(1, Math.round(o.yukseklik * (0.003 + 0.004 * p)));
      okCiz(bag, ka, kb);
    }

    for (const d of DUGUMLER) {
      const k = kutular.get(d.ad);
      if (!k) continue;
      const s = durum.oku(d.ad);
      const p = durum.parilti(d.ad, simdi);
      const renk = s.arizali ? RENK.kotu : LOB_RENK[d.lob];

      // Gövde: sönük zemin, parıltıyla aydınlanır.
      yuvarlakKutu(bag, k.x, k.y, k.g, k.yuk, Math.min(10, k.yuk * 0.22));
      bag.fillStyle = s.arizali ? "#2a1214" : karistir("#111827", renk, 0.10 + 0.30 * p);
      bag.fill();
      bag.strokeStyle = s.arizali ? RENK.kotu : karistir(RENK.cerceve, renk, 0.35 + 0.65 * p);
      bag.lineWidth = Math.max(1, Math.round(k.yuk * (0.045 + 0.06 * p)));
      bag.stroke();

      // Etiket
      bag.textAlign = "center";
      bag.textBaseline = "middle";
      bag.fillStyle = s.arizali ? RENK.kotu : karistir(RENK.metin, renk, 0.35 + 0.65 * p);
      bag.font = `600 ${Math.round(k.yuk * 0.34)}px ${YAZI.duz}`;
      bag.fillText(d.etiket, k.x + k.g / 2, k.y + k.yuk * 0.38);

      // Sayaç + not — küçük, sönük; şemayı boğmasın.
      const alt = s.not ? `${s.sayac} · ${s.not}` : String(s.sayac);
      bag.fillStyle = s.arizali ? RENK.uyari : RENK.soluk;
      bag.font = `${Math.round(k.yuk * 0.24)}px ${YAZI.tek}`;
      bag.fillText(kirp(bag, alt, k.g * 0.92), k.x + k.g / 2, k.y + k.yuk * 0.72);
    }

    // ── Alt şerit: tek satırlık genel durum ──────────────────────────────
    bag.fillStyle = "#0d1220";
    bag.fillRect(0, o.yukseklik - altYuk, o.genislik, altYuk);
    bag.strokeStyle = RENK.cerceve;
    bag.beginPath();
    bag.moveTo(0, o.yukseklik - altYuk); bag.lineTo(o.genislik, o.yukseklik - altYuk); bag.stroke();
    bag.textAlign = "left";
    bag.fillStyle = RENK.soluk;
    bag.font = `${Math.round(altYuk * 0.40)}px ${YAZI.tek}`;
    bag.fillText(kirp(bag, altDurum || "hazır", o.genislik - kenar * 2),
      kenar, o.yukseklik - altYuk / 2);
  }


  /**
   * DETAY GÖRÜNÜMÜ — tek düğüm, salt okunur.
   *
   * S3 kapsamı bilerek dar: burada hiçbir şey DEĞİŞTİRİLEMEZ. Önce görmek,
   * sonra dokunmak. "SALT OKUNUR" rozeti süs değil: paneli ilk gören biri
   * tıklayıp bir şey bozup bozamayacağını denemeden bilmeli.
   *
   * Sürekli boyama AÇIK kalır — buradaki sayılar canlı akar. Kapatmak
   * gecikme/sayaç alanlarını dondururdu, yani panelin tek işini bitirirdi.
   * Pahalı okumalar (onay kapısı geçmişi gibi) S4'te geldiğinde kısma da
   * o zaman gelir; şimdi kısmak ölçülmemiş bir maliyet için erken olurdu.
   */
  /**
   * TEYİT GÖRÜNÜMÜ — iki aşamalı onayın ikinci aşaması.
   *
   * Şema ve detay gibi TAM PANELİ kaplar. Küçük bir açılır kutu olsaydı
   * arkasındaki sayılar okunmaya devam eder ve "ne onaylıyorum" sorusu
   * ikinci plana düşerdi. Burada ekranda tek bir soru var.
   */
  function cizTeyit(bag: CanvasRenderingContext2D, o: YuzeyOlcusu, t: Teyit): void {
    bolgeler = [];
    zeminDoldur(bag, o, "#150d10");
    const alan = semaAlani(o.genislik, o.yukseklik);
    const { kenar, basYuk, altYuk } = alan;

    bag.fillStyle = "#24121a";
    bag.fillRect(0, 0, o.genislik, basYuk);
    bag.textBaseline = "middle";
    bag.textAlign = "left";
    bag.fillStyle = RENK.uyari;
    bag.font = `600 ${Math.round(basYuk * 0.44)}px ${YAZI.duz}`;
    bag.fillText("TEYİT GEREKİYOR", kenar, basYuk / 2);
    bag.textAlign = "right";
    bag.font = `${Math.round(basYuk * 0.30)}px ${YAZI.tek}`;
    bag.fillStyle = RENK.soluk;
    bag.fillText(t.dugmeAdi, o.genislik - kenar, basYuk / 2);
    bag.strokeStyle = RENK.kotu;
    bag.lineWidth = Math.max(1, Math.round(o.yukseklik * 0.004));
    bag.beginPath(); bag.moveTo(0, basYuk); bag.lineTo(o.genislik, basYuk); bag.stroke();

    let y = basYuk + Math.round(o.yukseklik * 0.09);
    bag.textAlign = "left";
    bag.fillStyle = RENK.metin;
    bag.font = `600 ${Math.round(o.yukseklik * 0.070)}px ${YAZI.duz}`;
    bag.fillText(`${t.etiket}:  ${String(t.eski)}  →  ${String(t.yeni)}`, kenar, y);
    y += Math.round(o.yukseklik * 0.085);

    // CANLI uyarı — teyidin asıl içeriği. Sabit bir cümle olsaydı bu ekran
    // "emin misin?" kutusundan ibaret kalırdı.
    bag.fillStyle = RENK.uyari;
    const ub = Math.round(o.yukseklik * 0.050);
    bag.font = `${ub}px ${YAZI.duz}`;
    for (const satir of satirla(bag, t.uyari, o.genislik - kenar * 2)) {
      bag.fillText(satir, kenar, y);
      y += Math.round(ub * 1.35);
    }
    y += Math.round(o.yukseklik * 0.035);

    // Bağlı eylemler — ayrı seçim. Ayarın yan etkisi DEĞİLLER.
    if (t.eylemler.length) {
      bag.fillStyle = RENK.soluk;
      bag.font = `${Math.round(o.yukseklik * 0.034)}px ${YAZI.tek}`;
      bag.fillText("BİRLİKTE ÇALIŞTIR (isteğe bağlı)", kenar, y);
      y += Math.round(o.yukseklik * 0.048);
      for (const e of t.eylemler) {
        const secili = secilenEylemler.has(e.ad);
        const kb = Math.round(o.yukseklik * 0.040);
        yuvarlakKutu(bag, kenar, y - kb / 2, kb, kb, kb * 0.25);
        bag.strokeStyle = secili ? RENK.iyi : RENK.cerceve;
        bag.lineWidth = Math.max(1, Math.round(kb * 0.10));
        bag.stroke();
        if (secili) { bag.fillStyle = RENK.iyi; bag.fill(); }
        bolgeler.push({ ad: e.ad, islem: "eylem", x: kenar, y: y - kb / 2, g: kb, yuk: kb });

        bag.fillStyle = secili ? RENK.metin : RENK.soluk;
        bag.font = `${Math.round(o.yukseklik * 0.040)}px ${YAZI.duz}`;
        bag.fillText(kirp(bag, `${e.etiket} — ${e.aciklama}`, o.genislik - kenar * 2 - kb * 2),
          kenar + kb * 1.5, y);
        y += Math.round(o.yukseklik * 0.058);
      }
    }

    // ONAYLA / VAZGEÇ
    const dy = Math.round(o.yukseklik * 0.085);
    const dgG = Math.round(o.genislik * 0.20);
    const dugY = o.yukseklik - altYuk - dy - Math.round(o.yukseklik * 0.035);
    for (const [i, [etiket, islem, renk]] of
         ([["ONAYLA", "teyitOnay", RENK.kotu], ["VAZGEÇ", "teyitIptal", RENK.cerceve]] as const).entries()) {
      const bx = kenar + i * (dgG + Math.round(o.genislik * 0.02));
      yuvarlakKutu(bag, bx, dugY, dgG, dy, dy * 0.22);
      bag.strokeStyle = renk;
      bag.lineWidth = Math.max(1, Math.round(dy * 0.07));
      bag.stroke();
      bag.fillStyle = renk === RENK.cerceve ? RENK.soluk : renk;
      bag.font = `600 ${Math.round(dy * 0.42)}px ${YAZI.duz}`;
      bag.textAlign = "center";
      bag.fillText(etiket, bx + dgG / 2, dugY + dy / 2);
      bag.textAlign = "left";
      bolgeler.push({ ad: "", islem, x: bx, y: dugY, g: dgG, yuk: dy });
    }

    bag.fillStyle = "#24121a";
    bag.fillRect(0, o.yukseklik - altYuk, o.genislik, altYuk);
    bag.fillStyle = RENK.soluk;
    bag.font = `${Math.round(altYuk * 0.38)}px ${YAZI.tek}`;
    bag.fillText("Esc · vazgeç", kenar, o.yukseklik - altYuk / 2);
  }

  function cizDetay(bag: CanvasRenderingContext2D, o: YuzeyOlcusu, ad: string): void {
    const simdi = Date.now();
    bolgeler = [];
    zeminDoldur(bag, o, RENK.ekranZemin);

    const alan: SemaAlani = semaAlani(o.genislik, o.yukseklik);
    const { kenar, basYuk, altYuk } = alan;
    const tanim = dugumTanim(ad);
    const s = durum.oku(ad);
    const renk = s.arizali ? RENK.kotu : (tanim ? LOB_RENK[tanim.lob] : RENK.soluk);

    // ── Başlık = GERİ düğmesi ────────────────────────────────────────────
    // Üst şerit tıklanınca şemaya dönülür; "◀" bunu görünür kılar. Tek
    // çıkış yolu Esc olsaydı fareyle gezen biri panelde kilitli kalırdı.
    bag.fillStyle = "#0d1220";
    bag.fillRect(0, 0, o.genislik, basYuk);
    bag.textBaseline = "middle";
    bag.textAlign = "left";
    bag.font = `600 ${Math.round(basYuk * 0.44)}px ${YAZI.duz}`;
    bag.fillStyle = RENK.soluk;
    const geri = "◀ ZİHİN AKIŞI · ";
    bag.fillText(geri, kenar, basYuk / 2);
    const genG = bag.measureText(geri).width;
    bag.fillStyle = renk;
    bag.fillText(tanim ? tanim.etiket : ad, kenar + genG, basYuk / 2);

    // Rozet GERÇEĞİ söylemeli. Yazılabilir düğme varken "SALT OKUNUR"
    // yazmak, panelin tek vaadini — doğru bilgi vermeyi — bozardı.
    const yazilabilirSayi = pano
      ? pano.goruntu(ad).flatMap((m) => m.dugmeler).filter((d) => d.yazilabilir).length
      : 0;
    bag.textAlign = "right";
    bag.font = `${Math.round(basYuk * 0.30)}px ${YAZI.tek}`;
    bag.fillStyle = yazilabilirSayi ? RENK.iyi : RENK.soluk;
    bag.fillText(yazilabilirSayi ? `${yazilabilirSayi} AYARLANABİLİR` : "SALT OKUNUR",
      o.genislik - kenar, basYuk / 2);

    bag.strokeStyle = RENK.cerceve;
    bag.lineWidth = Math.max(1, Math.round(o.yukseklik * 0.004));
    bag.beginPath();
    bag.moveTo(0, basYuk); bag.lineTo(o.genislik, basYuk); bag.stroke();

    // ── Gövde ────────────────────────────────────────────────────────────
    let y = basYuk + Math.round(o.yukseklik * 0.09);
    bag.textAlign = "left";

    // Ne yapar — tek cümle, gerekirse sarılır.
    bag.fillStyle = RENK.metin;
    const cumleBoy = Math.round(o.yukseklik * 0.058);
    bag.font = `${cumleBoy}px ${YAZI.duz}`;
    for (const satir of satirla(bag, tanim?.aciklama ?? "(tanım yok)", o.genislik - kenar * 2)) {
      bag.fillText(satir, kenar, y);
      y += Math.round(cumleBoy * 1.35);
    }

    // Sayılar — panelin asıl işi. Nesir değil, ölçü.
    y += Math.round(o.yukseklik * 0.05);
    const olculer: readonly (readonly [string, string])[] = [
      ["ÇALIŞMA", String(s.sayac)],
      ["SON", suredenBeri(s.sonAn, simdi)],
      ["DURUM", s.arizali ? "ARIZALI" : (s.sayac ? "çalışıyor" : "hiç çalışmadı")],
      ["LOB", tanim ? tanim.lob : "—"],
    ];
    const sutunG = (o.genislik - kenar * 2) / olculer.length;
    for (let i = 0; i < olculer.length; i++) {
      const [bas, deg] = olculer[i]!;
      const x = kenar + i * sutunG;
      bag.fillStyle = RENK.soluk;
      bag.font = `${Math.round(o.yukseklik * 0.034)}px ${YAZI.tek}`;
      bag.fillText(bas, x, y);
      bag.fillStyle = bas === "DURUM" && s.arizali ? RENK.kotu : renk;
      bag.font = `600 ${Math.round(o.yukseklik * 0.062)}px ${YAZI.duz}`;
      bag.fillText(kirp(bag, deg, sutunG * 0.94), x, y + Math.round(o.yukseklik * 0.062));
    }
    y += Math.round(o.yukseklik * 0.135);

    // Not (model adı, gecikme, kesik süresi) — varsa.
    if (s.not) {
      bag.fillStyle = s.arizali ? RENK.uyari : RENK.soluk;
      bag.font = `${Math.round(o.yukseklik * 0.042)}px ${YAZI.tek}`;
      bag.fillText(kirp(bag, s.not, o.genislik - kenar * 2), kenar, y);
      y += Math.round(o.yukseklik * 0.075);
    }

    // Komşuluk: veri nereden gelir, nereye gider. Şemadaki okların yazısı.
    const girdi = OKLAR.filter(([, b]) => b === ad).map(([a]) => etiketAl(a));
    const cikti = OKLAR.filter(([a]) => a === ad).map(([, b]) => etiketAl(b));
    bag.font = `${Math.round(o.yukseklik * 0.036)}px ${YAZI.tek}`;
    bag.fillStyle = RENK.soluk;
    bag.fillText(
      `GİRDİ ${girdi.join(" · ") || "—"}     ÇIKTI ${cikti.join(" · ") || "—"}`, kenar, y);
    y += Math.round(o.yukseklik * 0.062);

    // ── DEVRE PANOSU: bu durağa bağlı teller ve düğmeler ─────────────────
    //
    // Sabit teller GİZLENMEZ, çizilir. Devre panosu lehimli izleri de
    // gösterir; saklamak operatöre "panel her şeydir" yalanını öğretir ve
    // görünmeyen bir güvenlik teli savunulamaz hale gelir.
    const moduller: readonly ModulGoruntu[] = pano ? pano.goruntu(ad) : [];
    const satirlar = moduller.flatMap((m) => m.dugmeler);
    if (!pano) {
      bag.fillStyle = RENK.soluk;
      bag.font = `${Math.round(o.yukseklik * 0.036)}px ${YAZI.tek}`;
      bag.fillText("pano takılı değil", kenar, y);
    } else if (!satirlar.length) {
      bag.fillStyle = RENK.soluk;
      bag.font = `${Math.round(o.yukseklik * 0.036)}px ${YAZI.tek}`;
      bag.fillText("bu durağa bağlı ayar yok", kenar, y);
    } else {
      // Satır yüksekliği KALAN alana göre: düğme sayısı modülden modüle
      // değişiyor ve sabit yükseklik en kalabalık durakta taşardı.
      const kalan = o.yukseklik - altYuk - y - Math.round(o.yukseklik * 0.02);
      const satirY = Math.max(
        Math.round(o.yukseklik * 0.040),
        Math.min(Math.round(o.yukseklik * 0.070), Math.floor(kalan / satirlar.length)));
      const yaziBoy = Math.round(satirY * 0.50);
      const rozetX = kenar + Math.round(o.genislik * 0.30);
      const degerX = kenar + Math.round(o.genislik * 0.46);
      const etkiX = o.genislik - kenar;

      for (const d of satirlar) {
        const merkez = y + satirY / 2;
        bag.textAlign = "left";
        bag.textBaseline = "middle";

        bag.fillStyle = d.sinif === "sabit" ? RENK.soluk : RENK.metin;
        bag.font = `${yaziBoy}px ${YAZI.duz}`;
        bag.fillText(kirp(bag, d.etiket, rozetX - kenar - 6), kenar, merkez);

        rozetCiz(bag, rozetX, merkez, Math.round(yaziBoy * 0.82), d.sinif);

        bag.fillStyle = d.hata ? RENK.kotu : (d.sinif === "sabit" ? RENK.soluk : RENK.metin);
        bag.font = `600 ${yaziBoy}px ${YAZI.tek}`;
        const metin = d.hata ? "okunamadı" : `${degerYaz(d.deger)}${d.birim ? " " + d.birim : ""}`;
        bag.fillText(kirp(bag, metin, etkiX - degerX - Math.round(o.genislik * 0.13)), degerX, merkez);

        // Etki, değerden AYRI sütunda: "ne zaman etkiler" sorusu "ne kadar
        // tehlikeli"den bağımsız ve panelde de öyle okunmalı.
        bag.textAlign = "right";
        bag.fillStyle = RENK.cerceve;
        bag.font = `${Math.round(yaziBoy * 0.78)}px ${YAZI.tek}`;
        bag.fillText(ETKI_YAZI[d.etki], etkiX, merkez);
        bag.textAlign = "left";

        // −/+ YALNIZCA yazılabilir sayısal düğmede. Kilitli olanda çizmemek
        // bir tasarım kararı: görünüp işlemeyen düğme, panelin bozuk olduğu
        // izlenimi verir. Kilit sebebi zaten rozette okunuyor.
        // Teyit isteyen düğmelerde de −/+ çizilir: basınca teyit ekranı
        // açılır. Çizmemek "bu ayar hiç değiştirilemez" demek olurdu ki
        // yanlış; kilit sebebi zaten rozette ve teyitte okunuyor.
        const teyitli = d.kilitSebebi.includes("teyit");
        if ((d.yazilabilir || teyitli) && typeof d.deger === "number" && d.adim > 0) {
          const dg = Math.round(satirY * 1.12);
          const artiX = etkiX - Math.round(o.genislik * 0.115) - dg;
          const eksiX = artiX - dg - Math.round(satirY * 0.22);
          for (const [bx, isaret, islem] of
               [[eksiX, "−", "azalt"], [artiX, "+", "artir"]] as const) {
            yuvarlakKutu(bag, bx, merkez - dg / 2, dg, dg, dg * 0.26);
            bag.strokeStyle = RENK.cerceve;
            bag.lineWidth = Math.max(1, Math.round(dg * 0.07));
            bag.stroke();
            bag.fillStyle = RENK.metin;
            bag.font = `600 ${Math.round(dg * 0.62)}px ${YAZI.duz}`;
            bag.textAlign = "center";
            bag.fillText(isaret, bx + dg / 2, merkez);
            bag.textAlign = "left";
            bolgeler.push({ ad: d.ad, islem, x: bx, y: merkez - dg / 2, g: dg, yuk: dg });
          }
        }

        y += satirY;
      }
    }

    // ── Alt şerit ────────────────────────────────────────────────────────
    bag.fillStyle = "#0d1220";
    bag.fillRect(0, o.yukseklik - altYuk, o.genislik, altYuk);
    bag.strokeStyle = RENK.cerceve;
    bag.beginPath();
    bag.moveTo(0, o.yukseklik - altYuk); bag.lineTo(o.genislik, o.yukseklik - altYuk); bag.stroke();
    bag.fillStyle = RENK.soluk;
    bag.font = `${Math.round(altYuk * 0.40)}px ${YAZI.tek}`;
    bag.textAlign = "left";
    // Son yazma sonucu 4 sn görünür, sonra normal ipucuna döner. Kalıcı
    // olsaydı eski bir ret mesajı yeni bir denemede hâlâ ekranda durur ve
    // yanlış okunurdu.
    const taze = sonYazma && simdi - sonYazmaAn < 4000;
    bag.fillStyle = taze
      ? (sonYazma.startsWith("reddedildi") ? RENK.kotu : RENK.iyi)
      : RENK.soluk;
    bag.fillText(kirp(bag, taze ? sonYazma : "Esc veya üst şerit · geri",
      Math.round(o.genislik * 0.55)), kenar, o.yukseklik - altYuk / 2);
    bag.fillStyle = RENK.soluk;
    // ÖLÇÜM DIŞI şeridi: kilit bir kez açıldıysa, kapatılsa bile bu oturum
    // boyunca görünür. Bu panelde okunan ölçüm sabitlerine artık aynı
    // güvenle bakılamaz ve bunu bilmek, sayının kendisi kadar önemli.
    if (pano?.olcumDisi()) {
      bag.fillStyle = RENK.kotu;
      bag.font = `600 ${Math.round(altYuk * 0.40)}px ${YAZI.tek}`;
      bag.textAlign = "center";
      bag.fillText(kirp(bag, `ÖLÇÜM DIŞI — ${pano.kilitGerekcesi()}`, o.genislik * 0.44),
        o.genislik / 2, o.yukseklik - altYuk / 2);
      bag.textAlign = "left";
      bag.font = `${Math.round(altYuk * 0.40)}px ${YAZI.tek}`;
      bag.fillStyle = RENK.soluk;
    }
    if (pano) {
      const sabitSayi = satirlar.filter((d) => d.sinif === "sabit").length;
      const acikSayi = satirlar.filter((d) => d.yazilabilir).length;
      bag.textAlign = "right";
      bag.fillText(`${satirlar.length} tel · ${sabitSayi} sabit · ${acikSayi} açık`,
        o.genislik - kenar, o.yukseklik - altYuk / 2);
      bag.textAlign = "left";
    }
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

    oku(ad) { return durum.oku(ad); },
    secili() { return secim; },
    panoBagla(p) { pano = p; yuzey.kirlet(); },
    sec: secimiKur,
    hedef: cozumle,
    tikla(u, v) {
      const h = cozumle(u, v);
      if (h === null) return false;
      if (h === GERI) { secimiKur(null); return true; }

      const [dugmeAdi, islem] = h.split("\u0000");
      if (islem === undefined) { secimiKur(dugmeAdi!); return true; }
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
      // yazmanın sessiz geçmesi en kötü hâl olurdu — kullanıcı bastığını
      // sanar, değer değişmez ve nedenini hiç öğrenmez.
      const mevcut = pano.goruntu(secim ?? "").flatMap((m) => m.dugmeler)
        .find((d) => d.ad === dugmeAdi);
      if (!mevcut || typeof mevcut.deger !== "number") return false;

      const adim = mevcut.adim || 1;
      const hedef = mevcut.deger + (islem === "artir" ? adim : -adim);
      // Sınıf kapısına göre yol ayrılır: güvenli olan doğrudan yazılır,
      // teyit isteyen teyit ekranını AÇAR. Karar panoda, panelde değil —
      // panelin kapıyı kendi yorumlaması ikinci bir doğruluk kaynağı olurdu.
      const s = mevcut.yazilabilir
        ? pano.yaz(dugmeAdi!, hedef)
        : pano.teyitIste(dugmeAdi!, hedef);
      sonYazma = s.oldu
        ? `${mevcut.etiket} = ${s.deger}${mevcut.birim ? " " + mevcut.birim : ""}`
        : `reddedildi: ${s.sebep}`;
      // "teyit bekleniyor" bir RET değil, bir sonraki adım. Kırmızı
      // göstermek kullanıcıya bir şeyin bozulduğunu söylerdi.
      if (!s.oldu && s.sebep === "teyit bekleniyor") sonYazma = "";
      sonYazmaAn = Date.now();
      yuzey.kirlet();
      return true;
    },

    yokEt() { yuzey.yokEt(); },
  };
}

// ── Çizim yardımcıları ─────────────────────────────────────────────────────

/** İki kutu arasına ok çizer: kaynağın sağ kenarından hedefin sol kenarına. */
function okCiz(bag: CanvasRenderingContext2D, a: Kutu, b: Kutu): void {
  const ax = a.x + a.g, ay = a.y + a.yuk / 2;
  const bx = b.x, by = b.y + b.yuk / 2;

  bag.beginPath();
  if (Math.abs(ay - by) < 1) {
    bag.moveTo(ax, ay); bag.lineTo(bx, by);
  } else {
    // Dirsekli yol: yatay çık, dikey in, yatay gir. Çapraz çizgiden okunur.
    const orta = ax + (bx - ax) * 0.5;
    bag.moveTo(ax, ay); bag.lineTo(orta, ay); bag.lineTo(orta, by); bag.lineTo(bx, by);
  }
  bag.stroke();

  // Uç: küçük üçgen.
  const u = Math.max(3, a.yuk * 0.14);
  bag.beginPath();
  bag.moveTo(bx, by);
  bag.lineTo(bx - u, by - u * 0.55);
  bag.lineTo(bx - u, by + u * 0.55);
  bag.closePath();
  bag.fillStyle = bag.strokeStyle as string;
  bag.fill();
}

/** `#rrggbb` iki rengi `t` oranında karıştırır. Parıltı geçişleri için. */
function karistir(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const ay = coz(a), by = coz(b);
  const c = (i: number) => Math.round(ay[i]! + (by[i]! - ay[i]!) * k);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}

function coz(renk: string): [number, number, number] {
  const h = renk.replace("#", "");
  const g = h.length === 3
    ? [h[0]! + h[0]!, h[1]! + h[1]!, h[2]! + h[2]!]
    : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  return [parseInt(g[0]!, 16) || 0, parseInt(g[1]!, 16) || 0, parseInt(g[2]!, 16) || 0];
}

/** Genişliğe sığmayan metni `…` ile kısaltır — taşan yazı şemayı bozar. */
function kirp(bag: CanvasRenderingContext2D, metin: string, enFazla: number): string {
  if (bag.measureText(metin).width <= enFazla) return metin;
  let s = metin;
  while (s.length > 1 && bag.measureText(`${s}…`).width > enFazla) s = s.slice(0, -1);
  return `${s}…`;
}

/** Metni genişliğe göre satırlara böler — taşan cümle paneli bozar. */
function satirla(
  bag: CanvasRenderingContext2D, metin: string, enFazla: number,
): string[] {
  const kelimeler = metin.split(/\s+/).filter(Boolean);
  if (!kelimeler.length) return [""];
  const satirlar: string[] = [];
  let simdiki = kelimeler[0]!;
  for (const k of kelimeler.slice(1)) {
    const aday = `${simdiki} ${k}`;
    if (bag.measureText(aday).width <= enFazla) simdiki = aday;
    else { satirlar.push(simdiki); simdiki = k; }
  }
  satirlar.push(simdiki);
  return satirlar;
}

/**
 * "ne kadar önce" — insan ölçeğinde.
 *
 * Ham epoch damgası gösterilmiyor: duvardaki panelden 13 haneli sayı okumak
 * bilgi değil gürültüdür. Soru "şimdi mi çalıştı, dün mü".
 */
function suredenBeri(an: number, simdi: number): string {
  if (!an) return "hiç";
  const gecen = Math.max(0, simdi - an);
  if (gecen < 1000) return "şimdi";
  if (gecen < 60_000) return `${(gecen / 1000).toFixed(1)} sn`;
  if (gecen < 3_600_000) return `${Math.round(gecen / 60_000)} dk`;
  return `${Math.round(gecen / 3_600_000)} sa`;
}

/** Düğüm adını panelde görünen etikete çevirir; bilinmiyorsa adın kendisi. */
function etiketAl(ad: string): string {
  return dugumTanim(ad)?.etiket ?? ad;
}

/** Etki ekseninin kısa yazısı — sütun dar, cümle sığmaz. */
const ETKI_YAZI: Record<Etki, string> = {
  aninda: "anında",
  sonraki_tur: "sonraki tur",
  yeniden_kurulum: "yeniden kurulum",
};

/** Sınıf rozetinin rengi ve harfi. Tehlike EKSENİ, etki ekseninden ayrı. */
const ROZET: Record<Sinif, { yazi: string; renk: string }> = {
  sabit:      { yazi: "SABİT",  renk: RENK.cerceve },
  olculmus:   { yazi: "ÖLÇÜM",  renk: RENK.uyari },
  guvenli:    { yazi: "AYAR",   renk: RENK.iyi },
  tehlikeli:  { yazi: "RİSK",   renk: RENK.kotu },
};

/**
 * Sınıf rozeti. Çerçeveli, dolgusuz: dolgu satırı ağırlaştırıp gözü
 * değerden çalıyordu — rozet uyarıdır, başlık değil.
 */
function rozetCiz(
  bag: CanvasRenderingContext2D, x: number, merkez: number, boy: number, sinif: Sinif,
): void {
  const r = ROZET[sinif];
  bag.font = `600 ${boy}px ${YAZI.tek}`;
  const g = bag.measureText(r.yazi).width + boy * 0.9;
  const yuk = boy * 1.7;
  yuvarlakKutu(bag, x, merkez - yuk / 2, g, yuk, yuk * 0.28);
  bag.strokeStyle = r.renk;
  bag.lineWidth = Math.max(1, Math.round(boy * 0.09));
  bag.stroke();
  bag.fillStyle = r.renk;
  bag.textAlign = "center";
  bag.fillText(r.yazi, x + g / 2, merkez);
  bag.textAlign = "left";
}

/** Değeri panelde okunur yaz: boolean "evet/hayır", sayı olduğu gibi. */
function degerYaz(d: DugmeGoruntu["deger"]): string {
  if (d === null) return "—";
  if (typeof d === "boolean") return d ? "evet" : "hayır";
  return String(d);
}
