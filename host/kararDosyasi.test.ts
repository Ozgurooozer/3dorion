// host/kararDosyasi.test.ts — Karar kaydı diskte: yalnızca karar satırı,
// yalnızca geçerli JSON, sırasıyla, günün dosyasına.
//
// Hedeflenen çöküş biçimleri:
//   - renderer'ın başka günlük satırları kayda karışır (önek denetimi yok)
//   - bozuk bir satır dosyaya girer ve onu okuyan her araç kırılır
//   - önek iki yerde ayrı yazılır ve biri değişince kayıt sessizce durur
//   - yazılamayan disk ana süreci çökertir
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KARAR_ONEKI, gunlukYol, kararSatiriMi, kararYaziciKur } from "./kararDosyasi.js";
import { KARAR_ONEKI as KAYIT_ONEKI } from "../mind/kararKaydi.ts";

function geciciDizin(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "orion-karar-"));
}

const satir = (govde: object) => `${KARAR_ONEKI} ${JSON.stringify(govde)}`;

test("önek renderer'daki kayıtla aynı — biri değişirse kayıt sessizce durmasın", () => {
  assert.equal(KARAR_ONEKI, KAYIT_ONEKI);
});

test("yalnızca önek ve boşlukla başlayan mesaj karar satırıdır", () => {
  const ornekler: [unknown, boolean][] = [
    [`${KARAR_ONEKI} {}`, true],
    [`${KARAR_ONEKI}{}`, false],
    [`[BEYIN:girdi] ozet=1`, false],
    [` ${KARAR_ONEKI} {}`, false],
    [42, false],
    [undefined, false],
  ];
  for (const [mesaj, beklenen] of ornekler) assert.equal(kararSatiriMi(mesaj), beklenen, `mesaj: ${String(mesaj)}`);
});

test("günlük dosya adı YEREL tarihten: YYYY-MM-DD.jsonl", () => {
  // Gece yarısından hemen sonra: UTC'nin önünde bir saat diliminde (İstanbul)
  // UTC tarihi hâlâ bir önceki gündür — yanlışlıkla UTC kullanan kod burada düşer.
  const yol = gunlukYol("/kok", new Date(2026, 8, 8, 0, 30));
  assert.equal(path.basename(yol), "2026-09-08.jsonl");
});

test("karar satırı günün dosyasına önekisiz, satır başına bir JSON olarak eklenir", () => {
  const kok = geciciDizin();
  const y = kararYaziciKur({ kok, simdi: () => new Date(2026, 8, 27) });
  y.yaz(satir({ tur: "oturum", o: "o1" }));
  y.yaz(satir({ tur: "algi", id: "a1" }));
  const icerik = fs.readFileSync(path.join(kok, "2026-09-27.jsonl"), "utf8");
  assert.deepEqual(icerik.trim().split("\n").map((s) => JSON.parse(s).tur), ["oturum", "algi"]);
});

test("karar satırı olmayan mesaj yazılmaz ve false döner", () => {
  const kok = geciciDizin();
  const y = kararYaziciKur({ kok });
  assert.deepEqual({ donen: y.yaz("[renderer] merhaba"), dosya: fs.readdirSync(kok).length }, { donen: false, dosya: 0 });
});

test("bozuk JSON yazılmaz ama sayılır", () => {
  const kok = geciciDizin();
  const y = kararYaziciKur({ kok });
  y.yaz(`${KARAR_ONEKI} {bozuk`);
  assert.deepEqual({ bozuk: y.sayac().bozuk, dosya: fs.readdirSync(kok).length }, { bozuk: 1, dosya: 0 });
});

test("sabit dosya verilirse her şey oraya yazılır — deneme koşusu kendi kaydını tutar", () => {
  const d = geciciDizin();
  const hedef = path.join(d, "alt", "deneme.jsonl");
  const y = kararYaziciKur({ kok: path.join(d, "kullanilmamali"), sabitDosya: hedef });
  y.yaz(satir({ tur: "oturum" }));
  assert.deepEqual({ var: fs.existsSync(hedef), kok: fs.existsSync(path.join(d, "kullanilmamali")) }, { var: true, kok: false });
});

test("gün değişince yeni dosyaya geçilir", () => {
  const kok = geciciDizin();
  let gun = new Date(2026, 8, 27, 23, 59);
  const y = kararYaziciKur({ kok, simdi: () => gun });
  y.yaz(satir({ tur: "algi", id: "a1" }));
  gun = new Date(2026, 8, 28, 0, 1);
  y.yaz(satir({ tur: "algi", id: "a2" }));
  assert.deepEqual(fs.readdirSync(kok).sort(), ["2026-09-27.jsonl", "2026-09-28.jsonl"]);
});

test("yazılamayan disk fırlatmaz; hata sayılır ve bir kez uyarılır", () => {
  const d = geciciDizin();
  // Hedef bir KLASÖR: ekleme her seferinde başarısız olur.
  const hedef = path.join(d, "klasor");
  fs.mkdirSync(hedef);
  const uyarilar: string[] = [];
  const y = kararYaziciKur({ sabitDosya: hedef, uyar: (m) => uyarilar.push(m) });
  y.yaz(satir({ tur: "algi" }));
  y.yaz(satir({ tur: "algi" }));
  assert.deepEqual({ hata: y.sayac().hata, uyari: uyarilar.length }, { hata: 2, uyari: 1 });
});
