// uygulama/graf/grafCalistirici.ts — ▶ / ■ DENETİMCİSİ (spec 35 dilim 1): aynı anda TEK çalışma, canlı satır, son sonuç. SAF: DOM yok.
//
// Graf sekmesinin ▶ ve ■ düğmeleri yalnız bununla konuşur. Kurallar:
//   • Aynı anda tek çalışma: ikinci ▶ nedenle reddedilir (iki program aynı bedeni aynı anda sürmesin; ■ hangisini durduracağını bilsin).
//   • Çalıştırılan, ▶ ANINDAKİ grafiktir (kopya alınır): çalışırken dosyayı kaydetmek süren çalışmayı değiştirmez. Desenler çağrı anında depodan okunur.
//   • ÇALIŞTIRMA YALNIZ OZYN'İN TUŞUYLA: `calistir` yalnız Graf sekmesinin ▶ tıklamasından çağrılır (bekçi: grafCalistirici.test.ts "▶ tek yerden");
//     Orion'un araç yüzeyinde grafik çalıştıran bir yol yoktur (dilim 4'te bile yalnız `dunya_oner`: önerir, çalıştırmaz).
// Canlı satır: şu anki düğüm (kimlik + tür adı) ve desen derinliği; son sonuç: bitti/durdu/hata + hangi düğüm (desen içindeyse desenin adı).
"use strict";
import type { Graf } from "../../protocol/graf.ts";
import type { DugumKaydi, NpcBaglami } from "./dugumKaydi.ts";
import { grafTurDenetle } from "./grafTurDenetimi.ts";
import type { GrafDurumDeposu } from "./grafDurumu.ts";
import { grafCalistir, type Calisma, type CalismaSinirlari } from "./yorumlayici.ts";
import type { CalismaGunlugu } from "./calismaGunlugu.ts";
import type { HataAyiklayici } from "./hataAyiklayici.ts";

export interface SuankiDugum { graf: string; id: string; tip: string; ad: string; derinlik: number }

export interface SonCalisma {
  graf: string;
  durum: "bitti" | "durdu" | "hata";
  adim: number;
  sureMs: number;
  hata?: string;
  /** Hatalı düğüm (bulunabildiyse türüyle). */
  hataDugumu?: SuankiDugum;
  /** Durunca/hata olunca son başlayan düğüm. */
  sonDugum?: SuankiDugum;
}

export interface CalistiriciDurumu {
  calisiyor: { graf: string; baslangic: number; suan: SuankiDugum | null } | null;
  son: SonCalisma | null;
}

/** Grafiklerin ve desenlerin kaynağı (grafik deposu). */
export interface GrafKaynagi {
  al(ad: string): Graf | null;
  desen(ad: string): Graf | null;
}

/** Bir grafik çalışmasının ortak dünyası: ▶ çalıştırıcısı da olay dinleyicisi de (grafDinleyici.ts) bununla kurulur. */
export interface CalismaTabani<Y> {
  kayit: DugumKaydi<Y>;
  depo: GrafKaynagi;
  yetenek: Y;
  /** Ajan defterinin kimlikleri (denetimde "Ajan seç"). */
  ajanlar: () => readonly string[];
  simdi?: () => number;
  uyu?: (ms: number) => Promise<void>;
  sinir?: Partial<CalismaSinirlari>;
  /** Günlük satırı (başladı / bitti / durdu / hata): Ozyn sonradan "ne oldu" diye bakabilsin. */
  gunluk?: (seviye: "bilgi" | "iyi" | "uyari" | "hata", metin: string) => void;
  /** Grafiklerin bellekteki değişkenleri (dilim 2); grafik başına ad alanı. Verilmezse değişken düğümleri nedenle düşer. */
  durum?: GrafDurumDeposu;
  /** Yerel saat (0–24): "Gün vakti" düğümü; varsayılan bilgisayarın saati. */
  saat?: () => number;
  /** Her çalışma bitince (bitti/durdu/hata, hangi yoldan başlarsa başlasın): aktörlere yazılan geçici değerlerin süpürülmesi için (spec 43 A3 kod incelemesi). */
  bitince?: () => void;
}

/** Kullanıcı tetikli çalışmaların hata ayıklama yüzü (spec 43 A4): kesme noktası/adım adım ve çalışma günlüğü. ⚡ dinleme çalışmalarına VERİLMEZ. */
export interface HataAyiklamaAyari {
  ayiklayici?: HataAyiklayici;
  gunlukDefteri?: CalismaGunlugu;
}

export interface GrafCalistiriciAyari<Y> extends CalismaTabani<Y>, HataAyiklamaAyari {
  /**
   * Bu grafik BAŞKA YOLDAN çalışıyorsa nedeni (dilim 2: dinlemedeki grafiğin olay çalışması). "Aynı grafik aynı anda tek çalışma": ▶ o sırada başlamaz —
   * aynı NPC programı iki kez aynı bedeni sürerdi ve değişken sayacı iki kez artardı.
   */
  mesgul?: (ad: string) => string | null;
}

/** Süren bir çalışma: ■ için `calisma`, bitince son sonucu veren söz. */
export interface BaslamisCalisma {
  readonly calisma: Calisma;
  readonly bitis: Promise<SonCalisma>;
}

/**
 * TEK ÇALIŞMA ÇEKİRDEĞİ: kopyalanmış grafiği yorumlayıcıyla başlatır; canlı düğümü (saf düğümler hariç) `suan`a bildirir ve bitince son sonucu
 * (hangi düğüm, desen içindeyse desenin adı) kurar. ▶ çalıştırıcısı ve olay dinleyicisi bunu paylaşır: ikinci kopya olsaydı biri "saf düğüm canlı
 * satırda görünmez" kuralını ya da hata yerini unuturdu.
 */
export function calismaBaslat<Y>(g: Graf, a: CalismaTabani<Y>, ek: { giris?: { dugum: string; veri?: Readonly<Record<string, unknown>> }; suan?: (d: SuankiDugum) => void; ben?: NpcBaglami | null; aktor?: string | null; kaynak?: string } & HataAyiklamaAyari = {}): BaslamisCalisma {
  const simdi = a.simdi ?? (() => Date.now());
  const baslangic = simdi();
  const durum = a.durum;
  let son: SuankiDugum | null = null;
  /** Düğümün türü ve görünen adı: kök grafikte ya da (desen çerçevesindeyse) desende aranır. */
  const dugumBilgisi = (graf: string, id: string, derinlik: number): SuankiDugum => {
    const kaynak = graf === g.ad ? g : a.depo.desen(graf);
    const tip = kaynak?.dugumler.find((d) => d.id === id)?.tip ?? "?";
    return { graf, id, tip, ad: a.kayit.al(tip)?.ad ?? tip, derinlik };
  };
  // Hata ayıklama (spec 43 A4): kesme noktası kancası + günlük satırı. Yalnız çağıran verdiyse (kullanıcı tetikli çalışma).
  const kaynak = ek.kaynak ?? `▶ ${g.ad}`;
  const ayik = ek.ayiklayici?.calisma(kaynak);
  const calisma = grafCalistir(g, {
    ...(ayik ? { duraklat: ayik.duraklat } : {}),
    kayit: a.kayit, desen: (x) => a.depo.desen(x), ajanlar: a.ajanlar, yetenek: a.yetenek,
    ...(a.simdi ? { simdi: a.simdi } : {}), ...(a.uyu ? { uyu: a.uyu } : {}), ...(a.sinir ? { sinir: a.sinir } : {}),
    ...(durum ? { degiskenler: durum.alan(g.ad), ajanDegiskenleri: (x: string) => durum.ajanAlani(x) } : {}), ...(a.saat ? { saat: a.saat } : {}),
    ...(ek.giris ? { giris: ek.giris } : {}),
    // `@ben` (dilim 3): ▶ çalıştırıcısı vermez (null: @ben'li grafik nedenle düşer), dinleyici NPC'nin kaydından verir.
    ben: ek.ben ?? null,
    // `@bu` (spec 43): yalnız aktörün Details'inden ▶ verir; Graf sekmesi ve dinleyici null (aktörsüz grafik `@bu`da nedenle düşer).
    aktor: ek.aktor ?? null,
    olay: (o) => {
      if (o.tur === "dugumBitti" && ek.gunlukDefteri) {
        const b = dugumBilgisi(o.graf, o.id, o.derinlik);
        ek.gunlukDefteri.ekle({ kaynak, graf: o.graf, id: o.id, tip: b.tip, ad: b.ad, derinlik: o.derinlik, girdi: o.girdi, cikti: o.cikti, sonra: o.sonra, ms: o.ms });
        return;
      }
      if (o.tur === "hata" && ek.gunlukDefteri) {
        const b = o.id ? dugumBilgisi(o.graf, o.id, 0) : null;
        ek.gunlukDefteri.ekle({ kaynak, graf: o.graf, id: o.id ?? "-", tip: b?.tip ?? "", ad: b?.ad ?? "", derinlik: o.graf === g.ad ? 0 : 1, girdi: {}, cikti: {}, sonra: null, ms: 0, hata: o.mesaj });
        return;
      }
      if (o.tur !== "dugum") return;
      const b = dugumBilgisi(o.graf, o.id, o.derinlik);
      // SAF düğümler (Ajan seç, Nesne bul, Sayı) bir akış düğümünün girişi okunurken anlık hesaplanır: canlı satır onları göstermez, yoksa satır
      // "Git yürüyor" yerine "Ajan seç" derdi (ilk denemede tam olarak bu görüldü). Hataları yine kendi adıyla döner (`hataDugumu`).
      if (a.kayit.al(b.tip)?.saf) return;
      son = b;
      ek.suan?.(b);
    },
  });
  // `finally`: sonuç reddedilse de bekleyen duraklamalar temizlenir ve çalışan kalmadıysa adım modu kapanır; geçici yazmalar süpürülür.
  const bitis = calisma.sonuc.finally(() => {
    ayik?.bitir();
    try { a.bitince?.(); } catch (err) { console.error("[graf] bitince hatası:", err); }
  }).then((s): SonCalisma => {
    const hataDugumu = s.hataDugumu ? dugumBilgisi(s.hataGrafi ?? g.ad, s.hataDugumu, son?.derinlik ?? 0) : undefined;
    return {
      graf: g.ad, durum: s.durum, adim: s.adim, sureMs: simdi() - baslangic,
      ...(s.hata ? { hata: s.hata } : {}), ...(hataDugumu ? { hataDugumu } : {}), ...(son ? { sonDugum: son } : {}),
    };
  });
  return { calisma, bitis };
}

export interface GrafCalistirici {
  /** ▶ (yalnız Ozyn'in tıklaması). Başlamadıysa nedeni. */
  calistir(ad: string): { ok: true } | { ok: false; neden: string };
  /** ■: süren çalışmayı durdurur; çalışma yoksa false. */
  durdur(): boolean;
  durum(): CalistiriciDurumu;
  /** "Kontrol et": tür denetimi (biçim hatası deponun işi). Boş liste = çalıştırılabilir. */
  kontrol(g: Graf): string[];
  dinle(f: (d: CalistiriciDurumu) => void): () => void;
  /** Süren çalışma bitene dek (yoksa hemen). Testler ve kapanış için. */
  bitti(): Promise<void>;
}

export function grafCalistiriciKur<Y>(a: GrafCalistiriciAyari<Y>): GrafCalistirici {
  const simdi = a.simdi ?? (() => Date.now());
  const dinleyiciler = new Set<(d: CalistiriciDurumu) => void>();
  let durum: CalistiriciDurumu = { calisiyor: null, son: null };
  let calisma: Calisma | null = null;
  let suren: Promise<void> = Promise.resolve();

  const yay = () => {
    for (const f of [...dinleyiciler]) {
      try { f(durum); } catch (err) { console.error("[graf] çalıştırıcı dinleyicisi hatası:", err); }
    }
  };

  return {
    calistir(ad) {
      if (durum.calisiyor) return { ok: false, neden: `zaten çalışıyor: '${durum.calisiyor.graf}' (önce ■ Durdur)` };
      const kaynak = a.depo.al(ad);
      if (!kaynak) return { ok: false, neden: `'${ad}' yüklenemedi ya da bozuk (Kontrol et)` };
      if (kaynak.tur !== "olay") return { ok: false, neden: `'${ad}' bir desen: tek başına çalışmaz, bir grafikte 'Desen' düğümüyle çağrılır` };
      const baska = a.mesgul?.(ad);
      if (baska) return { ok: false, neden: `'${ad}' ${baska} (aynı grafik aynı anda tek çalışma; önce ■ Durdur)` };
      const g: Graf = structuredClone(kaynak);
      durum = { calisiyor: { graf: g.ad, baslangic: simdi(), suan: null }, son: durum.son };
      a.gunluk?.("bilgi", `▶ ${g.ad} çalışıyor`);
      const b = calismaBaslat(g, a, {
        ...(a.ayiklayici ? { ayiklayici: a.ayiklayici } : {}), ...(a.gunlukDefteri ? { gunlukDefteri: a.gunlukDefteri } : {}),
        suan: (d) => {
          if (!durum.calisiyor) return;
          durum = { ...durum, calisiyor: { ...durum.calisiyor, suan: d } };
          yay();
        },
      });
      calisma = b.calisma;
      yay();
      suren = b.bitis.then((sonuc) => {
        calisma = null;
        durum = { calisiyor: null, son: sonuc };
        a.gunluk?.(sonuc.durum === "bitti" ? "iyi" : sonuc.durum === "durdu" ? "uyari" : "hata", sonucSatiri(sonuc));
        yay();
      });
      return { ok: true };
    },
    durdur() {
      if (!calisma) return false;
      calisma.durdur();
      return true;
    },
    durum: () => durum,
    kontrol: (g) => grafTurDenetle(g, a.kayit, { desen: (x) => a.depo.desen(x), buGraf: null, ajanlar: a.ajanlar }),
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    bitti: () => suren,
  };
}

const sn = (ms: number): string => `${(ms / 1000).toFixed(1)} sn`;
const dugumYazisi = (d: SuankiDugum): string => `${d.id} (${d.ad})`;

/** Çalışırken görünen satır: hangi grafik, şu anki düğüm, desen derinliği, geçen süre. */
export function canliSatir(d: CalistiriciDurumu, simdi: number): string {
  const c = d.calisiyor;
  if (!c) return "";
  const s = c.suan;
  const yer = !s ? "başlıyor…" : `${dugumYazisi(s)}${s.derinlik > 0 ? ` · desen '${s.graf}' (derinlik ${s.derinlik})` : ""}`;
  return `▶ ${c.graf} · ${yer} · ${sn(simdi - c.baslangic)}`;
}

/** Son sonucun tek satırı (sekme ve günlük aynı metni yazar). */
export function sonucSatiri(s: SonCalisma): string {
  if (s.durum === "bitti") return `✓ ${s.graf} bitti · ${s.adim} adım · ${sn(s.sureMs)}`;
  if (s.durum === "durdu") return `■ ${s.graf} durduruldu${s.sonDugum ? ` · son düğüm: ${dugumYazisi(s.sonDugum)}` : ""} · ${s.adim} adım`;
  const yer = s.hataDugumu ? `${dugumYazisi(s.hataDugumu)}${s.hataDugumu.graf !== s.graf ? ` [desen '${s.hataDugumu.graf}']` : ""}: ` : "";
  return `✗ ${s.graf}: ${yer}${s.hata ?? "bilinmeyen hata"}`;
}
