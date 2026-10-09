// world/level/editor/cekirdek/cekirdek.test.ts — Editör çekirdeği (saf): geçmiş, durum, komutlar, seçim, yaslama,
// kısayol haritası, pano (spec 22).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import type { LevelTanimi, NesneYeri } from "../../cekirdek/levelTanimi.ts";
import { ornekTanim } from "../../cekirdek/ornekTanim.ts";
import { gecmisKur } from "./gecmis.ts";
import { editorDurumuKur, type Uygulayici } from "./durum.ts";
import * as K from "./komutlar.ts";
import { secimUygula, secimiTemizle, hepsiniSec, kutudakiler } from "./secim.ts";
import { yasla, etkin, konumYasla, normaleHizaliDonus, YASLAMA_VARSAYILAN } from "./yaslama.ts";
import { KISAYOLLAR, cakismalar, eslesen, tusMetni } from "./kisayol.ts";
import { parcaAl, parcaYerlestir, parcaOku, parcaMetni } from "./pano.ts";

const N = (id: string, x = 0, ek: Partial<NesneYeri> = {}): NesneYeri => ({ id, varlik: "A", konum: [x, 0, 0], donus: 0, olcek: 1, ...ek });
const T = (nesneler: NesneYeri[], ek: Partial<LevelTanimi> = {}): LevelTanimi => ({ ...ornekTanim(), katmanlar: [], nesneler, ...ek });
const idler = (t: LevelTanimi) => (t.nesneler ?? []).map((n) => n.id);

// ── geçmiş ──
test("geri al önceki hâli verir", () => {
  const g = gecmisKur<number>(); g.ekle(1, "a");
  assert.equal(g.geriAl(2)?.hal, 1);
});
test("ileri al geri alınanı verir", () => {
  const g = gecmisKur<number>(); g.ekle(1, "a"); g.geriAl(2);
  assert.equal(g.ileriAl(1)?.hal, 2);
});
test("yeni düzenleme ileri yığınını boşaltır", () => {
  const g = gecmisKur<number>(); g.ekle(1, "a"); g.geriAl(2); g.ekle(1, "b");
  assert.equal(g.ileriSayisi(), 0);
});
test("aynı anahtarlı ardışık adımlar tek adım (sürükleme)", () => {
  const g = gecmisKur<number>(); g.ekle(1, "s", { anahtar: "k", zaman: 0 }); g.ekle(2, "s", { anahtar: "k", zaman: 500 });
  assert.equal(g.geriSayisi(), 1);
});
test("birleşmiş adım geri alınınca EN ESKİ hâle döner", () => {
  const g = gecmisKur<number>(); g.ekle(1, "s", { anahtar: "k", zaman: 0 }); g.ekle(2, "s", { anahtar: "k", zaman: 500 });
  assert.equal(g.geriAl(3)?.hal, 1);
});
test("süre aşılınca aynı anahtar da ayrı adım", () => {
  const g = gecmisKur<number>(); g.ekle(1, "s", { anahtar: "k", zaman: 0 }); g.ekle(2, "s", { anahtar: "k", zaman: 5000 });
  assert.equal(g.geriSayisi(), 2);
});
test("geri aldıktan sonraki aynı anahtarlı adım eskisine kaynaşmaz", () => {
  const g = gecmisKur<number>(); g.ekle(1, "s", { anahtar: "k", zaman: 0 }); g.ekle(2, "s", { anahtar: "k", zaman: 100 }); g.ekle(3, "s", { anahtar: "j", zaman: 150 });
  g.geriAl(4);
  g.ekle(3, "s", { anahtar: "k", zaman: 200 });
  assert.equal(g.geriSayisi(), 2);
});
test("sınır aşılınca en eski adım düşer", () => {
  const g = gecmisKur<number>(2); g.ekle(1, "a"); g.ekle(2, "b"); g.ekle(3, "c");
  assert.deepEqual(g.mesajlar(), ["b", "c"]);
});

// ── durum ──
function sahteLevel(t0: LevelTanimi): Uygulayici & { sayac: number } {
  let t = structuredClone(t0);
  const u = {
    sayac: 0,
    oku: () => structuredClone(t),
    uygula(y: LevelTanimi) { if ((y.nesneler ?? []).some((n) => n.varlik === "BOZUK")) throw new Error("bozuk"); t = structuredClone(y); u.sayac++; },
  };
  return u;
}
test("değişiklik geri alınınca tanım eski", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  d.degistir((t) => K.nesneSil(t, ["n1"]).tanim, "sil");
  d.geriAl();
  assert.deepEqual(idler(d.tanim()), ["n1"]);
});
test("silme geri alınınca silinen yeniden seçili", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  d.secimAyarla(["n1"]);
  d.degistir((t) => K.nesneSil(t, ["n1"]).tanim, "sil");
  d.geriAl();
  assert.deepEqual(d.secim(), ["n1"]);
});
test("silinen nesne seçimden düşer", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1"), N("n2")])));
  d.secimAyarla(["n1", "n2"]);
  d.degistir((t) => K.nesneSil(t, ["n1"]).tanim, "sil");
  assert.deepEqual(d.secim(), ["n2"]);
});
test("uygulanamayan değişiklik tanımı değiştirmez", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  d.degistir((t) => K.varlikDegistir(t, ["n1"], "BOZUK").tanim, "bozuk");
  assert.equal(d.tanim().nesneler![0]!.varlik, "A");
});
test("uygulanamayan değişiklik hata mesajı bırakır", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  d.degistir((t) => K.varlikDegistir(t, ["n1"], "BOZUK").tanim, "bozuk");
  assert.equal(d.sonMesaj().hata, true);
});
test("aynı tanımı veren değişiklik geçmişe girmez", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  d.degistir((t) => ({ ...t }), "boş");
  assert.equal(d.gecmisSayisi().geri, 0);
});
test("değişiklik kirli yapar, kayıt temizler", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  d.degistir((t) => K.kaydir(t, ["n1"], [1, 0, 0]).tanim, "kaydır");
  d.kaydedildi();
  assert.equal(d.kirli(), false);
});
test("geri alınıp kayıtlı hâle dönülünce kirli değil", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  d.degistir((t) => K.kaydir(t, ["n1"], [1, 0, 0]).tanim, "kaydır");
  d.geriAl();
  assert.equal(d.kirli(), false);
});
test("önizleme geçmişe girmez", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  d.onizle(K.kaydir(d.tanim(), ["n1"], [1, 0, 0]).tanim);
  assert.equal(d.gecmisSayisi().geri, 0);
});
test("önizlemeden sonra bırakınca geri al sürüklemenin BAŞINA döner", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  const bas = d.hal();
  d.onizle(K.kaydir(d.tanim(), ["n1"], [1, 0, 0]).tanim);
  d.onizle(K.kaydir(d.tanim(), ["n1"], [1, 0, 0]).tanim);
  d.degistir((t) => t, "sürükle", { onceki: bas });
  d.geriAl();
  assert.equal(d.tanim().nesneler![0]!.konum[0], 0);
});
test("başladığı yere bırakılan önizleme geçmişe adım bırakmaz", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  const bas = d.hal();
  d.onizle(K.kaydir(d.tanim(), ["n1"], [1, 0, 0]).tanim);
  d.degistir(() => bas.tanim, "sürükle", { onceki: bas });
  assert.equal(d.gecmisSayisi().geri, 0);
});
test("abone olunan olay yayılır", () => {
  const d = editorDurumuKur(sahteLevel(T([N("n1")])));
  let n = 0; d.abone("secim", () => n++);
  d.secimAyarla(["n1"]);
  assert.equal(n, 1);
});

// ── komutlar ──
test("ekleme yeni kimlik verir", () => { assert.deepEqual(K.nesneEkle(T([N("n4")]), [{ varlik: "B", konum: [0, 0, 0], donus: 0, olcek: 1 }]).idler, ["n5"]); });
test("çoğaltılan nesne kaymayla öteye", () => {
  const s = K.nesneCogalt(T([N("n1")]), ["n1"], [2, 0, 0]);
  assert.equal(s.tanim.nesneler![1]!.konum[0], 2);
});
test("çoğaltılan kilitli nesnenin kopyası kilitsiz", () => {
  const s = K.nesneCogalt(T([N("n1", 0, { kilitli: true })]), ["n1"]);
  assert.equal(s.tanim.nesneler![1]!.kilitli, undefined);
});
test("Y döndürme 350+15 → 5 (dosyada indirgenmiş)", () => {
  assert.equal(K.yDondur(T([N("n1", 0, { donus: 350 })]), ["n1"], 15).tanim.nesneler![0]!.donus, 5);
});
test("eğik nesneyi Y'de döndürmek eğimi korur", () => {
  assert.deepEqual(K.yDondur(T([N("n1", 0, { donus: [10, 0, 0] })]), ["n1"], 90).tanim.nesneler![0]!.donus, [10, 90, 0]);
});
test("zemine indir: taban yükseklik işlevine oturur", () => {
  const s = K.zemineIndir(T([N("n1", 3, { konum: [3, 9, 0] })]), ["n1"], (x) => x * 2);
  assert.equal(s.tanim.nesneler![0]!.konum[1], 6);
});
const KUTU = (x0: number, x1: number) => ({ min: [x0, 0, 0] as [number, number, number], max: [x1, 1, 1] as [number, number, number] });
test("min hizala: hepsinin sol kenarı en soldakine", () => {
  const s = K.hizala(T([N("a", 0.5), N("b", 5)]), ["a", "b"], 0, "min", new Map([["a", KUTU(0, 1)], ["b", KUTU(4, 6)]]));
  assert.equal(s.tanim.nesneler![1]!.konum[0], 1);
});
test("dağıt: ortadaki eşit aralığa gelir", () => {
  const s = K.dagit(T([N("a", 0), N("b", 1), N("c", 10)]), ["a", "b", "c"], 0, new Map([["a", KUTU(-1, 1)], ["b", KUTU(0, 2)], ["c", KUTU(9, 11)]]));
  assert.equal(s.tanim.nesneler![1]!.konum[0], 5);
});
test("grupla: nesneler yeni gruba bağlanır", () => {
  const s = K.grupla(T([N("n1"), N("n2")]), ["n1", "n2"], "ev");
  assert.deepEqual(s.tanim.nesneler!.map((n) => n.grup), [s.grupId, s.grupId]);
});
test("aynı gruptakileri gruplamak iç içe grup açar", () => {
  const t = T([N("n1", 0, { grup: "g1" })], { gruplar: [{ id: "g1", ad: "dış" }] });
  assert.equal(K.grupla(t, ["n1"]).tanim.gruplar![1]!.ust, "g1");
});
test("grubu çözmek nesneleri üst gruba bırakır", () => {
  const t = T([N("n1", 0, { grup: "g2" })], { gruplar: [{ id: "g1", ad: "dış" }, { id: "g2", ad: "iç", ust: "g1" }] });
  assert.equal(K.grubuCoz(t, "g2").nesneler![0]!.grup, "g1");
});
test("grubu içeriğiyle silmek alt gruptaki nesneyi de siler", () => {
  const t = T([N("n1", 0, { grup: "g2" }), N("n2")], { gruplar: [{ id: "g1", ad: "dış" }, { id: "g2", ad: "iç", ust: "g1" }] });
  assert.deepEqual(idler(K.grupSil(t, "g1", true)), ["n2"]);
});
test("grubu kendi altına taşımak reddedilir (döngü)", () => {
  const t = T([], { gruplar: [{ id: "g1", ad: "dış" }, { id: "g2", ad: "iç", ust: "g1" }] });
  assert.equal(K.grubuTasi(t, "g1", "g2"), t);
});
test("gizlemeyi kaldırmak alanı siler (dosyada gizli:false kalmaz)", () => {
  assert.equal("gizli" in K.bayrakAyarla(T([N("n1", 0, { gizli: true })]), ["n1"], "gizli", false).tanim.nesneler![0]!, false);
});
test("yer imi yuvası adla eşleşir ve üzerine yazılır", () => {
  let t = K.yerImiYaz(T([]), 3, { konum: [0, 0, 0], hedef: [1, 0, 0] });
  t = K.yerImiYaz(t, 3, { konum: [5, 0, 0], hedef: [1, 0, 0] });
  assert.deepEqual(t.kameraYerleri!.map((y) => [y.ad, y.konum[0]]), [["3", 5]]);
});

// ── seçim ──
test("düz tık yalnız tıklananı seçer", () => { assert.deepEqual(secimUygula(["a", "b"], "c", "yeni"), ["c"]); });
test("Shift tık ekler, tıklanan etkin (sonda)", () => { assert.deepEqual(secimUygula(["a", "b"], "a", "ekle"), ["b", "a"]); });
test("Ctrl tık seçiliyi çıkarır", () => { assert.deepEqual(secimUygula(["a", "b"], "a", "tersle"), ["b"]); });
test("boşluğa düz tık seçimi boşaltır", () => { assert.deepEqual(secimUygula(["a"], null, "yeni"), []); });
test("kilitli grubun nesnesi seçimden düşer", () => {
  const t = T([N("n1", 0, { grup: "g1" })], { gruplar: [{ id: "g1", ad: "x", kilitli: true }] });
  assert.deepEqual(secimiTemizle(t, ["n1"]), []);
});
test("hepsini seç gizliyi atlar", () => { assert.deepEqual(hepsiniSec(T([N("n1"), N("n2", 0, { gizli: true })])), ["n1"]); });
test("kutu ters çekilse de aynı nesneleri seçer", () => {
  const p = new Map<string, [number, number]>([["a", [10, 10]], ["b", [50, 50]]]);
  assert.deepEqual(kutudakiler(p, { x0: 20, y0: 20, x1: 0, y1: 0 }), ["a"]);
});

// ── yaslama ──
test("0,3 m'yi 0,1 adıma yaslamak kayan nokta artığı bırakmaz", () => { assert.equal(yasla(0.30000000000000004, 0.1), 0.3); });
test("4 m adımda 5,9 → 4", () => { assert.equal(yasla(5.9, 4), 4); });
test("adım 0 iken serbest", () => { assert.equal(yasla(5.9, 0), 5.9); });
test("Ctrl basılıyken açık yaslama kapanır", () => { assert.equal(etkin(true, true), false); });
test("Y ekseni kendi adımıyla yaslanır", () => { assert.deepEqual(konumYasla([1.2, 1.2, 1.2], YASLAMA_VARSAYILAN, true), [1, 1, 1]); });
test("düz zeminde normal hizası yalnız yaw", () => { assert.deepEqual(normaleHizaliDonus([0, 1, 0], 30), [0, 30, 0]); });
const yukarisi = (d: [number, number, number]) => {
  const q = Quaternion.RotationYawPitchRoll(d[1] * Math.PI / 180, d[0] * Math.PI / 180, d[2] * Math.PI / 180);
  const m = new Matrix(); q.toRotationMatrix(m);
  return Vector3.TransformNormal(new Vector3(0, 1, 0), m);
};
test("normale hizalı dönüşte nesnenin yukarısı normal olur (Babylon ile)", () => {
  const n = new Vector3(0.3, 0.9, -0.2).normalize();
  const u = yukarisi(normaleHizaliDonus([n.x, n.y, n.z], 40));
  assert.ok(Vector3.Distance(u, n) < 1e-6, `yukarı ${u.toString()} ≠ normal ${n.toString()}`);
});

// ── kısayol ──
test("kısayol haritasında çakışma yok (aynı bağlamda bir tuş tek iş)", () => { assert.deepEqual(cakismalar(KISAYOLLAR), []); });
test("çakışma bekçisi çakışmayı yakalar", () => {
  assert.equal(cakismalar([...KISAYOLLAR, { eylem: "sil", tus: "Digit2", baglam: "editor", grup: "", aciklama: "" }]).length, 1);
});
const O = (code: string, m: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) =>
  ({ code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...m });
test("Ctrl+Shift+Z ileri al", () => { assert.equal(eslesen(KISAYOLLAR, O("KeyZ", { ctrlKey: true, shiftKey: true }), "editor", false)?.eylem, "ileriAl"); });
test("metin yazarken H gizlemez", () => { assert.equal(eslesen(KISAYOLLAR, O("KeyH"), "editor", true), null); });
test("metin yazarken Ctrl+S kaydeder", () => { assert.equal(eslesen(KISAYOLLAR, O("KeyS", { ctrlKey: true }), "editor", true)?.eylem, "kaydet"); });
test("uçuş kipinde araç tuşu çalışmaz", () => { assert.equal(eslesen(KISAYOLLAR, O("Digit2"), "ucus", false), null); });
test("Shift+3 üçüncü yer imine gider", () => { assert.equal(eslesen(KISAYOLLAR, O("Digit3", { shiftKey: true }), "editor", false)?.yuva, 3); });
test("tuş metni okunur", () => { assert.equal(tusMetni({ tus: "KeyZ", ctrl: true, shift: true }), "Ctrl+Shift+Z"); });

// ── pano ──
test("parça konumları taban ortasına göre", () => {
  const p = parcaAl(T([N("a", 2, { konum: [2, 1, 0] }), N("b", 4, { konum: [4, 3, 0] })]), ["a", "b"])!;
  assert.deepEqual(p.nesneler.map((n) => n.konum), [[-1, 0, 0], [1, 2, 0]]);
});
test("parça yapıştırılınca yeni kimlikler", () => {
  const t = T([N("n1")]);
  assert.deepEqual(parcaYerlestir(t, parcaAl(t, ["n1"])!, [5, 0, 5]).idler, ["n2"]);
});
test("parça Y'de döndürülerek konunca konumu Babylon Y dönüşüyle aynı yöne döner", () => {
  const t = T([N("a", 1, { konum: [1, 0, 0] }), N("b", -1, { konum: [-1, 0, 0] })]);
  const s = parcaYerlestir(t, parcaAl(t, ["a", "b"])!, [0, 0, 0], { donusY: 90 });
  const beklenen = Vector3.TransformCoordinates(new Vector3(1, 0, 0), Matrix.RotationY(Math.PI / 2));
  assert.deepEqual(s.tanim.nesneler![2]!.konum, [beklenen.x, beklenen.y, beklenen.z].map((v) => Math.round(v * 1000) / 1000 || 0));
});
test("parça metni geri okunur", () => {
  const t = T([N("n1")]);
  const p = parcaAl(t, ["n1"])!;
  assert.deepEqual(parcaOku(parcaMetni(p)), p);
});
test("rastgele metin parça diye yutulmaz", () => { assert.throws(() => parcaOku('{"merhaba":1}'), /parça/); });
