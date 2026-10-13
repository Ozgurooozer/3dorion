// mind/ortamKomutlari.test.ts — Doğuştan ORTAM komutları: eşleşme tablosu + "yanlış eşleşme 0" kalıpları.
// Sözün TAMAMI kalıba uymalı; tespit ("soğuk."), soru ("saat kaç?"), olumsuz ("ışığı kısma") ve birden çok istek LLM'e gider.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { komutCoz } from "./komutSozlugu.ts";
import type { OrtamNe } from "../protocol/niyet.ts";

type Beklenen = [ne: OrtamNe, deger?: string, sayi?: number];

function coz(soz: string, ortam = true): Beklenen | null {
  const e = komutCoz(soz, { ortam });
  if (!e) return null;
  assert.equal(e.program, "komut:ortam", soz);
  assert.equal(e.adimlar.length, 1, soz);
  const a = e.adimlar[0]!;
  assert.equal(a.tur, "ortam", soz);
  if (a.tur !== "ortam") return null;
  return [a.ne, ...(a.deger !== undefined ? [a.deger] : a.sayi !== undefined ? [undefined] : []), ...(a.sayi !== undefined ? [a.sayi] : [])] as Beklenen;
}

const ESLESEN: [soz: string, beklenen: Beklenen][] = [
  // zaman: günün adı
  ["gece yap", ["saat", undefined, 0]],
  ["Geceye çevir", ["saat", undefined, 0]],
  ["gece olsun", ["saat", undefined, 0]],
  ["Orion akşam yap lütfen", ["saat", undefined, 19.5]],
  ["sabah olsun", ["saat", undefined, 8]],
  ["gündüz yap", ["saat", undefined, 13]],
  ["öğleye getir", ["saat", undefined, 12]],
  ["gün batımı yap", ["saat", undefined, 18.5]],
  ["gün doğumu yap", ["saat", undefined, 5.5]],
  ["gece yarısı yap", ["saat", undefined, 0]],
  // zaman: saat
  ["saat 21", ["saat", undefined, 21]],
  ["Saat 9:30", ["saat", undefined, 9.5]],
  ["saati 21 yap", ["saat", undefined, 21]],
  ["saati 15 ayarla", ["saat", undefined, 15]],
  ["21:30 yap", ["saat", undefined, 21.5]],
  ["3pm yap", ["saat", undefined, 15]],
  ["3 PM", ["saat", undefined, 15]],
  ["saati 7 am yap", ["saat", undefined, 7]],
  ["12 am yap", ["saat", undefined, 0]],
  ["12pm", ["saat", undefined, 12]],
  ["9:30 am", ["saat", undefined, 9.5]],
  ["saat 24", ["saat", undefined, 24]],
  // zaman: kaydır, akış
  ["saati 2 saat ileri al", ["saat_kaydir", undefined, 2]],
  ["saati ileri al", ["saat_kaydir", undefined, 1]],
  ["saati geri sar", ["saat_kaydir", undefined, -1]],
  ["3 saat geri al", ["saat_kaydir", undefined, -3]],
  ["4 saat ileri al", ["saat_kaydir", undefined, 4]],
  ["zamanı akıt", ["akis", "ac"]],
  ["zaman aksın", ["akis", "ac"]],
  ["zamanı durdur", ["akis", "kapat"]],
  ["zamanı dondur", ["akis", "kapat"]],
  // ışık
  ["ışığı kıs", ["isik", "kis"]],
  ["Işığı biraz kıs", ["isik", "kis"]],
  ["ışıkları azalt", ["isik", "kis"]],
  ["ortamı karart", ["isik", "kis"]],
  ["biraz daha kıs", ["isik", "kis"]],
  ["daha karanlık yap", ["isik", "kis"]],
  ["ışığı aç", ["isik", "ac"]],
  ["ışıkları aç", ["isik", "ac"]],
  ["ışığı artır", ["isik", "ac"]],
  ["ortamı aydınlat", ["isik", "ac"]],
  ["daha aydınlık yap", ["isik", "ac"]],
  ["daha sıcak yap", ["isik", "sicak"]],
  ["ışığı daha sıcak yap", ["isik", "sicak"]],
  ["sıcak tonlar", ["isik", "sicak"]],
  ["sıcak yap", ["isik", "sicak"]],
  ["ışığı soğuk yap", ["isik", "soguk"]],
  ["daha soğuk renkler", ["isik", "soguk"]],
  ["ortamı soğut", ["isik", "soguk"]],
  ["ortamı ısıt", ["isik", "sicak"]],
  // stil, renk, sıfırla
  ["toon yap", ["stil", "toon"]],
  ["stili toon yap", ["stil", "toon"]],
  ["stil toon", ["stil", "toon"]],
  ["cel stili", ["stil", "cel"]],
  ["anime 90 yap", ["stil", "anime90"]],
  ["stili anime90 olsun", ["stil", "anime90"]],
  ["piksel stili", ["stil", "piksel"]],
  ["moebius yap", ["stil", "moebius"]],
  ["stili sıfırla", ["stil", "standart"]],
  ["normal yap", ["stil", "standart"]],
  ["pastel yap", ["renk", "pastel"]],
  ["renkleri pastel yap", ["renk", "pastel"]],
  ["pastel renkler", ["renk", "pastel"]],
  ["gündüz renkleri", ["renk", "gunduz"]],
  ["renkleri gündüz yap", ["renk", "gunduz"]],
  ["ortamı sıfırla", ["sifirla"]],
  ["her şeyi sıfırla", ["sifirla"]],
  ["ovayı eski haline getir", ["sifirla"]],
  ["varsayılana dön", ["sifirla"]],
  // sis
  ["sis aç", ["sis", "ac"]],
  ["sisi aç", ["sis", "ac"]],
  ["sis koy", ["sis", "ac"]],
  ["sisi kapat", ["sis", "kapat"]],
  ["sis yok", ["sis", "kapat"]],
  ["daha çok sis", ["sis", "yogun"]],
  ["sisi yoğunlaştır", ["sis", "yogun"]],
  ["sisi azalt", ["sis", "hafif"]],
  ["daha az sis", ["sis", "hafif"]],
  // efekt, shader
  ["bloom kapat", ["efekt", "bloom:kapat"]],
  ["bloomu kapat", ["efekt", "bloom:kapat"]],
  ["bloom aç", ["efekt", "bloom:ac"]],
  ["Bloom’u kapat", ["efekt", "bloom:kapat"]],
  ["vinyeti kapat", ["efekt", "vinyet:kapat"]],
  ["grenı aç".replace("ı", "i"), ["efekt", "gren:ac"]],
  ["ışık huzmesini kapat", ["efekt", "huzme:kapat"]],
  ["ao kapat", ["efekt", "ao:kapat"]],
  ["derinliği aç", ["efekt", "derinlik:ac"]],
  ["atmosferi aç", ["shader", "atmosfer:ac"]],
  ["atmosfer kapat", ["shader", "atmosfer:kapat"]],
  ["gök zamanı kapat", ["shader", "gokZamani:kapat"]],
  ["fırça aç", ["shader", "firca:ac"]],
  ["el yazmasını aç".replace("ını", "i"), ["shader", "elyazmasi:ac"]],
  // dünya
  ["dünyayı siberpunk yap", ["dunya", "siberpunk"]],
  ["ortaçağ dünyası", ["dunya", "ortacag"]],
  ["büyü dünyasına geç", ["dunya", "buyu"]],
  ["ova dünyası", ["dunya", "ova"]],
  // İngilizce
  ["make it night", ["saat", undefined, 0]],
  ["make it evening now", ["saat", undefined, 19.5]],
  ["set the time to 9 pm", ["saat", undefined, 21]],
  ["set the time to 14", ["saat", undefined, 14]],
  ["make it 3pm", ["saat", undefined, 15]],
  ["skip 3 hours", ["saat_kaydir", undefined, 3]],
  ["go back 2 hours", ["saat_kaydir", undefined, -2]],
  ["freeze time", ["akis", "kapat"]],
  ["let time flow", ["akis", "ac"]],
  ["dim the lights", ["isik", "kis"]],
  ["make it darker", ["isik", "kis"]],
  ["make it brighter", ["isik", "ac"]],
  ["make it warmer", ["isik", "sicak"]],
  ["make the light cooler", ["isik", "soguk"]],
  ["turn off bloom", ["efekt", "bloom:kapat"]],
  ["bloom off", ["efekt", "bloom:kapat"]],
  ["enable bloom", ["efekt", "bloom:ac"]],
  ["turn on the atmosphere".replace("atmosphere", "atmosfer"), ["shader", "atmosfer:ac"]],
  ["toon style", ["stil", "toon"]],
  ["use toon", ["stil", "toon"]],
  ["set the style to cel", ["stil", "cel"]],
  ["pastel colors", ["renk", "pastel"]],
  ["reset the world", ["sifirla"]],
  ["turn on the fog", ["sis", "ac"]],
  ["remove the fog", ["sis", "kapat"]],
  ["more fog", ["sis", "yogun"]],
  ["less fog", ["sis", "hafif"]],
  ["cyberpunk world", ["dunya", "siberpunk"]],
];

for (const [soz, beklenen] of ESLESEN) {
  test(`eşleşir: "${soz}"`, () => {
    const g = coz(soz);
    assert.ok(g, `eşleşmedi: ${soz}`);
    const [ne, deger, sayi] = beklenen;
    const e = komutCoz(soz)!.adimlar[0]!;
    assert.ok(e.tur === "ortam");
    if (e.tur !== "ortam") return;
    assert.equal(e.ne, ne);
    assert.equal(e.deger, deger);
    assert.equal(e.sayi, sayi);
  });
}

// "Yanlış eşleşme sessizlikten pahalıdır": bunlar LLM'e (ya da hiçbir programa) gider.
const ESLESMEYEN = [
  "saat kaç", "saat kaç oldu", "saat kaçta geldi", "saati söyle", "yarın saat 5 te gel", "saat 99", "saat 25", "13 pm", "0 pm", "saat 10 30 45",
  "ışığı kısma", "ışığı kısar mısın", "ışığı kıs ve gece yap", "gece yap ve ışığı kıs", "ışığı aç mı", "ışığı açma",
  "kıs", "kış", "aç", "kapat", "soğuk", "sıcak", "çok soğuk", "hava sıcak", "daha", "geri al", "ileri al",
  "hava güzel", "çok karanlık", "burası karanlık", "gece", "akşam", "sabah", "gündüz", "öğle", "toon", "pastel", "bloom", "sis", "ışık", "dünya", "ova",
  "gece olsun mu", "toon mu yapsak", "sisi kapatsam mı", "sis var mı",
  "yürü", "otur sonra gece yap", "tahtaya gece yaz", "tahtaya saat 9 yaz",
  "what time is it", "dim", "warmer", "cold", "night", "make it", "turn it off", "i am cold", "reset", "sifirla",
];
for (const soz of ESLESMEYEN) {
  test(`eşleşmez: "${soz}"`, () => {
    assert.equal(komutCoz(soz), null, `yanlış eşleşme: ${soz}`);
  });
}

test("ortam kapalıyken (level yok) hiçbir ortam sözü sahiplenilmez", () => {
  for (const [soz] of ESLESEN) assert.equal(komutCoz(soz, { ortam: false }), null, soz);
});

test("mevcut beden komutları ortam ailesinden etkilenmez", () => {
  assert.equal(komutCoz("otur", { ortam: false })?.program, "komut:otur");
  assert.equal(komutCoz("otur")?.program, "komut:otur");
  assert.equal(komutCoz("pencereye git")?.program, "komut:git");
  assert.equal(komutCoz("pencereye bak")?.program, "komut:bak");
  assert.equal(komutCoz("bana gel")?.program, "komut:gel");
});

test("Orion'un adı ve nezaket sözcükleri atılır, kalıp yine tüm sözü kapsar", () => {
  assert.deepEqual(coz("Orion lütfen hemen ışığı kıs"), ["isik", "kis"]);
  assert.deepEqual(coz("hadi saat 21 olsun"), ["saat", undefined, 21]);
});
