// uygulama/graf/editor/editorYardimcilari.test.ts — editörün küçük saf parçaları: otomatik yerleşim, düğüm geometrisi ve bağ eğrisi, ayar alanları (sayı
// EVAL EDİLMEZ), kısayollar (yazı alanında tuş harftir), değişken listesi, çalışma görünümü, tavanlı denetim sıklığı, YAPILI denetim hataları.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../../protocol/graf.ts";
import type { PinOrtami } from "../dugumKaydi.ts";
import { grafTurDenetle, grafTurDenetleYapili } from "../grafTurDenetimi.ts";
import { grafKutuphanesi, nobetciSablonu, yeniGrafSablonu } from "../kutuphane.ts";
import type { CalistiriciDurumu } from "../grafCalistirici.ts";
import { SATIR_ARALIGI, SUTUN_ARALIGI, otomatikYerlesim } from "./otomatikYerlesim.ts";
import { DUGUM_OLCU, bagUcu, bagYolu, dugumKutusu, pinBul } from "./dugumGeometrisi.ts";
import { alanDegeriCoz, dugumAlanlari, pinAlani, type AlanTanimi } from "./alanlar.ts";
import { editorKomutu } from "./kisayollar.ts";
import { degiskenDugumu, degiskenleriTopla } from "./degiskenler.ts";
import { calismaIsareti, sinirliSiklik } from "./calismaGorunumu.ts";

const KAYIT = grafKutuphanesi();
const ORTAM: PinOrtami = { desen: () => null, buGraf: null, ajanlar: () => ["orion", "flash"] };
const bag = (a: string, b: string, c: string, d: string): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] });
const graf = (dugumler: GrafDugumu[], baglar: GrafBagi[] = []): Graf => {
  const r = grafDogrula({ surum: 1, ad: "deneme", tur: "olay", dugumler, baglar });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};

// ── otomatik yerleşim ──
test("otomatik yerleşim: akış sırasıyla soldan sağa sütunlar", () => {
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "x", tip: "akis.bekle" }, { id: "y", tip: "akis.bekle" }], [bag("b", "sonra", "x", "giris"), bag("x", "sonra", "y", "giris")]);
  const m = otomatikYerlesim(g);
  assert.deepEqual(["b", "x", "y"].map((id) => m.get(id)!.x), [0, SUTUN_ARALIGI, 2 * SUTUN_ARALIGI]);
});

test("otomatik yerleşim: veri sağlayan düğüm okuyanın BİR SOLUNA düşer (0. sütunda kalmaz)", () => {
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "x", tip: "akis.bekle" }, { id: "y", tip: "akis.bekle" }, { id: "s", tip: "veri.sayi" }],
    [bag("b", "sonra", "x", "giris"), bag("x", "sonra", "y", "giris"), bag("s", "deger", "y", "ms")]);
  assert.equal(otomatikYerlesim(g).get("s")!.x, SUTUN_ARALIGI);
});

test("otomatik yerleşim KONUMLU DÜĞÜME DOKUNMAZ; yenileri onların altına koyar", () => {
  const g = graf([{ id: "a", tip: "veri.sayi", konum: [100, 400] }, { id: "b", tip: "veri.sayi" }]);
  const m = otomatikYerlesim(g);
  assert.deepEqual([m.has("a"), m.get("b")!.y > 400 + SATIR_ARALIGI], [false, true]);
});

test("otomatik yerleşim döngülü (bozuk) grafikte de biter", () => {
  const g = graf([{ id: "x", tip: "akis.bekle" }, { id: "y", tip: "akis.bekle" }], [bag("x", "sonra", "y", "giris"), bag("y", "sonra", "x", "giris")]);
  assert.equal(otomatikYerlesim(g).size, 2);
});

// ── geometri ──
test("düğüm kutusu: girişler solda, çıkışlar sağda, satır satır", () => {
  const k = dugumKutusu({ id: "t", tip: "akis.tekrar", konum: [10, 20] }, { girisler: [{ ad: "giris", tip: "akis" }, { ad: "sayi", tip: "sayi" }], cikislar: [{ ad: "govde", tip: "akis" }] }, false);
  assert.deepEqual([k.girisler[1]!.nokta, k.cikislar[0]!.nokta], [{ x: 10, y: 20 + DUGUM_OLCU.baslik + DUGUM_OLCU.satir * 1.5 }, { x: 10 + DUGUM_OLCU.genislik, y: 20 + DUGUM_OLCU.baslik + DUGUM_OLCU.satir / 2 }]);
});

test("çözülemeyen düğüm pinsizdir; bağ ucu düğüm kenarına düşer (bağ çizimden kaybolmaz) ve 'bulunamadı' der", () => {
  const k = dugumKutusu({ id: "c", tip: "desen.cagir" }, null, false);
  assert.deepEqual(bagUcu(k, "giris", "giris"), { nokta: { x: 0, y: DUGUM_OLCU.baslik / 2 }, bulundu: false });
});

test("pin vuruşu: yarıçap içinde en yakın pin, dışında null", () => {
  const k = dugumKutusu({ id: "s", tip: "veri.sayi", konum: [0, 0] }, { girisler: [], cikislar: [{ ad: "deger", tip: "sayi" }] }, true);
  const p = k.cikislar[0]!.nokta;
  assert.deepEqual([pinBul([k], { x: p.x + 5, y: p.y })?.ad, pinBul([k], { x: p.x + 40, y: p.y })], ["deger", null]);
});

test("bağ eğrisi kaynaktan başlar hedefte biter (SVG yolu)", () => {
  assert.match(bagYolu({ x: 0, y: 0 }, { x: 100, y: 50 }), /^M 0 0 C .* 100 50$/);
});

// ── ayar alanları ──
const SAYI: AlanTanimi = { ad: "ms", tip: "sayi", secenekler: null, en: 0, cok: 10_000, kaynak: "ayar" };
test("sayı alanı: '1+1' HESAPLANMAZ (eval yok), hata döner", () => {
  const r = alanDegeriCoz(SAYI, "1+1");
  assert.match(r.ok ? "" : r.hata, /sayı olmalı/);
});

test("sayı alanı: Türkçe virgül kabul ('2,5' → 2.5), boş → ayar silinir", () => {
  assert.deepEqual([alanDegeriCoz(SAYI, "2,5"), alanDegeriCoz(SAYI, " ")], [{ ok: true, deger: 2.5 }, { ok: true, deger: undefined }]);
});

test("sayı alanı: aralık dışı YAZILMAZ (nedenli)", () => {
  const r = alanDegeriCoz(SAYI, "20000");
  assert.match(r.ok ? "" : r.hata, /aralık dışı \(0–10000\)/);
});

test("seçenekli alan: listede olmayan değer reddedilir, boş seçenek ('hepsi') değerdir", () => {
  const a: AlanTanimi = { ad: "tur", tip: "metin", secenekler: ["", "kapi"], kaynak: "ayar" };
  assert.deepEqual([alanDegeriCoz(a, "pencere").ok, alanDegeriCoz(a, "")], [false, { ok: true, deger: "" }]);
});

test("alanlar: Söyle'nin tanımsız 'metin' girişi de alandır; 'kim' seçenekleri ajan defterinden", () => {
  const t = KAYIT.al("ajan.soyle")!;
  const l = dugumAlanlari(t, t.pinler({}, ORTAM), ORTAM);
  assert.deepEqual([pinAlani(l, "metin")?.kaynak, pinAlani(l, "kim")?.secenekler], ["pin", ["orion", "flash"]]);
});

test("alanlar: nesne/konum girişi yazıyla girilmez (bağ ister)", () => {
  const t = KAYIT.al("ajan.git")!;
  const l = dugumAlanlari(t, t.pinler({ hedef: "konum" }, ORTAM), ORTAM);
  assert.equal(pinAlani(l, "konum"), null);
});

// ── kısayollar ──
const tus = (key: string, code: string, ek: Partial<{ ctrlKey: boolean; shiftKey: boolean }> = {}) => ({ key, code, ...ek });
test("kısayollar: Ctrl+Z geri al, Ctrl+Y ve Ctrl+Shift+Z yinele, Delete sil, F sığdır, Boşluk palet", () => {
  assert.deepEqual([editorKomutu(tus("z", "KeyZ", { ctrlKey: true }), false), editorKomutu(tus("y", "KeyY", { ctrlKey: true }), false), editorKomutu(tus("Z", "KeyZ", { ctrlKey: true, shiftKey: true }), false),
    editorKomutu(tus("Delete", "Delete"), false), editorKomutu(tus("f", "KeyF"), false), editorKomutu(tus(" ", "Space"), false)], ["geriAl", "yinele", "yinele", "sil", "sigdir", "palet"]);
});

test("yazı alanında tuş HARFTİR: Delete, F, Ctrl+Z editörün değil; yalnız Ctrl+S ve Esc", () => {
  assert.deepEqual([editorKomutu(tus("Delete", "Delete"), true), editorKomutu(tus("f", "KeyF"), true), editorKomutu(tus("z", "KeyZ", { ctrlKey: true }), true),
    editorKomutu(tus("s", "KeyS", { ctrlKey: true }), true), editorKomutu(tus("Escape", "Escape"), true)], [null, null, null, "kaydet", "alandanCik"]);
});

test("oyun tuşları (W, 1, Y, T, Tab) editör komutu değildir (editör onları yutar ama bir şey yapmaz)", () => {
  assert.deepEqual(["KeyW", "Digit1", "KeyY", "KeyT", "Tab"].map((c) => editorKomutu(tus(c, c), false)), [null, null, null, null, null]);
});

// ── değişkenler ──
test("değişkenler grafiğin değişken düğümlerinden toplanır; aynı ad iki türle ÇAKIŞMA", () => {
  const g = graf([{ id: "a", tip: "degisken.artir", ayar: { ad: "ziyaret" } }, { id: "o", tip: "degisken.oku", ayar: { ad: "ziyaret", tip: "metin" } }, { id: "y", tip: "degisken.yaz", ayar: { ad: "gece", tip: "bool" } }]);
  assert.deepEqual(degiskenleriTopla(g).map((v) => [v.ad, v.tipler, v.cakisma]), [["gece", ["bool"], false], ["ziyaret", ["sayi", "metin"], true]]);
});

test("＋ Değişken: geçersiz ad ve metin Artır reddedilir; Oku türüyle gelir", () => {
  assert.deepEqual([degiskenDugumu("oku", "iki sözcük", "sayi").ok, degiskenDugumu("artir", "x", "metin").ok, degiskenDugumu("oku", "x", "bool")],
    [false, false, { ok: true, deger: { tip: "degisken.oku", ayar: { ad: "x", tip: "bool" } } }]);
});

// ── çalışma görünümü ──
const BOS: CalistiriciDurumu = { calisiyor: null, son: null };
test("çalışma görünümü: şu anki düğüm YALNIZ kendi grafiğinin sekmesinde vurgulanır", () => {
  const c: CalistiriciDurumu = { calisiyor: { graf: "ana", baslangic: 0, suan: { graf: "selamla", id: "s", tip: "ajan.soyle", ad: "Söyle", derinlik: 1 } }, son: null };
  assert.deepEqual([calismaIsareti(c, [], "ana", 0).suan, calismaIsareti(c, [], "selamla", 0).suan], [null, "s"]);
});

test("çalışma görünümü: hata düğümü ve ⚡ dinlemede rozeti", () => {
  const c: CalistiriciDurumu = { calisiyor: null, son: { graf: "ana", durum: "hata", adim: 3, sureMs: 10, hata: "yol yok", hataDugumu: { graf: "ana", id: "git", tip: "ajan.git", ad: "Git", derinlik: 0 } } };
  const d = [{ anahtar: "ana", graf: "ana", npc: null, tetikler: [], tetik: 0, atlanan: { calisiyor: 0, soguma: 0 }, calisiyor: false, son: null }];
  const i = calismaIsareti(c, d, "ana", 0);
  assert.deepEqual([i.hataDugumu, i.hataMesaji, i.dinlemede, calismaIsareti(BOS, [], "ana", 0).dinlemede], ["git", "yol yok", true, false]);
});

// ── tavanlı sıklık ──
test("tavanlı sıklık: 50 istek tek iş; iş yürüyünce yeni istek yeni iş", () => {
  const bekleyen: (() => void)[] = [];
  let n = 0;
  const s = sinirliSiklik(() => { n++; }, 250, { kur: (f) => { bekleyen.push(f); return bekleyen.length; }, iptal: () => {} });
  for (let i = 0; i < 50; i++) s.iste();
  bekleyen.shift()!();
  s.iste();
  assert.deepEqual([n, bekleyen.length], [1, 1]);
});

// ── YAPILI denetim hataları ──
test("yapılı denetim: mesajlar metin API'siyle AYNI (örnek grafiklerde ve bozuk bir grafikte)", () => {
  const bozuk = graf([{ id: "b", tip: "olay.basla" }, { id: "b2", tip: "olay.basla" }, { id: "x", tip: "yok.tur" }, { id: "s", tip: "akis.sira", ayar: { cikis: 99 } }], [bag("b", "sonra", "s", "kosul")]);
  for (const g of [yeniGrafSablonu("a"), nobetciSablonu("n"), bozuk]) assert.deepEqual(grafTurDenetleYapili(g, KAYIT, ORTAM).map((h) => h.mesaj), grafTurDenetle(g, KAYIT, ORTAM));
});

test("yapılı denetim hatayı DÜĞÜMÜNE eşler: bilinmeyen tür, aralık dışı ayar, olmayan pine bağ, ikinci Başla", () => {
  const g = graf([{ id: "b", tip: "olay.basla" }, { id: "b2", tip: "olay.basla" }, { id: "x", tip: "yok.tur" }, { id: "s", tip: "akis.sira", ayar: { cikis: 99 } }], [bag("b", "sonra", "s", "kosul")]);
  const dugumler = new Set(grafTurDenetleYapili(g, KAYIT, ORTAM).map((h) => h.dugum));
  assert.deepEqual(["x", "s", "b2"].map((id) => dugumler.has(id)), [true, true, true]);
});
