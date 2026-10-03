// mind/komutSozlugu.test.ts — Doğuştan komut programları (spec 13 Faz 2b).
//
// "GERÇEK" sözler karar kaydından (2026-09-27 → 10-02), Ozyn'in yazdığı gibi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { komutCoz, sozuNormalle, yonelmeCapasi, iyelikCapasi, GEL_MESAFESI } from "./komutSozlugu.ts";

const program = (soz: string) => komutCoz(soz)?.program ?? null;
const adimlar = (soz: string) => JSON.parse(JSON.stringify(komutCoz(soz)?.adimlar ?? null));

// ── Gerçek sözler: eşleşmesi gerekenler ─────────────────────────────────────

test("GERÇEK: 'otur' → otur", () => {
  assert.deepEqual(adimlar("otur"), [{ tur: "otur" }]);
});

test("GERÇEK: 'masaya git ve otur' → çapasız otur (sandalyeye yürür ve oturur)", () => {
  assert.deepEqual(adimlar("masaya git ve otur"), [{ tur: "otur" }]);
});

test("GERÇEK (ortak test 3): 'bilgisayara git otur' → çapasız otur", () => {
  for (const s of ["bilgisayara git otur", "masaya geç otur", "sandalyeye git ve otur"]) {
    assert.deepEqual(adimlar(s), [{ tur: "otur" }], s);
  }
});

test("oturulamayan yere 'git otur' programa girmez: 'tahtaya git otur'", () => {
  assert.equal(program("tahtaya git otur"), null);
});

test("GERÇEK: 'kalk' → kalk", () => {
  assert.deepEqual(adimlar("kalk"), [{ tur: "kalk" }]);
});

test("GERÇEK: 'bana gel' (çift boşluklu da) → Ozyn'e yürü, 1,2 m kala dur", () => {
  for (const s of ["bana gel", "bana  gel"]) {
    assert.deepEqual(adimlar(s), [{ tur: "git", hedef: { tip: "oyuncu" }, mesafe: GEL_MESAFESI }], s);
  }
});

test("GERÇEK: 'önündeki bilgisayari aç' ve 'bilgisayari kullan' → bilgisayar programı", () => {
  for (const s of ["önündeki bilgisayari aç", "önündeki bilgisayarı aç", "bilgisayari kullan"]) {
    assert.deepEqual(adimlar(s), [{ tur: "odaklan", capa: "monitor" }], s);
  }
});

test("GERÇEK: yer + git → o çapaya yürü", () => {
  const izgara: [string, string][] = [
    ["tahtaya git", "tahta"], ["pencereye git", "pencere"], ["masaya git", "masa"],
    ["bilgisayara git", "monitor"], ["kapıya git", "kapi"], ["beyaz tahtaya git", "tahta"],
    ["odanın ortasına git", "oda_ortasi"], ["sandalyeye git", "sandalye"], ["monitöre git", "monitor"],
  ];
  for (const [soz, capa] of izgara) {
    assert.deepEqual(adimlar(soz), [{ tur: "git", hedef: { tip: "capa", ad: capa } }], soz);
  }
});

test("yer + bak → o çapaya bak; 'bana bak' → Ozyn'e bak", () => {
  assert.deepEqual(adimlar("pencereye bak"), [{ tur: "bak", hedef: { tip: "capa", ad: "pencere" } }]);
  assert.deepEqual(adimlar("bana bak"), [{ tur: "bak", hedef: { tip: "oyuncu" } }]);
});

test("hitap ve nezaket atılır: 'Orion, otur lütfen!' → otur", () => {
  assert.equal(program("Orion, otur lütfen!"), "komut:otur");
});

// ── Gerçek sözler: LLM'e gitmesi gerekenler (yanlış eşleşme 0) ──────────────

test("GERÇEK: içerik isteyen yazma sözleri programa girmez (ne yazılacağını LLM bilir)", () => {
  for (const s of ["tahtaya adını yaz", "tahtaya yazı yaz", "birseyler yaz", "adını yaz tahtaya",
    "tahtaya basit bir matematik formülü yaz", "bide quantum formülü yaz sen yaz", "beyaz tahtaya yaz"]) {
    assert.equal(program(s), null, s);
  }
});

test("GERÇEK: sorular ve sohbet programa girmez", () => {
  for (const s of ["nasilsin orion", "ne yapıyorsun", "ne görüyorsun", "karşında ne var?", "ben neredeyim",
    "neredesin konumun ne", "neler yapabilirsin", "hareket edemiyorsun gibi", "naber", "ne oldu?",
    "şehri görmek istermisin?", "bareber yapıcaz onu", "sen seç", "odada başka neler var"]) {
    assert.equal(program(s), null, s);
  }
});

test("GERÇEK: belirsiz kullanım istekleri programa girmez", () => {
  // "open the monitor" BU LİSTEDEN ÇIKTI (Tur 6, Ozyn'a bildirildi): İngilizce paket yokken LLM'e gidiyordu; İngilizce
  // paketle artık bilgisayar programı (aşağıda "İngilizce paketi"). Diğerleri bilerek LLM'de kalır.
  for (const s of ["tahtayi kullan", "tahtyi kullan", "sırayla odada gezin", "can you go tahta", "use that"]) {
    assert.equal(program(s), null, s);
  }
});

test("sözün bir PARÇASI kalıba uyuyorsa eşleşmez: 'otur ve bana anlat'", () => {
  for (const s of ["otur ve bana anlat", "neden oturdun", "hemen tahtaya git ve yaz", "otur mu dedim", "istersen tahtaya git"]) {
    assert.equal(program(s), null, s);
  }
});

test("bilinmeyen yer programa girmez: 'mutfağa git'", () => {
  assert.equal(program("mutfağa git"), null);
});

// ── Tur 6: dolgu, Türkçe aileler, İngilizce paketi ──────────────────────────
// Kalıplar kör setteki cümlelere göre DEĞİL, sözcük/dil bilgisi ailelerine göre yazıldı (docs/olcum-soz-siniflandirma.md Tur 6).

test("dolgu sözcükleri HER YERDEN atılır: hemen/şimdi/bi/biraz/zahmet olmazsa/please/hey", () => {
  const izgara: [string, string][] = [
    ["hemen otur", "komut:otur"], ["otur bi", "komut:otur"], ["şimdi masaya bak", "komut:bak"],
    ["tahtaya bi bak orion", "komut:bak"], ["zahmet olmazsa pencereye yürü", "komut:git"],
    ["kapıya git hemen", "komut:git"], ["bilgisayarı kullan biraz", "komut:bilgisayar"],
    ["sandalyeye otur hadi", "komut:otur"], ["hey sit down", "komut:otur"], ["stand up please", "komut:kalk"],
  ];
  for (const [soz, p] of izgara) assert.equal(program(soz), p, soz);
  assert.equal(sozuNormalle("Hey Orion, zahmet olmazsa bi otur şimdi!"), "otur");
});

test("dolgu içerik taşımaz ama olumsuzluk ve soru eki dolgu DEĞİL: 'hemen oturma' ve 'oturabilir misin' LLM'e", () => {
  for (const s of ["hemen oturma", "bi oturabilir misin", "şimdi gitme", "lütfen kalkma"]) {
    assert.equal(program(s), null, s);
  }
});

test("<yer>(n)in yanına/önüne/başına git·geç → o çapaya yürü", () => {
  const izgara: [string, string][] = [
    ["masanın yanına git", "masa"], ["sandalyenin yanına git", "sandalye"], ["pencerenin önüne geç", "pencere"],
    ["bilgisayarın başına geç", "monitor"], ["tahtanın karşısına geç", "tahta"], ["beyaz tahtanın yanına git", "tahta"],
    ["koltuğun yanına git", "sandalye"],
  ];
  for (const [soz, capa] of izgara) {
    assert.deepEqual(adimlar(soz), [{ tur: "git", hedef: { tip: "capa", ad: capa } }], soz);
  }
});

test("<yer>(y)e doğru git·yürü, yaklaş, <yer> gel → çapaya yürü; bana doğru/yaklaş → Ozyn'e", () => {
  const izgara: [string, string][] = [
    ["tahtaya doğru yürü", "tahta"], ["pencereye doğru git", "pencere"], ["masaya yaklaş", "masa"],
    ["odanın ortasına gel", "oda_ortasi"], ["kapıya yürü", "kapi"],
  ];
  for (const [soz, capa] of izgara) {
    assert.deepEqual(adimlar(soz), [{ tur: "git", hedef: { tip: "capa", ad: capa } }], soz);
  }
  for (const s of ["bana doğru gel", "bana doğru yürü", "bana yaklaş", "yanıma doğru gel", "gel bana", "benim yanıma gel"]) {
    assert.deepEqual(adimlar(s), [{ tur: "git", hedef: { tip: "oyuncu" }, mesafe: GEL_MESAFESI }], s);
  }
});

test("koltuk = sandalye (ünsüz yumuşaması): 'koltuğa otur' → otur; oturulamayan yere otur → LLM'e", () => {
  assert.equal(yonelmeCapasi("koltuga"), "sandalye");
  assert.equal(iyelikCapasi("koltugun"), "sandalye");
  assert.equal(program("koltuğa otur"), "komut:otur");
  assert.equal(program("sandalyeye otur"), "komut:otur");
  for (const s of ["tahtaya otur", "pencereye otur", "mutfağa otur"]) assert.equal(program(s), null, s);
});

test("odaklan: yalnız bilgisayar/ekran/monitör → bilgisayar programı; 'tahtaya odaklan' belirsiz → LLM'e", () => {
  for (const s of ["monitöre odaklan", "ekrana odaklan", "bilgisayara odaklan"]) {
    assert.deepEqual(adimlar(s), [{ tur: "odaklan", capa: "monitor" }], s);
  }
  assert.equal(program("tahtaya odaklan"), null);
});

test("'kıpırdama' ve 'hareket etme' dur demektir; ZIT anlamlı 'durma' programa girmez", () => {
  for (const s of ["kıpırdama", "hareket etme"]) assert.deepEqual(adimlar(s), [{ tur: "dur" }], s);
  assert.equal(program("durma"), null);
});

test("'kalk ayağa' ve 'pencereden dışarı bak'", () => {
  assert.deepEqual(adimlar("kalk ayağa"), [{ tur: "kalk" }]);
  assert.deepEqual(adimlar("pencereden dışarı bak"), [{ tur: "bak", hedef: { tip: "capa", ad: "pencere" } }]);
});

test("İngilizce paketi: otur/kalk/dur/gel/bak/git/bilgisayar kalıpları", () => {
  const otur = ["sit down", "sit", "take a seat", "sit on the chair", "sit at the desk", "sit in the armchair"];
  const kalk = ["stand up", "get up", "stand", "rise"];
  const dur = ["stop", "freeze", "stop moving", "hold still", "don't move"];
  const gel = ["come here", "come over here", "come to me", "come closer", "walk toward me"];
  for (const s of otur) assert.deepEqual(adimlar(s), [{ tur: "otur" }], s);
  for (const s of kalk) assert.deepEqual(adimlar(s), [{ tur: "kalk" }], s);
  for (const s of dur) assert.deepEqual(adimlar(s), [{ tur: "dur" }], s);
  for (const s of gel) assert.deepEqual(adimlar(s), [{ tur: "git", hedef: { tip: "oyuncu" }, mesafe: GEL_MESAFESI }], s);
  assert.deepEqual(adimlar("look at me"), [{ tur: "bak", hedef: { tip: "oyuncu" } }]);
  const git: [string, string][] = [
    ["go to the window", "pencere"], ["head to the door", "kapi"], ["walk to the desk", "masa"], ["go next to the table", "masa"],
    ["please walk over to the whiteboard", "tahta"], ["go stand in the middle of the room", "oda_ortasi"],
    ["go to the computer", "monitor"], ["walk toward the window", "pencere"], ["go in front of the board", "tahta"],
    ["go over next to the table", "masa"],
  ];
  for (const [soz, capa] of git) assert.deepEqual(adimlar(soz), [{ tur: "git", hedef: { tip: "capa", ad: capa } }], soz);
  const bak: [string, string][] = [
    ["look at the board", "tahta"], ["look at the screen", "monitor"], ["look out the window", "pencere"], ["look at the window", "pencere"],
  ];
  for (const [soz, capa] of bak) assert.deepEqual(adimlar(soz), [{ tur: "bak", hedef: { tip: "capa", ad: capa } }], soz);
  for (const s of ["turn on the computer", "open the monitor", "use the terminal", "focus on the monitor", "start the computer"]) {
    assert.deepEqual(adimlar(s), [{ tur: "odaklan", capa: "monitor" }], s);
  }
  assert.deepEqual(adimlar("go to the table and sit down"), [{ tur: "otur" }]);
});

test("İngilizce: soru, olumsuz, bileşik, belirsiz, geçmiş/anlatı, meta ve bilinmeyen yer LLM'e gider (yanlış eşleşme 0)", () => {
  for (const s of [
    "can you sit down", "could you come here", "will you stand up", "can you come here",
    "don't sit down", "do not go to the door", "please don't go to the door",
    "stand up and come here", "sit down and look at the screen", "come here and sit",
    "go over there", "look at that", "do that thing again", "sit there",
    "what does the sit command do", "he stood up earlier", "if you sit down I'll be happy", "I walked to the window yesterday",
    "go to the kitchen", "look at the weather", "write hello on the board", "what do you see", "where is the desk",
    "sit on the floor", "sit on the window", "open the door", "go", "look", "come", "how are you",
  ]) {
    // "come" tek başına bir KOMUTTUR (aşağıda ayrıca), burada olmamalı
    if (s === "come") continue;
    assert.equal(program(s), null, s);
  }
  assert.equal(program("come"), "komut:gel");
});

test("SORU BİÇİMİ: yeni soru eşleşmesi YOK (can/could/will you, -ebilir misin, -ar mısın)", () => {
  for (const s of ["oturabilir misin", "gelebilir misin", "pencereye gidebilir misin", "kalkabilir misin orion",
    "tahtaya bakar mısın", "gidebilir misin", "yürüyebilir misin"]) {
    assert.equal(program(s), null, s);
  }
});

test("SORU BİÇİMİ (MEVCUT karar, Ozyn onayına AÇIK): 'oturur musun', 'kalkar misin', 'bakar misin bana' komuttur", () => {
  // Bu üçü Faz 2b'de komut olarak yazıldı; tutarsızlık: 'oturabilir misin' eşleşmez. Karar Ozyn'ın; burada yalnız MEVCUT davranış sabitlenir.
  assert.equal(program("oturur musun"), "komut:otur");
  assert.equal(program("kalkar misin"), "komut:kalk");
  assert.equal(program("bakar misin bana"), "komut:bak");
});

test("olumsuz, belirsiz, geçmiş/koşul/meta Türkçe sözler LLM'e gider", () => {
  for (const s of ["oturma", "gitme", "kalkma", "oraya gitme", "pencereye bakma", "tahtaya yaklaşma", "oraya git", "şuna bak",
    "suraya otur", "bunu yap", "git", "bak", "dün tahtaya gittin", "o az önce oturdu", "oturursan sevinirim", "git komutu ne işe yarar",
    "masaya git sonra otur", "kalk ve pencereye git", "ayağa kalkıp kapıya yürü", "tahtaya git ve merhaba yaz"]) {
    assert.equal(program(s), null, s);
  }
});

test("iyelikCapasi: tamlayan eki ('masanin', 'tahtanin', 'bilgisayarin', 'pencerenin'); yalın ad çapa sayılmaz", () => {
  assert.equal(iyelikCapasi("masanin"), "masa");
  assert.equal(iyelikCapasi("tahtanin"), "tahta");
  assert.equal(iyelikCapasi("bilgisayarin"), "monitor");
  assert.equal(iyelikCapasi("pencerenin"), "pencere");
  assert.equal(iyelikCapasi("masa"), null);
  assert.equal(iyelikCapasi("mutfagin"), null);
});

// ── Tur 7: kaçan aileler (kör set 2'nin kaçırdığı AİLELER; cümleleri değil) ──

test("Tur 7 hitap ve zaman dolgusu: abi, kardeşim, hocam, go ahead and, for a bit", () => {
  const izgara: [string, string][] = [
    ["bana gel abi", "komut:gel"], ["yanıma gel kardeşim", "komut:gel"], ["hocam otur", "komut:otur"], ["usta kalk", "komut:kalk"],
    ["go ahead and open the computer", "komut:bilgisayar"], ["use the computer for a bit", "komut:bilgisayar"],
    ["go ahead and sit down", "komut:otur"], ["stand up for a moment", "komut:kalk"],
  ];
  for (const [soz, p] of izgara) assert.equal(program(soz), p, soz);
});

test("Tur 7 takma adlar: cam = pencere; pc = bilgisayar; 'bilgisayarı başlat'", () => {
  assert.deepEqual(adimlar("cama git"), [{ tur: "git", hedef: { tip: "capa", ad: "pencere" } }]);
  assert.deepEqual(adimlar("cama bak"), [{ tur: "bak", hedef: { tip: "capa", ad: "pencere" } }]);
  for (const s of ["pc yi kullan biraz", "pc'yi aç", "pcyi ac", "bilgisayarı başlat", "pc aç"]) {
    assert.deepEqual(adimlar(s), [{ tur: "odaklan", capa: "monitor" }], s);
  }
});

test("Tur 7 'çök' = otur, yalnız oturulabilen yerle; çıplak 'çok' ve oturulamayan yer LLM'e", () => {
  for (const s of ["koltuğa çök", "sandalyeye çök", "masaya çök"]) assert.deepEqual(adimlar(s), [{ tur: "otur" }], s);
  for (const s of ["tahtaya çök", "çök", "çok otur", "mutfağa çök"]) assert.equal(program(s), null, s);
});

test("Tur 7 gösterme sıfatı + AÇIK yer: 'şu koltuğa otur', 'bu masaya git'; 'şuraya/oraya' belirsiz KALIR", () => {
  assert.deepEqual(adimlar("hadi şu koltuğa otur"), [{ tur: "otur" }]);
  assert.deepEqual(adimlar("bu masaya git"), [{ tur: "git", hedef: { tip: "capa", ad: "masa" } }]);
  assert.deepEqual(adimlar("şu pencereye bak"), [{ tur: "bak", hedef: { tip: "capa", ad: "pencere" } }]);
  for (const s of ["şuraya otur", "oraya git", "buraya git", "şuna bak", "şu şeye bak"]) assert.equal(program(s), null, s);
});

test("Tur 7 'göz at' = bak; '<yer> tarafına bak/git'; ora tarafa belirsiz", () => {
  assert.deepEqual(adimlar("ekrana bi göz at"), [{ tur: "bak", hedef: { tip: "capa", ad: "monitor" } }]);
  assert.deepEqual(adimlar("tahta tarafına bak"), [{ tur: "bak", hedef: { tip: "capa", ad: "tahta" } }]);
  assert.deepEqual(adimlar("pencere tarafına git"), [{ tur: "git", hedef: { tip: "capa", ad: "pencere" } }]);
  for (const s of ["ora tarafa yürü", "bu tarafa bak", "göz at"]) assert.equal(program(s), null, s);
});

test("Tur 7 '<yer>(n)in yanına yaklaş', '<yer>(n)in önünde dur'", () => {
  assert.deepEqual(adimlar("pencerenin yanına yaklaş"), [{ tur: "git", hedef: { tip: "capa", ad: "pencere" } }]);
  assert.deepEqual(adimlar("kapının önünde dur"), [{ tur: "git", hedef: { tip: "capa", ad: "kapi" } }]);
  assert.deepEqual(adimlar("masanın yanında dur"), [{ tur: "git", hedef: { tip: "capa", ad: "masa" } }]);
  for (const s of ["oranın önünde dur", "mutfağın önünde dur"]) assert.equal(program(s), null, s);
});

test("Tur 7 BİLEREK eklenmeyenler: 'dön' (git mi bak mı?), 'bekle/hold on' (konuşma duraklatması), bulanık yazım", () => {
  for (const s of ["masaya dön", "pencereye dön", "bekle", "orion biraz bekle", "hold on", "bilgisyarı aç", "pencreye git"]) {
    assert.equal(program(s), null, s);
  }
});

test("Tur 7 İngilizce: glance/peek/take a look, face, approach, rise from, stop right there", () => {
  const bak: [string, string][] = [
    ["glance at the monitor", "monitor"], ["peek at the window", "pencere"], ["take a look at the board", "tahta"],
    ["face the window", "pencere"], ["have a look at the screen", "monitor"],
  ];
  for (const [soz, capa] of bak) assert.deepEqual(adimlar(soz), [{ tur: "bak", hedef: { tip: "capa", ad: capa } }], soz);
  assert.deepEqual(adimlar("approach the desk"), [{ tur: "git", hedef: { tip: "capa", ad: "masa" } }]);
  assert.deepEqual(adimlar("rise from the armchair"), [{ tur: "kalk" }]);
  assert.deepEqual(adimlar("get up from the chair"), [{ tur: "kalk" }]);
  for (const s of ["stop right there", "stop there", "stop here", "freeze right there"]) assert.deepEqual(adimlar(s), [{ tur: "dur" }], s);
});

test("Tur 7 İngilizce olumsuzlar: bilinmeyen yer, zamir, soru ve oturulamayan 'rise from' LLM'e", () => {
  for (const s of ["get closer to it", "approach it", "face that", "glance at that", "rise from the floor", "get up from the floor",
    "can you glance at the monitor", "could you approach the desk", "will you face the window", "take a look at it", "approach me",
    "rise from the window", "get up from the door"]) {
    assert.equal(program(s), null, s);
  }
});

// ── Yardımcılar ─────────────────────────────────────────────────────────────

test("sozuNormalle: Türkçe katlama, noktalama ve çift boşluk", () => {
  assert.equal(sozuNormalle("  Önündeki BİLGİSAYARI   aç!! "), "onundeki bilgisayari ac");
});

test("yonelmeCapasi: ek yoksa çapa sayılmaz ('tahta git' değil 'tahtaya git')", () => {
  assert.equal(yonelmeCapasi("tahta"), null);
});
