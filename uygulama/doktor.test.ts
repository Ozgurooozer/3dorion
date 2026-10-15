// uygulama/doktor.test.ts — Orion Doktor (muayene çekirdeği, sahte GL/mesh/ortam ile).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LevelTanimi } from "../world/level/cekirdek/levelTanimi.ts";
import type { OrtamKomutu } from "../world/level/stil/ortamKomutu.ts";
import { doktorKur, GL_INVALID_OPERATION, DOKTOR_EFEKTLERI, DOKTOR_STILLERI, type DoktorBaglami } from "./doktor.ts";

const ILK = { id: "ilk" } as unknown as LevelTanimi;

function sahte(ek: Partial<DoktorBaglami> & { glHata?: number; hazirDegil?: string[]; kullanilabilir?: boolean; uygulaFirlat?: boolean; geriYuklenir?: boolean } = {}) {
  const uygulananlar: { k: OrtamKomutu; sessiz: boolean | undefined }[] = [];
  const geriYuklenenler: LevelTanimi[] = [];
  // Gerçek GL gibi: bayrak OKUNUNCA sıfırlanır. İlk okuma (boşaltma döngüsü) 0 döner, sonra her ikinci okuma hata bayrağını görür.
  let okuma = 0;
  const b: DoktorBaglami = {
    gl: () => ({ getError: () => (ek.glHata && okuma++ % 2 === 1 ? ek.glHata : 0) }),
    mesheler: () => [{ ad: "duvar", hazirMi: () => !ek.hazirDegil?.includes("duvar") }, { ad: "orion", hazirMi: () => !ek.hazirDegil?.includes("orion") }],
    fps: () => 60,
    ortam: {
      kullanilabilirMi: () => ek.kullanilabilir ?? true,
      anlik: () => ILK,
      geriYukle: (t) => { geriYuklenenler.push(t); return ek.geriYuklenir ?? true; },
      uygula: (k, secenek) => {
        if (ek.uygulaFirlat) throw new Error("level patladı");
        uygulananlar.push({ k, sessiz: secenek?.sessiz });
        return { ok: true, not: "ok" };
      },
    },
    bekle: async () => {},
    yerlesmeMs: 0, olcumMs: 0,
    ...ek,
  };
  return { b, uygulananlar, geriYuklenenler };
}

test("hızlı muayene: hata yok, mesh'ler hazır → sağlıklı, hiçbir şeye dokunmaz", async () => {
  const { b, uygulananlar } = sahte();
  const r = await doktorKur(b).muayene("hizli");
  assert.equal(r.saglikli, true);
  assert.match(r.ozet, /^Muayene temiz/);
  assert.equal(uygulananlar.length, 0, "hızlı muayene ortama dokunmamalı");
});

test("GL INVALID_OPERATION görülürse hasta: rapor sorunu adıyla söyler", async () => {
  const { b } = sahte({ glHata: GL_INVALID_OPERATION });
  const r = await doktorKur(b).muayene("hizli");
  assert.equal(r.saglikli, false);
  assert.match(r.ozet, /^Sorun var/);
  assert.ok(r.ayrinti.some((s) => s.startsWith("KALDI pasif kontrol")), r.ayrinti.join("\n"));
  assert.match(r.modelNotu, /problem/);
});

test("hazır olmayan (görünmez) mesh rapora girer", async () => {
  const { b } = sahte({ hazirDegil: ["orion"] });
  const r = await doktorKur(b).muayene("hizli");
  assert.equal(r.saglikli, false);
  assert.ok(r.ayrinti.some((s) => s.includes("hazır_olmayan_mesh=1") && s.includes("orion")), r.ayrinti.join("\n"));
});

test("GL bağlamı yoksa ölçülemedi der ama çökmez; mesh'ler yine denetlenir", async () => {
  const { b } = sahte({ gl: () => null });
  const r = await doktorKur(b).muayene("hizli");
  assert.equal(r.saglikli, true);
  assert.ok(r.ayrinti[0]!.includes("ölçülemedi"));
});

test("tam muayene: her efekt ve önayar gündüz+gece açılır, hepsi SESSİZ uygulanır, en sonda eski hâl geri yüklenir", async () => {
  const { b, uygulananlar, geriYuklenenler } = sahte();
  const r = await doktorKur(b).muayene("tam");
  assert.equal(r.saglikli, true, r.ayrinti.join("\n"));
  assert.ok(uygulananlar.length > 0 && uygulananlar.every((u) => u.sessiz === true), "günlüğe/öğrenen sözlüğe iz bırakılmamalı");
  const efektAcma = uygulananlar.filter((u) => u.k.ne === "efekt" && u.k.deger?.endsWith(":ac")).length;
  assert.equal(efektAcma, DOKTOR_EFEKTLERI.length * 2, "her efekt gündüz ve gece açılmalı");
  assert.equal(uygulananlar.filter((u) => u.k.ne === "stil").length, DOKTOR_STILLERI.length * 2);
  assert.deepEqual(geriYuklenenler, [ILK], "eski hâl tam bir kez geri yüklenmeli");
});

test("tam muayene ova dışında: efekt testi ATLANIR, ortama dokunulmaz, rapor bunu söyler", async () => {
  const { b, uygulananlar, geriYuklenenler } = sahte({ kullanilabilir: false });
  const r = await doktorKur(b).muayene("tam");
  assert.equal(uygulananlar.length + geriYuklenenler.length, 0);
  assert.ok(r.ayrinti.some((s) => s.startsWith("ATLANDI")));
  assert.equal(r.saglikli, true);
});

test("tam muayene ortasında hata fırlarsa bile ESKİ HÂL geri yüklenir ve rapor 'çöktü' der", async () => {
  const { b, geriYuklenenler } = sahte({ uygulaFirlat: true });
  const r = await doktorKur(b).muayene("tam");
  assert.deepEqual(geriYuklenenler, [ILK]);
  assert.equal(r.saglikli, false);
  assert.ok(r.ayrinti.some((s) => s.includes("muayene çöktü")));
});

test("eski hâle dönülemezse bu AÇIKÇA raporlanır (sessiz bırakılmış ortam yok)", async () => {
  const { b } = sahte({ geriYuklenir: false });
  const r = await doktorKur(b).muayene("tam");
  assert.equal(r.saglikli, false);
  assert.ok(r.ayrinti.some((s) => s.includes("eski ortam hâline dönülemedi")));
});

test("muayene sürerken ikinci istek ÇAKIŞMAZ: 'zaten muayene ediyorum' döner", async () => {
  let birak!: () => void;
  const bekletici = new Promise<void>((r) => { birak = r; });
  const { b } = sahte({ bekle: () => bekletici });
  const d = doktorKur(b);
  const ilk = d.muayene("hizli");
  assert.equal(d.mesgulMu(), true);
  const ikinci = await d.muayene("hizli");
  assert.equal(ikinci.saglikli, false);
  assert.match(ikinci.ozet, /Zaten muayene/);
  birak();
  assert.equal((await ilk).saglikli, true);
  assert.equal(d.mesgulMu(), false);
});
