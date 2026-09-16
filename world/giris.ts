// world/giris.ts — Renderer giriş noktası ve BİRLEŞTİRME NOKTASI.
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
import { Saat, TIK_HZ } from "./engine/tik.ts";
import { KameraRig } from "./engine/kamera.ts";
import { odaKur } from "./level/oda.ts";
import { capaAdlari, capaBul, tumCapalar, yaklastiMi } from "./level/capalar.ts";
import { isinTara } from "./player/isinTarama.ts";
import { BUTCE, sorguYanitla, type Cevap, type Soru } from "../mind/algiHizmeti.ts";
import { yerelTepki } from "../mind/yerelTepki.ts";
import { capaKonumu } from "./level/capaGeometri.ts";
import { Oyuncu } from "./player/oyuncu.ts";
import { EtkilesimOlaylari } from "./player/etkilesim.ts";
import { PiperCikisi } from "../voice/cikis.ts";
import { avatarKur, VARSAYILAN_VRM, type Avatar } from "./avatar/index.ts";
import { monitorKur, type Monitor } from "./surfaces/monitor.ts";
import { tahtaKur, type Tahta } from "./surfaces/tahta.ts";
import { gunlukKur, type GunlukEkrani } from "./surfaces/gunluk.ts";
import { semaKur, type SemaPaneli } from "./surfaces/sema.ts";
import { TAHTA, GUNLUK, SEMA, GOZ_YUKSEKLIK } from "./level/olculer.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { varlik } from "./varlik.ts";
import { Kopru } from "../bridge/kopru.ts";
import { OpenCodeBeyni } from "../bridge/opencode.ts";
import { DisBeyin } from "../bridge/disBeyin.ts";
import { KayitBeyni } from "../bridge/kayitBeyni.ts";
import type { Beyin } from "../bridge/beyin.ts";
import { MetinGirdi } from "../voice/metin-girdi.ts";
import { ikiCumleyeKisalt } from "../voice/kisalt.ts";
import { Ajanda } from "../mind/ajanda.ts";
import { KuralRefleksi, UZUN_ISLEM_MS } from "../mind/refleks.ts";
import { OnayKapisi } from "../mind/onayKapisi.ts";
import { riskEtiketi } from "../mind/komutRiski.ts";
import { OlayUretici } from "./olayUretici.ts";
import { ciktiFarki, kesildiMi } from "./surfaces/ciktiFarki.ts";
import { CiktiToplayici } from "./surfaces/ciktiToplayici.ts";
import { kimlik } from "../protocol/temel.ts";
import { DavranisDefteri, raporla, type SenaryoSonucu } from "./davranisDenemesi.ts";

const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const altyazi = document.getElementById("altyazi") as HTMLDivElement;

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
const rig = new KameraRig(sahne, tuval);
// Doğum yeri köşeden İÇERİ: (2.6, 2.6) kapı köşesiydi ve omuz kamerası iki
// duvara birden sıkışıp oyuncunun gövdesine yapışıyordu (ölçüm: 1.44 m).
const oyuncu = new Oyuncu(sahne, oda, rig, { dogumYeri: new Vector3(1.6, 0, 1.9) });

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

// Kabuk entegrasyonu (OSC 133): komut bitişi + çıkış kodu. Bu sinyal olmadan
// "başarıyla bitti" bilgisi metinde GÖRÜNMEZ (tsc temiz geçince 0 satır yazar)
// ve başarısızlık metinden TAHMİN edilmek zorunda kalır.
monitor.isaretDinle((i) => {
  if (i.tur !== "bitti") return;
  // İlk `D` işareti entegrasyonun canlı olduğunu kanıtlar; bundan sonra
  // sınırı kabuk belirler, zamanlayıcı değil.
  if (!kabukEntegrasyonu) {
    kabukEntegrasyonu = true;
    console.log("[KABUK] entegrasyon canli — komut siniri artik kabuktan geliyor");
  }
  // Açılıştaki ilk istem de `D` yayar ama ortada komut yoktur; boş tamponu
  // raporlamak anlamsız. Kod yine de saklanır ki sonraki blok onu taşısın.
  bekleyenKod = i.kod ?? null;
  bekleyenSure = i.sureMs;
  if (ciktiToplayici.bekleyenSatir === 0) {
    // SESSİZ BAŞARI: çıktı yok ama komut çalıştı. `tsc --noEmit` temiz
    // geçtiğinde tam olarak budur — kod+süre olmadan bu bilgi GÖRÜNMEZDİ.
    // Yalnızca gerçekten beklenmiş işler için algı üretilir.
    sessizBitisBekliyor = i.sureMs !== undefined && i.sureMs >= UZUN_ISLEM_MS;
    return;
  }
  komutBittiIsareti = true;
  console.log(`[KABUK] komut bitti, kod=${i.kod ?? "yok"} sure=${i.sureMs ?? "?"}ms`);
});

// ── Orion: avatar asenkron yüklenir, sahne onsuz da ayakta kalır ───────────
let orion: Avatar | null = null;
void avatarKur({
  sahne, saat,
  spawn: { x: 0.9, y: 0, z: -1.2 },
  vrmYolu: varlik(VARSAYILAN_VRM),
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

// ── MANTIK: 20Hz ───────────────────────────────────────────────────────────
let mantikTik = 0;
// T6: beyin konuşmuyorken Orion'un masasında heykel gibi durmaması için
// düşük maliyetli öneriler (bak/jest). Beyin/kullanıcı meşgulse asla araya
// girmez — bkz. mind/ajanda.ts başındaki KATI KURAL.
const ajanda = new Ajanda();

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
const BEDEN_SENARYOLARI = ["tahtadene", "gordene", "yuzdene", "admindene", "zihindene", "senaryodene"] as const;

/** Bu koşu senaryolu bir beden denemesi mi? */
function bedenSenaryosuMu(): boolean {
  const q = new URLSearchParams(location.search);
  return BEDEN_SENARYOLARI.some((k) => q.has(k));
}

const SENARYO_KIPI = bedenSenaryosuMu();
if (SENARYO_KIPI) console.log("[SENARYO] kendiliğinden davranışlar susturuldu (ajanda + beyin)");
const refleks = new KuralRefleksi();

// ── ONAY KAPISI: projedeki tek tehlikeli yetenegin tek gecidi ─────────────
// Orion komut ONERIR, CALISTIRAMAZ. Calistiran sey Ozyn'in tusudur.
// Zaman asimiyla "evet" yoktur; suresi dolan oneri DUSER.
const onayKapisi = new OnayKapisi();
const onayPanel = document.getElementById("onay") as HTMLDivElement;
const onayKomutEl = document.getElementById("onayKomut") as HTMLDivElement;
const onayRiskEl = document.getElementById("onayRisk") as HTMLDivElement;
const onayGerekceEl = document.getElementById("onayGerekce") as HTMLDivElement;

function onayPaneliCiz(): void {
  const b = onayKapisi.bekleyen;
  if (!b) { onayPanel.dataset.acik = "0"; return; }
  onayPanel.dataset.acik = "1";
  onayPanel.dataset.risk = b.risk.seviye;
  onayKomutEl.textContent = b.komut;
  onayRiskEl.textContent = riskEtiketi(b.risk);
  onayGerekceEl.textContent = `Orion: ${b.gerekce}`;
}

/** Onaylanan komut terminale YAZILIR — calistiran Ozyn'in tusudur. */
function onayKarari(onaylandi: boolean): void {
  const o = onaylandi ? onayKapisi.onayla() : onayKapisi.reddet();
  onayPaneliCiz();
  if (!o) return;

  if (!onaylandi) {
    console.log(`[ONAY] REDDEDILDI: ${o.komut}`);
    gunluk.ekle("uyari", "onay", `reddedildi: ${o.komut}`);
    sema.vur("onay", "reddedildi");
    kopru?.sonuc({ niyet_id: o.id, durum: "hata",
      not: "Ozyn komutu reddetti. Israr etme; baska bir yol oner ya da sor." });
    altyaziGoster("komut reddedildi", 1800);
    return;
  }

  console.log(`[ONAY] ONAYLANDI (${o.risk.seviye}): ${o.komut}`);
  gunluk.ekle("iyi", "onay", `onaylandı (${o.risk.seviye}): ${o.komut}`);
  sema.vur("onay", "onaylandı");
  if (!monitor.acikMi()) {
    void monitoreGec().then(() => monitor.yaz(o.komut + String.fromCharCode(13)));
  } else {
    monitor.yaz(o.komut + String.fromCharCode(13));
  }
  kopru?.sonuc({ niyet_id: o.id, durum: "bitti",
    not: "Ozyn onayladi, komut terminalde calisti; sonucu ekrandan gorecegin." });
  altyaziGoster("komut calistiriliyor", 1800);
}

// Onay tuslari. Panel acikken Y/N/Esc; kapaliyken hicbir sey yapmaz.
addEventListener("keydown", (e) => {
  if (onayKapisi.durum !== "bekliyor") return;
  const t = e.key.toLowerCase();
  if (t === "y") { e.preventDefault(); e.stopPropagation(); onayKarari(true); }
  else if (t === "n" || e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onayKarari(false); }
}, true);

/**
 * TEK niyet yönlendirme noktası.
 *
 * Neden tek: yönlendirme önce yalnızca köprünün `niyetGonder` yolundaydı.
 * Sonuç olarak `yaz` niyeti GELDİĞİ YOLA GÖRE farklı davranıyordu — köprüden
 * gelince tahtaya, `window.dunya.niyet()` ya da 1-6 tuşlarından gelince
 * doğrudan avatara gidip "benim işim değil" hatası alıyordu. Canlı tahta
 * denemesi bu kusuru ortaya çıkardı.
 *
 * Artık her yol buradan geçer: avatar, ses hattı ve tahta burada ayrılır.
 */
/**
 * Algı hizmetine dünya görüşünü verir.
 *
 * Görünürlük GERÇEK ışınla sınanır (`isinTara`, `KATI_YUZEYLER`): duvar,
 * kapı, raf ışını durdurur. Orion'un cevabı bu yüzden bulunduğu yere bağlıdır
 * — tahtanın önündeyken gördüğü ile kapıdayken gördüğü aynı değildir.
 */
function algiSor(ne: Soru): Cevap {
  const d = orion?.durum();
  const konum = d?.konum ?? { x: 0, y: 0, z: 0 };
  // Avatarın baktığı yön; yoksa odanın içine doğru makul bir varsayılan.
  const bakis = d?.bakis ?? { x: 0, y: 0, z: -1 };

  return sorguYanitla(ne, {
    konum, bakis,
    gozYuksekligi: GOZ_YUKSEKLIK,
    // Sanal çapalar (oda_ortasi) elenir: gidilebilir hedeftirler ama
    // görülebilir nesne değildirler.
    capalar: tumCapalar()
      .filter((c) => !c.sanal)
      .map((c) => ({ ad: c.ad, konum: c.konum, etiket: c.etiket })),
    oyuncu: oyuncu.oyuncuDurumu().konum,
    gorunurMu: (kaynak, hedef) => {
      const dx = hedef.x - kaynak.x, dy = hedef.y - kaynak.y, dz = hedef.z - kaynak.z;
      const u = Math.hypot(dx, dy, dz);
      if (u < 1e-4) return true;
      const isabet = isinTara(kaynak, { x: dx / u, y: dy / u, z: dz / u }, u);
      // Işın hedefe VARMADAN bir şeye çarptıysa engel var demektir.
      // 0.25 m pay: hedefin kendi yüzeyi ışını durdurur, bu engel sayılmaz.
      return !isabet || isabet.mesafe >= u - 0.25;
    },
  });
}

function niyetiYurut(n: Niyet, id: string): void {
  // `soyle` ses hattının işi; köprü onu zaten `konusmaDinle` ile TTS'e verdi.
  // Avatara göndermek sahte bir "yapamadım" üretirdi.
  if (n.tur === "soyle") return;

  // `yaz` tahtanın işi — ama UZAKTAN YAZILMAZ. Kural talimatta zaten yazılı
  // ("tahtaya yazmak için önce tahtanın önüne git"); burada GERÇEKTEN
  // uygulanıyor ve reddin gerekçesi beyne geri besleniyor.
  if (n.tur === "yaz") {
    const yeri = orion?.durum().konum;
    if (!yeri || !yaklastiMi("tahta", yeri)) {
      const not = "tahtaya uzaktan yazamazsın; önce `git` ile tahtanın önüne geç";
      console.log(`[TAHTA] reddedildi: uzakta (${yeri ? `${yeri.x.toFixed(1)},${yeri.z.toFixed(1)}` : "konum yok"})`);
      kopru?.sonuc({ niyet_id: id, durum: "hata", not });
      altyaziGoster("Orion tahtaya uzaktan yazamaz", 2000);
      return;
    }
    const r = tahta.yaz(n.metin, n.temizle ?? false);
    console.log(`[TAHTA] yazildi: +${r.eklenen} satir${r.dusen ? `, ${r.dusen} eski satir dustu` : ""}`);
    kopru?.sonuc({ niyet_id: id, durum: "bitti",
      not: `tahtaya ${r.eklenen} satır yazıldı${r.dusen ? `, ${r.dusen} eski satır kaydı` : ""}` });
    return;
  }

  // `komut` TERMINALE GITMEZ: onay kapisina girer. Orion hicbir kosulda
  // komut CALISTIRMAZ; calistiran sey Ozyn'in tusudur.
  if (n.tur === "komut") {
    const r = onayKapisi.oner(id, n.metin, n.gerekce);
    if (!r.kabul) {
      console.log(`[ONAY] oneri kabul edilmedi: ${r.sebep}`);
      kopru?.sonuc({ niyet_id: id, durum: "hata", not: r.sebep ?? "oneri kabul edilmedi" });
      return;
    }
    const b = onayKapisi.bekleyen;
    console.log(`[ONAY] ONERILDI (${b?.risk.seviye}): ${n.metin}  | gerekce: ${n.gerekce}`);
    sema.vur("onay", `bekliyor (${b?.risk.seviye ?? "?"})`);
    gunluk.ekle(b?.risk.seviye === "yikici" ? "hata"
      : b?.risk.seviye === "degistirir" ? "uyari" : "bilgi", "onay",
      `önerildi: ${n.metin} — ${n.gerekce}`);
    onayPaneliCiz();
    altyaziGoster("Orion bir komut oneriyor — Y onayla, N reddet", 4000);
    return;
  }

  // `sor` DÜNYAYA DEĞİL ALGI HİZMETİNE gider: bedeni ilgilendirmez, salt
  // okunur bir sorgudur ve cevabı doğrudan beyne geri beslenir.
  //
  // Bu, "Orion odayı görebiliyor mu" sorusunun cevabı: veriyi haritadan
  // okur (ucuz) ama her nesneyi GÖRÜŞ TESTİNDEN geçirir (gerçek ışın).
  // Böylece bildiği şey, durduğu yerden gerçekten görülebilen şeydir.
  if (n.tur === "sor") {
    const c = algiSor(n.ne);
    console.log(`[SOR] ${n.ne} → "${c.metin}" (${c.maliyet} krk${c.kirpildi ? ", kırpıldı" : ""})`);
    sema.vur("bakis", n.ne);
    gunluk.ekle("bilgi", "algi", `sor(${n.ne}): ${c.metin}`);
    kopru?.sonuc({ niyet_id: id, durum: "bitti", not: c.metin });
    return;
  }

  // Beden gerçekten harekete geçti: şemanın son durağı.
  sema.vur("beden", n.tur);
  orion?.niyet(n, id);
}

/** Davranis olcumu acikken kayit defterine erisim (yoksa null). */
function davranisKayit(): ReturnType<DavranisDefteri["kayit"]> | null {
  return (window as unknown as { _davranisKayit?: ReturnType<DavranisDefteri["kayit"]> })._davranisKayit ?? null;
}

// T6b "Orion görsün": bugüne kadar Orion yalnızca Ozyn'in yazdığı metni
// algılıyordu — odada olanı da, masasındaki terminali de görmüyordu.
// Aşağıdaki üçlü o boruyu bağlar; süzgeç (mind/refleks) beyni boğulmaktan korur.
const olayUretici = new OlayUretici();
const ciktiToplayici = new CiktiToplayici();
let sonKuyruk = "";
/**
 * Kabuk "komut bitti" dediğinde dolan çıkış kodu (OSC 133 ; D ; kod).
 * Sessizlik tahmini yerine GERÇEK sınır: komutun bittiğini kabuk söyler.
 */
let bekleyenKod: number | null = null;
let bekleyenSure: number | undefined;
let komutBittiIsareti = false;
/**
 * Kabuk entegrasyonu CANLI mı? İlk `D` işareti gelince true olur.
 *
 * Önemli: entegrasyon varken sessizlik zamanlayıcısı DEVRE DIŞI kalır.
 * Yoksa yarış oluşuyordu — 800 ms sessizlik, kabuğun "komut bitti"
 * işaretinden önce tamponu boşaltıyor ve çıkış kodu algıya hiç girmiyordu
 * (canlı koşuda gözlendi: bir koşuda kod geldi, diğerinde hiç gelmedi).
 * Zamanlayıcı zaten sınır sinyali YOKKEN kullanılan bir yedekti.
 */
let kabukEntegrasyonu = false;
/** Çıktısız ama uzun süren başarılı komut: algı üretilmeyi bekliyor. */
let sessizBitisBekliyor = false;
/** Terminal örnekleme sıklığı: 20Hz'de her 8 tik = ~400 ms. */
const TERMINAL_TIK = 8;

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
    kopru?.sonuc({ niyet_id: dusen.id, durum: "hata",
      not: "oneri zaman asimina ugradi; Ozyn karar vermedi" });
  }

  // ── Dünya olayları: sürekli durumdan ayrık olaylar ──────────────────────
  if (orion && kopru) {
    for (const o of olayUretici.ornekle(msSimdi, orion.durum(), oyuncu.oyuncuDurumu())) {
      console.log(`[ALGI] olay: ${o.ad}${o.ayrinti ? " " + JSON.stringify(o.ayrinti) : ""}`);
      kopru.algi({ tur: "olay", ad: o.ad, ayrinti: o.ayrinti });
    }
  }

  // ── Terminal: Orion masasındaki ekrana göz atar ─────────────────────────
  // Akarken susar, akış durunca tek blok gönderir (ölçüm: mind/akis-olcum.ts,
  // parça başına karar 18 uyandırma → sessizlikte toplama 8, ideal 8).
  if (kopru && monitor.acikMi()) {
    // Kabuk "komut bitti" dediyse örnekleme sırasını BEKLEME: çıktı ekranda
    // hazır ama tamponda olmayabilir (örnekleme 400 ms'de bir). Bu yarış
    // canlı koşuda görüldü — işaret boş tampona düşüyor, blok 8 sn'lik
    // güvenlik frenine kalıyor ve Orion geç kalıyordu.
    if (mantikTik % TERMINAL_TIK === 0 || komutBittiIsareti || bekleyenKod !== null) {
      const kuyruk = monitor.kuyruk(24);
      const fark = ciktiFarki(sonKuyruk, kuyruk);
      sonKuyruk = kuyruk;
      if (fark) ciktiToplayici.ekle(fark, msSimdi);
      // İşaret boş tampona düşmüştü ama örnekleme şimdi içerik getirdiyse,
      // bu bloğu o komutun kodu ile raporla.
      if (bekleyenKod !== null && ciktiToplayici.bekleyenSatir > 0) komutBittiIsareti = true;
    }
    // Kabuk komutun bittiğini bildirdiyse sessizlik penceresini BEKLEME:
    // gerçek sınır bu. Tahmini zamanlayıcı yalnızca entegrasyon yoksa çalışır.
    // Entegrasyon canlıysa YALNIZCA kabuk işaretiyle boşalt (azami bekleyiş
    // güvenlik freni hâlâ geçerli: hiç bitmeyen bir süreç Orion'u kör bırakmaz).
    const blok = komutBittiIsareti
      ? ciktiToplayici.zorlaTopla()
      : kabukEntegrasyonu
        ? ciktiToplayici.azamiBekleyistenTopla(msSimdi)
        : ciktiToplayici.topla(msSimdi);
    if (komutBittiIsareti) komutBittiIsareti = false;

    // Sessiz başarı: blok yok ama haber var.
    if (sessizBitisBekliyor && !blok) {
      sessizBitisBekliyor = false;
      const sure = bekleyenSure;
      const kodu = bekleyenKod ?? undefined;
      bekleyenKod = null; bekleyenSure = undefined;
      console.log(`[KABUK] sessiz basari: kod=${kodu ?? "?"} sure=${sure ?? "?"}ms`);
      kopru.algi({ tur: "terminal", kuyruk: "(komut çıktı üretmedi)", kesildi: false, kod: kodu });
    }

    if (blok) {
      // Kod ve süre ÖNCE alınır: süzgeç kararını da algı da aynı değerleri
      // kullanmalı, yoksa logdaki gerekçe ile beyne giden şey ayrışır.
      const kod = bekleyenKod ?? undefined;
      const sure = bekleyenSure;
      bekleyenKod = null;
      bekleyenSure = undefined;
      sessizBitisBekliyor = false;

      const gecti = refleks.karar({
        tur: "terminal", kod, sureMs: sure,
        ozet: `Terminal çıktısı:\n${blok}`,
      });
      console.log(`[ALGI] terminal blok (${blok.split("\n").length} satir) -> terfi=${gecti.terfi} (${gecti.gerekce})`);
      const kanca = (window as unknown as { _goruKanca?: (b: string, t: boolean) => void })._goruKanca;
      if (kanca) kanca(blok, gecti.terfi);
      kopru.algi({ tur: "terminal", kuyruk: blok, kesildi: kesildiMi(blok), kod });
    }
  }

  if (orion) {
    const d = oyuncu.oyuncuDurumu();
    const a = orion.durum();
    const mesgul =
      d.etkilesim === "monitor" ||
      (kopru?.dusunuyorMu ?? false) ||
      a.poz === "yürüyor" || a.poz === "koşuyor";
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
let ipucuMetin = "";
EtkilesimOlaylari.dinle("ipucu", (i) => { ipucuMetin = i?.metin ?? ""; });

function altyaziGoster(metin: string, ms = 2200): void {
  altyazi.textContent = metin;
  altyazi.dataset.gorunur = "1";
  clearTimeout(altyaziZaman);
  altyaziZaman = setTimeout(() => { altyazi.dataset.gorunur = "0"; }, ms);
}
let altyaziZaman: ReturnType<typeof setTimeout>;

EtkilesimOlaylari.dinle("basladi", (o) => {
  altyaziGoster(`${o.capa} · ${o.eylem} — çıkmak için Esc`);
  console.log(`[etkilesim] basladi capa=${o.capa} eylem=${o.eylem} t=${o.t.toFixed(2)}`);
  // `E` ile YÜZEYE GEÇ. Tek tablo (`YUZEY_GECISI`) hem `E`yi hem odaktaki
  // tıklamayı besliyor: iki giriş yolu aynı davranışı vermeli, yoksa "E ile
  // açılıyor ama tıklayınca açılmıyor" gibi keyfi bir fark doğar.
  //
  // Eskiden yalnızca monitor ve admin bağlıydı: zihin duvarındaki panellere
  // `E` basmak etkileşim başlatıyor ama EKRANDA HİÇBİR ŞEY OLMUYORDU.
  void YUZEY_GECISI[o.capa]?.();
});
EtkilesimOlaylari.dinle("bitti", (o) => {
  altyaziGoster("etkileşim kapandı");
  console.log(`[etkilesim] bitti capa=${o.capa}`);
  // Terminaller klavye odağını da bırakmalı; paneller için kamera yeter.
  if (o.capa === "monitor") monitordenCik();
  else if (o.capa === "admin") admindenCik();
  else if (o.capa in YUZEY_GECISI) rig.odakBirak();
});

/**
 * Monitöre geçiş.
 *
 * Kamerayı ekrana YAKLAŞTIRIYORUZ çünkü ölçüldü: 1.5 m'den 80×24 terminal
 * hücre başına 4.4 piksel düşüyor ve okunmuyor — bu fiziksel bir sınır,
 * gerçek hayatta da okunmaz. ~0.6 m'de hücre başına ~11 piksel, rahat okunur.
 */
async function monitoreGec(): Promise<void> {
  adminTerminal.odaklan(false);   // iki terminale birden yazılmaz
  const ekranNoktasi = oda.monitorEkran.getAbsolutePosition();
  // Odak kipi (sinematik DEĞİL): fare oynayınca bozulmaz, yalnızca Esc çözer.
  // 0.95 m: 0.62'de ekran çerçeveyi taşıyordu, bütün ekran görünsün.
  rig.odakKilitle(ekranNoktasi, 0.95, 0.05);
  if (!monitor.acikMi()) {
    try { await monitor.ac(); }
    catch (e) { console.error("[monitor] açılamadı:", e); altyaziGoster("terminal açılamadı"); return; }
  }
  monitor.odaklan(true);
  altyaziGoster("terminal açık — `claude` yazabilirsin · Esc ile çık", 3200);
}

/**
 * Yönetim terminaline geçiş.
 *
 * Monitörle aynı desen ama AYRI: ikisi farklı pty, farklı kamera hedefi ve
 * farklı amaç. Aynı anda ikisine birden odaklanmak anlamsız olurdu, bu yüzden
 * biri açılırken diğerinin odağı bırakılır.
 */
async function admineGec(): Promise<void> {
  monitor.odaklan(false);
  // Ekranın KENDİ normali boyunca konumlan: admin monitörü masada açılı.
  // CreatePlane'in varsayılan normali -Z olduğu için yön oradan türetilir.
  const yon = oda.adminEkran.getDirection(new Vector3(0, 0, -1));
  // 0.85 m: 0.62'de ekran çerçeveyi taşıyordu (ölçüm: ekran görüntüsü).
  rig.odakKilitle(oda.adminEkran.getAbsolutePosition(), 0.85, 0.04, yon);
  if (!adminTerminal.acikMi()) {
    try { await adminTerminal.ac(); }
    catch (e) {
      console.error("[admin] açılamadı:", e);
      altyaziGoster("yönetim terminali açılamadı");
      gunluk.ekle("hata", "admin", `terminal açılamadı: ${e instanceof Error ? e.message : e}`);
      return;
    }
    gunluk.ekle("bilgi", "admin", "yönetim terminali açıldı");
  }
  adminTerminal.odaklan(true);
  altyaziGoster("yönetim terminali — Orion burayı GÖRMÜYOR · Esc ile çık", 3200);
}

function admindenCik(): void {
  adminTerminal.odaklan(false);
  rig.odakBirak();
}

// ── ODAKTA TIKLAMA: yüzeyler arası geçiş ──────────────────────────────────
//
// İstek: "terminale veya ofisteki bir panele gelince mouse kullanılabilir,
// objeleri seçebilir, düzgün bir kullanıma dönüşecek."
//
// Odaktayken imleç zaten serbest (bkz. kamera.ts fare kipi). Burada o imlece
// işlev veriliyor: bir yüzeye tıklamak oraya geçirir — masaüstünde pencereler
// arasında tıklamak gibi. Odaktan çıkmadan ekranlar arasında dolaşabilirsin.
//
// GEZİNİRKEN bu çalışmaz: orada tıklamanın işi kamerayı ele almak ve yüzeye
// `E` ile yaklaşılır. İki kipte tek tuşa iki anlam yüklemek karışıklık olurdu.

/** Tıklanabilir yüzeyler ve oraya nasıl geçileceği. */
const YUZEY_GECISI: Record<string, () => void | Promise<void>> = {
  monitor: () => monitoreGec(),
  admin: () => admineGec(),
  sema: () => panelOdak(oda.semaYuzey, "beyin şeması"),
  gunluk: () => panelOdak(oda.gunlukYuzey, "beyin günlüğü"),
  tahta: () => panelOdak(oda.tahtaYuzey, "beyaz tahta"),
};

/**
 * Salt-okunur bir panele odaklan (şema, günlük, tahta).
 *
 * Terminallerden farklı: klavye girişi yok, yalnızca kamera. Yüzeyin KENDİ
 * normali kullanılır — duvara asılı paneller için "oda ortasına doğru"
 * varsayımı yanlış çerçeveliyordu (yönetim terminalinde ölçülmüştü).
 */
function panelOdak(mesh: { getAbsolutePosition(): Vector3; getDirection(v: Vector3): Vector3 },
                   etiket: string): void {
  monitor.odaklan(false);
  adminTerminal.odaklan(false);
  // CreatePlane'in yüzey normali -Z; mesh döndürülmüş olsa da bu doğru yönü verir.
  const yon = mesh.getDirection(new Vector3(0, 0, -1));
  rig.odakKilitle(mesh.getAbsolutePosition(), 1.15, 0.02, yon);
  altyaziGoster(`${etiket} — Esc ile çık`, 2400);
}

// Tıklanabilirlik GÖRÜNÜR olmalı: gizli davranış "düzgün kullanım" değildir.
// Odaktayken imlecin altındaki yüzey tıklanabilirse imleç `pointer` olur ve
// hangi yüzey olduğu altyazıda yazar. Gezinirken bu hiç çalışmaz — orada
// imleç zaten kilitli ve tıklamanın işi kamerayı ele almak.
let sonVurgu: string | null = null;
let vurguSaat = 0;

tuval.addEventListener("mousemove", (e) => {
  if (!rig.odakta) {
    if (sonVurgu) { tuval.style.cursor = ""; sonVurgu = null; }
    return;
  }
  // Işın testi her fare olayında değil, ~60 ms'de bir: fare olayları 100+ Hz
  // gelebiliyor ve her birinde 60 mesh taramak boşa iş.
  const simdi = performance.now();
  if (simdi - vurguSaat < 60) return;
  vurguSaat = simdi;

  const p = sahne.pick(e.offsetX, e.offsetY);
  const capa = (p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa;
  const tiklanabilir = capa && capa in YUZEY_GECISI ? capa : null;
  if (tiklanabilir === sonVurgu) return;

  sonVurgu = tiklanabilir;
  tuval.style.cursor = tiklanabilir ? "pointer" : "";
  if (tiklanabilir) {
    const c = capaBul(tiklanabilir);
    altyaziGoster(`${c?.etiket ?? tiklanabilir} — tıkla`, 1600);
  }
});

tuval.addEventListener("click", (e) => {
  // Gezinirken tıklama kamerayı ele alır (kamera.ts); burası yalnızca odak kipi.
  if (!rig.odakta) return;
  const p = sahne.pick(e.offsetX, e.offsetY);
  const capa = (p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa;
  if (!capa) return;
  const gec = YUZEY_GECISI[capa];
  if (!gec) return;
  console.log(`[TIKLAMA] ${capa} yuzeyine geciliyor`);
  void gec();
});

/** Esc: klavye dünyaya döner, kamera serbest kalır. Terminal AÇIK kalır —
 *  çalışan bir claude oturumu masadan kalkınca ölmemeli. */
function monitordenCik(): void {
  monitor.odaklan(false);
  rig.odakBirak();
}

// ── HUD: K1 ve K2 ölçümleri ekranda. "Sanırım hızlı" yerine sayı. ─────────
setInterval(() => {
  const hz = saat.olculenHz;
  const d = oyuncu.oyuncuDurumu();
  hud.textContent =
    `FPS ${motor.getFps().toFixed(0)}  |  tik ${hz.toFixed(2)} Hz (hedef ${TIK_HZ})  ` +
    `|  tik# ${mantikTik}  |  atlanan ${saat.atlanan}\n` +
    `kamera ${rig.mod === "omuz" ? "3.şahıs (F: 1.şahıs)" : "1.şahıs (F: 3.şahıs)"}  ` +
    `|  fare ${rig.odakta ? (rig.fareKamerada ? "KAMERA (Ctrl)" : "imleç serbest") : (rig.fareKamerada ? "kamera" : "kamera — tuvale tıkla")}  ` +
    `|  gövde ${oyuncu.govdeUzakligi.toFixed(2)}m ${oyuncu.govde.isVisible ? "görünür" : "GİZLİ"}  ` +
    `|  konum ${d.konum.x.toFixed(1)},${d.konum.z.toFixed(1)}  ` +
    `|  mesh ${oda.meshler.length}  |  çapa ${tumCapalar().length}\n` +
    (ipucuMetin ? ipucuMetin : "WASD yürü · Shift koş · fare bak · F kamera · E terminal (orada: imleç serbest, Ctrl+fare bak) · T Orion'a yaz · Esc çık");
}, 250);

// ── Demo kancası (T7): sinematik çekim konsoldan tetiklenebilsin ───────────
// `window.dunya.sinematik("tahta")` → kamera tahtayı çerçeveler.
// Bu bir DEBUG yüzeyi; protokol değil, köprü değil.
(window as unknown as { dunya: unknown }).dunya = {
  sinematik(capa: string, sure = 4): boolean {
    const k = capaKonumu(capa);
    if (!k) { console.warn(`[dunya] bilinmeyen çapa: ${capa}. Geçerli: ${capaAdlari().join(", ")}`); return false; }
    rig.sinematikBak(k, 2.6, 0.7, sure);
    return true;
  },
  oyuncuDurumu: () => oyuncu.oyuncuDurumu(),
  capalar: capaAdlari,

  /**
   * Orion'a elle niyet gönder — T4 (köprü) gelene kadar deneme yüzeyi.
   * Örnek: dunya.niyet("git", { hedef: { tip: "capa", ad: "tahta" } })
   * Doğrulama ATLANMAZ: protokolün kendi doğrulayıcısından geçer.
   */
  niyet(tur: string, govde: Record<string, unknown> = {}): string {
    if (!orion) return "avatar henüz hazır değil";
    const d = niyetDogrula({ ...govde, tur });
    if (!d.ok) { console.warn(`[niyet] reddedildi: ${d.hata}`); return d.hata; }
    const id = `elle_${Date.now().toString(36)}`;
    niyetiYurut(d.deger, id);
    return id;
  },
  orionDurumu: () => orion?.durum() ?? null,
  tahta: {
    yaz: (m: string, temizle = false) => tahta.yaz(m, temizle),
    sil: () => tahta.sil(),
    satirlar: () => tahta.satirlar(),
    olcu: () => tahta.olcu(),
  },
  terminal: {
    ac: () => monitoreGec(),
    kapat: () => { monitor.kapat(); rig.odakBirak(); },
    kuyruk: (n?: number) => monitor.kuyruk(n),
  },
};

// ── Hızlı deneme tuşları (1-6) ────────────────────────────────────────────
// Terminal odaktayken devre dışı: orada rakamlar kabuğa gitmeli.
const HIZLI_NIYETLER: Record<string, [string, Record<string, unknown>]> = {
  "1": ["git",  { hedef: { tip: "capa", ad: "tahta" } }],
  "2": ["git",  { hedef: { tip: "capa", ad: "pencere" } }],
  "3": ["otur", {}],
  "4": ["kalk", {}],
  "5": ["bak",  { hedef: { tip: "oyuncu" } }],
  "6": ["jest", { jest: "el_salliyor" }],
};
addEventListener("keydown", (e) => {
  const d = oyuncu.oyuncuDurumu();
  if (d.etkilesim === "monitor") return;  // terminal odakta
  const n = HIZLI_NIYETLER[e.key];
  if (!n || !orion) return;
  const sonuc = (window as unknown as { dunya: { niyet(t: string, g?: Record<string, unknown>): string } })
    .dunya.niyet(n[0], n[1]);
  altyaziGoster(`Orion: ${n[0]} ${JSON.stringify(n[1]).slice(0, 40)}`, 1600);
  console.log(`[hizli] ${e.key} → ${n[0]} (${sonuc})`);
});

// ── Entegrasyon duman testi: terminal gerçekten açılıyor mu? ───────────────
// Kullanıcı E'ye bastığında çalışacağını ELDEN ÖNCE kanıtlar.
if (new URLSearchParams(location.search).has("terminaldene")) {
  void (async () => {
    try {
      await monitoreGec();
      await new Promise((r) => setTimeout(r, 1400));
      window.kopru; // köprü hazır olmalı
      const yaz = (m: string) => document.dispatchEvent(
        new KeyboardEvent("keydown", { key: m, bubbles: true }));
      for (const ch of "echo ORION ENTEGRASYON") yaz(ch);
      yaz("Enter");
      await new Promise((r) => setTimeout(r, 1200));
      console.log("[TERMDENE] acik=" + monitor.acikMi());
      for (const satir of monitor.kuyruk(8).split(String.fromCharCode(10))) {
        if (satir.trim()) console.log("[TERMDENE] | " + satir);
      }
    } catch (e) {
      console.error("[TERMDENE] hata:", e);
    }
  })();
}



// ── BEYİN: Orion kendi kararıyla dünyada eylemde bulunur ──────────────────
// Köprü dünyayı da beyni de import etmez; ikisini burada bağlıyoruz.
// Yerel model odadaki varlıktan sorumlu; ağır iş terminaldeki Claude'a gider.
const girdi = new MetinGirdi();
let kopru: Kopru | null = null;

function dunyaDurumuMetni(): string {
  const o = oyuncu.oyuncuDurumu();
  const a = orion?.durum();
  return [
    a ? `Sen: ${a.poz}, konum ${a.konum.x.toFixed(1)},${a.konum.z.toFixed(1)}${a.oturuyor_mu ? ", oturuyorsun" : ""}.` : "",
    `Ozyn ${o.mesafe?.toFixed?.(1) ?? "?"}m uzakta${o.bakiyor ? ", sana bakiyor" : ""}.`,
    o.etkilesim === "monitor" ? "Ozyn senin monitorunde calisiyor." : "",
  ].filter(Boolean).join(" ");
}

function beyniBagla(a: Avatar): void {
  // ORION_MODEL secimi: olcum duzenegi ayni kalsin, yalnizca beyin degissin.
  // Boylece model karsilastirmasi TEK degiskenli olur.
  // ── SOL LOB: düşünce beyni (OpenCode) ───────────────────────────────────
  //
  // Yerel `qwen2.5:7b` ÖLÇÜMLE elendi: ham sınavda 1/4, hatırlama 0/6, terminal
  // hatasında yanlış teşhis. Aynı üç senaryo Ling 3.0 Flash VL ile geçti.
  // Bedel: 858 ms → ~3.5 sn. Bu yüzden yalnızca DÜŞÜNCE buraya taşındı;
  // beden refleksleri yerel ve kuralcı kaldı (bkz. docs/specs/02-beyin-mimarisi.md).
  //
  // YEDEK MODEL YOK — bilinçli. OpenCode kapalıysa sessizce aptallaşmak yerine
  // "düşüncem kapalı" deyip KURALLI VARLIK kipinde kalır: hareket eder, tepki
  // verir, süzer. Dürüst bozulma sessiz bozulmadan iyidir.
  // SAĞLAYICI DEĞİŞİMİ KOD DEĞİŞİKLİĞİ GEREKTİRMEZ.
  //
  // Önce yalnızca `model` ayarlanabiliyordu; `providerID` kodda sabitti.
  // "Sağlayıcıyı değiştirmek tek satır" demek bu hâliyle DOĞRU DEĞİLDİ —
  // OpenRouter kotası dolduğunda NVIDIA'ya geçmek dosya düzenlemek demekti.
  // Artık üçü de dışarıdan verilir; ölçüm düzeneği aynı kalır, beyin değişir.
  const q = new URLSearchParams(location.search);

  // BEYİN SEÇİMİ — `Beyin` üç metotluk bir arayüz; kim uyguladığı önemsiz.
  //
  // `?beyin=dis` başka bir DİLDE yazılmış beyne bağlanır (bkz. disBeyin.ts,
  // örnek: `tools/ornek-beyin.py`). Python/Go/Rust fark etmez — dünya, köprü
  // ve protokol hiçbir şey bilmez. Ayrım baştan böyle kurulmuştu; burası
  // yalnızca hangi uygulamanın kullanılacağını seçer.
  const beyin: Beyin = q.get("beyin") === "dis"
    ? new DisBeyin({
        adres: q.get("beyinadres") || undefined,
        zamanAsimiMs: 10_000,
      })
    : new OpenCodeBeyni({
        providerID: q.get("saglayici") || "openrouter",
        modelID: q.get("model") || "inclusionai/ling-3.0-flash-vl:free",
        adres: q.get("opencode") || undefined,
        sifre: q.get("sifre") || undefined,
        zamanAsimiMs: 30_000,
      });

  // KAYIT: `?kayit=1` ile her tur `[BEYIN:KAYIT] {json}` olarak günlüğe düşer.
  // Sonra `tools/beyin-ayikla.mjs` fixture üretir, `tools/beyin-tekrar.ts`
  // onları sahne olmadan istediğin beyne oynatır — Python'da beyin yazarken
  // asıl geliştirme döngün bu olmalı.
  const beyinKayitli: Beyin = q.has("kayit") ? new KayitBeyni(beyin) : beyin;
  if (q.has("kayit")) console.log("[KAYIT] beyin turlari gunluge yaziliyor");

  /**
   * Devre kesici YALNIZCA OpenCode beyninde var (sağlayıcı kotası ona özgü).
   * Arayüze eklemek uygulama ayrıntısını sözleşmeye sızdırmak olurdu; onun
   * yerine burada tip koruması ile sorulur.
   */
  const kesikSn = (): number => beyin instanceof OpenCodeBeyni ? beyin.kesikSaniye : 0;
  console.log(`[BEYIN] ${beyin.ad}`);
  sema.not("beyin", beyin.ad.replace(/^opencode:/, "").split("/").pop() ?? beyin.ad);
  gunluk.ekle("bilgi", "beyin", `sol lob bağlandı: ${beyin.ad}`);
  sema.durumYaz("beyin bağlı, algı bekleniyor");

  // Devre kesik olduğu sürece şemada GÖRÜNSÜN: sessizce beklemek, arızanın
  // kendisinden beter. Sayaç saniye saniye iner.
  setInterval(() => {
    const kalan = kesikSn();
    if (kalan > 0) {
      sema.ariza("beyin", true, `kesik ${kalan} sn`);
      sema.durumYaz(`düşünce kapalı — ${kalan} sn sonra yeniden denenecek`);
    }
  }, 1000);
  kopru = new Kopru({
    beyin: beyinKayitli,
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
    sabitBilgi: () => `Odadaki çapalar: ${tumCapalar().map((c) => c.ad).join(", ")}.`,
    toplamaMs: 900,
    // Ölçüm için ayarlanabilir: kısa pencere hipotezi (anı, alakasız sohbetin
    // altında gömülüyor mu?) tek değişkenle sınanabilsin.
    gecmisSiniri: Number(new URLSearchParams(location.search).get("gecmis") ?? 12) || 12,
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
      const k = refleks.karar({
        ozet, tur: a.tur,
        kod: a.tur === "terminal" ? a.kod : undefined,
      });
      sema.vur(k.terfi ? "dikkat" : "refleks", k.terfi ? "" : "süzüldü");
      return k.terfi;
    },
    metinDinle: (metin, aracVarMi) => { if (!aracVarMi) davranisKayit()?.duyulmayan(metin); },
    // Şemanın bulut lobu: düşünme başladı/bitti ve hafıza getirimi.
    asamaDinle: (asama, not) => {
      if (asama === "beyin") { sema.vur("beyin", "düşünüyor…"); sema.durumYaz("düşünüyor"); return; }
      if (asama === "beyin:bitti") {
        sema.vur("beyin", not ?? "");
        sema.durumYaz(`son düşünce ${not ?? "?"}`);
        return;
      }
      sema.vur(asama, not);
    },
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
  girdi.dinle((t) => {
    if (!t.kesin) return;
    altyaziGoster(`sen: ${t.metin}`, 2000);
    kopru?.algi({ tur: "duydum", metin: t.metin, kesin: true });
  });

  void beyin.hazirMi().then((h) => {
    console.log(`[BEYIN] ${beyin.ad} hazir=${h}`);
    if (!h) {
      // Sessiz bozulma YOK: kullanıcı neyin kapalı olduğunu bilsin.
      console.warn("[BEYIN] OpenCode sunucusu yok (opencode serve). KURALLI VARLIK kipi: " +
        "Orion hareket eder ve tepki verir ama düşünemez.");
      altyaziGoster("Düşüncem şu an kapalı — `opencode serve` çalışmıyor", 5000);
    }
  });
}

// ── Sohbet kutusu: T aç, Enter gönder, Esc kapat ──────────────────────────
const sohbet = document.getElementById("sohbet") as HTMLDivElement;
const sohbetGirdi = document.getElementById("sohbetGirdi") as HTMLInputElement;

function sohbetAc(acik: boolean): void {
  sohbet.dataset.acik = acik ? "1" : "0";
  if (acik) sohbetGirdi.focus();
  else { sohbetGirdi.blur(); sohbetGirdi.value = ""; }
}

addEventListener("keydown", (e) => {
  const acikMi = sohbet.dataset.acik === "1";
  if (!acikMi && (e.key === "t" || e.key === "T")) {
    if (oyuncu.oyuncuDurumu().etkilesim === "monitor") return;  // terminaldeyken T yazıdır
    e.preventDefault();
    sohbetAc(true);
    return;
  }
  if (!acikMi) return;
  if (e.key === "Escape") { sohbetAc(false); return; }
  if (e.key === "Enter") {
    const m = sohbetGirdi.value.trim();
    sohbetGirdi.value = "";
    if (m) girdi.gonder(m);
    sohbetAc(false);
  }
});

// ── Otomatik entegrasyon denemesi (?otodene=1) ─────────────────────────────
// Ozyn'in elle bulduğu üç hatayı bir daha geri gelmesinler diye kilitler.
// Gerçek klavye/fare olaylarıyla, gerçek sahnede koşar.
if (new URLSearchParams(location.search).has("otodene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const sonuclar: string[] = [];
    const kontrol = (ad: string, gecti: boolean, detay = "") =>
      sonuclar.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

    await bekle(1500);

    // 1) Orion GÖRSEL olarak hareket ediyor mu? (mantık değil, mesh)
    // TS, .then içindeki atamayı göremediği için orion'u null sanıyor; yerel al.
    const o = orion as Avatar | null;
    if (!o) { kontrol("avatar yuklendi", false); }
    else {
      const once = o.cizimKonumu();
      o.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "dene_git");
      await bekle(2500);
      const sonra = o.cizimKonumu();
      const yol = Math.hypot(sonra.x - once.x, sonra.z - once.z);
      kontrol("orion gorsel olarak hareket etti", yol > 0.5,
        `yol=${yol.toFixed(2)}m mantik=${o.durum().konum.x.toFixed(2)},${o.durum().konum.z.toFixed(2)}`);
    }

    // 2) Terminale gir — E tuşunun yaptığı akışın AYNISI: önce etkileşim
    //    yayıcıya kaydolur, sonra monitöre geçilir. (Doğrudan monitoreGec()
    //    çağırmak gerçek akışı atlar ve Esc'in kapatacağı bir şey kalmaz.)
    EtkilesimOlaylari.baslat({
      capa: "monitor", eylem: "odaklan", t: saat.t,
      kaynak: oyuncu.oyuncuDurumu().konum,
    });
    await bekle(900);
    const odakOnce = rig.odakta;
    for (let i = 0; i < 10; i++) {
      dispatchEvent(new MouseEvent("mousemove", { movementX: 40, movementY: 25, bubbles: true }));
    }
    await bekle(300);
    kontrol("fare oynayinca terminal odagi korunuyor", odakOnce && rig.odakta,
      `odakOnce=${odakOnce} odakSonra=${rig.odakta}`);

    // 3) TEXTAREA odaktayken Esc dunyaya ulasiyor mu? (hapsolma hatasi)
    const sahteAlan = document.createElement("textarea");
    document.body.appendChild(sahteAlan);
    sahteAlan.focus();
    sahteAlan.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    await bekle(400);
    kontrol("TEXTAREA odaktayken Esc cikis yapiyor",
      !rig.odakta && oyuncu.oyuncuDurumu().etkilesim === null,
      `odak=${rig.odakta} etkilesim=${oyuncu.oyuncuDurumu().etkilesim ?? "-"}`);
    sahteAlan.remove();

    // 4) Cikis sonrasi yurume yeniden calisiyor mu?
    const yurumeOnce = oyuncu.oyuncuDurumu().konum;
    dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w", bubbles: true }));
    await bekle(700);
    dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", key: "w", bubbles: true }));
    const yurumeSonra = oyuncu.oyuncuDurumu().konum;
    const gidilen = Math.hypot(yurumeSonra.x - yurumeOnce.x, yurumeSonra.z - yurumeOnce.z);
    kontrol("cikistan sonra oyuncu yeniden yuruyor", gidilen > 0.1, `yol=${gidilen.toFixed(2)}m`);

    for (const r of sonuclar) console.log("[OTODENE] " + r);
    console.log("[OTODENE] ozet: " +
      sonuclar.filter((r) => r.startsWith("GECTI")).length + "/" + sonuclar.length);
  })();
}

// ── "Orion görüyor mu?" canlı kanıtı (?gorudene=1) ────────────────────────
// T6b'nin asıl iddiasını kilitler: Orion masasındaki terminali GÖRÜYOR ve
// gürültüyü görmezden geliyor. Sentetik klavye olayları yerine pty'ye
// DOĞRUDAN yazılır — terminaldene'de tuşlar xterm'in girdi yoluna ulaşmıyordu.
if (new URLSearchParams(location.search).has("gorudene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const sonuc: string[] = [];
    const kontrol = (ad: string, gecti: boolean, detay = "") =>
      sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

    const gorulen: { blok: string; terfi: boolean }[] = [];
    (window as unknown as { _goruKanca?: (b: string, t: boolean) => void })._goruKanca =
      (blok, terfi) => { gorulen.push({ blok, terfi }); };

    await bekle(1200);
    await monitoreGec();
    await bekle(1800);
    // Kabuk PowerShell'e geçince `-NoLogo` yüzünden açılış afişi KALMADI,
    // yani sınanacak bir "afiş bloğu" yok. Doğru soru zaten şuydu: açılış
    // beyni gereksiz yere uyandırıyor mu? Blok çıkmaması da geçerli cevaptır.
    kontrol("acilista gereksiz terfi yok",
      gorulen.every((g) => !g.terfi),
      `blok=${gorulen.length} terfi=${gorulen.filter((g) => g.terfi).length}`);
    const afisSonrasi = gorulen.length;

    // DİKKAT: pty ev dizininde açılır, proje dizininde değil. İlk sürümde
    // burada `dir /b node_modules` vardı; ev dizininde o klasör YOK, komut
    // "File Not Found" ile başarısız oluyordu ve süzgeç onu haklı olarak
    // terfi ettiriyordu. Test yanlıştı, süzgeç değil — komut gerçekten
    // BAŞARILI ve rutin olmalı.
    monitor.yaz("dir\r");
    await bekle(3000);
    const rutin = gorulen.slice(afisSonrasi);
    kontrol("rutin dizin listesi beyni uyandirmadi",
      rutin.length > 0 && rutin.every((g) => !g.terfi), `blok=${rutin.length}`);
    const rutinSonrasi = gorulen.length;

    monitor.yaz("boyle_bir_komut_yok\r");
    await bekle(3000);
    const hatali = gorulen.slice(rutinSonrasi);
    kontrol("gercek kabuk hatasi Orion'a ULASTI",
      hatali.some((g) => g.terfi),
      `blok=${hatali.length} terfi=${hatali.filter((g) => g.terfi).length}`);

    for (const r of sonuc) console.log("[GORUDENE] " + r);
    // TS, atamayı .then içinde göremediği için kopru'yu null sanıyor;
    // otodene'deki `orion` ile aynı kalıp: yerel olarak tipe geri al.
    const k = kopru as Kopru | null;
    console.log(`[GORUDENE] sayac=${JSON.stringify(k?.sayac() ?? null)}`);
    console.log("[GORUDENE] ozet: " +
      sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
  })();
}

// ── SESSIZ BASARI denemesi (?sessiz=1) ────────────────────────────────────
// OSC 133'un asil kazanimini kanitlar: cikti URETMEYEN ama zaman alan bir
// komut bittiginde Orion bunu BILIR. Kod+sure olmadan bu bilgi tamamen
// gorunmezdi (`tsc --noEmit` temiz gecince 0 satir yazar).
if (new URLSearchParams(location.search).has("sessizdene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const gorulen: { ozet: string; terfi: boolean }[] = [];
    (window as unknown as { _goruKanca?: (b: string, t: boolean) => void })._goruKanca =
      (b, t) => { gorulen.push({ ozet: b, terfi: t }); };

    await bekle(1200);
    await monitoreGec();
    await bekle(1500);
    const basta = gorulen.length;

    // 1) ANLIK ve sessiz: bildirilmemeli.
    monitor.yaz("$null = 1\r");
    await bekle(2500);
    const anlik = gorulen.slice(basta);
    console.log(`[SESSIZDENE] anlik sessiz komut: blok=${anlik.length} terfi=${anlik.filter((g) => g.terfi).length} (beklenen 0 terfi)`);
    const ortada = gorulen.length;

    // 2) UZUN ve sessiz: bildirilmeli. Start-Sleep cikti uretmez.
    monitor.yaz("Start-Sleep -Milliseconds 1600\r");
    await bekle(4000);
    const uzun = gorulen.slice(ortada);
    console.log(`[SESSIZDENE] uzun sessiz komut: blok=${uzun.length} terfi=${uzun.filter((g) => g.terfi).length} (beklenen >=1 terfi)`);
    const k = kopru as Kopru | null;
    console.log(`[SESSIZDENE] sayac=${JSON.stringify(k?.sayac() ?? null)}`);
  })();
}

// ── DAVRANIS olcumu (?davranis=1) ─────────────────────────────────────────
// "Hat calisiyor" ile "davranis iyi" ayni sey degil. Gorudene borunun
// baglandigini kanitladi; bu, Orion'un gordugu seye NE YAPTIGINI olcer.
if (new URLSearchParams(location.search).has("davranis")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const defter = new DavranisDefteri();
    const kayit = defter.kayit();
    (window as unknown as { _davranisKayit?: unknown })._davranisKayit = kayit;

    const sonuclar: { sonuc: SenaryoSonucu; konusmaBekleniyor: boolean; beklenenKelimeler?: readonly string[] }[] = [];
    async function senaryo(ad: string, konusmaBekleniyor: boolean, hazirla: () => void, bekleMs: number,
                           beklenenKelimeler?: readonly string[]) {
      defter.sifirla();
      const t0 = performance.now();
      hazirla();
      await bekle(bekleMs);
      sonuclar.push({ sonuc: defter.topla(ad, performance.now() - t0), konusmaBekleniyor, beklenenKelimeler });
    }

    await bekle(1500);
    await monitoreGec();
    await bekle(1500);

    // 1) Ozyn dogrudan konusuyor -> Orion MUTLAKA cevap vermeli.
    await senaryo("Ozyn selam veriyor", true,
      () => { kopru?.algi({ tur: "duydum", metin: "Orion, selam. Orada misin?", kesin: true }); }, 22000);

    // 2) Masadaki terminalde GERCEK hata -> Orion fark edip soylemeli.
    await senaryo("terminalde gercek hata", true,
      () => { monitor.yaz("boyle_bir_komut_yok\r"); }, 22000,
      // Konu ilgisi denetimi: cevap gordugu hatayla ilgili mi?
      ["komut", "bulunamad", "tanin", "tanın", "hata", "calismad", "çalışmad", "terminal", "ekran"]);

    // 3) Rutin basarili komut -> Orion SUSMALI (konusmasi beklenmiyor).
    await senaryo("rutin basarili komut", false,
      () => { monitor.yaz("dir\r"); }, 12000);

    raporla(sonuclar);
  })();
}

// ── TEZ denemesi (?tezdene=1) ─────────────────────────────────────────────
// Projenin tezi: "AI'in oturdugu oda - terminalini onun masasinda aciyorsun."
// Bu deneme o tezin tamamini kosar:
//   Ozyn hatali komut yazar -> Orion EKRANDAN gorur -> duzeltme ONERIR ->
//   Ozyn onaylar -> komut calisir -> Orion sonucu gorur.
if (new URLSearchParams(location.search).has("tezdene")) {
  try { localStorage.setItem("beyinDokum", "1"); } catch { /* onemsiz */ }
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(2000);
    await monitoreGec();
    await bekle(1800);

    // Ozyn hatali bir komut yazar.
    monitor.yaz("gti status" + String.fromCharCode(13));
    await bekle(3000);

    // Orion'a durumu sor - gordugune gore oneri uretmeli.
    const kt = kopru as Kopru | null;
    kt?.algi({ tur: "duydum", kesin: true,
      metin: "ekranda ne oldu, duzeltmek icin bir komut onerir misin" });
    await bekle(18000);

    const b = onayKapisi.bekleyen;
    console.log(`[TEZDENE] oneri=${b ? `"${b.komut}" (${b.risk.seviye}) gerekce="${b.gerekce}"` : "YOK"}`);
    if (b) {
      onayKarari(true);
      await bekle(3500);
      const kuyruk = monitor.kuyruk(24).replace(/\s+/g, " ").slice(-160);
      console.log(`[TEZDENE] onay sonrasi ekran: ...${kuyruk}`);
    }
    console.log(`[TEZDENE] ${b ? "GECTI" : "KALDI"} Orion gordugune gore komut onerdi mi`);
    console.log(`[TEZDENE] kapi sayaci=${JSON.stringify(onayKapisi.sayac())}`);
  })();
}

// ── ONAY KAPISI denemesi (?onaydene=1) ────────────────────────────────────
// Dort iddiayi kanitlar:
//   1. Oneri ONAYSIZ calismaz (terminale hicbir sey gitmez)
//   2. Ret, komutu calistirmaz ve gerekce beyne geri doner
//   3. Onay, komutu GERCEKTEN calistirir
//   4. Bekleyen oneri EZILEMEZ
// ── ALGI HİZMETİ denemesi (?gordene=1) ────────────────────────────────────
// "Orion odayı görebiliyor mu?" sorusunun KANITI.
//
// Sınanan şey cevabın varlığı değil, KONUMA BAĞLI olması: aynı soru farklı
// yerlerden farklı cevap vermeli. Vermiyorsa görüş kısıtı sahtedir ve elimizde
// yalnızca süslenmiş bir veri dökümü var demektir.
if (new URLSearchParams(location.search).has("gordene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(2500);   // avatar yüklensin

    const sorular: Soru[] = ["onumde", "yakin", "oyuncu", "dunya"];
    const oku = () => sorular.map((q) => `${q}: ${algiSor(q).metin}`);
    // Bakış da ölçülür: `onumde` cevabı doğrudan buna bağlı, yani yanlış
    // görünen bir algı cevabı aslında yanlış BAKIŞ olabilir.
    const bakisOku = (): string => {
      const b = (orion as Avatar | null)?.durum().bakis;
      return b ? `${b.x.toFixed(2)},${b.z.toFixed(2)}` : "yok";
    };

    // 1) Masanın başında.
    niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "masa" } } as Niyet, "gor_1");
    await bekle(5000);
    const masada = oku();
    console.log(`[GORDENE] masada bakis=${bakisOku()}`);
    for (const r of masada) console.log(`[GORDENE] masada  ${r}`);

    // 2) Tahtanın önünde — odanın öbür ucu.
    niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "tahta" } } as Niyet, "gor_2");
    await bekle(4500);
    const varista = bakisOku();
    await bekle(9000);
    const sonra = bakisOku();
    console.log(`[GORDENE] bakis varista=${varista} 9sn-sonra=${sonra} `
      + `→ ${varista === sonra ? "SABIT" : "DEGISTI (boşta davranışı sürüyor)"}`);
    const tahtada = oku();
    for (const r of tahtada) console.log(`[GORDENE] tahtada ${r}`);

    const degisen = masada.filter((m, i) => m !== tahtada[i]).length;
    console.log(`[GORDENE] ${degisen > 0 ? "GECTI" : "KALDI"} `
      + `cevap konuma bagli (${degisen}/${sorular.length} soru degisti)`);

    // Bütçe denetimi: hiçbir cevap tavanını aşmamalı.
    const asan = sorular.filter((q) => algiSor(q).maliyet > BUTCE[q]);
    console.log(`[GORDENE] ${asan.length === 0 ? "GECTI" : "KALDI"} `
      + `butce tavani korundu${asan.length ? ` (asan: ${asan.join(",")})` : ""}`);
  })();
}

// ── YÖNETİM TERMİNALİ denemesi (?admindene=1) ─────────────────────────────
// Masadaki ikinci ekran gerçek bir kabuk mu, okunuyor mu, ve Orion'un algı
// hattına SIZIYOR MU? Son soru önemli: admin terminali bilerek köprüye bağlı
// değil; bağlanmış olsaydı her yönetim komutu Orion'a gürültü olurdu.
if (new URLSearchParams(location.search).has("admindene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(1800);
    const k0 = kopru as Kopru | null;
    const oncekiDusunme = k0?.sayac().dusunme ?? 0;
    await admineGec();
    await bekle(2500);

    adminTerminal.yaz("echo YONETIM-TERMINALI-CALISIYOR" + String.fromCharCode(13));
    await bekle(3000);

    const k = adminTerminal.kuyruk(14).replace(/\s+/g, " ");
    const gordu = k.includes("YONETIM-TERMINALI-CALISIYOR");
    console.log(`[ADMINDENE] ${gordu ? "GECTI" : "KALDI"} kabuk cikti uretti`);
    console.log(`[ADMINDENE] kuyruk: ...${k.slice(-120)}`);

    // SIZINTI denetimi: admin çıktısı Orion'un algı hattına girmemeli.
    const sonraDusunme = (kopru as Kopru | null)?.sayac().dusunme ?? 0;
    console.log(`[ADMINDENE] ${sonraDusunme === oncekiDusunme ? "GECTI" : "KALDI"} `
      + `admin cikisi Orion'a sizmadi (dusunme ${oncekiDusunme} -> ${sonraDusunme})`);
    console.log(`[ADMINDENE] ana monitor acik mi: ${monitor.acikMi()}`);
  })();
}

// ── ZİHİN DUVARI denemesi (?zihindene=1) ──────────────────────────────────
// İki paneli beyin olmadan sürer: çizim, yerleşim ve okunabilirlik gözle
// doğrulanabilsin. Sağlayıcı kotası doluyken de koşar — panellerin doğruluğu
// modele bağlı olmamalı.
if (new URLSearchParams(location.search).has("zihindene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(1200);
    // Kamerayı zihin duvarına çevir ki panel ekranda olsun.
    // İKİ paneli birden çerçevele: duvarın ortasına, geriden bak.
    rig.sinematikBak(new Vector3(4.9, 1.72, 0), 5.2, 0.15, 0);

    const tur = async (
      ozet: string, terfi: boolean, sure: string, niyet: string | null,
    ) => {
      sema.vur("algi", "terminal"); sema.vur("suzgec");
      gunluk.ekle("bilgi", "algi", ozet);
      await bekle(260);
      sema.vur(terfi ? "dikkat" : "refleks", terfi ? "" : "süzüldü");
      if (!terfi) { gunluk.ekle("bilgi", "suzgec", `süzüldü: ${ozet}`); return; }
      await bekle(200);
      sema.vur("hafiza", "2 anı");
      sema.vur("beyin", "düşünüyor…"); sema.durumYaz("düşünüyor");
      await bekle(900);
      sema.vur("beyin", sure); sema.durumYaz(`son düşünce ${sure}`);
      if (!niyet) { gunluk.ekle("bilgi", "beyin", "eylem üretmedi"); return; }
      await bekle(200);
      sema.vur("bakis", "onumde");
      sema.vur("niyet", niyet);
      gunluk.ekle("iyi", "orion", `${niyet} niyeti üretildi`);
      await bekle(200);
      sema.vur("beden", niyet);
    };

    await tur("npm bağımlılık ağacı yazdırıldı", false, "", null);
    await bekle(700);
    await tur("komut HATA ile bitti (kod 1): gti tanınmıyor", true, "3.4 sn", "soyle");
    await bekle(900);

    // Onay yolu
    sema.vur("onay", "bekliyor (okur)");
    gunluk.ekle("bilgi", "onay", "önerildi: git status — yazım hatası düzeltmesi");
    await bekle(1400);
    sema.vur("onay", "onaylandı");
    gunluk.ekle("iyi", "onay", "onaylandı (okur): git status");
    await bekle(1200);

    // Arıza yolu — kota senaryosu, canlıda yaşandığı gibi.
    sema.ariza("beyin", true, "kota doldu");
    sema.durumYaz("düşünce kapalı — sağlayıcı kotası doldu, kurallı kipte");
    gunluk.ekle("hata", "beyin", "sağlayıcı kotası doldu — APIError 429: free-models-per-day");
    await bekle(2000);

    // Toparlanma
    sema.vur("beyin", "8.6 sn");
    sema.durumYaz("düşünce geri geldi");
    gunluk.ekle("iyi", "beyin", "sağlayıcı yeniden yanıt veriyor");
    console.log(`[ZIHINDENE] gunluk satirlari=${gunluk.satirlar().length}`);
    console.log("[ZIHINDENE] bitti — panelleri gozle dogrula");
  })();
}

if (new URLSearchParams(location.search).has("onaydene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const sonuc: string[] = [];
    const kontrol = (ad: string, gecti: boolean, detay = "") =>
      sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

    await bekle(1800);
    await monitoreGec();
    await bekle(1800);

    // 1) Oneri sun — onaysiz hicbir sey calismamali.
    niyetiYurut({ tur: "komut", metin: "echo ONAY_DENEMESI_1", gerekce: "deneme" }, "k1");
    await bekle(1500);
    const kuyruk1 = monitor.kuyruk(24);
    kontrol("oneri ONAYSIZ calismadi",
      onayKapisi.durum === "bekliyor" && !kuyruk1.includes("ONAY_DENEMESI_1"),
      `kapi=${onayKapisi.durum}`);

    // 2) Bekleyen oneri EZILEMEZ.
    niyetiYurut({ tur: "komut", metin: "echo EZME_DENEMESI", gerekce: "ikinci" }, "k2");
    await bekle(400);
    kontrol("bekleyen oneri EZILMEDI",
      onayKapisi.bekleyen?.komut === "echo ONAY_DENEMESI_1",
      `bekleyen=${onayKapisi.bekleyen?.komut ?? "yok"}`);

    // 3) REDDET — calismamali.
    onayKarari(false);
    await bekle(1800);
    kontrol("ret komutu CALISTIRMADI",
      onayKapisi.durum === "bos" && !monitor.kuyruk(24).includes("ONAY_DENEMESI_1"),
      `sayac=${JSON.stringify(onayKapisi.sayac())}`);

    // 4) ONAYLA — calismali.
    niyetiYurut({ tur: "komut", metin: "echo ONAY_DENEMESI_2", gerekce: "deneme" }, "k3");
    await bekle(600);
    onayKarari(true);
    await bekle(3000);
    const kuyruk2 = monitor.kuyruk(24);
    kontrol("onay komutu CALISTIRDI", kuyruk2.includes("ONAY_DENEMESI_2"),
      `kuyrukta=${kuyruk2.includes("ONAY_DENEMESI_2")}`);

    for (const r of sonuc) console.log("[ONAYDENE] " + r);
    console.log(`[ONAYDENE] denetim izi=${JSON.stringify(onayKapisi.gecmis().map((g) => [g.karar, g.oneri.komut]))}`);
    console.log("[ONAYDENE] ozet: " + sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
  })();
}

// ── UCTAN UCA tahta denemesi (?tahtabeyin=1) ──────────────────────────────
// Zincirin tamami: Ozyn soyluyor -> beyin karar veriyor -> Orion yuruyor ->
// tahtaya yaziyor. Araclardan biri ilk kez GERCEK bir dunya izi birakiyor.
if (new URLSearchParams(location.search).has("tahtabeyin")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(2500);
    const k = kopru as Kopru | null;
    if (!k) { console.log("[TAHTABEYIN] KALDI kopru yok"); return; }

    k.algi({ tur: "duydum", kesin: true,
      metin: "tahtaya git ve 'suzgec bitti' yaz" });
    await bekle(20000);

    const satirlar = tahta.satirlar();
    const o = orion as Avatar | null;
    const konum = o?.durum().konum;
    console.log(`[TAHTABEYIN] orion konumu=${konum ? `${konum.x.toFixed(1)},${konum.z.toFixed(1)}` : "?"}`);
    for (const s of satirlar) console.log(`[TAHTABEYIN]   tahtada: "${s}"`);
    console.log(`[TAHTABEYIN] ${satirlar.length > 0 ? "GECTI" : "KALDI"} beyin tahtaya yazdirdi mi (satir=${satirlar.length})`);
  })();
}

// ── BAK denemesi (?bakdene=1) ─────────────────────────────────────────────
// Algı hizmeti canlıda ULAŞILABİLİR mi? Araç ve hizmet yazılmıştı ama satır
// sözleşmesinde karşılığı yoktu: model bakma isteğini ifade EDEMİYORDU.
// Bu deneme zincirin tamamını sınar: soru → BAK: satırı → dunya_sor → cevap.
if (new URLSearchParams(location.search).has("bakdene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(3000);
    const k = kopru as Kopru | null;
    k?.algi({ tur: "duydum", kesin: true, metin: "önünde ne var, bir bak bakalım" });
    await bekle(20000);
    console.log(`[BAKDENE] sayac=${JSON.stringify(k?.sayac())}`);
  })();
}

// ── TERMİNAL AÇISI denemesi (?acidene=1) ──────────────────────────────────
// Ozyn'in bildirdiği asıl şikayet: "1. şahıstayken terminale düzgün açıyla
// geçemiyorum, 3. şahısta iyi." Düzeltme testle doğrulandı ama GÖRSEL olarak
// doğrulanmadı. Bu kip iki modda da monitöre geçip ekran görüntüsü aldırır.
//   ?acidene=1        → 3. şahıs
//   ?acidene=1&fps=1  → 1. şahıs
if (new URLSearchParams(location.search).has("acidene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(1500);
    if (new URLSearchParams(location.search).has("fps")) {
      rig.modDegistir();
      await bekle(1200);
    }
    console.log(`[ACIDENE] mod=${rig.mod}`);
    await monitoreGec();
    await bekle(2500);
    monitor.yaz("echo ACI-DENEMESI" + String.fromCharCode(13));
    await bekle(2000);
    console.log(`[ACIDENE] odakta=${rig.odakta} mod=${rig.mod}`);
  })();
}

// ── SAĞ LOB denemesi (?saglobdene=1) ──────────────────────────────────────
// Tezin ikinci yarısı: sol lob ÖLÜYKEN Orion hâlâ işe yarıyor mu?
//
// Sağlayıcı kotası dolu olduğu için bu deneme şu an GERÇEK koşullarda koşuyor:
// beyin gerçekten kapalı, taklit yok.
if (new URLSearchParams(location.search).has("saglobdene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(2500);
    await monitoreGec();
    await bekle(1800);

    // Ozyn yazım hatası yapar. Sol lob kapalıysa sağ lob yakalamalı.
    monitor.yaz("gti status" + String.fromCharCode(13));
    await bekle(6000);

    const b = onayKapisi.bekleyen;
    console.log(`[SAGLOBDENE] oneri=${b ? `"${b.komut}" gerekce="${b.gerekce}"` : "YOK"}`);
    console.log(`[SAGLOBDENE] ${b && b.komut === "git" ? "GECTI" : "KALDI"} `
      + `sol lob kapaliyken duzeltme onerildi`);

    // Ve öneri ÇALIŞMADI: onay kapısı hâlâ bekliyor olmalı.
    console.log(`[SAGLOBDENE] ${onayKapisi.durum === "bekliyor" ? "GECTI" : "KALDI"} `
      + `oneri ONAYSIZ calismadi (durum=${onayKapisi.durum})`);
  })();
}

// ── SENARYO KİPİ denetimi (?senaryodene=1) ────────────────────────────────
// Susturmanın GERÇEKTEN işe yaradığını kanıtlar.
//
// Sorun normalde beyin niyet ürettiğinde çıkıyor; sağlayıcı kotası dolu
// olduğu için beyin şu an hiç konuşmuyor ve arıza GİZLİ. Bu yüzden çakışma
// burada YAPAY olarak üretilir: senaryo bir `git` başlatır, hemen ardından
// "beyin" gibi rakip bir `git` gönderilir.
//
// `?rakip=1` ile rakip niyet ZORLA gönderilir (susturmanın atlandığı durum),
// varsayılanda ise köprü yolundan gönderilir — susturma çalışıyorsa köprü
// zaten durmuştur ve hiçbir şey gelmez.
if (new URLSearchParams(location.search).has("senaryodene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(2200);
    const o = orion as Avatar | null;
    if (!o) { console.log("[SENARYODENE] KALDI avatar yok"); return; }

    const rakipZorla = new URLSearchParams(location.search).has("rakip");
    const kesilenler: string[] = [];
    o.sonucDinle((r) => {
      if (r.durum === "hata" && /kesildi|iptal/i.test(r.not ?? "")) kesilenler.push(r.niyet_id);
    });

    // Senaryonun niyeti: tahtaya git.
    niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "senaryo_git");
    await bekle(600);

    // Rakip: "beyin" pencereye gitmek istiyor.
    if (rakipZorla) {
      // Susturmayı ATLA: doğrudan avatara gönder — arızanın kendisi budur.
      o.niyet({ tur: "git", hedef: { tip: "capa", ad: "pencere" } }, "rakip_beyin");
    } else {
      // Normal yol: köprü üzerinden. Susturma çalışıyorsa buradan hiçbir
      // niyet çıkmaz, çünkü köprü durdurulmuştur.
      (kopru as Kopru | null)?.algi({ tur: "duydum", kesin: true, metin: "pencereye git" });
    }

    await bekle(7000);
    const k = o.durum().konum;
    const tahtada = Math.abs(k.x + 3.8) < 0.9;
    console.log(`[SENARYODENE] rakipZorla=${rakipZorla} konum=${k.x.toFixed(1)},${k.z.toFixed(1)} `
      + `kesilen=${kesilenler.length ? kesilenler.join(",") : "yok"}`);
    console.log(`[SENARYODENE] ${tahtada ? "GECTI" : "KALDI"} senaryonun git'i tamamlandi`);
  })();
}

// ── TAHTA denemesi (?tahtadene=1) ─────────────────────────────────────────
// Iki iddiayi kanitlar: (1) Orion tahtanin ONUNDEYKEN gercekten yaziyor,
// (2) UZAKTAN yazmak reddediliyor ve gerekce beyne geri besleniyor.
if (new URLSearchParams(location.search).has("tahtadene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const sonuc: string[] = [];
    const kontrol = (ad: string, gecti: boolean, detay = "") =>
      sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

    await bekle(2200);
    const o = orion as Avatar | null;
    if (!o) { console.log("[TAHTADENE] KALDI avatar yok"); return; }

    // 1) UZAKTAN yazma denemesi — reddedilmeli, tahta bos kalmali.
    const uzakta = o.durum().konum;
    niyetiYurut({ tur: "yaz", metin: "uzaktan yazmaya calisiyorum" }, "dene_uzak");
    await bekle(900);
    kontrol("uzaktan yazmak REDDEDILDI", tahta.satirlar().length === 0,
      `konum=${uzakta.x.toFixed(1)},${uzakta.z.toFixed(1)} satir=${tahta.satirlar().length}`);

    // 2) Tahtanin onune git, sonra yaz.
    niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "dene_git_tahta");
    await bekle(6000);
    const yakinda = o.durum().konum;
    niyetiYurut({ tur: "yaz", metin: "Terminal suzgeci bitti. Cikis kodu ile calisiyor." }, "dene_yaz");
    await bekle(900);
    const satirlar = tahta.satirlar();
    kontrol("yakindan yazmak CALISTI", satirlar.length > 0,
      `konum=${yakinda.x.toFixed(1)},${yakinda.z.toFixed(1)} satir=${satirlar.length}`);
    for (const s of satirlar) console.log(`[TAHTADENE]   tahtada: "${s}"`);

    // 3) temizle=true onceki yaziyi silmeli.
    niyetiYurut({ tur: "yaz", metin: "yeni not", temizle: true }, "dene_temizle");
    await bekle(900);
    kontrol("temizle=true eskiyi sildi",
      tahta.satirlar().length === 1 && tahta.satirlar()[0] === "yeni not",
      JSON.stringify(tahta.satirlar()));

    for (const r of sonuc) console.log("[TAHTADENE] " + r);
    console.log("[TAHTADENE] ozet: " + sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
  })();
}

// ── HAFIZA denemesi (?hafizadene=1) ───────────────────────────────────────
// Asil soru "hafiza modulu calisiyor mu" degil (birim testi var):
// HATIRLAMAK ORION'UN CEVABINI DEGISTIRIYOR MU?
// Bir bilgi verilir, kisa pencere (12 tur) tasirilir, sonra sorulur.
if (new URLSearchParams(location.search).has("hafizadene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const soylenen: string[] = [];
    // DİKKAT: `kopru` avatar yüklendikten SONRA kuruluyor. İlk sürümde
    // dinleyici beklemeden önce kaydedilmeye çalışıldı, o anda kopru null'du
    // ve ölçüm hiçbir şey duymadı ("cevap boş" gibi göründü).
    await bekle(2500);
    const k = kopru as Kopru | null;
    if (!k) { console.log("[HAFIZADENE] KALDI kopru yok"); return; }
    k.konusmaDinle((m) => { soylenen.push(m); });

    const GERCEK = "bu hafta terminal suzgeci uzerinde calisiyorum";
    k.algi({ tur: "duydum", metin: GERCEK, kesin: true });
    await bekle(6000);

    // Kisa pencereyi tasir: 13 alakasiz tur (varsayilan gecmisSiniri 12).
    const dolgu = [
      "hava bugun guzel", "kahve ictim", "pencereden disari bakiyorum",
      "masan duzenli mi", "sandalyeyi begendim", "tahtayi merak ettim",
      "odanin rengi hos", "saat kac oldu", "biraz yoruldum",
      "muzik dinliyorum", "kedi geldi", "kapiyi kapattim", "isik yeterli",
    ];
    for (const d of dolgu) {
      k.algi({ tur: "duydum", metin: d, kesin: true });
      await bekle(2600);
    }

    const oncekiSayi = soylenen.length;
    k.algi({ tur: "duydum", metin: "ne uzerinde calistigimi hatirliyor musun", kesin: true });
    await bekle(9000);

    const cevap = soylenen.slice(oncekiSayi).join(" ");
    const hatirladi = /süzge|suzge|terminal|filtre/i.test(cevap);
    console.log(`[HAFIZADENE] gecmis_siniri=${new URLSearchParams(location.search).get("gecmis") ?? 12}, araya giren tur=${dolgu.length}`);
    console.log(`[HAFIZADENE] cevap: "${cevap}"`);
    console.log(`[HAFIZADENE] ${hatirladi ? "GECTI" : "KALDI"} eski bilgi hatirlandi mi`);
    console.log(`[HAFIZADENE] sayac=${JSON.stringify(k.sayac())}`);
  })();
}

// ── YÜZ denemesi (?yuzdene=1) ─────────────────────────────────────────────
// "Ağız senkronu çalışıyor" iddiasını MESH ÜZERİNDEN kanıtlar. Ölçülmüş
// tepe_agiz=1.000 değeri, iskelet ağzı desteklemiyorsa ekranda hiçbir şey
// yapmıyordu; bu deneme tam olarak o boşluğu kapatır.
if (new URLSearchParams(location.search).has("yuzdene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await bekle(2000);
    const o = orion as Avatar | null;
    if (!o) { console.log("[YUZDENE] KALDI avatar yok"); return; }

    const b = o.iskeletBilgisi();
    console.log(`[YUZDENE] iskelet=${b.tur} kaynak=${b.kaynak} agiz=${b.agizDestegi} kirpma=${b.kirpmaDestegi}`);

    const cene = sahne.getMeshByName("orion_cene");
    const goz = sahne.getMeshByName("orion_gozL");
    if (!cene) { console.log("[YUZDENE] KALDI cene mesh'i yok"); return; }

    // Ağız: kapalıyken ve tam açıkken çenenin ölçeğini karşılaştır.
    o.agizAyarla(0); o.cizimGuncelle(0.016); await bekle(120);
    const kapali = cene.scaling.y;
    o.agizAyarla(1); o.cizimGuncelle(0.016); await bekle(120);
    const acik = cene.scaling.y;
    const fark = Math.abs(acik - kapali);
    console.log(`[YUZDENE] ${fark > 0.1 ? "GECTI" : "KALDI"} agiz mesh oynuyor  kapali=${kapali.toFixed(3)} acik=${acik.toFixed(3)} fark=${fark.toFixed(3)}`);
    o.agizAyarla(0);

    // Göz kırpma boşta mikro-hareketten gelir: 6 sn içinde göz ölçeği değişmeli.
    if (goz) {
      let enAz = Infinity, enCok = -Infinity;
      for (let i = 0; i < 400; i++) {
        o.cizimGuncelle(0.016);
        enAz = Math.min(enAz, goz.scaling.y);
        enCok = Math.max(enCok, goz.scaling.y);
        await bekle(15);
      }
      const genlik = enCok - enAz;
      console.log(`[YUZDENE] ${genlik > 0.05 ? "GECTI" : "KALDI"} goz kirpiyor  genlik=${genlik.toFixed(3)}`);
    }
  })();
}

// ── Duman testi kanıtı ─────────────────────────────────────────────────────
setTimeout(() => {
  const d = oyuncu.oyuncuDurumu();
  console.log(
    `[DUMAN] fps=${motor.getFps().toFixed(1)} hz=${saat.olculenHz.toFixed(2)} ` +
    `tik=${saat.tikSayisi} atlanan=${saat.atlanan} ` +
    `kamera=${rig.mod} mesh=${oda.meshler.length} capa=${tumCapalar().length} ` +
    `kopru=${JSON.stringify(kopru?.sayac() ?? null)} ` +
    `oyuncu=${d.konum.x.toFixed(2)},${d.konum.y.toFixed(2)},${d.konum.z.toFixed(2)} ` +
    `etkilesim=${d.etkilesim ?? "-"} kopru=${typeof window.kopru} ` +
    `orion=${orion ? `${orion.durum().poz}@${orion.durum().konum.x.toFixed(2)},${orion.durum().konum.z.toFixed(2)}` : "yok"} ` +
    `monitor=${monitor.acikMi() ? "acik" : "kapali"}`
  );
}, 4000);

// ---- Orion'un sesi --------------------------------------------------------
// Birleştirme noktası burası: voice/ ile world/ birbirini import etmez (K4),
// ikisini giris.ts bağlar. Avatar geldiğinde (T2) agizAcikligi() buradan
// avatar.agizAyarla()'ya beslenecek.
const orionSesi = new PiperCikisi();
(window as unknown as { orionSes: PiperCikisi }).orionSes = orionSesi;

void (async () => {
  const kurulu = await orionSesi.kurulumKontrol();
  console.log(`[SES] piper kurulu=${kurulu}`);
  if (!kurulu) return;

  const sorgu = new URLSearchParams(location.search);
  if (sorgu.has("sessiz")) return;

  // ORION_SOZ verilmişse yalnızca onu söyle — elle deneme için.
  const istenen = sorgu.get("soz");
  if (istenen) {
    const oldu = await orionSesi.soyle(istenen);
    console.log(`[SES] istenen soyle=${oldu} baslama_gecikmesi=${orionSesi.baslamaGecikmesi.toFixed(0)}ms ses_uzunlugu=${orionSesi.sonSure.toFixed(2)}sn`);
    return;
  }

  // Açılışta tek selam. (Ölçüm koşumu ORION_SOZ ile ayrıca yapılabiliyor.)
  const cumleler = ["Merhaba Ozyn. Odama hoş geldin. Terminal masamda, istediğin zaman aç."];
  for (let i = 0; i < cumleler.length; i++) {
    const oldu = await orionSesi.soyle(cumleler[i]!);
    console.log(
      `[SES] cumle${i + 1} soyle=${oldu} ` +
      `baslama_gecikmesi=${orionSesi.baslamaGecikmesi.toFixed(0)}ms ` +
      `ses_uzunlugu=${orionSesi.sonSure.toFixed(2)}sn tepe_agiz=${orionSesi.tepeAgiz.toFixed(3)}`
    );
  }
})();
