// uygulama/graf/npcDeposu.test.ts — NPC kayıt deposu (spec 35 dilim 3): yazmadan önce biçim doğrulaması (bozuk diske GİTMEZ), ad = dosya adı, kanonik
// metin, bozuk dosyanın listede nedeniyle kalması, SİL = kaynağın KALDIR'ı (kalıcı silme değil), kaynak seçimi. Kurallar grafik deposuyla ORTAK çekirdekte.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { DosyaHatasi, kaynakSec, type DosyaKaynagi } from "../dosyaDeposu.ts";
import { npcDeposuKur, npcMetni, npcMetniCoz, yeniNpcKaydi, yerelNpcKaynagi, YEREL_NPC_ANAHTARI } from "./npcDeposu.ts";

function bellekDeposu() {
  const m = new Map<string, string>();
  return { m, depo: { getItem: (a: string) => m.get(a) ?? null, setItem: (a: string, v: string) => { m.set(a, v); } } };
}
function sayanKaynak() {
  const b = bellekDeposu();
  const k = yerelNpcKaynagi(b.depo, () => 7);
  const yazilan: string[] = [];
  const silinen: string[] = [];
  const sayan: DosyaKaynagi = {
    ...k, yaz: async (ad, metin) => { yazilan.push(ad); await k.yaz(ad, metin); }, yeni: async (ad, metin) => { yazilan.push(ad); await k.yeni(ad, metin); },
    sil: async (ad) => { silinen.push(ad); await k.sil!(ad); },
  };
  return { k: sayan, ham: k, yazilan, silinen, b };
}
const KAYIT = yeniNpcKaydi("kapi", "flash", "nobetci", { parola: "Ay ışığı" });

test("kanonik metin gidiş-dönüş; JSON ve biçim hatası NEDENLE", () => {
  const r = npcMetniCoz(npcMetni(KAYIT));
  assert.deepEqual(r.ok ? r.deger : r, KAYIT);
  const a = npcMetniCoz("{bozuk"), b = npcMetniCoz(JSON.stringify({ ...KAYIT, graflar: [] }));
  assert.deepEqual([a.ok ? "" : a.hata.slice(0, 16), b.ok ? "" : b.hata], ["JSON okunamadı: ", "biçim: graflar boş: NPC'yi süren en az bir olay grafiği olmalı"]);
});

test("yeni → liste (ajan + grafikler) → al; aynı ad 'var'", async () => {
  const s = sayanKaynak();
  const d = npcDeposuKur(s.k);
  await d.baslat();
  await d.yeni(KAYIT);
  assert.deepEqual(d.liste().map((x) => [x.ad, x.ajan, x.graflar, x.hata]), [["kapi", "flash", ["nobetci"], null]]);
  assert.deepEqual(d.al("kapi"), KAYIT);
  await assert.rejects(d.yeni(KAYIT), (e: DosyaHatasi) => e.kod === "var");
});

test("YAZMADAN ÖNCE DOĞRULAMA: bozuk JSON, biçim hatası, ad uyuşmazlığı diske GİTMEZ; eski hâl kalır", async () => {
  const s = sayanKaynak();
  const d = npcDeposuKur(s.k);
  await d.yeni(KAYIT);
  s.yazilan.length = 0;
  await assert.rejects(d.yaz("kapi", "{bozuk"), (e: DosyaHatasi) => e.kod === "gecersiz-icerik" && /JSON/.test(e.message));
  await assert.rejects(d.yaz("kapi", JSON.stringify({ ...KAYIT, parametreler: { p: null } })), /biçim: parametreler\.p/);
  await assert.rejects(d.yaz("kapi", npcMetni({ ...KAYIT, ad: "baska" })), /NPC'nin adı \('baska'\) dosyanın adıyla \('kapi'\) aynı olmalı/);
  assert.deepEqual([s.yazilan, d.al("kapi")?.parametreler], [[], { parola: "Ay ışığı" }]);
  const yazilan = await d.yaz("kapi", JSON.stringify({ ...KAYIT, parametreler: { parola: "Kırmızı" }, fazla: 1 }));
  assert.deepEqual([yazilan, d.al("kapi")?.parametreler], [npcMetni({ ...KAYIT, parametreler: { parola: "Kırmızı" } }), { parola: "Kırmızı" }]);
});

test("bozuk dosya listeden DÜŞMEZ (nedeniyle görünür) ama `al` onu vermez", async () => {
  const s = sayanKaynak();
  await s.ham.yeni("bozuk", "{x");
  await s.ham.yeni("baska", npcMetni({ ...KAYIT, ad: "yanlis" }));
  const d = npcDeposuKur(s.k);
  await d.baslat();
  assert.deepEqual(d.liste().map((x) => [x.ad, x.ajan, x.hata !== null]), [["baska", "flash", true], ["bozuk", null, true]]);
  assert.match(d.liste()[0]!.hata ?? "", /dosya adıyla aynı değil/);
  assert.deepEqual([d.al("bozuk"), d.al("baska")], [null, null]);
});

test("SİL kaynağın KALDIR'ını çağırır (host'ta .silinenler'e taşır); silmeyi bilmeyen kaynakta nedenli hata; geçersiz ad", async () => {
  const s = sayanKaynak();
  const d = npcDeposuKur(s.k);
  await d.yeni(KAYIT);
  await d.sil("kapi");
  assert.deepEqual([s.silinen, d.liste(), d.al("kapi")], [["kapi"], [], null]);
  const { sil: _yok, ...silmez } = s.k;
  await assert.rejects(npcDeposuKur(silmez).sil("x"), /silme yok/);
  await assert.rejects(d.sil("../x"), /geçersiz NPC adı/);
});

test("yerel kaynak kendi anahtarında (grafiklerinkiyle karışmaz); kaynakSec: kabuk yoksa yerel, hiçbiri yoksa NEDENLİ çalışmayan", async () => {
  const b = bellekDeposu();
  const k = yerelNpcKaynagi(b.depo);
  await k.yeni("a", "{}");
  assert.deepEqual([...b.m.keys()], [YEREL_NPC_ANAHTARI]);
  const ipcli = kaynakSec({ liste: async () => ({ ok: true, deger: [] }), oku: async () => ({ ok: true, deger: "" }), yaz: async () => ({ ok: true, deger: true }), yeni: async () => ({ ok: true, deger: true }) },
    () => { throw new Error("yerel seçilmemeliydi"); }, (kod, m) => new DosyaHatasi(kod, m), { ne: "NPC kayıtları", onek: "[NPC]" });
  assert.equal(ipcli.hata, null);
  assert.deepEqual(await ipcli.kaynak.liste(), []);
  const hicbiri = kaynakSec({ liste: async () => ({ ok: true, deger: [] }) }, () => k, (kod, m) => new DosyaHatasi(kod, m), { ne: "NPC kayıtları", onek: "[NPC]" });
  // Node'da localStorage yok (globalThis.localStorage tanımsız): yarım kabuk yerel kaynağa değil, NEDENLİ çalışmayan kaynağa düşer.
  if (typeof (globalThis as { localStorage?: unknown }).localStorage === "undefined") {
    assert.match(hicbiri.hata ?? "", /NPC kayıtları için ne kabuk ne localStorage var/);
    await assert.rejects(hicbiri.kaynak.oku("a"), /ne kabuk ne localStorage/);
  }
});
