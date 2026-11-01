// uygulama/yapi/level/nesnelerPaneli.ts — NESNELER PANELİ (spec 43 A5; Unreal Outliner'ın nesne kısmı + Details). DOM katmanı; satırlar `nesneModeli.ts`te (testli).
//
// Açık level'ın yerleştirilmiş nesnelerini (glb) listeler, seçileni Details'te gösterir: şemadaki alanlar (konum, dönüş, ölçek, gizli, kilitli), graf seçimi + ▶ ■, değişkenler.
// Ortak çizici `detayCiz` (ışık paneliyle AYNI); yazma yolu tek: `bilesen.ts` işlemi → `level.ayarla` (level doğrular, bozuksa eski hâlinde kalır, neden altyazıda).
// KAYDETMEZ: nesne değişiklikleri oturum içidir (diske yazılan tek şey Işıklar panelindeki ışık listesidir; nesne yerleşimi asset menüsünün işi). Bu yüzden "● oturum içi" rozeti.
// Mesh/ses/tetik bileşenleri YOK: yeni nesne türü kurulumu `nesneSistemi.ts` değişikliği ister (spec 43 §9). Dok paneli (Pencere ▸ Nesneler), ilk açılışta kapalı.
"use strict";
import type { Level } from "../../../world/level/cekirdek/levelKur.ts";
import type { LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";
import { alanYaz, degiskenYaz, grafAta } from "../../../world/level/cekirdek/bilesen.ts";
import type { Vec3 } from "../../../world/level/cekirdek/levelTanimi.ts";
import { YAPI_RENK as R } from "../../../world/arayuz/arayuzJetonlari.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import type { DokYoneticisi } from "../ortak/dok/dokYoneticisi.ts";
import { glbdenSablon } from "../../aktor/sablon/aktorSablonu.ts";
import { bilesenAdiYaz, bilesenAyarYaz, bilesenEkle, bilesenleriEkle, bilesenSil, ustAta } from "../../aktor/sablon/bilesenIslemleri.ts";
import type { GlbDugumOkuma } from "../../aktor/sablon/glbDugumleri.ts";
import { bilesenDetayCiz } from "./bilesenDetayPaneli.ts";
import { DETAY_CSS, detayCiz } from "./detayPaneli.ts";
import { levelPaneliStiliEkle } from "./isiklarPaneli.ts";
import { nesneListesi } from "./nesneModeli.ts";
import { sablonCubuguKur, type SablonDosyalari } from "./sablonCubugu.ts";
import { taslakCubuguKur } from "./taslakCubugu.ts";
import type { TaslakDosyalari } from "../../aktor/taslak/taslakIslemleri.ts";

export const NESNELER_PANELI_KIMLIGI = "nesneler";

export interface NesnelerPaneliAyari {
  dok: DokYoneticisi;
  level: () => Level | null;
  altyazi: (metin: string, ms?: number) => void;
  /** Grafik deposundaki olay grafiklerinin adları (Details'te graf seçimi). */
  grafAdlari?: () => readonly string[];
  /** Graf satırının yanındaki düğmeler (▶ ■): aktör kimliği ve seçili graf. */
  grafEylemleri?: (id: string, graf: string | null) => HTMLElement[];
  /** Şablon dosyaları (Content/Actors; host IPC). Verilmezse Şablon çubuğu çizilmez (Electron'suz ortam). */
  sablonDosyalari?: SablonDosyalari;
  /** Orion taslakları (Content/Drafts; B8). Verilmezse Taslak çubuğu çizilmez. */
  taslakDosyalari?: TaslakDosyalari;
  /** Yeni şablon nesnesinin konumu (örn. kamera önü). */
  yerlestirmeKonumu?: () => Vec3;
  /** Yerleştirilmiş nesnenin glb düğümleri (`soket_<ad>`; B7). Verilmezse "glb soketleri" düğmesi çizilmez. */
  glbDugumleri?: (id: string) => GlbDugumOkuma;
  /** Panel işlemlerinin izi (kodlu hata / bilgi); `giris.ts` aktör günlüğüne bağlar. Verilmezse yalnız altyazı. */
  iz?: (seviye: "bilgi" | "uyari" | "hata", metin: string) => void;
}
export interface NesnelerPaneli {
  readonly kok: HTMLElement;
  tazele(): void;
  /** Diske yazılmayan (yeniden başlatmada giden) nesne değişikliği var mı. */
  oturumIci(): boolean;
  secili(): string | null;
  /** Nesneyi seç; listede olmayan kimlikte değişmez. */
  sec(id: string): void;
}

const EK_CSS = `
.nl-ara { flex: 1; min-width: 0; background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 6px; font: inherit; user-select: text; }
.nl-graf { color: ${R.vurgu}; font-size: 11px; }
.nl-dal { color: ${R.yaziSoluk}; font-size: 11px; margin-right: 3px; }
${DETAY_CSS}
`;
let ekStilEklendi = false;
const dugme = dugmeYap("");

export function nesnelerPaneliKur(a: NesnelerPaneliAyari): NesnelerPaneli {
  levelPaneliStiliEkle();
  if (!ekStilEklendi) { const s = document.createElement("style"); s.textContent = EK_CSS; document.head.append(s); ekStilEklendi = true; }
  const kok = el("div", "il-kok"); kok.tabIndex = 0;
  const ara = el("input", "nl-ara"); ara.type = "text"; ara.placeholder = "nesne ara (ad ya da kimlik)";
  const rozet = el("span", "il-rozet");
  const arac = el("div", "il-arac"); arac.append(ara, rozet);
  const liste = el("div", "il-liste"), detay = el("div", "il-detay"), durum = el("div", "il-durum");
  kok.append(arac, liste);
  let sablonlariYenile: (() => Promise<void>) | null = null;
  if (a.sablonDosyalari) {
    const sablon = sablonCubuguKur({
      dosyalar: a.sablonDosyalari,
      tanim: () => a.level()?.tanim() ?? null,
      secili: () => secili,
      ...(a.yerlestirmeKonumu ? { yerlestirmeKonumu: a.yerlestirmeKonumu } : {}),
      uygula: (f) => uygula(f),
      sec: (id) => { secili = id; tazele(); },
      altyazi: a.altyazi,
      iz: (sv, m) => a.iz?.(sv, m),
    });
    sablonlariYenile = sablon.yenile;
    kok.append(sablon.kok);
  }
  if (a.taslakDosyalari) {
    kok.append(taslakCubuguKur({
      dosyalar: a.taslakDosyalari, altyazi: a.altyazi, iz: (sv, m) => a.iz?.(sv, m),
      onaylandi: () => { void sablonlariYenile?.(); },   // onaylanan şablon listede kendiliğinden görünsün (R34-5)
    }));
  }
  kok.append(detay, durum);

  let secili: string | null = null;
  let ilkImza: string | null = null;
  const imza = (t: LevelTanimi): string => JSON.stringify(t.nesneler ?? []);

  /** Tanımı dönüştür → canlı uygula (ışık paneliyle aynı kural). */
  function uygula(f: (t: LevelTanimi) => { ok: true; deger: LevelTanimi } | { ok: false; neden: string }): void {
    const l = a.level(); if (!l) { a.altyazi("level hazır değil", 1800); return; }
    if (ilkImza === null) ilkImza = imza(l.tanim());
    const r = f(l.tanim());
    if (!r.ok) { a.altyazi(`nesne: ${r.neden}`, 3000); tazele(); return; }
    try { l.ayarla(r.deger); } catch (e) { a.altyazi(`nesne uygulanamadı: ${e instanceof Error ? e.message : String(e)}`, 4000); }
    tazele();
  }

  function detayCizHepsi(id: string | null): void {
    detay.replaceChildren();
    const l = a.level();
    if (!id || !l) { detay.append(el("div", "il-bos", "Listeden bir nesne seç")); detay.style.display = "block"; return; }
    detay.style.display = "grid";
    const ad = l.tanim().nesneler?.find((n) => n.id === id)?.ad ?? "";
    detayCiz({
      hedef: detay, tanim: () => l.tanim(), id, grafAdlari: () => a.grafAdlari?.() ?? [],
      ad: { deger: ad, yaz: (v) => uygula((t) => adYaz(t, id, v)) },
      alanYaz: (alan, deger) => uygula((t) => alanYaz(t, id, alan, deger)),
      grafAta: (graf) => uygula((t) => grafAta(t, id, graf)),
      degiskenYaz: (d, v) => uygula((t) => degiskenYaz(t, id, d, v)),
      bildir: (m) => a.altyazi(m, 2500),
      ...(a.grafEylemleri ? { grafEylemleri: (graf: string | null) => a.grafEylemleri!(id, graf) } : {}),
    });
    bilesenDetayCiz({
      hedef: detay, tanim: () => l.tanim(), id,
      ekle: (tur) => uygula((t) => { const r = bilesenEkle(t, id, tur); if (r.ok) a.iz?.("bilgi", `bileşen eklendi: ${id}.${r.deger.bilesenId} (${tur})`); return r.ok ? { ok: true, deger: r.deger.tanim } : r; }),
      sil: (b) => uygula((t) => { const r = bilesenSil(t, id, b); if (r.ok) a.iz?.("bilgi", `bileşen silindi: ${id}.${b}`); return r; }),
      ayarYaz: (b, alan, deger) => uygula((t) => bilesenAyarYaz(t, id, b, alan, deger)),
      adYaz: (b, ad) => uygula((t) => bilesenAdiYaz(t, id, b, ad)),
      ustYaz: (ust, soket) => uygula((t) => { const r = ustAta(t, id, ust, soket); if (r.ok) a.iz?.("bilgi", `hiyerarşi: ${id} → ${ust ?? "(yok)"}${soket ? `:${soket}` : ""}`); return r; }),
      ...(a.glbDugumleri ? { glbSoketleriniEkle: () => glbSoketleriniEkle(id) } : {}),
    });
  }

  /** Nesnenin glb'sindeki `soket_<ad>` düğümlerini soket bileşeni olarak ekler (aynı adlı soket atlanır; atlanan/uyarı altyazıda ve izde). */
  function glbSoketleriniEkle(id: string): void {
    const o = a.glbDugumleri?.(id);
    if (!o) return;
    if (!o.ok) { a.altyazi(o.neden, 4000); a.iz?.("hata", o.neden); return; }
    const varlik = a.level()?.tanim().nesneler?.find((n) => n.id === id)?.varlik ?? "";
    // `glbdenSablon` ad/varlık ister (sahte ad: yalnız doğrulamadan geçmek için; çıktıdan yalnız bileşenler alınır).
    const s = glbdenSablon("glb", varlik || "x.glb", o.dugumler);
    if (!s.ok) { a.altyazi(s.neden, 4000); a.iz?.("hata", s.neden); return; }
    for (const u of s.deger.uyarilar) a.iz?.("uyari", u);
    const yeni = s.deger.sablon.aktorler[0]?.nesne?.bilesenler ?? [];
    if (!yeni.length) { a.altyazi(s.deger.uyarilar.length ? `soket eklenemedi: ${s.deger.uyarilar[0]}` : "Bu glb'de 'soket_<ad>' adlı düğüm yok", 4000); return; }
    uygula((t) => {
      const r = bilesenleriEkle(t, id, yeni);
      if (!r.ok) return r;
      const m = `glb soketleri: ${r.deger.eklenen} eklendi${r.deger.atlanan.length ? `, ${r.deger.atlanan.length} zaten vardı (${r.deger.atlanan.join(", ")})` : ""}${s.deger.uyarilar.length ? `, ${s.deger.uyarilar.length} uyarı` : ""}`;
      a.altyazi(m, 3500); a.iz?.("bilgi", `${id}: ${m}`);
      return { ok: true, deger: r.deger.tanim };
    });
  }

  /** Panelden yapılmış, diske yazılmayan nesne değişikliği var mı (yeniden başlatmada gider). */
  function oturumIci(): boolean { const t = a.level()?.tanim(); return t !== undefined && ilkImza !== null && imza(t) !== ilkImza; }

  function tazele(): void {
    const l = a.level();
    const t = l ? l.tanim() : null;
    if (t && ilkImza === null) ilkImza = imza(t);
    const r = t ? nesneListesi(t, ara.value) : { satirlar: [], toplam: 0, kesildi: false };
    if (secili && t && !(t.nesneler ?? []).some((n) => n.id === secili)) secili = null;
    liste.replaceChildren();
    if (!t) liste.append(el("div", "il-bos", "Level hazır değil"));
    else if (!r.satirlar.length) liste.append(el("div", "il-bos", ara.value.trim() ? "Eşleşen nesne yok" : "Bu level'da kimlikli nesne yok"));
    for (const s of r.satirlar) {
      const satir = el("div", "il-satir"); satir.dataset.id = s.id; satir.dataset.secili = s.id === secili ? "1" : "0"; satir.dataset.gizli = s.gizli ? "1" : "0";
      const adEl = el("span", "il-ad", `${s.kilitli ? "🔒 " : ""}${s.ad}`); adEl.title = `${s.id} · ${s.varlik}${s.ust ? ` · üst: ${s.ust}` : ""}`;
      if (s.girinti > 0) { satir.style.paddingLeft = `${8 + s.girinti * 14}px`; satir.append(el("span", "nl-dal", "└")); }
      satir.append(adEl);
      if (s.cocuk > 0) { const c = el("span", "nl-graf", `⤵${s.cocuk}`); c.title = `${s.cocuk} çocuk nesne`; satir.append(c); }
      if (s.graf) { const g = el("span", "nl-graf", `ƒ ${s.graf}`); g.title = "Bu nesnenin grafı var"; satir.append(g); }
      satir.addEventListener("click", () => { secili = s.id; tazele(); });
      liste.append(satir);
    }
    detayCizHepsi(secili);
    const kirli = oturumIci();
    rozet.textContent = kirli ? "● oturum içi" : "";
    rozet.title = "Nesne değişiklikleri diske yazılmaz (yalnız bu oturumda geçerli)";
    durum.textContent = `${r.toplam} nesne${r.kesildi ? " (liste kesildi: ara)" : ""}${secili ? ` · seçili: ${secili}` : ""}`;
  }

  ara.addEventListener("input", () => tazele());
  kok.addEventListener("keydown", (e) => { if (e.target instanceof HTMLInputElement && e.target.type !== "color") e.stopPropagation(); });
  kok.addEventListener("keyup", (e) => { if (e.target instanceof HTMLInputElement) e.stopPropagation(); });

  a.dok.kaydet({
    kayit: { id: NESNELER_PANELI_KIMLIGI, ad: "Nesneler", bolgeler: ["sol", "sag", "alt", "yuzer"], varsayilan: "sol", baslangicKapali: true },
    icerik: kok, gorunur: true, ipucu: "Level nesneleri: seç, Details'te düzenle, graf ata",
  });
  // Görünürken yavaşça tazele (asset menüsü nesne ekleyebilir); yazı/arama alanında yazarken ve görünmezken dokunma.
  setInterval(() => { if (a.dok.ekrandaMi(NESNELER_PANELI_KIMLIGI) && !kok.contains(document.activeElement)) tazele(); }, 1000);
  tazele();

  return {
    kok, tazele, oturumIci, secili: () => secili,
    sec(id) {
      const t = a.level()?.tanim();
      if (!t || !(t.nesneler ?? []).some((n) => n.id === id)) return;
      secili = id; tazele();
    },
  };
}

/** Görünen adı yazar (boş = `ad` alanı kalkar, varlığın kısa adına döner). Doğrulamayı `level.ayarla` yapar (bozuk sonuç eski hâlinde kalır). */
function adYaz(t: LevelTanimi, id: string, ad: string): { ok: true; deger: LevelTanimi } | { ok: false; neden: string } {
  const nesneler = (t.nesneler ?? []).map((n) => {
    if (n.id !== id) return n;
    const { ad: _eski, ...gerisi } = n;
    return ad.trim() ? { ...gerisi, ad: ad.trim() } : gerisi;
  });
  return { ok: true, deger: { ...t, nesneler } };
}
