// uygulama/sekans/sekansDeposu.test.ts — sekans deposu (spec 36): bozuk JSON/biçim diske GİTMEZ, ad = dosya adı, kanonik metin gidiş-dönüş, SİL = kaynağın
// KALDIR'ı, yeniden adlandır/kopya (ortak çekirdek), "＋ Yeni"nin çalışan örneği; repodaki örnekler (liste = klasör, hepsi geçerli, klipleri var).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { DosyaKaynagi } from "../dosyaDeposu.ts";
import { klipKutuphanesiKur, klipleriYukle } from "../../world/avatar/klipKutuphanesi.ts";
import { eksikKlipler } from "./degerlendir.ts";
import { ORNEK_DIZINI, ornekleriYukle } from "./ornekler.ts";
import { sekansDeposuKur, sekansMetni, sekansMetniCoz, yeniSekans, yerelSekansKaynagi } from "./sekansDeposu.ts";

function sayanKaynak() {
  const m = new Map<string, string>();
  const k = yerelSekansKaynagi({ getItem: (a) => m.get(a) ?? null, setItem: (a, v) => { m.set(a, v); } }, () => 7);
  const yazilan: string[] = [], silinen: string[] = [];
  const sayan: DosyaKaynagi = {
    ...k, yaz: async (ad, metin) => { yazilan.push(ad); await k.yaz(ad, metin); }, yeni: async (ad, metin) => { yazilan.push(ad); await k.yeni(ad, metin); },
    sil: async (ad) => { silinen.push(ad); await k.sil!(ad); },
  };
  return { k: sayan, yazilan, silinen };
}

test("kanonik metin gidiş-dönüş (yeni sekans şablonu)", () => {
  const s = yeniSekans("selam", "orion");
  const r = sekansMetniCoz(sekansMetni(s));
  assert.deepEqual(r.ok ? r.deger : r, s);
});

test("BOZUK diske GİTMEZ: JSON hatası ve biçim hatası nedenle reddedilir, kaynağa yazım olmaz", async () => {
  const s = sayanKaynak();
  const d = sekansDeposuKur(s.k);
  await d.baslat();
  await d.yeni(yeniSekans("selam", "orion"));
  s.yazilan.length = 0;
  await assert.rejects(d.yaz("selam", "{bozuk"), /JSON okunamadı/);
  await assert.rejects(d.yaz("selam", sekansMetni({ ...yeniSekans("selam", "orion"), fps: 60 as 30 })), /biçim: fps: yalnız 30/);
  assert.deepEqual(s.yazilan, []);
});

test("içerikteki ad dosya adından farklıysa kaydedilmez (başka adla = ＋ Yeni)", async () => {
  const s = sayanKaynak();
  const d = sekansDeposuKur(s.k);
  await d.baslat();
  await d.yeni(yeniSekans("selam", "orion"));
  await assert.rejects(d.yaz("selam", sekansMetni(yeniSekans("baska", "orion"))), /sekansın adı \('baska'\) dosyanın adıyla \('selam'\) aynı olmalı/);
});

test("liste: süre ve ajanlar kartta; SİL kaynağın kaldırmasıdır", async () => {
  const s = sayanKaynak();
  const d = sekansDeposuKur(s.k);
  await d.baslat();
  await d.yeni(yeniSekans("selam", "flash"));
  const kart = d.liste().map((x) => [x.ad, x.sure_kare, x.ajanlar, x.hata]);
  await d.sil("selam");
  assert.deepEqual([kart, s.silinen, d.liste()], [[["selam", 90, ["flash"], null]], ["selam"], []]);
});

test("yeniden adlandır = yeni + kaldır (ortak çekirdek); kopya aynı içerik yeni ad; var olan ada yazmaz", async () => {
  const s = sayanKaynak();
  const d = sekansDeposuKur(s.k);
  await d.baslat();
  await d.yeni(yeniSekans("selam", "orion"));
  await d.yenidenAdlandir("selam", "merhaba");
  await d.kopyasiniOlustur("merhaba", "merhaba_kopya");
  await assert.rejects(d.kopyasiniOlustur("merhaba", "merhaba_kopya"), /zaten var/);
  assert.deepEqual([d.liste().map((x) => x.ad), s.silinen, d.al("merhaba_kopya")?.ad], [["merhaba", "merhaba_kopya"], ["selam"], "merhaba_kopya"]);
});

test("＋ Yeni sekans BOŞ SAYFA DEĞİL: kütüphanedeki bir klibi ve bir uzuv izini taşır", () => {
  const s = yeniSekans("x", "orion");
  assert.deepEqual(s.izler.map((i) => i.tur), ["klip", "uzuv"]);
});

// ── repodaki örnekler ──

const ASSETS = new URL("../../assets/", import.meta.url);
const oku = (yol: string) => readFile(new URL(yol, ASSETS), "utf8");

test("BEKÇİ: assets/sekans/liste.json klasördeki dosyalarla AYNI (unutulan da, olmayan da kırmızı)", async () => {
  const disk = readdirSync(new URL(`${ORNEK_DIZINI}/`, ASSETS)).filter((f) => f.endsWith(".json") && f !== "liste.json").map((f) => f.replace(/\.json$/, "")).sort();
  const liste = (JSON.parse(await oku(`${ORNEK_DIZINI}/liste.json`)) as string[]).sort();
  assert.deepEqual(liste, disk);
});

test("örnekler HATASIZ yüklenir: selamlasma ve dusun_onayla", async () => {
  const r = await ornekleriYukle(oku);
  assert.deepEqual([r.ornekler.map((s) => s.ad), r.hatalar], [["selamlasma", "dusun_onayla"], []]);
});

test("örneklerin bütün klip bölümleri KÜTÜPHANEDE var (oynatıcı eksik klipte reddederdi)", async () => {
  const k = klipKutuphanesiKur();
  const kl = await klipleriYukle(oku);
  k.doldur(kl.klipler, kl.hatalar);
  const r = await ornekleriYukle(oku);
  assert.deepEqual(r.ornekler.map((s) => eksikKlipler(s, k)), [[], []]);
});

test("örnekler Orion'a bağlı (senaryo koşusunda Flash kurulmaz: sekansdene Orion'la oynatır)", async () => {
  const r = await ornekleriYukle(oku);
  assert.deepEqual(r.ornekler.map((s) => s.baglamalar.map((b) => b.ajan)), [["orion"], ["orion"]]);
});
