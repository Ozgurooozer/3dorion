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
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
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
import { capaAdlari, capaBul, tumCapalar } from "./level/capalar.ts";
import { isinTara } from "./player/isinTarama.ts";
import { sorguYanitla, type Cevap, type Soru } from "../mind/algiHizmeti.ts";
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
// Devre panosu: sözleşme `protocol/`ta, tanımlar `mind/tanim/`da. Bu iki
// import K4'ün belgelenmiş istisnası olan kompozisyon kökünde, burada.
import { panoKur, tel } from "../protocol/pano.ts";
import type { Pano } from "../protocol/pano.ts";
import {
  dikkatTanimi, hafizaTanimi, onayTanimi, ajandaTanimi, refleksTanimi, beyinTanimi,
} from "../mind/tanim/index.ts";
// Yalnızca `zihindene` ayna kontrolü için: şemanın sütun sırasıyla ekrandaki
// sırayı karşılaştırmak gerek. Saf veri, K4 sınırını ihlal etmez.
import { TAHTA, GUNLUK, SEMA, GOZ_YUKSEKLIK } from "./level/olculer.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { ozetle, type Algi } from "../protocol/algi.ts";
import { varlik } from "./varlik.ts";
import { Kopru } from "../bridge/kopru.ts";
import type { KararSatiri, OgretimSatiri } from "../mind/kararKaydi.ts";
import { GOREV_SATIRLARI } from "../mind/gorev.ts";
import { modelSeciciKur } from "./arayuz/modelSecici.ts";
import type { Beyin } from "../bridge/beyin.ts";
import { MetinGirdi } from "../voice/metin-girdi.ts";
import { ikiCumleyeKisalt } from "../voice/kisalt.ts";
import { Ajanda } from "../mind/ajanda.ts";
import { gozlemAnisiMi } from "../mind/hafiza.ts";
import { mesgulMu } from "../mind/benlik.ts";
import { istenenSenaryolar, type SenaryoBaglami } from "../uygulama/senaryoBaglami.ts";
import { niyetYurutucusuKur } from "../uygulama/niyetYurutucu.ts";
import { zihinDuvariniBagla } from "../uygulama/zihinDuvari.ts";
import { beyinSeciminiKur, seciciKaynagiKur, modelKancasiKur, kisaAd } from "../uygulama/beyinSecimi.ts";
import { odadaSure, sessizlikSozu, gununVakti } from "../mind/zaman.ts";
import { depoYukle } from "../mind/hafizaGocu.ts";
import { GucButcesi, Inisiyatif } from "../mind/inisiyatif.ts";
import { McpBeyin } from "../bridge/mcpBeyin.ts";
import { KuralRefleksi, UZUN_ISLEM_MS, refleksGirdisi } from "../mind/refleks.ts";
import { OnayKapisi } from "../mind/onayKapisi.ts";
import { riskEtiketi } from "../mind/komutRiski.ts";
import { OlayUretici } from "./olayUretici.ts";
import { ciktiFarki, kesildiMi } from "./surfaces/ciktiFarki.ts";
import { CiktiToplayici } from "./surfaces/ciktiToplayici.ts";
import { kimlik } from "../protocol/temel.ts";
import type { DavranisDefteri } from "./davranisDenemesi.ts";

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
const oyuncu = new Oyuncu(sahne, oda, rig, {
  dogumYeri: new Vector3(1.6, 0, 1.9),
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
/** Orion'un anılarının localStorage anahtarı. Sürüm ekli: biçim değişirse
 *  eski kayıt sessizce yanlış yorumlanmak yerine görmezden gelinir. */
const HAFIZA_ANAHTARI = "orion.hafiza.v1";
const HAFIZA_YEDEK = "orion.hafiza.v1.yedek-gozlem-temizligi";

/**
 * TEK SEFERLİK temizlik (spec 06 K2): eski sürümde anlık gözlemler kalıcı
 * hafızaya yazılıyordu ("onumde: beyaz tahta (birkaç adım ötede)"). O
 * kayıtlar bugün getirilip Orion'a dünkü gözlemini anlattırıyor.
 *
 * ÖNCE YEDEK: silme geri alınamaz. Yedek anahtarı bir kez yazılır (varsa
 * dokunulmaz — ikinci koşu temizlenmiş hâli yedeğe basıp aslını ezmesin).
 * Geri dönüş: yedek anahtarı asıl anahtara kopyalamak.
 *
 * Desen dar tutuldu: yalnızca `sonuc` türü VE `onumde|yakin|oyuncu|dunya: `
 * önekiyle başlayanlar. Diğer `sonuc` anıları ("hata: ...") kalır.
 */
function gozlemleriAyikla(aniler: unknown[]): unknown[] {
  const temiz = aniler.filter((a) => !gozlemAnisiMi(a));
  const silinen = aniler.length - temiz.length;
  if (!silinen) return aniler;

  try {
    if (!localStorage.getItem(HAFIZA_YEDEK)) {
      localStorage.setItem(HAFIZA_YEDEK, JSON.stringify(aniler));
    }
  } catch (err) {
    // Yedek yazılamadıysa SİLME. Veri kaybı, kirli hafızadan beterdir.
    console.warn("[hafiza] yedek yazilamadi, temizlik ATLANDI:", err);
    return aniler;
  }
  console.warn(`[hafiza] ${silinen} anlik gozlem anisi temizlendi (yedek: ${HAFIZA_YEDEK})`);
  return temiz;
}

/** `localStorage`'daki eski hafıza — göç kaynağı ve geri dönüş yolu (K5). */
function eskiHafizayiOku(): unknown[] {
  const ham = localStorage.getItem(HAFIZA_ANAHTARI);
  if (!ham) return [];
  try {
    const j = JSON.parse(ham);
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

/**
 * Hafıza deposu (spec 07 K4, K5, K7).
 *
 * Electron varsa hafıza host'un JSON dosyasında yaşar; yoksa (`npm run dev`,
 * yalnız Vite) eskisi gibi `localStorage`da — geliştirme kipi kırılmasın.
 *
 * TEK KURAL, veri güvenliği için: yükleme `eski-yedek` döndüyse (göç
 * başarısız, doğrulanamadı ya da dosya okunamadı) o oturumun YAZIMLARI da
 * `localStorage`a gider, dosyaya DOKUNULMAZ. Aksi hâlde okunamayan ama
 * sağlam olan dosya, oturum boyunca eski veriyle ezilirdi.
 */
/**
 * ÖĞRENEN KAPI (spec 08, toplantı 2026-09-27 K5): kural hafızası kayıttaki
 * öğretim satırlarından kurulur. Host yoksa (tarayıcıda geliştirme) boş doğar;
 * okuma hatası Orion'u durdurmaz ama görünür olur.
 */
function ogretimleriYukle(): OgretimSatiri[] {
  const k = (globalThis as { kopru?: Partial<import("../host/kopru.ts").Kopru> }).kopru;
  try { return (k?.ogretimOku?.() ?? []) as OgretimSatiri[]; }
  catch (err) { console.warn("[KAPI] ogretimler okunamadi, bos hafizayla basliyor:", err); return []; }
}

/**
 * BECERİ REFLEKSİ (spec 10): beceri defteri geçmiş oturumların görev satırlarından
 * kurulur. Seçim tek kaynaktan (mind/gorev.ts `GOREV_SATIRLARI`), süzme host'ta. Host
 * yoksa ya da okuyamazsa defter geçmişsiz başlar, bu oturumdan öğrenir.
 */
function gorevSatirlariniYukle(): KararSatiri[] {
  const k = (globalThis as { kopru?: Partial<import("../host/kopru.ts").Kopru> }).kopru;
  try { return (k?.kayitSatirlariOku?.(GOREV_SATIRLARI) ?? []) as KararSatiri[]; }
  catch (err) { console.warn("[BECERI] gorev satirlari okunamadi, gecmissiz basliyor:", err); return []; }
}

function hafizaDeposuKur(): { oku(): unknown[]; yaz(aniler: unknown[]): void } {
  const k = (globalThis as { kopru?: Partial<import("../host/kopru.ts").Kopru> }).kopru;
  const dosya = k?.hafizaOku && k.hafizaYaz && k.hafizaYazSenkron ? k : null;
  let dosyayaYaz = false;

  return {
    oku() {
      if (!dosya) return gozlemleriAyikla(eskiHafizayiOku());
      const s = depoYukle({
        dosyaOku: () => dosya.hafizaOku!(),
        dosyaYazSenkron: (x) => dosya.hafizaYazSenkron!(x),
        eskiOku: eskiHafizayiOku,
      });
      dosyayaYaz = s.kaynak !== "eski-yedek";
      const satir = `[hafiza] ${s.kayitlar.length} kayit · kaynak=${s.kaynak}${s.not ? ` · ${s.not}` : ""}`;
      if (s.kaynak === "eski-yedek") console.warn(satir); else console.log(satir);
      return gozlemleriAyikla(s.kayitlar);
    },
    yaz(aniler) {
      if (dosya && dosyayaYaz) dosya.hafizaYaz!(aniler);
      else localStorage.setItem(HAFIZA_ANAHTARI, JSON.stringify(aniler));
    },
  };
}

/**
 * DEVRE PANOSU TELLERİ — yazılabilir ayarların tek doğruluk kaynağı.
 *
 * Değer modülün içinde değil BURADA duruyor. Modül teli okur, pano aynı
 * teli okur ve yazar; ikisinin ayrışması yapısal olarak imkânsız.
 *
 * Başlangıç değerleri modüllerin kendi varsayılanlarıyla AYNI — telin
 * takılması davranışı değiştirmemeli, yalnızca değiştirilebilir kılmalı.
 */
const PANO_TELLERI = {
  dikkat: { tekrar: tel(4000), terminalKis: tel(2500), azami: tel(20) },
  ajanda: { asgari: tel(15_000), sapma: tel(15_000) },
  hafiza: { kapasite: tel(300) },
  onay: { zamanAsimi: tel(90_000) },
} as const;

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

// ── MCP AJANI (spec 05 Aşama 1-2) ─────────────────────────────────────────
// Tek örnek: seçicideki "mcp" girdisi ve main'deki HTTP ucunun rölesi AYNI
// nesneyle konuşur. Beyin seçili değilken ajanın `dunya_bekle`si yalnızca
// "sessiz" döner ve araç çağrıları reddedilir (açık tur yok) — uç etkisizdir.
const mcpBeyin = new McpBeyin();
(globalThis as { kopru?: Partial<import("../host/kopru.ts").Kopru> }).kopru?.mcpDinle?.(async ({ id, yontem, param }) => {
  const k = (globalThis as { kopru?: Partial<import("../host/kopru.ts").Kopru> }).kopru!;
  // Yeni ajan oturumu (MCP initialize): talimat yeniden gitsin. Cevap yok (id 0).
  if (yontem === "oturum") { mcpBeyin.oturumBasladi(); return; }
  // Ajanın bağlantısı koptu: YALNIZCA o isteğin beklemesini iptal et.
  if (yontem === "iptal") {
    mcpBeyin.bekleIptal((param as { id?: number })?.id);
    // Gözlemlenebilir olsun: R1 kapısı bu satırı arar.
    console.log(`[mcp] ajan baglantisi koptu → temas kesildi (hazir=${mcpBeyin.kesikSaniye === 0})`);
    return;
  }
  try {
    if (yontem === "tools/list") {
      return k.mcpYanitla!(id, {
        tools: mcpBeyin.araclar().map((a) => ({ name: a.ad, description: a.aciklama, inputSchema: a.sema })),
      });
    }
    const p = param as { name?: string; arguments?: Record<string, unknown> };
    if (p?.name === "dunya_bekle") {
      // Tavan 120 sn: main'deki röle sınırı (130 sn) bunun üstünde. Ajan ne
      // isterse istesin en az 60 sn: kısa bekleme = her "quiet" bir model turu.
      const sn = Math.min(120, Math.max(60, Number(p.arguments?.azami_sn ?? 120) || 120));
      const s = await mcpBeyin.bekle(sn * 1000, id);
      return k.mcpYanitla!(id, { content: [{ type: "text", text: "sessiz" in s ? "quiet — nothing happened. Call dunya_bekle again." : s.metin }] });
    }
    const r = mcpBeyin.cagri(String(p?.name ?? ""), p?.arguments ?? {});
    return k.mcpYanitla!(id, { content: [{ type: "text", text: r.mesaj }], isError: !r.ok });
  } catch (hata) {
    k.mcpYanitla!(id, undefined, String((hata as Error)?.message ?? hata));
  }
});

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
const onayKapisi = new OnayKapisi({
  // Süre TELDEN okunur: panel bunu (teyitle) değiştirebilir. Bekleyen
  // önerinin son tarihi öneri anında dondurulduğu için değişiklik ona
  // geriye dönük uygulanmaz — S0'da onarılan gizli hata buydu.
  zamanAsimiMs: PANO_TELLERI.onay.zamanAsimi,
});
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

// TEK niyet yönlendirme noktası: avatar, ses hattı, tahta, onay kapısı ve algı hizmeti
// uygulama/niyetYurutucu.ts'te ayrılır (spec 14 R4: buradan taşındı, testli). Bu dosya yalnız
// dünyayı verir; sonradan atananlar (beden, köprü) çağrı anında okunur.
const { niyetiYurut, bedenAdimi } = niyetYurutucusuKur({
  beden: () => orion,
  kopru: () => kopru,
  tahta, monitor, onayKapisi, sema, gunluk, algiSor,
  altyazi: (metin, ms) => altyaziGoster(metin, ms),
  onayPaneliCiz,
  gordumBildir: () => { gordumGeldi = true; },
});

/** Davranis olcumu acikken kayit defterine erisim (yoksa null). */
function davranisKayit(): ReturnType<DavranisDefteri["kayit"]> | null {
  return window._davranisKayit ?? null;
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
      kopru.algi({ tur: "terminal", kuyruk: "(komut çıktı üretmedi)", kesildi: false, kod: kodu, sureMs: sure });
    }

    if (blok) {
      const kod = bekleyenKod ?? undefined;
      const sure = bekleyenSure;
      bekleyenKod = null;
      bekleyenSure = undefined;
      sessizBitisBekliyor = false;

      // Günlük ve görü kancası köprünün süzgeciyle AYNI kararı görür: beyne
      // giden algının kendisi, köprünün özeti (`ozetle`) ve tek kaynaklı girdi
      // (`refleksGirdisi`). Eskiden burada elle kurulan girdi süreyi taşıyor,
      // köprününki taşımıyordu: `kod_uzun` canlıda ölüydü ama `sessizdene` bu
      // kopyayı ölçtüğü için "geçti" diyordu (karar kaydı, 2026-09-27).
      const algi: Algi = { tur: "terminal", kuyruk: blok, kesildi: kesildiMi(blok), kod, sureMs: sure };
      const gecti = refleks.karar(refleksGirdisi(algi, ozetle(algi)));
      console.log(`[ALGI] terminal blok (${blok.split("\n").length} satir) -> terfi=${gecti.terfi} (${gecti.gerekce})`);
      const kanca = window._goruKanca;
      if (kanca) kanca(blok, gecti.terfi);
      kopru.algi(algi);
    }
  }

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
    if (!SENARYO_KIPI && kopru) {
      const sessizlikMs = Date.now() - (sonKonusma || ACILIS);
      const k = inisiyatif.karar({
        simdiMs: t * 1000,
        mesgul,
        ozynMonitorde: d.etkilesim === "monitor",
        ozynOdada: (d.mesafe ?? Infinity) < 8,
        sessizlikMs,
        guc: gucButcesi.seviye,
      });
      if (k) {
        // YENİ YOL YOK: sıradan bir olay algısı. Dikkat süzgecinden ve dakika
        // sınırından geçer, tek karar→eylem yolu (`niyetiYurut`) korunur.
        // Çerçeve İngilizce (spec 06 §6.8).
        //
        // Köken YAPISAL alanda (`ayrinti.kaynak`), metinde değil: köprü susma
        // ilanını yalnızca inisiyatif zincirinde yutuyor ve bunu metinden
        // tahmin etmek, bugün önek eşleştirmesinin kaymasıyla aynı hata olurdu.
        //
        // İfade KISA tutuldu: "susacağını söyleme, hiçbir araç çağırma" diye
        // uzatmak ölçümde hiçbir şeyi değiştirmedi (3/10 → 3/10), yalnızca
        // bağlamı büyüttü. Susma ilanını köprü yapısal olarak yutuyor.
        const sure = k.dakika >= 1 ? `${k.dakika} minutes` : `${Math.round(sessizlikMs / 1000)} seconds`;
        kopru.algi({
          tur: "olay",
          ad: `nobody has spoken for ${sure} — this is your own initiative: `
            + "say something only if it is useful, otherwise stay silent",
          ayrinti: { kaynak: "inisiyatif" },
        });
        console.log(`[INISIYATIF] soze_gir · sessizlik=${k.dakika} dk · fayda=${k.fayda.toFixed(2)} · guc=${gucButcesi.seviye.toFixed(2)}`);
        gunluk.ekle("bilgi", "inisiyatif", `kendiliğinden düşünme fırsatı (${k.dakika} dk sessizlik)`);
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
  // Terminallerde zoom YOK: 0.95 m okunabilirlik için ÖLÇÜLDÜ (1.5 m'de
  // hücre başına 4.4 piksel, okunmuyor; 0.6 m'de ~11 piksel). Genel
  // çerçeveleme hesabıyla ezmek o ölçümü çöpe atardı.
  odakMesh = null; odakliYuzey = "monitor"; zoomUygula(false);
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
  odakMesh = null; odakliYuzey = "admin"; zoomUygula(false);   // bkz. monitoreGec: mesafe ölçülmüş
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
/**
 * Yüzeyin TAMAMININ çerçeveye sığacağı kamera mesafesi.
 *
 * Sabit mesafe yanlıştı: 1.15 m'de görünen dikey alan 1.11 m, oysa zihin
 * duvarı panelleri 1.35 m — tablo çerçeveyi taşıyordu ve alt/üstü kesiliyordu
 * (Ozyn bildirdi, hesapla doğrulandı).
 *
 * Artık mesafe geometriden türüyor: dikey görüş alanı `2·d·tan(fov/2)`, bunu
 * yüzey yüksekliğine eşitleyip %15 pay bırakıyoruz. Böylece kural her panel
 * boyutunda kendiliğinden doğru — yeni bir yüzey eklendiğinde sayı ayarlamak
 * gerekmiyor.
 */
function cerceveMesafesi(mesh: AbstractMesh, pay = 1.15): number {
  const k = mesh.getBoundingInfo().boundingBox.extendSize;
  const o = mesh.absoluteScaling;
  const yukseklik = Math.max(0.1, k.y * 2 * Math.abs(o.y));
  const genislik = Math.max(0.1, k.x * 2 * Math.abs(o.x));

  const dikeyFov = rig.kamera.fov;
  const enBoy = Math.max(0.5, motor.getRenderWidth() / Math.max(1, motor.getRenderHeight()));

  // İki kısıt: yükseklik dikey FOV'a, genişlik yatay FOV'a sığmalı.
  // Hangisi daha uzak mesafe istiyorsa o kazanır.
  const dikeyIcin = (yukseklik * pay) / (2 * Math.tan(dikeyFov / 2));
  const yatayIcin = (genislik * pay) / (2 * Math.tan(dikeyFov / 2) * enBoy);
  return Math.max(dikeyIcin, yatayIcin);
}

// ── ZOOM — odaktaki yüzeyi ne kadar yakından çerçeveliyoruz ───────────────
//
// `cerceveMesafesi`'nin `pay` çarpanı zaten "yüzeyin etrafında ne kadar boşluk
// kalsın" demek: 1.0 = tam sığar, büyüdükçe uzaklaşır. Zoom bu tek sayıyı
// oynatıyor — FOV'a dokunmuyoruz çünkü FOV değiştirmek perspektifi bozar
// (dolly ile zoom farkı), oysa burada istenen şey kameranın geri çekilmesi.
//
// Aralık ölçümle değil geometriyle seçildi: 0.70'te panel çerçeveyi taşar
// (kırpma kasıtlı, detaya bakmak için), 3.0'da oda bağlamıyla birlikte görünür.
const ZOOM_EN_YAKIN = 0.70;
const ZOOM_EN_UZAK = 3.00;
const ZOOM_ADIM = 0.15;
const ZOOM_VARSAYILAN = 1.15;

let zoomPayi = ZOOM_VARSAYILAN;
/** Odaklanılan mesh — zoom değişince yeniden çerçevelemek için saklanır. */
let odakMesh: AbstractMesh | null = null;
/**
 * ODAKTAKİ yüzeyin çapa adı. Tıklamanın anlamını belirler:
 *
 *   uzaktaki yüzeye tıkla  → o yüzeye GEÇ
 *   odaktaki yüzeye tıkla  → o yüzeyin İÇİNE tıkla
 *
 * Bu ayrım olmadan odaktaki panele her tıklayış `panelOdak`u yeniden
 * çağırıyordu: zoom sıfırlanıyor ve tıklama hiçbir şey seçmiyordu.
 */
let odakliYuzey: string | null = null;
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
const zoomYakinDugme = document.getElementById("zoomYakin") as HTMLButtonElement;
const zoomUzakDugme = document.getElementById("zoomUzak") as HTMLButtonElement;

/** Kumandayı ve kamerayı güncel zoom'a göre tazeler. */
function zoomUygula(yenidenCerceveleme = true): void {
  const acik = odakMesh !== null;
  zoomKutu.dataset.acik = acik ? "1" : "0";
  if (!acik) return;

  // %100 = varsayılan çerçeveleme. Kullanıcı "1.15 pay" değil "%100" görür.
  zoomOran.textContent = `%${Math.round((ZOOM_VARSAYILAN / zoomPayi) * 100)}`;
  zoomYakinDugme.disabled = zoomPayi <= ZOOM_EN_YAKIN + 1e-6;
  zoomUzakDugme.disabled = zoomPayi >= ZOOM_EN_UZAK - 1e-6;

  if (!yenidenCerceveleme || !odakMesh) return;
  // `odakKilitle` mutlak konum saklıyor; yeniden çağırmak dolly'yi başlatır
  // ve kamera zaten hedefe lerp'lediği için geçiş bedavaya yumuşak olur.
  const yon = odakMesh.getDirection(new Vector3(0, 0, -1));
  rig.odakKilitle(odakMesh.getAbsolutePosition(), cerceveMesafesi(odakMesh, zoomPayi), 0.02, yon);
}

function zoomDegistir(delta: number): void {
  if (!odakMesh) return;
  const yeni = Math.max(ZOOM_EN_YAKIN, Math.min(ZOOM_EN_UZAK, zoomPayi + delta));
  if (Math.abs(yeni - zoomPayi) < 1e-6) return;   // uçta: sessizce hiçbir şey yapma
  zoomPayi = yeni;
  zoomUygula();
}

zoomYakinDugme.addEventListener("click", () => zoomDegistir(-ZOOM_ADIM));
zoomUzakDugme.addEventListener("click", () => zoomDegistir(+ZOOM_ADIM));

// Tekerlek: düğmeler keşfedilebilirlik için, tekerlek hız için.
// Yalnızca odakta çalışır — gezinirken tekerleğin başka bir anlamı yok.
tuval.addEventListener("wheel", (e) => {
  if (!odakMesh) return;
  e.preventDefault();
  zoomDegistir(e.deltaY > 0 ? +ZOOM_ADIM : -ZOOM_ADIM);
}, { passive: false });

function panelOdak(mesh: AbstractMesh, etiket: string): void {
  monitor.odaklan(false);
  adminTerminal.odaklan(false);
  // CreatePlane'in yüzey normali -Z; mesh döndürülmüş olsa da bu doğru yönü verir.
  odakMesh = mesh;
  odakliYuzey = (mesh.metadata as { capa?: string } | undefined)?.capa ?? null;
  zoomPayi = ZOOM_VARSAYILAN;        // her yeni panelde temiz başla
  zoomUygula();                      // kamerayı da kurar
  altyaziGoster(`${etiket} — fare serbest, tıklayabilirsin · Esc ile çık`, 3000);
}

// Tıklanabilirlik GÖRÜNÜR olmalı: gizli davranış "düzgün kullanım" değildir.
// Odaktayken imlecin altındaki yüzey tıklanabilirse imleç `pointer` olur ve
// hangi yüzey olduğu altyazıda yazar. Gezinirken bu hiç çalışmaz — orada
// imleç zaten kilitli ve tıklamanın işi kamerayı ele almak.
let sonVurgu: string | null = null;
let vurguSaat = 0;

/** Odaktaki yüzeyin İÇİNDE imlecin altında tıklanacak ne var — yüzey söyler. */
const YUZEY_HEDEF: Record<string, (u: number, v: number) => string | null> = {
  sema: (u, v) => sema.hedef(u, v),
};

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

  // ODAKTAKİ yüzeyin içi: imleç kutunun üstündeyken `pointer`, boşlukta değil.
  // Devre panosunda "neresi tıklanabilir" denemeyle öğrenilmemeli.
  if (capa && capa === odakliYuzey) {
    const uv = p?.getTextureCoordinates?.();
    const hedef = uv ? (YUZEY_HEDEF[capa]?.(uv.x, uv.y) ?? null) : null;
    const anahtar = hedef ? `${capa}:${hedef}` : null;
    if (anahtar === sonVurgu) return;
    sonVurgu = anahtar;
    tuval.style.cursor = hedef ? "pointer" : "";
    return;
  }

  const tiklanabilir = capa && capa in YUZEY_GECISI ? capa : null;
  if (tiklanabilir === sonVurgu) return;

  sonVurgu = tiklanabilir;
  tuval.style.cursor = tiklanabilir ? "pointer" : "";
  if (tiklanabilir) {
    const c = capaBul(tiklanabilir);
    altyaziGoster(`${c?.etiket ?? tiklanabilir} — tıkla`, 1600);
  }
});

/**
 * Odaktaki yüzeyin İÇİNE tıklama. Dönüş: tıklama tüketildi mi.
 *
 * UV doğrudan yüzeye geçirilir; piksele çevirmek burada YAPILMAZ. Çözünürlük
 * (`dikeyPiksel`) yüzeyin kendi bilgisi — dışarı sızsaydı değiştiği gün
 * tıklamalar sessizce kayardı.
 */
const YUZEY_TIKLAMA: Record<string, (u: number, v: number) => boolean> = {
  sema: (u, v) => sema.tikla(u, v),
};

tuval.addEventListener("click", (e) => {
  // Gezinirken tıklama kamerayı ele alır (kamera.ts); burası yalnızca odak kipi.
  if (!rig.odakta) return;
  const p = sahne.pick(e.offsetX, e.offsetY);
  const capa = (p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa;
  if (!capa) return;

  // ZATEN odaktaki yüzey: tıklama geçiş değil, içerik tıklamasıdır.
  if (capa === odakliYuzey) {
    const uv = p?.getTextureCoordinates?.();
    if (!uv) return;
    const ele = YUZEY_TIKLAMA[capa];
    if (!ele) return;                       // içi tıklanabilir değil: sessiz
    const tuketildi = ele(uv.x, uv.y);
    console.log(`[TIKLAMA] ${capa} içi uv=${uv.x.toFixed(3)},${uv.y.toFixed(3)} tüketildi=${tuketildi}`);
    return;                                 // geçişi TEKRAR çalıştırma: zoom sıfırlanırdı
  }

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
  // Odaktan çıkışın birden çok yolu var (Esc, panel değişimi, terminale
  // geçiş). Her birine ayrı temizlik kancası asmak yerine tek gözetim
  // noktası: odak düştüyse zoom kumandası da kapanır.
  if (!rig.odakta && (odakMesh || odakliYuzey)) {
    odakMesh = null; odakliYuzey = null;
    // Panelden çıkarken detay da kapanır: geri dönüldüğünde şema karşılar.
    // Açık bırakmak "panel bozulmuş" gibi okunurdu — kullanıcı o detayı
    // seçtiğini çoktan unutmuş olur.
    sema.sec(null);
    zoomUygula(false);
  }

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
const dunyaKancasi = {
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
window.dunya = dunyaKancasi;

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
  const sonuc = dunyaKancasi.niyet(n[0], n[1]);
  altyaziGoster(`Orion: ${n[0]} ${JSON.stringify(n[1]).slice(0, 40)}`, 1600);
  console.log(`[hizli] ${e.key} → ${n[0]} (${sonuc})`);
});

// ── BEYİN: Orion kendi kararıyla dünyada eylemde bulunur ──────────────────
// Köprü dünyayı da beyni de import etmez; ikisini burada bağlıyoruz.
// Yerel model odadaki varlıktan sorumlu; ağır iş terminaldeki Claude'a gider.
const girdi = new MetinGirdi();
let kopru: Kopru | null = null;

/** Dünyanın açıldığı an — "ne kadardır buradayım" bundan hesaplanır. */
const ACILIS = Date.now();
/** Ozyn'in en son konuştuğu an. 0 = hiç konuşmadı. */
let sonKonusma = 0;

function dunyaDurumuMetni(): string {
  const o = oyuncu.oyuncuDurumu();
  const a = orion?.durum();
  const simdi = Date.now();
  const d = new Date(simdi);
  return [
    a ? `You: ${a.poz}, position ${a.konum.x.toFixed(1)},${a.konum.z.toFixed(1)}${a.oturuyor_mu ? ", seated" : ""}.` : "",
    // PROPRİYOSEPSİYON. Yalnızca HAREKET HÂLİNDEYKEN yazılır — duruyorken
    // "hızın 0" demek her tura bir satır ekleyip hiçbir şey söylemez, bağlam
    // ise sadakatin en pahalı kaynağı (spec 06: bağlama giren her satır
    // ölçülür). Aktüatör doyuma girdiği için bu sayı artık gerçek: komut
    // edilen değil, gerçekleşen.
    a && a.hiz !== undefined && a.hiz > 0.05
      ? `You are moving at ${a.hiz.toFixed(1)} m/s${
          a.hedefeKalan !== undefined ? `, ${a.hedefeKalan.toFixed(1)}m left to your target` : ""
        }.`
      : "",
    `Ozyn is ${o.mesafe?.toFixed?.(1) ?? "?"}m away${o.bakiyor ? ", looking at you" : ""}.`,
    o.etkilesim === "monitor" ? "Ozyn is working on your monitor." : "",
    // Spec 13 Faz 2a: Orion bilgisayarın başında ve terminal açıksa bunu BİLSİN — yoksa
    // "bilgisayarı aç" sonrası komut önermek yerine yeniden açmaya çalışır.
    a?.oturuyor_mu && monitor.acikMi() ? "You are seated at your desk and your terminal is open (PowerShell)." : "",
    // ZAMAN — bir varlığın olmazsa olmazı. Bunlar olmadan Orion her turu
    // zamansız bir "şimdi" içinde yaşıyor: ne gün ilerliyor, ne sessizlik
    // birikiyor, ne de "sabahtan beri buradayım" diyebiliyor.
    `It is ${gununVakti(d.getHours())}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}.`,
    odadaSure(simdi - ACILIS),
    sonKonusma ? sessizlikSozu(simdi - sonKonusma) : "",
  ].filter(Boolean).join(" ");
}

/** Model seçici penceresi — beyin bağlanınca kurulur (seçiciye ihtiyaç duyar). */
let modelSecici: ReturnType<typeof modelSeciciKur> | null = null;

function beyniBagla(a: Avatar): void {
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
  const duvar = zihinDuvariniBagla({ sema, gunluk, kopru: () => kopru, kesikSn, kisaAd });
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
    sabitBilgi: () => `In the room: ${tumCapalar().map((c) => c.etiket).join(", ")}.`,
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

  // ── DEVRE PANOSU kayıt defteri ───────────────────────────────────────
  //
  // Kompozisyon kökü kurar (K4'ün belgelenmiş tek istisnası): `world/`
  // içindeki hiçbir dosya `mind/`i görmez, yalnızca `protocol/pano.ts`
  // tipini bilir. Kayıt defteri burada doğar ve panele TAKILIR.
  //
  // Beyin tanımı bir sınıf örneği değil üç okuyucu alıyor: koşan beynin
  // durumu (ad, devre kesici) tek bir nesnede toplanmış değil ve sahte bir
  // nesne uydurmak, panonun tam da kaçındığı kopya-durum olurdu.
  const panoKaydi = panoKur([
    dikkatTanimi(kopru.dikkat, PANO_TELLERI.dikkat),
    hafizaTanimi(kopru.hafiza, PANO_TELLERI.hafiza),
    onayTanimi(onayKapisi, PANO_TELLERI.onay),
    ajandaTanimi(ajanda, PANO_TELLERI.ajanda),
    refleksTanimi(),
    beyinTanimi({
      ad: () => beyin.ad,
      kesikSaniye: () => kesikSn(),
      yakinlikKurali: () => true,
      secim: {
        istenen: () => secici.istenen,
        iste: (ad) => secici.iste(ad),
        secenekler: () => secici.secenekAdlari(),
        durum: () => {
          const g = secici.gecis;
          if (g.tur === "kontrol") return `${secici.aktif} → ${g.hedef} (kontrol)`;
          if (g.tur === "reddedildi") return `${secici.aktif} (${g.hedef} reddedildi)`;
          return beyin.ad;
        },
      },
    }),
  ]);
  sema.panoBagla(panoKaydi);
  panoKaydiGlobal = panoKaydi;

  // ── MODEL SEÇİCİ (M) ─────────────────────────────────────────────────
  // Kaynağı uygulama/beyinSecimi.ts'te: seçim devre panosunun teyit yolundan geçer (tek yol).
  modelSecici = modelSeciciKur({
    kaynak: seciciKaynagiKur(secim, panoKaydi, kabukApi),
    kok: document.getElementById("modelSecici") as HTMLElement,
    rozet: document.getElementById("beyinRozet") as HTMLElement,
    // M bir harftir: terminal/panel odaktayken, sohbet ya da onay açıkken değil.
    tusSerbest: () => oyuncu.oyuncuDurumu().etkilesim === null
      && sohbet.dataset.acik !== "1" && onayKapisi.durum !== "bekliyor",
  });
  window.orionModel = modelKancasiKur(secim, () => modelSecici?.ac());
  console.log(`[PANO] ${panoKaydi.moduller().length} modül, ` +
    `${panoKaydi.goruntu().reduce((n, m) => n + m.dugmeler.length, 0)} tel bağlandı`);

  // ── ÖLÇÜM KİLİDİ: panelden AÇILMAZ, bilerek ─────────────────────────
  //
  // Kilidi açmak GEREKÇE ister ve gerekçe yazmak metin girişi gerektirir;
  // odadaki panelin klavyesi yok. Panele "aç" düğmesi koyup gerekçeyi
  // uydurmak, kilidin tek işlevini — sürtünmeyi — ortadan kaldırırdı.
  // Bu yüzden açma yolu yönetim terminalinden geçer ve yazılı bir cümle
  // ister. Kapatmak damgayı KALDIRMAZ.
  window.orionPano = {
    kilitAc: (gerekce: string) => panoKaydi.kilitAc(gerekce),
    kilitKapat: () => panoKaydi.kilitKapat(),
    durum: () => ({
      kilitAcik: panoKaydi.kilitAcikMi(),
      olcumDisi: panoKaydi.olcumDisi(),
      gerekce: panoKaydi.kilitGerekcesi(),
    }),
  };

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
  girdi.dinle((t) => {
    if (!t.kesin) return;
    altyaziGoster(`sen: ${t.metin}`, 2000);
    sonKonusma = Date.now();      // "en son ne zaman konuştuk" bundan
    kopru?.algi({ tur: "duydum", metin: t.metin, kesin: true });
  });

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
window.orionSes = orionSesi;

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
  get zoomPayi() { return zoomPayi; },
  niyetiYurut, onayKarari, algiSor, monitoreGec, admineGec, panelOdak, panoyuAl, zoomUygula,
};
for (const ad of istenenSenaryolar(location.search)) {
  void import(`../uygulama/senaryolar/${ad}.ts`)
    .then((m: { kos(d: SenaryoBaglami): Promise<void> }) => m.kos(senaryoBaglami))
    .catch((e) => console.error(`[SENARYO] ${ad} yüklenemedi ya da düştü:`, e));
}
