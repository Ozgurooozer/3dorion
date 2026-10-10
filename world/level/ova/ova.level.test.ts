// world/level/ova/ova.level.test.ts — Ova'ya ÖZGÜ bekçi: üçgen bütçesi (ön kayıt spec 17).
// Genel denetimler (geçerli, modüller kayıtlı, renkler çözülüyor, katman sırası) bütün level'lar için:
// world/level/leveller.test.ts.
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


const tanim = (): LevelTanimi => { if (!d.ok) throw new Error(d.hata); return d.deger; };

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
