// mind/mdBaglami.test.ts — md dosyalarından bağlam: yalnız aktifler, anlık hafıza tam, sınırlar, atlananın nedeni, işaretlerin ayıklanması.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { ANLIK_HAFIZA, MD_SINIRLARI, mdBaglaminiKur, temizle, tahminiToken, type MdGirdisi } from "./mdBaglami.ts";
import { SISTEM_DOSYALARI } from "../host/mdDosyalari.js";

const g = (ad: string, metin: string, aktif = true): MdGirdisi => ({ ad, metin, aktif });

test("bekçi: anlık hafıza adı host'taki sistem dosyasıyla AYNI (iki yerde yazılı sabit ayrışmasın)", () => {
  assert.deepEqual([...SISTEM_DOSYALARI], [ANLIK_HAFIZA]);
});

test("hiç aktif dosya yoksa bağlam boş (çerçeve de gitmez)", () => {
  const b = mdBaglaminiKur([g("a.md", "x", false)]);
  assert.equal(b.metin, "");
  assert.deepEqual(b.kullanilan, []);
  assert.equal(b.tahminiToken, 0);
});

test("yalnız AKTİF dosyalar girer; çerçeve ve dosya başlığı vardır", () => {
  const b = mdBaglaminiKur([g("a.md", "Alfa"), g("b.md", "Beta", false)]);
  assert.match(b.metin, /^NOTES/);
  assert.match(b.metin, /## a\.md\nAlfa/);
  assert.doesNotMatch(b.metin, /Beta/);
});

test("anlık hafıza HER ZAMAN ilk sırada; ötekiler ada göre", () => {
  const b = mdBaglaminiKur([g("zeta.md", "Z"), g(ANLIK_HAFIZA, "H"), g("alfa.md", "A")]);
  assert.deepEqual(b.kullanilan.map((k) => k.ad), [ANLIK_HAFIZA, "alfa.md", "zeta.md"]);
});

test("anlık hafıza dosya sınırına takılmaz (tam girer); emniyet tavanını aşarsa kesilir ve bu raporda görünür", () => {
  const uzun = "satır\n".repeat(600);   // ≈3600 karakter: dosyaBasina'yı (2000) aşar, tavanı (6000) aşmaz
  const tam = mdBaglaminiKur([g(ANLIK_HAFIZA, uzun)]);
  assert.equal(tam.kullanilan[0]!.kesildi, false);
  const cokUzun = mdBaglaminiKur([g(ANLIK_HAFIZA, "x\n".repeat(MD_SINIRLARI.anlikTavan))]);
  assert.equal(cokUzun.kullanilan[0]!.kesildi, true);
  assert.ok(cokUzun.kullanilan[0]!.karakter <= MD_SINIRLARI.anlikTavan);
});

test("öteki dosya sınırı aşarsa KESİLİR ve kesildi işaretlenir", () => {
  const b = mdBaglaminiKur([g("a.md", "a".repeat(3000))]);
  assert.equal(b.kullanilan[0]!.kesildi, true);
  assert.ok(b.kullanilan[0]!.karakter <= MD_SINIRLARI.dosyaBasina);
});

test("toplam sınırına sığmayan dosya HİÇ girmez ve nedeni söylenir (sessiz yutulmaz)", () => {
  const dar = { dosyaBasina: 100, toplam: 150, anlikTavan: 6000 };
  const b = mdBaglaminiKur([g("a.md", "a".repeat(100)), g("b.md", "b".repeat(100))], dar);
  assert.deepEqual(b.kullanilan.map((k) => k.ad), ["a.md"]);
  assert.equal(b.atlanan[0]!.ad, "b.md");
  assert.match(b.atlanan[0]!.neden, /sığmadı/);
  assert.doesNotMatch(b.metin, /b{20}/);
});

test("anlık hafıza toplam sınırından muaf: öteki dosyaların hakkını yemez", () => {
  const dar = { dosyaBasina: 100, toplam: 100, anlikTavan: 6000 };
  const b = mdBaglaminiKur([g(ANLIK_HAFIZA, "h".repeat(500)), g("a.md", "a".repeat(100))], dar);
  assert.deepEqual(b.kullanilan.map((k) => k.ad), [ANLIK_HAFIZA, "a.md"]);
});

test("boş (yalnız boşluk/yorum) aktif dosya atlanır, nedeni 'boş'", () => {
  const b = mdBaglaminiKur([g("a.md", "  \n<!-- yalnız yorum -->\n ")]);
  assert.deepEqual(b.atlanan, [{ ad: "a.md", neden: "boş" }]);
  assert.equal(b.metin, "");
});

test("temizle: HTML yorumları (otomatik bölüm işaretleri dahil) ayıklanır, içerik kalır", () => {
  assert.equal(temizle("A\n<!-- orion:otomatik -->\nB\n<!-- /orion:otomatik -->\nC"), "A\n\nB\n\nC");
  assert.equal(temizle("x\r\n\r\n\r\n\r\ny"), "x\n\ny");
});

test("token tahmini kabaca karakter/3 ve yukarı yuvarlar", () => {
  assert.equal(tahminiToken(0), 0);
  assert.equal(tahminiToken(10), 4);
});

test("bekçi: renderer'daki ad kuralı host'takiyle AYNI (aynı örnekler ikisine sorulur)", async () => {
  const { mdAdiGecerli: host } = await import("../host/mdDosyalari.js");
  const { mdAdiGecerli: burada } = await import("./mdBaglami.ts");
  for (const ad of ["persona.md", "anlik-hafiza.md", "Ozyn hakkında.md", "çalışma.md", "not_1.md", "", "x.txt", "../x.md", "a/b.md", "a\\b.md", ".gizli.md", "x..md", `${"a".repeat(70)}.md`, "persona", 5, null]) {
    assert.equal(burada(ad), host(ad), `ayrışma: ${JSON.stringify(ad)}`);
  }
});

test("yalnız başlıklardan oluşan dosya (dokunulmamış şablon) 'boş' sayılır ve bağlama girmez; içerik eklenince girer", () => {
  const sablon = "# Persona\n\n## Üslup\n\n## Ozyn hakkında\n";
  const b = mdBaglaminiKur([g("persona.md", sablon)]);
  assert.deepEqual(b.atlanan, [{ ad: "persona.md", neden: "boş" }]);
  assert.equal(b.metin, "");
  assert.match(mdBaglaminiKur([g("persona.md", `${sablon}- kısa konuş`)]).metin, /kısa konuş/);
});
