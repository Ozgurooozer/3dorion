// host/icerik.test.ts — içerik gezgini (spec 39 D4): adres kaçışı, Engine salt okunur, korumalı klasörler, türün ad kuralı (level klasörü + içindeki dosya birlikte),
// çoğalt (üstüne yazmaz), sil = .silinenler, içe aktar (uzantı/boyut/ad temizliği/çakışma), liste (gizli atlanır, tavan söylenir).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  KOKLER, adGecerli, adlandir, adresCoz, adresParcalari, cogalt, iceAktar, icAktarAdi, icerikIkili, icerikListe, icerikMetin, sil, tasi, ustAdres, yeniKlasor,
} from "./icerik.js";
import { ICERIK_KLASORLERI } from "./proje.js";

const gecici = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "orion-icerik-test-"));
const kod = (f: () => unknown): string | undefined => { try { f(); } catch (e) { return (e as { kod?: string }).kod; } return undefined; };
const yaz = (kok: string, goreli: string, metin = "{}"): void => { const t = path.join(kok, goreli); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, metin); };

/** Gerçek proje düzeninde Content + küçük bir Engine. */
function kur() {
  const content = gecici(), engine = gecici();
  for (const k of Object.values(ICERIK_KLASORLERI)) fs.mkdirSync(path.join(content, k), { recursive: true });
  yaz(content, "Levels/ova/ova.level.json", "{\"ad\":\"ova\"}");
  yaz(content, "Characters/Orion/Orion.karakter.json", "{\"tur\":\"karakter\"}");
  yaz(content, "Sequences/yuru.json", "{\"s\":1}");
  yaz(engine, "orion-lowpoly.glb", "GLB");
  return { content, engine, kokler: { Content: content, Engine: engine } };
}

test("adres: bilinen kök + temiz parçalar; kaçış, gizli, boş parça, Windows'ta geçersiz karakter, bilinmeyen kök reddedilir", () => {
  assert.deepEqual(adresParcalari("Content/Characters/Orion"), ["Content", "Characters", "Orion"]);
  assert.deepEqual(adresParcalari("Engine"), ["Engine"]);
  for (const a of ["", null, 5, "Content/../x", "Content/./x", "Content//x", "Content/.silinenler/x", "Content/a\\b", "Content/a:b", "Content/a*b", "Game/x", "/Content/x", "Content/x/", "content/x"])
    assert.equal(kod(() => adresParcalari(a)), "gecersiz-adres", String(a));
  assert.deepEqual([...KOKLER], ["Content", "Engine"]);
});

test("adGecerli: Türkçe harf, boşluk, nokta uzantı olur; ayrılmış ad, sondaki boşluk/nokta, baştaki nokta, 97 karakter olmaz", () => {
  for (const a of ["Orion.karakter.json", "çay ocağı.glb", "a", "x".repeat(96)]) assert.equal(adGecerli(a), true, a);
  for (const a of ["", ".gizli", "a ", "a.", "con", "NUL.txt", "x".repeat(97), "a/b", "a|b", "..", null]) assert.equal(adGecerli(a), false, String(a));
});

test("çöz: tam yol köke sığar; Engine'e yazma 'salt-okunur'; kökü olmayan oturumda 'kok-yok'", () => {
  const { kokler, content } = kur();
  assert.equal(adresCoz(kokler, "Content/Sequences/yuru.json").tam, path.join(content, "Sequences", "yuru.json"));
  assert.equal(kod(() => adresCoz(kokler, "Engine/x.glb", { yazma: true })), "salt-okunur");
  assert.doesNotThrow(() => adresCoz(kokler, "Engine/x.glb"));
  assert.equal(kod(() => adresCoz({ Content: content }, "Engine/x")), "kok-yok");
  assert.equal(ustAdres("Content/a/b.json"), "Content/a");
});

test("liste: düz ve ağaç sırasıyla; gizli ve .tmp atlanır; yoksa boş; tavanı aşınca kesildi", () => {
  const { kokler, content } = kur();
  yaz(content, ".silinenler/1-eski.json"); yaz(content, "Sequences/yarim.json.tmp");
  const l = icerikListe(kokler, "Content");
  const adresler = l.ogeler.map((o) => o.adres);
  assert.ok(adresler.includes("Content/Levels/ova") && adresler.includes("Content/Levels/ova/ova.level.json") && adresler.includes("Content/Sequences/yuru.json"));
  assert.ok(!adresler.some((a) => a.includes(".silinenler") || a.endsWith(".tmp")), "gizli/tmp görünmez");
  assert.equal(l.ogeler.find((o) => o.adres === "Content/Levels")!.klasor, true);
  assert.equal(l.ogeler.find((o) => o.adres === "Content/Sequences/yuru.json")!.boyut, 7);
  assert.equal(l.kesildi, false);
  assert.deepEqual(icerikListe({ Content: path.join(content, "yok-boyle-yer") }, "Content").ogeler, []);
  assert.equal(kod(() => icerikListe(kokler, "Game" as never)), "gecersiz-adres");
  const buyuk = gecici();
  for (let i = 0; i < 6; i++) fs.mkdirSync(path.join(buyuk, `k${i}`));
  const derin = gecici(); let t = derin; for (let i = 0; i < 12; i++) { t = path.join(t, `d${i}`); fs.mkdirSync(t); }
  assert.equal(icerikListe({ Content: derin }, "Content").kesildi, true, "derinlik tavanı söylenir");
});

test("ikili/metin: dosyayı okur; klasör, yok ve tavandan büyük reddedilir", () => {
  const { kokler, content } = kur();
  assert.equal(Buffer.from(icerikIkili(kokler, "Engine/orion-lowpoly.glb").base64, "base64").toString(), "GLB");
  assert.equal(icerikMetin(kokler, "Content/Sequences/yuru.json"), "{\"s\":1}");
  assert.equal(kod(() => icerikIkili(kokler, "Content/Levels")), "klasor");
  assert.equal(kod(() => icerikIkili(kokler, "Content/yok.glb")), "yok");
  assert.equal(kod(() => icerikMetin(kokler, "Content/Levels")), "klasor");
  yaz(content, "Assets/dev.json", "x".repeat(1024 * 1024 + 1));
  assert.equal(kod(() => icerikMetin(kokler, "Content/Assets/dev.json")), "cok-buyuk");
});

test("yeni klasör: Assets altında olur; var olan, üst klasörü olmayan, Engine, kök ve düz klasörler reddedilir", () => {
  const { kokler, content } = kur();
  assert.equal(yeniKlasor(kokler, "Content/Assets/Esya"), "Content/Assets/Esya");
  assert.ok(fs.statSync(path.join(content, "Assets", "Esya")).isDirectory());
  assert.equal(kod(() => yeniKlasor(kokler, "Content/Assets/Esya")), "var");
  assert.equal(kod(() => yeniKlasor(kokler, "Content/Assets/Yok/Alt")), "yok");
  assert.equal(kod(() => yeniKlasor(kokler, "Engine/yeni")), "salt-okunur");
  assert.equal(kod(() => yeniKlasor(kokler, "Content")), "gecersiz-adres");
  assert.equal(kod(() => yeniKlasor(kokler, "Content/Sequences/alt")), "gecersiz-ad", "Sequences düz");
  assert.equal(kod(() => yeniKlasor(kokler, "Content/Levels/Buyuk Harf")), "gecersiz-ad", "level adı küçük harf/tire");
  assert.equal(yeniKlasor(kokler, "Content/Levels/yeni-level"), "Content/Levels/yeni-level");
});

test("adlandır: dosya/klasör yeni adı alır, var olanın üstüne yazmaz; korumalı klasör, Engine, geçersiz ad reddedilir", () => {
  const { kokler, content } = kur();
  assert.equal(adlandir(kokler, "Content/Characters/Orion/Orion.karakter.json", "Orion2.karakter.json"), "Content/Characters/Orion/Orion2.karakter.json");
  assert.ok(fs.existsSync(path.join(content, "Characters", "Orion", "Orion2.karakter.json")));
  yaz(content, "Assets/a.glb"); yaz(content, "Assets/b.glb");
  assert.equal(kod(() => adlandir(kokler, "Content/Assets/a.glb", "b.glb")), "var");
  assert.equal(kod(() => adlandir(kokler, "Content/Assets", "Varliklar")), "korumali");
  assert.equal(kod(() => adlandir(kokler, "Content", "X")), "korumali");
  assert.equal(kod(() => adlandir(kokler, "Engine/orion-lowpoly.glb", "x.glb")), "salt-okunur");
  assert.equal(kod(() => adlandir(kokler, "Content/Assets/a.glb", "../a.glb")), "gecersiz-ad");
  assert.equal(kod(() => adlandir(kokler, "Content/Assets/a.glb", "con")), "gecersiz-ad");
  assert.equal(kod(() => adlandir(kokler, "Content/Assets/yok.glb", "x.glb")), "yok");
  assert.equal(adlandir(kokler, "Content/Assets/a.glb", "a.glb"), "Content/Assets/a.glb", "aynı ad: değişiklik yok, hata yok");
});

test("adlandır · level: klasörle birlikte içindeki <ad>.level.json da adlanır; dosya tek başına adlanmaz; ad küçük harf/tire", () => {
  const { kokler, content } = kur();
  assert.equal(adlandir(kokler, "Content/Levels/ova", "ofis-2"), "Content/Levels/ofis-2");
  assert.ok(fs.existsSync(path.join(content, "Levels", "ofis-2", "ofis-2.level.json")) && !fs.existsSync(path.join(content, "Levels", "ofis-2", "ova.level.json")));
  assert.equal(kod(() => adlandir(kokler, "Content/Levels/ofis-2", "Ofis Büyük")), "gecersiz-ad");
  assert.equal(kod(() => adlandir(kokler, "Content/Levels/ofis-2/ofis-2.level.json", "x.level.json")), "korumali");
});

test("adlandır · Sequences/Graphs/NPC: '<ad>.json' ve grafAdiGecerli; boşluk/uzantısız ad reddedilir", () => {
  const { kokler } = kur();
  assert.equal(adlandir(kokler, "Content/Sequences/yuru.json", "kosu_1.json"), "Content/Sequences/kosu_1.json");
  assert.equal(kod(() => adlandir(kokler, "Content/Sequences/kosu_1.json", "kosu 1.json")), "gecersiz-ad");
  assert.equal(kod(() => adlandir(kokler, "Content/Sequences/kosu_1.json", "kosu")), "gecersiz-ad");
  assert.equal(kod(() => adlandir(kokler, "Content/Sequences/kosu_1.json", "k.txt")), "gecersiz-ad");
});

test("çoğalt: dosya '<ad> kopya.<uzantı>' (ilk noktadan: Orion kopya.karakter.json), tekrar 'kopya 2'; üstüne yazmaz; Engine/korumalı reddedilir", () => {
  const { kokler, content } = kur();
  assert.equal(cogalt(kokler, "Content/Characters/Orion/Orion.karakter.json"), "Content/Characters/Orion/Orion kopya.karakter.json");
  assert.equal(cogalt(kokler, "Content/Characters/Orion/Orion.karakter.json"), "Content/Characters/Orion/Orion kopya 2.karakter.json");
  assert.equal(fs.readFileSync(path.join(content, "Characters", "Orion", "Orion kopya.karakter.json"), "utf8"), "{\"tur\":\"karakter\"}");
  assert.equal(kod(() => cogalt(kokler, "Engine/orion-lowpoly.glb")), "salt-okunur");
  assert.equal(kod(() => cogalt(kokler, "Content/Levels")), "korumali");
  assert.equal(kod(() => cogalt(kokler, "Content/Assets/yok.glb")), "yok");
});

test("çoğalt · düz klasörler '_kopya', level klasörü '-kopya' ve içindeki level dosyası yeni adı alır; kopyalar ad kuralına uyar", () => {
  const { kokler, content } = kur();
  assert.equal(cogalt(kokler, "Content/Sequences/yuru.json"), "Content/Sequences/yuru_kopya.json");
  assert.equal(cogalt(kokler, "Content/Sequences/yuru.json"), "Content/Sequences/yuru_kopya_2.json");
  assert.equal(cogalt(kokler, "Content/Levels/ova"), "Content/Levels/ova-kopya");
  assert.ok(fs.existsSync(path.join(content, "Levels", "ova-kopya", "ova-kopya.level.json")) && !fs.existsSync(path.join(content, "Levels", "ova-kopya", "ova.level.json")));
  assert.ok(fs.existsSync(path.join(content, "Levels", "ova", "ova.level.json")), "kaynak yerinde");
  assert.equal(cogalt(kokler, "Content/Levels/ova"), "Content/Levels/ova-kopya-2");
  yaz(content, "Assets/Esya/a.glb");
  assert.equal(cogalt(kokler, "Content/Assets/Esya"), "Content/Assets/Esya kopya", "klasör kopyası içeriğiyle");
  assert.ok(fs.existsSync(path.join(content, "Assets", "Esya kopya", "a.glb")));
});

test("düz türlerde (Sequences) çoğalt/adlandır içteki `ad` alanını da uydurur (depolar adı içeriden okur); başka adlı ya da bozuk dosyaya dokunulmaz", () => {
  const { kokler, content } = kur();
  const ic = (g: string): unknown => JSON.parse(fs.readFileSync(path.join(content, g), "utf8")).ad;
  yaz(content, "Sequences/yuru.json", "{\"ad\":\"yuru\",\"s\":1}");
  cogalt(kokler, "Content/Sequences/yuru.json");
  assert.equal(ic("Sequences/yuru_kopya.json"), "yuru_kopya");
  assert.equal(ic("Sequences/yuru.json"), "yuru", "kaynak değişmez");
  adlandir(kokler, "Content/Sequences/yuru_kopya.json", "kosu.json");
  assert.equal(ic("Sequences/kosu.json"), "kosu");
  yaz(content, "Sequences/baska.json", "{\"ad\":\"farkli\"}");
  adlandir(kokler, "Content/Sequences/baska.json", "baska2.json");
  assert.equal(ic("Sequences/baska2.json"), "farkli", "içteki ad dosya adına eşit değilse dokunulmaz");
  yaz(content, "Sequences/bozuk.json", "{bozuk");
  assert.equal(cogalt(kokler, "Content/Sequences/bozuk.json"), "Content/Sequences/bozuk_kopya.json");
  assert.equal(fs.readFileSync(path.join(content, "Sequences/bozuk_kopya.json"), "utf8"), "{bozuk");
});

test("sil: .silinenler'e TAŞINIR (kalıcı silme yok), içerik korunur, listede görünmez; korumalı/Engine/yok reddedilir; aynı anda iki silme çakışmaz", () => {
  const { kokler, content } = kur();
  yaz(content, "Assets/a.glb", "A");
  const yer = sil(kokler, "Content/Assets/a.glb", () => 7);
  assert.equal(yer, ".silinenler/7-a.glb");
  assert.equal(fs.readFileSync(path.join(content, ".silinenler", "7-a.glb"), "utf8"), "A");
  assert.ok(!fs.existsSync(path.join(content, "Assets", "a.glb")));
  assert.ok(!icerikListe(kokler, "Content").ogeler.some((o) => o.adres.includes("a.glb")));
  yaz(content, "Assets/a.glb", "B");
  assert.equal(sil(kokler, "Content/Assets/a.glb", () => 7), ".silinenler/7-2-a.glb", "aynı zaman damgası ezmez");
  assert.equal(fs.readFileSync(path.join(content, ".silinenler", "7-a.glb"), "utf8"), "A");
  assert.equal(kod(() => sil(kokler, "Content/Assets", () => 1)), "korumali");
  assert.equal(kod(() => sil(kokler, "Content", () => 1)), "korumali");
  assert.equal(kod(() => sil(kokler, "Engine/orion-lowpoly.glb")), "salt-okunur");
  assert.equal(kod(() => sil(kokler, "Content/Assets/yok.glb")), "yok");
  sil(kokler, "Content/Levels/ova", () => 9);
  assert.ok(fs.existsSync(path.join(content, ".silinenler", "9-ova", "ova.level.json")), "klasör içeriğiyle taşınır");
});

test("içe aktar: glb/png kopyalanır; desteklenmeyen/dosya olmayan/büyük atlanır ve NEDENİ söylenir; ad temizlenir, çakışma ' 2'; yalnız Assets altı", () => {
  const { kokler, content } = kur();
  const dis = gecici();
  fs.writeFileSync(path.join(dis, "Masa.GLB"), "G"); fs.writeFileSync(path.join(dis, "doku.png"), "P"); fs.writeFileSync(path.join(dis, "not.txt"), "T"); fs.mkdirSync(path.join(dis, "klasor.png"));
  const s1 = iceAktar(kokler, "Content/Assets", [path.join(dis, "Masa.GLB"), path.join(dis, "doku.png"), path.join(dis, "not.txt"), path.join(dis, "klasor.png"), path.join(dis, "yok.glb")]);
  assert.deepEqual(s1.eklenen, ["Content/Assets/Masa.glb", "Content/Assets/doku.png"], "uzantı küçük harfe, içerik aynen");
  assert.deepEqual(s1.atlanan.map((a) => a.ad), ["not.txt", "klasor.png", "yok.glb"]);
  assert.ok(s1.atlanan.every((a) => a.neden.length > 3));
  assert.equal(fs.readFileSync(path.join(content, "Assets", "Masa.glb"), "utf8"), "G");
  assert.deepEqual(iceAktar(kokler, "Content/Assets", [path.join(dis, "doku.png")]).eklenen, ["Content/Assets/doku 2.png"], "çakışma ezmez");
  assert.equal(fs.readFileSync(path.join(content, "Assets", "doku.png"), "utf8"), "P");
  yaz(content, "Assets/Esya/.keep", "");
  assert.deepEqual(iceAktar(kokler, "Content/Assets/Esya", [path.join(dis, "doku.png")]).eklenen, ["Content/Assets/Esya/doku.png"], "alt klasör olur");
  assert.equal(kod(() => iceAktar(kokler, "Content/Sequences", [path.join(dis, "doku.png")])), "gecersiz-adres", "yalnız Assets");
  assert.equal(kod(() => iceAktar(kokler, "Content/Assets/yok", [])), "yok");
  assert.equal(kod(() => iceAktar(kokler, "Engine", [])), "salt-okunur");
});

test("içe aktarma adı temizliği: geçersiz karakter '_', baştaki nokta atılır, ayrılmış ad önüne '_', uzun ad kısalır, uzantı korunur", () => {
  assert.equal(icAktarAdi("a:b*c.glb"), "a_b_c.glb");
  assert.equal(icAktarAdi(".gizli.png"), "gizli.png");
  assert.equal(icAktarAdi("CON.glb"), "_CON.glb");
  assert.equal(icAktarAdi(`${"x".repeat(200)}.JPG`), `${"x".repeat(80)}.jpg`);
  assert.equal(icAktarAdi("...png"), "varlik.png");
});

test("liste tavanı: 6000 öğeden fazlası KESİLİR ve 'kesildi' söylenir (sessiz kırpma yok)", () => {
  const { content } = kur();
  const boldu = path.join(content, "Assets", "cok");
  fs.mkdirSync(boldu);
  for (let i = 0; i < 6100; i++) fs.writeFileSync(path.join(boldu, `d${i}.txt`), "");
  const l = icerikListe({ Content: content }, "Content");
  assert.equal(l.kesildi, true);
  assert.equal(l.ogeler.length, 6000);
});

test("ikili tavan: 48 MB'tan büyük dosya 'cok-buyuk'; tam sınırdaki okunur", () => {
  const { kokler, content } = kur();
  const buyuk = path.join(content, "Assets", "dev.glb");
  fs.writeFileSync(buyuk, ""); fs.truncateSync(buyuk, 48 * 1024 * 1024 + 1);
  assert.equal(kod(() => icerikIkili(kokler, "Content/Assets/dev.glb")), "cok-buyuk");
  fs.truncateSync(buyuk, 1024);
  assert.equal(icerikIkili(kokler, "Content/Assets/dev.glb").boyut, 1024);
});

test("içe aktarma boyut tavanı: 128 MB'tan büyük dosya ATLANIR ve nedeni söylenir; sınırdaki kopyalanır", () => {
  const { kokler } = kur();
  const dis = gecici(), buyuk = path.join(dis, "dev.glb"), sinir = path.join(dis, "sinir.glb");
  fs.writeFileSync(buyuk, ""); fs.truncateSync(buyuk, 128 * 1024 * 1024 + 1);
  fs.writeFileSync(sinir, ""); fs.truncateSync(sinir, 128 * 1024 * 1024);
  const s = iceAktar(kokler, "Content/Assets", [buyuk, sinir]);
  assert.deepEqual(s.eklenen, ["Content/Assets/sinir.glb"]);
  assert.equal(s.atlanan.length, 1);
  assert.match(s.atlanan[0]!.neden, /çok büyük/);
});

test("taşı: aynı tür içinde klasöre taşır; üstüne yazmaz; Engine/korumalı/level dosyası/başka tür/kendi içine/ad kuralı reddedilir", () => {
  const { kokler, content } = kur();
  yaz(content, "Assets/a.glb", "A"); yaz(content, "Assets/ormanlik/b.glb", "B"); fs.mkdirSync(path.join(content, "Assets/kutu"));
  assert.equal(tasi(kokler, "Content/Assets/a.glb", "Content/Assets/kutu"), "Content/Assets/kutu/a.glb");
  assert.ok(fs.existsSync(path.join(content, "Assets/kutu/a.glb")) && !fs.existsSync(path.join(content, "Assets/a.glb")));
  // aynı yere taşıma sessiz başarı
  assert.equal(tasi(kokler, "Content/Assets/kutu/a.glb", "Content/Assets/kutu"), "Content/Assets/kutu/a.glb");
  // çakışma: üstüne yazmaz
  yaz(content, "Assets/a.glb", "A2");
  assert.equal(kod(() => tasi(kokler, "Content/Assets/a.glb", "Content/Assets/kutu")), "var");
  assert.equal(fs.readFileSync(path.join(content, "Assets/kutu/a.glb"), "utf8"), "A");
  // klasör taşıma + kendi içine yok
  assert.equal(tasi(kokler, "Content/Assets/ormanlik", "Content/Assets/kutu"), "Content/Assets/kutu/ormanlik");
  assert.equal(kod(() => tasi(kokler, "Content/Assets/kutu", "Content/Assets/kutu/ormanlik")), "gecersiz-adres");
  assert.equal(kod(() => tasi(kokler, "Content/Assets/kutu", "Content/Assets/kutu")), "gecersiz-adres");
  // Engine, korumalı, level dosyası, başka tür, kök
  assert.equal(kod(() => tasi(kokler, "Engine/orion-lowpoly.glb", "Content/Assets")), "salt-okunur");
  assert.equal(kod(() => tasi(kokler, "Content/Assets/a.glb", "Engine")), "salt-okunur");
  assert.equal(kod(() => tasi(kokler, "Content/Assets", "Content/Characters")), "korumali");
  assert.equal(kod(() => tasi(kokler, "Content/Levels/ova/ova.level.json", "Content/Levels")), "korumali");
  assert.equal(kod(() => tasi(kokler, "Content/Assets/a.glb", "Content/Characters")), "gecersiz-adres");
  assert.equal(kod(() => tasi(kokler, "Content/Assets/a.glb", "Content")), "gecersiz-adres");
  // türün ad kuralı: Sequences düz klasör (klasör açılmaz), yok olan hedef/kaynak
  assert.equal(kod(() => tasi(kokler, "Content/Sequences/yuru.json", "Content/Sequences/yok")), "yok");
  assert.equal(kod(() => tasi(kokler, "Content/Assets/yok.glb", "Content/Assets/kutu")), "yok");
  assert.ok(fs.existsSync(path.join(content, "Sequences/yuru.json")));
});
