// host/sesIndir.js — KATALOGDAKİ bir Piper sesini indir (spec 34). YALNIZ ana süreç (fetch + node:fs).
//
// Kurallar (hepsi testli, gerçek ağ YOK: testler yerel http sunucusuyla koşar):
//   • ATOMİK: iki dosya önce `<ad>.onnx.json.part` ve `<ad>.onnx.part` olarak iner, İKİSİ de doğrulanınca yeniden adlandırılır — önce json, EN SON onnx.
//     Kurulu ses taraması (host/sesler.js) `.onnx`'i ancak eşi olan json varken sayar; böylece yarım bir çift hiçbir an "kurulu ses" görünmez.
//   • DOĞRULAMA: HTTP 2xx; yazılan bayt = Content-Length (varsa); boyut katalogdakine ±%20 yakın (sunucu bambaşka bir şey verirse durur);
//     json gerçekten ayrıştırılır ve nesnedir. Biri tutmazsa HATA (`kod`: ag | boyut | bozuk | iptal).
//   • YARIM DOSYA YOK: hata ya da iptalde `.part` dosyaları silinir; var olan kurulu dosyalara hiç dokunulmaz.
//   • İLERLEME: `ilerleme({ ad, dosya, alinan, toplam })` en çok ~4 kez/sn (IPC'yi boğmasın) ve her dosyanın sonunda.
"use strict";
import fs from "node:fs";
import path from "node:path";
import { HF_KOK, sesAdi, sesAdresi } from "./sesler.js";

const hata = (kod, mesaj) => Object.assign(new Error(mesaj), { kod });
const BOYUT_PAYI = 0.2;
const ILERLEME_ARALIGI_MS = 250;

async function dosyaIndir({ adres, hedef, beklenen, getir, sinyal, bildir }) {
  let yanit;
  try { yanit = await getir(adres, { redirect: "follow", signal: sinyal }); }
  catch (e) { throw sinyal?.aborted ? hata("iptal", "indirme iptal edildi") : hata("ag", `bağlanılamadı: ${e?.message ?? e}`); }
  if (!yanit.ok || !yanit.body) throw hata("ag", `HTTP ${yanit.status} (${adres})`);
  const basliktaki = Number(yanit.headers.get("content-length"));
  const toplam = Number.isFinite(basliktaki) && basliktaki > 0 ? basliktaki : beklenen;
  if (Math.abs(toplam - beklenen) > beklenen * BOYUT_PAYI) throw hata("boyut", `sunucu ${toplam} bayt bildiriyor, katalog ≈${beklenen} bekliyor (${path.basename(hedef)})`);
  const yazici = fs.createWriteStream(hedef);
  const bitti = new Promise((coz, red) => { yazici.on("finish", coz); yazici.on("error", red); });
  let alinan = 0, son = 0, bildirilen = -1;
  try {
    const okuyucu = yanit.body.getReader();
    for (;;) {
      const { done, value } = await okuyucu.read();
      if (done) break;
      alinan += value.byteLength;
      if (!yazici.write(value)) await new Promise((c) => yazici.once("drain", c));
      const simdi = Date.now();
      if (simdi - son >= ILERLEME_ARALIGI_MS) { son = simdi; bildirilen = alinan; bildir(alinan, toplam); }
    }
  } catch (e) {
    // Windows açık dosyayı silemez (EBUSY): `.part` temizliğinden önce akış GERÇEKTEN kapansın.
    const kapandi = new Promise((c) => yazici.once("close", c));
    yazici.destroy();
    await kapandi;
    throw sinyal?.aborted ? hata("iptal", "indirme iptal edildi") : hata("ag", `indirme kesildi: ${e?.message ?? e}`);
  }
  yazici.end();
  await bitti;
  if (bildirilen !== alinan) bildir(alinan, toplam);   // son durum bir kez (küçük dosyada döngü zaten bildirdi)
  if (Number.isFinite(basliktaki) && basliktaki > 0 && alinan !== basliktaki) throw hata("boyut", `eksik indi: ${alinan}/${basliktaki} bayt (${path.basename(hedef)})`);
  if (Math.abs(alinan - beklenen) > beklenen * BOYUT_PAYI) throw hata("boyut", `inen ${alinan} bayt, katalog ≈${beklenen} bekliyor (${path.basename(hedef)})`);
  return alinan;
}

/**
 * `ses`: katalog girdisi (host/sesler.js SES_KATALOGU). `dizin`: seslerin dizini (yoksa kurulur). `kok`: deponun kökü (test: yerel sunucu).
 * `getir`: fetch uyumlu işlev (varsayılan küresel fetch). Dönüş: `{ ad, onnx, json }` (bayt). Hata: `kod`lu Error.
 */
export async function sesIndir({ ses, dizin, kok = HF_KOK, getir = globalThis.fetch, ilerleme = () => {}, sinyal }) {
  const ad = sesAdi(ses);
  fs.mkdirSync(dizin, { recursive: true });
  const hedefler = {
    json: { son: path.join(dizin, `${ad}.onnx.json`), adres: sesAdresi(ses, "onnx.json", kok), beklenen: ses.boyut.json },
    onnx: { son: path.join(dizin, `${ad}.onnx`), adres: sesAdresi(ses, "onnx", kok), beklenen: ses.boyut.onnx },
  };
  const parcalar = Object.values(hedefler).map((h) => `${h.son}.part`);
  const temizle = () => { for (const p of parcalar) { try { fs.rmSync(p, { force: true }); } catch { /* temizlik en iyi çaba */ } } };
  try {
    const sonuc = { ad, json: 0, onnx: 0 };
    for (const dosya of /** @type {const} */ (["json", "onnx"])) {
      const h = hedefler[dosya];
      sonuc[dosya] = await dosyaIndir({ adres: h.adres, hedef: `${h.son}.part`, beklenen: h.beklenen, getir, sinyal,
        bildir: (alinan, toplam) => { try { ilerleme({ ad, dosya, alinan, toplam }); } catch { /* ilerleme dinleyicisi indirmeyi bozamaz */ } } });
    }
    let yapi;
    try { yapi = JSON.parse(fs.readFileSync(`${hedefler.json.son}.part`, "utf8")); } catch (e) { throw hata("bozuk", `ses ayar dosyası JSON değil: ${e?.message ?? e}`); }
    if (typeof yapi !== "object" || yapi === null || Array.isArray(yapi)) throw hata("bozuk", "ses ayar dosyası nesne değil");
    // Sıra önemli: json önce, onnx EN SON (bkz. dosya başı).
    fs.renameSync(`${hedefler.json.son}.part`, hedefler.json.son);
    fs.renameSync(`${hedefler.onnx.son}.part`, hedefler.onnx.son);
    return sonuc;
  } catch (e) {
    temizle();
    throw e?.kod ? e : hata("hata", String(e?.message ?? e));
  }
}
