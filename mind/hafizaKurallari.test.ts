// mind/hafizaKurallari.test.ts — Kural tablosu ile bugünkü kod (`aniKaydi`) DENK mi (Markov spike 1, E1) + biçim (E2, E6, E7).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Algi } from "../protocol/algi.ts";
import type { AniTuru } from "./hafiza.ts";
import { aniKaydi } from "./aniSuzgeci.ts";
import { uygula, kayitDan, grafik, degiskenler, VARSAYILAN_TABLO, type Tablo } from "./hafizaKurallari.ts";

const satirlar = (n: number) => Array.from({ length: n }, (_, i) => `satir ${i + 1}`).join("\n");
const SOZLER = ["merhaba orion", "nasılsın", "tamam", "hey", "otur", "gece yap", "bana gel", "takip et", "temiz sohbet", "ben terminalde claude kullanırım", "gçz", "orion", ""];
const TERMINALLER = ["ok", satirlar(30), "tests 12 passed", "built in 2s", "(komut çıktı üretmedi)", satirlar(13) + "\nbuilt in 3s"];
const SONUC_NOTLARI: (string | undefined)[] = ["ortam efekt: \"ac\" geçersiz", "ortam shader: geçersiz", "başka hata", undefined];
const SONUC_METINLERI = ["hata: masaya oturamadım: 'otur' kesildi", "hata: bilinmeyen çapa/nesne: 'yönetim terminali'.", "tamam", "hata: ortam shader: geçersiz (x)"];
const TURLER: AniTuru[] = ["konusma", "olay", "terminal", "sonuc", "dusunce", "olgu"];

/** Bugünkü kodun bütün algı türleri × kaynak × içerik sınıfları × AniTuru × politika ızgarası. */
function izgara(): { a: Algi; icerik: string; tur: AniTuru; politika: "yeni" | "eski" }[] {
  const girdiler: { a: Algi; icerik: string }[] = [];
  girdiler.push({ a: { tur: "olay", ad: "ozyn_yaklasti" }, icerik: "ozyn_yaklasti" });
  girdiler.push({ a: { tur: "yakin", nesneler: [] }, icerik: "yakin: x" });
  for (const m of SOZLER) for (const kaynak of [undefined, "klavye", "mikrofon"] as const) {
    girdiler.push({ a: { tur: "duydum", metin: m, kesin: true, ...(kaynak ? { kaynak } : {}) }, icerik: m });
  }
  for (const k of TERMINALLER) for (const kod of [undefined, 0, 1]) {
    girdiler.push({ a: { tur: "terminal", kuyruk: k, kesildi: false, ...(kod !== undefined ? { kod } : {}) }, icerik: k });
  }
  for (const durum of ["bitti", "hata", "iptal"] as const) for (const not of SONUC_NOTLARI) for (const metin of SONUC_METINLERI) {
    girdiler.push({ a: { tur: "sonuc", sonuc: { niyet_id: "n1", durum, ...(not !== undefined ? { not } : {}) } }, icerik: metin });
  }
  const cikti: { a: Algi; icerik: string; tur: AniTuru; politika: "yeni" | "eski" }[] = [];
  for (const g of girdiler) for (const tur of TURLER) for (const politika of ["yeni", "eski"] as const) cikti.push({ ...g, tur, politika });
  return cikti;
}

test("E1 denklik: kural tablosu bugünkü aniKaydi ile aynı kararı verir (tam ızgara)", () => {
  const farklar: string[] = [];
  const g = izgara();
  for (const { a, icerik, tur, politika } of g) {
    const eski = aniKaydi(a, tur, icerik, politika);
    const yeni = uygula(kayitDan(a, tur, icerik, politika));
    const a1 = eski === null ? null : { icerik: eski.icerik, onem: eski.onem };
    const a2 = yeni.yaz ? { icerik: yeni.icerik, onem: yeni.onem } : null;
    if (JSON.stringify(a1) !== JSON.stringify(a2)) farklar.push(`${a.tur}/${tur}/${politika} ${JSON.stringify(icerik).slice(0, 40)} eski=${JSON.stringify(a1)?.slice(0, 60)} yeni=${JSON.stringify(a2)?.slice(0, 60)}`);
  }
  assert.deepEqual(farklar.slice(0, 5), [], `${farklar.length}/${g.length} fark`);
  assert.ok(g.length > 1000, `ızgara küçük: ${g.length}`);
});

test("E2 izlenebilirlik: her sonuç en az bir kural kimliği taşır ve kimlik tabloda vardır", () => {
  const kimlikler = new Set(VARSAYILAN_TABLO.flatMap((g) => g.kurallar.map((k) => k.id)));
  for (const { a, icerik, tur, politika } of izgara()) {
    const s = uygula(kayitDan(a, tur, icerik, politika));
    assert.ok(s.izler.length > 0, "kuralsız çıktı");
    for (const id of s.izler) assert.ok(kimlikler.has(id), `tabloda olmayan kimlik: ${id}`);
  }
});

test("E6 serileştirme: tablo JSON'a gidip gelince aynı kararı verir", () => {
  const geri: Tablo = JSON.parse(JSON.stringify(VARSAYILAN_TABLO));
  for (const { a, icerik, tur, politika } of izgara()) {
    const k = kayitDan(a, tur, icerik, politika);
    assert.deepEqual(uygula(k, geri), uygula(k, VARSAYILAN_TABLO));
  }
});

test("E7 grafik: yalnız tablodan türer; her kural tam bir düğüm; kimlikler tekil; her kenarın uçları var", () => {
  const { dugumler, kenarlar } = grafik();
  const kimlikler = dugumler.map((d) => d.id);
  assert.equal(new Set(kimlikler).size, kimlikler.length, "düğüm kimliği tekrar ediyor");
  const kurallar = VARSAYILAN_TABLO.flatMap((g) => g.kurallar.map((k) => k.id));
  assert.deepEqual(dugumler.filter((d) => d.tur === "kural").map((d) => d.id), kurallar);
  for (const e of kenarlar) assert.ok(kimlikler.includes(e.kimden) && kimlikler.includes(e.kime), `uçsuz kenar: ${e.kimden} → ${e.kime}`);
  const atlar = VARSAYILAN_TABLO.flatMap((g) => g.kurallar).filter((k) => k.sonuc.islem === "at").map((k) => k.id);
  assert.deepEqual(kenarlar.filter((e) => e.tur === "at").map((e) => e.kimden), atlar);
});

test("değişken düzenleme: önem değişkenini değiştirmek kararı değiştirir (kural yapısına dokunmadan)", () => {
  const tablo: Tablo = JSON.parse(JSON.stringify(VARSAYILAN_TABLO));
  const komut = tablo.flatMap((g) => g.kurallar).find((k) => k.id === "komut.dusuk")!;
  assert.deepEqual(degiskenler(komut), [{ ad: "önem", deger: 3 }]);
  if (komut.sonuc.islem === "onem") komut.sonuc.deger = 5;
  const k = kayitDan({ tur: "duydum", metin: "otur", kesin: true }, "konusma", "otur");
  assert.equal(uygula(k, VARSAYILAN_TABLO).yaz && (uygula(k, VARSAYILAN_TABLO) as { onem: number }).onem, 3);
  assert.equal((uygula(k, tablo) as { onem: number }).onem, 5);
});

test("tablo ÖNEM kuralı eşleşmezse sessiz geçmez, fırlatır", () => {
  const eksik: Tablo = [{ id: "onem", ad: "ÖNEM", kurallar: [{ id: "yalniz.olay", aciklama: "x", kosul: { tur: "olay" }, sonuc: { islem: "onem", deger: 4 } }] }];
  assert.throws(() => uygula(kayitDan({ tur: "duydum", metin: "x", kesin: true }, "konusma", "x"), eksik), /ÖNEM kuralı eşleşmedi/);
});
