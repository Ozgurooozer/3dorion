// world/player/isinTarama.test.ts — Bakış ışını okluzyon testleri.
//
// Koşum: node --experimental-strip-types --test world/player/isinTarama.test.ts
// Babylon YÜKLENMEZ. Bu, ışın mantığının motordan ayrıldığının kanıtıdır.
//
// Düzeltilen hata: ilk sürüm `scene.pickWithRay`e etiket süzgeci veriyordu,
// süzgeç isabetten ÖNCE çalıştığı için duvar ışını durdurmuyordu — oyuncu
// duvarın arkasından monitöre `E` basabiliyordu. Aşağıdaki "duvar arkasından"
// testleri o hatayı yeniden getirirse KIRMIZI yanar.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bakilanCapa, birimYon, isinAabb, isinTara, type Nokta3,
} from "./isinTarama.ts";
import { KATI_YUZEYLER, MONITOR, TAHTA, ODA, type KatiYuzey } from "../level/olculer.ts";
import { capaBul } from "../level/capalar.ts";

/** Menzil — `oyuncu.ts` ile aynı olmalı (spec: 2.5 m). */
const MENZIL = 2.5;
const GOZ = 1.62;

/** Bir noktadan diğerine bakıldığında önerilen çapa. */
function bakis(kaynak: Nokta3, hedef: Nokta3, menzil = MENZIL, yuzeyler?: readonly KatiYuzey[]) {
  const yon = birimYon(kaynak, hedef);
  assert.ok(yon, "kaynak ve hedef çakışık");
  return yuzeyler
    ? bakilanCapa(kaynak, yon, menzil, yuzeyler)
    : bakilanCapa(kaynak, yon, menzil);
}

// ── Sentetik sahne: üç zorunlu durum, çıplak geometri ─────────────────────
// Monitör z=-3'te, arada z=-1'de bir duvar. Sayılar kasten yuvarlak: testin
// ne söylediği tek bakışta okunsun.
const SENTETIK: readonly KatiYuzey[] = [
  { capa: "monitor", kutu: { x: 0, y: 1.2, z: -3, g: 1, yuk: 0.6, d: 0.05 } },
  { capa: null, kutu: { x: 0, y: 1.5, z: -1, g: 4, yuk: 3, d: 0.2 } }, // arada duvar
];
const SENTETIK_DUVARSIZ: readonly KatiYuzey[] = [SENTETIK[0]!];

test("DURUM 1 — oyuncu ile monitör arasında duvar var → etkileşim YOK", () => {
  const goz: Nokta3 = { x: 0, y: 1.2, z: 0 };
  const monitor: Nokta3 = { x: 0, y: 1.2, z: -3 };
  // Duvar olmasa görülürdü mü? Menzil yetsin diye menzili geniş tutuyoruz;
  // tek değişken duvarın varlığı olsun.
  assert.equal(bakis(goz, monitor, 10, SENTETIK_DUVARSIZ), "monitor", "kontrol: duvarsız görülmeli");
  // Duvar varken: en yakın isabet duvar (capa null) → etkileşim yok.
  assert.equal(bakis(goz, monitor, 10, SENTETIK), null);
  // Ham isabet gerçekten duvar mı, ve monitörden daha mı yakın?
  const yon = birimYon(goz, monitor)!;
  const isabet = isinTara(goz, yon, 10, SENTETIK);
  assert.ok(isabet);
  assert.equal(isabet.capa, null, "en yakın isabet duvar olmalı");
  assert.ok(Math.abs(isabet.mesafe - 0.9) < 1e-9, `duvar ön yüzü 0.9m: ${isabet.mesafe}`);
});

test("DURUM 2 — açık görüş hattı, 2.5 m içinde → etkileşim VAR", () => {
  const goz: Nokta3 = { x: 0, y: 1.2, z: -1.2 }; // monitöre 1.775 m (duvar arkada kaldı)
  const monitor: Nokta3 = { x: 0, y: 1.2, z: -3 };
  assert.equal(bakis(goz, monitor, MENZIL, SENTETIK), "monitor");
  const isabet = isinTara(goz, birimYon(goz, monitor)!, MENZIL, SENTETIK);
  assert.ok(isabet && isabet.mesafe < MENZIL);
});

test("DURUM 3 — açık görüş hattı ama 2.5 m'den uzak → etkileşim YOK", () => {
  const goz: Nokta3 = { x: 0, y: 1.2, z: 0 };
  const monitor: Nokta3 = { x: 0, y: 1.2, z: -3 }; // 2.975 m
  // Duvarsız sahne: tek engel mesafe.
  assert.equal(bakis(goz, monitor, MENZIL, SENTETIK_DUVARSIZ), null);
  // Menzil yetince aynı ışın monitörü bulur → reddin sebebi gerçekten mesafe.
  assert.equal(bakis(goz, monitor, 3.0, SENTETIK_DUVARSIZ), "monitor");
});

// ── Gerçek oda geometrisi ─────────────────────────────────────────────────

test("gerçek oda: monitörün durağından monitör görünür ve menzilde", () => {
  const m = capaBul("monitor");
  assert.ok(m);
  const goz = { x: m.durak.x, y: GOZ, z: m.durak.z };
  const hedef = { x: MONITOR.x, y: MONITOR.y, z: MONITOR.z };
  assert.equal(bakis(goz, hedef), "monitor");
});

test("gerçek oda: duvarın ARKASINDAN monitöre bakılamaz", () => {
  // Odanın dışında, arka duvarın gerisinde bir göz. Oyuncu oraya yürüyemez ama
  // ışın mantığı yine de duvarı katı saymak zorunda — T3 monitör odağını
  // bağladığında bu garanti terminalin duvardan açılmasını engeller.
  const goz = { x: MONITOR.x, y: MONITOR.y, z: -ODA.derinlik / 2 - 0.6 };
  const hedef = { x: MONITOR.x, y: MONITOR.y, z: MONITOR.z };
  const yon = birimYon(goz, hedef)!;
  const isabet = isinTara(goz, yon, MENZIL);
  assert.ok(isabet, "duvara çarpmalıydı");
  assert.equal(isabet.capa, null, "arka duvar etkileşimsiz olmalı");
  assert.equal(bakilanCapa(goz, yon, MENZIL), null);
});

test("gerçek oda: duvarın ARKASINDAN tahtaya bakılamaz", () => {
  const goz = { x: -ODA.genislik / 2 - 0.7, y: TAHTA.y, z: TAHTA.z };
  const hedef = { x: TAHTA.x, y: TAHTA.y, z: TAHTA.z };
  assert.equal(bakis(goz, hedef), null);
  // İçeriden bakılınca aynı hedef görünür → testin reddi duvardan kaynaklı.
  const t = capaBul("tahta");
  assert.ok(t);
  assert.equal(bakis({ x: t.durak.x, y: TAHTA.y, z: t.durak.z }, hedef), "tahta");
});

test("gerçek oda: raf etkileşimsizdir ama ışını durdurur", () => {
  // Rafın (x≈-4.78, z 1.5..3.3) tam önünden bakış: isabet var, çapa yok.
  const goz = { x: -3.6, y: 1.0, z: 2.4 };
  const hedef = { x: -5.0, y: 1.0, z: 2.4 };
  const yon = birimYon(goz, hedef)!;
  const isabet = isinTara(goz, yon, MENZIL);
  assert.ok(isabet, "rafa çarpmalıydı");
  assert.equal(isabet.capa, null);
  assert.ok(isabet.mesafe < 1.0, `raf ön yüzü yakın olmalı: ${isabet.mesafe}`);
});

test("gerçek oda: zemine ve tavana bakmak etkileşim üretmez", () => {
  const goz = { x: 0, y: GOZ, z: 0 };
  assert.equal(bakilanCapa(goz, { x: 0, y: -1, z: 0 }, MENZIL), null, "zemin");
  assert.equal(bakilanCapa(goz, { x: 0, y: 1, z: 0 }, MENZIL), null, "tavan");
});

test("gerçek oda: her etkileşimli çapa kendi durağından görülebilir", () => {
  // Regresyon kalkanı: bir durak noktası kaydırılıp çapa görünmez hâle
  // gelirse (ör. masanın arkasına düşerse) burada yakalanır.
  for (const ad of ["monitor", "masa", "sandalye", "tahta", "pencere"] as const) {
    const c = capaBul(ad);
    assert.ok(c, ad);
    const goz = { x: c.durak.x, y: GOZ, z: c.durak.z };
    const gorulen = bakis(goz, c.konum);
    assert.ok(gorulen !== null, `${ad} durağından hiçbir şey görünmüyor`);
  }
});

// ── isinAabb kenar durumları ──────────────────────────────────────────────

test("isinAabb: arkadaki kutu isabet sayılmaz", () => {
  const kutu = { x: 0, y: 0, z: -2, g: 1, yuk: 1, d: 1 };
  // İleri (-Z) bakış: isabet
  assert.ok(isinAabb({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, kutu) !== null);
  // Geri (+Z) bakış: kutu arkada kaldı
  assert.equal(isinAabb({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, kutu), null);
});

test("isinAabb: eksene paralel ışın dilim dışındaysa kesişmez", () => {
  const kutu = { x: 0, y: 0, z: -2, g: 1, yuk: 1, d: 1 };
  // y=5'ten -Z'ye bakış: yön y bileşeni 0, kaynak kutunun y dilimi dışında
  assert.equal(isinAabb({ x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: -1 }, kutu), null);
});

test("isinAabb: kaynak kutunun içindeyse 0 döner", () => {
  const kutu = { x: 0, y: 0, z: 0, g: 2, yuk: 2, d: 2 };
  assert.equal(isinAabb({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, kutu), 0);
});

test("isinAabb: teğet geçiş (kenarı sıyıran ışın) çökertmez", () => {
  const kutu = { x: 0, y: 0, z: -2, g: 1, yuk: 1, d: 1 };
  const t = isinAabb({ x: 0.5, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, kutu);
  assert.ok(t === null || Number.isFinite(t), `sonlu ya da null olmalı: ${t}`);
});

test("isinTara boş yüzey listesinde null döner", () => {
  assert.equal(isinTara({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, MENZIL, []), null);
});

test("birimYon birim uzunluk üretir, çakışık noktada null", () => {
  const y = birimYon({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 });
  assert.ok(y);
  assert.ok(Math.abs(Math.hypot(y.x, y.y, y.z) - 1) < 1e-12);
  assert.equal(birimYon({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }), null);
});

test("KATI_YUZEYLER: her etiketli yüzeyin çapası kayıtlı", () => {
  for (const y of KATI_YUZEYLER) {
    if (y.capa === null) continue;
    assert.ok(capaBul(y.capa), `ışın yüzeyi kayıtsız çapaya işaret ediyor: ${y.capa}`);
  }
});
