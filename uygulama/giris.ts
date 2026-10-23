// uygulama/giris.ts — Renderer giriş noktası ve BİRLEŞTİRME NOKTASI.
//
// Burada iş mantığı yoktur; parçalar birbirine bağlanır:
//   motor + sahne + saat (20Hz) + oda + kamera rig'i + oyuncu + HUD.
//
// İKİ DÖNGÜ AYRIMI (kritik, K1/K2):
//   saat.dinle(...)      → MANTIK. 20Hz sabit. Oyuncu hareketi, çarpışma,
//                          etkileşim taraması, kamera HEDEF pozu.
//   runRenderLoop(...)   → ÇİZİM. Serbest FPS. Yalnızca saati ilerletir,
//                          kamerayı hedefe yumuşatır ve sahneyi çizer.
// Mantık asla render döngüsünde çalışmaz; yoksa Orion'un davranışı donanıma
// göre değişir ve tekrarlanabilirlik ölür.
//
// K4 VE BU DOSYA: `world/` ALTINDAKİ MODÜLLER `bridge/`, `mind/`, `voice/`
// import edemez — kural onlar için. Burası birleştirme noktasıdır (composition
// root): katmanları BİRBİRİNE BAĞLAYAN tek yer burasıdır, bu yüzden voice/ ve
// avatar/ buradan görülür. Kural gevşetilmedi; bağlama işi uygulama/ katmanına hapsedildi.
//
// BÖLME (mimari düzenleme B1–B2, 2026-10-15): giris.ts kompozisyon kökü KALDI (Vite giriş noktası, kurulum SIRASI
// burada); bölümler uygulama/ altına taşındı. Her fabrika eski yerinde çağrılır; sonradan atananlar (orion, kopru …)
// getter ile okunur (bkz. senaryoBaglami.ts'teki desen). Taşınanlar:
//   hafizaDeposu.ts · devrePanosu.ts · terminalAlgisi.ts · odak.ts · yerGecisi.ts · onayBaglantisi.ts
//   algiBaglantisi.ts · varlikSinyali.ts · dunyaDurumu.ts · hud.ts · dunyaKancasi.ts · kopruKur.ts
//   kopruDinleyicileri.ts · mikrofon.ts · mcpBaglantisi.ts · sohbetKutusu.ts · orionSesi.ts · altyazi.ts · dumanTesti.ts
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Materials/standardMaterial";
// YAN ETKİ — iki ayrı kullanıcısı var, ikisi de bu satır olmadan SESSİZCE bozulur:
//   `Scene.pickWithRay` (kamera duvar testi) ve `Scene.pick` (odakta tıklama).
// Babylon'un ağaç-sarsılabilir derlemesinde bu metotlar `Culling/ray` modülünün
// yan etkisi olarak tanımlanıyor; yoksa `pick` hata vermeden `hit:false` döner.
// Sözleşme `world/engine/secim.test.ts` ile sabitlendi.
import "@babylonjs/core/Culling/ray";
import { Saat } from "../world/engine/tik.ts";
import { KameraRig } from "../world/engine/kamera.ts";
import { odaKur } from "../world/level/oda.ts";
import type { Yer } from "../world/yer/yer.ts";
import { Oyuncu } from "../world/player/oyuncu.ts";
import { EtkilesimOlaylari } from "../world/player/etkilesim.ts";
import { avatarKur, orionGozuKur, VARSAYILAN_VRM, klipKutuphanesiKur, klipleriYukle, type Avatar } from "../world/avatar/index.ts";
import { monitorKur, type Monitor } from "../world/surfaces/terminal/monitor.ts";
import { tahtaKur, type Tahta } from "../world/surfaces/tahta/tahta.ts";
import { gunlukKur, type GunlukEkrani } from "../world/surfaces/duvar/gunluk.ts";
import { semaKur, type SemaPaneli } from "../world/surfaces/duvar/sema.ts";
import type { Pano } from "../protocol/pano.ts";
import { PANO_TELLERI, devrePanosuKur, olcumKilidiKancasiKur } from "./devrePanosu.ts";
// Yalnızca `zihindene` ayna kontrolü için: şemanın sütun sırasıyla ekrandaki
// sırayı karşılaştırmak gerek. Saf veri, K4 sınırını ihlal etmez.
import { TAHTA, GUNLUK, SEMA } from "../world/level/olculer.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { varlik } from "../world/varlik.ts";
import { modelSeciciKur } from "../world/arayuz/modelSecici.ts";
import { stilPenceresiKur } from "../world/arayuz/stilPenceresi.ts";
import type { Beyin } from "../bridge/beyin.ts";
import { MetinGirdi } from "../voice/metin-girdi.ts";
import { komutKipiCoz } from "./komutKipi.ts";
import { Takipci } from "./takip.ts";
import { Ajanda } from "../mind/ajanda.ts";
import { mesgulMu } from "../mind/benlik.ts";
import type { SeciliNesne } from "../mind/komutSozlugu.ts";
import { istenenSenaryolar, type SenaryoBaglami } from "./senaryoBaglami.ts";
import { niyetYurutucusuKur } from "./niyetYurutucu.ts";
import { altyaziKur } from "./altyazi.ts";
import { terminalAlgisiKur } from "./terminalAlgisi.ts";
import { odakKur } from "./odak.ts";
import { yerlerKur, yerGecisiKur } from "./yerGecisi.ts";
import { mcpBaglantisiKur } from "./mcpBaglantisi.ts";
import { sohbetKutusuKur } from "./sohbetKutusu.ts";
import { dumanTestiKur } from "./dumanTesti.ts";
import { orionSesiKur } from "./orionSesi.ts";
import { kopruKur, yetkiAnahtarlari } from "./kopruKur.ts";
import { orionAyarlariKur } from "./ayar/orionAyarlari.ts";
import { mikrofonKur } from "./mikrofon.ts";
import { durumGozlemiKur, sohbetKipiIsaretiKur, arizaGostergesiKur, konusmayiBagla, orionKonusmasi } from "./kopruDinleyicileri.ts";
import { onayBaglantisiKur } from "./onayBaglantisi.ts";
import { varlikSinyaliKur } from "./varlikSinyali.ts";
import { dunyaDurumuKur, seciliDurumu } from "./dunyaDurumu.ts";
import { hudKur } from "./hud.ts";
import { dunyaKancasiKur } from "./dunyaKancasi.ts";
import { algiSorKur } from "./algiBaglantisi.ts";
import { zihinDuvariniBagla } from "./zihinDuvari.ts";
import { beyinSeciminiKur, seciciKaynagiKur, modelKancasiKur, kisaAd } from "./beyinSecimi.ts";
import { GucButcesi, Inisiyatif, butceSatiri } from "../mind/inisiyatif.ts";
import { inisiyatifTik } from "./inisiyatifBaglantisi.ts";
import { ortamBaglantisiKur } from "./ortamBaglantisi.ts";
import { doktorKur, doktorBaglamiBabylon } from "./doktor.ts";
import { webMonitoruKur, type WebKopru } from "./webMonitoru.ts";
import { gozlemKur } from "./gozlem.ts";
import { gozPaneliKur } from "../world/arayuz/gozPaneli.ts";
import { bedenPaneliKur } from "../world/arayuz/bedenPaneli.ts";
import { bedenAyariniYukle, bedenAyariniKaydet } from "./bedenKaydi.ts";
import { OYUNCU_BEDEN_DOSYASI, SLOTLAR, RENK_ADLARI, VARSAYILAN as BEDEN_VARSAYILANI, YOK as BEDEN_YOK, ayariDuzelt as bedenAyariniDuzelt } from "../world/player/bedenAyari.ts";
import { kabukKoprusu } from "./kabuk.ts";
import { yolKur } from "./yol.ts";
import type { Olaylar, Servisler } from "./yolTipleri.ts";
import { OrtamGunlugu, ogrenilenDeposu } from "./ortamDeposu.ts";
import { OrtamSozlugu } from "../mind/ortamSozlugu.ts";
import { sessizlikIzinliMi } from "../bridge/ozerkYetenek.ts";
import { GozModeli } from "../bridge/goz.ts";
import { KuralRefleksi } from "../mind/refleks.ts";
import { kimlik } from "../protocol/temel.ts";
import type { DavranisDefteri } from "../world/davranisDenemesi.ts";
import { imlecKipiKur } from "../world/player/imlecKipi.ts";
import { fareIsini } from "../world/engine/fareIsini.ts";
import { secimVurgusuKur } from "../world/level/secimVurgusu.ts";
import { nesnePaneliKur, type PanelNesne } from "../world/arayuz/nesnePaneli.ts";
import { baglamMenusuKur } from "../world/arayuz/menu/baglamMenusu.ts";
import { yerlestirmeKur } from "./yerlestirmeBaglantisi.ts";
import { duzenlemeKipiKur } from "./duzenlemeKipi.ts";
import { altCubukKur } from "../world/arayuz/altCubuk.ts";
import { editorPenceresiKur } from "../world/arayuz/editorPenceresi.ts";
import { hafizaSekmesi } from "./yapi/hafizaSekmesi.ts";
import { zihinSekmesi } from "./yapi/zihinSekmesi.ts";
import { mdDeposuKur, mdKaynaginiSec } from "./mdDeposu.ts";
import { otomatikBlok } from "../mind/anlikHafiza.ts";
import { ANLIK_HAFIZA, MD_SINIRLARI } from "../mind/mdBaglami.ts";
import { hafizaAyariniKaliciYap, hafizaAyariniYukle } from "./hafizaAyari.ts";
import { assetSekmesi } from "./yapi/assetSekmesi.ts";
import { zeminSekmesi } from "./yapi/zeminSekmesi.ts";
import { zeminKalemiKur } from "./zeminKalemi.ts";
import { zeminBaglantisiKur } from "./zeminBaglantisi.ts";
import { birlesikYerKur } from "../world/yer/birlesikYer.ts";
import { levelYeriniOlc } from "../world/yer/levelOlcumu.ts";
import { menuKur } from "../world/arayuz/menu/menuModeli.ts";
import { MENU_KATKILARI, MENU_AYARI, type HedefMenuBaglami, type MenuEylemi, type MenuHedefi } from "./menuKatkilari.ts";
import { nesneEylemleri, type NesneEylemi } from "../world/yer/nesneEylemleri.ts";
import { secimDurumuKur } from "./secimDurumu.ts";
import { nesneSecimiKur } from "./nesneSecimi.ts";
import { ORION_KUTUSU, orionuVur, zeminNoktasi } from "../world/player/hedefSecici.ts";
import { zeminOzellikleri, orionOzellikleri } from "../world/yer/hedefEylemleri.ts";
import { nesneEtkilesimiKur, seciliSozOlustur } from "./nesneEtkilesimi.ts";
import { AjanDefteri, ORION_AJANI, type HedefSecimi } from "./ajanlar/ajanKaydi.ts";
import { FLASH } from "../flash/npcTanimi.ts";
import { FLASH_SEMASI, flashSemaKancasi } from "./ajanlar/flashSemasi.ts";
import { semaTuvaliKur } from "../world/surfaces/duvar/semaTuvali.ts";
import { CipSecimi, hedefCipleri } from "./ajanlar/cipModeli.ts";
import { sohbetHedefiKur, hatirlananHedef } from "./sohbetHedefi.ts";
import { girdiAdaptoruKur } from "./ajanlar/girdiAdaptoru.ts";
import { emirHedefleri as emirHedefleriBul, emirTeslim } from "./ajanlar/emir.ts";
import { Koltuklar } from "./ajanlar/koltuklar.ts";
import { flashBaglantisiKur, type FlashBaglantisi } from "./ajanlar/flashBaglantisi.ts";
import { grafYetenegiKur, type AjanKapisi } from "./graf/grafYetenegi.ts";
import { govdeDurumundan, okumaSuresiMs } from "./ajanlar/ajanGovdesi.ts";
import { grafKutuphanesi } from "./graf/kutuphane.ts";
import { grafDeposuKur, grafKaynaginiSec } from "./graf/grafDeposu.ts";
import { npcDeposuKur, npcKaynaginiSec } from "./graf/npcDeposu.ts";
import { grafCalistiriciKur, type GrafCalistirici } from "./graf/grafCalistirici.ts";
import { grafDinleyiciKur, olayYoluKur, type GrafDinleyici } from "./graf/grafDinleyici.ts";
import { GrafDurumDeposu } from "./graf/grafDurumu.ts";
import { diyalogDenetimiKur } from "./graf/diyalogDenetimi.ts";
import { diyalogKutusuKur } from "./yapi/diyalogKutusu.ts";
import { grafSekmesi } from "./yapi/grafSekmesi.ts";
import { grafEditoruKur } from "./yapi/graf/grafEditoru.ts";
import { geciciKlipKatmaniKur } from "./sekans/geciciKlipler.ts";
import { sekansKur } from "./yapi/sekans/kurulum.ts";

const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const altyazi = document.getElementById("altyazi") as HTMLDivElement;
const altyaziGoster = altyaziKur(altyazi);
// YOL: sonradan kurulan canlı nesneler (orion, kopru …) ve modüller arası olaylar tek tabloda (uygulama/yolTipleri.ts, uygulama/yol.ts).
const yol = yolKur<Olaylar, Servisler>();

// ── Motor + sahne ──────────────────────────────────────────────────────────
const motor = new Engine(tuval, true, { preserveDrawingBuffer: false, stencil: true }, true);
const sahne = new Scene(motor);
sahne.clearColor = new Color4(0.027, 0.027, 0.051, 1);
// Çarpışmayı kendimiz yapıyoruz (AABB, olculer.ts) — Babylon'un collider
// altyapısı kurulmaz: her karede gereksiz ellipsoid testi yok.
sahne.collisionsEnabled = false;
// Statik dekor çoğunlukta; aktif mesh listesi her karede yeniden kurulmasın.
sahne.skipPointerMovePicking = true;
sahne.autoClear = true;

// ── Dünya ──────────────────────────────────────────────────────────────────
const oda = odaKur(sahne);
// YER (spec 24): Ozyn ve Orion AYRI yerde olabilir (Orion kendi kararıyla kapıdan çıkar, C6). Çarpışma, bakış
// ışını, çapalar ve algı her aktörün kendi yerinden okunur. Bugün ikisi de ofiste; kapı geçişi (C3) bunları değiştirir.
const yerler = yerlerKur();
const rig = new KameraRig(sahne, tuval);
// İMLEÇ KİPİ (Tab, spec 28): gezinirken imleç serbest, tıklama nesne seçer (uygulama/nesneSecimi.ts). Açılması yalnız odakta (terminal/panel), yazan sohbette ve
// bekleyen onayda engellenir; kapanınca açık menü de kapanır. `sohbet`, `onayKapisi`, `nesnePaneli` aşağıda kurulur: çağrı ANINDA okunur.
const imlec = imlecKipiKur({
  kilidiBirak: () => rig.fareKilitBirak(),
  kilidiIste: () => rig.fareKilitIste(),
  engelli: () => rig.odakta || sohbet.acikMi() || onayKapisi.durum === "bekliyor",
  degisti: (acik) => {
    altCubuk.gorunur(acik);   // Yapı çubuğu yalnız imleç kipinde görünür (fare serbestken tıklanabilir)
    editorPenceresi.gorunur(acik);   // düzenleyici pencereleri de (gizlenir, KAYBOLMAZ: yazılmış metin durur)
    grafPenceresi.gorunur(acik);     // grafiklerin JSON düzenleyicisi de (spec 35)
    npcPenceresi.gorunur(acik);      // NPC kayıtlarınınki de (spec 35 dilim 3)
    sekansSistemi.pencere.gorunur(acik);   // sekansların JSON penceresi de (spec 36)
    orionAyarPaneli.gorunur(acik);   // Orion'un ayar paneli de (spec 34; fare kilitliyken tıklanamaz — gizlenir, seçim sürer)
    if (!acik) { nesnePaneli.kapat(); baglamMenusu.kapat(); duzenleme.bitir(); zeminKalemi.sec(null); }
  },
});
// Doğum yeri köşeden İÇERİ: (2.6, 2.6) kapı köşesiydi ve omuz kamerası iki
// duvara birden sıkışıp oyuncunun gövdesine yapışıyordu (ölçüm: 1.44 m).
const oyuncu = new Oyuncu(sahne, oda, rig, {
  dogumYeri: new Vector3(1.6, 0, 1.9),
  yer: () => yerler.ozyn,
  imlec,
  // Esc yığınının 0. aşaması: panel içindeki alt görünüm önce kapanır.
  // `sema` aşağıda kuruluyor; kapanış çağrı ANINDA okunduğu için sorun yok.
  // Esc yığını sırayla daralır: teyit → detay → (oyuncu.ts: etkileşim →
  // odak → fare kilidi). Her Esc BİR adım geri alır; tek tuşun kullanıcıyı
  // duvarın dibinden odanın ortasına atması istenmiyor.
  escOnce: () => {
    const pano = yol.al("pano");
    if (pano?.bekleyenTeyit()) {
      pano.teyitIptal();
      altyaziGoster("teyit iptal edildi", 1800);
      return true;
    }
    if (sema.secili() === null) return false;
    sema.sec(null);
    altyaziGoster("şemaya dönüldü · Esc ile panelden çık", 1800);
    return true;
  },
});
// Ozyn'in görünür bedeni: Orion'un iskeleti, MODÜLER giysiler (world/player/oyuncuBeden.ts, ayar bedenAyari.ts, panel B tuşu). Kayıtlı ayar yüklenir;
// beden yüklenene kadar kapsül görünür.
oyuncu.bedenAyarla(bedenAyariniYukle());
void oyuncu.bedenYukle(varlik(OYUNCU_BEDEN_DOSYASI));  // varlik(): paketli file:// altında "./" ile çözülür (mutlak "/" yüklenemezdi)

const saat = new Saat();

// ── Monitör: masadaki ekran gerçek bir terminal olur ───────────────────────
const monitor: Monitor = monitorKur({ sahne, ekran: oda.monitorEkran });

// ── Beyaz tahta: Orion odada kalıcı iz bırakabilsin ────────────────────────
// `yaz` niyeti protokolde vardı ve LLM'e araç olarak sunuluyordu, ama yüzeyi
// hiç yazılmamıştı: her çağrı hata dönüyordu. Tahta bir dekordu.
const tahta: Tahta = tahtaKur({
  sahne, yuzey: oda.tahtaYuzey,
  genislikM: TAHTA.genislik, yukseklikM: TAHTA.yukseklik,
});

// ── Yönetim terminali: masadaki ikinci ekran ──────────────────────────────
//
// Ana monitörden AYRI olmak zorunda. `monitor` Ozyn'in çalıştığı ve ORION'UN
// İZLEDİĞİ ekrandır: oradaki her komut çıktısı algı hattına giriyor. Yönetim
// işi (dünyayı kurcalamak, günlüğe bakmak) Orion'un algısına gürültü olarak
// düşmemeli — bu yüzden admin terminalinin çıktısı köprüye BAĞLANMAZ.
const adminTerminal: Monitor = monitorKur({
  sahne, ekran: oda.adminEkran, ad: "admin",
  // Küçük ekran (0.74 × 0.44 m): 24 satır burada okunmaz.
  satir: 14,
});

// ── Zihin duvarı: günlük ekranı ───────────────────────────────────────────
// Beynin ne yaptığı şimdiye kadar yalnızca tarayıcı konsolundaydı — dünyanın
// DIŞINDA. Kota arızasında Orion 75 sn boyunca sustu ve odada sebebi
// görünmedi. Artık olay akışı duvarda.
const gunluk: GunlukEkrani = gunlukKur({
  sahne, mesh: oda.gunlukYuzey,
  genislikM: GUNLUK.genislik, yukseklikM: GUNLUK.yukseklik,
  satir: 18,
});
gunluk.ekle("bilgi", "dunya", "oda kuruldu");

// ── Zihin duvarı: akış şeması ─────────────────────────────────────────────
// Günlük NE olduğunu söyler; şema NEREDE olduğunu gösterir. İkisi ayrı panel
// çünkü biri tarihçe, diğeri anlık durum — aynı yüzeyde ikisi de okunmaz.
const sema: SemaPaneli = semaKur({
  sahne, mesh: oda.semaYuzey,
  genislikM: SEMA.genislik, yukseklikM: SEMA.yukseklik,
});
sema.durumYaz("dünya kuruldu, beyin bekleniyor");

// ── Orion: avatar asenkron yüklenir, sahne onsuz da ayakta kalır ───────────
// `orion` bir yol servisidir (yolTipleri.ts): avatar kurulunca kaydolur, tüketiciler `yol.al("orion")` ile okur.
// AJANLAR (spec 33): Ozyn'in sözü TEK yerden girer (`sozAlindi`) ve hedef seçimine göre ajanlara dağılır (uygulama/ajanlar/).
// Orion köprüsü kurulunca, Flash bedeni kurulunca kaydolur. Varsayılan hedef "orion": hedef çipleri seçilene dek davranış aynı.
const ajanlar = new AjanDefteri();
let sohbetHedefi: () => HedefSecimi = () => ORION_AJANI.id;
const ajanGirdisi = girdiAdaptoruKur({ ajanlar: () => ajanlar.hepsi(), hedef: () => sohbetHedefi() });
// Orion'un `emret` niyeti ve `dunya_emret` aracının hedef listesi: `uygulama/ajanlar/emir.ts` (saf, testli).
const emirHedefleri = (): string[] => emirHedefleriBul(ajanlar);
const ajanaEmret = (kime: string, soz: string): { ok: boolean; not: string } => emirTeslim(ajanlar, kime, soz);
// KOLTUKLAR (spec 33): odada iki beden varken aynı sandalye ikisine verilmez; her beden kaydolur, `otur` başkasının koltuğunda hata döner.
const koltuklar = new Koltuklar();
/** Orion Flash'ın dünyaya bağlantısı (spec 33; aşağıda, ajan defterinden sonra kurulur). Yoksa null. */
let flashBag: FlashBaglantisi | null = null;
// JSON ANİMASYON KLİPLERİ (spec 35 Dilim 5a): `assets/animasyon/` (liste.json + <ad>.json). Kap BOŞ kurulur ve bedenlere/grafiğe hemen verilir; yükleme
// bitince dolar (bedenler beklemesin). Bozuk klip nedeniyle günlükte; sağlamlar yine yüklenir.
const klipler = klipKutuphanesiKur();
// SEKANS (spec 36): bedenlerin klip bulucusu = kütüphane + oynayan sekansın derlenmiş GEÇİCİ klipleri (`sekans__…`). Sekans bedene ikinci bir kapıdan değil,
// bu katmandaki klibi isteyen mevcut `jest` niyetiyle oynar. Grafiğin "Animasyon oynat" seçenekleri kütüphaneden (geçici klipler orada görünmez).
const bedenKlipleri = geciciKlipKatmaniKur(klipler);
void klipleriYukle(async (yol) => {
  const y = await fetch(varlik(yol));
  if (!y.ok) throw new Error(`HTTP ${y.status}`);
  return y.text();
}).then((r) => {
  klipler.doldur(r.klipler, r.hatalar);
  console.log(`[KLIP] ${r.klipler.length} klip yüklendi: ${r.klipler.map((k) => k.ad).join(", ")}`);
  for (const h of r.hatalar) { console.warn(`[KLIP] ${h.dosya}: ${h.neden}`); gunluk.ekle("uyari", "klip", `${h.dosya}: ${h.neden}`); }
});
void avatarKur({
  sahne, saat,
  spawn: { x: 0.9, y: 0, z: -1.2 },
  vrmYolu: varlik(VARSAYILAN_VRM),
  // Ozyn'in kararı (2026-09-27): low-poly beden varsayılan, YÜZ SONRA gelecek.
  // Modelde ağız/göz blend shape'i yok; seçim kuralı (iskeletSecim.ts) onu
  // reddedip prosedürel robota düşerdi. Bilinen bedel: TTS ağız senkronu ve
  // göz kırpma görünmez, modelde `jest` klibi yok (düz jest görünmez; JSON klibi — `klip` alanı, Dilim 5a — kemiklere biner) — `?yuzdene`
  // bunu dürüstçe KALDI diye raporlar. Yüz eklenince bu satır kalkmalı.
  vrmZorla: true,
  klipler: bedenKlipleri,
  yer: () => yerler.orion,
  // bak {tip:"oyuncu"} için: avatar oyuncunun yerini buradan öğrenir.
  oyuncuKonumu: () => oyuncu.oyuncuDurumu().konum,
  koltukDolu: (c) => koltuklar.dolu(c, ORION_AJANI.ad),
}).then((a) => {
  yol.kaydet("orion", a);
  koltuklar.kaydet(ORION_AJANI.ad, () => a.koltugu());
  a.sonucDinle((s) => {
    console.log(`[NIYET] ${s.niyet_id} → ${s.durum}${s.not ? ` (${s.not})` : ""}`);
    if (s.durum === "hata") {
      altyaziGoster(`yapamadım: ${s.not ?? "bilinmeyen"}`);
      gunluk.ekle("uyari", "beden", `${s.niyet_id} başarısız: ${s.not ?? "sebep yok"}`);
    }
  });
  console.log("[ORION] avatar hazır");
  beyniBagla(a);
}).catch((e) => console.error("[ORION] avatar kurulamadı:", e));

// ── Orion'un gözü (kapı/yer geçişi: uygulama/yerGecisi.ts) ──
// Orion'un gözü (spec 25): `sor gor` (GÖRME, Faz 2) ve ölçüm yüzeyi `dunya.orionGozu` aynı kareyi çeker.
const orionGozu = orionGozuKur(sahne);
// Görme modeli: `?goz=<ollama modeli>` (varsayılan gemma4:e4b), `?ollama=` beyinle aynı adres. Yalnız istenince bakar.
// Göz muayenesi sürerken beyin yeni tur başlatmasın (iki yönlü sıra; aşağıda `gozlem` kurulunca bağlanır).
let gozlemSuruyor: () => boolean = () => false;
const gozModeli = (() => {
  const q = new URLSearchParams(location.search);
  return new GozModeli({ model: q.get("goz") || undefined, adres: q.get("ollama") || undefined });
})();

/** Orion'un ŞU ANKİ yerinden ve bakışından kare (beden yoksa null). Çekimde kendi bedeni gizlenir. */
async function orionKaresi(en = 896, boy = 504, yaw?: number) {
  const o = yol.al("orion");
  if (!o) return null;
  const d = o.durum();
  return orionGozu.kare(d.konum, yaw ?? Math.atan2(d.bakis.x, d.bakis.z), yerler.orion, en, boy, (g) => o.gorunur(g && yerler.orion === yerler.ozyn));
}

// Yer geçişi, kapı ve birleşik dünya (uygulama/yerGecisi.ts).
const gecis = yerGecisiKur({
  yerler, sahne, oda, rig, oyuncu, gunluk, altyaziGoster,
  // Önce zemin (nesnelerin oturacağı yükseklik belli olsun), sonra asset yerleştirme; ikisi de sonunda Orion'un Yer'ini yeniden ölçer.
  birlesikKuruldu: () => { void (async () => { await zemin.baslat(); await yerlestirme.baslat(); })(); },
  orion: () => yol.al("orion"),
  ekAktorler: () => { const a = flashBag?.aktor(); return a ? [a] : []; },
  ortamBaglantisi: () => ortamBaglantisi,
  ortamGunlugu: () => ortamGunlugu,
  stilPenceresi: () => yol.al("stilPenceresi"),
});

// ── MANTIK: 20Hz ───────────────────────────────────────────────────────────
let mantikTik = 0;
// T6: beyin konuşmuyorken Orion'un masasında heykel gibi durmaması için
// düşük maliyetli öneriler (bak/jest). Beyin/kullanıcı meşgulse asla araya
// girmez — bkz. mind/ajanda.ts başındaki KATI KURAL.

const ajanda = new Ajanda({
  asgariAralikMs: PANO_TELLERI.ajanda.asgari,
  azamiSapmaMs: PANO_TELLERI.ajanda.sapma,
});

// ── İNİSİYATİF: Orion'un kendi gündemi (mind/inisiyatif.ts) ──────────────
// `ajanda` heykel gibi durmasın diye rastgele bakar; bu ise DURUMA bakıp
// beyne kendiliğinden düşünme fırsatı verir. NE yapılacağına beyin karar
// verir. `?inisiyatifsn=N` yalnızca canlı deneme içindir: eşik ve refrakter
// N saniyeye iner, 10 dakika beklemek gerekmez.
const gucButcesi = new GucButcesi();
const inisiyatifSn = Number(new URLSearchParams(location.search).get("inisiyatifsn") ?? 0);
const inisiyatif = new Inisiyatif(inisiyatifSn > 0
  ? { sessizlikEsigiMs: inisiyatifSn * 1000, refrakterMs: inisiyatifSn * 1000 }
  : {});
/** Güç bütçesine düşülen son beyin turu sayısı — fark kadar `dusundu()`. */
let gucDusunmeSayaci = 0;

// ── MCP AJANI (spec 05 Aşama 1-2): uygulama/mcpBaglantisi.ts ──────────────
const mcpBeyin = mcpBaglantisiKur();

// ── SENARYO KİPİ: kendiliğinden davranışları sustur ───────────────────────
//
// Senaryolu BEDEN denemeleri (tahtaya yaz, odaya bak, yüz mesh'i) Orion'a
// elle niyet gönderir. Beyin ve ajanda aynı anda kendi niyetlerini üretirse
// senaryonun `git`i kesilir ve deneme sahte biçimde KALDI verir — canlıda
// tam olarak bu görüldü (`elle_… → iptal ('git' kesildi)`, tahta denemesi
// 3/3 yerine 1/3).
//
// ŞU AN GİZLİ: sağlayıcı kotası dolu olduğu için beyin zaten hiç niyet
// üretmiyor ve denemeler geçiyor. Kota dönünce sorun da döner; o yüzden
// gizlenmiş hâliyle bırakmıyorum.
//
// AYRIM ÖNEMLİ: beyni TEST EDEN kipler (tezdene, tahtabeyin, hafizadene,
// gorudene, sessizdene, davranis, otodene) bu listede YOKTUR — orada beynin
// susturulması testin kendisini anlamsız kılardı.
const BEDEN_SENARYOLARI = ["tahtadene", "gordene", "yuzdene", "admindene", "zihindene", "senaryodene", "gozdene"] as const;

/** Bu koşu senaryolu bir beden denemesi mi? */
function bedenSenaryosuMu(): boolean {
  const q = new URLSearchParams(location.search);
  return BEDEN_SENARYOLARI.some((k) => q.has(k));
}

const SENARYO_KIPI = bedenSenaryosuMu();
if (SENARYO_KIPI) console.log("[SENARYO] kendiliğinden davranışlar susturuldu (ajanda + beyin)");
const refleks = new KuralRefleksi();
// T6b "Orion görsün": kabuk işareti dinleyicisi + dünya olayları + terminal örnekleme. `refleks`ten SONRA kurulur.
const terminalAlgisi = terminalAlgisiKur({ monitor, refleks, oyuncu, orion: () => yol.al("orion"), kopru: () => yol.al("kopru") });

// Onay kapısı + paneli + Y/N/Esc bağı (uygulama/onayBaglantisi.ts).
const { onayKapisi, onayPaneliCiz, onayKarari } = onayBaglantisiKur({ monitor, sema, gunluk, altyaziGoster, kopru: () => yol.al("kopru") });

// Algı hizmetine dünya görüşü (uygulama/algiBaglantisi.ts).
const algiSor = algiSorKur({ yerler, oyuncu, orion: () => yol.al("orion") });

// Komut kipi (spec 26 F2): Orion'un terminal komutu onaysız çalışsın mı. `?komutkipi=otomatik|tam|onayli`; varsayılan otomatik.
const komutKipiSecimi = komutKipiCoz(new URLSearchParams(location.search).get("komutkipi"));
if (!komutKipiSecimi.gecerli) console.warn(`[ONAY] bilinmeyen komutkipi, varsayılan kullanılıyor: ${komutKipiSecimi.kip}`);
console.log(`[ONAY] komut kipi: ${komutKipiSecimi.kip}`);

// TEK niyet yönlendirme noktası: avatar, ses hattı, tahta, onay kapısı ve algı hizmeti
// uygulama/niyetYurutucu.ts'te ayrılır (spec 14 R4: buradan taşındı, testli). Bu dosya yalnız
// dünyayı verir; sonradan atananlar (beden, köprü) çağrı anında okunur.
/** Orion'un `ortam` niyeti (ova'nın ışığı/stili/zamanı): level ova kurulunca bağlanır, ofise dönünce bırakılır. */
const ortamBaglantisi = ortamBaglantisiKur();
/**
 * Ortam ayarlarının hatırlanması (uygulama/ortamDeposu.ts): `oturum` (bellek; uygulama kapanınca gider) ya da `kalici`
 * (tarayıcı deposu; bir sonraki açılışta ova ayarlarla gelir). `?ortam=kalici|oturum` o açılış için kipi ezer; G
 * penceresindeki "ayarları hatırla" kutusu kalıcı olarak seçer. ova.level.json'a HİÇBİR kipte yazılmaz.
 */
const ortamGunlugu = (() => {
  const q = new URLSearchParams(location.search).get("ortam");
  return new OrtamGunlugu(q === "kalici" || q === "oturum" ? { kip: q } : {});
})();
ortamBaglantisi.dinle((k) => ortamGunlugu.kaydet(k));
/**
 * ÖĞRENEN ortam sözlüğü (mind/ortamSozlugu.ts): LLM bir sözü bir kez doğru yaparsa sonraki sefer token'sız çalışır. Aynı
 * hatırlama kipini izler (oturum/kalıcı); "sıfırla" kullanımdan hemen sonra gelirse o kayıt olumsuz sayılır.
 */
const ogrenilenDepo = ogrenilenDeposu(() => ortamGunlugu.kip === "kalici");
ortamGunlugu.kipDinle(() => ogrenilenDepo.esitle());
const ortamSozlugu = new OrtamSozlugu({ depo: ogrenilenDepo });
ortamBaglantisi.dinle((k) => { if (k.ne === "sifirla") ortamSozlugu.sifirlandi(); });
/**
 * ORION DOKTOR (uygulama/doktor.ts): "doktor" sözü ya da `doktor` niyeti kendi bedenini/dünyasını muayene eder (WebGL hatası, görünmez
 * mesh, kare hızı; `tam`: her ışık efekti çalışma anında). Token'sız; ileride Orion hatayı kendisi tespit ederken aynı yolu çağırır.
 */
const doktor = doktorKur(doktorBaglamiBabylon(sahne, motor, ortamBaglantisi, () => yol.al("kopru")?.sayac() ?? {}));
const { niyetiYurut, bedenAdimi, sonGorme } = niyetYurutucusuKur({
  ortam: ortamBaglantisi,
  doktor,
  emret: ajanaEmret,
  // `sor gor` göz muayenesi yolundan (düz sorgu, iki yönlü sıra, panel): `gozlem` aşağıda kurulur, burada tembel sarmalayıcı.
  gozlem: { bak: () => gozlem.bak(), sonHata: () => gozlem.sonHata() },
  beden: () => yol.al("orion"),
  kopru: () => yol.al("kopru"),
  tahta, monitor, onayKapisi, sema, gunluk, algiSor,
  altyazi: (metin, ms) => altyaziGoster(metin, ms),
  onayPaneliCiz,
  olguHatirla: (anahtar, deger) => yol.al("kopru")?.olguHatirla(anahtar, deger) ?? null,
  komutKipi: () => komutKipiSecimi.kip,
  otomatikOnay: () => onayKarari(true, true),
  gordumBildir: () => { gordumGeldi = true; },
  orionCapalari: () => yerler.orion.capalar,
  goz: {
    kare: async () => (await orionKaresi())?.png ?? null,
    gor: (png, algi) => gozModeli.gor(png, algi),
  },
});

/** Davranis olcumu acikken kayit defterine erisim (yoksa null). */
function davranisKayit(): ReturnType<DavranisDefteri["kayit"]> | null {
  return window._davranisKayit ?? null;
}

saat.dinle((t, dt) => {
  mantikTik++;
  const orion = yol.al("orion");   // tik içinde değişmez: kurulum senkron
  const kopru = yol.al("kopru");
  oyuncu.guncelle(t, dt);
  rig.guncelle(dt);

  const msSimdi = t * 1000;

  // Onay zaman asimi: suresi dolan oneri DUSER (asla onaylanmaz).
  const dusen = onayKapisi.tikle();
  if (dusen) {
    console.log(`[ONAY] zaman asimi, oneri dustu: ${dusen.komut}`);
    onayPaneliCiz();
    kopru?.sonuc({ niyet_id: dusen.id, durum: "hata", kod: "onay_dustu",
      not: "oneri zaman asimina ugradi; Ozyn karar vermedi" });
  }

  // Dünya olayları + masadaki terminal → algı (uygulama/terminalAlgisi.ts).
  terminalAlgisi.tikle(mantikTik, msSimdi);

  if (orion) {
    const d = oyuncu.oyuncuDurumu();
    const a = orion.durum();
    // MEŞGUL — TEK KAYNAK (spec 12 B5): Orion'un kendi durumu anlık benlikten
    // (`mesgulMu`: düşünüyor ∨ yürüyor/koşuyor); "Ozyn monitörde" Ozyn'in durumu, ayrı
    // eklenir. Eski ifadeyle her kombinasyonda eşdeğer (mind/benlik.test.ts).
    const mesgul =
      d.etkilesim === "monitor" ||
      (kopru ? mesgulMu(kopru.benlik.oku()).mesgul : (a.poz === "yürüyor" || a.poz === "koşuyor"));
    // GÜÇ: gövdenin GERÇEK hızıyla (Faz 2'den beri komut edilen değil) ve
    // tamamlanan beyin turlarıyla harcanır, dinlenince dolar.
    gucButcesi.tikle(dt, a.hiz ?? 0);
    const dusunme = kopru?.sayac().dusunme ?? 0;
    for (; gucDusunmeSayaci < dusunme; gucDusunmeSayaci++) gucButcesi.dusundu();

    // İNİSİYATİF önce, ajanda sonra: durum söze girmeyi gerektiriyorsa rastgele
    // bir bakış onu gölgelemesin. İkisi de senaryo kipinde susar.
    // Girdi penceresi doldu ama yeni girdi gelmediyse kapanışı tik yazar (Ozyn gittikten sonraki son dakika).
    varlikSinyali.tikle(Date.now());
    if (!SENARYO_KIPI && kopru) {
      const sessizlikMs = Date.now() - (varlikSinyali.sonKonusma() || varlikSinyali.acilis);
      inisiyatifSimdi = t * 1000;
      // YENİ YOL YOK: kapı sıradan bir olay algısı üretir; dikkat süzgecinden ve tek karar→eylem yolundan
      // (`niyetiYurut`) geçer. Sıra ve olay metni: uygulama/inisiyatifBaglantisi.ts, mind/inisiyatif.ts.
      const k = inisiyatifTik(inisiyatif, kopru, {
        simdiMs: inisiyatifSimdi,
        mesgul,
        ozynMonitorde: d.etkilesim === "monitor",
        ozynOdada: (d.mesafe ?? Infinity) < 8,
        sessizlikMs,
        guc: gucButcesi.seviye,
        ...(INISIYATIF_ESKI ? {} : { girdiYasiMs: Date.now() - varlikSinyali.sonGirdi(), sessizlikIzinli: sessizlikIzinliMi(kopruBeyinAdi()) }),
      }, INISIYATIF_ESKI);
      if (k) {
        console.log(`[INISIYATIF] soze_gir · neden=${k.neden} · sessizlik=${k.dakika} dk · fayda=${k.fayda.toFixed(2)} · guc=${gucButcesi.seviye.toFixed(2)}`);
        gunluk.ekle("bilgi", "inisiyatif", k.neden === "acik_is"
          ? `kendiliğinden: karar bekleyen öneriyi hatırlatma (${k.dakika} dk)`
          : `kendiliğinden düşünme fırsatı (${k.dakika} dk sessizlik)`);
      }
    }

    // Senaryo kipinde ajanda susar: senaryonun niyetini kesmesin.
    const oneri = SENARYO_KIPI ? null : ajanda.tikle(t * 1000, mesgul);
    if (oneri) orion.niyet(oneri, kimlik("ajanda"));
  }
});

// ── ÇİZİM: serbest FPS ─────────────────────────────────────────────────────
motor.runRenderLoop(() => {
  const ms = motor.getDeltaTime();
  saat.ilerle(ms);
  rig.cizimGuncelle(Math.min(ms, 100) / 1000);
  // Ağız senkronu: sesin gerçek RMS'i avatara burada bağlanır. voice/ ile
  // avatar/ birbirini tanımaz; bağ tek yönlü ve tek satır.
  // Avatarın görsel yumuşatması render karesinde. Bu çağrı EKSİKTİ: mantık
  // 20Hz'de koşuyordu ama mesh hiç güncellenmiyordu — Orion hareket ediyor
  // ama görünmüyordu.
  const orion = yol.al("orion");
  if (orion) {
    orion.cizimGuncelle(Math.min(ms, 100) / 1000);
    if (orionSesi.konusuyorMu()) orion.agizAyarla(orionSesi.agizAcikligi());
  }
  sahne.render();
});

addEventListener("resize", () => motor.resize());
// Tuval, açık editörün/Yapı çubuğunun yüksekliği kadar küçülür (index.html `--editor-alt`, `--alt-cubuk`): sahne dokun ÜSTÜNDE tam görünür. Boyut değişince motor da değişsin.
new ResizeObserver(() => motor.resize()).observe(tuval);

// Dünya yayıcısı (world/player/etkilesim.ts) → yol: world/ yolu görmez, çeviri kökte. Abone olan uygulama modülleri yalnız yolu bilir.
EtkilesimOlaylari.dinle("basladi", (o) => yol.yayinla("etkilesim.basladi", o));
EtkilesimOlaylari.dinle("bitti", (o) => yol.yayinla("etkilesim.bitti", o));
EtkilesimOlaylari.dinle("ipucu", (i) => yol.yayinla("etkilesim.ipucu", i));

// ── Etkileşim → altyazı/HUD ────────────────────────────────────────────────
// T3 (monitör) ve T4 (köprü) aynı yayıcıya abone olacak. Burada yalnızca
// kullanıcıya geri bildirim var; protokol mesajı ÜRETİLMEZ.

yol.dinle("etkilesim.basladi", (o) => {
  // Kapı (spec 24): "geç" anlık bir eylem — etkileşim açık kalmaz, geçiş başlar.
  if (o.eylem === "gec") {
    EtkilesimOlaylari.bitir();
    void gecis.kapidanGec();
    return;
  }
  altyaziGoster(`${o.capa} · ${o.eylem} — çıkmak için Esc`);
  console.log(`[etkilesim] basladi capa=${o.capa} eylem=${o.eylem} t=${o.t.toFixed(2)}`);
  // Etkileşim tuşuyla (`F`) YÜZEYE GEÇ. Tek tablo (`YUZEY_GECISI`) hem tuşu hem odaktaki
  // tıklamayı besliyor: iki giriş yolu aynı davranışı vermeli, yoksa "F ile
  // açılıyor ama tıklayınca açılmıyor" gibi keyfi bir fark doğar.
  //
  // Eskiden yalnızca monitor ve admin bağlıydı: zihin duvarındaki panellere
  // etkileşim tuşuna basmak etkileşim başlatıyor ama EKRANDA HİÇBİR ŞEY OLMUYORDU.
  void odak.yuzeyGecisi[o.capa]?.();
});
yol.dinle("etkilesim.bitti", (o) => {
  if (o.eylem === "gec") return;
  altyaziGoster("etkileşim kapandı");
  console.log(`[etkilesim] bitti capa=${o.capa}`);
  // Terminaller klavye odağını da bırakmalı; paneller için kamera yeter.
  if (o.capa === "monitor") odak.monitordenCik();
  else if (o.capa === "admin") odak.admindenCik();
  else if (o.capa in odak.yuzeyGecisi) rig.odakBirak();
});

/** `bakdene` icin: algi cevabi beyne ulasti mi (senaryo yedegi buna bakar). */
let gordumGeldi = false;
/** Senaryoların panoyu sorgulayabilmesi için (yol servisi `pano`). Üretimde yalnızca okunur. */
function panoyuAl(): Pano | null { return yol.al("pano"); }

const zoomKutu = document.getElementById("zoom") as HTMLElement;
const zoomOran = document.getElementById("zoomOran") as HTMLElement;

// 3. MONİTÖR (groma haritası): ana süreçteki ekran dışı pencere sayfayı yükler, kareler masadaki küçük monitörde görünür (uygulama/webMonitoru.ts).
// `?gromasiz` kapatır. Groma sunucusu kapalıysa ekran bunu yazar ve açılınca kendiliğinden bağlanır.
const webMonitoru = webMonitoruKur({
  sahne, ekranMesh: oda.gromaEkran,
  kopru: () => { const k = kabukKoprusu(); return k?.webmonKomut && k.webmonDinle ? (k as WebKopru) : null; },
});
if (!new URLSearchParams(location.search).has("gromasiz")) void webMonitoru.baslat();

// Odak/zoom kipi: monitöre ve panellere geçiş, zoom, odakta tıklama (uygulama/odak.ts).
const odak = odakKur({
  motor, sahne, rig, oda, monitor, adminTerminal, sema, gunluk, tuval, altyaziGoster, webMonitoru,
  ozynCapalari: () => yerler.ozyn.capalar,
});

// ── NESNE SEÇİMİ + ETKİLEŞİM MENÜSÜ (spec 28): Tab imleç kipi, sol tık seç, sağ tık menü ──
// Seçili nesne yoldan duyurulur (`nesne.secildi`): vurgu ve HUD abone. Menüdeki eylemler Orion'a TEK eylem yolundan (`niyetiYurut`) gider.
const secim = secimDurumuKur({ nesneler: () => yerler.ozyn.nesneler, degisti: (n) => yol.yayinla("nesne.secildi", n) });
const secimVurgusu = secimVurgusuKur(sahne);
yol.dinle("nesne.secildi", (n) => secimVurgusu.goster(n?.kutu ?? null));
const nesneEtkilesimi = nesneEtkilesimiKur({ niyetiYurut, oyuncuEtkilesim: (c, e) => oyuncu.etkilesimBaslat(c, e), altyazi: altyaziGoster });
/** Seçili nesne ve ORION'un onunla yapabildikleri: söz sözlüğü ("buraya otur") ve beynin bağlamı AYNI menü verisinden beslenir. */
function seciliOrionEylemleri() {
  const n = secim.oku();
  if (!n) return null;
  const k = oyuncu.oyuncuDurumu().konum;
  return { n, eylemler: nesneEylemleri(n, { capalar: yerler.ozyn.capalar, oyuncu: { x: k.x, z: k.z } }).filter((e) => e.kim === "orion") };
}
const seciliSoz = (): SeciliNesne | null => {
  const b = seciliOrionEylemleri();
  return b ? seciliSozOlustur(b.n.ad, b.eylemler) : null;
};
const seciliBeyne = () => { const b = seciliOrionEylemleri(); return b ? seciliDurumu(b.n, b.eylemler) : null; };
// Bilgi paneli ("Özellikler…"): eylemler artık bağlam menüsünde (spec 29), panel yalnız özellik gösterir.
const nesnePaneli = nesnePaneliKur({
  calistir: () => {},
  secimiKaldir: () => { secim.sec(null); altyaziGoster("seçim kaldırıldı", 1500); },
});
// BAĞLAM MENÜSÜ (spec 29): Windows/Unreal gibi kademeli sağ tık menüsü; katkılar `uygulama/menuKatkilari.ts`, çekirdek `world/arayuz/menu/`.
// Yaprak yükü tek eylem yolundan çalışır: hedef eylemi → `nesneEtkilesimi.calistir` (niyetiYurut), "Özellikler…" → bilgi paneli.
let sonOzellikler: (() => void) | null = null;
/** Menüden ajan bedenine verilen eylemlerin kimlik sayacı (`menu_<ajan>_<n>_<eylem>`: niyet kimlikleri benzersiz kalsın). */
let ajanMenuSayaci = 0;
const baglamMenusu = baglamMenusuKur<MenuEylemi>({
  calistir: (y) => {
    switch (y.tur) {
      case "eylem": nesneEtkilesimi.calistir(y.eylem); break;
      case "soz": yol.al("kopru")?.algi({ tur: "duydum", metin: y.metin, kesin: true, kaynak: "klavye" }); altyaziGoster(`sen: ${y.metin}`, 1800); break;
      // Menüden bir ajanın BEDENİNE eylem (Flash ▸ Buraya git / Otur…): niyet o ajanın kendi beden kapısından geçer. Gri eylem çalışmaz, nedeni söylenir.
      case "ajanEylem": {
        const ajan = ajanlar.al(y.ajan);
        const e = y.eylem;
        if (!ajan?.niyet) { altyaziGoster(`${y.ajan} hazır değil`, 2000); break; }
        if (!e.uygun || !e.niyet) { altyaziGoster(`${e.ad}: ${e.neden ?? "şu an yapılamaz"}`, 3000); break; }
        ajan.niyet(e.niyet, `menu_${ajan.id}_${++ajanMenuSayaci}_${e.kimlik}`);
        altyaziGoster(`${ajan.ad}'a: ${e.ad}`, 1800);
        break;
      }
      // Menüden belirli bir ajana söz (Flash): sohbet hedef çiplerini atlar. Altyazı ÖNCE (ajanın eşzamanlı cevabını ezmesin, sozAlindi gibi).
      case "ajanSoz": {
        const ajan = ajanlar.al(y.ajan);
        if (!ajan) { altyaziGoster(`${y.ajan} hazır değil`, 2000); break; }
        altyaziGoster(`sen → ${ajan.ad}: ${y.metin}`, 2000);
        ajan.algi({ tur: "duydum", metin: y.metin, kesin: true, kaynak: "klavye" });
        break;
      }
      case "ozellikler": sonOzellikler?.(); break;
      case "secimiKaldir": secim.sec(null); altyaziGoster("seçim kaldırıldı", 1500); break;
      // Asset yerleştirme (spec 30): zemin komutları son açılan zemin menüsünün noktasına uygulanır.
      case "yerlestir": if (sonZemin) void yerlestirme.yerlestir(y.varlik, [sonZemin.x, sonZemin.y, sonZemin.z]); break;
      case "cagir": cagirHayalet(y.varlik, y.varlik); break;
      case "yapistir": if (sonZemin) void yerlestirme.yapistir(sonZemin); break;
      case "kopyala": yerlestirme.kopyala(y.id); break;
      case "duzenle": duzenleme.duzenle(y.arac); break;
      case "duzenleBitir": duzenleme.bitir(); altyaziGoster("düzenleme bitti", 1200); break;
      case "kaldir": duzenleme.bitir(); void yerlestirme.kaldir(y.id); break;
      // Hafıza sekmesindeki md dosyaları (spec 32).
      case "mdAc": mdAc(y.ad); break;
      case "mdAktif": mdAktifCevir(y.ad, y.aktif); break;
      case "mdKopyala": void mdDeposu.oku(y.ad).then((m) => navigator.clipboard.writeText(m)).then(() => altyaziGoster(`${y.ad} kopyalandı`, 1500), (e: unknown) => altyaziGoster(`kopyalanamadı: ${e instanceof Error ? e.message : String(e)}`, 4000)); break;
      case "mdAdKopyala": void navigator.clipboard.writeText(y.ad).then(() => altyaziGoster(`ad kopyalandı: ${y.ad}`, 1500), (e: unknown) => altyaziGoster(`kopyalanamadı: ${e instanceof Error ? e.message : String(e)}`, 4000)); break;
      default: { const hic: never = y; throw new Error(`menü: işlenmeyen eylem ${JSON.stringify(hic)}`); }
    }
  },
});
// ASSET YERLEŞTİRME (spec 30): menü komutları level'ın kamu API'siyle uygulanır; Orion'un `Yer`i her değişiklikte yeniden ölçülür.
let sonZemin: { x: number; y: number; z: number } | null = null;
const yerlestirme = yerlestirmeKur({
  level: () => gecis.birlesik()?.level ?? null,
  yeniYer: async (l) => birlesikYerKur(await levelYeriniOlc(l, "ova")),
  yerGuncelle: (yer) => gecis.birlesikYeriniYenile(yer),
  altyazi: altyaziGoster,
});
// OYUN İÇİ DÜZENLEME (spec 30): Çağır hayaleti + seçili nesnede taşı/döndür/ölçekle gizmosu (editörün sahne parçaları; sonuç `yerlestirme` kaydına yazılır).
const duzenleme = duzenlemeKipiKur({
  sahne, kamera: rig.kamera, tuval, level: () => gecis.birlesik()?.level ?? null, secili: () => secim.oku()?.id ?? null,
  koy: (varlik, konum, donus) => { void yerlestirme.yerlestir(varlik, konum, donus); },
  donustur: (degisim, mesaj) => { void yerlestirme.donustur(degisim, mesaj); },
  altyazi: altyaziGoster,
});
// ZEMİN ŞEKİLLENDİRME (Yapı çubuğu · Zemin sekmesi): editörün arazi kalemi; vuruşlar kayda, geri al yığınına ve Orion'un Yer'ine işlenir. Nesneler araziye oturunca
// yeni konumları yerleştirme kaydına yazılır (yeniden açılışta eski yüksekliğe dönmesinler).
const zemin = zeminBaglantisiKur({
  level: () => gecis.birlesik()?.level ?? null,
  yeniYer: async (l) => birlesikYerKur(await levelYeriniOlc(l, "ova")),
  yerGuncelle: (yer) => gecis.birlesikYeriniYenile(yer),
  nesneleriTasi: (degisim, mesaj) => yerlestirme.donustur(degisim, mesaj),
  altyazi: altyaziGoster,
});
const zeminKalemi = zeminKalemiKur({
  sahne, kamera: rig.kamera, tuval, level: () => gecis.birlesik()?.level ?? null,
  baslarken: () => duzenleme.bitir(),
  vurusBitti: (v) => { void zemin.vurusBitti(v); },
  geriAl: () => { void zemin.geriAl(); }, ileriAl: () => { void zemin.ileriAl(); },
  altyazi: altyaziGoster,
});
/** Asset hayaleti (kart ya da menü): zemin kalemi açıksa önce o bırakılır — ikisi aynı tıklamayı isteyemez. */
function cagirHayalet(varlikAdi: string, ad: string): void { zeminKalemi.sec(null); void duzenleme.cagir(varlikAdi, ad); }
// YAPI ÇUBUĞU (Y): ekranın altında açılır-kapanır, sekmeli panel. Sekmeler bağımsız modüller (`uygulama/yapi/`); yeni özellik = yeni sekme (`altCubuk.ekle`).
// Çubuk imleç kipinde görünür; Y (ya da sekmeye tık) paneli açar ve imleç kipini de açar (açılamıyorsa — odak, sohbet, onay — açılmaz).
const altCubuk = altCubukKur({
  tusSerbest: () => oyuncu.oyuncuDurumu().etkilesim === null && !sohbet.acikMi() && onayKapisi.durum !== "bekliyor",
  izin: () => imlec.acik || imlec.ac(),
});
altCubuk.ekle(assetSekmesi({
  kartlar: () => yerlestirme.kartlar(),
  cagir: cagirHayalet,
  cagrilan: () => duzenleme.cagrilan(),
  birak: () => duzenleme.bitir(),
  hayaletDegisince: (f) => duzenleme.dinle(f),
  onizlemeAdresi: varlik,
}));
altCubuk.ekle(zeminSekmesi({ kalem: zeminKalemi, baglanti: zemin }));
// Zihin sekmesi AJAN ÇİPLERİYLE (spec 33): Orion'un sayfası duvardaki şema, Flash'ınki mesh'siz şema (duvarı yok; Flash kurulunca beslenir).
const flashZihni = semaTuvaliKur({ tanim: FLASH_SEMASI, olcu: sema.olcu() });
altCubuk.ekle(zihinSekmesi({
  sema,
  sayfalar: () => [{ ...ORION_AJANI, sema }, ...(ajanlar.al(FLASH.id) ? [{ id: FLASH.id, ad: FLASH.ad, renk: FLASH.renk, sema: flashZihni }] : [])],
  sayfaDegisti: (cb) => ajanlar.dinle(cb),
}));

// ORION'UN MD DOSYALARI (Yapı çubuğu · Hafıza sekmesi, spec 32): persona, anlık hafıza, notlar. Aktif olanlar her turda talimatın SONUNA girer (sınırlı: `mind/mdBaglami.ts`);
// anlık hafıza dosyasının otomatik bölümü durum defterinden sürekli güncellenir. Düzenleyici pencereleri `world/arayuz/editorPenceresi.ts`.
const mdKaynagi = mdKaynaginiSec();
let mdHata: string | null = mdKaynagi.hata;
// BAĞLAMI ŞİŞİRMEME AYARLARI (Ozyn, 2026-10-21): otomatik sıkıştırma eşiği/aralığı ve md notları bütçesi. Teller devre panosunda (duvar/Zihin sekmesi → HAFIZA);
// önce kayıttan geri yüklenir, SONRA kalıcı yapılır (yoksa ilk yazma kaydı varsayılanla ezerdi). Bozuk/aralık dışı kayıt atlanır ve konsola söylenir.
{
  const depo = (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })();
  const r = hafizaAyariniYukle(depo, PANO_TELLERI.hafiza);
  for (const a of r.atlanan) console.warn(`[AYAR] hafıza ayarı atlandı (${a.ayar}): ${a.neden}`);
  if (r.uygulanan.length) console.log(`[AYAR] hafıza ayarı kayıttan yüklendi: ${r.uygulanan.join(", ")}`);
  hafizaAyariniKaliciYap(depo, PANO_TELLERI.hafiza);
}
const mdDeposu = mdDeposuKur(mdKaynagi.kaynak, () => ({ ...MD_SINIRLARI, dosyaBasina: PANO_TELLERI.hafiza.mdDosya(), toplam: PANO_TELLERI.hafiza.mdToplam() }));
const editorPenceresi = editorPenceresiKur({
  kaynak: { oku: (ad) => mdDeposu.oku(ad), yaz: (ad, metin) => mdDeposu.yaz(ad, metin) },
  bilgi: (ad) => { const d = mdDeposu.liste().find((x) => x.ad === ad); return d ? (d.aktif ? "● bağlamda: Orion her turda okuyor" : "○ bağlamda değil") : null; },
  not: (ad) => (ad === ANLIK_HAFIZA ? "İşaretli otomatik bölümü sistem günceller (konum, son iş, son konuşma); dışına yazdığın kalır ve bu dosya aktifken Orion'un bağlamına TAM girer." : null),
  altyazi: altyaziGoster,
});
mdDeposu.dinle((o) => { if (o.tur === "icerik") void editorPenceresi.icerikDegisti(o.ad); editorPenceresi.tazele(); });
function mdAc(ad: string): void { editorPenceresi.ac(ad).catch((e: unknown) => altyaziGoster(`${ad} açılamadı: ${e instanceof Error ? e.message : String(e)}`, 4000)); }
function mdAktifCevir(ad: string, aktif: boolean): void {
  mdDeposu.aktifYap(ad, aktif).then(() => altyaziGoster(aktif ? `${ad}: Orion artık okuyor` : `${ad}: bağlamdan çıkarıldı`, 1800), (e: unknown) => altyaziGoster(`${ad}: ${e instanceof Error ? e.message : String(e)}`, 4000));
}
altCubuk.ekle(hafizaSekmesi({
  depo: mdDeposu, ac: mdAc, hata: () => mdHata, bildir: altyaziGoster,
  menuAc: (ad, x, y) => {
    const d = mdDeposu.liste().find((k) => k.ad === ad);
    if (d) baglamMenusu.ac(menuKur<HedefMenuBaglami, MenuEylemi>({ hedef: { tur: "dosya", dosya: { ad: d.ad, aktif: d.aktif, sistem: d.sistem } } }, MENU_KATKILARI, MENU_AYARI), x, y);
  },
}));
mdDeposu.baslat().then(() => console.log(`[MD] ${mdDeposu.liste().length} dosya, ${mdDeposu.liste().filter((d) => d.aktif).length} aktif`), (e: unknown) => { mdHata = e instanceof Error ? e.message : String(e); console.error("[MD] yüklenemedi:", mdHata); altyaziGoster(`md dosyaları yüklenemedi: ${mdHata}`, 5000); });
// Anlık hafıza: durum defteri (konum, son iş, son konuşma) → dosyanın otomatik bölümü. Blok yalnız durum DEĞİŞİNCE değişir (mutlak saat), yazma yalnız o zaman olur.
setInterval(() => {
  const k = yol.al("kopru");
  if (!k) return;
  mdDeposu.anlikGuncelle(otomatikBlok(k.durum.kayitlar())).catch((e: unknown) => console.warn("[MD] anlık hafıza güncellenemedi:", e instanceof Error ? e.message : e));
}, 4000);

// DÜNYA EDİTÖRÜ (spec 35 dilim 1): düğüm grafikleri (Orion'u ve Flash'ı süren programlar) ve desenler. Yapı çubuğu · Graf sekmesi; düzenleme JSON (aynı
// metin düzenleyici penceresi, ikinci örnek); çalıştırma YALNIZ Ozyn'in ▶ tıklamasıyla (sekme `isTrusted` bakar). Grafik dünyaya yalnız `GrafYetenegi`nden
// dokunur: ajan listesi (defter), ajanın kapısı, Ozyn'in yerindeki nesneler. Terminal, hafıza, onay ayarları, protokol, level dosyası grafikte YOK.
/**
 * Ajanın grafiğe kapısı. Orion: niyet TEK eylem yolundan (`niyetiYurut`: yakınlık kuralı, şema, beden), sonuç bedeninden, söz Orion'un söz hattından
 * (köprünün cevabıyla aynı: altyazı + Piper; ses yoksa okuma süresi beklenir). Orion'un defter kaydına `niyet` EKLENMEDİ: menüdeki "Flash ▸ …" girişleri
 * `niyet`i olan ajanlardan çıkar ve Orion'un kendi menüsü zaten var (çift giriş olurdu). Öteki ajanlar (Flash) kaydındaki beden kapısıyla.
 */
function grafKapisi(id: string): AjanKapisi | null {
  if (id === ORION_AJANI.id) {
    const o = yol.al("orion");
    if (!o) return null;
    return {
      id, ad: ORION_AJANI.ad,
      niyet: (n, nid) => niyetiYurut(n, nid),
      sonucDinle: (cb) => o.sonucDinle(cb),
      soyle: async (m) => {
        // `orionSesi` aşağıda kurulur: söz hattı çağrı ANINDA kurulur (kurulum sırasında değil).
        const caldi = await orionKonusmasi({ altyaziGoster, altyaziEkle: altyaziGoster.ekle, gunluk, davranisKayit, orionSesi })(m);
        if (!caldi) await new Promise<void>((r) => setTimeout(r, okumaSuresiMs(m)));
      },
      sus: () => orionSesi.kes(),
      govde: () => govdeDurumundan(o.durum()),
    };
  }
  const a = ajanlar.al(id);
  if (!a?.niyet || !a.sonucDinle) return null;
  const { niyet, sonucDinle, soyle, govde } = a;
  return { id: a.id, ad: a.ad, niyet, sonucDinle, soyle: soyle ?? (async () => { throw new Error(`${a.ad}: söz hattı yok`); }), ...(govde ? { govde } : {}) };
}
const grafKaynagi = grafKaynaginiSec();
let grafHata: string | null = grafKaynagi.hata;
const grafDeposu = grafDeposuKur(grafKaynagi.kaynak);
// DİLİM 2 (NPC davranışı): grafiklerin bellekteki değişkenleri, ajanların gözünden olay yolu (Flash hazır olunca açılır), seçimli diyalog ekranı.
// Üçü de YALNIZ BELLEKTE: uygulama kapanınca durum ve dinleme gider (Ozyn bir sonraki açılışta yeniden kurar).
const grafDurumu = new GrafDurumDeposu();
const grafOlaylari = olayYoluKur();
const diyalogDenetimi = diyalogDenetimiKur();
diyalogKutusuKur({
  denetim: diyalogDenetimi,
  // 1–4 diyaloğun tuşu yalnız oyun tuşları serbestken: sohbet yazarken, terminaldeyken ya da onay beklerken o tuş harftir/onayındır (dunyaKancasi deseni).
  tusSerbest: () => oyuncu.oyuncuDurumu().etkilesim !== "monitor" && !sohbet.acikMi() && onayKapisi.durum !== "bekliyor",
});
const grafTabani = {
  kayit: grafKutuphanesi({ klipler: () => klipler.ozetler() }), depo: grafDeposu,
  yetenek: grafYetenegiKur({
    ajanlar: () => ajanlar.hepsi().map((x) => ({ id: x.id, ad: x.ad })), kapi: grafKapisi,
    nesneler: () => yerler.ozyn.nesneler, capalar: () => yerler.ozyn.capalar,
    diyalog: (i) => diyalogDenetimi.ac({ ...i, renk: ajanlar.al(i.ajan.id)?.renk ?? ORION_AJANI.renk }),
    // Ozyn'in AYAK konumu (oyuncu durumunun konumu göz hizası): "Git → konum" Ozyn'in bulunduğu noktaya gitsin, havaya değil.
    ozyn: () => { const d = oyuncu.oyuncuDurumu(); return { konum: { x: d.konum.x, y: d.konum.y - oyuncu.gozYuksekligi, z: d.konum.z }, etkilesim: d.etkilesim }; },
  }),
  ajanlar: () => ajanlar.hepsi().map((x) => x.id),
  durum: grafDurumu,
  gunluk: (seviye: "bilgi" | "iyi" | "uyari" | "hata", metin: string) => { gunluk.ekle(seviye, "graf", metin); console.log(`[GRAF] ${metin}`); },
};
// Aynı grafik aynı anda tek çalışma: ▶ ve olay çalışması birbirini görür (biri sürerken öteki başlamaz/atlanır).
const grafCalistirici: GrafCalistirici = grafCalistiriciKur({ ...grafTabani, mesgul: (ad) => (grafDinleyici.calisiyorMu(ad) ? "şu an olayla (⚡) çalışıyor" : null) });
const grafDinleyici: GrafDinleyici = grafDinleyiciKur({ ...grafTabani, kaynak: grafOlaylari, disMesgul: (ad) => grafCalistirici.durum().calisiyor?.graf === ad });
const grafPenceresi = editorPenceresiKur({
  kaynak: { oku: (ad) => grafDeposu.oku(ad), yaz: (ad, metin) => grafDeposu.yaz(ad, metin) },
  bilgi: (ad) => { const k = grafDeposu.liste().find((x) => x.ad === ad); return !k ? null : k.hata ? `✗ ${k.hata}` : k.tur === "olay" ? "grafik · ▶ Graf sekmesinden" : "desen · 'Desen' düğümüyle çağrılır"; },
  not: () => "Düğüm grafiği (JSON). Ctrl+S biçimi doğrular (bozuksa kaydetmez); tür denetimi ve ▶ Graf sekmesinde.",
  degistiNotu: "kaydedildi (biçim doğrulandı, okunur biçime çevrildi)",
  altyazi: altyaziGoster,
});
grafDeposu.dinle((o) => { if (o.tur === "icerik") void grafPenceresi.icerikDegisti(o.ad); grafPenceresi.tazele(); });
function grafAc(ad: string): void { grafPenceresi.ac(ad).catch((e: unknown) => altyaziGoster(`${ad} açılamadı: ${e instanceof Error ? e.message : String(e)}`, 4000)); }
// GÖRSEL EDİTÖR (spec 35 dilim 2b): tam ekran tuval (Graf sekmesinde çift tık / Aç); JSON penceresi "Metin" olarak korunur. Açılınca fare serbest (imleç
// kipi) ve Orion'un ayar paneli gizlenir; yerleştirme hayaleti ve zemin kalemi biter (tuş yakalayıcıları editörden önce kuruldu: Esc/Ctrl+Z'yi onlar alırdı).
const grafEditoru = grafEditoruKur({
  depo: grafDeposu, calistirici: grafCalistirici, dinleyici: grafDinleyici, kayit: grafTabani.kayit, ajanlar: grafTabani.ajanlar,
  metinAc: grafAc, altyazi: altyaziGoster, izin: () => imlec.acik || imlec.ac(),
  gorunurlukDegisti: (acik) => { orionAyarPaneli.gorunur(!acik && imlec.acik); if (acik) { sekansSistemi.editor.gizle(); nesnePaneli.kapat(); baglamMenusu.kapat(); duzenleme.bitir(); zeminKalemi.sec(null); } },
});
// NPC SINIFI (spec 35 dilim 3): NPC kayıtları (ajan + grafikler + parametreler; `<userData>/orion-npc/`), JSON penceresi (üçüncü örnek), Graf sekmesinin
// "NPC'ler" şeridi. Dinlemeye alma aynı `grafDinleyici.dinlemeyeAl` (yalnız gerçek tık); ajan kapsamlı değişkenler `grafDurumu`nda (bellekte).
const npcKaynagi = npcKaynaginiSec();
let npcHata: string | null = npcKaynagi.hata;
const npcDeposu = npcDeposuKur(npcKaynagi.kaynak);
const npcPenceresi = editorPenceresiKur({
  kaynak: { oku: (ad) => npcDeposu.oku(ad), yaz: (ad, metin) => npcDeposu.yaz(ad, metin) },
  bilgi: (ad) => { const k = npcDeposu.liste().find((x) => x.ad === ad); return !k ? null : k.hata ? `✗ ${k.hata}` : `NPC · ${k.ajan} · ${k.graflar.join(", ")}`; },
  not: () => "NPC kaydı (JSON): ajan, graflar, parametreler (örn. \"parola\"). Ctrl+S biçimi doğrular; dinlemedeki NPC'yi değiştirmez (bırak + yeniden kur).",
  degistiNotu: "kaydedildi (biçim doğrulandı, okunur biçime çevrildi)",
  altyazi: altyaziGoster,
});
npcDeposu.dinle((o) => { if (o.tur === "icerik") void npcPenceresi.icerikDegisti(o.ad); npcPenceresi.tazele(); });
altCubuk.ekle(grafSekmesi({
  depo: grafDeposu, calistirici: grafCalistirici, dinleyici: grafDinleyici, durum: grafDurumu, ac: (ad) => grafEditoru.ac(ad), metinAc: grafAc, adIslemi: grafEditoru,
  hata: () => grafHata, bildir: altyaziGoster,
  npc: {
    depo: npcDeposu, dinleyici: grafDinleyici, durum: grafDurumu, hata: () => npcHata, bildir: altyaziGoster,
    graflar: () => grafDeposu.liste().filter((k) => k.tur === "olay" && !k.hata).map((k) => k.ad),
    ajanlar: () => ajanlar.hepsi().map((x) => ({ id: x.id, ad: x.ad })),
    metinAc: (ad) => { npcPenceresi.ac(ad).catch((e: unknown) => altyaziGoster(`${ad} açılamadı: ${e instanceof Error ? e.message : String(e)}`, 4000)); },
  },
}));
grafDeposu.baslat().then(() => console.log(`[GRAF] ${grafDeposu.liste().length} grafik/desen`), (e: unknown) => { grafHata = e instanceof Error ? e.message : String(e); console.error("[GRAF] yüklenemedi:", grafHata); });
npcDeposu.baslat().then(() => console.log(`[NPC] ${npcDeposu.liste().length} NPC kaydı`), (e: unknown) => { npcHata = e instanceof Error ? e.message : String(e); console.error("[NPC] yüklenemedi:", npcHata); });

// SEKANS (spec 36; Unreal Sequencer'ın küçük hâli): zaman çizelgesi, uzuv izleri, klip bölümleri; `<userData>/orion-sekans/`, örnekler `assets/sekans/`.
// Editör ekranın alt yarısında (3B görünüm üstte kalır). Oynatma YALNIZ editörün ▶'si (gerçek tık); ajanlara grafiğin AYNI kapısından (`grafKapisi`).
// Orion'un araç yüzeyinde sekans yok. Graf editörüyle aynı anda açılmaz (biri açılınca öteki gizlenir).
const sekansSistemi = sekansKur({
  // Control Rig + kamera (spec 38): sahne, tuval, Orion'un bedeni ve canlı kamera. Rig yalnız Orion'u düzenler (Flash'ın bedeni sonraki iş).
  sahne, tuval, avatar: (ajan) => (ajan === "orion" ? yol.al("orion") : null), kameraRig: rig,
  klipler, katman: bedenKlipleri, kapi: grafKapisi, ajanlar: () => ajanlar.hepsi().map((x) => x.id),
  oku: async (yol) => { const y = await fetch(varlik(yol)); if (!y.ok) throw new Error(`HTTP ${y.status}`); return y.text(); },
  altyazi: altyaziGoster, izin: () => imlec.acik || imlec.ac(),
  gorunurlukDegisti: (acik) => { orionAyarPaneli.gorunur(!acik && imlec.acik); if (acik) { grafEditoru.gizle(); nesnePaneli.kapat(); baglamMenusu.kapat(); duzenleme.bitir(); zeminKalemi.sec(null); } },
  gunluk: (seviye, metin) => gunluk.ekle(seviye, "sekans", metin),
  // Senaryo yüzü (oynatma) yalnız sekans senaryolarında: sekansdene (spec 36), kimododene (spec 37).
  senaryoKosusu: istenenSenaryolar(location.search).some((s) => s === "sekansdene" || s === "kimododene" || s === "rigdene" || s === "kameradene"),
  sekmeAc: (id) => altCubuk.ac(id),
});
altCubuk.ekle(sekansSistemi.sekme);

/** Hedefin menüsünü aç; "Özellikler…" aynı noktada `panel`i gösterir. */
function hedefMenusuAc(hedef: MenuHedefi, panel: PanelNesne, x: number, y: number): void {
  nesnePaneli.kapat();
  sonOzellikler = () => nesnePaneli.ac(panel, [], x, y);
  baglamMenusu.ac(menuKur<HedefMenuBaglami, MenuEylemi>({ hedef }, MENU_KATKILARI, MENU_AYARI), x, y);
}
const bosKutu = { x: 0, y: 0, z: 0, g: 0, yuk: 0, d: 0 };
/** Menüden komut alabilecek BEDENLİ ajanlar (Flash): zemin ve nesne menülerinde "Flash ▸ …" girişleri bunlardan çıkar. */
const menuAjanlari = () => ajanlar.hepsi().filter((a) => a.niyet).map((a) => ({ id: a.id, ad: a.ad }));
// Beden seçimi (Orion, Flash; sol/sağ tık): `Yer.nesneler`de olmadıkları için `secim`e girmezler; yalnız sarı çerçeve gösterilir ve beden yürürse çerçeve onu izler.
// Aynı anda en çok bir beden seçili (nesneSecimi eskinin çerçevesini ÖNCE kapatır).
type SecilebilirBeden = "orion" | "flash";
let seciliBeden: SecilebilirBeden | null = null;
const bedenDurumu = (b: SecilebilirBeden) => (b === "orion" ? yol.al("orion") : flashBag?.avatar)?.durum() ?? null;
function bedenCercevesi(): void {
  const d = seciliBeden ? bedenDurumu(seciliBeden) : null;
  if (!d) { secimVurgusu.goster(null); return; }
  const yuk = d.oturuyor_mu ? ORION_KUTUSU.oturur : ORION_KUTUSU.ayakta;
  secimVurgusu.goster({ x: d.konum.x, y: d.konum.y + yuk / 2, z: d.konum.z, g: ORION_KUTUSU.genislik, yuk, d: ORION_KUTUSU.derinlik });
}
setInterval(() => { if (seciliBeden) bedenCercevesi(); }, 150);
const bedenSecimi = (b: SecilebilirBeden) => (secili: boolean): void => {
  if (secili) seciliBeden = b; else if (seciliBeden === b) seciliBeden = null;
  bedenCercevesi();
};
/** Flash fareyle seçilebilir (Orion'la aynı gövde kutusu: aynı beden, başka renk); yüklenene dek ışın hiçbir şeye isabet etmez. */
const flashAktoru = {
  id: FLASH.id, ad: FLASH.ad,
  vur: (k: { x: number; y: number; z: number }, y: { x: number; y: number; z: number }) => { const d = flashBag?.avatar.durum(); return d ? orionuVur(k, y, d.konum, d.oturuyor_mu) : null; },
  menu: (x: number, y: number) => {
    const d = flashBag?.avatar.durum();
    if (!d) return;
    const b = { oturuyor: d.oturuyor_mu, poz: d.poz, mesgul: d.mesgul, elinde: d.elinde, konum: d.konum };
    secim.sec(null);
    hedefMenusuAc({ tur: "ajan", ajan: { id: FLASH.id, ad: FLASH.ad, oturuyor: d.oturuyor_mu } }, { id: FLASH.id, ad: FLASH.ad, tur: "NPC (LLM'siz)", capa: null, kutu: bosKutu, ozellikler: orionOzellikleri(b) }, x, y);
  },
  secimi: bedenSecimi("flash"),
};
// ORION'UN AYAR PANELİ (spec 34): Orion seçilince (sol/sağ tık) ekranın SOLUNDA açılır, seçim kalkınca kapanır; ✕/Esc seçimi de bırakır. Bölümler bağımsız
// modüller (`uygulama/ayar/`): Beyin modeli (M seçicinin AYNI kaynağı), Ses (Piper; host/sesler.js), Hafıza notları (md deposu), Refleksler, Bağlam (pano telleri), Kısayollar.
const orionAyarPaneli = orionAyarlariKur({
  bildir: altyaziGoster,
  kapatildi: () => nesneSecimi.bedenSeciminiBirak(),
  pano: () => yol.al("pano"),
  modelKaynagi: () => yol.al("modelKaynagi"),
  modelPenceresi: () => yol.al("modelSecici")?.ac(),
  soyle: (metin) => orionSesi.soyle(metin),
  md: { depo: mdDeposu, ac: mdAc, hata: () => mdHata },
  sekmeAc: (id) => altCubuk.ac(id),
  yetki: yetkiAnahtarlari(location.search),
  komut: PANO_TELLERI.refleks.komut,
  hafiza: { esik: PANO_TELLERI.hafiza.otoEsik, mdToplam: PANO_TELLERI.hafiza.mdToplam },
});
const orionPaneliniAc = (secili: boolean): void => {
  if (secili) orionAyarPaneli.ac({ id: ORION_AJANI.id, ad: ORION_AJANI.ad, renk: ORION_AJANI.renk }); else orionAyarPaneli.kapat();
};
const nesneSecimi = nesneSecimiKur({
  orionSecimi: (secili) => { bedenSecimi("orion")(secili); orionPaneliniAc(secili); },
  aktorler: () => (flashBag ? [flashAktoru] : []),
  tuval, imlec, odakta: () => rig.odakta, nesneler: () => yerler.ozyn.nesneler,
  orionuVur: (k, y) => { const d = yol.al("orion")?.durum(); return d ? orionuVur(k, y, d.konum, d.oturuyor_mu) : null; },
  orionMenusu: (x, y) => {
    const d = yol.al("orion")?.durum();
    if (!d) return;
    const b = { oturuyor: d.oturuyor_mu, poz: d.poz, mesgul: d.mesgul, elinde: d.elinde, konum: d.konum };
    secim.sec(null);
    hedefMenusuAc({ tur: "orion", orion: b }, { id: "orion", ad: "Orion", tur: "orion", capa: null, kutu: bosKutu, ozellikler: orionOzellikleri(b) }, x, y);
  },
  zeminMenusu: (k, yon, x, y) => {
    const p = zeminNoktasi(k, yon, (px, pz) => yerler.ozyn.yukseklik(px, pz));
    if (!p) return;
    secim.sec(null);
    sonZemin = p;
    hedefMenusuAc({ tur: "zemin", nokta: p, alan: yerler.ozyn, yerlestirme: { gruplar: yerlestirme.gruplar(), pano: yerlestirme.pano() }, ajanlar: menuAjanlari() }, { id: "zemin", ad: "Zemin", tur: "zemin noktası", capa: null, kutu: bosKutu, ozellikler: zeminOzellikleri(p) }, x, y);
  },
  isin: (x, y) => fareIsini(sahne, rig.kamera, x, y),
  secim,
  menuAc: (n, x, y) => {
    const k = oyuncu.oyuncuDurumu().konum;
    const eylemler = nesneEylemleri(n, { capalar: yerler.ozyn.capalar, oyuncu: { x: k.x, z: k.z } });
    hedefMenusuAc({ tur: "nesne", ad: n.ad, eylemler, duzenleme: yerlestirme.duzenleme(n), ajanlar: menuAjanlari() }, n, x, y);
  },
  altyazi: altyaziGoster,
});

// HUD + odak gözetimi (uygulama/hud.ts).
hudKur({ hud, motor, saat, rig, oda, oyuncu, odak, yerler, yol, imlec: () => imlec.acik, secili: () => secim.oku()?.ad ?? null, mantikTik: () => mantikTik });

// Konsol/MCP deneme yüzeyi (window.dunya) + hızlı deneme tuşları (uygulama/dunyaKancasi.ts).
dunyaKancasiKur({
  sahne, rig, oyuncu, tahta, monitor, odak, yerler, gecis, altyaziGoster, niyetiYurut, orionKaresi, orion: () => yol.al("orion"),
  // Hızlı deneme tuşları (1-6) sohbet yazarken ya da onay beklerken oyuna SIZMASIN (Ozyn'in canlı testi, 2026-10-21).
  tusSerbest: () => !sohbet.acikMi() && onayKapisi.durum !== "bekliyor",
});

// ── BEYİN: Orion kendi kararıyla dünyada eylemde bulunur ──────────────────
// Köprü dünyayı da beyni de import etmez; ikisini burada bağlıyoruz.
// Yerel model odadaki varlıktan sorumlu; ağır iş terminaldeki Claude'a gider.
const girdi = new MetinGirdi();

// ── ORION FLASH (spec 33): LLM'siz NPC ajanı, ikinci beden (başka renk) ─────
// Orion'un kablolamasına DOKUNMAZ: ayrı, paralel kablo (uygulama/ajanlar/flashBaglantisi.ts). Yer: Ozyn'in yeri — NPC Ozyn'in bulunduğu
// dünyada yaşar (birleşik dünyada üçü aynı yerde; Orion'un kendi başına başka yere gitmesi, C6, Flash'ı sürüklemesin). Senaryo koşularında
// (`?sessiz`, `*dene`) ve `?flashsiz` ile KURULMAZ: canlı doğrulama senaryoları bugünkü tek bedenli dünyayı görür.
{
  const q = new URLSearchParams(location.search);
  if (!q.has("sessiz") && !q.has("flashsiz") && istenenSenaryolar(location.search).length === 0) {
    flashBaglantisiKur({
      sahne, saat, vrmYolu: varlik(VARSAYILAN_VRM), klipler: bedenKlipleri, yer: () => yerler.ozyn, oyuncuKonumu: () => oyuncu.oyuncuDurumu().konum,
      koltuklar, ajanlar, altyazi: altyaziGoster, altyaziEkle: altyaziGoster.ekle, gunluk, secili: seciliSoz, sema: flashSemaKancasi(flashZihni),
      oyuncuDurumu: () => oyuncu.oyuncuDurumu(),
    }).then((b) => {
      flashBag = b;
      // Flash'ın gözü grafiklere açılır (spec 35 dilim 2): aynı olay köprüsüne de gider (ajanAlgisi.ts, kopya üretici yok). Göz yoksa açılmaz.
      if (b.olayDinle) { b.olayDinle((o) => grafOlaylari.yay(FLASH.id, o)); grafOlaylari.ajanEkle(FLASH.id); }
    }, (e: unknown) => console.error("[FLASH] kurulamadı:", e));
  }
}

// Ozyn'in varlık sinyali: son girdi, son konuşma, girdi sayacı (uygulama/varlikSinyali.ts).
const varlikSinyali = varlikSinyaliKur();
/** `?inisiyatif=eski`: saat tabanlı eski kapı ve geniş özerk tur (geri alma yolu; T2 'Geri alma'). */
const INISIYATIF_ESKI = new URLSearchParams(location.search).get("inisiyatif") === "eski";
/** Köprünün o anki beyninin adı (M tuşuyla değişir); kapı "sessizlik" uyanışını buna göre açar (OB15). */
let kopruBeyinAdi: () => string = () => "";
/** Kapının son değerlendirdiği zaman (dünya saati, ms): bütçe penceresi kapıyla AYNI saati kullanır. */
let inisiyatifSimdi = 0;


/**
 * Hafıza kipi (spec 16): "yonlendirici" (varsayılan) ya da `?hafiza=otomatik` (eski, kıyas için).
 * Yönlendirici kipinde dünya satırı ham koordinat taşımaz: yer adı durum defterinden, sorulunca gelir.
 */
const HAFIZA_KIPI: "otomatik" | "yonlendirici" =
  new URLSearchParams(location.search).get("hafiza") === "otomatik" ? "otomatik" : "yonlendirici";

/** Beyne her turda giden dünya durumu satırı (uygulama/dunyaDurumu.ts). */
const dunyaDurumuMetni = dunyaDurumuKur({
  oyuncu, monitor, acilis: varlikSinyali.acilis, hafizaKipi: HAFIZA_KIPI,
  orion: () => yol.al("orion"), sonKonusma: () => varlikSinyali.sonKonusma(), secili: seciliBeyne,
});

function beyniBagla(a: Avatar): void {
  // Takip: Ozyn uzaklaştıkça Orion yanına yürür (uygulama/takip.ts). Mevcut beden yolu (`bedenAdimi`).
  const takipci = new Takipci({
    orionKonumu: () => a.durum().konum,
    ozynKonumu: () => oyuncu.oyuncuDurumu().konum,
    bedenAdimi: (n) => bedenAdimi(n),
  });
  // BEYİN SEÇİMİ (uygulama/beyinSecimi.ts, spec 14 R6): seçenekler, açılış beyni, Ollama/OpenCode/API
  // taramaları, hatırlanan seçim (yalnız elle açılışta), kayıt sarmalı, devre kesici. Buradan yalnız
  // dünya verilir: sorgu, kabuk köprüsü, depo.
  const kabukApi = typeof window.kopru?.apiDurum === "function" ? window.kopru : null;
  const secim = beyinSeciminiKur({
    sorgu: location.search, mcpBeyin, sema, gunluk,
    altyazi: (metin, ms) => altyaziGoster(metin, ms),
    tazele: () => yol.al("modelSecici")?.tazele(),
    kabuk: kabukApi,
    depo: {
      oku: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
      yaz: (k, d) => { try { localStorage.setItem(k, d); } catch { /* depolama kapalı: önemsiz */ } },
    },
  });
  const { secici, kesikSn } = secim;
  const beyin: Beyin = secici;

  // ZİHİN DUVARI (uygulama/zihinDuvari.ts, spec 14 R4): karar kaydı → günlük, anlık benlik →
  // canlı satır, devre kesici → arıza, hafıza → bulut. Yalnız gözlem; kancalar köprüye gider.
  const duvar = zihinDuvariniBagla({
    sema, gunluk, kopru: () => yol.al("kopru"), kesikSn, kisaAd,
    inisiyatifDurumu: () => (INISIYATIF_ESKI ? null : butceSatiri(inisiyatif.butce.ozet(inisiyatifSimdi))),
  });
  varlikSinyali.kararKaydiBagla(duvar.kararKaydi);
  kopruBeyinAdi = () => secim.kopruBeyni.ad;
  const kopru = kopruKur({
    duvar, secim, sema, gunluk, oyuncu, yerler, refleks, takipci, inisiyatif, ortamBaglantisi, ortamSozlugu,
    niyetiYurut, davranisKayit, dunyaDurumu: dunyaDurumuMetni,
    hafizaKipi: HAFIZA_KIPI, inisiyatifEski: INISIYATIF_ESKI,
    orion: () => yol.al("orion"), inisiyatifSimdi: () => inisiyatifSimdi,
    beyinKapisi: () => gozlemSuruyor(),
    mdBaglami: () => mdDeposu.baglam().metin,
    emirHedefleri,
    secili: seciliSoz,
  });
  yol.kaydet("kopru", kopru);
  // Orion bir AJAN kaydıdır (spec 33): sohbet ve mikrofon sözü bu kapıdan alır (eskiden doğrudan `kopru.algi`; nesne aynı).
  ajanlar.kaydet({ ...ORION_AJANI, kume: null, algi: (a) => kopru.algi(a) });

  // DEVRE PANOSU kayıt defteri: uygulama/devrePanosu.ts (kurulum + şemaya takma).
  const panoKaydi = devrePanosuKur({ kopru, onayKapisi, ajanda, beyin, secici, kesikSn, sema });
  yol.kaydet("pano", panoKaydi);

  // ── MODEL SEÇİCİ (M) ─────────────────────────────────────────────────
  // Kaynağı uygulama/beyinSecimi.ts'te: seçim devre panosunun teyit yolundan geçer (tek yol).
  // Kaynak TEK: M penceresi ve ayar paneli · Beyin modeli (spec 34) aynı nesneyi kullanır — ikinci seçim yolu yok.
  const modelKaynagi = seciciKaynagiKur(secim, panoKaydi, kabukApi);
  yol.kaydet("modelKaynagi", modelKaynagi);
  const modelSecici = modelSeciciKur({
    kaynak: modelKaynagi,
    kok: document.getElementById("modelSecici") as HTMLElement,
    rozet: document.getElementById("beyinRozet") as HTMLElement,
    // M bir harftir: terminal/panel odaktayken, sohbet ya da onay açıkken değil.
    tusSerbest: () => oyuncu.oyuncuDurumu().etkilesim === null
      && !sohbet.acikMi() && onayKapisi.durum !== "bekliyor",
  });
  yol.kaydet("modelSecici", modelSecici);
  window.orionModel = modelKancasiKur(secim, () => modelSecici.ac());
  // ── STİL PENCERESİ (G): ova'dayken stil/renk/ışık/shader/saat denemeleri; fare kilidi açılınca bırakılır ──
  const stilPenceresi = stilPenceresiKur({
    ortam: ortamBaglantisi,
    gunluk: ortamGunlugu,
    ogrenilen: {
      liste: () => ortamSozlugu.liste().map((k) => ({
        soz: k.soz, ham: k.ham, askida: OrtamSozlugu.askidaMi(k),
        ozet: k.komutlar.map((c) => `${c.ne}${c.deger ? ` ${c.deger}` : ""}${c.sayi !== undefined ? ` ${c.sayi}` : ""}`).join(", "),
      })),
      sil: (soz) => { ortamSozlugu.sil(soz); },
    },
    tusSerbest: () => oyuncu.oyuncuDurumu().etkilesim === null && !sohbet.acikMi() && onayKapisi.durum !== "bekliyor",
    acildi: () => rig.fareKilitBirak(),
  });
  yol.kaydet("stilPenceresi", stilPenceresi);
  const birlesik = gecis.birlesik();
  if (birlesik) stilPenceresi.ova(birlesik.level);   // dünya pencereden ÖNCE hazırsa burada bağlanır (aksi hâlde dünya kurulunca)
  console.log(`[PANO] ${panoKaydi.moduller().length} modül, ` +
    `${panoKaydi.goruntu().reduce((n, m) => n + m.dugmeler.length, 0)} tel bağlandı`);

  // ÖLÇÜM KİLİDİ: panelden AÇILMAZ, bilerek (gerekçe: uygulama/devrePanosu.ts).
  olcumKilidiKancasiKur(panoKaydi);

  durumGozlemiKur({ kopru, takipci, avatar: a, monitor, yerler });

  sohbetKipiIsaretiKur({ kopru, gunluk });

  // Senaryo kipinde beyin susar: elle gönderilen niyetler kesilmesin.
  // (Köprü kurulduktan SONRA — `durdur()` örneğin üstünde çalışır.)
  if (SENARYO_KIPI) {
    kopru.durdur();
    console.log("[SENARYO] beyin durduruldu — senaryonun niyetleri kesilmesin");
  }

  arizaGostergesiKur({ kopru, altyaziGoster, gunluk, sema });

  konusmayiBagla({ kopru, altyaziGoster, altyaziEkle: altyaziGoster.ekle, gunluk, davranisKayit, orionSesi });

  // Niyet sonuçları beyne geri döner (yalnızca hatalar terfi eder).
  a.sonucDinle((s) => kopru?.sonuc(s));

  // Yazılan metin "duyuldu" algısı olur — mikrofon geldiğinde aynı yol kullanılır.
  void girdi.baslat();
  const sozAlindi = (t: { metin: string; kesin: boolean }, kaynak: "klavye" | "mikrofon" = "klavye") => {
    if (!t.kesin) return;
    varlikSinyali.girdiOldu("soz");
    varlikSinyali.sozVerildi();   // "en son ne zaman konuştuk" bundan
    // TEK GİRİŞ (spec 33): söz hedef ajanlara dağılır. Altyazı ÖNCE (eskisi gibi): ajanın eşzamanlı cevabını ("Peşindeyim.") ezmesin.
    // Yalnız Orion duyacaksa metin eskisinin aynısı; başka hedefte kime gittiği yazılır.
    const alacak = ajanGirdisi.hedefler();
    const kime = alacak.map((x) => x.ad).join(" + ");
    altyaziGoster(alacak.length === 1 && alacak[0]!.id === ORION_AJANI.id ? `sen: ${t.metin}` : alacak.length ? `sen → ${kime}: ${t.metin}` : `kimse duymadı (hedef hazır değil): ${t.metin}`, 2000);
    ajanGirdisi.ilet(t.metin, kaynak);
  };
  girdi.dinle((t) => sozAlindi(t));
  // Canlı deneme (`ORION_OZYN_SOZU`, OB21): açılıştan sonra Ozyn bunu yazmış gibi — klavyeyle AYNI yol. Beden
  // senaryosu DEĞİL: kendiliğinden uyanma açık kalır (açık iş hatırlatmasını uçtan uca görmek için).
  const denemeSozu = new URLSearchParams(location.search).get("ozynsozu");
  if (denemeSozu) setTimeout(() => sozAlindi({ metin: denemeSozu, kesin: true }), 8000);

  // Mikrofon (V bas-konuş, K aç/kapat): uygulama/mikrofon.ts.
  mikrofonKur({ gunluk, altyaziGoster, sozAlindi });

  void beyin.hazirMi().then((h) => {
    console.log(`[BEYIN] ${beyin.ad} hazir=${h}`);
    if (!h) {
      // Sessiz bozulma YOK: kullanıcı neyin kapalı olduğunu bilsin — ve DOĞRU
      // sebebi. Bu mesaj eskiden hangi beyin olursa olsun "OpenCode sunucusu
      // yok" diyordu; beyin `mcp` iken yanıltıcıydı (asıl eksik: ajan).
      const sebep = beyin.ad === "mcp"
        ? "MCP ajanı bağlı değil (node tools/orion-ajan.ts)"
        : beyin.ad.startsWith("opencode") ? "OpenCode sunucusu yok (opencode serve)"
        : `${beyin.ad} hazır değil`;
      console.warn(`[BEYIN] ${sebep}. KURALLI VARLIK kipi: Orion hareket eder ve tepki verir ama düşünemez.`);
      altyaziGoster(`Düşüncem şu an kapalı — ${sebep}`, 5000);
    }
  });
}

// ── Sohbet kutusu: T aç, Enter gönder, Esc kapat (uygulama/sohbetKutusu.ts) ──
const sohbet = sohbetKutusuKur({ oyuncu, girdi });
// SOHBET HEDEFİ (spec 33): Orion | Flash | İkisi. Seçim tek girdi adaptörünün hedefidir: mikrofon da aynı seçimi izler (iki giriş, tek hedef).
const hedefSecimi = new CipSecimi(() => hedefCipleri(ajanlar.hepsi()), hatirlananHedef());
ajanlar.dinle(() => hedefSecimi.secenekDegisti());
sohbetHedefi = () => hedefSecimi.etkin() ?? ORION_AJANI.id;
sohbetHedefiKur({ kok: document.getElementById("sohbetHedef") as HTMLElement, girdi: document.getElementById("sohbetGirdi") as HTMLInputElement, secim: hedefSecimi });

// ── GÖZ MUAYENESİ (O): Orion'un gözünden kare → yerel görme modeli (sohbetten BAĞIMSIZ düz soru) → panelde önizleme + cevap ──
// Sıra iki yönlü (uygulama/gozlem.ts): beyin düşünürken göz bekler, göz sürerken beyin yeni tur başlatmaz (`beyinKapisi`). Sohbet geçmişine/hafızaya girmez.
const gozPaneli = gozPaneliKur({
  istek: () => { void gozlem.bak(); },
  tusSerbest: () => oyuncu.oyuncuDurumu().etkilesim === null && !sohbet.acikMi() && onayKapisi.durum !== "bekliyor",
  acildi: () => rig.fareKilitBirak(),
});
// ── BEDENİM (B): giysi parçalarını ve renkleri değiştir; anında uygulanır, tarayıcı deposuna kaydedilir ──
bedenPaneliKur({
  model: { slotlar: SLOTLAR, renkAdlari: RENK_ADLARI, varsayilan: BEDEN_VARSAYILANI, yok: BEDEN_YOK },
  ayar: () => oyuncu.bedenAyari,
  // Panelden gelen yapısal ayar tabloya göre doğrulanır (bozuk değer beden ayarına giremez).
  degisti: (p) => { const a = bedenAyariniDuzelt(p); oyuncu.bedenAyarla(a); bedenAyariniKaydet(a); },
  tusSerbest: () => oyuncu.oyuncuDurumu().etkilesim === null && !sohbet.acikMi() && onayKapisi.durum !== "bekliyor",
  acildi: () => rig.fareKilitBirak(),
});
const gozlem = gozlemKur({
  kare: async () => { const k = await orionKaresi(); return k ? { png: k.png, en: 896, boy: 504 } : null; },
  model: gozModeli,
  beyinMesgul: () => yol.al("kopru")?.dusunuyorMu ?? false,
  panel: gozPaneli,
});
gozlemSuruyor = () => gozlem.suruyor();

// ── Duman testi kanıtı (uygulama/dumanTesti.ts) ────────────────────────────
dumanTestiKur({ motor, saat, rig, oda, oyuncu, monitor, yerler, orion: () => yol.al("orion"), kopru: () => yol.al("kopru") });

// ---- Orion'un sesi (uygulama/orionSesi.ts) --------------------------------
const orionSesi = orionSesiKur();

// ── CANLI DENEME SENARYOLARI (spec 14 R3) ─────────────────────────────────────
//
// `3dorion.bat <ad>dene` modları URL'de `?<ad>dene=1` taşır. Senaryolar eskiden bu dosyanın
// içindeydi (23 blok, ~1000 satır): test kodu üretim paketinde. Artık her biri
// `uygulama/senaryolar/<ad>.ts`; yalnız istenince DİNAMİK yüklenir. Bağlam, bu dosyanın
// nesnelerini verir; sonradan atananlar (orion, kopru …) getter'dır.
const senaryoBaglami: SenaryoBaglami = {
  motor, sahne, saat, rig, oda, oyuncu, monitor, adminTerminal, tahta, gunluk, sema, zoomKutu, zoomOran,
  refleks, onayKapisi,
  get orion() { return yol.al("orion"); },
  get kopru() { return yol.al("kopru"); },
  get gordumGeldi() { return gordumGeldi; },
  get zoomPayi() { return odak.zoomPayi(); },
  yerler: () => ({ ozyn: yerler.ozyn, orion: yerler.orion }),
  ovayaCik: () => gecis.ovayaCik(),
  // `ortamdene`: ova'nın GERÇEK tanımı (ofiste null), hatırlama kipi, öğrenen sözlüğün büyüklüğü, ofise dönüş.
  ortam: {
    tanim: () => { const b = gecis.birlesik(), o = gecis.disari(); return b ? b.level.tanim() : o ? o.level.tanim() : null; },
    kipAyarla: (kip) => ortamGunlugu.kipAyarla(kip),
    ogrenilenSayisi: () => ortamSozlugu.liste().length,
    odayaDon: () => gecis.odayaDon(),
  },
  // `kapidene`: birleşik dünyanın kapısı ve görünüm geçişi.
  dunya: { kapiAcisi: () => oda.kapi?.aci() ?? null, ic: () => gecis.birlesik()?.ic() ?? 0, gi: () => gecis.birlesik()?.gi ?? null },
  niyetiYurut, onayKarari, algiSor, monitoreGec: odak.monitoreGec, admineGec: odak.admineGec, panelOdak: odak.panelOdak, panoyuAl, zoomUygula: odak.zoomUygula, sonGorme,
  gozModeli: () => gozModeli.model,
  doktor,
  webMonitoru,
  gozlem,
  sekans: sekansSistemi.senaryo,
};
for (const ad of istenenSenaryolar(location.search)) {
  void import(`./senaryolar/${ad}.ts`)
    .then((m: { kos(d: SenaryoBaglami): Promise<void> }) => m.kos(senaryoBaglami))
    .catch((e) => console.error(`[SENARYO] ${ad} yüklenemedi ya da düştü:`, e));
}

// Birleşik dünya açılışı (spec 27): uygulama/yerGecisi.ts. Ofis ova'nın içinde; kurulamazsa ofis tek başına yaşar.
gecis.birlesikDunyayiAc();
