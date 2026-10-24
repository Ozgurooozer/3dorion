// uygulama/yapi/sekans/sekansEditoru.ts — SEKANS EDİTÖRÜ (spec 36 S2, yeniden yerleşim spec 38 §6): ekranın altında yeniden boyutlanır dok.
//
// YERLEŞİM (üstten alta): boyut tutamağı · MENÜ ÇUBUĞU (Dosya, Düzen, Görünüm, Oynat, Ekle, Rig, Yardım) · sekme satırı (açık sekanslar, adı değiştir) ·
// ARAÇ ÇUBUĞU (oynatma, anahtar/yasla/sığdır, 🦴 Rig, 🎥 Kamera, playhead okuması, Kaydet) · gövde: SOL iz listesi | ZAMAN çizelgesi | SAĞ sekmeler
// (Ayrıntılar · Rig · Kamera) · durum çubuğu. Dok açıkken 3B sahne dokun ÜSTÜNDE kalır (tuval küçülür, `--editor-alt`; dokBoyutu.ts): karakter dokun
// arkasında kesilmez. Eskiden her şey tek satıra sıkışmış düğmelerdi (Metin, Yeniden adlandır, Kopyasını oluştur…): artık menülerde.
//
// MANTIK SAF MODÜLLERDE (`uygulama/sekans/`, `uygulama/sekans/editor/`; testli). Kaydetme mevcut depo (`sekansDeposu.yaz`: biçim doğrulanır, bozuk diske
// gitmez); oynatma mevcut oynatıcı (`oynatmaDugmeleri.ts`: yalnız gerçek tık; menüde ▶ YOK — çalıştıran Ozyn'in düğmesidir).
// TUŞLAR OYUNA SIZMAZ (graf editörünün kalıbı, yapi/graf/grafEditoru.ts): kök keydown/keyup/keypress'i durdurur; odak dokun dışına (3B tuval, gövde) düşerse
// pencere yakalayıcısı (yalnız açıkken kurulu) yutar — JSON penceresi (`.ep-pencere`) ve başka yazı alanları hariç. Bekçi: sekansBekci.test.ts.
// HATA OLURSA OYUN KİLİTLİ KALMAZ: çizimde istisna editörü gizler, yakalayıcıyı kaldırır, nedeni altyazıyla söyler. Esc önce açık menüyü, sonra GİZLER.
"use strict";
import type { KlipBulucu } from "../../../world/avatar/index.ts";
import { sekmeListesiKur } from "../../duzenleyici/sekmeler.ts";
import { sekansMetni, type SekansDeposu } from "../../sekans/sekansDeposu.ts";
import type { SekansOynatici } from "../../sekans/oynatici.ts";
import { eksikKlipler } from "../../sekans/degerlendir.ts";
import type { KameraOynatici } from "../../sekans/kameraOynatici.ts";
import type { Nokta3 } from "../../../protocol/sekans.ts";
import { sekansOturumuKur, type SekansOturumu } from "../../sekans/editor/sekansOturumu.ts";
import { SEKANS_KISAYOLLARI, sekansKomutu, type SekansKomutu } from "../../sekans/editor/kisayollar.ts";
import { kareYazisi } from "../../sekans/editor/zamanEkseni.ts";
import type { RigKipi } from "../../rig/rigKipi.ts";
import { rigPaneliKur } from "../rig/rigPaneli.ts";
import { rigStiliEkle } from "../rig/rigStili.ts";
import { dugmeYap, el, ipucuSeridi, yaziAlaniMi } from "../ortak/dom.ts";
import { dokBoyutuKur } from "../ortak/dokBoyutu.ts";
import { kabukStiliEkle } from "../ortak/kabukStili.ts";
import { AYIRICI, type Menu } from "../ortak/menuModeli.ts";
import { menuCubuguKur } from "../ortak/menuCubugu.ts";
import { yanSekmelerKur } from "../ortak/yanSekmeler.ts";
import { adKutusuKur, sekmeSeridiKur } from "../ortak/sekmeSeridi.ts";
import { sekansStiliEkle } from "./sekansStili.ts";
import type { MesajTuru, SekansBaglami } from "./editorBaglami.ts";
import { zamanCizelgesiKur } from "./zamanCizelgesi.ts";
import { izListesiKur } from "./izListesi.ts";
import { ayrintiPaneliKur } from "./ayrintiPaneli.ts";
import { kameraPaneliKur } from "./kameraPaneli.ts";
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
  /** Control Rig (spec 38): sahnede kontrol şekilleri, auto-key. */
  rig: RigKipi;
  /** Kamera (spec 38 §7): önizleme sürücüsü, oyuncunun görünümü (derece görüş alanı), Orion'un konumu. */
  kamera: {
    oynatici: KameraOynatici; gorunum(): { konum: Nokta3; hedef: Nokta3; fov: number } | null; orion(): { konum: { x: number; y: number; z: number }; yaw: number } | null;
    /** Serbest kamera (orbit/pan/zoom/uç): editör açılınca ac, gizlenince kapat; odakla Orion'un karşısına alır. */
    serbest: { ac(): void; kapat(): void; odakla(): void; aktifMi(): boolean };
  };
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
  /** Rig kipini aç/kapa (araç çubuğundaki 🦴 ile aynı yol; senaryo ve test). */
  rigDegistir(ac: boolean): boolean;
  /** Sağ paneldeki bir sekmeyi aç (ayrinti, rig, kamera). */
  yanSekmeAc(id: string): void;
  /** Kamera sekmesinin seçili kamerası. */
  seciliKamera(): string | null;
  /** Dokun yüksekliği (px; test). */
  dokYuksekligi(): number;
}

const dugme = dugmeYap("sk-dugme");
const arac = dugmeYap("kb-arac");
const ESC_ONAY_MS = 3000;

export function sekansEditoruKur(a: SekansEditoruAyari): SekansEditoru {
  sekansStiliEkle(); kabukStiliEkle(); rigStiliEkle();
  const sekmeler = sekmeListesiKur<SekansOturumu>((o) => o.gecmis.kirli());
  let acik = false, escZamani = 0;
  const etkin = () => sekmeler.etkin();

  const kok = el("div", "sk-kok"); kok.tabIndex = -1; kok.dataset.acik = "0";
  const dok = dokBoyutuKur(kok, "orion.sekans.yukseklik.v1");
  const sekmeSatiri = el("div", "sk-ust");
  const bant = el("div", "sk-bant");
  const govde = el("div", "sk-govde");
  const alt = el("div", "kb-durum");
  const mesaj = el("div", "sk-mesaj");
  const durumOkuma = el("span", "sk-soluk");
  alt.append(mesaj, durumOkuma);
  const bildir = (m: string, tur: MesajTuru = "bilgi") => { mesaj.textContent = m; mesaj.dataset.tur = tur; mesaj.title = m; };

  // ── bağlam ve parçalar ──
  let yan: ReturnType<typeof yanSekmelerKur> | null = null;
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
    yanSekmeAc: (id) => yan?.sec(id),
    seciliKamera: () => kameraPaneli.seciliKamera(),
  };

  const zaman = zamanCizelgesiKur(b);
  const sol = izListesiKur(b);
  const sag = ayrintiPaneliKur(b);
  sag.kok.classList.add("sk-sag-ic");
  const rigPaneli = rigPaneliKur(a.rig, bildir);
  const kameraPaneli = kameraPaneliKur({ b, gorunum: a.kamera.gorunum, orion: a.kamera.orion, onizleme: a.kamera.oynatici });
  yan = yanSekmelerKur("orion.sekans.yansekme.v1", [
    { id: "ayrinti", etiket: "Ayrıntılar", ipucu: "Seçili anahtarın, bölümün, izin ya da sekansın alanları", icerik: sag.kok },
    { id: "rig", etiket: "Rig", ipucu: "Control Rig: kontrolleri seç, döndür; değişiklik playhead karesine anahtar olur", icerik: rigPaneli.kok },
    { id: "kamera", etiket: "Kamera", ipucu: "İsimli kameralar ve kamera kesmeleri", icerik: kameraPaneli.kok },
  ]);
  const kaydir = el("div", "sk-kaydir");
  const ic = el("div", "sk-ic");
  ic.append(sol.kok, zaman.kok);
  kaydir.append(ic);
  const yardim = el("div", "sk-yardim");
  { const t = el("table"); for (const k of SEKANS_KISAYOLLARI) { const tr = el("tr"); tr.append(el("td", "", k.tus), el("td", "", k.aciklama)); t.append(tr); } yardim.append(el("div", "sk-baslik2", "Kısayollar"), t); }
  govde.append(kaydir, yan.kok, yardim);

  // ── sekme satırı ──
  const seritler = sekmeSeridiKur<SekansOturumu>({
    sekmeler, onek: "sk", kirli: (o) => o.gecmis.kirli(), etiket: (ad) => `🎬 ${ad}`,
    ipucu: (ad, o) => `sekans '${ad}'${o.gecmis.kirli() ? " — kaydedilmemiş değişiklik var (Ctrl+S)" : ""}`,
    rozet: (ad) => (a.oynatici.durum().calisiyor?.sekans === ad ? "▶" : ""),
    sec: (ad) => { sekmeler.etkinYap(ad); tazele(); },
    kapandi: () => { if (!sekmeler.hepsi().length) bildir("Bütün sekmeler kapandı. Yapı çubuğu · Sekans sekmesinden bir sekans aç."); tazele(); },
  });
  const adKutusu = adKutusuKur((m) => bildir(m, "hata"), (m) => dugme(m), "sk");
  sekmeSatiri.append(seritler.kok, adKutusu.kok);

  // ── araç çubuğu ──
  const oynatma = oynatmaDugmeleriKur(b, a.oynatici);
  const grup = (...c: HTMLElement[]) => { const g = el("div", "kb-grup"); g.append(...c); return g; };
  const basaD = arac("⏮", "", "Oynatma aralığının başı (Home)"), geriD = arac("◀", "", "Bir kare geri (←)"), ileriD = arac("▶|", "", "Bir kare ileri (→)"), sonaD = arac("⏭", "", "Oynatma aralığının sonu (End)");
  const anahtarD = arac("◆ Anahtar", "", "K — seçili uzuv izine playhead karesinde anahtar ekle");
  const yaslaD = arac("🧲 Yasla", "", "N — sürüklerken komşu anahtara, bölüm kenarına ve playhead'e yapış (kapalı: yalnız tam kare)");
  const sigdirD = arac("⤢ Sığdır", "", "F — oynatma aralığını ekrana sığdır");
  const rigD = arac("🦴 Rig", "", "Control Rig: karakteri poz moduna al; sahnede şekillere tıkla, halkaları sürükle (değişiklik anahtar olur)");
  const kameraD = arac("🎥 Kamera", "", "Kamera sekmesini aç: isimli kameralar ve kesmeler");
  const odakD = arac("🎯 Orion", "", "Serbest kamerayı Orion'un karşısına al. Sahnede: sağ tuş sürükle = orbit · orta tuş = pan · tekerlek = yakınlaş · sağ tuş + WASD/QE = uç (Shift hızlı)");
  const kaydetD = arac("💾 Kaydet", "", "Ctrl+S — biçim doğrulanır, bozuksa yazılmaz");
  const kapatD = arac("✕", "", "Editörü gizle (Esc) — sekmeler ve kaydedilmemiş değişiklik bellekte kalır");
  const playheadYazi = el("span", "kb-okuma");
  const aracSatiri = el("div", "kb-aracsatiri");
  aracSatiri.append(
    grup(basaD, geriD, ...oynatma.ogeler.slice(0, 2), ileriD, sonaD, oynatma.ogeler[2]!),
    grup(anahtarD, yaslaD, sigdirD), grup(rigD, kameraD, odakD), playheadYazi, el("span", "kb-bosluk"), oynatma.satir, kaydetD, kapatD,
  );

  // ── menüler ──
  const o = (): SekansOturumu | null => etkin()?.icerik ?? null;
  const menuler = (): Menu[] => [
    { ad: "Dosya", satirlar: [
      { etiket: "Kaydet", kisayol: "Ctrl+S", etkin: () => !!o() && o()!.dis !== "silindi", calistir: () => { void kaydet(); } },
      AYIRICI,
      { etiket: "Yeniden adlandır…", etkin: () => !!o(), calistir: () => { const s = etkin(); if (s) adKutusu.ac("yeni ad:", s.ad, (y) => dosyalar.yenidenAdlandir(s.ad, y)); } },
      { etiket: "Kopyasını oluştur…", etkin: () => !!o(), calistir: () => { const s = etkin(); if (s) adKutusu.ac("kopyanın adı:", `${s.ad}_kopya`, async (y) => { await dosyalar.kopyasiniOlustur(s.ad, y); ac(y); }); } },
      { etiket: "JSON (metin) görünümü", ipucu: "Eski metin düzenleyici; Ctrl+S orada da kaydeder (bozuk JSON kaydedilmez)", etkin: () => !!o(), calistir: () => { const s = etkin(); if (s) a.metinAc(s.ad); } },
      AYIRICI,
      { etiket: "Editörü gizle", kisayol: "Esc", calistir: () => escIste() },
    ] },
    { ad: "Düzen", satirlar: [
      { etiket: "Geri al", kisayol: "Ctrl+Z", etkin: () => !!o(), calistir: () => komut("geriAl") },
      { etiket: "Yinele", kisayol: "Ctrl+Y", etkin: () => !!o(), calistir: () => komut("yinele") },
      AYIRICI,
      { etiket: "Anahtar ekle (playhead)", kisayol: "K", etkin: () => !!o(), calistir: () => komut("anahtarEkle") },
      { etiket: "Sil", kisayol: "Delete", etkin: () => !!o(), calistir: () => komut("sil") },
      { etiket: "Tümünü seç", kisayol: "Ctrl+A", etkin: () => !!o(), calistir: () => komut("tumunuSec") },
    ] },
    { ad: "Görünüm", satirlar: [
      { etiket: "Yaslama", kisayol: "N", isaretli: () => !!o()?.yasla, etkin: () => !!o(), calistir: () => komut("yasla") },
      { etiket: "Oynatma aralığına sığdır", kisayol: "F", etkin: () => !!o(), calistir: () => komut("sigdir") },
      AYIRICI,
      { etiket: "Ayrıntılar sekmesi", calistir: () => yan?.sec("ayrinti") },
      { etiket: "Rig sekmesi", calistir: () => yan?.sec("rig") },
      { etiket: "Kamera sekmesi", calistir: () => yan?.sec("kamera") },
    ] },
    { ad: "Oynat", satirlar: [
      { etiket: "▶ Oynat — araç çubuğundaki düğme", ipucu: "Oynatmak yalnız senin gerçek tıklamanla çalışır: menüden ya da kısayoldan oynatılmaz", etkin: () => false, calistir: () => undefined },
      { etiket: "■ Durdur", etkin: () => a.oynatici.durum().calisiyor !== null, calistir: () => { a.oynatici.durdur(); tazele(); } },
      { etiket: "Döngü", isaretli: () => !!o()?.dongu, etkin: () => !!o(), calistir: () => { const x = o(); if (x) { x.dongu = !x.dongu; tazele(); } } },
      AYIRICI,
      { etiket: "Başa", kisayol: "Home", etkin: () => !!o(), calistir: () => komut("basa") },
      { etiket: "Sona", kisayol: "End", etkin: () => !!o(), calistir: () => komut("sona") },
      { etiket: "Önceki anahtar", kisayol: ",", etkin: () => !!o(), calistir: () => komut("oncekiAnahtar") },
      { etiket: "Sonraki anahtar", kisayol: ".", etkin: () => !!o(), calistir: () => komut("sonrakiAnahtar") },
    ] },
    { ad: "Ekle", satirlar: [
      { etiket: "Kamera…", ipucu: "Kamera sekmesini açar: şu anki görünümden, Orion'un karşısına ya da yanına", etkin: () => !!o(), calistir: () => yan?.sec("kamera") },
      { etiket: "Kamera kesmesi (playhead)", etkin: () => !!o() && (o()!.sekans().kameralar ?? []).length > 0, calistir: () => { yan?.sec("kamera"); bildir("Kamera sekmesinde bir kamera seç, ＋ Kesme'ye bas (kare = playhead)"); } },
      { etiket: "Uzuv / klip izi…", ipucu: "Sol sütundaki bağlama satırının ＋ iz düğmesi", etkin: () => false, calistir: () => undefined },
    ] },
    { ad: "Rig", satirlar: [
      { etiket: "Rig kipi", isaretli: () => a.rig.acikMi(), etkin: () => !!o(), calistir: () => { rigDegistir(!rigIstegi); } },
      { etiket: "Seçili uzvu sıfırla", etkin: () => a.rig.acikMi() && a.rig.secili() !== null, calistir: () => { const r = a.rig.sifirla(); if (r.mesaj) bildir(r.mesaj, r.ok ? "bilgi" : "hata"); } },
      { etiket: "Seçimi bırak", etkin: () => a.rig.acikMi() && a.rig.secili() !== null, calistir: () => a.rig.sec(null) },
    ] },
    { ad: "Yardım", satirlar: [
      { etiket: "Kısayollar", kisayol: "?", calistir: () => komut("yardim") },
    ] },
  ];
  const menu = menuCubuguKur(menuler);

  kok.append(dok.tutamak, menu.kok, sekmeSatiri, aracSatiri,
    ipucuSeridi("orion.sekansEditoru.ipucu.v3", "Cetvele tık/sürükle: playhead (beden o karede) · ← → kare kare · ◆ anahtarı sürükle · çift tık: ekle · 🦴 Rig · 🎥 Kamera · SAHNEDE: sağ tuş sürükle = orbit, orta tuş = pan, tekerlek = yakınlaş, sağ tuş + WASD/QE = uç · kenardan sürükle: editörü büyüt/küçült", "sk-ipucu", dugme),
    bant, govde, alt);

  // ── araç çubuğu olayları ──
  basaD.addEventListener("click", () => { basaD.blur(); komut("basa"); });
  geriD.addEventListener("click", () => { geriD.blur(); komut("geri1"); });
  ileriD.addEventListener("click", () => { ileriD.blur(); komut("ileri1"); });
  sonaD.addEventListener("click", () => { sonaD.blur(); komut("sona"); });
  anahtarD.addEventListener("click", () => { anahtarD.blur(); komut("anahtarEkle"); });
  yaslaD.addEventListener("click", () => { yaslaD.blur(); komut("yasla"); });
  sigdirD.addEventListener("click", () => { sigdirD.blur(); zaman.sigdir(); });
  rigD.addEventListener("click", () => { rigD.blur(); rigDegistir(!rigIstegi); });
  kameraD.addEventListener("click", () => { kameraD.blur(); yan?.sec("kamera"); });
  odakD.addEventListener("click", () => { odakD.blur(); a.kamera.serbest.odakla(); bildir("serbest kamera Orion'un karşısında", "iyi"); });
  kaydetD.addEventListener("click", () => { kaydetD.blur(); void kaydet(); });
  kapatD.addEventListener("click", () => { kapatD.blur(); escIste(); });

  // ── Control Rig kipi ──
  let rigIstegi = false, rigAd: string | null = null, rigOturum: SekansOturumu | null = null, senkronda = false;
  function rigSenkron(): void {
    if (senkronda) return;
    senkronda = true;
    try {
      const s = etkin();
      if (!rigIstegi || !s || !acik) { a.rig.kapat(); rigAd = null; rigOturum = null; return; }
      if (!a.rig.acikMi() || rigAd !== s.ad || rigOturum !== s.icerik) {
        a.rig.kapat();
        const r = a.rig.ac(s.icerik, s.ad);
        if (!r.ok) { rigIstegi = false; rigAd = null; rigOturum = null; bildir(r.mesaj ?? "rig açılamadı", "hata"); return; }
        rigAd = s.ad; rigOturum = s.icerik;
      }
    } finally { senkronda = false; }
  }
  function rigDegistir(ac: boolean): boolean {
    if (ac && !etkin()) { bildir("rig için önce bir sekans aç", "uyari"); return false; }
    rigIstegi = ac;
    rigSenkron();
    if (ac && a.rig.acikMi()) yan?.sec("rig");
    tazele();
    return a.rig.acikMi() === ac;
  }

  function bantCiz(): void {
    const s = etkin(), x = s?.icerik;
    bant.replaceChildren(); bant.dataset.acik = x?.dis ? "1" : "0";
    if (!s || !x?.dis) return;
    if (x.dis === "silindi") { bant.append(el("span", "", `'${s.ad}' dosyası artık yok (silindi ya da adı değişti): bu sekme kaydedilemez. Gerekirse Kopyasını oluştur.`)); return; }
    const al = dugme("Diskteki hâli al", "", "Benim değişikliklerim gider");
    al.addEventListener("click", () => { const y = a.depo.al(s.ad); if (y) { x.gecmis.sifirla(y); x.secim = { tur: "yok" }; x.dis = null; bildir("diskteki hâl alındı"); tazele(); } });
    const koru = dugme("Benimkini koru", "", "Kaydedince benim hâlim yazılır");
    koru.addEventListener("click", () => { x.dis = null; tazele(); });
    bant.append(el("span", "", "Dosya editör dışında değişti ve sende kaydedilmemiş değişiklik var."), al, koru);
  }

  function tazele(): void {
    if (!acik) return;
    try {
      rigSenkron();
      a.rig.pozOnizleme(etkin()?.icerik ?? null, etkin()?.ad ?? null);   // beden playhead karesinde (rig kapalıyken de)
      seritler.ciz(); oynatma.ciz(); bantCiz(); menu.ciz();
      const x = o();
      const k = b.oynayanKare() ?? x?.kare ?? 0;
      playheadYazi.textContent = x ? `▸ ${kareYazisi(k)}` : "";
      kaydetD.disabled = !x || x.dis === "silindi";
      for (const d of [anahtarD, yaslaD, sigdirD, rigD, kameraD, odakD, basaD, geriD, ileriD, sonaD]) d.disabled = !x;
      yaslaD.dataset.acik = x?.yasla ? "1" : "0";
      rigD.dataset.acik = a.rig.acikMi() ? "1" : "0";
      yan?.rozet("rig", a.rig.acikMi() ? "●" : "");
      zaman.ciz(); sol.ciz();
      const odak = document.activeElement;
      const duzenleniyor = odak && yan?.kok.contains(odak) && (yaziAlaniMi(odak) || (odak as HTMLElement).matches?.("input[type=range]"));   // yazılan yarım değer ve sürüklenen kaydırıcı silinmesin
      if (!duzenleniyor) { sag.ciz(); rigPaneli.ciz(); kameraPaneli.ciz(); }   // yazılan yarım değer silinmesin
      const eksik = x ? eksikKlipler(x.sekans(), a.klipler) : [];
      if (eksik.length && mesaj.dataset.tur !== "hata") bildir(`⚠ kütüphanede olmayan klip: ${eksik.join(", ")} — bu sekans oynatılamaz (bölümün klibini Ayrıntılar'dan değiştir)`, "uyari");
      durumOkuma.textContent = x ? `${x.sekans().izler.length} iz · ${(x.sekans().kameralar ?? []).length} kamera · ${x.sekans().sure_kare} kare` : "";
    } catch (err) { coktu(err); }
  }

  function coktu(err: unknown): void {
    console.error("[SEKANS-EDITOR] hata:", err);
    a.altyazi(`sekans editörü hata verdi ve gizlendi: ${err instanceof Error ? err.message : String(err)} (Metin ile JSON'u açabilirsin)`, 6000);
    try { gizle(); } catch (e2) { console.error("[SEKANS-EDITOR] gizlenemedi:", e2); kok.dataset.acik = "0"; document.documentElement.style.removeProperty("--editor-alt"); removeEventListener("keydown", yakala, { capture: true }); removeEventListener("keyup", yakala, { capture: true }); }
  }

  async function kaydet(): Promise<void> {
    const s = etkin();
    if (!s) return;
    const x = s.icerik;
    if (x.dis === "silindi") { bildir("dosya artık yok: kaydedilemez (Kopyasını oluştur)", "hata"); return; }
    const y = x.gecmis.simdiki();
    try { await a.depo.yaz(s.ad, sekansMetni(y)); x.gecmis.kaydedildi(y); x.dis = null; bildir(`kaydedildi: ${s.ad}`, "iyi"); }
    catch (err) { bildir(`KAYDEDİLEMEDİ: ${err instanceof Error ? err.message : String(err)}`, "hata"); }
    tazele();
  }

  function escIste(): void {
    if (menu.kapat()) return;
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
    const x = o();
    if (k === "kaydet") { void kaydet(); return; }
    if (k === "kapat") { escIste(); return; }
    if (k === "yardim") { yardim.dataset.acik = yardim.dataset.acik === "1" ? "0" : "1"; return; }
    if (!x) return;
    // Playhead'i elle oynatmak oynatmayı keser (scrub kuralı).
    if (["geri1", "ileri1", "geri10", "ileri10", "basa", "sona", "oncekiAnahtar", "sonrakiAnahtar"].includes(k) && b.oynayanKare() !== null) a.oynatici.durdur();
    const r = ({
      geriAl: () => x.geriAl(), yinele: () => x.yinele(), sil: () => x.sil(), anahtarEkle: () => x.anahtarEkle(), tumunuSec: () => x.tumunuSec(),
      geri1: () => { x.adim(-1); return null; }, ileri1: () => { x.adim(1); return null; }, geri10: () => { x.adim(-10); return null; }, ileri10: () => { x.adim(10); return null; },
      basa: () => { x.basa(); return null; }, sona: () => { x.sona(); return null; }, oncekiAnahtar: () => x.anahtaraAtla(-1), sonrakiAnahtar: () => x.anahtaraAtla(1),
      sigdir: () => { zaman.sigdir(); return null; }, yasla: () => { x.yasla = !x.yasla; return { ok: true, mesaj: x.yasla ? "yaslama açık" : "yaslama kapalı (yalnız tam kare)" }; },
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
        dok.goster(true);
        a.kamera.serbest.ac();
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
    a.rig.pozOnizleme(null, null);      // beden normal davranışına döner
    a.kamera.serbest.kapat();           // serbest kamera bırakılır: oyuncunun kendi kamerası
    rigSenkron();                       // rig kapanır (kipi istek olarak kalır: tekrar açılınca geri gelir)
    kameraPaneli.kapat();
    menu.kapat();
    kok.dataset.acik = "0";
    dok.goster(false);
    adKutusu.kapat(); zaman.iptal();
    removeEventListener("keydown", yakala, { capture: true });
    removeEventListener("keyup", yakala, { capture: true });
    if (document.activeElement && kok.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    a.gorunurlukDegisti?.(false);
  }

  const dosyalar = sekansDosyaIslemleriKur({ sekmeler, depo: a.depo, oynatici: a.oynatici, degisti: () => tazele() });
  return {
    ac, gizle, acikMi: () => acik, yenidenAdlandir: dosyalar.yenidenAdlandir, kopyasiniOlustur: dosyalar.kopyasiniOlustur,
    etkinOturum: () => etkin()?.icerik ?? null, tazele, rigDegistir, yanSekmeAc: (id) => yan?.sec(id), seciliKamera: () => kameraPaneli.seciliKamera(), dokYuksekligi: () => dok.yukseklik(),
  };
}
