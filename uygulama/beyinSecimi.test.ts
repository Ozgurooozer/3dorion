// uygulama/beyinSecimi.test.ts — Beyin seçimi: açılış beyni, taramalar, hatırlanan seçim, M seçici kaynağı.
//
// Bunlar giris.ts'in içindeyken yalnız canlıda sınanabiliyordu (spec 14 R6). Burada dünya sahtedir:
// taramalar elle kurulmuş katalog döndürür, depo bir Map'tir, şema ve günlük susturulmuştur.
// Ağ: yalnız "geçiş başarılı" testinde `fetch` sahteyle değiştirilir ve geri konur.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  beyinSeciminiKur, seciciKaynagiKur, kisaAd, VARSAYILAN_BEYIN, HATIRA_ANAHTARI, type BeyinSecimiBaglami,
} from "./beyinSecimi.ts";
import { McpBeyin } from "../bridge/mcpBeyin.ts";
import { KayitBeyni } from "../bridge/kayitBeyni.ts";
import type { OllamaKatalogu } from "../bridge/ollamaKatalog.ts";
import type { OpenCodeKatalogu } from "../bridge/opencodeKatalog.ts";
import type { Pano, Teyit, YazmaSonucu } from "../protocol/pano.ts";

/** Kapalı bir port: buraya giden gerçek istek hemen reddedilir. */
const KAPALI = "http://127.0.0.1:9";

const OLLAMA: OllamaKatalogu = {
  adres: KAPALI, ulasildi: true, surum: "0.0-sahte", an: 1,
  modeller: [{
    ad: "m1", boyutBayt: 1, parametre: "1B", aile: "sahte", niceleme: "Q4", degisti: "",
    yuklu: false, vramBayt: 0, yetenekler: ["completion", "tools"],
  }],
};
const OPENCODE_YOK: OpenCodeKatalogu = { adres: KAPALI, ulasildi: false, saglayicilar: [], modeller: [], hata: "sahte", an: 1 };

const gecikmeli = <T>(deger: T): Promise<T> => new Promise((r) => setTimeout(() => r(deger), 5));

/** Sahte dünya. `depo` başlangıç içeriği verilebilir; okuma/yazma sayılır. */
function kur(sorgu: string, depoIcerik: Record<string, string> = {}) {
  const depo = new Map(Object.entries(depoIcerik));
  const sayac = { tazele: 0, depoOku: 0 };
  const baglam: BeyinSecimiBaglami = {
    sorgu,
    mcpBeyin: new McpBeyin(),
    sema: { ariza: () => {}, not: () => {}, lob: () => {}, durumYaz: () => {} },
    gunluk: { ekle: () => {} },
    altyazi: () => {},
    tazele: () => { sayac.tazele++; },
    kabuk: null,
    depo: {
      oku: (k) => { sayac.depoOku++; return depo.get(k) ?? null; },
      yaz: (k, d) => { depo.set(k, d); },
    },
    // Taramalar ZAMAN ALIR (gerçekte ağ): hemen çözülen sahte "taramadan sonra" kuralını
    // "hemen" ile ayırt edemiyordu — bozma denemesi kaçmıştı.
    taraycilar: { ollama: () => gecikmeli(OLLAMA), opencode: () => gecikmeli(OPENCODE_YOK) },
  };
  return { s: beyinSeciminiKur(baglam), depo, sayac };
}

test("bilinmeyen ?beyin= varsayılan beyinle başlar", () => {
  const { s } = kur("?beyin=boyle-bir-beyin-yok&sessiz=1");
  assert.equal(s.secici.aktif, VARSAYILAN_BEYIN);
});

test("?beyin=yerel:<model> taramayı beklemeden açılış beyni olur", () => {
  const { s } = kur(`?beyin=yerel:qwen9&ollama=${KAPALI}&sessiz=1`);
  assert.equal(s.secici.aktif, "yerel:qwen9");
});

test("Ollama taraması modeli seçenek yapar", async () => {
  const { s } = kur("?sessiz=1");
  await s.hazir;
  assert.equal(s.secici.secenekVarMi("yerel:m1"), true);
});

test("her biten tarama M seçicisini tazeler (kabuk yokken API taraması susar)", async () => {
  const { s, sayac } = kur("?sessiz=1");
  await s.hazir;
  assert.equal(sayac.tazele, 2);
});

test("hatırlanan seçim taramalar bitmeden İSTENMEZ", () => {
  const { s } = kur("", { [HATIRA_ANAHTARI]: "yerel:m1" });
  assert.equal(s.secici.istenen, VARSAYILAN_BEYIN);
});

test("hatırlanan seçim taramalar bitince istenir", async () => {
  const { s } = kur("", { [HATIRA_ANAHTARI]: "yerel:m1" });
  await s.hazir;
  assert.equal(s.secici.istenen, "yerel:m1");
  await s.secici.gecisBitti();
});

test("hatırlanan seçim artık yoksa varsayılan kalır", async () => {
  const { s } = kur("", { [HATIRA_ANAHTARI]: "yerel:silinmis" });
  await s.hazir;
  assert.equal(s.secici.istenen, VARSAYILAN_BEYIN);
});

test("senaryo koşusunda (sessiz=1) hatırlanan seçim okunmaz", () => {
  const { sayac } = kur("?sessiz=1", { [HATIRA_ANAHTARI]: "mcp" });
  assert.equal(sayac.depoOku, 0);
});

test("?beyin= verilmişse hatırlanan seçim okunmaz", () => {
  const { sayac } = kur("?beyin=mcp", { [HATIRA_ANAHTARI]: "dis" });
  assert.equal(sayac.depoOku, 0);
});

test("elle açılışta başarılı geçiş depoya yazılır", async () => {
  const asil = globalThis.fetch;
  // Ollama'nın /api/tags cevabı: m1 kurulu → sağlık kontrolü geçer; ısıtma isteği de buraya düşer.
  globalThis.fetch = (async () => new Response(JSON.stringify({ models: [{ name: "m1" }] }))) as typeof fetch;
  try {
    const { s, depo } = kur("");
    await s.hazir;
    s.secici.iste("yerel:m1");
    await s.secici.gecisBitti();
    assert.equal(depo.get(HATIRA_ANAHTARI), "yerel:m1");
  } finally {
    globalThis.fetch = asil;
  }
});

test("?kayit=1 köprüye kayıt sarmalını verir", () => {
  const { s } = kur("?kayit=1&sessiz=1");
  assert.ok(s.kopruBeyni instanceof KayitBeyni);
});

test("?kayit yokken köprü seçicinin kendisini alır", () => {
  const { s } = kur("?sessiz=1");
  assert.equal(s.kopruBeyni, s.secici);
});

test("kısa ad sağlayıcı önekini ve yolu atar", () => {
  assert.deepEqual(
    [kisaAd("opencode:openrouter/inclusionai/ling"), kisaAd("api:ozel/sahte/orion-test"), kisaAd("yerel:m1")],
    ["ling", "orion-test", "yerel:m1"]);
});

/** Sahte pano: teyit iste → bekleyen teyit → teyitli yaz; çağrı sırasını kaydeder. */
function sahtePano() {
  const cagri: string[] = [];
  let bekleyen: Teyit | null = null;
  const sonuc = (oldu: boolean, sebep = ""): YazmaSonucu => ({ oldu, sebep, deger: null });
  const pano: Pick<Pano, "bekleyenTeyit" | "teyitIptal" | "teyitIste" | "teyitliYaz"> = {
    bekleyenTeyit: () => bekleyen,
    teyitIptal: () => { cagri.push("iptal"); bekleyen = null; },
    teyitIste: (dugmeAdi, deger) => {
      cagri.push(`iste ${dugmeAdi}=${String(deger)}`);
      bekleyen = { jeton: "j1", dugmeAdi, etiket: "", eski: "", yeni: deger, uyari: "", eylemler: [], sonTarih: 0 };
      return sonuc(false, "teyit bekleniyor");
    },
    teyitliYaz: (jeton) => { cagri.push(`yaz ${jeton}`); bekleyen = null; return sonuc(true); },
  };
  return { pano, cagri };
}

test("M seçici seçimi pano teyit yolundan geçer", () => {
  const { s } = kur("?sessiz=1");
  const { pano, cagri } = sahtePano();
  const hata = seciciKaynagiKur(s, pano, null).sec("mcp");
  assert.deepEqual([hata, cagri], ["", ["iste beyin.model=mcp", "yaz j1"]]);
});

test("kabuk köprüsü yokken M seçicide API bölümü görünmez", () => {
  const { s } = kur("?sessiz=1");
  assert.equal(seciciKaynagiKur(s, sahtePano().pano, null).api, undefined);
});
