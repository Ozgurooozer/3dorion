// uygulama/yapi/graf/grafEditoru.ts — GÖRSEL DÜĞÜM EDİTÖRÜ (spec 35 dilim 2b; Unreal Blueprint hissi): tam ekran katman, sekmeler, tuval, palet, paneller.
// DOM katmanı ve denetimci. Mantık saf modüllerde ve testli (`uygulama/graf/editor/`); bu dosya parçaları bağlar, tuşları yönlendirir, kaydeder.
//
// BİÇİM DEĞİŞMEZ: editör yalnız görünümdür; tek doğruluk kaynağı `protocol/graf.ts` `Graf` JSON'u (Orion'un yazacağıyla aynı). Kaydetme mevcut
// `grafDeposu.yaz` (biçim orada doğrulanır, bozuk yazılmaz); çalıştırma ve dinleme mevcut çalıştırıcı/dinleyici (calistirmaDugmeleri.ts, isTrusted).
// TUŞLAR OYUNA SIZMAZ: editör açıkken klavye olayları kökte durdurulur (WASD, 1–4, Y, T, Tab…); odak editörün dışına (gövdeye) düşerse pencereye yakalama
// evresinde bakılır ve yine yutulur — yalnız JSON penceresinin (editorPenceresi) ve başka yazı alanlarının tuşuna dokunulmaz. Onay kapısının Y/N/Esc'i
// (onayBaglantisi.ts, daha önce kurulan yakalayıcı) editörden ÖNCE çalışır: Orion onay beklerken editör açık olsa da cevap verilir.
// HATA OLURSA OYUN KİLİTLİ KALMAZ: çizimde bir istisna editörü gizler, yakalayıcıyı kaldırır ve nedeni altyazıyla söyler.
// Esc editörü GİZLER, sekmeleri kapatmaz (kaydedilmemiş değişiklik bellekte kalır; kirliyse önce uyarır, ikinci Esc gizler).
"use strict";
import type { Graf, GrafDegeri } from "../../../protocol/graf.ts";
import type { DugumKaydi, PinOrtami } from "../../graf/dugumKaydi.ts";
import { grafMetni, type GrafDeposu } from "../../graf/grafDeposu.ts";
import type { GrafCalistirici } from "../../graf/grafCalistirici.ts";
import type { GrafDinleyici } from "../../graf/grafDinleyici.ts";
import { calismaIsareti, sinirliSiklik } from "../../graf/editor/calismaGorunumu.ts";
import { dugumEkleKomutu, oturumKur, type EditorOturumu, type KomutSonucu } from "../../graf/editor/editorOturumu.ts";
import { editorKomutu } from "../../graf/editor/kisayollar.ts";
import { sekmeListesiKur } from "../../duzenleyici/sekmeler.ts";
import { EDITOR_CSS } from "./editorStili.ts";
import type { EditorBaglami, MesajTuru } from "./editorBaglami.ts";
import { dugme, el, yaziAlaniMi } from "./dom.ts";
import { tuvalKur } from "./tuval.ts";
import { paletKur } from "./paletKutusu.ts";
import { ayrintiPaneliKur } from "./ayrintiPaneli.ts";
import { grafigimPaneliKur } from "./grafigimPaneli.ts";
import { calistirmaDugmeleriKur } from "./calistirmaDugmeleri.ts";
import { adKutusuKur, sekmeSeridiKur } from "../ortak/sekmeSeridi.ts";
import { kabukStiliEkle } from "../ortak/kabukStili.ts";
import { menuCubuguKur } from "../ortak/menuCubugu.ts";
import { AYIRICI, type Menu } from "../ortak/menuModeli.ts";
import { dugmeYap } from "../ortak/dom.ts";
import { altSeritKur, bantKur, ipucuSeridiKur, yardimKutusuKur } from "./bilgiSeritleri.ts";
import { komutYurutucuKur } from "./komutlar.ts";
import { sekmeDosyalariKur } from "./sekmeDosyalari.ts";

export interface GrafEditoruAyari {
  depo: GrafDeposu;
  calistirici: GrafCalistirici;
  dinleyici: GrafDinleyici;
  kayit: DugumKaydi<unknown>;
  ajanlar: () => readonly string[];
  /** JSON metin görünümü (eski düzenleyici penceresi; korunur). */
  metinAc: (ad: string) => void;
  /** Editör gizliyken de görünen kısa mesaj (altyazı). */
  altyazi: (metin: string, ms?: number) => void;
  /** Açılmadan önce: fare serbest olsun (imleç kipi). false dönerse açılmaz. */
  izin?: () => boolean;
  /** Editör açıldı/kapandı (öteki panelleri gizle, yerleştirme kiplerini bitir). */
  gorunurlukDegisti?: (acik: boolean) => void;
}

export interface GrafEditoru {
  /** Grafiği editörde aç (açık sekmeyse öne getirir). */
  ac(ad: string): void;
  gizle(): void;
  acikMi(): boolean;
  /** Yeniden adlandır (Graf sekmesi de bunu çağırır): açık sekme kirliyse, grafik çalışıyorsa ya da dinlemedeyse reddeder. */
  yenidenAdlandir(eski: string, yeni: string): Promise<void>;
  kopyasiniOlustur(ad: string, yeni: string): Promise<void>;
}

const ESC_ONAY_MS = 3000;
let stilEkli = false;

export function grafEditoruKur(a: GrafEditoruAyari): GrafEditoru {
  if (!stilEkli) { const s = document.createElement("style"); s.textContent = EDITOR_CSS; document.head.append(s); stilEkli = true; }
  kabukStiliEkle();
  const sekmeler = sekmeListesiKur<EditorOturumu>((o) => o.gecmis.kirli());
  const ortam = (): PinOrtami => ({ desen: (x) => a.depo.desen(x), buGraf: null, ajanlar: a.ajanlar });
  let acik = false;
  let escZamani = 0;

  const kok = el("div", "ge-kok"); kok.tabIndex = -1; kok.dataset.acik = "0";
  const ust = el("div", "ge-ust");
  const govde = el("div", "ge-govde");
  const alt = altSeritKur((id) => tuval.dugumeOdaklan(id));
  const bant = bantKur({ al: (ad) => a.depo.al(ad), yeniden: (o, g) => yeniden(o, g), bildir: (m) => bildir(m), tazele: () => tazele() });
  const yardim = yardimKutusuKur();
  kok.append(ust, ipucuSeridiKur(), bant.kok, govde, alt.kok);

  const etkin = () => sekmeler.etkin();
  const bildir = (m: string, tur: MesajTuru = "bilgi") => alt.bildir(m, tur);

  const b: EditorBaglami = {
    kayit: a.kayit,
    oturum: () => etkin()?.icerik ?? null,
    ad: () => etkin()?.ad ?? null,
    calisma: () => { const s = etkin(); return s ? calismaIsareti(a.calistirici.durum(), a.dinleyici.liste(), s.ad, Date.now()) : null; },
    sonuc(r: KomutSonucu) { if (r.mesaj) bildir(r.mesaj, r.ok ? "bilgi" : "hata"); tazele(); },
    bildir,
    tazele: () => tazele(),
    paletAc: (ekran, dunya, pin = null, arama = "") => palet.ac(ekran, dunya, pin, arama),
    ortayaEkle(tip: string, ayar: Record<string, GrafDegeri>) {
      const o = etkin()?.icerik;
      if (!o) return;
      const m = tuval.ortaDunya();
      b.sonuc(dugumEkleKomutu(o, a.kayit, { tip, ayar }, { x: m.x - 100, y: m.y - 40 }));
    },
    desenAc: (ad) => ac(ad),
    desenler: () => a.depo.liste().filter((k) => k.tur === "fonksiyon" && !k.hata).map((k) => k.ad),
    dugumeGit: (id) => tuval.dugumeOdaklan(id),
  };

  const tuval = tuvalKur(b, () => { palet.kapat(); });
  const palet = paletKur(b, (oge, dunya, pin) => { const o = etkin()?.icerik; if (o) b.sonuc(dugumEkleKomutu(o, a.kayit, oge, dunya, pin)); });
  tuval.kok.append(palet.kok, yardim.kok);
  const sol = grafigimPaneliKur(b), sag = ayrintiPaneliKur(b);
  govde.append(sol.kok, tuval.kok, sag.kok);

  // ── üst çubuk ──
  const seritler = sekmeSeridiKur<EditorOturumu>({
    sekmeler, onek: "ge",
    kirli: (o) => o.gecmis.kirli(),
    etiket: (ad, o) => `${o.graf().tur === "fonksiyon" ? "🧩 " : ""}${ad}`,
    ipucu: (ad, o) => `${o.graf().tur === "fonksiyon" ? "desen" : "grafik"} '${ad}'${o.gecmis.kirli() ? " — kaydedilmemiş değişiklik var (Ctrl+S)" : ""}`,
    rozet: (ad) => (a.calistirici.durum().calisiyor?.graf === ad || a.dinleyici.calisiyorMu(ad) ? "▶" : a.dinleyici.dinlemedeMi(ad) ? "⚡" : ""),
    sec: (ad) => { sekmeler.etkinYap(ad); palet.kapat(); tazele(); },
    kapandi: () => { if (!sekmeler.hepsi().length) bildir("Bütün sekmeler kapandı. Graf sekmesinden bir grafik aç."); tazele(); },
  });
  const adKutusu = adKutusuKur((m) => bildir(m, "hata"), (m) => dugme(m), "ge");
  const satir = el("div", "ge-satir");
  const kaydetDugme = dugme("Kaydet", "", "Ctrl+S — biçim doğrulanır, bozuksa yazılmaz");
  const calisma = calistirmaDugmeleriKur({
    calistirici: a.calistirici, dinleyici: a.dinleyici, depo: a.depo, ad: () => etkin()?.ad ?? null,
    kirli: () => etkin()?.icerik.gecmis.kirli() ?? false, bildir,
  });
  const arac = dugmeYap("kb-arac");
  const geriD = arac("↶", "", "Ctrl+Z — geri al"), yineleD = arac("↷", "", "Ctrl+Y — yinele");
  const sigdirDugme = arac("⤢ Sığdır", "", "F — grafiği ekrana sığdır (seçim varsa seçimi)");
  const paletD = arac("＋ Düğüm", "", "Boşluk ya da sağ tık — düğüm paleti");
  const kapatDugme = arac("✕", "", "Editörü gizle (Esc) — sekmeler ve kaydedilmemiş değişiklik bellekte kalır");
  kaydetDugme.className = "kb-arac"; kaydetDugme.textContent = "💾 Kaydet";
  const grup = (...c: HTMLElement[]) => { const g = el("div", "kb-grup"); g.append(...c); return g; };
  const aracSatiri = el("div", "kb-aracsatiri");
  aracSatiri.append(grup(geriD, yineleD), grup(paletD, sigdirDugme), grup(...calisma.ogeler), el("span", "kb-bosluk"), satir, kaydetDugme, kapatDugme);
  ust.append(seritler.kok, adKutusu.kok);

  // ── menüler (eskiden hepsi tek satıra sıkışmış düğmelerdi: Metin, Yeniden adlandır, Kopyasını oluştur, ?) ──
  const o = (): EditorOturumu | null => etkin()?.icerik ?? null;
  const menuler = (): Menu[] => [
    { ad: "Dosya", satirlar: [
      { etiket: "Kaydet", kisayol: "Ctrl+S", etkin: () => !!etkin() && etkin()!.icerik.dis !== "silindi", calistir: () => { void kaydet(); } },
      AYIRICI,
      { etiket: "Yeniden adlandır…", etkin: () => !!etkin(), calistir: () => { const s = etkin(); if (s) adKutusu.ac("yeni ad:", s.ad, (yeni) => yenidenAdlandir(s.ad, yeni)); } },
      { etiket: "Kopyasını oluştur…", etkin: () => !!etkin(), calistir: () => { const s = etkin(); if (s) adKutusu.ac("kopyanın adı:", `${s.ad}_kopya`, async (yeni) => { await kopyasiniOlustur(s.ad, yeni); ac(yeni); }); } },
      { etiket: "JSON (metin) görünümü", ipucu: "Eski metin düzenleyici; Ctrl+S orada da kaydeder", etkin: () => !!etkin(), calistir: () => { const s = etkin(); if (s) a.metinAc(s.ad); } },
      AYIRICI,
      { etiket: "Editörü gizle", kisayol: "Esc", calistir: () => escIste() },
    ] },
    { ad: "Düzen", satirlar: [
      { etiket: "Geri al", kisayol: "Ctrl+Z", etkin: () => !!o(), calistir: () => komut("geriAl") },
      { etiket: "Yinele", kisayol: "Ctrl+Y", etkin: () => !!o(), calistir: () => komut("yinele") },
      AYIRICI,
      { etiket: "Kes", kisayol: "Ctrl+X", etkin: () => !!o(), calistir: () => komut("kes") },
      { etiket: "Kopyala", kisayol: "Ctrl+C", etkin: () => !!o(), calistir: () => komut("kopyala") },
      { etiket: "Yapıştır", kisayol: "Ctrl+V", etkin: () => !!o(), calistir: () => komut("yapistir") },
      { etiket: "Çoğalt", kisayol: "Ctrl+D", etkin: () => !!o(), calistir: () => komut("cogalt") },
      { etiket: "Sil", kisayol: "Delete", etkin: () => !!o(), calistir: () => komut("sil") },
      AYIRICI,
      { etiket: "Tümünü seç", kisayol: "Ctrl+A", etkin: () => !!o(), calistir: () => komut("tumunuSec") },
    ] },
    { ad: "Görünüm", satirlar: [
      { etiket: "Grafiği sığdır", kisayol: "F", etkin: () => !!o(), calistir: () => komut("sigdir") },
      { etiket: "Düğüm paleti", kisayol: "Boşluk", etkin: () => !!o(), calistir: () => komut("palet") },
    ] },
    { ad: "Çalıştır", satirlar: [
      { etiket: "▶ Çalıştır, ⚡ Dinle — araç çubuğundaki düğmeler", ipucu: "Çalıştırmak ve dinlemeye almak yalnız senin gerçek tıklamanla çalışır: menüden ya da kısayoldan olmaz", etkin: () => false, calistir: () => undefined },
      { etiket: "■ Durdur", etkin: () => a.calistirici.durum().calisiyor !== null || a.dinleyici.liste().some((x) => x.calisiyor), calistir: () => { a.calistirici.durdur(); a.dinleyici.durdur(); } },
    ] },
    { ad: "Yardım", satirlar: [{ etiket: "Kısayollar", kisayol: "?", calistir: () => yardim.degistir() }] },
  ];
  const menu = menuCubuguKur(menuler);
  kok.prepend(menu.kok);
  ust.after(aracSatiri);

  kaydetDugme.addEventListener("click", () => { kaydetDugme.blur(); void kaydet(); });
  geriD.addEventListener("click", () => { geriD.blur(); komut("geriAl"); });
  yineleD.addEventListener("click", () => { yineleD.blur(); komut("yinele"); });
  paletD.addEventListener("click", () => { paletD.blur(); komut("palet"); });
  sigdirDugme.addEventListener("click", () => { sigdirDugme.blur(); tuval.sigdir(); });
  kapatDugme.addEventListener("click", () => { kapatDugme.blur(); escIste(); });

  function ustCiz(): void {
    seritler.ciz();
    calisma.ciz();
    const s = etkin();
    const c = b.calisma();
    satir.textContent = c?.satir ?? ""; satir.dataset.tur = c?.satirTuru ?? ""; satir.title = satir.textContent;
    kaydetDugme.disabled = !s || s.icerik.dis === "silindi";
    for (const d of [geriD, yineleD, paletD, sigdirDugme]) d.disabled = !s;
    menu.ciz();
  }

  /** Bir parça yazı alanında odaktaysa (ayar yazılıyor) onu çizme: yazılan yarım metin silinmesin; odak çıkınca çizilir. */
  const ertelenen = new Set<{ kok: HTMLElement; ciz(): void }>();
  function guvenliCiz(p: { kok: HTMLElement; ciz(): void }): void {
    const odak = document.activeElement;
    if (odak && p.kok.contains(odak) && yaziAlaniMi(odak)) {
      if (!ertelenen.has(p)) { ertelenen.add(p); odak.addEventListener("focusout", () => { ertelenen.delete(p); setTimeout(() => { if (acik) guvenliCiz(p); }, 0); }, { once: true }); }
      return;
    }
    p.ciz();
  }

  const denetim = sinirliSiklik(() => {
    const o = etkin()?.icerik;
    if (!o || !acik) return;
    o.denetle();
    guvenliCiz(tuval); alt.ciz(o); guvenliCiz(sag); ustCiz();
  }, 250);

  function tazele(): void {
    try {
      ustCiz(); bant.ciz(etkin()); guvenliCiz(tuval); guvenliCiz(sol); guvenliCiz(sag); alt.ciz(etkin()?.icerik ?? null);
      denetim.iste();
    } catch (err) { coktu(err); }
  }

  /** Çizimde beklenmeyen hata: editör gizlenir (oyun kilitli kalmaz), neden altyazıda ve konsolda. */
  function coktu(err: unknown): void {
    console.error("[GRAF-EDITOR] hata:", err);
    a.altyazi(`grafik editörü hata verdi ve gizlendi: ${err instanceof Error ? err.message : String(err)} (Metin ile JSON'u açabilirsin)`, 6000);
    try { gizle(); } catch (e2) { console.error("[GRAF-EDITOR] gizlenemedi:", e2); kok.dataset.acik = "0"; removeEventListener("keydown", yakala, { capture: true }); removeEventListener("keyup", yakala, { capture: true }); }
  }

  /** Oturumu diskteki grafikle yeniden kur (görünüm korunur). */
  function yeniden(o: EditorOturumu, g: Graf): void {
    const yeni = oturumKur(g, a.kayit, ortam);
    o.gecmis.sifirla(yeni.graf());
    o.secim.clear();
  }

  // ── kaydet ──
  async function kaydet(): Promise<void> {
    const s = etkin();
    if (!s) return;
    const o = s.icerik;
    if (o.dis === "silindi") { bildir("dosya artık yok: kaydedilemez (Kopyasını oluştur)", "hata"); return; }
    const g = o.graf();
    try {
      await a.depo.yaz(s.ad, grafMetni(g));
      o.gecmis.kaydedildi(g);
      o.dis = null;
      bildir(`kaydedildi: ${s.ad}${o.hatalar.length ? ` (denetimde ${o.hatalar.length} sorun var: kayıt engellenmez, ▶ çalışmaz)` : ""}`, "iyi");
    } catch (err) {
      bildir(`KAYDEDİLEMEDİ: ${err instanceof Error ? err.message : String(err)}`, "hata");
    }
    tazele();
  }

  // ── tuşlar ──
  function escIste(): void {
    if (menu.kapat() || palet.kapat() || adKutusu.kapat() || tuval.iptal()) return;
    if (yardim.acikMi()) { yardim.degistir(false); return; }
    const kirli = sekmeler.kirliler();
    if (kirli.length && performance.now() - escZamani > ESC_ONAY_MS) {
      escZamani = performance.now();
      bildir(`Kaydedilmemiş değişiklik: ${kirli.join(", ")} — tekrar Esc: gizle (değişiklik bellekte kalır, kaybolmaz) · Ctrl+S: kaydet`, "uyari");
      return;
    }
    gizle();
  }

  const komut = komutYurutucuKur({
    oturum: () => etkin()?.icerik ?? null, sonuc: (r) => b.sonuc(r), bildir, tazele: () => tazele(), kaydet: () => { void kaydet(); },
    esc: escIste, yardim: () => yardim.degistir(), tuval, palet,
  });

  function tusIsle(e: KeyboardEvent): void {
    const yazi = yaziAlaniMi(e.target);
    const k = editorKomutu(e, yazi);
    if (!k) return;
    e.preventDefault();
    if (k === "alandanCik") { (e.target as HTMLElement).blur(); kok.focus({ preventScroll: true }); return; }
    komut(k);
  }
  // Kökte: editörün içindeki her tuş burada biter (oyuna gitmez).
  kok.addEventListener("keydown", (e) => { e.stopPropagation(); try { tusIsle(e); } catch (err) { coktu(err); } });
  kok.addEventListener("keyup", (e) => e.stopPropagation());
  kok.addEventListener("keypress", (e) => e.stopPropagation());
  kok.addEventListener("contextmenu", (e) => { if (!yaziAlaniMi(e.target)) e.preventDefault(); e.stopPropagation(); });
  // Odak editörün DIŞINA düşmüşse (gövde): tuş yine editörün. JSON penceresi ve başka yazı alanları kendi tuşlarını alır.
  const yakala = (e: KeyboardEvent): void => {
    if (!acik) return;
    const h = e.target as Element | null;
    if (h && kok.contains(h)) return;
    if (h?.closest?.(".ep-pencere") || yaziAlaniMi(h)) return;
    e.stopImmediatePropagation();
    if (e.type !== "keydown") return;
    kok.focus({ preventScroll: true });
    try { tusIsle(e); } catch (err) { coktu(err); }
  };

  // ── abonelikler ──
  let saat: ReturnType<typeof setInterval> | null = null;
  const calismaDegisti = () => {
    if (!acik) return;
    ustCiz(); guvenliCiz(tuval);
    const surer = a.calistirici.durum().calisiyor !== null;
    if (surer && !saat) saat = setInterval(() => { if (acik) ustCiz(); }, 500);
    if (!surer && saat) { clearInterval(saat); saat = null; }
  };
  a.calistirici.dinle(calismaDegisti);
  a.dinleyici.dinle(calismaDegisti);
  // ── aç / gizle ──
  function ac(ad: string): void {
    try {
      const g = a.depo.al(ad);
      const zatenAcik = !!sekmeler.al(ad);
      if (!g && !zatenAcik) {
        const k = a.depo.liste().find((x) => x.ad === ad);
        a.altyazi(k ? `'${ad}' bozuk (${k.hata ?? "okunamadı"}): görsel editör açamaz, JSON düzenleyicide açıldı` : `'${ad}' yok`, 5000);
        if (k) a.metinAc(ad);
        return;
      }
      if (!acik) {
        if (a.izin && !a.izin()) { a.altyazi("editör şimdi açılamaz (sohbet, onay ya da odak açık)", 2500); return; }
        acik = true;
        if (!kok.isConnected) document.body.append(kok);
        kok.dataset.acik = "1";
        addEventListener("keydown", yakala, { capture: true });
        addEventListener("keyup", yakala, { capture: true });
        a.gorunurlukDegisti?.(true);
      }
      sekmeler.ac(ad, () => oturumKur(g!, a.kayit, ortam));
      palet.kapat();
      tazele();
      if (!zatenAcik) { etkin()!.icerik.denetle(); tuval.sigdir(); tazele(); }
      kok.focus({ preventScroll: true });
    } catch (err) { coktu(err); }
  }

  function gizle(): void {
    if (!acik) return;
    acik = false;
    kok.dataset.acik = "0";
    palet.kapat(); adKutusu.kapat(); tuval.iptal();
    removeEventListener("keydown", yakala, { capture: true });
    removeEventListener("keyup", yakala, { capture: true });
    if (saat) { clearInterval(saat); saat = null; }
    denetim.iptal();
    if (document.activeElement && kok.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    a.gorunurlukDegisti?.(false);
  }

  // Yeniden adlandır / kopya (Graf sekmesi de bunları çağırır) ve dosyaların dışarıdan değişmesi: sekmeDosyalari.ts.
  const dosyalar = sekmeDosyalariKur({
    sekmeler, depo: a.depo, calistirici: a.calistirici, dinleyici: a.dinleyici, yeniden, bildir, altyazi: a.altyazi,
    degisti: () => { if (acik) tazele(); }, coktu,
  });
  const yenidenAdlandir = (eski: string, yeni: string) => dosyalar.yenidenAdlandir(eski, yeni);
  const kopyasiniOlustur = (ad: string, yeni: string) => dosyalar.kopyasiniOlustur(ad, yeni);

  return { ac, gizle, acikMi: () => acik, yenidenAdlandir, kopyasiniOlustur };
}
