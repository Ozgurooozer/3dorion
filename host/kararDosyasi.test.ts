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
import { KARAR_ONEKI, gunlukYol, kararSatiriMi, kararYaziciKur, ogretimYolu, ogretimleriOku, satirlariOku, yeniSatirlar } from "./kararDosyasi.js";
import { KARAR_ONEKI as KAYIT_ONEKI, type KararSatiri } from "../mind/kararKaydi.ts";
import { GOREV_SATIRLARI, gorevSatiriMi } from "../mind/gorev.ts";

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

// ── Öğretim dosyası (toplantı 2026-09-27 K1, K5) ───────────────────────────

test("öğretim dosyası kaydın klasöründe; sabit kipte sabit dosyanın yanında", () => {
  assert.deepEqual(
    [path.basename(ogretimYolu({ kok: "/kok" })), path.dirname(ogretimYolu({ kok: "/kok" })), path.dirname(ogretimYolu({ sabitDosya: "/deneme/canli.jsonl" }))],
    ["ogretim.jsonl", path.normalize("/kok"), path.normalize("/deneme")],
  );
});

test("ogretimleriOku: günlük kipte klasördeki her dosyadan yalnız öğretim satırlarını toplar", () => {
  const kok = geciciDizin();
  fs.writeFileSync(path.join(kok, "2026-09-27.jsonl"), `${JSON.stringify({ tur: "algi", id: "a1" })}\n${JSON.stringify({ tur: "ogretim", t: 1 })}\n`);
  fs.writeFileSync(path.join(kok, "ogretim.jsonl"), `${JSON.stringify({ tur: "ogretim", t: 2 })}\n{bozuk\n`);
  fs.writeFileSync(path.join(kok, "notlar.txt"), `${JSON.stringify({ tur: "ogretim", t: 3 })}\n`);
  assert.deepEqual((ogretimleriOku({ kok }) as { t: number }[]).map((s) => s.t), [1, 2]);
});

test("ogretimleriOku: sabit kipte yalnız sabit dosya ve öğretim dosyası okunur", () => {
  const d = geciciDizin();
  const sabit = path.join(d, "canli.jsonl");
  fs.writeFileSync(sabit, `${JSON.stringify({ tur: "ogretim", t: 1 })}\n`);
  fs.writeFileSync(path.join(d, "ogretim.jsonl"), `${JSON.stringify({ tur: "ogretim", t: 2 })}\n`);
  fs.writeFileSync(path.join(d, "baska.jsonl"), `${JSON.stringify({ tur: "ogretim", t: 9 })}\n`);
  assert.deepEqual((ogretimleriOku({ sabitDosya: sabit }) as { t: number }[]).map((s) => s.t), [1, 2]);
});

test("ogretimleriOku: klasör ya da dosya yoksa boş liste", () => {
  const d = geciciDizin();
  assert.deepEqual([ogretimleriOku({ kok: path.join(d, "yok") }), ogretimleriOku({ sabitDosya: path.join(d, "yok.jsonl") })], [[], []]);
});

test("yeniSatirlar: yalnız TAM satırlar; yarım son satır sonraki okumaya kalır", () => {
  const d = geciciDizin();
  const yol = path.join(d, "ogretim.jsonl");
  fs.writeFileSync(yol, `${JSON.stringify({ n: 1 })}\n{"n":`);
  const ilk = yeniSatirlar(yol, 0);
  fs.appendFileSync(yol, `2}\n`);
  const ikinci = yeniSatirlar(yol, ilk.konum);
  assert.deepEqual([ilk.satirlar, ikinci.satirlar], [[{ n: 1 }], [{ n: 2 }]]);
});

test("yeniSatirlar: dosya kısaldıysa (yeniden yaratıldı) baştan okur; dosya yoksa boş", () => {
  const d = geciciDizin();
  const yol = path.join(d, "ogretim.jsonl");
  fs.writeFileSync(yol, `${JSON.stringify({ n: 7 })}\n`);
  assert.deepEqual([yeniSatirlar(yol, 10_000).satirlar, yeniSatirlar(path.join(d, "yok"), 5)], [[{ n: 7 }], { satirlar: [], konum: 0 }]);
});

// ── Seçilen satırlar (spec 10: beceri defterinin geçmişi) ──────────────────

/** Her türden birer satır: seçimin neyi alıp neyi bıraktığı görünsün. */
const IZGARA = [
  { tur: "oturum", o: "o1", t: 1 },
  { tur: "algi", o: "o1", id: "a1", t: 2, algi: "duydum" },
  { tur: "algi", o: "o1", id: "a2", t: 3, algi: "terminal" },
  { tur: "uyanis", o: "o1", id: "u1", t: 4 },
  { tur: "algi", o: "o1", id: "a3", t: 5, algi: "sonuc" },
  { tur: "algi", o: "o1", id: "a4", t: 6, algi: "olay" },
  { tur: "ogretim", o: "o1", t: 7 },
  { tur: "refleks", o: "o1", id: "r1", t: 8 },
];

test("satirlariOku: türü seçilen satırlar ve algı türü seçilen algı satırları; başkası değil", () => {
  const kok = geciciDizin();
  fs.writeFileSync(path.join(kok, "2026-09-28.jsonl"), `${IZGARA.map((s) => JSON.stringify(s)).join("\n")}\n{bozuk\n`);
  const r = satirlariOku({ kok }, { turler: ["uyanis"], algilar: ["duydum", "sonuc"] }) as { t: number }[];
  assert.deepEqual(r.map((s) => s.t), [2, 4, 5]);
});

test("satirlariOku: seçim kuralı renderer'dakiyle aynı (mind/gorev.ts gorevSatiriMi) — iki yazım ayrışmasın", () => {
  const kok = geciciDizin();
  fs.writeFileSync(path.join(kok, "2026-09-28.jsonl"), `${IZGARA.map((s) => JSON.stringify(s)).join("\n")}\n`);
  assert.deepEqual(satirlariOku({ kok }, GOREV_SATIRLARI), IZGARA.filter((s) => gorevSatiriMi(s as KararSatiri)));
});

test("satirlariOku: günlük kipte dosyalar tarih sırasıyla okunur", () => {
  const kok = geciciDizin();
  fs.writeFileSync(path.join(kok, "2026-09-28.jsonl"), `${JSON.stringify({ tur: "uyanis", t: 2 })}\n`);
  fs.writeFileSync(path.join(kok, "2026-09-27.jsonl"), `${JSON.stringify({ tur: "uyanis", t: 1 })}\n`);
  assert.deepEqual((satirlariOku({ kok }, GOREV_SATIRLARI) as { t: number }[]).map((s) => s.t), [1, 2]);
});

test("satirlariOku: klasör yoksa boş liste", () => {
  assert.deepEqual(satirlariOku({ kok: path.join(geciciDizin(), "yok") }, GOREV_SATIRLARI), []);
});
