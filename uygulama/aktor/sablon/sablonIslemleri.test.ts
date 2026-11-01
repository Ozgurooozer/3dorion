// uygulama/aktor/sablon/sablonIslemleri.test.ts — "Şablon olarak kaydet / yerleştir" iş mantığı (spec 45 B7). Saf; dosya erişimi sahte.
// Sorulan: kaydet doğru metni doğru adla host'a veriyor mu, host hatası kodlu söyleniyor mu; yerleştirme LEVEL DOĞRULAMASINDAN geçiyor mu (B6 defter R29'un koşulmayanı).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { sablonAdi, sablonAdlari, sablonKaydet, sablonYerlestirMetinden, type HostSonucu } from "./sablonIslemleri.ts";
import { sablonCikar, sablonHatasi, type AktorSablonu } from "./aktorSablonu.ts";
import { ornekTanim } from "../../../world/level/cekirdek/ornekTanim.ts";
import { kodOku } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { ISIK_TAVANI, levelTanimiDogrula, type LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";

const taban = (): LevelTanimi => {
  const t = ornekTanim(); t.katmanlar = [];
  t.nesneler = [
    { id: "n1", varlik: "araba.glb", ad: "Araba", konum: [10, 0, 5], donus: 90, olcek: 1, graf: "surus", bilesenler: [{ id: "b1", tur: "soket", ayar: { ad: "surucu" } }] },
    { id: "n2", varlik: "tekerlek.glb", konum: [1, 0, 0], donus: 0, olcek: 1, ust: "n1", soket: "surucu" },
    { id: "n9", varlik: "agac.glb", konum: [0, 0, 0], donus: 0, olcek: 1 },
  ];
  t.isiklar = [{ id: "i1", tur: "nokta", konum: [0, 2, 0], renk: "#ffffff", siddet: 1, menzil: 5, ust: "n1" }];
  return t;
};
const ok = (v: unknown): HostSonucu<string> => ({ ok: true, deger: String(v) });

test("sablonAdi/sablonAdlari: yalnız Content/Actors/<ad>.aktor.json; alt klasör, başka uzantı, başka klasör elenir; alfabetik", () => {
  assert.equal(sablonAdi("Content/Actors/kutu.aktor.json"), "kutu");
  for (const k of ["Content/Actors/kutu.json", "Content/Assets/kutu.aktor.json", "Content/Actors/alt/kutu.aktor.json", "Content/Actors/.aktor.json", "Engine/Actors/kutu.aktor.json", "kutu.aktor.json"]) assert.equal(sablonAdi(k), null, k);
  assert.deepEqual(sablonAdlari(["Content/Actors/zil.aktor.json", "Content/Levels/x.level.json", "Content/Actors/araba.aktor.json"]), ["araba", "zil"]);
});

test("kaydet: alt ağacı çıkarır, host'a (ad, JSON) verir; dönen adres sonuçtur; level DEĞİŞMEZ", async () => {
  const t = taban(), once = JSON.stringify(t);
  let alinan: { ad: string; metin: string } | null = null;
  const r = await sablonKaydet(t, "n1", "araba", async (ad, metin) => { alinan = { ad, metin }; return ok(`Content/Actors/${ad}.aktor.json`); });
  assert.deepEqual(r, { ok: true, deger: "Content/Actors/araba.aktor.json" });
  assert.equal(alinan!.ad, "araba");
  const s = JSON.parse(alinan!.metin) as AktorSablonu;
  assert.deepEqual(s.aktorler.map((a) => a.id), ["s1", "s2", "s3"], "araba + tekerlek + ışık; ağaç dışı n9 yok");
  assert.equal(JSON.stringify(t), once);
});

test("kaydet: geçersiz ad/olmayan kök host'a HİÇ gitmez (AKT-SBL-001/004)", async () => {
  let cagri = 0;
  const yaz = async (): Promise<HostSonucu<string>> => { cagri++; return ok("x"); };
  const a = await sablonKaydet(taban(), "n1", "kötü ad", yaz);
  assert.equal(a.ok, false); assert.equal(a.ok ? "" : kodOku(a.neden), "AKT-SBL-001");
  const b = await sablonKaydet(taban(), "yok", "araba", yaz);
  assert.equal(b.ok ? "" : kodOku(b.neden), "AKT-SBL-004");
  assert.equal(cagri, 0);
});

test("kaydet: host hatası (var) kodlu ve host kodunu söyler; çağrı patlarsa da fırlatmaz", async () => {
  const var_ = await sablonKaydet(taban(), "n1", "araba", async () => ({ ok: false, kod: "var", mesaj: "bu ad zaten var" }));
  assert.equal(var_.ok, false);
  assert.equal(var_.ok ? "" : kodOku(var_.neden), "AKT-SBL-007"); assert.match(var_.ok ? "" : var_.neden, /var: bu ad zaten var/);
  const pat = await sablonKaydet(taban(), "n1", "araba", async () => { throw new Error("ipc koptu"); });
  assert.equal(pat.ok ? "" : kodOku(pat.neden), "AKT-SBL-007"); assert.match(pat.ok ? "" : pat.neden, /ipc koptu/);
});

test("kaydet → yerleştir tam tur: yerleştirilen tanım level doğrulamasından GEÇER, yeni kimlikler çakışmaz, hiyerarşi yeniden kurulur", async () => {
  let metin = "";
  const k = await sablonKaydet(taban(), "n1", "araba", async (_a, m) => { metin = m; return ok("x"); });
  assert.ok(k.ok);
  const r = sablonYerlestirMetinden(taban(), metin, [50, 0, 60]);
  assert.ok(r.ok, r.ok ? "" : r.neden); if (!r.ok) return;
  const t = r.deger.tanim;
  assert.equal(levelTanimiDogrula(t).ok, true);
  const idler = [...(t.nesneler ?? []), ...(t.isiklar ?? [])].map((a) => a.id);
  assert.equal(new Set(idler).size, idler.length, "kimlik çakışması yok");
  assert.equal(t.nesneler!.length, 5); assert.equal(t.isiklar!.length, 2);
  const kok = t.nesneler!.find((n) => n.id === r.deger.kok)!;
  assert.deepEqual([kok.konum, kok.donus, kok.ad, kok.graf, "ust" in kok], [[50, 0, 60], 90, "Araba", "surus", false]);
  const cocuk = t.nesneler!.find((n) => n.ust === kok.id)!;
  assert.deepEqual([cocuk.varlik, cocuk.soket, cocuk.konum], ["tekerlek.glb", "surucu", [1, 0, 0]], "çocuk yeni kökün altında, yerel konumu aynen");
  assert.equal(t.isiklar!.find((i) => i.ust === kok.id) !== undefined, true);
});

test("yerleştir: kaynak tanım DEĞİŞMEZ; ışıksız şablon level'a boş `isiklar` anahtarı eklemez", () => {
  const t = taban(); delete t.isiklar;
  const s = sablonCikar("kutu", t, "n9"); assert.ok(s.ok); if (!s.ok) return;
  const once = JSON.stringify(t);
  const r = sablonYerlestirMetinden(t, JSON.stringify(s.deger), [0, 0, 0]);
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(JSON.stringify(t), once);
  assert.equal("isiklar" in r.deger.tanim, false);
  assert.equal(r.deger.tanim.nesneler!.length, 4);
});

test("yerleştir: JSON olmayan metin AKT-SBL-007, bozuk şablon AKT-SBL-001/002/003, ışık tavanı AKT-SBL-005 — hiçbiri tanımı bozmaz", () => {
  const t = taban();
  const a = sablonYerlestirMetinden(t, "{bozuk", [0, 0, 0]); assert.equal(a.ok ? "" : kodOku(a.neden), "AKT-SBL-007");
  const b = sablonYerlestirMetinden(t, JSON.stringify({ surum: 9 }), [0, 0, 0]); assert.equal(b.ok ? "" : kodOku(b.neden), "AKT-SBL-001");
  const dolu = taban(); dolu.isiklar = Array.from({ length: ISIK_TAVANI }, (_, i) => ({ id: `i${i + 1}`, tur: "nokta" as const, konum: [0, 2, 0] as [number, number, number], renk: "#ffffff", siddet: 1, menzil: 5 }));
  const s = sablonCikar("araba", taban(), "n1"); assert.ok(s.ok); if (!s.ok) return;
  const metin = JSON.stringify(s.deger);
  const c = sablonYerlestirMetinden(dolu, metin, [0, 0, 0]); assert.equal(c.ok ? "" : kodOku(c.neden), "AKT-SBL-005");
});

test("yerleştir: şablon biçimi geçerli (sablonHatasi) ama level kuralından geçmeyen alan AKT-SBL-002 ile reddedilir — şablon doğrulaması level doğrulamasından GEVŞEKTİR", () => {
  const s = sablonCikar("araba", taban(), "n1"); assert.ok(s.ok); if (!s.ok) return;
  const isik = s.deger.aktorler.find((a) => a.isik)!.isik!;
  isik.renk = "#fff";   // şablon yalnız "metin" ister; level 6 haneli hex ya da palet adı ister
  assert.equal(sablonHatasi(s.deger), null, "şablon doğrulaması bunu görmez (bilinen boşluk: level yakalar)");
  const t = taban(), once = JSON.stringify(t);
  const r = sablonYerlestirMetinden(t, JSON.stringify(s.deger), [0, 0, 0]);
  assert.equal(r.ok ? "" : kodOku(r.neden), "AKT-SBL-002"); assert.match(r.ok ? "" : r.neden, /renk/);
  assert.equal(JSON.stringify(t), once, "ret level'ı bozmadı");
});
