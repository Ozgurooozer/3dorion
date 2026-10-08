// world/level/ova/ova.level.test.ts — Ova'nın tanım dosyası bekçisi: geçerli, modülleri bilinen, bütçede.
//
// Panelden kaydedilen dosya bozuksa sayfa açılmaz; bu test aynı şeyi sahnesiz söyler. Bütçe ön kaydı spec 17.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { levelTanimiDogrula, type LevelTanimi } from "../cekirdek/levelTanimi.ts";
import { ayarBirlestir } from "../cekirdek/modul.ts";
import { renkCoz } from "../cekirdek/renk.ts";
import { ucgenSayisi } from "../cekirdek/geometri.ts";
import { MODULLER } from "../moduller/index.ts";
import { gokGeometrisi, type GokAyari } from "../moduller/gok.ts";
import { zeminGeometrisi, zeminYuksekligi, type ZeminAyari } from "../moduller/zemin.ts";
import { bulutGeometrisi, type BulutAyari } from "../moduller/bulut.ts";
import { kayaGeometrisi, type KayaAyari } from "../moduller/kaya.ts";

const ham: unknown = JSON.parse(fs.readFileSync(new URL("./ova.level.json", import.meta.url), "utf8"));
const d = levelTanimiDogrula(ham);

test("ova.level.json geçerli bir level tanımı", () => {
  assert.ok(d.ok, d.ok ? "" : d.hata);
});

const tanim = (): LevelTanimi => { if (!d.ok) throw new Error(d.hata); return d.deger; };

test("her katmanın modülü kayıtlı ve ayarı şemaya uyuyor (yazım hatası yok)", () => {
  for (const k of tanim().katmanlar) {
    const m = MODULLER.get(k.tur);
    assert.ok(m, `bilinmeyen modül: ${k.tur}`);
    assert.doesNotThrow(() => ayarBirlestir(k.tur, m.varsayilan, k.ayar), k.ad);
  }
});

test("katman ayarlarındaki her renk başvurusu çözülüyor (metin ayar = renk, modul.ts kuralı)", () => {
  const t = tanim();
  for (const k of t.katmanlar) {
    const a = ayarBirlestir(k.tur, MODULLER.get(k.tur)!.varsayilan, k.ayar);
    const metinler = Object.values(a).flatMap((x) => (Array.isArray(x) ? x : [x])).filter((x): x is string => typeof x === "string");
    for (const v of metinler) assert.doesNotThrow(() => renkCoz(v, t.palet), `${k.ad}: ${v}`);
  }
});

test("kaya, zeminden SONRA gelir (zemine oturur: katman sırası = bağımlılık sırası)", () => {
  const turler = tanim().katmanlar.filter((k) => k.acik).map((k) => k.tur);
  if (turler.includes("kaya")) assert.ok(turler.indexOf("zemin") !== -1 && turler.indexOf("zemin") < turler.indexOf("kaya"));
});

test("bütçe: açık katmanların toplam üçgeni 80 binin altında", () => {
  const t = tanim();
  const renk = (ad: string) => renkCoz(ad, t.palet);
  const ayar = <A>(tur: string): A | null => {
    const k = t.katmanlar.find((x) => x.tur === tur && x.acik);
    return k ? ayarBirlestir(tur, MODULLER.get(tur)!.varsayilan, k.ayar) as A : null;
  };
  const gok = ayar<GokAyari>("gok"), zemin = ayar<ZeminAyari>("zemin"), bulut = ayar<BulutAyari>("bulut"), kaya = ayar<KayaAyari>("kaya");
  const toplam = (gok ? ucgenSayisi(gokGeometrisi(gok, renk(gok.ufuk), renk(gok.orta), renk(gok.zenit))) : 0)
    + (zemin ? ucgenSayisi(zeminGeometrisi(zemin, renk)) : 0)
    + (bulut ? ucgenSayisi(bulutGeometrisi(bulut, renk(bulut.renk), renk(bulut.golge))) : 0)
    + (kaya ? ucgenSayisi(kayaGeometrisi(kaya, zemin ? zeminYuksekligi(zemin) : () => 0, renk(kaya.renk), renk(kaya.koyu))) : 0);
  assert.ok(toplam < 80_000, String(toplam));
});
