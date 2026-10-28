// uygulama/eklenti/eklentiDefteri.test.ts — defterin YALAN SÖYLEYEBİLECEĞİ yerler: sahte "anında", bağımlılık, kilit, fırlatan eklenti, kalıcılık, ortam önceliği.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { eklentiDefteriKur, type Eklenti, type EklentiDeposu } from "./eklentiDefteri.ts";
import { EKLENTI_SURUMU, ortamKaydi, type EklentiBildirimi } from "../../protocol/eklenti.ts";

const bildirim = (u: Partial<EklentiBildirimi> & Pick<EklentiBildirimi, "id">): EklentiBildirimi =>
  ({ ad: u.id, aciklama: "deneme", kategori: "zihin", varsayilan: "acik", etki: "aninda", ...u });
const bellekDepo = (ilk: string | null = null): EklentiDeposu & { metin: string | null; yazim: number } => {
  const d = { metin: ilk, yazim: 0, oku() { return d.metin; }, yaz(m: string) { d.metin = m; d.yazim++; } };
  return d;
};
/** Çağrıları sayan eklenti. */
function sayan(u: Partial<EklentiBildirimi> & Pick<EklentiBildirimi, "id">) {
  const o = { kur: 0, kapat: 0 };
  const e: Eklenti = { bildirim: bildirim(u), kur: () => { o.kur++; return { kapat: () => { o.kapat++; } }; } };
  return { e, o };
}
const sessizUyari = (f: () => void): void => { const w = console.warn; console.warn = () => {}; try { f(); } finally { console.warn = w; } };

test("varsayılan: 'acik' açılışta kurulur, 'kapali' kurulmaz; kayıt yokken depoya HİÇ yazılmaz", () => {
  const depo = bellekDepo(), a = sayan({ id: "a" }), k = sayan({ id: "k", varsayilan: "kapali" });
  const d = eklentiDefteriKur({ depo });
  d.kaydet(a.e); d.kaydet(k.e); d.baslat();
  assert.deepEqual([a.o.kur, k.o.kur], [1, 0]);
  assert.equal(d.acikMi("a"), true); assert.equal(d.acikMi("k"), false);
  assert.equal(depo.yazim, 0);
});

test("anında eklenti: ac/kapat HEMEN kur/kapat çağırır, kayıt yazılır; ikinci açma yinelenmez", () => {
  const depo = bellekDepo(), k = sayan({ id: "k", varsayilan: "kapali" });
  const d = eklentiDefteriKur({ depo }); d.kaydet(k.e); d.baslat();
  assert.deepEqual(d.ac("k"), { ok: true }); assert.deepEqual(d.ac("k"), { ok: true });
  assert.equal(k.o.kur, 1); assert.equal(d.acikMi("k"), true);
  assert.deepEqual(d.kapat("k"), { ok: true }); assert.equal(k.o.kapat, 1); assert.equal(d.acikMi("k"), false);
  assert.deepEqual(JSON.parse(depo.metin!), { surum: EKLENTI_SURUMU, durum: { k: { acik: false } } });
});

test("yeniden_baslat eklenti: durum KAYDEDİLİR ama çalışan hâl değişmez; 'bekleyen' bunu söyler (sahte anında yok)", () => {
  const f = sayan({ id: "f", etki: "yeniden_baslat" });
  const d = eklentiDefteriKur({}); d.kaydet(f.e); d.baslat();
  assert.equal(f.o.kur, 1);
  d.kapat("f");
  const s = d.durum()[0]!;
  assert.equal(s.acik, false); assert.equal(s.calisiyor, true); assert.equal(s.bekleyen, true); assert.equal(f.o.kapat, 0);
  d.ac("f");
  assert.equal(d.durum()[0]!.bekleyen, false, "eski haline dönünce bekleyen kalkar");
});

test("bağımlılık: bağımlı kapalıyken açılamaz (neden söylenir); bağımlısı açıkken kapatılamaz; sıra topolojik", () => {
  const sira: string[] = [];
  const mk = (id: string, bagimli?: string[]): Eklenti => ({ bildirim: bildirim({ id, ...(bagimli ? { bagimli } : {}) }), kur: () => { sira.push(id); } });
  const d = eklentiDefteriKur({});
  d.kaydet(mk("ust", ["alt"])); d.kaydet(mk("alt"));
  d.baslat();
  assert.deepEqual(sira, ["alt", "ust"]);
  const r = d.kapat("alt"); assert.equal(r.ok, false); assert.match(r.ok ? "" : r.neden, /ust/);
  assert.deepEqual(d.kapat("ust"), { ok: true }); assert.deepEqual(d.kapat("alt"), { ok: true });
  assert.deepEqual(d.ac("ust"), { ok: false, neden: "önce 'alt' eklentisini aç" });
  assert.match(d.durum().find((x) => x.bildirim.id === "ust")!.engel ?? "", /alt/);
});

test("bağımlılık döngüsü ve bilinmeyen bağımlılık HATA olur, diğerleri çalışır", () => {
  const d = eklentiDefteriKur({}), saglam = sayan({ id: "saglam" });
  d.kaydet({ bildirim: bildirim({ id: "x", bagimli: ["y"] }) }); d.kaydet({ bildirim: bildirim({ id: "y", bagimli: ["x"] }) });
  d.kaydet({ bildirim: bildirim({ id: "z", bagimli: ["yok"] }) }); d.kaydet(saglam.e);
  d.baslat();
  const h = (id: string) => d.durum().find((x) => x.bildirim.id === id)!.hata;
  assert.match(h("x") ?? h("y") ?? "", /döngü|bağımlılık/); assert.match(h("z") ?? "", /bilinmeyen/);
  assert.equal(saglam.o.kur, 1);
});

test("kilitli eklenti kapatılamaz (neden gösterilir)", () => {
  const d = eklentiDefteriKur({}); d.kaydet({ bildirim: bildirim({ id: "k", kilitli: "güvenlik teli" }) }); d.baslat();
  assert.deepEqual(d.kapat("k"), { ok: false, neden: "kilitli: güvenlik teli" });
  assert.equal(d.durum()[0]!.engel, "kilitli: güvenlik teli");
});

test("fırlatan kur: o eklenti çalışmaz ve HATA görünür, ötekiler etkilenmez; sonradan açma fırlatırsa kayıt acik=false'a döner", () => {
  sessizUyari(() => {
    const iyi = sayan({ id: "iyi" }), depo = bellekDepo();
    const d = eklentiDefteriKur({ depo });
    d.kaydet({ bildirim: bildirim({ id: "kotu" }), kur: () => { throw new Error("patladı"); } }); d.kaydet(iyi.e);
    d.baslat();
    assert.equal(iyi.o.kur, 1); assert.equal(d.acikMi("kotu"), false);
    assert.equal(d.durum().find((x) => x.bildirim.id === "kotu")!.hata, "patladı");
    const d2 = eklentiDefteriKur({ depo });
    d2.kaydet({ bildirim: bildirim({ id: "k2", varsayilan: "kapali" }), kur: () => { throw new Error("yine"); } }); d2.baslat();
    const r = d2.ac("k2"); assert.equal(r.ok, false); assert.match(r.ok ? "" : r.neden, /yine/);
    assert.equal(JSON.parse(depo.metin!).durum.k2.acik, false);
  });
});

test("seçenek: geçersiz reddedilir, geçerli yazılır; kur'a verilen getter canlı okur (bayatlamaz); seçeneksiz eklentiye yazılamaz", () => {
  let getter: (() => string | null) | null = null;
  const e: Eklenti = { bildirim: bildirim({ id: "kip", secenek: { ad: "Kip", varsayilan: "kapali", secenekler: [{ id: "kapali", ad: "K", aciklama: "" }, { id: "cozucu", ad: "Ç", aciklama: "" }] } }), kur: (b) => { getter = b.secenek; } };
  const d = eklentiDefteriKur({}); d.kaydet(e); d.baslat();
  assert.equal(d.secenek("kip"), "kapali");
  assert.equal(d.secenekYaz("kip", "uydurma").ok, false);
  assert.deepEqual(d.secenekYaz("kip", "cozucu"), { ok: true }); assert.equal(d.secenek("kip"), "cozucu");
  assert.equal(getter!(), "cozucu", "kur anında alınan getter yeni seçimi görür");
  assert.equal(d.secenekYaz("yok", "x").ok, false);
  const s = eklentiDefteriKur({}); s.kaydet({ bildirim: bildirim({ id: "s" }) }); s.baslat();
  assert.equal(s.secenekYaz("s", "x").ok, false);
});

test("kalıcılık: kayıt sonraki açılışta uygulanır; bozuk kayıt varsayılana döner ve UYARI verir; depo yazımı çökerse uyarı, durum geçerli kalır", () => {
  const depo = bellekDepo(JSON.stringify({ surum: EKLENTI_SURUMU, durum: { a: { acik: false } } }));
  const a = sayan({ id: "a" });
  const d = eklentiDefteriKur({ depo }); d.kaydet(a.e); d.baslat();
  assert.equal(a.o.kur, 0); assert.equal(d.acikMi("a"), false);
  const bozuk = eklentiDefteriKur({ depo: bellekDepo("{x") });
  assert.ok(bozuk.uyarilar.some((u) => /bozuk JSON/.test(u)));
  const patlak: EklentiDeposu = { oku: () => null, yaz: () => { throw new Error("dolu"); } };
  const p = eklentiDefteriKur({ depo: patlak }); p.kaydet(sayan({ id: "p" }).e); p.baslat();
  assert.deepEqual(p.kapat("p"), { ok: true }); assert.equal(p.acikMi("p"), false);
  assert.ok(p.uyarilar.some((u) => /yazılamadı: dolu/.test(u)));
});

test("ortam kayıtta önce gelir ve KALICI KAYDA YAZILMAZ; panelden değiştirince ortam geçersiz olur", () => {
  const depo = bellekDepo(), a = sayan({ id: "a" });
  const d = eklentiDefteriKur({ depo, ortam: ortamKaydi("a:0") }); d.kaydet(a.e); d.baslat();
  assert.equal(a.o.kur, 0); assert.equal(depo.yazim, 0);
  d.ac("a"); assert.equal(a.o.kur, 1); assert.equal(d.acikMi("a"), true);
});

test("yeniden_baslat eklenti kapalı başlayıp panelden açılırsa kur ÇAĞRILMAZ (yalnız bekleyen), ortam kayıttan ÖNCE gelir", () => {
  const f = sayan({ id: "f", etki: "yeniden_baslat", varsayilan: "kapali" });
  const d = eklentiDefteriKur({}); d.kaydet(f.e); d.baslat();
  d.ac("f");
  assert.equal(f.o.kur, 0); assert.equal(d.durum()[0]!.bekleyen, true); assert.equal(d.acikMi("f"), false, "çalışmıyor: açılış sonrası");
  const depo = bellekDepo(JSON.stringify({ surum: EKLENTI_SURUMU, durum: { a: { acik: true } } })), a = sayan({ id: "a" });
  const d2 = eklentiDefteriKur({ depo, ortam: ortamKaydi("a:0") }); d2.kaydet(a.e); d2.baslat();
  assert.equal(a.o.kur, 0, "kayıt açık diyor, ortam kapalı: ortam kazanır");
});

test("bağımlılığı KURULAMAYAN (hata) eklenti de kurulmaz ve nedeni söylenir", () => {
  sessizUyari(() => {
    const ust = sayan({ id: "ust", bagimli: ["alt"] });
    const d = eklentiDefteriKur({});
    d.kaydet({ bildirim: bildirim({ id: "alt" }), kur: () => { throw new Error("alt patladı"); } }); d.kaydet(ust.e); d.baslat();
    assert.equal(ust.o.kur, 0);
    assert.match(d.durum().find((x) => x.bildirim.id === "ust")!.hata ?? "", /bağımlılık çalışmıyor: alt/);
  });
});

test("kapaliBaslat: yalnız KAPALI eklentide açılışta bir kez çağrılır; istenenAcik baslat'tan ÖNCE de doğru okur; fırlatırsa hata görünür", () => {
  let n = 0;
  const kapali: Eklenti = { bildirim: bildirim({ id: "kapali", varsayilan: "kapali" }), kapaliBaslat: () => { n++; } };
  const acik: Eklenti = { bildirim: bildirim({ id: "acik" }), kapaliBaslat: () => { n += 100; } };
  const kotu: Eklenti = { bildirim: bildirim({ id: "kotu", varsayilan: "kapali" }), kapaliBaslat: () => { throw new Error("gizlenemedi"); } };
  const d = eklentiDefteriKur({}); d.kaydet(kapali); d.kaydet(acik); d.kaydet(kotu);
  assert.equal(d.istenenAcik("acik"), true); assert.equal(d.istenenAcik("kapali"), false); assert.equal(d.istenenAcik("yok"), false);
  assert.equal(d.acikMi("acik"), false, "baslat'tan önce çalışan yok");
  d.baslat();
  assert.equal(n, 1);
  assert.equal(d.durum().find((x) => x.bildirim.id === "kotu")!.hata, "gizlenemedi");
});

test("kayıt kuralları: aynı kimlik iki kez, geçersiz kimlik, başlatmadan sonra kayıt, listede olmayan varsayılan seçenek → hata", () => {
  const d = eklentiDefteriKur({});
  d.kaydet({ bildirim: bildirim({ id: "a" }) });
  assert.throws(() => d.kaydet({ bildirim: bildirim({ id: "a" }) }), /zaten kayıtlı/);
  assert.throws(() => d.kaydet({ bildirim: bildirim({ id: "Kotu Ad" }) }), /geçersiz eklenti kimliği/);
  assert.throws(() => d.kaydet({ bildirim: bildirim({ id: "s", secenek: { ad: "S", varsayilan: "yok", secenekler: [{ id: "var", ad: "", aciklama: "" }] } }) }), /varsayılan seçenek/);
  d.baslat();
  assert.throws(() => d.kaydet({ bildirim: bildirim({ id: "gec" }) }), /SONRA/);
});

test("dinle: her değişiklikte çağrılır, çıkış fonksiyonu keser; dinleyici hatası öteki dinleyiciyi engellemez", () => {
  sessizUyari(() => {
    const d = eklentiDefteriKur({}); d.kaydet(sayan({ id: "a" }).e); d.baslat();
    let n = 0; d.dinle(() => { throw new Error("x"); }); const kes = d.dinle(() => { n++; });
    d.kapat("a"); assert.equal(n, 1); kes(); d.ac("a"); assert.equal(n, 1);
  });
});
