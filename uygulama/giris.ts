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
import { avatarKur, orionGozuKur, VARSAYILAN_VRM, type Avatar } from "../world/avatar/index.ts";
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
import { Kopru } from "../bridge/kopru.ts";
import { modelSeciciKur } from "../world/arayuz/modelSecici.ts";
import { stilPenceresiKur } from "../world/arayuz/stilPenceresi.ts";
import type { Beyin } from "../bridge/beyin.ts";
import { MetinGirdi } from "../voice/metin-girdi.ts";
import { komutKipiCoz } from "./komutKipi.ts";
import { Takipci } from "./takip.ts";
import { Ajanda } from "../mind/ajanda.ts";
import { mesgulMu } from "../mind/benlik.ts";
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
import { kopruKur } from "./kopruKur.ts";
import { mikrofonKur } from "./mikrofon.ts";
import { durumGozlemiKur, sohbetKipiIsaretiKur, arizaGostergesiKur, konusmayiBagla } from "./kopruDinleyicileri.ts";
import { onayBaglantisiKur } from "./onayBaglantisi.ts";
import { varlikSinyaliKur } from "./varlikSinyali.ts";
import { dunyaDurumuKur } from "./dunyaDurumu.ts";
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
import type { Kopru as KabukKoprusu } from "../host/kopru.ts";
import { OrtamGunlugu, ogrenilenDeposu } from "./ortamDeposu.ts";
import { OrtamSozlugu } from "../mind/ortamSozlugu.ts";
import { sessizlikIzinliMi } from "../bridge/ozerkYetenek.ts";
import { GozModeli } from "../bridge/goz.ts";
import { KuralRefleksi } from "../mind/refleks.ts";
import { kimlik } from "../protocol/temel.ts";
import type { DavranisDefteri } from "../world/davranisDenemesi.ts";

const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const altyazi = document.getElementById("altyazi") as HTMLDivElement;
const altyaziGoster = altyaziKur(altyazi);

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
// Doğum yeri köşeden İÇERİ: (2.6, 2.6) kapı köşesiydi ve omuz kamerası iki
// duvara birden sıkışıp oyuncunun gövdesine yapışıyordu (ölçüm: 1.44 m).
const oyuncu = new Oyuncu(sahne, oda, rig, {
  dogumYeri: new Vector3(1.6, 0, 1.9),
  yer: () => yerler.ozyn,
  // Esc yığınının 0. aşaması: panel içindeki alt görünüm önce kapanır.
  // `sema` aşağıda kuruluyor; kapanış çağrı ANINDA okunduğu için sorun yok.
  // Esc yığını sırayla daralır: teyit → detay → (oyuncu.ts: etkileşim →
  // odak → fare kilidi). Her Esc BİR adım geri alır; tek tuşun kullanıcıyı
  // duvarın dibinden odanın ortasına atması istenmiyor.
  escOnce: () => {
    if (panoKaydiGlobal?.bekleyenTeyit()) {
      panoKaydiGlobal.teyitIptal();
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
let orion: Avatar | null = null;
void avatarKur({
  sahne, saat,
  spawn: { x: 0.9, y: 0, z: -1.2 },
  vrmYolu: varlik(VARSAYILAN_VRM),
  // Ozyn'in kararı (2026-09-27): low-poly beden varsayılan, YÜZ SONRA gelecek.
  // Modelde ağız/göz blend shape'i yok; seçim kuralı (iskeletSecim.ts) onu
  // reddedip prosedürel robota düşerdi. Bilinen bedel: TTS ağız senkronu ve
  // göz kırpma görünmez, `jest` klibi yok (el sallama görünmez) — `?yuzdene`
  // bunu dürüstçe KALDI diye raporlar. Yüz eklenince bu satır kalkmalı.
  vrmZorla: true,
  yer: () => yerler.orion,
  // bak {tip:"oyuncu"} için: avatar oyuncunun yerini buradan öğrenir.
  oyuncuKonumu: () => oyuncu.oyuncuDurumu().konum,
}).then((a) => {
  orion = a;
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
  if (!orion) return null;
  const o = orion;
  const d = o.durum();
  return orionGozu.kare(d.konum, yaw ?? Math.atan2(d.bakis.x, d.bakis.z), yerler.orion, en, boy, (g) => o.gorunur(g && yerler.orion === yerler.ozyn));
}

// Yer geçişi, kapı ve birleşik dünya (uygulama/yerGecisi.ts).
const gecis = yerGecisiKur({
  yerler, sahne, oda, rig, oyuncu, gunluk, altyaziGoster,
  orion: () => orion,
  ortamBaglantisi: () => ortamBaglantisi,
  ortamGunlugu: () => ortamGunlugu,
  stilPenceresi: () => stilPenceresi,
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
const terminalAlgisi = terminalAlgisiKur({ monitor, refleks, oyuncu, orion: () => orion, kopru: () => kopru });

// Onay kapısı + paneli + Y/N/Esc bağı (uygulama/onayBaglantisi.ts).
const { onayKapisi, onayPaneliCiz, onayKarari } = onayBaglantisiKur({ monitor, sema, gunluk, altyaziGoster, kopru: () => kopru });

// Algı hizmetine dünya görüşü (uygulama/algiBaglantisi.ts).
const algiSor = algiSorKur({ yerler, oyuncu, orion: () => orion });

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
const doktor = doktorKur(doktorBaglamiBabylon(sahne, motor, ortamBaglantisi, () => kopru?.sayac() ?? {}));
const { niyetiYurut, bedenAdimi, sonGorme } = niyetYurutucusuKur({
  ortam: ortamBaglantisi,
  doktor,
  // `sor gor` göz muayenesi yolundan (düz sorgu, iki yönlü sıra, panel): `gozlem` aşağıda kurulur, burada tembel sarmalayıcı.
  gozlem: { bak: () => gozlem.bak(), sonHata: () => gozlem.sonHata() },
  beden: () => orion,
  kopru: () => kopru,
  tahta, monitor, onayKapisi, sema, gunluk, algiSor,
  altyazi: (metin, ms) => altyaziGoster(metin, ms),
  onayPaneliCiz,
  olguHatirla: (anahtar, deger) => kopru?.olguHatirla(anahtar, deger) ?? null,
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
  if (orion) {
    orion.cizimGuncelle(Math.min(ms, 100) / 1000);
    if (orionSesi.konusuyorMu()) orion.agizAyarla(orionSesi.agizAcikligi());
  }
  sahne.render();
});

addEventListener("resize", () => motor.resize());

// ── Etkileşim → altyazı/HUD ────────────────────────────────────────────────
// T3 (monitör) ve T4 (köprü) aynı yayıcıya abone olacak. Burada yalnızca
// kullanıcıya geri bildirim var; protokol mesajı ÜRETİLMEZ.

EtkilesimOlaylari.dinle("basladi", (o) => {
  // Kapı (spec 24): "geç" anlık bir eylem — etkileşim açık kalmaz, geçiş başlar.
  if (o.eylem === "gec") {
    EtkilesimOlaylari.bitir();
    void gecis.kapidanGec();
    return;
  }
  altyaziGoster(`${o.capa} · ${o.eylem} — çıkmak için Esc`);
  console.log(`[etkilesim] basladi capa=${o.capa} eylem=${o.eylem} t=${o.t.toFixed(2)}`);
  // `E` ile YÜZEYE GEÇ. Tek tablo (`YUZEY_GECISI`) hem `E`yi hem odaktaki
  // tıklamayı besliyor: iki giriş yolu aynı davranışı vermeli, yoksa "E ile
  // açılıyor ama tıklayınca açılmıyor" gibi keyfi bir fark doğar.
  //
  // Eskiden yalnızca monitor ve admin bağlıydı: zihin duvarındaki panellere
  // `E` basmak etkileşim başlatıyor ama EKRANDA HİÇBİR ŞEY OLMUYORDU.
  void odak.yuzeyGecisi[o.capa]?.();
});
EtkilesimOlaylari.dinle("bitti", (o) => {
  if (o.eylem === "gec") return;
  altyaziGoster("etkileşim kapandı");
  console.log(`[etkilesim] bitti capa=${o.capa}`);
  // Terminaller klavye odağını da bırakmalı; paneller için kamera yeter.
  if (o.capa === "monitor") odak.monitordenCik();
  else if (o.capa === "admin") odak.admindenCik();
  else if (o.capa in odak.yuzeyGecisi) rig.odakBirak();
});

/** Senaryoların panoyu sorgulayabilmesi için. Üretimde yalnızca okunur. */
let panoKaydiGlobal: Pano | null = null;
/** `bakdene` icin: algi cevabi beyne ulasti mi (senaryo yedegi buna bakar). */
let gordumGeldi = false;
/**
 * Panoyu oku. Fonksiyon olması gerekli: TS, modül kapsamındaki `let`i
 * bildirim yerindeki `null`a daraltıyor ve senaryo bloğunda `?.` zinciri
 * `never` üretiyor. Açık dönüş tipi bu daraltmayı keser.
 */
function panoyuAl(): Pano | null { return panoKaydiGlobal; }

const zoomKutu = document.getElementById("zoom") as HTMLElement;
const zoomOran = document.getElementById("zoomOran") as HTMLElement;

// 3. MONİTÖR (groma haritası): ana süreçteki ekran dışı pencere sayfayı yükler, kareler masadaki küçük monitörde görünür (uygulama/webMonitoru.ts).
// `?gromasiz` kapatır. Groma sunucusu kapalıysa ekran bunu yazar ve açılınca kendiliğinden bağlanır.
const webMonitoru = webMonitoruKur({
  sahne, ekranMesh: oda.gromaEkran,
  kopru: () => { const k = (globalThis as { kopru?: Partial<KabukKoprusu> }).kopru; return k?.webmonKomut && k.webmonDinle ? (k as WebKopru) : null; },
});
if (!new URLSearchParams(location.search).has("gromasiz")) void webMonitoru.baslat();

// Odak/zoom kipi: monitöre ve panellere geçiş, zoom, odakta tıklama (uygulama/odak.ts).
const odak = odakKur({
  motor, sahne, rig, oda, monitor, adminTerminal, sema, gunluk, tuval, altyaziGoster, webMonitoru,
  ozynCapalari: () => yerler.ozyn.capalar,
});

// HUD + odak gözetimi (uygulama/hud.ts).
hudKur({ hud, motor, saat, rig, oda, oyuncu, odak, yerler, mantikTik: () => mantikTik });

// Konsol/MCP deneme yüzeyi (window.dunya) + hızlı deneme tuşları (uygulama/dunyaKancasi.ts).
dunyaKancasiKur({ sahne, rig, oyuncu, tahta, monitor, odak, yerler, gecis, altyaziGoster, niyetiYurut, orionKaresi, orion: () => orion });

// ── BEYİN: Orion kendi kararıyla dünyada eylemde bulunur ──────────────────
// Köprü dünyayı da beyni de import etmez; ikisini burada bağlıyoruz.
// Yerel model odadaki varlıktan sorumlu; ağır iş terminaldeki Claude'a gider.
const girdi = new MetinGirdi();
let kopru: Kopru | null = null;

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
  orion: () => orion, sonKonusma: () => varlikSinyali.sonKonusma(),
});

/** Model seçici penceresi — beyin bağlanınca kurulur (seçiciye ihtiyaç duyar). */
let modelSecici: ReturnType<typeof modelSeciciKur> | null = null;
/** Ova stil deneme araçları (G): yalnız ova kuruluyken açılır; ofise dönünce kapanır. */
let stilPenceresi: ReturnType<typeof stilPenceresiKur> | null = null;

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
    tazele: () => modelSecici?.tazele(),
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
    sema, gunluk, kopru: () => kopru, kesikSn, kisaAd,
    inisiyatifDurumu: () => (INISIYATIF_ESKI ? null : butceSatiri(inisiyatif.butce.ozet(inisiyatifSimdi))),
  });
  varlikSinyali.kararKaydiBagla(duvar.kararKaydi);
  kopruBeyinAdi = () => secim.kopruBeyni.ad;
  kopru = kopruKur({
    duvar, secim, sema, gunluk, oyuncu, yerler, refleks, takipci, inisiyatif, ortamBaglantisi, ortamSozlugu,
    niyetiYurut, davranisKayit, dunyaDurumu: dunyaDurumuMetni,
    hafizaKipi: HAFIZA_KIPI, inisiyatifEski: INISIYATIF_ESKI,
    orion: () => orion, inisiyatifSimdi: () => inisiyatifSimdi,
    beyinKapisi: () => gozlemSuruyor(),
  });

  // DEVRE PANOSU kayıt defteri: uygulama/devrePanosu.ts (kurulum + şemaya takma).
  const panoKaydi = devrePanosuKur({ kopru, onayKapisi, ajanda, beyin, secici, kesikSn, sema });
  panoKaydiGlobal = panoKaydi;

  // ── MODEL SEÇİCİ (M) ─────────────────────────────────────────────────
  // Kaynağı uygulama/beyinSecimi.ts'te: seçim devre panosunun teyit yolundan geçer (tek yol).
  modelSecici = modelSeciciKur({
    kaynak: seciciKaynagiKur(secim, panoKaydi, kabukApi),
    kok: document.getElementById("modelSecici") as HTMLElement,
    rozet: document.getElementById("beyinRozet") as HTMLElement,
    // M bir harftir: terminal/panel odaktayken, sohbet ya da onay açıkken değil.
    tusSerbest: () => oyuncu.oyuncuDurumu().etkilesim === null
      && !sohbet.acikMi() && onayKapisi.durum !== "bekliyor",
  });
  window.orionModel = modelKancasiKur(secim, () => modelSecici?.ac());
  // ── STİL PENCERESİ (G): ova'dayken stil/renk/ışık/shader/saat denemeleri; fare kilidi açılınca bırakılır ──
  stilPenceresi = stilPenceresiKur({
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

  konusmayiBagla({ kopru, altyaziGoster, gunluk, davranisKayit, orionSesi });

  // Niyet sonuçları beyne geri döner (yalnızca hatalar terfi eder).
  a.sonucDinle((s) => kopru?.sonuc(s));

  // Yazılan metin "duyuldu" algısı olur — mikrofon geldiğinde aynı yol kullanılır.
  void girdi.baslat();
  const sozAlindi = (t: { metin: string; kesin: boolean }, kaynak: "klavye" | "mikrofon" = "klavye") => {
    if (!t.kesin) return;
    altyaziGoster(`sen: ${t.metin}`, 2000);
    varlikSinyali.girdiOldu("soz");
    varlikSinyali.sozVerildi();   // "en son ne zaman konuştuk" bundan
    kopru?.algi({ tur: "duydum", metin: t.metin, kesin: true, kaynak });
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
  beyinMesgul: () => kopru?.dusunuyorMu ?? false,
  panel: gozPaneli,
});
gozlemSuruyor = () => gozlem.suruyor();

// ── Duman testi kanıtı (uygulama/dumanTesti.ts) ────────────────────────────
dumanTestiKur({ motor, saat, rig, oda, oyuncu, monitor, yerler, orion: () => orion, kopru: () => kopru });

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
  get orion() { return orion; },
  get kopru() { return kopru; },
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
};
for (const ad of istenenSenaryolar(location.search)) {
  void import(`./senaryolar/${ad}.ts`)
    .then((m: { kos(d: SenaryoBaglami): Promise<void> }) => m.kos(senaryoBaglami))
    .catch((e) => console.error(`[SENARYO] ${ad} yüklenemedi ya da düştü:`, e));
}

// Birleşik dünya açılışı (spec 27): uygulama/yerGecisi.ts. Ofis ova'nın içinde; kurulamazsa ofis tek başına yaşar.
gecis.birlesikDunyayiAc();
