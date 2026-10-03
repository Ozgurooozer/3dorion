// uygulama/beyinSecimi.ts — Düşünce beyninin seçimi: seçenekler, açılış beyni, kataloglar, hatırlanan
// seçim ve M seçicinin kaynağı (spec 14 R6: world/giris.ts `beyniBagla`dan taşındı; gövde aynı).
//
// ── SOL LOB: düşünce beyni ────────────────────────────────────────────────────
//
// Yerel `qwen2.5:7b` ÖLÇÜMLE elendi: ham sınavda 1/4, hatırlama 0/6, terminal hatasında yanlış
// teşhis. Aynı üç senaryo Ling 3.0 Flash VL ile geçti. Bedel: 858 ms → ~3.5 sn. Bu yüzden yalnızca
// DÜŞÜNCE buluta taşındı; beden refleksleri yerel ve kuralcı kaldı (bkz. docs/specs/02-beyin-mimarisi.md).
//
// YEDEK MODEL YOK — bilinçli. Seçilen beyin kapalıysa sessizce aptallaşmak yerine "düşüncem kapalı"
// deyip KURALLI VARLIK kipinde kalır: hareket eder, tepki verir, süzer. Dürüst bozulma sessiz
// bozulmadan iyidir.
//
// SAĞLAYICI DEĞİŞİMİ KOD DEĞİŞİKLİĞİ GEREKTİRMEZ. Önce yalnızca `model` ayarlanabiliyordu;
// `providerID` kodda sabitti. "Sağlayıcıyı değiştirmek tek satır" demek bu hâliyle DOĞRU DEĞİLDİ —
// OpenRouter kotası dolduğunda NVIDIA'ya geçmek dosya düzenlemek demekti. Artık üçü de dışarıdan
// verilir; ölçüm düzeneği aynı kalır, beyin değişir (ORION_MODEL: model karşılaştırması TEK değişkenli).
//
// Neden ayrı dosya: giris.ts'in içindeyken `location`, `localStorage`, `window.kopru` ve ağ taramasına
// doğrudan bağlıydı; "hatırlanan seçim yalnız elle açılışta ve taramalardan SONRA" kuralı yalnız canlıda
// sınanabiliyordu. Artık hepsi bağlamla gelir (`beyinSecimi.test.ts`).
"use strict";
import type { Beyin } from "../bridge/beyin.ts";
import { SecilebilirBeyin, type BeyinSecenegi } from "../bridge/secilebilirBeyin.ts";
import { OpenCodeBeyni } from "../bridge/opencode.ts";
import { DisBeyin } from "../bridge/disBeyin.ts";
import { KayitBeyni } from "../bridge/kayitBeyni.ts";
import { OllamaBeyni } from "../bridge/ollama.ts";
import { McpBeyin } from "../bridge/mcpBeyin.ts";
import { ollamaTara, type OllamaKatalogu } from "../bridge/ollamaKatalog.ts";
import { opencodeTara, type OpenCodeKatalogu } from "../bridge/opencodeKatalog.ts";
import { API_SAGLAYICILARI, apiTara, apiSecenekler, type ApiKatalogu } from "../bridge/apiKatalog.ts";
import type { ApiIstemcisi, ApiSonucu } from "../bridge/apiBeyni.ts";
import { yerelSecenekler, yerelAd, yereldenModel, bulutSecenekler, kartlariKur } from "../bridge/beyinKatalogu.ts";
import type { Kopru as KabukKoprusu } from "../host/kopru.ts";
import type { Pano } from "../protocol/pano.ts";
import type { GunlukEkrani } from "../world/surfaces/gunluk.ts";
import type { SemaPaneli } from "../world/surfaces/sema.ts";
import type { ModelSeciciKaynagi } from "../world/arayuz/modelSeciciCekirdek.ts";
import type { OrionModelKancasi } from "./pencereKancalari.ts";

// VARSAYILAN BEYİN: Claude Haiku (Ozyn, 2026-09-28). OpenRouter'daki ücretsiz
// Ling modeli kalktı: karar kaydında dört uyanışın dördü 404 ile bitti
// (2026-09-27). Haiku zaten bağlı (adaptörünü Electron başlatıyor) ve
// ölçülmüştü (2,8–3,6 sn). OpenCode seçenek olarak duruyor; yedek model yine
// YOK: seçilen beyin düşerse Orion kurallı varlık kipinde kalır.
export const VARSAYILAN_BEYIN = "claude:haiku";
/** Son elle seçimin depo anahtarı. */
export const HATIRA_ANAHTARI = "orionBeyin";

/** Panel notu için kısa ad: `opencode:saglayici/model` → `model`. */
export const kisaAd = (ad: string): string => ad.replace(/^(opencode|api):/, "").split("/").pop() ?? ad;

/** API anahtarı kanalları (ana süreç, host/kopru.ts). Electron dışında (vite dev) yoktur. */
export type KabukApi = Pick<KabukKoprusu, "apiDurum" | "apiModeller" | "apiSohbet" | "apiKaydet" | "apiSil">;

export interface BeyinSecimiBaglami {
  /** `location.search`: `?beyin=`, `?saglayici=`, `?model=`, `?ollama=`, `?kayit`, `?sessiz` … */
  sorgu: string;
  mcpBeyin: McpBeyin;
  sema: Pick<SemaPaneli, "ariza" | "not" | "lob" | "durumYaz">;
  gunluk: Pick<GunlukEkrani, "ekle">;
  altyazi(metin: string, ms?: number): void;
  /** Bir tarama bitti: M seçici penceresi tazelensin. */
  tazele(): void;
  kabuk: KabukApi | null;
  /** Son seçimin kalıcı deposu (renderer'da localStorage; hata yutulur). */
  depo: { oku(anahtar: string): string | null; yaz(anahtar: string, deger: string): void };
  /** Testte sahte taramalar; verilmezse gerçek Ollama/OpenCode taraması. */
  taraycilar?: {
    ollama(ayar: { adres?: string }): Promise<OllamaKatalogu>;
    opencode(ayar: { adres?: string }): Promise<OpenCodeKatalogu>;
  };
}

export interface BeyinSecimi {
  secici: SecilebilirBeyin;
  /** Köprüye verilecek beyin: `?kayit=1` ise her turu günlüğe yazan sarmal. */
  kopruBeyni: Beyin;
  /** Devre kesicinin kalan saniyesi (OpenCode kotası, MCP temas kopması); 0 = açık. */
  kesikSn(): number;
  hepsiniTara(): Promise<void>;
  /** İlk üç tarama bitti (varsa hatırlanan seçim de istendi). */
  hazir: Promise<void>;
  kataloglar(): { ollama: OllamaKatalogu | null; opencode: OpenCodeKatalogu | null; api: ApiKatalogu | null };
  apiKayitli(): readonly { ad: string; adres: string; kalici: boolean }[];
}

export function beyinSeciminiKur(b: BeyinSecimiBaglami): BeyinSecimi {
  const { sema, gunluk } = b;
  const q = new URLSearchParams(b.sorgu);
  const tara = b.taraycilar ?? { ollama: ollamaTara, opencode: opencodeTara };

  // BEYİN SEÇİMİ — `Beyin` üç metotluk bir arayüz; kim uyguladığı önemsiz.
  //
  // `?beyin=dis` başka bir DİLDE yazılmış beyne bağlanır (bkz. disBeyin.ts,
  // örnek: `tools/ornek-beyin.py`). Python/Go/Rust fark etmez — dünya, köprü
  // ve protokol hiçbir şey bilmez. Ayrım baştan böyle kurulmuştu; burası
  // yalnızca hangi uygulamanın kullanılacağını seçer.
  //
  // ÇALIŞIRKEN DEĞİŞTİRİLEBİLİR: seçici panodaki DÜŞÜNCE düğümünden sürülür.
  // Açılış seçimi (`?beyin=`) yalnızca BAŞLANGIÇ beynini belirler. Beyinler
  // tembel kurulur — seçilmeyen yerel model yüklenmez, bulut oturumu açılmaz.
  //
  // Yerel seçenekler düşünce için ÖLÇÜMLE elenmişti (yukarıda): listede
  // durmaları "iyi düşünür" iddiası değil, bulut kapalıyken ya da kotası
  // dolduğunda elle geçilebilecek bir yedek olmaları.
  const secenekler: BeyinSecenegi[] = [
    { ad: "opencode", kur: () => new OpenCodeBeyni({
        providerID: q.get("saglayici") || "openrouter",
        modelID: q.get("model") || "inclusionai/ling-3.0-flash-vl:free",
        adres: q.get("opencode") || undefined,
        sifre: q.get("sifre") || undefined,
        zamanAsimiMs: 30_000,
      }) },
    // YEREL MODELLER ELLE YAZILMAZ: açılışta Ollama'dan taranır (aşağıda,
    // `ollamaTara`). Eskiden burada `qwen2.5:7b` ve `qwen3:4b` sabitti; yeni
    // indirilen model kod değiştirmeden seçilemiyordu, silinen model ise
    // listede durup seçilince sessizce düşüyordu.
    // Claude Haiku — ADI AÇIK OLSUN. Eskiden yalnızca `dis` vardı ve panelde
    // o adla duruyordu: Ozyn için Haiku diye bir seçenek görünmüyordu, üstelik
    // `tools/claude-beyin.ts`i ayrı bir terminalde elle başlatmak gerekiyordu
    // (başlatmazsan `hazirMi()` düşer ve seçim sessizce reddedilir). Adaptörü
    // artık Electron kendi başlatıyor (`host/main.js`).
    //
    // Zaman aşımı 30 sn: ölçümde Haiku 2,8–3,6 sn: dönüyor, ama `claude -p`
    // soğuk açılışta daha uzun sürebiliyor ve 10 sn'lik tavan gereksiz yere
    // "geçilemedi" veriyordu.
    { ad: "claude:haiku", kur: () => new DisBeyin({
        ad: "claude:haiku",
        adres: q.get("claudeadres") || undefined,
        zamanAsimiMs: 30_000,
      }) },
    // MCP ajanı (spec 05): odadaki `claude` dünyaya MCP ile bağlanır ve algıyı
    // ÇEKER. Beyin arayüzünün arkasında: ajanın çağrıları köprüye döner ve
    // diğer beyinlerinkiyle AYNI yoldan geçer (dogrula, onay kapısı, zincir
    // bütçesi). Ajan bağlı değilse `hazirMi()` false → seçim reddedilir.
    { ad: "mcp", kur: () => b.mcpBeyin },
    // Genel dış beyin yuvası (spec 04): başka bir dilde yazılmış beyin.
    // `?beyinadres=` ile başka bir uca bağlanır.
    { ad: "dis", kur: () => new DisBeyin({
        adres: q.get("beyinadres") || undefined,
        zamanAsimiMs: 10_000,
      }) },
  ];
  // Başlangıç: `?beyin=` listede varsa o, yoksa varsayılan. Liste TEK kaynak;
  // bilinen adları ayrıca yazmak, yeni seçenek eklenince sessizce ayrışırdı.
  // Bilinmeyen değer çökertmez: varsayılana düşer.
  const istek = q.get("beyin");
  const ollamaAdres = q.get("ollama") || undefined;
  // `?beyin=yerel:<model>` TARAMAYI BEKLEMEZ: açıkça istenen model hemen
  // seçenek olur (ölçüm düzenekleri açılış beynini kesin bilmeli). Kurulu
  // değilse sağlık kontrolü söyler; tarama sonra aynı adı ezmeden geçer.
  const istenenYerel = istek ? yereldenModel(istek) : null;
  if (istenenYerel) {
    secenekler.push({ ad: yerelAd(istenenYerel), kur: () => new OllamaBeyni({ model: istenenYerel, adres: ollamaAdres }) });
  }
  const baslangic = secenekler.some((s) => s.ad === istek) ? istek! : VARSAYILAN_BEYIN;
  if (istek && baslangic !== istek) {
    console.warn(`[BEYIN] bilinmeyen beyin '${istek}', ${VARSAYILAN_BEYIN} ile başlanıyor`);
  }
  const secici = new SecilebilirBeyin(secenekler, baslangic, {
    bildir: (o) => {
      if (o.tur === "gecti") {
        sema.ariza("beyin", false);
        sema.not("beyin", kisaAd(beyin.ad));
        sema.lob("beyin", yereldenModel(o.hedef) !== null ? "yerel" : "bulut");
        // Yerel model seçildiyse ŞİMDİ belleğe yüklenir: soğuk yükleme 5–15 sn
        // ve bunu Ozyn'in ilk cümlesi ödememeli.
        const ic = secici.ic;
        if (ic instanceof OllamaBeyni) void ic.isit();
        seciminiHatirla(o.hedef);
        gunluk.ekle("iyi", "beyin", `sol lob değişti: ${beyin.ad}`);
        b.altyazi(`düşünce artık ${beyin.ad}`, 2600);
      } else {
        gunluk.ekle("hata", "beyin", `${o.hedef} beynine geçilemedi: ${o.sebep}`);
        b.altyazi(`geçilemedi: ${o.sebep}`, 3200);
      }
    },
  });
  const beyin: Beyin = secici;
  console.log(`[BEYIN] seçenekler: ${secici.secenekAdlari().join(", ")} · başlangıç: ${secici.aktif}`);
  sema.lob("beyin", istenenYerel && baslangic === istek ? "yerel" : "bulut");

  // ── OLLAMA TARAMASI: kurulu modeller açılışta seçenek olur ───────────
  //
  // Beklenmez: Ollama kapalıysa oda 2,5 sn donmamalı. Sonuç gelince
  // seçenekler EKLENİR (var olan ad ezilmez) ve seçici penceresi tazelenir.
  // Kapalıysa bu da görünür: pencerede "Ollama yok — ollama serve".
  let ollamaKatalogu: OllamaKatalogu | null = null;
  const ollamayiTara = async (): Promise<void> => {
    const k = await tara.ollama({ adres: ollamaAdres });
    ollamaKatalogu = k;
    const eklenen = secici.secenekEkle(yerelSecenekler(k));
    if (k.ulasildi) {
      console.log(`[OLLAMA] ${k.surum ?? "?"} · ${k.modeller.length} model (${eklenen} yeni seçenek): ` +
        k.modeller.map((m) => `${m.ad}${m.yuklu ? "*" : ""}`).join(", "));
    } else {
      console.warn(`[OLLAMA] taranamadı: ${k.hata}`);
    }
    b.tazele();
  };
  const ollamaHazir = ollamayiTara();

  // ── OPENCODE TARAMASI: bağlı sağlayıcıların araçlı+ücretsiz modelleri ─
  //
  // Aynı kalıp: beklenmez, sonuç gelince seçenekler EKLENİR. Yeni sağlayıcı
  // (NVIDIA gibi) eklemek burayı DEĞİŞTİRMEZ — OpenCode'a kimlik bilgisi
  // girilince tarama onu otomatik bulur (bkz. `opencodeKatalog.ts`).
  const opencodeAdres = q.get("opencode") || undefined;
  let opencodeKatalogu: OpenCodeKatalogu | null = null;
  const opencodeyiTara = async (): Promise<void> => {
    const k = await tara.opencode({ adres: opencodeAdres });
    opencodeKatalogu = k;
    const eklenen = secici.secenekEkle(bulutSecenekler(k, { sifre: q.get("sifre") || undefined }));
    if (k.ulasildi) {
      console.log(`[OPENCODE] ${k.saglayicilar.join(", ") || "sağlayıcı yok"} · ${k.modeller.length} model (${eklenen} yeni seçenek)`);
    } else {
      console.warn(`[OPENCODE] taranamadı: ${k.hata}`);
    }
    b.tazele();
  };
  const opencodeHazir = opencodeyiTara();

  // ── API TARAMASI (spec 13 Faz 3): anahtarı M seçicide girilmiş sağlayıcılar ──
  //
  // Anahtar ana süreçte, şifreli (host/anahtarDeposu.js); burası yalnız "hangi
  // sağlayıcıda anahtar var" ve model listesini görür. Electron dışında (vite dev)
  // köprü yok: bölüm görünmez, tarama boş döner.
  const kabuk = b.kabuk;
  const apiIstemci: (ApiIstemcisi & { modeller(s: string): Promise<ApiSonucu> }) | null =
    kabuk ? {
      durum: () => kabuk.apiDurum(),
      modeller: (s) => kabuk.apiModeller(s),
      sohbet: (s, govde) => kabuk.apiSohbet(s, govde),
    } : null;
  let apiKatalogu: ApiKatalogu | null = null;
  let apiKayitli: { ad: string; adres: string; kalici: boolean }[] = [];
  const apiyiTara = async (): Promise<void> => {
    if (!apiIstemci || !kabuk) return;
    try { apiKayitli = (await kabuk.apiDurum()).map(({ ad, adres, kalici }) => ({ ad, adres, kalici })); }
    catch { apiKayitli = []; }
    const k = await apiTara(apiIstemci);
    apiKatalogu = k;
    const eklenen = secici.secenekEkle(apiSecenekler(k, apiIstemci));
    if (apiKayitli.length) {
      console.log(`[API] ${apiKayitli.map((x) => x.ad).join(", ")} · ${k.modeller.length} model (${eklenen} yeni seçenek)` +
        (k.hatalar.length ? ` · hata: ${k.hatalar.map((h) => `${h.saglayici}: ${h.hata}`).join("; ")}` : ""));
    }
    b.tazele();
  };
  const apiHazir = apiyiTara();
  const ilkTarama = Promise.all([ollamaHazir, opencodeHazir, apiHazir]);

  // SON SEÇİM HATIRLANIR — ama yalnızca elle açılışta. Senaryolar (`*dene`,
  // hepsi `sessiz=1` taşır) ve `?beyin=` açılış beynini KESİN bilmeli; bir
  // önceki oturumda kalmış tercih ölçüm koşusunun beynini sessizce
  // değiştirirse iki koşu artık aynı düzenek değildir.
  const hatirlasin = !q.has("beyin") && !q.has("sessiz");
  function seciminiHatirla(ad: string): void {
    if (!hatirlasin) return;
    b.depo.yaz(HATIRA_ANAHTARI, ad);
  }
  if (hatirlasin) {
    const onceki = b.depo.oku(HATIRA_ANAHTARI);
    if (onceki && onceki !== secici.aktif) {
      // Tarama bitince: yerel/bulut model ancak o zaman seçenek olur. Geçiş
      // yine sağlık kontrolünden geçer; model silindiyse varsayılan kalır ve
      // sebep günlükte okunur.
      void ilkTarama.then(() => {
        if (!secici.secenekVarMi(onceki)) {
          console.warn(`[BEYIN] hatırlanan beyin '${onceki}' artık yok, ${secici.aktif} kalıyor`);
          return;
        }
        console.log(`[BEYIN] son seçim hatırlandı: ${onceki}`);
        secici.iste(onceki);
      });
    }
  }

  // KAYIT: `?kayit=1` ile her tur `[BEYIN:KAYIT] {json}` olarak günlüğe düşer.
  // Sonra `tools/beyin-ayikla.mjs` fixture üretir, `tools/beyin-tekrar.ts`
  // onları sahne olmadan istediğin beyne oynatır — Python'da beyin yazarken
  // asıl geliştirme döngün bu olmalı.
  const kopruBeyni: Beyin = q.has("kayit") ? new KayitBeyni(beyin) : beyin;
  if (q.has("kayit")) console.log("[KAYIT] beyin turlari gunluge yaziliyor");

  /**
   * Devre kesici iki beyinde var: OpenCode (sağlayıcı kotası) ve MCP (ajanla
   * TEMAS kopması — spec 05 R1: ajan ölünce Orion susmasın, sağ lob devralsın).
   * Arayüze eklemek uygulama ayrıntısını sözleşmeye sızdırmak olurdu; onun
   * yerine burada tip koruması ile sorulur.
   */
  const kesikSn = (): number => {
    const ic = secici.ic;
    return ic instanceof OpenCodeBeyni || ic instanceof McpBeyin ? ic.kesikSaniye : 0;
  };
  console.log(`[BEYIN] ${beyin.ad}`);
  sema.not("beyin", kisaAd(beyin.ad));
  gunluk.ekle("bilgi", "beyin", `sol lob bağlandı: ${beyin.ad}`);
  sema.durumYaz("beyin bağlı, algı bekleniyor");

  return {
    secici, kopruBeyni, kesikSn,
    hepsiniTara: async () => { await Promise.all([ollamayiTara(), opencodeyiTara(), apiyiTara()]); },
    // Sonuç ya da hata: test ve çağıran yalnız "bitti mi" sorar (taramalar hatayı kendileri yutar).
    hazir: ilkTarama.then(() => undefined, () => undefined),
    kataloglar: () => ({ ollama: ollamaKatalogu, opencode: opencodeKatalogu, api: apiKatalogu }),
    apiKayitli: () => apiKayitli,
  };
}

/**
 * M seçicinin kaynağı. Yazma yolu İKİNCİ BİR YOL DEĞİL: pencerenin seçimi devre panosunun
 * teyit yolundan geçer (`beyin.model` tehlikeli sınıfta). Pencere teyidi kendisi soruyor (iki
 * adımlı Enter), burada onaylanıyor. Böylece günlük, liste dışı değer kontrolü ve "bekleyen
 * ezilemez" kuralı tek kaynakta kalır.
 */
export function seciciKaynagiKur(
  s: BeyinSecimi,
  pano: Pick<Pano, "bekleyenTeyit" | "teyitIptal" | "teyitIste" | "teyitliYaz">,
  kabuk: KabukApi | null,
): ModelSeciciKaynagi {
  const { secici } = s;
  return {
    // API anahtarı bölümü (spec 13 Faz 3): anahtar yalnız `kaydet` ile ana sürece gider.
    ...(kabuk ? { api: {
      saglayicilar: API_SAGLAYICILARI,
      kayitli: () => s.apiKayitli(),
      kaydet: async (ad: string, adres: string, anahtar: string) => {
        const r = await kabuk.apiKaydet(ad, adres, anahtar);
        return r.ok ? "" : r.hata;
      },
      sil: async (ad: string) => {
        const r = await kabuk.apiSil(ad);
        return r.ok ? "" : r.hata;
      },
    } } : {}),
    kartlar: () => {
      const k = s.kataloglar();
      return kartlariKur(secici.secenekAdlari(), k.ollama, k.opencode, k.api);
    },
    durum: () => {
      const g = secici.gecis;
      return {
        aktif: secici.aktif, istenen: secici.istenen, gecis: g.tur,
        ...(g.tur !== "sakin" ? { hedef: g.hedef } : {}),
        ...(g.tur === "reddedildi" ? { sebep: g.sebep } : {}),
      };
    },
    sec: (ad) => {
      const bekleyen = pano.bekleyenTeyit();
      // Duvarda AÇIK bir beyin teyidi varsa bu seçim onun yerine geçer (aynı
      // soru, yeni cevap). Başka bir düğmenin teyidi EZİLMEZ: sebebi söylenir.
      if (bekleyen?.dugmeAdi === "beyin.model") pano.teyitIptal();
      const t = pano.teyitIste("beyin.model", ad);
      if (t.sebep !== "teyit bekleniyor") return t.sebep || "teyit açılamadı";
      const acilan = pano.bekleyenTeyit();
      if (!acilan || acilan.dugmeAdi !== "beyin.model" || acilan.yeni !== ad) return "teyit kayboldu";
      const y = pano.teyitliYaz(acilan.jeton);
      return y.oldu ? "" : y.sebep;
    },
    yenile: s.hepsiniTara,
    tarama: () => {
      const o = s.kataloglar().ollama;
      return o && {
        ulasildi: o.ulasildi, surum: o.surum,
        modelSayisi: o.modeller.length, an: o.an,
        ...(o.hata ? { hata: o.hata } : {}),
      };
    },
  };
}

/** Konsol ve senaryolar için `window.orionModel` (uygulama/pencereKancalari.ts). */
export function modelKancasiKur(s: BeyinSecimi, ac: () => void): OrionModelKancasi {
  return {
    ac,
    tara: s.hepsiniTara,
    katalog: () => s.kataloglar().ollama,
    bulutKatalog: () => s.kataloglar().opencode,
    // spec 13 Faz 3: API kataloğu ve `apidene` senaryosunun seçiciye erişimi.
    apiKatalog: () => s.kataloglar().api,
    secenekVarMi: (ad: string) => s.secici.secenekVarMi(ad),
    iste: (ad: string) => s.secici.iste(ad),
    aktif: () => s.secici.aktif,
  };
}
