// uygulama/aktor/demolar.test.ts — spec 45 B9: dört demo (lamba, kutu, kılıç, araba) VERİ olarak doğru mu, GERÇEK çalışma zamanında çalışıyor mu.
//
// Üç kat: (1) şablon + level doğrulaması, (2) kimlik eşlemesi, (3) uçtan uca: gerçek level (NullEngine) + gerçek çalışma zamanı + gerçek aktör yeteneği + gerçek ⚡ dinleyici.
// Görüntü ve gerçek pencere canlı senaryoda (bpdene); burada davranış SAYIYLA ölçülür.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { levelKur, type Level } from "../../world/level/cekirdek/levelKur.ts";
import { ornekTanim } from "../../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi } from "../../world/level/cekirdek/levelTanimi.ts";
import { aktorOlayYoluKur } from "../../world/level/cekirdek/aktorOlayYolu.ts";
import { sablonHatasi } from "./aktorSablonu.ts";
import { sablonYerlestirMetinden } from "./sablonIslemleri.ts";
import { DEMOLAR, DEMO_ADLARI, kimlikEsle, type Demo, type Kimlikler } from "./demolar.ts";
import { aktorCalismaZamaniKur, type AktorCalismaZamani } from "./aktorCalismaZamani.ts";
import type { Gozlenen } from "./tetikModeli.ts";
import { aktorYetenegiKur } from "../aktorYetenegi.ts";
import { grafYetenegiKur } from "../graf/grafYetenegi.ts";
import { grafKutuphanesi } from "../graf/kutuphane.ts";
import { GrafDurumDeposu } from "../graf/grafDurumu.ts";
import { grafDinleyiciKur } from "../graf/grafDinleyici.ts";
import { aktorOlayKaynagiKur } from "../graf/aktorOlayKaynagi.ts";
import { olayYoluKur } from "../graf/grafDinleyici.ts";
import { grafTurDenetle } from "../graf/grafTurDenetimi.ts";
import { aktorHiyerarsisi } from "../../world/level/cekirdek/aktorOlayYolu.ts";
import { KITLER } from "../../world/level/cekirdek/nesneSistemi.ts";
import fs from "node:fs";

const ZAMAN = { timeout: 8000 };

function yerlestir(d: Demo, taban: LevelTanimi = ornekTanim()): { tanim: LevelTanimi; kimlikler: Kimlikler; kok: string } {
  taban.katmanlar = [];
  const once = { nesneler: [...(taban.nesneler ?? [])], isiklar: [...(taban.isiklar ?? [])] };
  const r = sablonYerlestirMetinden(taban, JSON.stringify(d.sablon), [0, 0, 0]);
  assert.ok(r.ok, r.ok ? "" : r.neden);
  const tanim = r.deger.tanim;
  return { tanim, kimlikler: kimlikEsle(d.sablon, once, { nesneler: tanim.nesneler ?? [], isiklar: tanim.isiklar ?? [] }), kok: r.deger.kok };
}

// ── (1) veri doğrulaması ──
test("her demo şablonu şablon doğrulamasından VE level doğrulamasından geçer; grafları geçerli", () => {
  for (const ad of DEMO_ADLARI) {
    const d = DEMOLAR[ad];
    assert.equal(sablonHatasi(d.sablon), null, `${ad}: şablon`);
    const y = yerlestir(d);
    for (const g of d.graflar(y.kimlikler)) {
      assert.equal(g.tur, "olay");
      const tur = grafTurDenetle(g, grafKutuphanesi(), { desen: () => null, buGraf: null });
      assert.deepEqual(tur, [], `${ad}/${g.ad}: tür denetimi: ${JSON.stringify(tur)}`);
    }
  }
});

test("demo nesnelerinin `varlik` adı level KİTLERİNİN kataloğunda var (canlıda 'katalogda yok' ile yüklenmeyen demo olmasın)", () => {
  const katalog = new Set<string>();
  for (const kit of KITLER) {
    const j = JSON.parse(fs.readFileSync(`assets/${kit}/katalog.json`, "utf8")) as { varliklar: { ad: string }[] };
    for (const v of j.varliklar) katalog.add(v.ad);
  }
  for (const ad of DEMO_ADLARI) for (const a of DEMOLAR[ad].sablon.aktorler) if (a.nesne) assert.ok(katalog.has(a.nesne.varlik), `${ad}: '${a.nesne.varlik}' kataloglarda yok`);
});

test("demo ve graf adları benzersiz, dosya adı kuralına uyar", () => {
  const adlar = DEMO_ADLARI.flatMap((a) => [DEMOLAR[a].sablon.ad, ...DEMOLAR[a].graflar(Object.fromEntries(DEMOLAR[a].sablon.aktorler.map((x) => [x.id, x.id]))).map((g) => g.ad)]);
  assert.equal(new Set(adlar).size, adlar.length, "ad çakışması");
  for (const a of adlar) assert.match(a, /^[A-Za-z0-9_-]+$/, a);
});

test("demo anlatımı: her demonun açıklaması ve en az bir deneme tarifi var", () => {
  for (const ad of DEMO_ADLARI) { assert.ok(DEMOLAR[ad].aciklama.length > 10, ad); assert.ok(DEMOLAR[ad].nasilDenenir.length > 0, ad); }
});

// ── (2) kimlik eşlemesi ──
test("kimlik eşlemesi: DOLU level'a yerleştirince şablon kimlikleri yalnız YENİ aktörlere gider (lamba: nesne + ışık)", () => {
  const t = ornekTanim();
  t.nesneler = [{ id: "n7", varlik: "kutu", konum: [9, 0, 9], donus: 0, olcek: 1 }];
  t.isiklar = [{ id: "i4", tur: "nokta", konum: [0, 3, 0], renk: "#ffffff", siddet: 1, menzil: 5 }];
  const y = yerlestir(DEMOLAR.lamba, t);
  assert.notEqual(y.kimlikler["s1"], "n7", "eski nesneye eşlenmedi");
  assert.notEqual(y.kimlikler["s2"], "i4", "eski ışığa eşlenmedi");
  assert.equal(y.kimlikler["s1"], y.kok, "kök = s1");
  const nesne = y.tanim.nesneler!.find((n) => n.id === y.kimlikler["s1"])!;
  const isik = y.tanim.isiklar!.find((i) => i.id === y.kimlikler["s2"])!;
  assert.equal(nesne.varlik, "PROP_Streetlamp_Slum_MD");
  assert.equal(isik.ust, nesne.id, "ışığın üstü yeni nesne kimliği");
  assert.equal(y.tanim.nesneler!.length, 2);
  assert.equal(y.tanim.isiklar!.length, 2);
});

test("kimlik eşlemesi: eklenen aktör sayısı şablonla uyuşmazsa fırlatır; tek türde bile (yalnız nesne ya da yalnız ışık eksikse)", () => {
  const y = yerlestir(DEMOLAR.lamba);
  const tam = { nesneler: y.tanim.nesneler!, isiklar: y.tanim.isiklar! };
  assert.throws(() => kimlikEsle(DEMOLAR.lamba.sablon, tam, tam), /eşlemesi tutmadı/, "ikisi de eksik");
  assert.throws(() => kimlikEsle(DEMOLAR.lamba.sablon, { nesneler: tam.nesneler, isiklar: [] }, tam), /eşlemesi tutmadı/, "nesne eksik, ışık tam");
  assert.throws(() => kimlikEsle(DEMOLAR.lamba.sablon, { nesneler: [], isiklar: tam.isiklar }, tam), /eşlemesi tutmadı/, "ışık eksik, nesne tam");
});

test("graflar kimlik eşlenmeden kurulamaz: eksik eşleme açık hata", () => {
  assert.throws(() => DEMOLAR.araba.graflar({}), /eşlenmedi/);
});

// ── (3) uçtan uca ──
interface Dunya { level: Level; z: AktorCalismaZamani; gozlenen: Gozlenen[]; dinleyici: ReturnType<typeof grafDinleyiciKur>; kim: Kimlikler; yol: ReturnType<typeof aktorOlayYoluKur> }
function dunya(d: Demo, bedenSoketi?: (beden: string, soket: string) => Matrix | null): Dunya {
  const y = yerlestir(d);
  const sahne = new Scene(new NullEngine());
  const level = levelKur(sahne, y.tanim, new Map());
  const gozlenen: Gozlenen[] = [{ id: "ozyn", tur: "ozyn", konum: { x: 50, y: 0, z: 50 } }];
  let z: AktorCalismaZamani | null = null;
  const yol = aktorOlayYoluKur({ ustu: (id) => z?.hiyerarsi().ustu(id), altlari: (id) => z?.hiyerarsi().altlari(id) ?? [], hata: () => {} });
  z = aktorCalismaZamaniKur({ level: () => level, olay: yol, gozlenenler: () => gozlenen, ...(bedenSoketi ? { bedenSoketi } : {}) });
  const kurulu = aktorYetenegiKur({ level: () => level, olay: yol, zaman: z });
  const hiy = aktorHiyerarsisi([...(y.tanim.nesneler ?? []), ...(y.tanim.isiklar ?? [])]);
  const yetenek = grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => [], capalar: () => [], aktor: { ...kurulu.yetenek, ustBul: (id) => hiy.ustu(id) ?? null, altlar: (id) => hiy.altlari(id) } });
  const ajanYolu = olayYoluKur();
  const kaynak = aktorOlayKaynagiKur({ ajan: ajanYolu, olay: yol, aktorVar: (id) => kurulu.yetenek.var(id) });
  const graflar = d.graflar(y.kimlikler);
  const taban = {
    kayit: grafKutuphanesi(), yetenek, durum: new GrafDurumDeposu(),
    uyu: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    depo: { al: (ad: string) => graflar.find((g) => g.ad === ad) ?? null, desen: () => null },
    ajanlar: () => [] as string[], saat: () => 10,
  };
  const dinleyici = grafDinleyiciKur({ ...taban, kaynak, disMesgul: () => false, sogumaMs: 0 });
  for (const g of graflar) assert.deepEqual(dinleyici.dinlemeyeAl(g.ad), { ok: true }, `${g.ad} dinlemeye alınamadı`);
  return { level, z, gozlenen, dinleyici, kim: y.kimlikler, yol };
}
const yakin = (dn: Dunya, x: number, zz: number): void => { dn.gozlenen[0] = { id: "ozyn", tur: "ozyn", konum: { x, y: 0, z: zz } }; };
const kareler = async (dn: Dunya, n: number, araMs = 5): Promise<void> => { for (let i = 0; i < n; i++) { dn.z.kare(0.05); await new Promise((r) => setTimeout(r, araMs)); } };
const bekleKosul = async (dn: Dunya, f: () => boolean, ms = 3000): Promise<void> => { const bas = Date.now(); while (!f() && Date.now() - bas < ms) await kareler(dn, 1, 10); assert.ok(f(), "koşul zamanında gerçekleşmedi"); };
const konum = (dn: Dunya, id: string): [number, number, number] => { const n = dn.level.nesneler.dugum(id)!; n.computeWorldMatrix(true); const p = n.getAbsolutePosition(); return [p.x, p.y, p.z]; };

test("lamba: Ozyn alana girince ışık yanar (2.5), çıkınca söner (0); graf dinleyicisi iki kez tetiklenir", ZAMAN, async () => {
  const dn = dunya(DEMOLAR.lamba);
  const isik = dn.level.isiklar.isik(dn.kim["s2"]!)!;
  assert.equal(isik.intensity, 0, "başta sönük");
  await kareler(dn, 3);
  yakin(dn, 0.5, 0);
  await bekleKosul(dn, () => isik.intensity === 2.5);
  yakin(dn, 50, 50);
  await bekleKosul(dn, () => isik.intensity === 0);
  assert.deepEqual(dn.dinleyici.liste().map((s) => s.tetik).sort(), [1, 1]);
});

test("lamba: uzaktayken ışık hiç yanmaz (yanlış alarm yok)", ZAMAN, async () => {
  const dn = dunya(DEMOLAR.lamba);
  await kareler(dn, 10);
  assert.equal(dn.level.isiklar.isik(dn.kim["s2"]!)!.intensity, 0);
  assert.deepEqual(dn.dinleyici.liste().map((s) => s.tetik), [0, 0]);
});

test("kutu: Ozyn yaklaşınca ileri kayar, 0,6 sn sonra durur; durduktan sonra yer değiştirmez", ZAMAN, async () => {
  const dn = dunya(DEMOLAR.kutu);
  const id = dn.kim["s1"]!;
  await kareler(dn, 3);
  const bas = konum(dn, id);
  yakin(dn, 0.5, 0);
  await bekleKosul(dn, () => Math.hypot(...konum(dn, id).map((v, i) => v - bas[i]!) as [number, number, number]) > 0.2);
  await bekleKosul(dn, () => dn.z.hataAyiklama().hareketliler.every((h) => h.komut.hiz === 0));
  await kareler(dn, 30);
  const dur1 = konum(dn, id);
  await kareler(dn, 20);
  const dur2 = konum(dn, id);
  assert.ok(Math.hypot(dur2[0] - dur1[0], dur2[2] - dur1[2]) < 1e-6, "durdu");
  assert.ok(Math.hypot(dur1[0] - bas[0], dur1[2] - bas[2]) > 0.2, "bir miktar gitti");
});

test("kutu: 'incele' olayı dinleyen graf 'incelendi' olayını altlara yayınlar (kutuda alt yoksa sessiz ama hatasız)", ZAMAN, async () => {
  const dn = dunya(DEMOLAR.kutu);
  const gelen: string[] = [];
  dn.yol.dinle("*", "incelendi", (o) => gelen.push(o.aktor));
  dn.yol.yayinla(dn.kim["s1"]!, "incele", {});
  await new Promise((r) => setTimeout(r, 30));
  const satir = dn.dinleyici.liste().find((s) => s.graf === "demo_kutu_incele")!;
  assert.equal(satir.tetik, 1, "graf tetiklendi");
  assert.deepEqual(gelen, [], "alt yok: kimseye ulaşmaz");
});

test("araba: yaklaşınca 4 m/s komut verilir, uzaklaşınca 0; konum gerçekten ilerler ve durunca sabitlenir", ZAMAN, async () => {
  const dn = dunya(DEMOLAR.araba);
  const id = dn.kim["s1"]!;
  const bas = konum(dn, id);
  yakin(dn, 0.5, 0);
  await bekleKosul(dn, () => dn.z.hataAyiklama().hareketliler.some((h) => h.komut.hiz === 4));
  await kareler(dn, 40);
  const gidilen = Math.hypot(konum(dn, id)[0] - bas[0], konum(dn, id)[2] - bas[2]);
  assert.ok(gidilen > 0.5, `araba ilerlemedi (${gidilen.toFixed(3)} m)`);
  yakin(dn, 50, 50);
  await bekleKosul(dn, () => dn.z.hataAyiklama().hareketliler.every((h) => h.komut.hiz === 0));
  await kareler(dn, 40);
  const a = konum(dn, id);
  await kareler(dn, 20);
  const b = konum(dn, id);
  assert.ok(Math.hypot(b[0] - a[0], b[2] - a[2]) < 1e-3, "durdu");
});

test("araba: sürücü soketi şablondan geldi (ad 'surucu', ayar konum)", () => {
  const y = yerlestir(DEMOLAR.araba);
  const n = y.tanim.nesneler!.find((x) => x.id === y.kimlikler["s1"])!;
  const s = n.bilesenler!.find((b) => b.tur === "soket")!;
  assert.equal((s.ayar as Record<string, unknown>)["ad"], "surucu");
});

test("kılıç: beden yokken ele takmak AKT-BAG-008 ile nedenli reddedilir, bağ kurulmaz", ZAMAN, () => {
  const dn = dunya(DEMOLAR.kilic);
  const id = dn.kim["s1"]!;
  assert.throws(() => dn.z.soketeTak(id, "beden:orion", "el_sag"), /AKT-BAG-008/);
  assert.equal(dn.z.bag(id), null);
});

test("kılıç: sap ve uç soketi var; ele takılınca el hareket ettikçe kılıç elin konumunu izler", ZAMAN, async () => {
  const el = { x: 1, y: 2, z: 3 };
  const dn = dunya(DEMOLAR.kilic, (b, s) => (b === "orion" && s === "el_sag" ? Matrix.Translation(el.x, el.y, el.z) : null));
  const id = dn.kim["s1"]!;
  const n = dn.level.tanim().nesneler!.find((x) => x.id === id)!;
  assert.deepEqual(n.bilesenler!.filter((b) => b.tur === "soket").map((b) => (b.ayar as Record<string, unknown>)["ad"]), ["sap", "uc"]);
  dn.z.soketeTak(id, "beden:orion", "el_sag");
  await kareler(dn, 3);
  assert.deepEqual(dn.z.bag(id), { ust: "beden:orion", soket: "el_sag" });
  const k1 = konum(dn, id);
  assert.ok(Math.hypot(k1[0] - 1, k1[1] - 2, k1[2] - 3) < 1e-3, `kılıç ele gelmedi: ${k1.join(",")}`);
  el.x = 5; el.y = 0; el.z = -2;
  await kareler(dn, 3);
  const k2 = konum(dn, id);
  assert.ok(Math.hypot(k2[0] - 5, k2[1] - 0, k2[2] + 2) < 1e-3, `el taşındı, kılıç izlemedi: ${k2.join(",")}`);
  dn.z.sokettanAl(id);
  el.x = 99;
  await kareler(dn, 3);
  assert.ok(konum(dn, id)[0] < 90, "çıkarılınca el izlenmez");
});
