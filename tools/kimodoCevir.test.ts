// tools/kimodoCevir.test.ts — KİMODO ÇEVİRİCİSİ, saf kısım (spec 37 §7): ayrıştırma, matematik, sadeleştirme, döngü, tavanlar, zincir tablosu, doğrulayıcı.
// Gerçek gövdede ölçüm (konum korelasyonu, yön) ayrı dosyada: tools/kimodo/govde.test.ts.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UZUVLAR } from "../protocol/animasyon.ts";
import { sekansDogrula } from "../protocol/sekans.ts";
import { bvhAyristir, eklemDizini, ileriKinematik } from "./kimodo/bvh.ts";
import { aciFarki, carp, devrik, eulerdenMatris, matristenEuler, Rx, Rz, uygula, uzunluk, birimle, nokta, type M3, type V3 } from "./kimodo/matris.ts";
import { donguBul, donguyuKapat, eulerDizisi, rdp } from "./kimodo/sadelestir.ts";
import { kimodoCevir, sekansMetni, tablolariOku } from "./kimodoCevir.ts";
import { BVH_KLASORU, KLIP_AYARLARI } from "./kimodo/hepsi.ts";
import { bvhCevir } from "./kimodo/cevir.ts";
import { butunEklemler, KONTROL_NOKTALARI, RETARGET_KOKU, ZINCIRLER } from "../world/avatar/zincirler.ts";
import { UZUV_ESLEMESI } from "../world/avatar/uzuvEslemesi.ts";

const { Matrix } = await import("@babylonjs/core/Maths/math.vector.js");

const Z = { timeout: 60_000 };
const bvhMetni = (a: string) => readFileSync(join(BVH_KLASORU, `${a}.bvh`), "utf8");
const EL = bvhMetni("el_salla");
const B = bvhAyristir(EL);
const T = tablolariOku();
const NPZ = JSON.parse(readFileSync(new URL("./kimodo/test-verisi/el_salla_npz.json", import.meta.url), "utf8")) as {
  kareler: number[]; eklemler: Record<string, { konum: V3[]; kuresel: M3[] }>;
};
const derece = (r: number) => (r * 180) / Math.PI;

// ── BVH ayrıştırma ──
test("BVH başlığı: 78 düğüm (Root + 77 SOMA eklemi), Root → Hips → Spine1 zinciri", () => {
  assert.deepEqual([B.eklemler.length, B.eklemler[0]!.ad, B.eklemler[1]!.ad, B.eklemler[1]!.ebeveyn, B.eklemler[2]!.ad, B.eklemler[2]!.ebeveyn], [78, "Root", "Hips", 0, "Spine1", 1]);
});

test("BVH kanal sırası: Hips 6 kanal (konum, sonra Z Y X dönme), Spine1 3 kanal (Z Y X)", () => {
  assert.deepEqual([B.eklemler[1]!.kanallar, B.eklemler[2]!.kanallar],
    [["Xposition", "Yposition", "Zposition", "Zrotation", "Yrotation", "Xrotation"], ["Zrotation", "Yrotation", "Xrotation"]]);
});

test("BVH hareket bölümü: 90 kare, 1/30 sn, kare başına 2×6 + 76×3 = 240 sayı", () => {
  assert.deepEqual([B.kareSayisi, Number(B.kareSuresi.toFixed(6)), B.kareler[0]!.length], [90, 0.033333, 240]);
});

test("bozuk BVH (CHANNELS sayısı tutmuyor) satır numarasıyla reddedilir", () => {
  const bozuk = EL.replace("CHANNELS 3 Zrotation Yrotation Xrotation", "CHANNELS 2 Zrotation Yrotation Xrotation");
  assert.throws(() => bvhAyristir(bozuk), /BVH satır 13: CHANNELS 2 kanal bildiriyor/);
});

// ── İleri kinematik ve T-poz tablosu: Kimodo'nun kendi NPZ çıktısıyla çapraz doğrulama ──
test("ileri kinematik = Kimodo NPZ posed_joints (14 eklem × 3 kare, en büyük fark < 1 mm)", () => {
  let enBuyuk = 0;
  for (const [i, k] of NPZ.kareler.entries()) {
    const p = ileriKinematik(B, k);
    for (const [a, v] of Object.entries(NPZ.eklemler)) {
      const q = p.konum[eklemDizini(B, a)]!.map((x) => x / 100) as V3;
      enBuyuk = Math.max(enBuyuk, uzunluk([q[0] - v.konum[i]![0], q[1] - v.konum[i]![1], q[2] - v.konum[i]![2]]));
    }
  }
  assert.ok(enBuyuk < 0.001, `en büyük fark ${(enBuyuk * 1000).toFixed(3)} mm`);
});

test("T-pozdan fark Δ = G·Oᵀ = Kimodo NPZ standart küresel dönme (en büyük fark < 0,1°)", () => {
  let enBuyuk = 0;
  for (const [i, k] of NPZ.kareler.entries()) {
    const p = ileriKinematik(B, k);
    for (const [a, v] of Object.entries(NPZ.eklemler)) enBuyuk = Math.max(enBuyuk, derece(aciFarki(carp(p.donme[eklemDizini(B, a)]!, devrik(T.tpoz.eklemler[a]!.ofset)), v.kuresel[i]!)));
  }
  assert.ok(enBuyuk < 0.1, `${enBuyuk.toFixed(4)}°`);
});

test("T-poz tablosu BVH başlığıyla tutarlı: ofset · OFFSET(çocuk) = T-poz kemik vektörü (eşlenen 18 eklem, açı < 1°)", () => {
  const kotu: string[] = [];
  for (const e of butunEklemler()) {
    const c = B.eklemler.find((x) => x.ad === e.yon.soma)!;
    if (B.eklemler[c.ebeveyn]!.ad !== e.kaynak.soma) continue;   // yön noktası doğrudan çocuk değilse (boyun → baş) atla
    const v = uygula(T.tpoz.eklemler[e.kaynak.soma]!.ofset, c.ofset);
    const t = T.tpoz.eklemler[e.yon.soma]!.konum, s = T.tpoz.eklemler[e.kaynak.soma]!.konum;
    const aci = derece(Math.acos(Math.min(1, nokta(birimle(v), birimle([t[0] - s[0], t[1] - s[1], t[2] - s[2]])))));
    if (aci > 1) kotu.push(`${e.kaynak.soma} ${aci.toFixed(2)}°`);
  }
  assert.deepEqual(kotu, []);
});

// ── Euler (sürücünün sırası) ──
test("Euler sırası: eulerdenMatris(x, y, z) = Babylon RotationYawPitchRoll(y, x, z)'nin devriği (sürücünün uyguladığı)", () => {
  let enBuyuk = 0;
  for (const [x, y, z] of [[10, 20, 30], [-70, 140, -25], [85, -100, 170], [0, 0, 90], [45, 0, 0]] as const) {
    const m = Matrix.RotationYawPitchRoll(y * Math.PI / 180, x * Math.PI / 180, z * Math.PI / 180).m;
    const babylon = devrik([m[0]!, m[1]!, m[2]!, m[4]!, m[5]!, m[6]!, m[8]!, m[9]!, m[10]!]);
    enBuyuk = Math.max(enBuyuk, ...eulerdenMatris(x, y, z).map((v, i) => Math.abs(v - babylon[i]!)));
  }
  assert.ok(enBuyuk < 1e-6, `fark ${enBuyuk}`);   // Babylon Float32Array tutar
});

test("Euler gidiş-dönüş: matristenEuler → eulerdenMatris aynı dönmeyi verir (gimbal yakını dahil)", () => {
  let enBuyuk = 0;
  for (const [x, y, z] of [[10, 20, 30], [-70, 140, -25], [89.5, 30, 10], [-90, 50, 20], [0, 179, -179]] as const) {
    const e = matristenEuler(eulerdenMatris(x, y, z), { x, y, z });
    enBuyuk = Math.max(enBuyuk, derece(aciFarki(eulerdenMatris(e.x, e.y, e.z), eulerdenMatris(x, y, z))));
  }
  assert.ok(enBuyuk < 0.01, `${enBuyuk}°`);   // 89,5° gimbal eşiğinin içinde: y tutulur, hata ölçüldü 0,001°
});

test("açı sürekliliği: X ekseninde 0 → 130° dönme, ±90'ı geçerken ikinci çözüme geçer, x tekdüze artar (y, z 0'da kalır)", () => {
  const d = eulerDizisi(Array.from({ length: 27 }, (_, i) => Rx((i * 5 * Math.PI) / 180)));
  assert.deepEqual([d.x.map((v) => Math.round(v)), Math.max(...d.y.map(Math.abs), ...d.z.map(Math.abs)) < 1e-6], [Array.from({ length: 27 }, (_, i) => i * 5), true]);
});

test("±180 sarma: Z'de 170 → 190° sürekli dönme biçimin ±180 tavanında sarılır ve SAYILIR", () => {
  const d = eulerDizisi([170, 175, 180, 185, 190].map((a) => Rz((a * Math.PI) / 180)));
  assert.deepEqual([d.z.map((v) => Math.round(v)), d.sarma], [[170, 175, 180, -175, -170], 2]);
});

test("gimbal kilidi: x = 90°'de y önceki kareden tutulur, dönme yine aynı", () => {
  const e = matristenEuler(eulerdenMatris(90, 40, 10), { x: 88, y: 40, z: 10 });
  assert.deepEqual([e.gimbal, Math.round(e.y), derece(aciFarki(eulerdenMatris(e.x, e.y, e.z), eulerdenMatris(90, 40, 10))) < 1e-4], [true, 40, true]);
});

// ── Sadeleştirme ──
test("RDP: korunan anahtarlar arası doğrusal ara değer her karede toleransın içinde (sinüs, 1,5°)", () => {
  const v = Array.from({ length: 120 }, (_, i) => 40 * Math.sin(i / 9));
  const k = rdp(v, 1.5);
  let enBuyuk = 0;
  for (let j = 0; j + 1 < k.length; j++) for (let i = k[j]!; i <= k[j + 1]!; i++) {
    const t = v[k[j]!]! + ((v[k[j + 1]!]! - v[k[j]!]!) * (i - k[j]!)) / (k[j + 1]! - k[j]!);
    enBuyuk = Math.max(enBuyuk, Math.abs(t - v[i]!));
  }
  assert.deepEqual([enBuyuk <= 1.5, k[0], k[k.length - 1], k.length < 40], [true, 0, 119, true]);
});

test("anahtar tavanı aşılırsa tolerans o izde kendiliğinden artar ve raporlanır (tavan 12)", Z, () => {
  const { sekans, rapor } = kimodoCevir(EL, { ad: "t", anahtarTavani: 12 }, T);
  const enCok = Math.max(...sekans.izler.map((i) => (i.tur === "uzuv" ? i.anahtarlar.length : 0)));
  assert.deepEqual([enCok <= 12, rapor.toleransArtan.length > 0, rapor.uyarilar.some((u) => u.includes("anahtar tavanı 12"))], [true, true, true]);
});

test("iz tavanı aşılırsa EN KÜÇÜK izler atılır ve raporlanır (tavan 20)", Z, () => {
  const { sekans, rapor } = kimodoCevir(EL, { ad: "t", izTavani: 20 }, T);
  const enKucukKalan = Math.min(...sekans.izler.map((i) => (i.tur === "uzuv" ? Math.max(...i.anahtarlar.map((a) => Math.abs(a.deger))) : 0)));
  assert.deepEqual([sekans.izler.length, rapor.tavandanAtilan.every((a) => a.enBuyuk <= enKucukKalan + 0.01)], [20, true]);
});

// ── Döngü ──
test("döngü bulma: 25 karelik periyodik yolda seçilen parça periyodun katı ve benzerlik ≈ 0", () => {
  const yol = (f: number) => Array.from({ length: 100 }, (_, i) => [Math.sin((2 * Math.PI * i) / 25 + f), Math.cos((2 * Math.PI * i) / 25), 0] as V3);
  const d = donguBul([yol(0), yol(1)], 30, 20)!;
  assert.deepEqual([(d.bit - d.bas) % 25, d.benzerlik < 1e-6], [0, true]);
});

test("döngü bulma en kısa boydan kısa parça seçmez (yalnız komşu kareler benzese bile)", () => {
  const yol = Array.from({ length: 60 }, (_, i) => [i * 0.01, 0, 0] as V3);
  const d = donguBul([yol], 30, 20)!;
  assert.ok(d.bit - d.bas >= 20, `${d.bas}–${d.bit}`);
});

test("döngü kapanışı: kapatılmış dönme dizisinin son karesi ilk karesine eşit (fark yayıldı)", () => {
  const l = Array.from({ length: 40 }, (_, i) => Rz((i * 2 * Math.PI) / 180));
  const k = donguyuKapat(l, 5, 30);
  assert.deepEqual([k.length, derece(aciFarki(k[0]!, k[k.length - 1]!)) < 1e-9], [26, true]);
});

test("--dongu: yürüme sekansında her izin ilk ve son anahtarı aynı değer (döngü sınırında sıçrama yok)", Z, () => {
  const { sekans, rapor } = kimodoCevir(bvhMetni("yuru"), { ad: "t", dongu: true }, T);
  const sicrayan = sekans.izler.filter((i) => i.tur === "uzuv" && Math.abs(i.anahtarlar[0]!.deger - i.anahtarlar[i.anahtarlar.length - 1]!.deger) > 0.011).map((i) => i.id);
  assert.deepEqual([sicrayan, rapor.dongu !== null, sekans.aciklama?.includes("döngülü")], [[], true, true]);
});

// ── Kök ──
test("--yerinde (varsayılan): yatay kök izi yazılmaz; --yatay: otur'da kok.oteleme_z var ve ±0,5 m içinde", Z, () => {
  const yerinde = kimodoCevir(bvhMetni("otur"), { ad: "t" }, T).sekans;
  const yatay = kimodoCevir(bvhMetni("otur"), { ad: "t", yerinde: false }, T).sekans;
  const z = yatay.izler.find((i) => i.tur === "uzuv" && i.uzuv === "kok" && i.kanal === "oteleme_z");
  assert.deepEqual([yerinde.izler.some((i) => i.tur === "uzuv" && i.uzuv === "kok" && i.kanal !== "oteleme_y"), z !== undefined && z.tur === "uzuv" && z.anahtarlar.every((a) => Math.abs(a.deger) <= 0.5)], [false, true]);
});

test("yerinde ham çeviri: yürümede kök ötelemesinin yatayı her karede 0, kaynak kalçası yatayda yerinde (yürüme motoru taşır)", Z, () => {
  const h = bvhCevir(bvhMetni("yuru"), T.tpoz, T.orion, { yerinde: true });
  const kalca = h.kaynakKonumu("Hips");
  assert.deepEqual([Math.max(...h.kok.x.map(Math.abs), ...h.kok.z.map(Math.abs)), Math.max(...kalca.map((p) => Math.hypot(p[0], p[2])))], [0, 0]);
});

test("yön bağımsızlığı: bütün hareket dikey eksende 40° döndürülse de sekans aynı (ilk karenin yönü +Z'ye çevrilir)", Z, () => {
  const satirlar = EL.split(/\r?\n/);
  const m = satirlar.findIndex((s) => s.startsWith("Frame Time"));
  const donuk = satirlar.map((s, i) => { if (i <= m || !s.trim()) return s; const v = s.trim().split(/\s+/); v[4] = String(Number(v[4]) + 40); return v.join(" "); }).join("\n");
  const a = kimodoCevir(EL, { ad: "t" }, T).sekans, b = kimodoCevir(donuk, { ad: "t" }, T).sekans;
  const fark = (x: typeof a, y: typeof a) => Math.max(...x.izler.map((iz, i) => (iz.tur === "uzuv" && y.izler[i]!.tur === "uzuv" ? Math.max(...iz.anahtarlar.map((k, j) => Math.abs(k.deger - ((y.izler[i] as typeof iz).anahtarlar[j]?.deger ?? 999)))) : 0)));
  assert.ok(a.izler.length === b.izler.length && fark(a, b) < 0.05, `iz ${a.izler.length}/${b.izler.length}, fark ${fark(a, b)}`);
});

// ── Zincir tablosu (eşleme) ──
test("zincirler: her eklemin uzvu UZUVLAR'da, ve kok dışındaki her uzuv TAM BİR KEZ (çakışma yok, eksik yok)", () => {
  const l = butunEklemler().map((e) => e.uzuv);
  assert.deepEqual([...l].sort(), UZUVLAR.filter((u) => u !== "kok").sort());
});

test("zincirler: her zincirde en az bir eklem; uç etkileyici son eklemin uzvu; bağlantı zincirden önce tanımlı", () => {
  const onceki = new Set<string>([RETARGET_KOKU.uzuv]);
  const kotu: string[] = [];
  for (const z of ZINCIRLER) {
    if (!z.eklemler.length || z.uc !== z.eklemler[z.eklemler.length - 1]!.uzuv || !onceki.has(z.baglanti)) kotu.push(z.ad);
    for (const e of z.eklemler) onceki.add(e.uzuv);
  }
  assert.deepEqual(kotu, []);
});

test("zincirler: SOMA eklemleri ve yön noktaları BVH başlığında var", () => {
  const adlar = new Set(B.eklemler.map((e) => e.ad));
  assert.deepEqual(butunEklemler().flatMap((e) => [e.kaynak.soma, e.yon.soma]).filter((a) => !adlar.has(a)), []);
});

test("zincirler: sağ/sol simetri — sol zincir sağınkinin ad aynası, kutup aynı", () => {
  const ayna = (s: string) => s.replace(/^sag_/, "sol_").replace(/^right/, "left").replace(/^Right/, "Left").replace(/omuzL/, "omuzR").replace(/bacakL/, "bacakR");
  const kotu: string[] = [];
  for (const t of ["kol", "bacak"]) {
    const sag = ZINCIRLER.find((z) => z.ad === `sag_${t}`)!, sol = ZINCIRLER.find((z) => z.ad === `sol_${t}`)!;
    const beklenen = JSON.stringify(sag.eklemler.map((e) => [ayna(e.uzuv), ayna(e.kemik.vrm), e.kemik.prosedurel ? ayna(e.kemik.prosedurel) : null, ayna(e.kaynak.soma), e.yon.vrm ? ayna(e.yon.vrm) : null, ayna(e.yon.soma)]));
    const gelen = JSON.stringify(sol.eklemler.map((e) => [e.uzuv, e.kemik.vrm, e.kemik.prosedurel ?? null, e.kaynak.soma, e.yon.vrm, e.yon.soma]));
    if (beklenen !== gelen || JSON.stringify(sag.ik?.kutup) !== JSON.stringify(sol.ik?.kutup)) kotu.push(t);
  }
  assert.deepEqual(kotu, []);
});

test("zincirler: kol ve bacak iki kemikli IK bilgisi taşır (dirsek geri −Z, diz ileri +Z); kontrol noktaları el×2, ayak×2, pelvis, baş", () => {
  const ik = ZINCIRLER.filter((z) => z.ik).map((z) => `${z.ad}:${z.ik!.kutup.z}`);
  assert.deepEqual([ik, KONTROL_NOKTALARI.map((k) => k.uzuv)], [["sag_kol:-1", "sol_kol:-1", "sag_bacak:1", "sol_bacak:1"], ["kalca", "bas", "sag_el", "sol_el", "sag_ayak", "sol_ayak"]]);
});

test("uzuv eşlemesi zincirlerden türer: prosedürel tablo eski hâliyle AYNI (yeni uzuvlar prosedürelde yok)", () => {
  assert.deepEqual(UZUV_ESLEMESI.prosedurel, { kok: "@kok", govde: "kalca", bas: "boyun", sag_kol: "omuzL", sol_kol: "omuzR", sag_bacak: "bacakL", sol_bacak: "bacakR" });
});

// ── Üretilen dosyalar ──
test("assets/sekans/kimodo_*.json: hepsi doğrulayıcıdan geçer, liste.json'da, ve BVH'den yeniden çeviriyle AYNI (dosyalar güncel)", { timeout: 120_000 }, () => {
  const liste = JSON.parse(readFileSync(new URL("../assets/sekans/liste.json", import.meta.url), "utf8")) as string[];
  const kotu: string[] = [];
  for (const [a, ayar] of Object.entries(KLIP_AYARLARI)) {
    const ad = `kimodo_${a}`;
    const metin = readFileSync(new URL(`../assets/sekans/${ad}.json`, import.meta.url), "utf8");
    const r = sekansDogrula(JSON.parse(metin));
    if (!r.ok) { kotu.push(`${ad}: ${r.hata}`); continue; }
    if (!liste.includes(ad)) kotu.push(`${ad}: liste.json'da yok`);
    if (sekansMetni(kimodoCevir(bvhMetni(a), { ...ayar, ad }, T).sekans) !== metin.replace(/\r\n/g, "\n")) kotu.push(`${ad}: eski (npm run kimodo:hepsi)`);
  }
  assert.deepEqual(kotu, []);
});
