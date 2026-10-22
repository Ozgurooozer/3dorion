// uygulama/yapi/sekans/sekansEditoru.ts — SEKANS EDİTÖRÜ (spec 36 S2; Unreal Sequencer'ın küçük hâli): ekranın alt yarısında dok — sekmeler, üst çubuk,
// sol sütun (izler), zaman çizelgesi, Ayrıntılar; tuş yönlendirme, kaydet, aç/gizle. DOM katmanı ve denetimci.
//
// MANTIK SAF MODÜLLERDE (`uygulama/sekans/`, `uygulama/sekans/editor/`; testli). Kaydetme mevcut depo (`sekansDeposu.yaz`: biçim doğrulanır, bozuk diske
// gitmez); oynatma mevcut oynatıcı (`oynatmaDugmeleri.ts`: yalnız gerçek tık). DOK, TAM EKRAN DEĞİL: üstte 3B görünüm açık kalır (▶'de beden görünsün).
// TUŞLAR OYUNA SIZMAZ (graf editörünün kalıbı, yapi/graf/grafEditoru.ts): kök keydown/keyup/keypress'i durdurur; odak dokun dışına (3B tuval, gövde) düşerse
// pencere yakalayıcısı (yalnız açıkken kurulu) yutar — JSON penceresi (`.ep-pencere`) ve başka yazı alanları hariç. Bekçi: sekansBekci.test.ts.
// HATA OLURSA OYUN KİLİTLİ KALMAZ: çizimde istisna editörü gizler, yakalayıcıyı kaldırır, nedeni altyazıyla söyler. Esc GİZLER, sekmeleri kapatmaz.
"use strict";
import type { KlipBulucu } from "../../../world/avatar/index.ts";
import { sekmeListesiKur } from "../../duzenleyici/sekmeler.ts";
import { sekansMetni, type SekansDeposu } from "../../sekans/sekansDeposu.ts";
import type { SekansOynatici } from "../../sekans/oynatici.ts";
import { eksikKlipler } from "../../sekans/degerlendir.ts";
import { sekansOturumuKur, type SekansOturumu } from "../../sekans/editor/sekansOturumu.ts";
import { SEKANS_KISAYOLLARI, sekansKomutu, type SekansKomutu } from "../../sekans/editor/kisayollar.ts";
import { kareYazisi } from "../../sekans/editor/zamanEkseni.ts";
import { dugmeYap, el, ipucuSeridi, yaziAlaniMi } from "../ortak/dom.ts";
import { adKutusuKur, sekmeSeridiKur } from "../ortak/sekmeSeridi.ts";
import { sekansStiliEkle } from "./sekansStili.ts";
import type { MesajTuru, SekansBaglami } from "./editorBaglami.ts";
import { zamanCizelgesiKur } from "./zamanCizelgesi.ts";
import { izListesiKur } from "./izListesi.ts";
import { ayrintiPaneliKur } from "./ayrintiPaneli.ts";
import { oynatmaDugmeleriKur } from "./oynatmaDugmeleri.ts";
import { sekansDosyaIslemleriKur } from "./sekansDosyaIslemleri.ts";

export interface SekansEditoruAyari {
  depo: SekansDeposu;
  oynatici: SekansOynatici;
  /** Klip kütüphanesi (geçici sekans klipleri DEĞİL). */
  klipler: KlipBulucu;
  ajanlar: () => readonly string[];
  metinAc: (ad: string) => void;
  altyazi: (metin: string, ms?: number) => void;
  /** Açılmadan önce: fare serbest olsun (imleç kipi). false dönerse açılmaz. */
  izin?: () => boolean;
  gorunurlukDegisti?: (acik: boolean) => void;
}

export interface SekansEditoru {
  ac(ad: string): boolean;
  gizle(): void;
  acikMi(): boolean;
  yenidenAdlandir(eski: string, yeni: string): Promise<void>;
  kopyasiniOlustur(ad: string, yeni: string): Promise<void>;
  /** Senaryo (sekansdene) ve testler: etkin oturum ve yeniden çizim. */
  etkinOturum(): SekansOturumu | null;
  tazele(): void;
}

const dugme = dugmeYap("sk-dugme");
const ESC_ONAY_MS = 3000;

export function sekansEditoruKur(a: SekansEditoruAyari): SekansEditoru {
  sekansStiliEkle();
  const sekmeler = sekmeListesiKur<SekansOturumu>((o) => o.gecmis.kirli());
  let acik = false, escZamani = 0;
  const etkin = () => sekmeler.etkin();

  const kok = el("div", "sk-kok"); kok.tabIndex = -1; kok.dataset.acik = "0";
  const ust = el("div", "sk-ust");
  const bant = el("div", "sk-bant");
  const govde = el("div", "sk-govde");
  const alt = el("div", "sk-alt");
  const mesaj = el("div", "sk-mesaj");
  alt.append(mesaj);
  const bildir = (m: string, tur: MesajTuru = "bilgi") => { mesaj.textContent = m; mesaj.dataset.tur = tur; mesaj.title = m; };

  const b: SekansBaglami = {
    oturum: () => etkin()?.icerik ?? null,
    ad: () => etkin()?.ad ?? null,
    klipler: a.klipler,
    ajanlar: a.ajanlar,
    bildir,
    sonuc(r) { if (r?.mesaj) bildir(r.mesaj, r.ok ? "bilgi" : "hata"); tazele(); },
    tazele: () => tazele(),
    oynayanKare: () => { const c = a.oynatici.durum().calisiyor; return c && c.sekans === etkin()?.ad ? a.oynatici.kare() : null; },
    durdur: () => a.oynatici.durdur(),
  };

  const zaman = zamanCizelgesiKur(b);
  const sol = izListesiKur(b);
  const sag = ayrintiPaneliKur(b);
  const kaydir = el("div", "sk-kaydir");
  const ic = el("div", "sk-ic");
  ic.append(sol.kok, zaman.kok);
  kaydir.append(ic);
  const yardim = el("div", "sk-yardim");
  { const t = el("table"); for (const k of SEKANS_KISAYOLLARI) { const tr = el("tr"); tr.append(el("td", "", k.tus), el("td", "", k.aciklama)); t.append(tr); } yardim.append(el("div", "sk-baslik2", "Kısayollar"), t); }
  govde.append(kaydir, sag.kok, yardim);

  const seritler = sekmeSeridiKur<SekansOturumu>({
    sekmeler, onek: "sk", kirli: (o) => o.gecmis.kirli(), etiket: (ad) => `🎬 ${ad}`,
    ipucu: (ad, o) => `sekans '${ad}'${o.gecmis.kirli() ? " — kaydedilmemiş değişiklik var (Ctrl+S)" : ""}`,
    rozet: (ad) => (a.oynatici.durum().calisiyor?.sekans === ad ? "▶" : ""),
    sec: (ad) => { sekmeler.etkinYap(ad); tazele(); },
    kapandi: () => { if (!sekmeler.hepsi().length) bildir("Bütün sekmeler kapandı. Yapı çubuğu · Sekans sekmesinden bir sekans aç."); tazele(); },
  });
  const adKutusu = adKutusuKur((m) => bildir(m, "hata"), (m) => dugme(m), "sk");
  const playheadYazi = el("span", "sk-playhead-yazi");
  const oynatma = oynatmaDugmeleriKur(b, a.oynatici);
  const kaydetD = dugme("Kaydet", "", "Ctrl+S — biçim doğrulanır, bozuksa yazılmaz");
  const yaslaD = dugme("🧲 Yasla", "", "N — sürüklerken komşu anahtara, bölüm kenarına ve playhead'e yapış (kapalı: yalnız tam kare)");
  const sigdirD = dugme("Sığdır", "", "F — oynatma aralığını ekrana sığdır");
  const metinD = dugme("Metin", "", "JSON metin görünümü (Ctrl+S orada da kaydeder; bozuk JSON kaydedilmez)");
  const adD = dugme("Yeniden adlandır", "", "Sekansın adını değiştir (ad = dosya adı; eski dosya .silinenler'e)");
  const kopyaD = dugme("Kopyasını oluştur", "", "Aynı içerikle yeni adlı sekans");
  const yardimD = dugme("?", "", "Kısayollar (? / F1)");
  const kapatD = dugme("✕", "", "Editörü gizle (Esc) — sekmeler ve kaydedilmemiş değişiklik bellekte kalır");
  ust.append(seritler.kok, adKutusu.kok, el("span", "sk-bosluk"), playheadYazi, oynatma.satir, kaydetD, ...oynatma.ogeler, yaslaD, sigdirD, metinD, adD, kopyaD, yardimD, kapatD);
  kok.append(ust, ipucuSeridi("orion.sekansEditoru.ipucu.v1", "Cetvele tık/sürükle: playhead · ◆ anahtarı sürükle (↔ zaman, ↕ değer) · mavi bölümü taşı, kenarından uzat/kırp · çift tık: ekle · tekerlek: yakınlaş · ▶ ekrandaki hâli oynatır · ? kısayollar", "sk-ipucu", dugme), bant, govde, alt);

  kaydetD.addEventListener("click", () => { kaydetD.blur(); void kaydet(); });
  yaslaD.addEventListener("click", () => { yaslaD.blur(); komut("yasla"); });
  sigdirD.addEventListener("click", () => { sigdirD.blur(); zaman.sigdir(); });
  metinD.addEventListener("click", () => { metinD.blur(); const s = etkin(); if (s) a.metinAc(s.ad); });
  adD.addEventListener("click", () => { adD.blur(); const s = etkin(); if (s) adKutusu.ac("yeni ad:", s.ad, (y) => dosyalar.yenidenAdlandir(s.ad, y)); });
  kopyaD.addEventListener("click", () => { kopyaD.blur(); const s = etkin(); if (s) adKutusu.ac("kopyanın adı:", `${s.ad}_kopya`, async (y) => { await dosyalar.kopyasiniOlustur(s.ad, y); ac(y); }); });
  yardimD.addEventListener("click", () => { yardimD.blur(); yardim.dataset.acik = yardim.dataset.acik === "1" ? "0" : "1"; });
  kapatD.addEventListener("click", () => { kapatD.blur(); escIste(); });

  function bantCiz(): void {
    const s = etkin(), o = s?.icerik;
    bant.replaceChildren(); bant.dataset.acik = o?.dis ? "1" : "0";
    if (!s || !o?.dis) return;
    if (o.dis === "silindi") { bant.append(el("span", "", `'${s.ad}' dosyası artık yok (silindi ya da adı değişti): bu sekme kaydedilemez. Gerekirse Kopyasını oluştur.`)); return; }
    const al = dugme("Diskteki hâli al", "", "Benim değişikliklerim gider");
    al.addEventListener("click", () => { const y = a.depo.al(s.ad); if (y) { o.gecmis.sifirla(y); o.secim = { tur: "yok" }; o.dis = null; bildir("diskteki hâl alındı"); tazele(); } });
    const koru = dugme("Benimkini koru", "", "Kaydedince benim hâlim yazılır");
    koru.addEventListener("click", () => { o.dis = null; tazele(); });
    bant.append(el("span", "", "Dosya editör dışında değişti ve sende kaydedilmemiş değişiklik var."), al, koru);
  }

  function tazele(): void {
    if (!acik) return;
    try {
      seritler.ciz(); oynatma.ciz(); bantCiz();
      const o = etkin()?.icerik ?? null;
      const k = b.oynayanKare() ?? o?.kare ?? 0;
      playheadYazi.textContent = o ? `▸ ${kareYazisi(k)}` : "";
      kaydetD.disabled = !o || o.dis === "silindi";
      for (const d of [yaslaD, sigdirD, metinD, adD, kopyaD]) d.disabled = !o;
      yaslaD.dataset.acik = o?.yasla ? "1" : "0";
      zaman.ciz(); sol.ciz();
      const odak = document.activeElement;
      if (!(odak && sag.kok.contains(odak) && yaziAlaniMi(odak))) sag.ciz();   // yazılan yarım değer silinmesin
      const eksik = o ? eksikKlipler(o.sekans(), a.klipler) : [];
      if (eksik.length && mesaj.dataset.tur !== "hata") bildir(`⚠ kütüphanede olmayan klip: ${eksik.join(", ")} — bu sekans oynatılamaz (bölümün klibini Ayrıntılar'dan değiştir)`, "uyari");
    } catch (err) { coktu(err); }
  }

  function coktu(err: unknown): void {
    console.error("[SEKANS-EDITOR] hata:", err);
    a.altyazi(`sekans editörü hata verdi ve gizlendi: ${err instanceof Error ? err.message : String(err)} (Metin ile JSON'u açabilirsin)`, 6000);
    try { gizle(); } catch (e2) { console.error("[SEKANS-EDITOR] gizlenemedi:", e2); kok.dataset.acik = "0"; removeEventListener("keydown", yakala, { capture: true }); removeEventListener("keyup", yakala, { capture: true }); }
  }

  async function kaydet(): Promise<void> {
    const s = etkin();
    if (!s) return;
    const o = s.icerik;
    if (o.dis === "silindi") { bildir("dosya artık yok: kaydedilemez (Kopyasını oluştur)", "hata"); return; }
    const x = o.gecmis.simdiki();
    try { await a.depo.yaz(s.ad, sekansMetni(x)); o.gecmis.kaydedildi(x); o.dis = null; bildir(`kaydedildi: ${s.ad}`, "iyi"); }
    catch (err) { bildir(`KAYDEDİLEMEDİ: ${err instanceof Error ? err.message : String(err)}`, "hata"); }
    tazele();
  }

  function escIste(): void {
    if (zaman.iptal() || adKutusu.kapat()) return;
    if (yardim.dataset.acik === "1") { yardim.dataset.acik = "0"; return; }
    const kirli = sekmeler.kirliler();
    if (kirli.length && performance.now() - escZamani > ESC_ONAY_MS) {
      escZamani = performance.now();
      bildir(`Kaydedilmemiş değişiklik: ${kirli.join(", ")} — tekrar Esc: gizle (değişiklik bellekte kalır) · Ctrl+S: kaydet`, "uyari");
      return;
    }
    gizle();
  }

  function komut(k: SekansKomutu): void {
    const o = etkin()?.icerik;
    if (k === "kaydet") { void kaydet(); return; }
    if (k === "kapat") { escIste(); return; }
    if (k === "yardim") { yardim.dataset.acik = yardim.dataset.acik === "1" ? "0" : "1"; return; }
    if (!o) return;
    // Playhead'i elle oynatmak oynatmayı keser (scrub kuralı).
    if (["geri1", "ileri1", "geri10", "ileri10", "basa", "sona", "oncekiAnahtar", "sonrakiAnahtar"].includes(k) && b.oynayanKare() !== null) a.oynatici.durdur();
    const r = ({
      geriAl: () => o.geriAl(), yinele: () => o.yinele(), sil: () => o.sil(), anahtarEkle: () => o.anahtarEkle(), tumunuSec: () => o.tumunuSec(),
      geri1: () => { o.adim(-1); return null; }, ileri1: () => { o.adim(1); return null; }, geri10: () => { o.adim(-10); return null; }, ileri10: () => { o.adim(10); return null; },
      basa: () => { o.basa(); return null; }, sona: () => { o.sona(); return null; }, oncekiAnahtar: () => o.anahtaraAtla(-1), sonrakiAnahtar: () => o.anahtaraAtla(1),
      sigdir: () => { zaman.sigdir(); return null; }, yasla: () => { o.yasla = !o.yasla; return { ok: true, mesaj: o.yasla ? "yaslama açık" : "yaslama kapalı (yalnız tam kare)" }; },
      alandanCik: () => null,
    } as Record<string, () => { ok: boolean; mesaj?: string } | null>)[k]?.() ?? null;
    b.sonuc(r);
  }

  function tusIsle(e: KeyboardEvent): void {
    const yazi = yaziAlaniMi(e.target);
    const k = sekansKomutu(e, yazi);
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
  // Odak editörün DIŞINA düşmüşse (3B tuval, gövde): tuş yine editörün. JSON penceresi ve başka yazı alanları kendi tuşlarını alır.
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

  // Oynarken playhead canlı (33 ms); bitince playhead oynatmanın bittiği karede kalır.
  let saat: ReturnType<typeof setInterval> | null = null;
  a.oynatici.dinle((d) => {
    if (d.calisiyor && !saat) saat = setInterval(() => { if (acik) { zaman.playheadCiz(); oynatma.ciz(); sol.ciz(); playheadYazi.textContent = `▸ ${kareYazisi(b.oynayanKare() ?? etkin()?.icerik.kare ?? 0)}`; } }, 33);
    if (!d.calisiyor && saat) { clearInterval(saat); saat = null; }
    const s = !d.calisiyor && d.son ? sekmeler.al(d.son.sekans) : null;
    if (s && d.son) s.icerik.kareyeGit(d.son.kare);
    if (d.son && !d.calisiyor && d.son.durum === "hata") bildir(`✗ ${d.son.sekans}: ${d.son.neden ?? "hata"}`, "hata");
    tazele();
  });

  function ac(ad: string): boolean {
    try {
      const s = a.depo.al(ad);
      const zatenAcik = !!sekmeler.al(ad);
      if (!s && !zatenAcik) {
        const k = a.depo.liste().find((x) => x.ad === ad);
        a.altyazi(k ? `'${ad}' bozuk (${k.hata ?? "okunamadı"}): görsel editör açamaz, JSON düzenleyicide açıldı` : `'${ad}' yok`, 5000);
        if (k) a.metinAc(ad);
        return false;
      }
      if (!acik) {
        if (a.izin && !a.izin()) { a.altyazi("sekans editörü şimdi açılamaz (sohbet, onay ya da odak açık)", 2500); return false; }
        acik = true;
        if (!kok.isConnected) document.body.append(kok);
        kok.dataset.acik = "1";
        addEventListener("keydown", yakala, { capture: true });
        addEventListener("keyup", yakala, { capture: true });
        a.gorunurlukDegisti?.(true);
      }
      sekmeler.ac(ad, () => sekansOturumuKur(s!));
      tazele();
      if (!zatenAcik) requestAnimationFrame(() => zaman.sigdir());
      kok.focus({ preventScroll: true });
      return true;
    } catch (err) { coktu(err); return false; }
  }

  function gizle(): void {
    if (!acik) return;
    acik = false;
    kok.dataset.acik = "0";
    adKutusu.kapat(); zaman.iptal();
    removeEventListener("keydown", yakala, { capture: true });
    removeEventListener("keyup", yakala, { capture: true });
    if (document.activeElement && kok.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    a.gorunurlukDegisti?.(false);
  }

  const dosyalar = sekansDosyaIslemleriKur({ sekmeler, depo: a.depo, oynatici: a.oynatici, degisti: () => tazele() });
  return { ac, gizle, acikMi: () => acik, yenidenAdlandir: dosyalar.yenidenAdlandir, kopyasiniOlustur: dosyalar.kopyasiniOlustur, etkinOturum: () => etkin()?.icerik ?? null, tazele };
}
