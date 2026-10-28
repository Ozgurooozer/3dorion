// uygulama/icerik/icerikModeli.test.ts — içerik gezgini modeli (spec 39 D4): tür tanıma, klasör ağacı, kartlar (paket kartı, arama, süzgeç, sıra), kırıntı,
// geçerli klasör, favoriler, açma eylemi, boyut metni, işlem durumu; host'un tür klasörleriyle AYNI liste.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import {
  TUR_KLASORLERI, acmaEylemi, agacKur, boyutMetni, dosyaAdi, favoriDegistir, favoriOku, gecerliKlasor, govdeAdi, islemDurumu, kartlar, kirinti, paketDosyasi, tasimaKurali, turTani,
  ustKlasor, adresKurali, gezin, gorunenAd, kartGenisligi, type IcerikTuru, type Oge,
} from "./icerikModeli.ts";
import { ICERIK_KLASORLERI } from "../../host/proje.js";

const k = (adres: string): Oge => ({ adres, klasor: true, boyut: 0, degisti: 1 });
const d = (adres: string, boyut = 10): Oge => ({ adres, klasor: false, boyut, degisti: 2 });
const ORNEK: Oge[] = [
  k("Content/Levels"), k("Content/Levels/ova"), d("Content/Levels/ova/ova.level.json"),
  k("Content/Characters"), k("Content/Characters/Orion"), d("Content/Characters/Orion/Orion.karakter.json"), d("Content/Characters/Orion/gövde.glb", 5000),
  k("Content/Sequences"), d("Content/Sequences/yuru.json"), d("Content/Sequences/Zıpla 10.json"), d("Content/Sequences/zıpla 2.json"),
  k("Content/Graphs"), d("Content/Graphs/bekle.json"),
  k("Content/Assets"), k("Content/Assets/Esya"), d("Content/Assets/Esya/masa.glb", 2048), d("Content/Assets/Esya/masa.png"), d("Content/Assets/not.txt"),
  k("Content/NPC"), k("Content/Animations"),
  d("Engine/orion-lowpoly.glb", 3 * 1048576), k("Engine/sekans"), d("Engine/sekans/ornek.json"),
];

test("tür: uzantı ve klasör diliyle; .json yalnız tür klasörünün DOĞRUDAN altında sekans/graf/npc/animasyon; başka yerde json", () => {
  const beklenen: [string, boolean, IcerikTuru][] = [
    ["Content/Levels", true, "klasor"],
    ["Content/Levels/ova/ova.level.json", false, "level"], ["Content/Characters/Orion/Orion.karakter.json", false, "karakter"],
    ["Engine/a.GLB", false, "model"], ["Engine/a.gltf", false, "model"], ["Engine/a.vrm", false, "model"],
    ["Content/Assets/a.PNG", false, "gorsel"], ["Content/Assets/a.jpg", false, "gorsel"], ["Content/Assets/a.jpeg", false, "gorsel"], ["Content/Assets/a.webp", false, "gorsel"],
    ["Content/Sequences/a.json", false, "sekans"], ["Content/Graphs/a.json", false, "graf"], ["Content/NPC/a.json", false, "npc"], ["Content/Animations/a.json", false, "animasyon"],
    ["Content/Assets/a.json", false, "json"], ["Engine/Sequences/a.json", false, "json"], ["Engine/NPC/a.json", false, "json"],["Content/Sequences/alt/a.json", false, "json"], ["Engine/sekans/a.json", false, "json"], ["Content/Sequences/a.txt", false, "diger"],
    ["Content/Assets/x", false, "diger"],
  ];
  for (const [a, kl, t] of beklenen) assert.equal(turTani(a, kl), t, a);
});

test("ad yardımcıları: dosya adı, üst klasör, gövde adı (ilk noktaya kadar: Orion.karakter.json → Orion)", () => {
  assert.equal(dosyaAdi("Content/a/b.json"), "b.json");
  assert.equal(ustKlasor("Content/a/b.json"), "Content/a");
  assert.equal(ustKlasor("Content"), "");
  assert.equal(govdeAdi("Content/Characters/Orion/Orion.karakter.json"), "Orion");
  assert.equal(govdeAdi("Content/Sequences/yuru.json"), "yuru");
  assert.equal(govdeAdi("Content/Assets/noktasiz"), "noktasiz");
  assert.equal(govdeAdi("Content/Assets/.gizli"), ".gizli", "baştaki nokta uzantı değil");
});

test("ağaç: yalnız klasörler, kökten, ada göre (Türkçe, sayılar sayı gibi); eksik ara klasör üretilir; başka kökün öğeleri girmez", () => {
  const a = agacKur(ORNEK, "Content");
  assert.equal(a.adres, "Content");
  assert.deepEqual(a.cocuklar.map((c) => c.ad), ["Animations", "Assets", "Characters", "Graphs", "Levels", "NPC", "Sequences"]);
  assert.deepEqual(a.cocuklar.find((c) => c.ad === "Assets")!.cocuklar.map((c) => c.adres), ["Content/Assets/Esya"]);
  const e = agacKur(ORNEK, "Engine");
  assert.deepEqual(e.cocuklar.map((c) => c.adres), ["Engine/sekans"]);
  const eksik = agacKur([d("Content/A/B/x.glb")], "Content");
  assert.deepEqual(eksik.cocuklar[0]!.cocuklar.map((c) => c.adres), ["Content/A/B"], "klasör satırı gelmese de zincir kurulur");
  const sayi = agacKur([k("Content/k10"), k("Content/k2"), k("Content/K1")], "Content");
  assert.deepEqual(sayi.cocuklar.map((c) => c.ad), ["K1", "k2", "k10"]);
  assert.deepEqual(agacKur([], "Content").cocuklar, []);
  // başka kökün öğeleri Content ağacına karışmaz (ve döngü/asılı düğüm doğmaz)
  const hepsi = (d: { adres: string; cocuklar: { adres: string; cocuklar: never[] }[] }, k: string[] = []): string[] => { k.push(d.adres); for (const c of d.cocuklar) hepsi(c as never, k); return k; };
  const gez = hepsi(a as never);
  assert.ok(gez.every((x) => x === "Content" || x.startsWith("Content/")), `Engine karıştı: ${gez.join(",")}`);
  assert.equal(new Set(gez).size, gez.length, "her düğüm bir kez");
});

test("kartlar: doğrudan çocuklar, klasörler önde; paket klasörleri (level/karakter) TEK kart ve çift tık dosyayı açar; içindeki dosya ayrı kart olmaz", () => {
  const kok = kartlar(ORNEK, "Content").map((x) => x.ad);
  assert.deepEqual(kok, ["Animations", "Assets", "Characters", "Graphs", "Levels", "NPC", "Sequences"]);
  const ch = kartlar(ORNEK, "Content/Characters");
  assert.equal(ch.length, 1);
  assert.deepEqual([ch[0]!.ad, ch[0]!.tur, ch[0]!.klasor, ch[0]!.ac], ["Orion", "karakter", true, "Content/Characters/Orion/Orion.karakter.json"]);
  const lv = kartlar(ORNEK, "Content/Levels");
  assert.deepEqual([lv[0]!.tur, lv[0]!.ac], ["level", "Content/Levels/ova/ova.level.json"]);
  const ic = kartlar(ORNEK, "Content/Characters/Orion");
  assert.deepEqual(ic.map((x) => x.ad), ["gövde.glb", "Orion.karakter.json"], "paketin içine elle girilince dosyalar görünür");
  const es = kartlar(ORNEK, "Content/Assets");
  assert.deepEqual(es.map((x) => [x.ad, x.tur]), [["Esya", "klasor"], ["not.txt", "diger"]]);
  const dos = kartlar(ORNEK, "Content/Sequences");
  assert.deepEqual(dos.map((x) => x.ad), ["yuru.json", "zıpla 2.json", "Zıpla 10.json"], "sayılar sayı gibi, büyük/küçük harf gözetmez");
});

test("kartlar: Engine kartları salt okunur; Content yazılabilir; boyut ve değişme taşınır", () => {
  const e = kartlar(ORNEK, "Engine");
  assert.deepEqual(e.map((x) => [x.ad, x.saltOkunur]), [["sekans", true], ["orion-lowpoly.glb", true]]);
  assert.equal(kartlar(ORNEK, "Content/Assets/Esya")[0]!.saltOkunur, false);
  assert.deepEqual([kartlar(ORNEK, "Engine")[1]!.boyut, kartlar(ORNEK, "Engine")[1]!.degisti], [3 * 1048576, 2]);
});

test("arama: seçili klasörün TÜM altında, ad içinde, harf ve Türkçe farkı gözetmez; klasör kartı ve paketin içi çıkmaz; kapsam klasörle sınırlı", () => {
  assert.deepEqual(kartlar(ORNEK, "Content", { arama: "MASA" }).map((x) => x.adres), ["Content/Assets/Esya/masa.glb", "Content/Assets/Esya/masa.png"]);
  assert.deepEqual(kartlar(ORNEK, "Content/Sequences", { arama: "masa" }), []);
  assert.deepEqual(kartlar(ORNEK, "Content", { arama: "ZIPLA" }).map((x) => x.ad), ["zıpla 2.json", "Zıpla 10.json"], "Türkçe küçük harf: I → ı, 'ZIPLA' = 'zıpla'");
  assert.deepEqual(kartlar(ORNEK, "Content", { arama: "zipla" }), [], "noktalı i ≠ ı: farklı harf");
  assert.deepEqual(kartlar(ORNEK, "Content", { arama: "zıpla" }).map((x) => x.ad), ["zıpla 2.json", "Zıpla 10.json"]);
  assert.deepEqual(kartlar(ORNEK, "Content", { arama: "gövde" }), [], "paketin içindeki dosya aramada çıkmaz (paket tek kart)");
  assert.deepEqual(kartlar(ORNEK, "Content", { arama: "orion" }).map((x) => [x.ad, x.tur]), [["Orion", "karakter"]], "paket kartı adıyla bulunur");
  assert.deepEqual(kartlar(ORNEK, "Content", { arama: "Esya" }), [], "klasör kartı aramada çıkmaz");
  assert.equal(kartlar(ORNEK, "Content", { arama: "  " }).length, 7, "boşluk arama sayılmaz");
});

test("süzgeç: yalnız seçili türler, klasörün tüm altında; boş küme = hepsi; arama ile birlikte", () => {
  assert.deepEqual(kartlar(ORNEK, "Content", { turler: new Set<IcerikTuru>(["model"]) }).map((x) => x.adres), ["Content/Assets/Esya/masa.glb"]);
  assert.deepEqual(kartlar(ORNEK, "Content", { turler: new Set<IcerikTuru>(["sekans", "graf"]) }).map((x) => x.ad), ["bekle.json", "yuru.json", "zıpla 2.json", "Zıpla 10.json"]);
  assert.deepEqual(kartlar(ORNEK, "Content", { turler: new Set<IcerikTuru>(["level"]) }).map((x) => x.ad), ["ova"]);
  assert.equal(kartlar(ORNEK, "Content", { turler: new Set() }).length, 7, "boş küme süzmez");
  assert.deepEqual(kartlar(ORNEK, "Content", { turler: new Set<IcerikTuru>(["gorsel", "model"]), arama: "png" }).map((x) => x.ad), ["masa.png"]);
});

test("paket dosyası: yalnız klasörle AYNI adlı level/karakter dosyası paket yapar", () => {
  const s = new Set(["Content/Levels/ova/ova.level.json", "Content/Levels/x/baska.level.json", "Content/Characters/Orion/Orion.karakter.json"]);
  assert.equal(paketDosyasi("Content/Levels/ova", s), "Content/Levels/ova/ova.level.json");
  assert.equal(paketDosyasi("Content/Levels/x", s), null);
  assert.equal(paketDosyasi("Content/Characters/Orion", s), "Content/Characters/Orion/Orion.karakter.json");
  assert.equal(paketDosyasi("Content/Levels", s), null);
});

test("kırıntı ve geçerli klasör: kırıntı her basamağın adresini verir; silinen klasörde en yakın var olan üst, kök hep", () => {
  assert.deepEqual(kirinti("Content/Characters/Orion"), [{ ad: "Content", adres: "Content" }, { ad: "Characters", adres: "Content/Characters" }, { ad: "Orion", adres: "Content/Characters/Orion" }]);
  assert.equal(gecerliKlasor(ORNEK, "Content/Assets/Esya"), "Content/Assets/Esya");
  assert.equal(gecerliKlasor(ORNEK, "Content/Assets/Esya/Silinen/Alt"), "Content/Assets/Esya");
  assert.equal(gecerliKlasor(ORNEK, "Content/Yok/Hic"), "Content");
  assert.equal(gecerliKlasor(ORNEK, "Engine/yok"), "Engine");
  assert.equal(gecerliKlasor([], "Content"), "Content");
});

test("favoriler: değiştir (ekle/çıkar), tekrar yok, 40 tavan; okuma bozuk veriye dayanıklı ve yalnız bilinen kök", () => {
  assert.deepEqual(favoriDegistir([], "Content/a"), ["Content/a"]);
  assert.deepEqual(favoriDegistir(["Content/a", "Content/b"], "Content/a"), ["Content/b"]);
  const elli = Array.from({ length: 40 }, (_, i) => `Content/k${i}`);
  const yeni = favoriDegistir(elli, "Content/yeni");
  assert.equal(yeni.length, 40);
  assert.deepEqual([yeni[0], yeni.at(-1)], ["Content/k1", "Content/yeni"]);
  assert.deepEqual(favoriOku(["Content/a", "Engine", "Game/x", 5, null, "Content/a", "Contentx"]), ["Content/a", "Engine"]);
  assert.deepEqual(favoriOku("yanlış"), []);
  assert.deepEqual(favoriOku(undefined), []);
});

test("açma eylemi: her tür için tek karar; tanınmayan türde 'yok'", () => {
  const beklenen: [IcerikTuru, string][] = [["klasor", "gir"], ["sekans", "sekans"], ["graf", "graf"], ["level", "level"], ["karakter", "onizleme"], ["model", "onizleme"], ["gorsel", "gorsel"], ["npc", "yok"], ["animasyon", "yok"], ["json", "yok"], ["diger", "yok"]];
  for (const [t, e] of beklenen) assert.equal(acmaEylemi(t), e, t);
});

test("boyut metni: B / KB (küçükte ondalık) / MB", () => {
  assert.deepEqual([0, 999, 1024, 1536, 10240, 204800, 1048576, 3 * 1048576 + 52429].map(boyutMetni), ["0 B", "999 B", "1.0 KB", "1.5 KB", "10 KB", "200 KB", "1.0 MB", "3.1 MB"]);
});

test("işlem durumu: Engine salt okunur; Content'te yalnız tür klasörleri ve kökün kendisi korumalı", () => {
  assert.deepEqual(islemDurumu("Engine/x.glb"), { yazilabilir: false, neden: "Engine içeriği salt okunur", korumali: true });
  assert.equal(islemDurumu("Content").korumali, true);
  assert.equal(islemDurumu("Content/Levels").korumali, true);
  assert.equal(islemDurumu("Content/Levels/ova").korumali, false);
  assert.equal(islemDurumu("Content/Benim").korumali, false, "tür klasörü olmayan Content altı korumasız");
  assert.equal(islemDurumu("Content/Assets/Esya/masa.glb").yazilabilir, true);
});

test("tür klasörleri host'unkiyle AYNI liste (ayrışırsa kırmızı)", () => {
  assert.deepEqual([...TUR_KLASORLERI].sort(), Object.values(ICERIK_KLASORLERI).sort());
});

test("adres kuralı: bilinen kök + temiz parçalar geçerli; kaçış/gizli/boş parça/geçersiz karakter/bilinmeyen kök nedenle reddedilir (host kuralıyla AYNI)", async () => {
  const { adresParcalari } = await import("../../host/icerik.js");
  const iyi = ["Content", "Engine", "Content/Characters/Orion/Orion.karakter.json", "Engine/orion-lowpoly.glb", "Content/çay ocağı/a b.glb"];
  const kotu = ["", "Game/x", "content/x", "/Content/x", "Content/", "Content//x", "Content/./x", "Content/../x", "Content/.silinenler/x", "Content/a\\b","Content/a:b", "Content/a*b", "Content/a?b", "Content/a\"b", "Content/a<b", "Content/a|b", "Content/a\u0001b"];
  for (const a of iyi) { assert.equal(adresKurali(a), null, a); assert.doesNotThrow(() => adresParcalari(a), a); }
  for (const a of kotu) { assert.ok(adresKurali(a), `renderer reddetmeli: ${JSON.stringify(a)}`); assert.throws(() => adresParcalari(a), Error, `host reddetmeli: ${JSON.stringify(a)}`); }
});

test("gorunenAd: türün uzantısı düşer (sekans/graf/npc/animasyon .json, karakter .karakter.json, level .level.json); model/görsel/klasör/json aynen; ad tamamen uzantıysa kalır", () => {
  const g = (ad: string, tur: IcerikTuru, klasor = false) => gorunenAd({ ad, tur, klasor });
  assert.equal(g("selamlasma_2.json", "sekans"), "selamlasma_2");
  assert.equal(g("akis.json", "graf"), "akis");
  assert.equal(g("flash.json", "npc"), "flash");
  assert.equal(g("el_salla.json", "animasyon"), "el_salla");
  assert.equal(g("Orion.karakter.json", "karakter"), "Orion");
  assert.equal(g("ova.level.json", "level"), "ova");
  assert.equal(g("orion-lowpoly.glb", "model"), "orion-lowpoly.glb");
  assert.equal(g("poster-1.png", "gorsel"), "poster-1.png");
  assert.equal(g("ayar.json", "json"), "ayar.json");
  assert.equal(g("Orion", "karakter", true), "Orion");
  assert.equal(g(".json", "sekans"), ".json");
});

test("gezin: sağ/sol ±1, aşağı/yukarı ±sütun, kenarda yerinde, seçim yokken ilk/son, Home/End, boşta -1", () => {
  assert.equal(gezin(10, 4, 0, "ArrowRight"), 1);
  assert.equal(gezin(10, 4, 3, "ArrowRight"), 4, "satır sonunda alt satırın başına geçer (düz sıra)");
  assert.equal(gezin(10, 4, 9, "ArrowRight"), 9);
  assert.equal(gezin(10, 4, 0, "ArrowLeft"), 0);
  assert.equal(gezin(10, 4, 5, "ArrowDown"), 9);
  assert.equal(gezin(10, 4, 7, "ArrowDown"), 7, "altında kart yoksa yerinde");
  assert.equal(gezin(10, 4, 5, "ArrowUp"), 1);
  assert.equal(gezin(10, 4, 2, "ArrowUp"), 2);
  assert.equal(gezin(10, 4, -1, "ArrowDown"), 0);
  assert.equal(gezin(10, 4, -1, "ArrowUp"), 9);
  assert.equal(gezin(10, 4, 99, "ArrowRight"), 0, "geçersiz mevcut = seçim yok");
  assert.equal(gezin(10, 4, 5, "Home"), 0);
  assert.equal(gezin(10, 4, 2, "End"), 9);
  assert.equal(gezin(0, 4, -1, "ArrowDown"), -1);
  assert.equal(gezin(5, 0, 1, "ArrowDown"), 2, "sütun 0 → 1'e sıkışır");
});

test("kartGenisligi: 72–200'e sıkışır, sayı metni okunur, geçersiz değer 104", () => {
  assert.deepEqual([50, 72, 104, 150, 200, 999, "130", 130.6].map(kartGenisligi), [72, 72, 104, 150, 200, 200, 130, 131]);
  assert.deepEqual([Number.NaN, "", "x", null, undefined, Infinity].map(kartGenisligi), [104, 104, 104, 104, 104, 104]);
});

test("tasimaKurali: aynı tür içinde klasöre izinli; Engine, korumalı, başka tür, kendi içine, zaten orada, düz tür klasörü, level dosyası reddedilir", () => {
  assert.equal(tasimaKurali("Content/Assets/a.glb", "Content/Assets/kutu"), null);
  assert.equal(tasimaKurali("Content/Assets/kutu", "Content/Assets/orman"), null);
  assert.equal(tasimaKurali("Content/Characters/Orion", "Content/Characters/Eski"), null);
  assert.match(tasimaKurali("Engine/x.glb", "Content/Assets") ?? "", /salt okunur/);
  assert.match(tasimaKurali("Content/Assets/a.glb", "Engine") ?? "", /salt okunur/);
  assert.match(tasimaKurali("Content/Assets", "Content/Assets/kutu") ?? "", /korumalı/);
  assert.match(tasimaKurali("Content/Assets/a.glb", "Content/Characters") ?? "", /aynı tür/);
  assert.match(tasimaKurali("Content/Assets/a.glb", "Content") ?? "", /köküne/);
  assert.match(tasimaKurali("Content/Assets/kutu", "Content/Assets/kutu/alt") ?? "", /kendi içine/);
  assert.match(tasimaKurali("Content/Assets/kutu", "Content/Assets/kutu") ?? "", /kendi içine/);
  assert.equal(tasimaKurali("Content/Assets/kutu/a.glb", "Content/Assets/kutu"), "zaten orada");
  assert.match(tasimaKurali("Content/Sequences/s.json", "Content/Sequences/x") ?? "", /düz/);
  assert.match(tasimaKurali("Content/Levels/ova", "Content/Levels/baska") ?? "", /düz durur/);
  assert.match(tasimaKurali("Content/Levels/ova/ova.level.json", "Content/Levels") ?? "", /klasörüyle/);
  assert.match(tasimaKurali("Content/Assets/a.glb", "Content/Assets/b.glb", false) ?? "", /klasör değil/);
});
