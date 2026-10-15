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
// avatar/ buradan görülür. Kural gevşetilmedi; bağlama işi tek dosyaya hapsedildi.
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
import { bulunduguCapa, capaBul } from "../world/level/capalar.ts";
import { yerSabitBilgisi, yerOrtasiSozu, type Yer } from "../world/yer/yer.ts";
import { konumluSabitBilgi, konumluYerOrtasi } from "../world/yer/birlesikYer.ts";
import { yerelTepki } from "../mind/yerelTepki.ts";
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
import type { OgretimSatiri } from "../mind/kararKaydi.ts";
import { modelSeciciKur } from "../world/arayuz/modelSecici.ts";
import { stilPenceresiKur } from "../world/arayuz/stilPenceresi.ts";
import type { Beyin } from "../bridge/beyin.ts";
import { MetinGirdi } from "../voice/metin-girdi.ts";
import { NemotronGirdi } from "../voice/nemotron.ts";
import { komutKipiCoz } from "./komutKipi.ts";
import { Takipci } from "./takip.ts";
import { ikiCumleyeKisalt } from "../voice/kisalt.ts";
import { Ajanda } from "../mind/ajanda.ts";
import {
  ogretimleriYukle, gorevSatirlariniYukle, durumDeposuKur, hafizaYedegiKur, hafizaDeposuKur,
} from "./hafizaDeposu.ts";
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
import { OrtamGunlugu, ogrenilenDeposu } from "./ortamDeposu.ts";
import { OrtamSozlugu } from "../mind/ortamSozlugu.ts";
import { sessizlikIzinliMi } from "../bridge/ozerkYetenek.ts";
import { GozModeli } from "../bridge/goz.ts";
import { KuralRefleksi, refleksGirdisi } from "../mind/refleks.ts";
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

// ── KAPIDAN OVAYA (spec 24) ────────────────────────────────────────────────
// Ofisin kapısının öbür yanı ova level'ı. Geçişte oda gizlenir, ova AYNI sahneye kurulur (world/yer/levelSahnesi.ts);
// dönüşte ova yıkılır, oda birebir geri gelir. Ozyn ve Orion birlikte geçer; Orion'un kendi başına çıkması C6.
// Orion'un gözü (spec 25): `sor gor` (GÖRME, Faz 2) ve ölçüm yüzeyi `dunya.orionGozu` aynı kareyi çeker.
const orionGozu = orionGozuKur(sahne);
// Görme modeli: `?goz=<ollama modeli>` (varsayılan gemma4:e4b), `?ollama=` beyinle aynı adres. Yalnız istenince bakar.
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
const { niyetiYurut, bedenAdimi, sonGorme } = niyetYurutucusuKur({
  ortam: ortamBaglantisi,
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

// Odak/zoom kipi: monitöre ve panellere geçiş, zoom, odakta tıklama (uygulama/odak.ts).
const odak = odakKur({
  motor, sahne, rig, oda, monitor, adminTerminal, sema, gunluk, tuval, altyaziGoster,
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
  kopru = new Kopru({
    kararKaydi: duvar.kararKaydi,
    // Dikkat'in yazılabilir ayarları TELDEN gelir: karar yolu ile devre
    // panosu artık aynı nesneyi okur.
    dikkat: {
      tekrarPenceresiMs: PANO_TELLERI.dikkat.tekrar,
      terminalKisMs: PANO_TELLERI.dikkat.terminalKis,
      dakikaBasinaAzami: PANO_TELLERI.dikkat.azami,
    },
    beyin: secim.kopruBeyni,
    niyetGonder: (n, id) => {
      // Davranış ölçümü için: hangi niyet üretildi, yalnızca kimliği değil.
      // Kimlik tek başına "Orion ne yaptı" sorusuna cevap vermiyordu.
      const govde = JSON.stringify(n).slice(0, 120);
      console.log(`[BEYIN→NIYET] ${id} ${govde}`);
      gunluk.ekle("bilgi", "niyet", `${n.tur} ${govde.slice(0, 90)}`);
      sema.vur("niyet", n.tur);
      davranisKayit()?.niyet(n.tur);

      // YÖNLENDİRME (kompozisyon kökünün işi): `soyle` avatarın değil ses
      // hattının niyetidir. Köprü onu zaten `konusmaDinle` üzerinden TTS'e
      // verdi; bir de avatara göndermek avatarın onu HATA ile reddetmesine
      // yol açıyordu ve bu sahte başarısızlık beyne geri besleniyordu —
      // yani Orion doğru konuşurken "konuşamadım" diye öğreniyordu.
      // Ağız senkronu ayrı yoldan (orionSesi → agizAyarla) zaten yürüyor.
      niyetiYurut(n, id);
    },
    dunyaDurumu: dunyaDurumuMetni,
    // Çapa adları DEĞİŞMEZ: sistem mesajında bir kez söylenir. Her turun
    // sonuna eklendiğinde model onları son algı sanıp geri okuyordu.
    // GÖRÜNEN adlar (spec 06 K3): iç kimlik (`admin`, `sema`) modele hiçbir
    // şey anlatmıyordu; algı hizmeti "yönetim terminali" derken sabit liste
    // "admin" diyordu ve model ikisini aynı şey saymıyordu.
    // Çapa ETİKETLERİ Türkçe kalır: onlar odadaki şeylerin ADI, çerçeve değil.
    sabitBilgi: () => { const k = orion?.durum().konum ?? { x: 0.9, z: -1.2 }; return konumluSabitBilgi(yerler.orion, k.x, k.z); },
    toplamaMs: 900,
    // Ölçüm için ayarlanabilir: kısa pencere hipotezi (anı, alakasız sohbetin
    // altında gömülüyor mu?) tek değişkenle sınanabilsin.
    gecmisSiniri: Number(new URLSearchParams(location.search).get("gecmis") ?? 12) || 12,
    // HAFIZA OTURUMLAR ARASI KALICI.
    //
    // Önceden yalnızca bellekteydi: her açılışta Orion sizi ilk kez
    // görüyordu. "Odada yaşayan biri" iddiası, dünü hatırlamayan biriyle
    // tutmuyor. localStorage yeterli — Electron renderer'ında kalıcı, IPC
    // gerektirmiyor ve depo arayüzü dar olduğu için ileride dosyaya
    // taşımak tek fonksiyon değişikliği.
    //
    // DOSYAYA TAŞINDI (spec 07 K4, 2026-09-19). Yukarıdaki not doğru çıktı:
    // arayüz dar olduğu için değişiklik bu blokla sınırlı (K7). Karar
    // `mind/hafizaGocu.ts` → `depoYukle`de; burada yalnızca G/Ç bağlanır.
    hafizaDeposu: hafizaDeposuKur(),
    // Sıkıştırma yedeği (spec 26 F3-C): host dosyası yoksa (geliştirme kipi) yedek de yok → sıkıştırma yapılmaz.
    ...hafizaYedegiKur(),
    // Kendiliğinden uyanışlar: bütçe (model-saniye/token) köprüden beslenir; özerk tur dar araç kümesiyle (T2-K4/K5).
    inisiyatifButcesi: { sonuc: (_t, sureMs, token, eylemli) => inisiyatif.butce.sonuc(inisiyatifSimdi, sureMs, token, eylemli) },
    ozerkTur: !INISIYATIF_ESKI,
    aniPolitikasi: new URLSearchParams(location.search).get("anipolitikasi") === "eski" ? "eski" : "yeni",
    hafizaKapasite: PANO_TELLERI.hafiza.kapasite,
    // SPEC 16: bağlama yalnız SORULAN girer (konum, son iş, eski konuşma…), yakın pencere küçük.
    // `?hafiza=otomatik` eski davranışı geri getirir — kıyas ölçüsü için (spec 16 P1).
    hafizaKipi: HAFIZA_KIPI,
    ...(HAFIZA_KIPI === "yonlendirici" ? { yakinPencere: { kayit: 4, yasMs: 10 * 60_000 } } : {}),
    yerAdlari: () => yerler.orion.capalar.map((c) => c.etiket),
    // "BENİ TAKİP ET" (içgüdü `kopru.takip`): köprü sözü tanır, dünya (Takipci) yürütür.
    takipDinle: (aktif) => {
      if (aktif) takipci.baslat(); else takipci.birak();
      gunluk.ekle("bilgi", "takip", aktif ? "Ozyn'i takip ediyor" : "takip bitti");
    },
    durumDeposu: durumDeposuKur(),
    // ÖĞRENEN KAPI (K3, K5): gölgede — kapının kararını değiştirmez, kayda yazar.
    ogretimler: ogretimleriYukle(),
    // BECERİ REFLEKSİ (spec 10, Faz C): gölgede — kesin sözde hafızanın ne yapacağını
    // söz satırına yazar; kapı, uyanış ve niyetler değişmez.
    gorevSatirlari: gorevSatirlariniYukle(),
    // BECERİ YETKİSİ (Faz D): ANAHTAR, varsayılan KAPALI. Yalnız `?beceri=1` (ORION_BECERI=1)
    // ile açılır; açılması ön-kayıtlı barı geçmeye bağlı (spec 10).
    beceriYetkisi: new URLSearchParams(location.search).has("beceri"),
    // DOĞUŞTAN KOMUT PROGRAMLARI (spec 13 Faz 2b): elle açılışta AÇIK (Ozyn: "ölçüm geçince
    // açık"; gerçek sözlerde yanlış eşleşme 0). Senaryolarda (`sessiz=1`) KAPALI: `tahtadene`,
    // `becerdene` LLM'in ve becerinin yolunu ölçer, program onları değiştirmesin. `?komut=0|1` zorlar.
    // SÜZGEÇ MERCEĞİNİN YETKİSİ (spec 12 Faz 5): ANAHTAR, varsayılan KAPALI (gölgede yazar).
    // `?benliksuzgec=1` açar; gerçek kullanımda açılması gölge ölçüsüne bağlı (Ozyn).
    benlikSuzgecYetkisi: new URLSearchParams(location.search).has("benliksuzgec"),
    // ANLIK BENLİK (spec 12): gövde karar anında ÇEKİLİR.
    bedenDurumu: () => {
      const d = orion?.durum();
      return d ? { poz: d.poz, oturuyor: d.oturuyor_mu } : null;
    },
    // Ortam sözleri ("gece yap") yalnız ova'dayken sözlükten geçer; ofiste LLM'e gider (mind/ortamKomutlari.ts).
    ortamKullanilabilir: () => ortamBaglantisi.kullanilabilirMi(),
    ortamOgrenilen: (soz) => ortamSozlugu.esle(soz),
    ortamOgren: (soz, komutlar) => {
      const r = ortamSozlugu.ogren(soz, komutlar);
      console.log(`[ORTAM] sözlük: "${soz}" → ${r}${r === "reddedildi" ? "" : ` (${komutlar.map((k) => `${k.ne}${k.deger ? ` ${k.deger}` : ""}${k.sayi !== undefined ? ` ${k.sayi}` : ""}`).join(", ")})`}`);
    },
    komutYetkisi: (() => {
      const q = new URLSearchParams(location.search);
      return q.has("komut") ? q.get("komut") !== "0" : !q.has("sessiz");
    })(),
    // BAĞLAM (K4): algı anında Ozyn nerede, Orion'a bakıyor mu, hangi yüzeyde.
    // Yapısal — dünya metni ayrıştırılmaz. Öğrenen kapının durum koduna girer.
    baglam: () => {
      const o = oyuncu.oyuncuDurumu();
      return { mesafe: o.mesafe, bakiyor: o.bakiyor, yuzey: o.etkilesim };
    },
    // İçerik süzgeci: hangi algının beyne değeceğine karar verir.
    // Kural tabanlı; ÖLÇÜLDÜ (mind/akis-olcum.ts, 12 gerçek komut çıktısı,
    // 12/12 ideal uyandırma). Spec'in önerdiği 270M model ölçümde elendi:
    // 31/31 geçersiz JSON, 13.8 sn azami gecikme, sıfır bilgi katkısı.
    suzgec: (a, ozet) => {
        // ── SAĞ LOB ─────────────────────────────────────────────────────────
      // Sol lob (OpenCode) kapalıysa Orion tamamen ölmez: yerel, kuralcı ve
      // anlık bir tepki üretir. `dürüst bozulma` vaadi ancak böyle gerçek olur.
      //
      // KOŞUL ŞART: ikisi birden çalışırsa niyetler çakışır ve beynin `git`i
      // sağ lobun `bak`ı tarafından kesilir — aynı sınıf hata bu oturumda bir
      // kez yaşandı (bkz. senaryo kipi).
      if (kesikSn() > 0 && a.tur !== "olay") {
        const n = yerelTepki({
          tur: a.tur === "duydum" ? "duydum" : a.tur === "terminal" ? "terminal" : "olay",
          ozet, kod: a.tur === "terminal" ? a.kod : undefined,
        });
        if (n) {
          const id = kimlik("saglob");
          console.log(`[SAGLOB] ${n.tur} ← ${ozet.slice(0, 70)}`);
          sema.vur("refleks", "sağ lob");
          gunluk.ekle("uyari", "sağ lob", `${n.tur}: ${ozet.slice(0, 60)}`);
          niyetiYurut(n, id);
        }
      }

    // Şema besleme noktası: her algı buradan geçiyor, dallanma da burada.
      // Köprünün içine kanca koymak yerine buradan okunuyor çünkü bu geri
      // çağrı ZATEN her algıda ve tam karar anında çalışıyor.
      sema.vur("algi", a.tur);
      sema.vur("suzgec");
      // Girdi tek kaynaktan (mind/refleks.ts `refleksGirdisi`): süre, çıkış kodu
      // ve niyetin kaynağı algıdan gelir, burada elle kurulmaz.
      const k = refleks.karar(refleksGirdisi(a, ozet));
      sema.vur(k.terfi ? "dikkat" : "refleks", k.terfi ? "" : "süzüldü");
      // Kimlik de döner: karar kaydı hangi içgüdünün karar verdiğini yazar (spec 08).
      return { gecsin: k.terfi, kural: k.kural, gerekce: k.gerekce };
    },
    metinDinle: (metin, aracVarMi) => { if (!aracVarMi) davranisKayit()?.duyulmayan(metin); },
    icSesDinle: duvar.icSesDinle,
    sozEylemDinle: duvar.sozEylemDinle,
    asamaDinle: duvar.asamaDinle,
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

  // DURUM DEFTERİ (spec 16 F2): Orion'un bulunduğu yer (çapa adı, ham koordinat değil) ve monitör
  // yarım saniyede bir gözlenir. Defter yalnız DEĞİŞİMİ yazar ve yanından geçmeyi konum saymaz.
  // Model uyanmaz; bilgi bağlama yalnız sorulunca girer (yönlendirici).
  const durumKopru = kopru;
  setInterval(() => {
    takipci.tik();
    try {
      durumKopru.durum.konumGozlem(bulunduguCapa(a.durum().konum, durumKopru.durum.oku("konum")?.deger, yerler.orion.capalar)?.etiket ?? konumluYerOrtasi(yerler.orion, a.durum().konum.x, a.durum().konum.z));
      durumKopru.durum.monitor(monitor.acikMi());
    } catch (err) { console.warn("[DURUM] gozlem hatasi:", err); }
  }, 500);

  // SOHBET KİPİ (spec 16 F5b): "yeni sohbet" / "temiz sohbet" / "normal sohbet" sözle değişir (köprü,
  // LLM uyanmaz). Temizdeyken ekranın üstünde HEP görünür: hafızanın kapalı olduğu unutulmasın.
  const sohbetIsareti = document.createElement("div");
  sohbetIsareti.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);padding:4px 12px;"
    + "border-radius:6px;background:#14202e;color:#ffd38a;font:600 13px system-ui,sans-serif;z-index:50;display:none;pointer-events:none";
  sohbetIsareti.textContent = "TEMİZ SOHBET · hafıza kapalı · çıkmak için: normal sohbet";
  document.body.appendChild(sohbetIsareti);
  kopru.sohbetKipiDinle((kip, e) => {
    sohbetIsareti.style.display = kip === "temiz" ? "block" : "none";
    gunluk.ekle("bilgi", "sohbet", e === "yeni" ? "yeni sohbet: konuşma penceresi sıfırlandı (hafıza duruyor)"
      : e === "temiz" ? "temiz sohbet: hafıza ve durum bağlama girmiyor, hiçbir şey yazılmıyor" : "normal sohbete dönüldü");
  });

  // Senaryo kipinde beyin susar: elle gönderilen niyetler kesilmesin.
  // (Köprü kurulduktan SONRA — `durdur()` örneğin üstünde çalışır.)
  if (SENARYO_KIPI) {
    kopru.durdur();
    console.log("[SENARYO] beyin durduruldu — senaryonun niyetleri kesilmesin");
  }

  // ARIZA: beyin düşünemiyorsa odada GÖRÜNÜR olsun.
  //
  // Ölçümle bulundu: OpenRouter `free-models-per-day` kotası dolunca OpenCode
  // HTTP 200 içinde 429 döndürüyor ve 75 sn sonra pes ediyor. Orion sessizce
  // susuyordu; ne Ozyn ne günlük sebebi söylüyordu. Bu Orion'un sözü DEĞİL —
  // sistem bildirimi olarak altyazıya düşer, TTS'e gitmez.
  let sonAriza = 0;
  // Öğretim dosyasına düşen yeni ders (tools/ogret.ts) yeniden başlatmadan uygulanır.
  (globalThis as { kopru?: Partial<import("../host/kopru.ts").Kopru> }).kopru?.ogretimDinle?.((s) => {
    if (kopru?.ogretimUygula(s as OgretimSatiri)) console.log("[KAPI] yeni ogretim uygulandi");
  });
  kopru.arizaDinle((m) => {
    // Aynı arıza saniyede bir tekrar etmesin; ekranı doldurur.
    const simdi = Date.now();
    if (simdi - sonAriza < 8000) return;
    sonAriza = simdi;
    const kota = /429|rate limit|free-models-per-day/i.test(m);
    altyaziGoster(kota
      ? "⚠ Düşünce kapalı: model sağlayıcı kotası doldu. Orion kurallı kipte."
      : `⚠ Düşünce hatası: ${m.slice(0, 90)}`, 6000);
    gunluk.ekle("hata", "beyin", kota ? `sağlayıcı kotası doldu — ${m}` : m);
    sema.ariza("beyin", true, kota ? "kota doldu" : "hata");
    sema.durumYaz(kota
      ? "düşünce kapalı — sağlayıcı kotası doldu, kurallı kipte"
      : `düşünce hatası: ${m.slice(0, 70)}`);
  });

  // Orion konuşunca: altyazı + gerçek ses.
  kopru.konusmaDinle((ham) => {
    // Gevezelik freni: talimat "iki cümle" diyor, model 2/3 koşuda uymuyordu.
    // Kural burada BELİRLEYİCİ biçimde uygulanır (ölçüm: 3dorion.bat davranis).
    const metin = ikiCumleyeKisalt(ham);
    if (!metin) return;
    if (metin !== ham.trim().replace(/\s+/g, " ")) {
      console.log(`[SOZ] kisaltildi ${ham.length} -> ${metin.length} karakter`);
    }
    altyaziGoster(metin, Math.max(2600, metin.length * 70));
    gunluk.ekle("iyi", "orion", metin);
    davranisKayit()?.soyle(metin);
    void orionSesi.soyle(metin);
  });

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

  // Mikrofon: bas-konuş V, Nemotron Speech İngilizce çözer. Çözülen metin klavyeden yazılmış gibi
  // AYNI yoldan geçer (sozAlindi): kapı, hafıza, komut sözlüğü değişmez.
  // AÇIK/KAPALI: K tuşu. Seçim hatırlanır (localStorage "orion.mikrofon"); ?mikrofon=1 (ORION_MIKROFON=1)
  // o oturum için açar. Kapalıyken Python süreci YOKTUR (RAM/CPU yok). Senaryolarda (`sessiz=1`)
  // hiçbir zaman kendiliğinden açılmaz.
  if (typeof window.kopru?.dinleKomut === "function") {
    const sorgu = new URLSearchParams(location.search);
    const hatirla = (v?: "1" | "0"): string | null => {
      try { if (v) localStorage.setItem("orion.mikrofon", v); return localStorage.getItem("orion.mikrofon"); } catch { return null; }
    };
    const kulak = new NemotronGirdi(window.kopru);
    kulak.dinle((t) => sozAlindi(t, "mikrofon"));
    kulak.hataDinle((h) => { gunluk.ekle("hata", "kulak", h); altyaziGoster(`kulak: ${h}`, 4000); });
    kulak.durumDinle((d) => {
      if (d.d === "yukleniyor") altyaziGoster("kulak yükleniyor (~15 sn)…", 4000);
      else if (d.d === "hazir" && d.mikrofon) { gunluk.ekle("iyi", "kulak", `hazır: ${d.mikrofon} (bas-konuş: V)`); altyaziGoster("kulak hazır: V tuşunu basılı tutup İngilizce konuş", 3500); }
      else if (d.d === "dinliyor") altyaziGoster("dinliyorum… (V basılı)", 30000);
      else if (d.d === "cozuyor") altyaziGoster("çözüyorum…", 3000);
      else if (d.d === "bos") altyaziGoster(d.neden === "sessiz" ? "ses gelmedi (mikrofon seviyesi çok düşük?)" : d.neden === "cok kisa" ? "çok kısa, V'yi basılı tut" : "anlaşılmadı", 2500);
    });
    const yaziAlaniMi = (h: EventTarget | null) => h instanceof HTMLElement && (h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.isContentEditable);
    let acik = false;
    const kulagiAc = (ac: boolean) => {
      acik = ac;
      hatirla(ac ? "1" : "0");
      if (ac) void kulak.baslat();
      else { kulak.durdur(); altyaziGoster("kulak kapalı (K ile aç)", 2500); gunluk.ekle("bilgi", "kulak", "kapatıldı"); }
    };
    addEventListener("keydown", (e) => {
      if (e.repeat || yaziAlaniMi(e.target)) return;
      if (e.code === "KeyK") kulagiAc(!acik);
      else if (e.code === "KeyV" && acik) kulak.kayitBasla();
    });
    addEventListener("keyup", (e) => { if (e.code === "KeyV") kulak.kayitBitir(); });
    if (!sorgu.has("sessiz") && (sorgu.has("mikrofon") || hatirla() === "1")) kulagiAc(true);
  }

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
};
for (const ad of istenenSenaryolar(location.search)) {
  void import(`./senaryolar/${ad}.ts`)
    .then((m: { kos(d: SenaryoBaglami): Promise<void> }) => m.kos(senaryoBaglami))
    .catch((e) => console.error(`[SENARYO] ${ad} yüklenemedi ya da düştü:`, e));
}

// Birleşik dünya açılışı (spec 27): uygulama/yerGecisi.ts. Ofis ova'nın içinde; kurulamazsa ofis tek başına yaşar.
gecis.birlesikDunyayiAc();
