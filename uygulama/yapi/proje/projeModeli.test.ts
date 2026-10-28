// uygulama/yapi/proje/projeModeli.test.ts — proje tarayıcısı modeli (spec 39 D2): kartlar, hata metinleri, yeniden başlatma uyarısı, şablon kimlikleri host'la aynı.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SABLON_ADLARI } from "../../../host/proje.js";
import type { ProjeDurumu } from "../../../host/kopru.ts";
import { SABLONLAR, acmaUyarisi, hataMetni, projeKartlari } from "./projeModeli.ts";

const durum = (projeler: ProjeDurumu["projeler"]): ProjeDurumu => ({ kok: "/k", acik: projeler.find((p) => p.acik)?.ad ?? null, projeler });
const p = (ad: string, ek: Partial<ProjeDurumu["projeler"][number]> = {}): ProjeDurumu["projeler"][number] => ({ ad, dizin: `/k/${ad}`, degisti: 1, son: null, acik: false, ...ek });

test("şablon kimlikleri host'unkilerle AYNI ve sırası aynı (kopya ayrışmasın)", () => {
  assert.deepEqual(SABLONLAR.map((s) => s.id), [...SABLON_ADLARI]);
  for (const s of SABLONLAR) { assert.ok(s.ad && s.aciklama); }
});

test("kartlar: host sırası korunur; açık proje açılamaz; bozuk görünür ama açılamaz ve nedeni yazar; durum metni", () => {
  const k = projeKartlari(durum([p("Cem", { son: 0, acik: true }), p("Ali", { son: 1 }), p("Bora"), p("Bz", { hata: "okunamadı: x" })]));
  assert.deepEqual(k.map((x) => x.ad), ["Cem", "Ali", "Bora", "Bz"]);
  assert.deepEqual(k.map((x) => x.acilabilir), [false, true, true, false]);
  assert.deepEqual(k.map((x) => x.durum), ["açık proje", "yakın zamanda açıldı", "", "bozuk: okunamadı: x"]);
  assert.deepEqual(k.map((x) => [x.acik, x.bozuk]), [[true, false], [false, false], [false, false], [false, true]]);
  assert.equal(projeKartlari(durum([p("Ali", { son: 0 })]))[0]!.durum, "son açılan");
  assert.deepEqual(projeKartlari(durum([])), []);
});

test("hata metni: bilinen kodlar Türkçe ve ayırt edilir; bilinmeyen kod ham mesaj, mesajsızsa kodun kendisi", () => {
  const kodlar = ["gecersiz-ad", "var", "yok", "bozuk", "gecersiz-sablon"];
  const m = kodlar.map((k) => hataMetni(k, "ham"));
  assert.equal(new Set(m).size, kodlar.length);
  assert.ok(m.every((x) => x.length > 8));
  assert.ok(hataMetni("bozuk", "ayrıntı").includes("ayrıntı"));
  assert.equal(hataMetni("garip", "ham mesaj"), "ham mesaj");
  assert.equal(hataMetni("garip", ""), "garip");
});

test("yeniden başlatma uyarısı: kirli sekme yoksa null; varsa adları sayar ve KAYBOLUR der", () => {
  assert.equal(acmaUyarisi([]), null);
  const u = acmaUyarisi(["sekans 'a'", "grafik 'b'"])!;
  assert.ok(u.includes("sekans 'a'") && u.includes("grafik 'b'") && u.includes("KAYBOLUR") && u.includes("tekrar bas"));
});
