// mind/beceriDefteri.test.ts — Beceri defteri (spec 10, Faz C): beceri hafızası canlıda
// kayıttan kurulur. Satırlar gerçek `KararKaydi`dan üretilir: okuyucu yazıcının
// biçimiyle kayarsa bu testler düşer.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { BeceriDefteri } from "./beceriDefteri.ts";
import { beceriHafizasiKur } from "./beceriHafizasi.ts";
import { gorevler } from "./gorev.ts";
import { KARAR_ONEKI, KararKaydi, niyetKaydi, type KararSatiri, type UyanisBilgisi } from "./kararKaydi.ts";
import { kayitOku, zincirKur } from "./kararZinciri.ts";
import type { Niyet } from "../protocol/niyet.ts";

const UYANIS: UyanisBilgisi = {
  algilar: [], geriBesleme: 0, beyin: "sahte", sureMs: 2000, koken: "dis", takip: false,
  anilar: 0, dunya: "oda", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0,
  konusulanMetin: false, yutulanSoz: 0,
};
const git = (ad: string): Niyet => ({ tur: "git", hedef: { tip: "capa", ad } });

/** Gerçek kayıt: satırları hem JSONL metni olarak hem dinleyiciden toplar. */
function kayit(oturum: string) {
  let t = 0;
  const metin: string[] = [];
  const k = new KararKaydi({ oturum, simdi: () => (t += 1000), yaz: (s) => metin.push(s.slice(KARAR_ONEKI.length + 1)) });
  k.oturumBasi("sahte");
  /** Bir söz, onun uyanışı (verilen niyetlerle) ve niyetlerin sonuçları. `durum` null: sonuç henüz gelmedi. */
  const gorev = (soz: string, niyetler: Niyet[], durum: "bitti" | "hata" | null = "bitti") => {
    const a = k.algi({ tur: "duydum", metin: soz, kesin: true }, "ozet", { gecti: true, kural: "kopru.konusma" });
    const kayitlar = niyetler.map((n, i) => niyetKaydi(`n_${t}_${i}`, n));
    k.uyanis({ ...UYANIS, algilar: [a], niyetler: kayitlar });
    if (durum) for (const n of kayitlar) k.algi({ tur: "sonuc", sonuc: { niyet_id: n.id, durum } }, "ozet", { gecti: false, kural: "refleks.sonuc.rutin" });
    return kayitlar;
  };
  return { k, gorev, satirlar: () => kayitOku(metin.join("\n")).satirlar };
}

test("boş defter karar vermez", () => {
  assert.equal(new BeceriDefteri().karar("pencereye git"), null);
});

test("geçmiş oturumun başarılı görevi açılışta beceri olur: yeni çapalı söz eşleşir", () => {
  const gecmis = kayit("o1");
  gecmis.gorev("pencereye git", [git("pencere")]);
  assert.deepEqual(new BeceriDefteri(gecmis.satirlar()).karar("sandalyeye git")?.adimlar, [git("sandalye")]);
});

test("bu oturumdan öğrenir: görev sonucu gelmeden beceri doğmaz, `bitti` gelince doğar", () => {
  const d = new BeceriDefteri();
  const { k, gorev } = kayit("o2");
  k.dinle((s) => d.ekle(s));
  const [n] = gorev("pencereye git", [git("pencere")], null);
  const once = d.karar("pencereye git");
  k.algi({ tur: "sonuc", sonuc: { niyet_id: n!.id, durum: "bitti" } }, "ozet", { gecti: false, kural: "refleks.sonuc.rutin" });
  assert.deepEqual({ once, sonra: d.karar("pencereye git")?.adimlar }, { once: null, sonra: [git("pencere")] });
});

test("geçmiş ve bu oturum birlikte: geçmişte doğan becerinin sayacı bu oturumun başarısıyla artar", () => {
  const gecmis = kayit("o1");
  gecmis.gorev("pencereye git", [git("pencere")]);
  const d = new BeceriDefteri(gecmis.satirlar());
  const simdi = kayit("o2");
  simdi.k.dinle((s) => d.ekle(s));
  simdi.gorev("sandalyeye git", [git("sandalye")]);
  assert.deepEqual(d.hafiza.beceriler.map((b) => b.sayac), [{ basari: 2, hata: 0 }]);
});

test("canlı = kayıt (B11): dinleyiciyle beslenen hafıza, aynı satırların JSONL'den kurulan hafızasına eşit", () => {
  const d = new BeceriDefteri();
  const { k, gorev, satirlar } = kayit("o1");
  k.dinle((s) => d.ekle(s));
  // Doğrulayıcı `mesafe: undefined` koyar: bellekteki nesne diske gidenden farklı olabilirdi.
  gorev("pencereye git", [{ tur: "git", hedef: { tip: "capa", ad: "pencere" }, mesafe: undefined }]);
  gorev("sandalyeye git", [git("sandalye")], "hata");
  gorev("masaya git otur", [git("masa"), { tur: "otur" }]);
  const kayittan = beceriHafizasiKur(gorevler(zincirKur(satirlar())));
  assert.equal(JSON.stringify(d.hafiza.beceriler), JSON.stringify(kayittan.beceriler));
});

test("görev satırı olmayan satırlar (terminal, olay, oturum) kararı değiştirmez", () => {
  const gecmis = kayit("o1");
  gecmis.gorev("pencereye git", [git("pencere")]);
  const d = new BeceriDefteri(gecmis.satirlar());
  const once = d.karar("sandalyeye git");
  const diger: KararSatiri[] = [
    { tur: "oturum", surum: 1, o: "o2", t: 1, beyin: "sahte" },
    { tur: "algi", o: "o2", id: "a1", t: 2, algi: "terminal", ozet: "x", kapi: { gecti: true, kural: "refleks.terminal.kod_hata" }, kod: 1 },
  ];
  for (const s of diger) d.ekle(s);
  assert.deepEqual(d.karar("sandalyeye git"), once);
});

test("gölgenin kayıttaki hali: pay üç haneye yuvarlanır (5 başarı, 1 hata → 0,833)", () => {
  const gecmis = kayit("o1");
  for (let i = 0; i < 5; i++) gecmis.gorev("pencereye git", [git("pencere")]);
  gecmis.gorev("pencereye git", [git("pencere")], "hata");
  assert.equal(new BeceriDefteri(gecmis.satirlar()).golge("pencereye git")?.pay, 0.833);
});
