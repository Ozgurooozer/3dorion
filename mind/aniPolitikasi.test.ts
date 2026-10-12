// mind/aniPolitikasi.test.ts — Hafıza giriş politikası: selam saklanmaz, doğuştan komut düşük önemle, hata dersi normalleşir
// (Orion Beyin Ofisi T2-K7; canlı hafıza 2026-10-12: 228 sözün 101'i 1–2 kelime, 24 hata dersinin 11'i aynı ders).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { aniKaydi, dersiNormallestir, sohbetGurultusuMu, KOMUT_ONEMI } from "./aniSuzgeci.ts";
import { Hafiza } from "./hafiza.ts";
import type { Algi } from "../protocol/algi.ts";

const soz = (metin: string): Algi => ({ tur: "duydum", metin, kesin: true });
const sonuc = (not: string): Algi => ({ tur: "sonuc", sonuc: { niyet_id: "n_1", durum: "hata", not } });

test("selam/sohbet sözü hafızaya YAZILMAZ", () => {
  for (const m of ["merhaba", "Merhaba Orion!", "nasılsın", "NASİLSİN", "naber orion", "how are you", "hello", "hey"]) {
    assert.equal(aniKaydi(soz(m), "konusma", m), null, m);
  }
});

test("selam benzeri AMA bilgi taşıyan söz yazılır (tanınmayan kelime varsa saklanır — yanlışlıkla silmek geri alınamaz)", () => {
  for (const m of ["merhaba, terminalde claude kullanırım", "nasılsın bugün hava soğuk", "ben hacı"]) {
    assert.ok(aniKaydi(soz(m), "konusma", m), m);
  }
});

test("doğuştan komut sözü YAZILIR ama düşük önemle (sıkıştırmada ilk gider)", () => {
  for (const m of ["tahtaya git", "otur", "bana gel", "beni takip et"]) {
    assert.equal(aniKaydi(soz(m), "konusma", m)?.onem, KOMUT_ONEMI, m);
  }
});

test("komut olmayan söz normal önemle yazılır (Ozyn'in söyledikleri: 8)", () => {
  assert.equal(aniKaydi(soz("ben terminalde claude kullanırım"), "konusma", "ben terminalde claude kullanırım")?.onem, 8);
});

test("eski politika: hiçbir şey değişmez (geri alma yolu)", () => {
  assert.equal(aniKaydi(soz("merhaba"), "konusma", "merhaba", "eski")?.onem, 8);
  assert.equal(aniKaydi(soz("otur"), "konusma", "otur", "eski")?.onem, 8);
});

test("hata dersi: tırnak/parantez ayrıntısı atılır, aynı ders tek anıya iner", () => {
  const h = new Hafiza({ simdi: () => 1_000_000 });
  for (const ad of ["yönetim terminali", "çalışma masası", "odanın ortası", "beyaz tahta"]) {
    const icerik = `hata: bilinmeyen çapa/nesne: '${ad}'.`;
    const k = aniKaydi(sonuc(`bilinmeyen çapa/nesne: '${ad}'.`), "sonuc", icerik)!;
    h.ekle(k.icerik, "sonuc", k.onem);
  }
  assert.equal(h.sayi, 1);
});

test("hata dersi normalleştirme: farklı dersler ayrı kalır; hata olmayan metne dokunulmaz", () => {
  assert.notEqual(dersiNormallestir("hata: zaten ayaktasın; `kalk` yapacak bir şey yok."), dersiNormallestir("hata: zaten oturuyorsun."));
  assert.equal(dersiNormallestir("done: tamam (3 sn)"), "done: tamam (3 sn)");
  assert.equal(dersiNormallestir("hata: zaten onay bekleyen bir öneri var (\"git status\"); Ozyn karar verene kadar"), "hata: zaten onay bekleyen bir öneri var; Ozyn karar verene kadar");
});

test("sohbetGurultusuMu: uzun ya da boş söz selam sayılmaz", () => {
  assert.equal(sohbetGurultusuMu(""), false);
  assert.equal(sohbetGurultusuMu("merhaba orion nasılsın bugün"), false, "5 kelime");
});
