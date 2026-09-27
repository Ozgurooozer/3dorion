// mind/icgudu.test.ts — Orion'un doğuştan kuralları: adı olan, kalıcı, eksiksiz.
//
// Bekçiler iki yönlü (bkz. icgudu.ts):
//   - kodun ürettiği her kimlik listede var: kayıtta yetim kimlik olmasın;
//   - listedeki her kapı kimliği kodda en az bir girdiyle üretiliyor: ölü kural olmasın.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ICGUDULER, dikkatKurali, icguduMu, type IcguduKimligi } from "./icgudu.ts";
import { KuralRefleksi, UZUN_ISLEM_MS, type RefleksGirdi } from "./refleks.ts";
import { Dikkat } from "./dikkat.ts";
import { OZET_ONEKI, type Algi } from "../protocol/algi.ts";

const TERMINAL = `${OZET_ONEKI.terminal}:\n`;

/**
 * Refleksin her dalına en az bir girdi. Adlandırma: beklenen kimlik → girdi.
 * Girdiler gerçek çıktı biçiminde (refleks.test.ts'teki GERÇEK örneklerle aynı aile).
 */
const REFLEKS_IZGARASI: Record<string, RefleksGirdi> = {
  "refleks.konusma": { tur: "duydum", ozet: `${OZET_ONEKI.duydum} "merhaba"` },
  "refleks.terminal.kod_hata": { tur: "terminal", kod: 1, ozet: `${TERMINAL}foo` },
  "refleks.terminal.kod_bitis": { tur: "terminal", kod: 0, ozet: `${TERMINAL}ℹ tests 3\nℹ pass 3\nℹ fail 0` },
  "refleks.terminal.kod_uzun": { tur: "terminal", kod: 0, sureMs: UZUN_ISLEM_MS, ozet: `${TERMINAL}(komut çıktı üretmedi)` },
  "refleks.terminal.kod_rutin": { tur: "terminal", kod: 0, sureMs: 10, ozet: `${TERMINAL}notlar.txt` },
  "refleks.terminal.yigin_izi": { tur: "terminal", ozet: `${TERMINAL}    at Module._compile (node:internal/modules/cjs/loader:1234:14)` },
  "refleks.terminal.hata_deseni": { tur: "terminal", ozet: `${TERMINAL}Error: Cannot find module './x.ts'` },
  "refleks.terminal.kabuk": { tur: "terminal", ozet: `${TERMINAL}'foo' is not recognized as an internal or external command` },
  "refleks.terminal.bitis_deseni": { tur: "terminal", ozet: `${TERMINAL}✓ built in 3.88s` },
  "refleks.terminal.gurultu": { tur: "terminal", ozet: `${TERMINAL}resolving dependencies... 47/312` },
  "refleks.olay.gurultu": { tur: "olay", ozet: `${OZET_ONEKI.olay} kamera_degisti` },
  "refleks.olay.dunya": { tur: "olay", ozet: `${OZET_ONEKI.olay} oyuncu_odaya_girdi` },
  "refleks.gordum.cevap": { tur: "gordum", ozet: `${OZET_ONEKI.gordum}in front of you): masa` },
  "refleks.sonuc.hata": { tur: "sonuc", ozet: `${OZET_ONEKI.sonuc}n_a1 → hata (çapa bulunamadı)` },
  "refleks.sonuc.rutin": { tur: "sonuc", ozet: `${OZET_ONEKI.sonuc}n_a1 → bitti` },
  "refleks.anlik.rutin": { tur: "dunya", ozet: `${OZET_ONEKI.dunya} duruyor, Ozyn 2.0m away` },
  "refleks.taninmayan": { ozet: "hiçbir öneke uymayan biçim" },
};

const TUM_KIMLIKLER = Object.keys(ICGUDULER) as IcguduKimligi[];

test("her içgüdü kimliği noktalı küçük harf biçiminde", () => {
  for (const k of TUM_KIMLIKLER) {
    assert.match(k, /^[a-z_]+(\.[a-z_]+)*$/, `biçimsiz kimlik: ${k}`);
  }
});

test("refleksin her kararı listede olan bir içgüdü kimliği taşır", () => {
  const r = new KuralRefleksi();
  for (const [ad, girdi] of Object.entries(REFLEKS_IZGARASI)) {
    const k = r.karar(girdi);
    assert.ok(k.kural !== undefined && icguduMu(k.kural), `${ad}: kimliksiz ya da listede olmayan karar (${k.kural})`);
  }
});

test("her izgara girdisi beklenen refleks kimliğini üretir", () => {
  const r = new KuralRefleksi();
  for (const [beklenen, girdi] of Object.entries(REFLEKS_IZGARASI)) {
    assert.equal(r.karar(girdi).kural, beklenen, `girdi "${girdi.ozet.slice(0, 50)}"`);
  }
});

test("listedeki her refleks içgüdüsü kodda üretiliyor — ölü kural yok", () => {
  const listede = TUM_KIMLIKLER.filter((k) => k.startsWith("refleks.")).sort();
  const izgarada = Object.keys(REFLEKS_IZGARASI).sort();
  assert.deepEqual(izgarada, listede, "izgara ile liste ayrıştı: yeni kural ya izgaraya eklenmeli ya listeden çıkmalı");
});

test("bir refleks kimliği her zaman aynı yönde karar verir", () => {
  // Kimlik = tek bir kural = tek bir yön. Aynı kimlik bir yerde geçirip bir
  // yerde süzseydi kayıttaki kimlik kararı açıklamazdı.
  const r = new KuralRefleksi();
  const yon = new Map<string, boolean>();
  const ekGirdiler: RefleksGirdi[] = [
    { tur: "terminal", kod: 2, ozet: `${TERMINAL}` },
    { tur: "terminal", kod: 127, ozet: `${TERMINAL}error: çok şey` },
    { tur: "terminal", kod: 0, sureMs: 5000, ozet: `${TERMINAL}Error in commit message` },
    { tur: "olay", ozet: `${OZET_ONEKI.olay} ipucu` },
    { tur: "olay", ozet: `${OZET_ONEKI.olay} monitor_acildi` },
    { tur: "yakin", ozet: `${OZET_ONEKI.yakin} masa` },
  ];
  for (const g of [...Object.values(REFLEKS_IZGARASI), ...ekGirdiler]) {
    const k = r.karar(g);
    const onceki = yon.get(k.kural!);
    if (onceki !== undefined) assert.equal(k.terfi, onceki, `${k.kural} iki yönde karar verdi`);
    yon.set(k.kural!, k.terfi);
  }
});

test("dikkatin her düşürme sebebi listede bir içgüdü ve hepsi üretilebiliyor", () => {
  // Saat elle ilerler: kısma ve tekrar pencereleri zamana bağlı. 0'dan değil
  // 10 sn'den başlar: dikkat son terminal zamanını 0 sayar, t=0'da ilk
  // terminal çıktısı da kısılırdı.
  let t = 10_000;
  const d = new Dikkat({ simdi: () => t, dakikaBasinaAzami: 3 });
  const sebepler = new Set<string>();
  const gonder = (a: Algi): void => {
    const k = d.karar(a);
    if (!k.gecsin) {
      assert.ok(k.sebep, `sebepsiz düşüş: ${a.tur}`);
      sebepler.add(k.sebep);
    }
  };
  gonder({ tur: "tik", t: 0, dt: 0.05, orion: {} as never, oyuncu: {} as never });            // tik_yasak
  gonder({ tur: "yakin", nesneler: [] });                                                     // yerel_kanal
  gonder({ tur: "olay", ad: "kamera_degisti" });                                              // onemsiz
  gonder({ tur: "terminal", kuyruk: "a", kesildi: false });                                   // geçer
  t += 10; gonder({ tur: "terminal", kuyruk: "b", kesildi: false });                          // kisildi
  gonder({ tur: "olay", ad: "oyuncu_odaya_girdi" });                                          // geçer
  t += 10; gonder({ tur: "olay", ad: "oyuncu_odaya_girdi" });                                 // tekrar
  gonder({ tur: "olay", ad: "monitor_acildi" });                                              // geçer (3. mesaj)
  gonder({ tur: "olay", ad: "oyuncu_masaya_oturdu" });                                        // butce
  const beklenen = ["butce", "kisildi", "onemsiz", "tekrar", "tik_yasak", "yerel_kanal"];
  assert.deepEqual([...sebepler].sort(), beklenen);
  for (const s of beklenen) {
    assert.ok(icguduMu(dikkatKurali(s as Parameters<typeof dikkatKurali>[0])), `dikkat.${s} listede yok`);
  }
});

test("güvenlik içgüdülerini hiçbir öğrenilmiş kural ezemez", () => {
  // Maliyet tavanı, sözleşme ve insan denetimi deneyimle gevşemez.
  const guvenlik: IcguduKimligi[] = [
    "kayit", "kopru.konusma", "kopru.zincir", "kopru.guvenli_taraf",
    "dikkat.tik_yasak", "dikkat.yerel_kanal", "dikkat.kisildi", "dikkat.tekrar", "dikkat.butce",
    "refleks.konusma", "refleks.gordum.cevap", "onay.insan",
  ];
  for (const k of guvenlik) {
    assert.equal(ICGUDULER[k].ezilebilir, false, `${k} ezilebilir olmamalı`);
  }
});

test("içerik yargıları öğrenilebilir: terminal, olay, sonuç ve anlık görüntü kuralları ezilebilir", () => {
  const icerik = TUM_KIMLIKLER.filter((k) => /^refleks\.(terminal|olay|sonuc|anlik)\./.test(k) || k === "refleks.taninmayan");
  assert.ok(icerik.length >= 14, `içerik kuralı sayısı beklenenden az: ${icerik.length}`);
  for (const k of icerik) {
    assert.equal(ICGUDULER[k].ezilebilir, true, `${k} içerik yargısı, ezilebilir olmalı`);
  }
});

test("icguduMu listede olmayan kimliği ve prototip adlarını reddeder", () => {
  assert.equal(icguduMu("refleks.yok_boyle"), false);
  assert.equal(icguduMu("toString"), false);
  assert.equal(icguduMu("kayit"), true);
});
