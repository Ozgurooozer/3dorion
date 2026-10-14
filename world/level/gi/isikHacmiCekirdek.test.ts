// world/level/gi/isikHacmiCekirdek.test.ts — Işık Hacmi saf çekirdeği (GI spike 1, ön kayıt K1): voxel indeksleme, atlas,
// voxelleme, ışık → voxel enjeksiyonu, koni izleme (CPU referansı), renkli sekme uçtan uca.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HACIM, ISIK_TURU, YONLER, atlasDuzeni, atlasTekseli, birikimKur, birikimiBitir, dogrudanIsik, enjekte, giOrnekle, hucreye,
  indeks, isikGecerliMi, isikPaketle, izgaraKur, koniIzle, koniSeti, meshVoxelle, mipKucult, mipZinciri, ornekle, statikAtlaslar,
  tekseldenVoxele, topla, ucgenVoxelle, voxelSayisi, vramTahmini, yakinlikMaskesi,
  type IsikVerisi, type Izgara, type UcgenMalzemesi, type Vec3, type VoxelBirikimi,
} from "./isikHacmiCekirdek.ts";

const BEYAZ: UcgenMalzemesi = { indeks: 1, albedo: [0.8, 0.8, 0.8], oncelik: 0 };
const KIRMIZI: UcgenMalzemesi = { indeks: 2, albedo: [0.8, 0.05, 0.05], oncelik: 0 };
const BIRIM: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Eksene hizalı dikdörtgen (iki üçgen), normal verilir. */
function dortgen(b: VoxelBirikimi, a: Vec3, u: Vec3, v: Vec3, n: Vec3, m: UcgenMalzemesi): void {
  const p1: Vec3 = [a[0] + u[0], a[1] + u[1], a[2] + u[2]];
  const p2: Vec3 = [a[0] + u[0] + v[0], a[1] + u[1] + v[1], a[2] + u[2] + v[2]];
  const p3: Vec3 = [a[0] + v[0], a[1] + v[1], a[2] + v[2]];
  ucgenVoxelle(b, a, p1, p2, n, m);
  ucgenVoxelle(b, a, p2, p3, n, m);
}

const nokta = (konum: Vec3, renk: Vec3, menzil: number): IsikVerisi =>
  ({ tur: ISIK_TURU.nokta, konum, yon: [0, -1, 0], renk, menzil, cosYari: 0, us: 1, zemin: [0, 0, 0] });

// ── ızgara ve atlas ──
test("izgaraKur: pay eklenir, boyut yukarı yuvarlanır", () => {
  const iz = izgaraKur([0, 0, 0], [1, 0.35, 2], 0.1, 0.3);
  assert.deepEqual(iz.n, [16, 10, 26]);
  assert.deepEqual(iz.koken.map((x) => +x.toFixed(6)), [-0.3, -0.3, -0.3]);
});

test("indeks: her voxele tek ve sınır içi doğrusal indeks", () => {
  const n: Vec3 = [5, 3, 4];
  const gorulen = new Set<number>();
  for (let j = 0; j < 3; j++) for (let k = 0; k < 4; k++) for (let i = 0; i < 5; i++) gorulen.add(indeks(n, i, j, k));
  assert.equal(gorulen.size, voxelSayisi(n));
  assert.equal(Math.min(...gorulen), 0);
  assert.equal(Math.max(...gorulen), voxelSayisi(n) - 1);
});

test("atlas: her voxelin tekseli tek, doku içinde ve geri çözülür (ofis boyu 110 × 40 × 92)", () => {
  const n: Vec3 = [110, 40, 92];
  const a = atlasDuzeni(n);
  assert.ok(a.sutun * a.satir >= n[1]);
  assert.ok(a.en <= 4096 && a.boy <= 4096, `${a.en}x${a.boy}`);
  const gorulen = new Set<number>();
  for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k += 7) for (let i = 0; i < n[0]; i += 5) {
    const [x, y] = atlasTekseli(a, n, i, j, k);
    assert.ok(x >= 0 && y >= 0 && x < a.en && y < a.boy);
    gorulen.add(y * a.en + x);
    assert.deepEqual(tekseldenVoxele(a, n, x, y), [i, j, k]);
  }
  assert.equal(gorulen.size, n[1] * Math.ceil(n[2] / 7) * Math.ceil(n[0] / 5));
});

test("atlas: kullanılmayan karonun tekseli voxele çözülmez", () => {
  const n: Vec3 = [4, 5, 4];
  const a = atlasDuzeni(n);
  if (a.sutun * a.satir === n[1]) return;   // boş karo yok
  const bos = n[1];                         // ilk kullanılmayan karo
  const x = (bos % a.sutun) * n[0], y = Math.floor(bos / a.sutun) * n[2];
  assert.equal(tekseldenVoxele(a, n, x, y), null);
});

test("hucreye: köken 0, bir voxel ileri 1", () => {
  const iz = izgaraKur([0, 0, 0], [1, 1, 1], 0.1, 0);
  assert.deepEqual(hucreye(iz, [0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(hucreye(iz, [0.1, 0.25, 0.05]).map((x) => +x.toFixed(6)), [1, 2.5, 0.5]);
});

// ── voxelleme ──
test("voxelleme: 0,96 m'lik yatay kare tek dilimde 10 × 10 voxel, normal +Y, albedo korunur", () => {
  const iz = izgaraKur([0, 0, 0], [1, 1, 1], 0.1, 0);
  const b = birikimKur(iz);
  dortgen(b, [0.02, 0.55, 0.02], [0.96, 0, 0], [0, 0, 0.96], [0, 1, 0], BEYAZ);
  const v = birikimiBitir(b);
  let dolu = 0;
  for (let x = 0; x < v.dolu.length; x++) {
    if (!v.dolu[x]) continue;
    dolu++;
    assert.equal(Math.floor(x / (iz.n[0] * iz.n[2])), 5, "dilim j = 5");
    assert.deepEqual([v.normal[3 * x], v.normal[3 * x + 1], v.normal[3 * x + 2]], [0, 1, 0]);
    assert.ok(Math.abs(v.albedo[3 * x]! - 0.8) < 1e-6);
  }
  assert.equal(dolu, 100);
});

test("voxelleme: dünya matrisi (öteleme) ve köşe normalleri uygulanır", () => {
  const iz = izgaraKur([0, 0, 0], [2, 1, 1], 0.1, 0);
  const b = birikimKur(iz);
  const konum = [0.02, 0.5, 0.02, 0.48, 0.5, 0.02, 0.02, 0.5, 0.48];
  const normaller = [0, -1, 0, 0, -1, 0, 0, -1, 0];
  const M = [...BIRIM]; M[12] = 1;   // x + 1 m
  assert.equal(meshVoxelle(b, konum, [0, 1, 2], M, BEYAZ, normaller), 1);
  const v = birikimiBitir(b);
  for (let x = 0; x < v.dolu.length; x++) {
    if (!v.dolu[x]) continue;
    assert.ok(x % iz.n[0] >= 10, "x ≥ 1 m");
    assert.equal(v.normal[3 * x + 1], -1);
  }
});

test("voxelleme: aynı voxelde ışıyan malzeme (yüksek öncelik) duvarı ezer, sıra fark etmez", () => {
  for (const sira of [0, 1]) {
    const iz = izgaraKur([0, 0, 0], [0.1, 0.1, 0.1], 0.1, 0);
    const b = birikimKur(iz);
    const neon: UcgenMalzemesi = { indeks: 7, albedo: [0.2, 0, 0.2], oncelik: 2 };
    const ilk = sira ? neon : BEYAZ, son = sira ? BEYAZ : neon;
    ucgenVoxelle(b, [0.01, 0.05, 0.01], [0.09, 0.05, 0.01], [0.01, 0.05, 0.09], [0, 1, 0], ilk);
    ucgenVoxelle(b, [0.01, 0.06, 0.01], [0.09, 0.06, 0.01], [0.01, 0.06, 0.09], [0, 1, 0], son);
    assert.equal(birikimiBitir(b).malzeme[0], 7);
  }
});

test("voxelleme: iki yönü birbirini götüren ince parçada normal 0 (belirsiz)", () => {
  const iz = izgaraKur([0, 0, 0], [0.1, 0.1, 0.1], 0.1, 0);
  const b = birikimKur(iz);
  ucgenVoxelle(b, [0.01, 0.05, 0.01], [0.09, 0.05, 0.01], [0.01, 0.05, 0.09], [0, 1, 0], BEYAZ);
  ucgenVoxelle(b, [0.01, 0.05, 0.01], [0.09, 0.05, 0.01], [0.01, 0.05, 0.09], [0, -1, 0], BEYAZ);
  const v = birikimiBitir(b);
  assert.deepEqual([...v.normal.slice(0, 3)], [0, 0, 0]);
});

test("yakinlikMaskesi: dolu voxelin r komşuluğundaki BOŞ voxeller, dolunun kendisi değil", () => {
  const n: Vec3 = [9, 1, 1];
  const dolu = new Uint8Array(9); dolu[4] = 1;
  assert.deepEqual([...yakinlikMaskesi(n, dolu, 2)], [0, 0, 1, 1, 0, 1, 1, 0, 0]);
});

// ── ışıklar ──
test("isikGecerliMi: kapalı, sıfır şiddet, yardımcı ışık (görünmeyen tek hedef) girmez; üyelik listesi tek başına engel değil", () => {
  assert.equal(isikGecerliMi({ etkin: true, siddet: 1, yalnizListesi: 0, yalnizGorunen: 0 }), true);
  assert.equal(isikGecerliMi({ etkin: false, siddet: 1, yalnizListesi: 0, yalnizGorunen: 0 }), false);
  assert.equal(isikGecerliMi({ etkin: true, siddet: 0, yalnizListesi: 0, yalnizGorunen: 0 }), false);
  assert.equal(isikGecerliMi({ etkin: true, siddet: 1, yalnizListesi: 1, yalnizGorunen: 0 }), false, "gi_isik deseni");
  assert.equal(isikGecerliMi({ etkin: true, siddet: 1, yalnizListesi: 40, yalnizGorunen: 38 }), true, "ofis ışığı");
});

test("isikPaketle: vec4 düzeni, sınırın ötesi atlanır ve sayılır, sonsuz menzil float32'ye sığar", () => {
  const l = nokta([1, 2, 3], [0.5, 0.25, 1], Number.MAX_VALUE);
  const p = isikPaketle([l, l, l], 2);
  assert.equal(p.sayi, 2);
  assert.equal(p.atlanan, 1);
  assert.deepEqual([...p.a.slice(0, 4)], [1, 2, 3, ISIK_TURU.nokta]);
  assert.deepEqual([...p.c.slice(0, 3)], [0.5, 0.25, 1]);
  assert.ok(Number.isFinite(p.c[3]!) && p.c[3]! > 1e29);
  assert.equal(p.a.length, 8);
});

// ── enjeksiyon (ışık → voxel) ──
function zeminliKutu(cati: boolean): { iz: Izgara; b: VoxelBirikimi } {
  const iz = izgaraKur([0, 0, 0], [2, 2, 2], 0.1, 0);
  const b = birikimKur(iz);
  dortgen(b, [0.02, 0.05, 0.02], [1.96, 0, 0], [0, 0, 1.96], [0, 1, 0], BEYAZ);         // zemin (j = 0)
  if (cati) dortgen(b, [0.02, 1.55, 0.02], [1.96, 0, 0], [0, 0, 1.96], [0, -1, 0], BEYAZ); // çatı (j = 15)
  return { iz, b };
}

test("enjeksiyon: nokta ışığın altındaki voxel = renk × (1 − d/menzil), menzil dışı 0", () => {
  const { b } = zeminliKutu(false);
  const v = birikimiBitir(b);
  const l = nokta([1.05, 0.55, 1.05], [1, 0.5, 0.25], 2);
  const alt = dogrudanIsik(v, 10, 0, 10, [l]);      // merkez (1.05, 0.05, 1.05): d = 0,5 m
  assert.ok(Math.abs(alt[0] - 0.75) < 1e-6, String(alt[0]));
  assert.ok(Math.abs(alt[1] - 0.375) < 1e-6);
  const uzak = dogrudanIsik(v, 10, 0, 10, [nokta([1.05, 0.55, 1.05], [1, 1, 1], 0.4)]);
  assert.deepEqual(uzak, [0, 0, 0]);
});

test("enjeksiyon: ışıkla voxel arasında dolu voxel varsa gölge (0); armatür payı ışığın dibindeki parçayı saymaz", () => {
  const iz = izgaraKur([0, 0, 0], [2, 2, 2], 0.1, 0);
  const b = birikimKur(iz);
  dortgen(b, [0.02, 0.05, 0.02], [1.96, 0, 0], [0, 0, 1.96], [0, 1, 0], BEYAZ);
  dortgen(b, [0.82, 0.85, 0.82], [0.46, 0, 0], [0, 0, 0.46], [0, 1, 0], BEYAZ);       // ışığın altında levha (y 0,85)
  const v = birikimiBitir(b);
  const l = nokta([1.05, 1.45, 1.05], [1, 1, 1], 5);
  assert.deepEqual(dogrudanIsik(v, 10, 0, 10, [l]), [0, 0, 0], "levhanın gölgesinde");
  assert.ok(dogrudanIsik(v, 1, 0, 1, [l])[0] > 0, "köşe açıkta");
  const armatur = nokta([1.05, 0.95, 1.05], [1, 1, 1], 5);   // levhanın 1 voxel üstünde: armatür payı (2 voxel) içinde
  assert.ok(dogrudanIsik(v, 10, 8, 10, [armatur])[0] > 0, "levhanın üstü, ışığın dibi");
});

test("enjeksiyon: yönlü ve yarıküre ışık çatı altında gölgede, çatısızken açıkta; arkaya bakan yüz 0", () => {
  const yonlu: IsikVerisi = { tur: ISIK_TURU.yonlu, konum: [0, 0, 0], yon: [0, -1, 0], renk: [1, 1, 1], menzil: Number.MAX_VALUE, cosYari: 0, us: 1, zemin: [0, 0, 0] };
  const gok: IsikVerisi = { tur: ISIK_TURU.yarikure, konum: [0, 0, 0], yon: [0, 1, 0], renk: [0.2, 0.4, 1], menzil: Number.MAX_VALUE, cosYari: 0, us: 1, zemin: [0.1, 0, 0] };
  const acik = birikimiBitir(zeminliKutu(false).b), kapali = birikimiBitir(zeminliKutu(true).b);
  assert.deepEqual(dogrudanIsik(acik, 10, 0, 10, [yonlu]), [1, 1, 1]);
  assert.deepEqual(dogrudanIsik(kapali, 10, 0, 10, [yonlu]), [0, 0, 0]);
  assert.deepEqual(dogrudanIsik(acik, 10, 0, 10, [gok]), [0.2, 0.4, 1], "normal göğe bakıyor: tam gök rengi");
  assert.deepEqual(dogrudanIsik(kapali, 10, 0, 10, [gok]), [0, 0, 0]);
  const asagi: IsikVerisi = { ...yonlu, yon: [0, 1, 0] };     // aşağıdan yukarı: zeminin üst yüzü görmez
  assert.deepEqual(dogrudanIsik(acik, 10, 0, 10, [asagi]), [0, 0, 0]);
});

test("enjeksiyon: spot konisinin dışı 0, içi üsle zayıflar", () => {
  const v = birikimiBitir(zeminliKutu(false).b);
  const spot: IsikVerisi = { tur: ISIK_TURU.spot, konum: [1.05, 1.05, 1.05], yon: [0, -1, 0], renk: [1, 1, 1], menzil: 100, cosYari: Math.cos(Math.PI / 8), us: 2, zemin: [0, 0, 0] };
  assert.ok(dogrudanIsik(v, 10, 0, 10, [spot])[0] > 0.98);
  assert.deepEqual(dogrudanIsik(v, 1, 0, 1, [spot]), [0, 0, 0]);
});

test("enjekte: dolu voxel = albedo × ışık + ışıma (malzeme tablosu canlı), boş voxel 0; sekme önceki ışınımı ekler", () => {
  const v = birikimiBitir(zeminliKutu(false).b);
  const N = voxelSayisi(v.izgara.n);
  const vi = indeks(v.izgara.n, 10, 0, 10);
  const yonlu: IsikVerisi = { tur: ISIK_TURU.yonlu, konum: [0, 0, 0], yon: [0, -1, 0], renk: [1, 0.5, 0], menzil: Number.MAX_VALUE, cosYari: 0, us: 1, zemin: [0, 0, 0] };
  const L = enjekte(v, [yonlu], (m) => (m === 1 ? [0, 0, 0.3] : [0, 0, 0]));
  assert.deepEqual([...L.slice(4 * vi, 4 * vi + 4)].map((x) => +x.toFixed(5)), [0.8, 0.4, 0.3, 1]);
  const bos = indeks(v.izgara.n, 10, 5, 10);
  assert.deepEqual([...L.slice(4 * bos, 4 * bos + 4)], [0, 0, 0, 0]);
  const onceki = new Float32Array(6 * 3 * N);
  onceki.set([0.5, 0.5, 0.5], (2 * N + vi) * 3);             // +Y bloğu
  const L2 = enjekte(v, [], () => [0, 0, 0], onceki, 1);
  assert.ok(Math.abs(L2[4 * vi]! - 0.4) < 1e-6, "albedo 0,8 × ışınım 0,5");
});

// ── mip, örnekleme, koni ──
test("mipKucult: 2×2×2 ortalama; ornekle: sabit alanda değer, ızgara dışında 0", () => {
  const n: Vec3 = [2, 2, 2];
  const veri = new Float32Array(32);
  for (let v = 0; v < 8; v++) veri.set([v, 0, 0, 1], 4 * v);
  const m = mipKucult({ veri, n });
  assert.deepEqual(m.n, [1, 1, 1]);
  assert.deepEqual([...m.veri], [3.5, 0, 0, 1]);
  const sabit = { veri: new Float32Array(32).fill(0.25), n };
  assert.deepEqual(ornekle(sabit, [1, 1, 1]), [0.25, 0.25, 0.25, 0.25]);
  assert.deepEqual(ornekle(sabit, [2.5, 1, 1]), [0, 0, 0, 0]);
});

/** Yalnız bir duvarı olan ızgara: x = sabit düzleminde ışıyan duvar (verilen ışımayla), gerisi boş. */
function duvarSahnesi(isima: Vec3) {
  const iz = izgaraKur([0, 0, 0], [3.2, 3.2, 3.2], 0.1, 0);
  const b = birikimKur(iz);
  dortgen(b, [2.45, 0.02, 0.02], [0, 3.16, 0], [0, 0, 3.16], [-1, 0, 0], { indeks: 3, albedo: [0, 0, 0], oncelik: 1 });
  const v = birikimiBitir(b);
  const L0 = enjekte(v, [], (m) => (m === 3 ? isima : [0, 0, 0]));
  return { v, sv: mipZinciri({ veri: L0, n: iz.n }) };
}

test("koni: ışıyan duvara bakan koni duvarın ışımasını görür, ters yön 0; renk korunur", () => {
  const { sv } = duvarSahnesi([1, 0.2, 0]);
  const p: Vec3 = [16.5, 16.5, 16.5];            // duvar x = 24,5 hücre; 8 voxel uzakta
  const ileri = koniIzle(sv, p, [1, 0, 0], HACIM.koniBaslangic);
  const geri = koniIzle(sv, p, [-1, 0, 0], HACIM.koniBaslangic);
  assert.ok(ileri[0] > 0.4 && ileri[0] <= 1.0001, `ileri ${ileri[0]}`);
  assert.ok(Math.abs(ileri[1] / ileri[0] - 0.2) < 1e-4, "renk oranı");
  assert.deepEqual(geri, [0, 0, 0]);
});

test("koni: önüne giren opak levha ışımayı keser", () => {
  const iz = izgaraKur([0, 0, 0], [3.2, 3.2, 3.2], 0.1, 0);
  const b = birikimKur(iz);
  dortgen(b, [2.45, 0.02, 0.02], [0, 3.16, 0], [0, 0, 3.16], [-1, 0, 0], { indeks: 3, albedo: [0, 0, 0], oncelik: 1 });
  dortgen(b, [2.05, 0.02, 0.02], [0, 3.16, 0], [0, 0, 3.16], [-1, 0, 0], { indeks: 4, albedo: [0, 0, 0], oncelik: 0 });   // siyah perde
  const v = birikimiBitir(b);
  const sv = mipZinciri({ veri: enjekte(v, [], (m) => (m === 3 ? [1, 1, 1] : [0, 0, 0])), n: iz.n });
  const acik = duvarSahnesi([1, 1, 1]);
  const c = koniIzle(sv, [16.5, 16.5, 16.5], [1, 0, 0], HACIM.koniBaslangic)[0];
  const c0 = koniIzle(acik.sv, [16.5, 16.5, 16.5], [1, 0, 0], HACIM.koniBaslangic)[0];
  assert.ok(c < 0.25 * c0, `perdeli ${c}, perdesiz ${c0}`);
});

test("topla: boş ve uzak voxel toplanmaz (0); yüzey-yakını voxel ışıyan duvara bakan yönde ışınım alır", () => {
  const { v, sv } = duvarSahnesi([1, 1, 1]);
  const irr = topla(v, sv);
  const N = voxelSayisi(v.izgara.n);
  const yakin = indeks(v.izgara.n, 23, 16, 16), uzak = indeks(v.izgara.n, 5, 16, 16);
  assert.equal(v.yakin[yakin], 1);
  assert.ok(irr[(0 * N + yakin) * 3]! > 0.5, "+X bloğu");
  assert.equal(irr[(1 * N + yakin) * 3], 0, "-X bloğu");
  for (let b = 0; b < 6; b++) assert.equal(irr[(b * N + uzak) * 3], 0);
  assert.equal(YONLER.length, 6);
});

test("RENKLİ SEKME (uçtan uca): beyaz ışık + kırmızı duvar → yanındaki beyaz zeminde ışınım R > B; beyaz duvarla R ≈ B", () => {
  const sahne = (duvar: UcgenMalzemesi) => {
    const iz = izgaraKur([0, 0, 0], [2.4, 2.4, 2.4], 0.1, 0);
    const b = birikimKur(iz);
    dortgen(b, [0.02, 0.05, 0.02], [2.36, 0, 0], [0, 0, 2.36], [0, 1, 0], BEYAZ);       // beyaz zemin
    dortgen(b, [1.25, 0.12, 0.02], [0, 2.2, 0], [0, 0, 2.36], [-1, 0, 0], duvar);       // duvar x = 1,25 (normal −X)
    const v = birikimiBitir(b);
    // Beyaz ışık duvarın önünde, zemine değmeyecek kadar kısa menzilli değil: hem duvar hem zemin aydınlanır.
    const l = nokta([0.95, 1.2, 1.2], [1, 1, 1], 1.4);
    const sv = mipZinciri({ veri: enjekte(v, [l], () => [0, 0, 0]), n: iz.n });
    return giOrnekle(iz, topla(v, sv), [0.75, 0.1, 1.2], [0, 1, 0]);   // duvardan 0,5 m, zemin
  };
  const k = sahne(KIRMIZI), w = sahne(BEYAZ);
  assert.ok(k[0] > 2 * k[2], `kırmızı duvar: R ${k[0].toFixed(4)} B ${k[2].toFixed(4)}`);
  assert.ok(Math.abs(w[0] - w[2]) < 1e-6 * Math.max(1, w[0]), "beyaz duvar: renk yok");
  assert.ok(w[0] > 0.01, `beyaz duvarda da sekme var: ${w[0]}`);
});

test("koniSeti: 1 → eksenin kendisi; 6 → ağırlık toplamı 1, birim yönler, merkez eksende, halka eksenden 60°", () => {
  for (const e of YONLER) {
    assert.deepEqual(koniSeti(e, 1), [{ yon: e, agirlik: 1 }]);
    const s6 = koniSeti(e, 6);
    assert.equal(s6.length, 6);
    assert.ok(Math.abs(s6.reduce((t, k) => t + k.agirlik, 0) - 1) < 1e-12);
    assert.deepEqual(s6[0]!.yon, e);
    for (const k of s6) assert.ok(Math.abs(Math.hypot(...k.yon) - 1) < 1e-9);
    for (const k of s6.slice(1)) assert.ok(Math.abs(k.yon[0] * e[0] + k.yon[1] * e[1] + k.yon[2] * e[2] - 0.5) < 1e-9);
  }
});

test("koni seti (teşhis): normalden ~50° yandaki ışıyan levhayı tek koni GÖRMEZ, 6'lı set görür", () => {
  const iz = izgaraKur([0, 0, 0], [3.2, 3.2, 3.2], 0.1, 0);
  const b = birikimKur(iz);
  // Zemin noktası (1,0; 0,1; 1,6); ışıyan dikey levha x = 2,25 m, y 0,6–2,0 → noktadan bakınca dikeyden ~40–65° yanda.
  dortgen(b, [2.25, 0.6, 1.1], [0, 1.4, 0], [0, 0, 1.0], [-1, 0, 0], { indeks: 3, albedo: [0, 0, 0], oncelik: 1 });
  dortgen(b, [0.02, 0.05, 0.02], [3.16, 0, 0], [0, 0, 3.16], [0, 1, 0], { indeks: 4, albedo: [0, 0, 0], oncelik: 0 });   // siyah zemin
  const v = birikimiBitir(b);
  const sv = mipZinciri({ veri: enjekte(v, [], (m) => (m === 3 ? [1, 1, 1] : [0, 0, 0])), n: iz.n });
  const p: Vec3 = [1.0, 0.1, 1.6];
  const tek = giOrnekle(iz, topla(v, sv, 1), p, [0, 1, 0])[0];
  const alti = giOrnekle(iz, topla(v, sv, 6), p, [0, 1, 0])[0];
  // Ölçülen (2026-10-14): tek 0, 6'lı 0,0103 (3 voxel kalın levhada 0,0179). Analitik beklenti (izdüşen katı açı / π) ≈ 0,07:
  // koni izleme kaba mip'te (0,4–0,8 m hücre) ince levhayı boşlukla ortalayıp 4–7× EKSİK görür — bilinen sınır (sonuç belgesi).
  assert.ok(tek < 1e-4, `tek koni ${tek}`);
  assert.ok(alti > 0.005, `6'lı set ${alti}`);
});

test("vramTahmini: ofis boyunda (0,1 m) ≈ 20–40 MiB, bileşenlerin toplamı", () => {
  const iz = izgaraKur([-5.2, 0, -4.5], [5.2, 3.65, 4.2]);
  const v = vramTahmini(iz);
  assert.equal(v.toplam, v.statik + v.isima + v.irr + v.tablo);
  const mib = v.toplam / 2 ** 20;
  assert.ok(mib > 10 && mib < 60, `${mib.toFixed(1)} MiB`);
});

test("statikAtlaslar: dolu voxel s0.a = 255 ve normal kodu; boş-yakın voxel s1.r = 255; uzak boş voxel 0", () => {
  const v = birikimiBitir(zeminliKutu(false).b);
  const { s0, s1, atlas } = statikAtlaslar(v);
  const n = v.izgara.n;
  const ofs = (i: number, j: number, k: number) => { const [x, y] = atlasTekseli(atlas, n, i, j, k); return 4 * (y * atlas.en + x); };
  const d = ofs(10, 0, 10), y = ofs(10, 1, 10), u = ofs(10, 10, 10);
  assert.equal(s0[d + 3], 255);
  assert.equal(s1[d + 1], 255, "normal +Y → 1");
  assert.equal(s1[d + 3], 1, "malzeme");
  assert.equal(s1[y], 255);
  assert.equal(s0[y + 3], 0);
  assert.equal(s1[u], 0);
});
