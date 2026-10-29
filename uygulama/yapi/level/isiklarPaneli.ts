// uygulama/yapi/level/isiklarPaneli.ts — IŞIKLAR PANELİ (spec 42 Y4; Unreal'da Place Actors ▸ Lights + Outliner + Details'in ışık parçası). DOM katmanı; işlemler `isikModeli.ts`te (testli).
//
// AÇIK level'ın (birleşik dünyanın ova'sı) ışık aktörleri: "+ Nokta ışık" önüne yeni ışık koyar, listeden seçilir, altında Details alanları (ad, konum, renk, şiddet, menzil, göz = gizle, sil).
// Her değişiklik `level.ayarla(yeni)` ile CANLI uygulanır (level doğrular; bozuksa eski hâline döner, neden altyazıda). Diske YALNIZ ışık listesi yazılır ve YALNIZ Ozyn'in gerçek tıklamasıyla
// (💾 Kaydet; `isTrusted`): açık projenin level dosyası okunur, `isiklar` alanı değiştirilir, geri yazılır (G penceresi/ortam komutu gibi geçici ayarlar dosyaya sızmaz). Kaydedilmemiş fark rozetle görünür.
// Dok paneli (Pencere ▸ Işıklar), ilk açılışta kapalı. Tuşlar yazı alanında oyuna sızmaz.
"use strict";
import type { Level } from "../../../world/level/cekirdek/levelKur.ts";
import { ISIK_TAVANI, type IsikAktoru, type Vec3 } from "../../../world/level/cekirdek/levelTanimi.ts";
import type { Kopru } from "../../../host/kopru.ts";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../world/arayuz/arayuzJetonlari.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import type { DokYoneticisi } from "../ortak/dok/dokYoneticisi.ts";
import { diskeYaz, isikEkle, isikGuncelle, isikSil, yeniNoktaIsik } from "./isikModeli.ts";
import { alanYaz, degiskenYaz, grafAta } from "../../../world/level/cekirdek/bilesen.ts";
import { DETAY_CSS, detayCiz as detayCizici } from "./detayPaneli.ts";

export const ISIKLAR_PANELI_KIMLIGI = "isiklar";

export interface IsiklarPaneliAyari {
  dok: DokYoneticisi;
  level: () => Level | null;
  /** Yeni ışığın konumu (oyuncunun önü). */
  yeniKonum: (level: Level) => Vec3;
  /** Diske yazma kanalları (Electron'suz ortamda yok: Kaydet pasif). */
  kopru?: Pick<Kopru, "projeBilgi" | "projeLevelOku" | "projeLevelKaydet">;
  altyazi: (metin: string, ms?: number) => void;
  /** Grafik deposundaki olay grafiklerinin adları (Details'te graf seçimi). Verilmezse liste boş. */
  grafAdlari?: () => readonly string[];
  /** Graf satırının yanındaki düğmeler (▶ ■; spec 43 A3): aktör kimliği ve seçili graf. */
  grafEylemleri?: (id: string, graf: string | null) => HTMLElement[];
}
export interface IsiklarPaneli {
  readonly kok: HTMLElement;
  /** Listeyi level'dan yeniden çiz. */
  tazele(): void;
  /** Işık ekler (konum verilmezse `yeniKonum`); eklenen kimlik ya da null. */
  ekle(konum?: Vec3): string | null;
  /** Kaydedilmemiş ışık değişikliği var mı. */
  kirliMi(): boolean;
  /** Seçili kimlik (gizmo ona takılır; senaryo ölçüsü). */
  secili(): string | null;
  /** Işığı seç (sahnede işarete tıklanınca); olmayan kimlikte değişmez. */
  sec(id: string): void;
  /** Işığın konumunu yaz (gizmo bırakılınca): `level.ayarla`, kirli rozeti. */
  konumla(id: string, konum: Vec3): void;
}

const CSS = `
.il-kok { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #0c111e; color: ${R.yazi}; font: ${YAPI_YAZI.govde}; outline: none; }
.il-arac { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-bottom: 1px solid ${R.cizgi}; flex: none; }
.il-arac .il-bosluk { flex: 1; } .il-rozet { color: ${R.uyari}; font-size: 11.5px; }
.il-kok button { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 9px; font: inherit; cursor: pointer; }
.il-kok button:hover:not(:disabled) { border-color: ${R.vurgu}; color: ${R.yaziParlak}; } .il-kok button:disabled { opacity: 0.4; cursor: not-allowed; }
.il-liste { flex: none; max-height: 40%; overflow: auto; padding: 3px 0; border-bottom: 1px solid ${R.cizgi}; user-select: none; }
.il-satir { display: flex; align-items: center; gap: 8px; padding: 2px 8px; cursor: default; }
.il-satir:hover { background: rgba(255,255,255,0.05); } .il-satir[data-secili="1"] { background: rgba(255,214,64,0.16); color: ${R.yaziParlak}; }
.il-satir[data-gizli="1"] .il-ad { opacity: 0.45; text-decoration: line-through; } .il-ad { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.il-nokta { width: 11px; height: 11px; border-radius: 50%; border: 1px solid #0008; flex: none; }
.il-bos { padding: 14px; color: ${R.yaziSoluk}; text-align: center; }
.il-detay { flex: 1; min-height: 0; overflow: auto; padding: 8px 10px; display: grid; grid-template-columns: 76px 1fr; gap: 6px 8px; align-content: start; }
.il-detay label { color: ${R.yaziOrta}; align-self: center; } .il-detay .il-uc { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.il-detay input[type=text], .il-detay input[type=number] { background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 6px; font: inherit; width: 100%; box-sizing: border-box; user-select: text; min-width: 0; }
.il-detay input[type=color] { width: 44px; height: 24px; padding: 0; border: 1px solid ${R.cizgi}; background: ${R.dugme}; }
${DETAY_CSS}
.il-durum { padding: 3px 10px; border-top: 1px solid ${R.cizgi}; color: ${R.yaziSoluk}; font-size: 11.5px; flex: none; }
`;
let stilEklendi = false;
const dugme = dugmeYap("");

/** Renk metni → renk girdisi için "#rrggbb" (palet adı verilmişse sıcak beyaz: panel yalnız hex yazar). */
const hexMi = (r: string): boolean => /^#[0-9a-fA-F]{6}$/.test(r);

export function isiklarPaneliKur(a: IsiklarPaneliAyari): IsiklarPaneli {
  if (!stilEklendi) { const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); stilEklendi = true; }
  const kok = el("div", "il-kok"); kok.tabIndex = 0;
  const ekleD = dugme("+ Nokta ışık", "", "Önüne yeni bir nokta ışık koy");
  const kaydetD = dugme("💾 Kaydet", "", "Işık listesini açık projenin level dosyasına yaz (yalnız ışıklar)");
  const rozet = el("span", "il-rozet");
  const arac = el("div", "il-arac"); arac.append(ekleD, el("span", "il-bosluk"), rozet, kaydetD);
  const liste = el("div", "il-liste"), detay = el("div", "il-detay"), durum = el("div", "il-durum");
  kok.append(arac, liste, detay, durum);

  let secili: string | null = null;
  /** Son diske yazılan (ya da ilk okunan) ışık listesinin imzası: kirli = şimdikiyle farklı. */
  let kayitliImza: string | null = null;
  const isiklar = (l: Level): readonly IsikAktoru[] => l.tanim().isiklar ?? [];
  const imza = (l: readonly IsikAktoru[]): string => JSON.stringify(l);

  function kirliMi(): boolean { const l = a.level(); return l !== null && kayitliImza !== null && imza(isiklar(l)) !== kayitliImza; }

  /** Tanımı dönüştür → canlı uygula. Hata nedenle altyazıda, level eski hâlinde. */
  function uygula(f: (t: ReturnType<Level["tanim"]>) => { ok: true; deger: ReturnType<Level["tanim"]> } | { ok: false; neden: string }): boolean {
    const l = a.level(); if (!l) { a.altyazi("level hazır değil", 1800); return false; }
    // Kaydedilmiş hâl tabanı: panel hiç çizilmeden (ilk saniyede) değişiklik gelirse kirli rozeti kaybolmasın.
    if (kayitliImza === null) kayitliImza = imza(isiklar(l));
    const r = f(l.tanim());
    if (!r.ok) { a.altyazi(`ışık: ${r.neden}`, 3000); return false; }
    try { l.ayarla(r.deger); } catch (e) { a.altyazi(`ışık uygulanamadı: ${e instanceof Error ? e.message : String(e)}`, 4000); return false; }
    return true;
  }

  function ekle(konum?: Vec3): string | null {
    const l = a.level(); if (!l) { a.altyazi("level hazır değil", 1800); return null; }
    let yeniId: string | null = null;
    const tamam = uygula((t) => {
      const r = isikEkle(t, yeniNoktaIsik(konum ?? a.yeniKonum(l), t.isiklar ?? []));
      if (!r.ok) return r;
      yeniId = r.deger.id;
      return { ok: true, deger: r.deger.tanim };
    });
    if (!tamam) return null;
    secili = yeniId; tazele();
    return yeniId;
  }

  function yamala(id: string, yama: Parameters<typeof isikGuncelle>[2]): void { uygula((t) => isikGuncelle(t, id, yama)); tazele(); }

  function detayCiz(i: IsikAktoru | undefined): void {
    detay.replaceChildren();
    const l = a.level();
    if (!i || !i.id || !l) { detay.append(el("div", "il-bos", "Bir ışık seç ya da + Nokta ışık")); detay.style.display = "block"; return; }
    detay.style.display = "grid";
    const id = i.id;
    const yaz = (f: (t: ReturnType<Level["tanim"]>) => { ok: true; deger: ReturnType<Level["tanim"]> } | { ok: false; neden: string }): void => { uygula(f); tazele(); };
    detayCizici({
      hedef: detay, tanim: () => l.tanim(), id, grafAdlari: () => a.grafAdlari?.() ?? [],
      ad: { deger: i.ad ?? "", yaz: (v) => yamala(id, { ad: v }) },
      alanYaz: (ad, deger) => yaz((t) => alanYaz(t, id, ad, deger)),
      grafAta: (graf) => yaz((t) => grafAta(t, id, graf)),
      degiskenYaz: (ad, v) => yaz((t) => degiskenYaz(t, id, ad, v)),
      bildir: (m) => a.altyazi(m, 2500),
      ...(a.grafEylemleri ? { grafEylemleri: (graf: string | null) => a.grafEylemleri!(id, graf) } : {}),
    });
  }

  function tazele(): void {
    const l = a.level();
    const liste_ = l ? isiklar(l) : [];
    if (kayitliImza === null && l) kayitliImza = imza(liste_);
    if (secili && !liste_.some((i) => i.id === secili)) secili = null;
    liste.replaceChildren();
    if (!l) liste.append(el("div", "il-bos", "Level hazır değil"));
    else if (!liste_.length) liste.append(el("div", "il-bos", "Bu level'da ışık aktörü yok (güneş ve dolgu Dünya ışığıdır)"));
    for (const i of liste_) {
      const r = el("div", "il-satir"); r.dataset.id = i.id ?? ""; r.dataset.secili = i.id === secili ? "1" : "0"; r.dataset.gizli = i.gizli ? "1" : "0";
      const nokta = el("span", "il-nokta"); nokta.style.background = hexMi(i.renk) ? i.renk : "#ffd9a0";
      const goz = dugme(i.gizli ? "🚫" : "👁", "", i.gizli ? "Göster" : "Gizle"); goz.addEventListener("click", (e) => { e.stopPropagation(); if (i.id) yamala(i.id, { gizli: !i.gizli }); });
      const sil = dugme("✕", "", "Işığı sil"); sil.addEventListener("click", (e) => { e.stopPropagation(); if (i.id && uygula((t) => isikSil(t, i.id!))) tazele(); });
      r.append(nokta, el("span", "il-ad", i.ad ?? i.id ?? "ışık"), goz, sil);
      r.addEventListener("click", () => { secili = i.id ?? null; tazele(); });
      liste.append(r);
    }
    detayCiz(liste_.find((i) => i.id === secili));
    const kirli = kirliMi();
    rozet.textContent = kirli ? "● kaydedilmedi" : "";
    kaydetD.disabled = !kirli || !a.kopru;
    ekleD.disabled = !l || liste_.length >= ISIK_TAVANI;
    durum.textContent = `${liste_.filter((i) => !i.gizli).length} açık / ${liste_.length} ışık (en çok ${ISIK_TAVANI})${secili ? ` · seçili: ${secili}` : ""}`;
  }

  async function kaydet(): Promise<void> {
    const l = a.level(); const k = a.kopru;
    if (!l || !k) return;
    kaydetD.disabled = true;
    try {
      const b = await k.projeBilgi();
      if (!b.ok || !b.deger) { a.altyazi("açık proje yok: ışıklar kaydedilemedi", 3500); return; }
      const ad = b.deger.varsayilanLevel;
      const oku = await k.projeLevelOku(ad);
      if (!oku.ok) { a.altyazi(`level okunamadı (${oku.mesaj})`, 4000); return; }
      const yaz = diskeYaz(oku.deger, isiklar(l));
      if (!yaz.ok) { a.altyazi(`ışıklar yazılamadı: ${yaz.neden}`, 4000); return; }
      const sonuc = await k.projeLevelKaydet(ad, yaz.deger);
      if (!sonuc.ok) { a.altyazi(`kaydedilemedi: ${sonuc.mesaj}`, 4000); return; }
      kayitliImza = imza(isiklar(l));
      a.altyazi(`ışıklar kaydedildi: ${ad}`, 2200);
    } finally { tazele(); }
  }

  ekleD.addEventListener("click", () => { ekle(); });
  kaydetD.addEventListener("click", (e) => { if (e.isTrusted) void kaydet(); });
  kok.addEventListener("keydown", (e) => { if (e.target instanceof HTMLInputElement && e.target.type !== "color") e.stopPropagation(); });
  kok.addEventListener("keyup", (e) => { if (e.target instanceof HTMLInputElement) e.stopPropagation(); });

  a.dok.kaydet({
    kayit: { id: ISIKLAR_PANELI_KIMLIGI, ad: "Işıklar", bolgeler: ["sol", "sag", "alt", "yuzer"], varsayilan: "sol", baslangicKapali: true },
    icerik: kok, gorunur: true, ipucu: "Level ışık aktörleri: ekle, düzenle, kaydet",
  });
  // Görünürken yavaşça tazele (level geç kurulur, başka yolla değişebilir); görünmezken hiçbir şey yapma.
  setInterval(() => { if (a.dok.ekrandaMi(ISIKLAR_PANELI_KIMLIGI) && !kok.contains(document.activeElement)) tazele(); }, 1000);
  tazele();

  function sec(id: string): void {
    const l = a.level();
    if (!l || !isiklar(l).some((i) => i.id === id)) return;
    secili = id; tazele();
  }

  return { kok, tazele, ekle, kirliMi, secili: () => secili, sec, konumla: (id, konum) => yamala(id, { konum }) };
}
