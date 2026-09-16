// mind/refleks.test.ts — fetch sahtelenir, gerçek Ollama'ya bağlanmaz.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OllamaRefleks, KuralRefleksi } from "./refleks.ts";

function yanit(icerik: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => icerik,
    text: async () => JSON.stringify(icerik),
  } as Response;
}

function fetchSahte(fn: () => Promise<Response>) {
  const gercek = globalThis.fetch;
  globalThis.fetch = fn as unknown as typeof fetch;
  return () => { globalThis.fetch = gercek; };
}

test("model terfi:false derse ana beyin uyanmaz", async () => {
  const geriAl = fetchSahte(async () =>
    yanit({ message: { content: JSON.stringify({ terfi: false, gerekce: "gürültü" }) } })
  );
  try {
    const r = new OllamaRefleks();
    const k = await r.degerlendir({ ozet: "oyuncu.kamera_degisti" });
    assert.equal(k.terfi, false);
    assert.equal(k.gerekce, "gürültü");
  } finally { geriAl(); }
});

test("model terfi:true derse terfi eder", async () => {
  const geriAl = fetchSahte(async () =>
    yanit({ message: { content: JSON.stringify({ terfi: true, gerekce: "yeni durum" }) } })
  );
  try {
    const r = new OllamaRefleks();
    const k = await r.degerlendir({ ozet: "oyuncu_odaya_girdi" });
    assert.equal(k.terfi, true);
  } finally { geriAl(); }
});

test("bozuk JSON gelirse güvenli tarafa (terfi:true) düşer", async () => {
  const geriAl = fetchSahte(async () => yanit({ message: { content: "bu json değil" } }));
  try {
    const r = new OllamaRefleks();
    const k = await r.degerlendir({ ozet: "belirsiz olay" });
    assert.equal(k.terfi, true);
  } finally { geriAl(); }
});

test("ağ hatasında güvenli tarafa (terfi:true) düşer", async () => {
  const geriAl = fetchSahte(async () => { throw new Error("ECONNREFUSED"); });
  try {
    const r = new OllamaRefleks();
    const k = await r.degerlendir({ ozet: "bağlantı yok" });
    assert.equal(k.terfi, true);
  } finally { geriAl(); }
});

test("http hata kodunda güvenli tarafa (terfi:true) düşer", async () => {
  const geriAl = fetchSahte(async () => yanit({}, false, 500));
  try {
    const r = new OllamaRefleks();
    const k = await r.degerlendir({ ozet: "sunucu hatası" });
    assert.equal(k.terfi, true);
  } finally { geriAl(); }
});

test("hazirMi() model listede yoksa false döner", async () => {
  const geriAl = fetchSahte(async () => yanit({ models: [{ name: "baska:model" }] }));
  try {
    const r = new OllamaRefleks();
    assert.equal(await r.hazirMi(), false);
  } finally { geriAl(); }
});

test("hazirMi() model listedeyse true döner", async () => {
  const geriAl = fetchSahte(async () =>
    yanit({ models: [{ name: "hf.co/unsloth/functiongemma-270m-it-GGUF" }] })
  );
  try {
    const r = new OllamaRefleks();
    assert.equal(await r.hazirMi(), true);
  } finally { geriAl(); }
});

// ── KuralRefleksi: desenler GERÇEK yakalanmış çıktıdan kilitlenir ───────────
// Aşağıdaki metinler uydurma değil; bu makinede gerçekten koşturulan
// komutların çıktısıdır (mind/akis-olcum.ts ölçümü, 2026-09-12).
// Üçü de "error"/"fail" kelimesi İÇERMEZ — ilk desen hepsini kaçırıyordu.

test("GERÇEK: cmd.exe bilinmeyen komut terfi eder", () => {
  const k = new KuralRefleksi();
  const o = "Terminal çıktısı:\n'boyle_bir_komut_yok' is not recognized as an internal or external command,\noperable program or batch file.";
  assert.equal(k.karar({ ozet: o }).terfi, true);
});

test("GERÇEK: cmd dir 'File Not Found' terfi eder", () => {
  const k = new KuralRefleksi();
  const o = "Terminal çıktısı:\n Volume in drive C has no label.\n\n Directory of C:\\Users\\ozigo\\3dorion\n\nFile Not Found";
  assert.equal(k.karar({ ozet: o }).terfi, true);
});

test("GERÇEK: PowerShell hatası yığın izi sanılıp susturulmaz", () => {
  // Bu bir GERİLEME testidir: çıktıdaki "At line:1" satırı yüzünden
  // yığın-izi koruması bu gerçek hatayı yutuyordu.
  const k = new KuralRefleksi();
  const o = "Terminal çıktısı:\nboyle_bir_komut_yok : The term 'boyle_bir_komut_yok' is not recognized as the name of a cmdlet, function, script file,\nor operable program.\nAt line:1 char:1\n+ boyle_bir_komut_yok\n    + FullyQualifiedErrorId : CommandNotFoundException";
  assert.equal(k.karar({ ozet: o }).terfi, true, "gerçek hata susturulmamalı");
});

test("GERÇEK: bash 'command not found' terfi eder", () => {
  const k = new KuralRefleksi();
  const o = "Terminal çıktısı:\n/usr/bin/bash: line 10: boyle_bir_komut_yok: command not found";
  assert.equal(k.karar({ ozet: o }).terfi, true);
});

test("GERÇEK: npm ls bağımlılık ağacı beyni uyandırmaz", () => {
  const k = new KuralRefleksi();
  const o = "Terminal çıktısı:\n3dorion@0.1.0 C:\\Users\\ozigo\\3dorion\n+-- @babylonjs/core@9.26.0\n+-- electron@44.3.0\n+-- node-pty@1.1.0";
  assert.equal(k.karar({ ozet: o }).terfi, false);
});

test("GERÇEK: git status listesi beyni uyandırmaz", () => {
  const k = new KuralRefleksi();
  const o = "Terminal çıktısı:\nOn branch master\nChanges not staged for commit:\n\tmodified:   bridge/kopru.ts\n\tmodified:   world/giris.ts";
  assert.equal(k.karar({ ozet: o }).terfi, false);
});

test("konuşma her zaman terfi eder, rutin niyet başarısı etmez", () => {
  const k = new KuralRefleksi();
  assert.equal(k.karar({ ozet: 'Ozyn dedi: "merhaba"' }).terfi, true);
  assert.equal(k.karar({ ozet: "Niyet n_a1 → bitti" }).terfi, false);
  assert.equal(k.karar({ ozet: "Niyet n_a1 → hata (çapa yok)" }).terfi, true);
});

test("tanınmayan biçim güvenli tarafa düşer — sessizce yutulmaz", () => {
  const k = new KuralRefleksi();
  assert.equal(k.karar({ ozet: "bilinmeyen bir algı biçimi" }).terfi, true);
});

test("GERİLEME: özet metni değişse bile tür verildiğinde süzgeç doğru çalışır", () => {
  // Bu test gerçek bir gerilemeden doğdu: `ozetle()` terminal önekini
  // "Terminal çıktısı:" -> "Ozyn'in terminalinde (masandaki ekran):" diye
  // iyileştirince süzgeç terminali TANIYAMADI ve rutin dizin listesini beyne
  // geçirdi. Düzyazı bir arayüz değildir; tür açıkça verilmelidir.
  const k = new KuralRefleksi();
  const yeniOnek = "Ozyn'in terminalinde (masandaki ekran):\nsubmolts.json\ntooling.json";
  assert.equal(k.karar({ ozet: yeniOnek, tur: "terminal" }).terfi, false,
    "rutin dosya listesi önek değişse de beyni uyandırmamalı");

  const hatali = "Ozyn'in terminalinde (masandaki ekran):\n'x' is not recognized as an internal or external command";
  assert.equal(k.karar({ ozet: hatali, tur: "terminal" }).terfi, true);
});

test("tür verildiğinde konuşma ve olaylar önekten bağımsız sınıflanır", () => {
  const k = new KuralRefleksi();
  assert.equal(k.karar({ ozet: "herhangi bir biçim", tur: "duydum" }).terfi, true);
  assert.equal(k.karar({ ozet: "Olay: kamera_degisti", tur: "olay" }).terfi, false);
  assert.equal(k.karar({ ozet: "Niyet n_1 → bitti", tur: "sonuc" }).terfi, false);
  assert.equal(k.karar({ ozet: "Dünya: ...", tur: "dunya" }).terfi, false);
});

// ── Çıkış kodu: tahmin biter, kesin sinyal başlar ──────────────────────────
test("ÇIKIŞ KODU: sıfırdan farklıysa metne bakılmadan terfi eder", () => {
  const k = new KuralRefleksi();
  // İçinde hiçbir hata kelimesi YOK; yalnızca çıkış kodu başarısızlık diyor.
  const o = "Ozyn'in terminalinde:\nislem tamamlandi";
  assert.equal(k.karar({ ozet: o, tur: "terminal" }).terfi, false, "kod yokken metin kuralı");
  const r = k.karar({ ozet: o, tur: "terminal", kod: 1 });
  assert.equal(r.terfi, true);
  assert.match(r.gerekce ?? "", /çıkış kodu 1/);
});

test("ÇIKIŞ KODU 0: 'error' geçen commit mesajı artık kandıramaz", () => {
  const k = new KuralRefleksi();
  // Metin kuralı bunu hata sanardı; kabuk "başarılı" diyor.
  const o = "Ozyn'in terminalinde:\na1b2c3d fix error handling in parser";
  assert.equal(k.karar({ ozet: o, tur: "terminal" }).terfi, true, "kod yokken YANLIS pozitif");
  assert.equal(k.karar({ ozet: o, tur: "terminal", kod: 0 }).terfi, false,
    "cikis kodu 0 ise metin yanilgisi duzeltilir");
});

test("ÇIKIŞ KODU 0 ama sonuç ilginçse yine terfi eder (test sonucu)", () => {
  const k = new KuralRefleksi();
  const o = "Ozyn'in terminalinde:\nℹ tests 209\nℹ pass 209\nℹ fail 0";
  assert.equal(k.karar({ ozet: o, tur: "terminal", kod: 0 }).terfi, true);
});

test("SÜRE: kısa başarılı komut bildirilmez, uzun olan bildirilir", () => {
  const k = new KuralRefleksi();
  const o = "Ozyn'in terminalinde:\nislem tamam";
  assert.equal(k.karar({ ozet: o, tur: "terminal", kod: 0, sureMs: 40 }).terfi, false,
    "40 ms suren komut icin kimse beklemedi");
  const uzun = k.karar({ ozet: o, tur: "terminal", kod: 0, sureMs: 8200 });
  assert.equal(uzun.terfi, true, "8.2 sn beklenen is bitti, haberdir");
  assert.match(uzun.gerekce ?? "", /8\.2 sn/);
});

test("SÜRE: başarısız komutta süre aranmaz, kod yeter", () => {
  const k = new KuralRefleksi();
  const o = "Ozyn'in terminalinde:\nbir sey";
  assert.equal(k.karar({ ozet: o, tur: "terminal", kod: 1, sureMs: 5 }).terfi, true);
});

test("SÜRE: sessiz basari (cikti yok) uzunsa bildirilir", () => {
  // `tsc --noEmit` temiz gecince HICBIR SEY yazmaz; kod+sure olmadan
  // bu bilgi tamamen gorunmezdi.
  const k = new KuralRefleksi();
  const bos = "Ozyn'in terminalinde, komut başarıyla bitti:\n(çıktı yok)";
  assert.equal(k.karar({ ozet: bos, tur: "terminal", kod: 0, sureMs: 8200 }).terfi, true);
});

// ── SORUNUN CEVABI SÜZÜLMEZ ───────────────────────────────────────────────
// Canlıda bulundu: Orion `sor` gönderiyor, algı hizmeti yanıtlıyor, ama cevap
// `sonuc` olarak geldiği için "rutin başarı" sayılıp beyne hiç çıkmıyordu.
// Orion soruyor ve cevabı duymuyordu — döngünün yarısı sessizce kopuktu.

test("`gordum` HER ZAMAN terfi eder — beyin cevabı kendisi istedi", () => {
  const r = new KuralRefleksi();
  for (const metin of ["yönetim terminali (birkaç adım ötede)", "yakınında bir şey yok", ""]) {
    const k = r.karar({ tur: "gordum", ozet: `Baktın (onumde): ${metin}` });
    assert.equal(k.terfi, true, `cevap suzuldu: "${metin}"`);
  }
});

test("tür bilgisi olmadan da özetten tanınır — eski yol da çalışmalı", () => {
  const k = new KuralRefleksi().karar({ ozet: "Baktın (yakin): masa, monitör" });
  assert.equal(k.terfi, true);
});

test("BAŞARILI niyet sonucu hâlâ süzülür — kural yalnızca `gordum` için gevşedi", () => {
  const k = new KuralRefleksi().karar({ tur: "sonuc", ozet: "Niyet n_1 → bitti" });
  assert.equal(k.terfi, false, "rutin basari beyne cikmamali");
});

test("BAŞARISIZ niyet sonucu yine terfi eder", () => {
  const k = new KuralRefleksi().karar({ tur: "sonuc", ozet: "Niyet n_1 → hata (uzakta)" });
  assert.equal(k.terfi, true);
});
