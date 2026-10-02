// uygulama/niyetYurutucu.test.ts — Tek niyet yönlendirme noktası: her niyet doğru yere mi gidiyor?
//
// Bu yönlendirme giris.ts'in içindeyken yalnız canlı koşuyla sınanabiliyordu (spec 14 R4). Burada
// dünya sahtedir: beden, köprü, tahta, monitör ve onay kapısı yalnız ne istendiğini kaydeder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { niyetYurutucusuKur, type YurutucuBaglami } from "./niyetYurutucu.ts";
import { capaBul } from "../world/level/capalar.ts";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";
import type { Algi, OrionDurumu } from "../protocol/algi.ts";
import type { Vec3 } from "../protocol/temel.ts";

const TAHTA_ONU: Vec3 = capaBul("tahta")!.durak;
const UZAK: Vec3 = { x: TAHTA_ONU.x + 6, y: 0, z: TAHTA_ONU.z };

/** Sahte dünya: her çağrıyı kaydeder. `bedenCevabi` bedenin bir niyete vereceği sonucu seçer. */
function sahneKur(ayar: {
  konum?: Vec3;
  beden?: boolean;
  onerKabul?: boolean;
  bedenCevabi?: (n: Niyet) => { durum: NiyetSonucu["durum"]; varis?: Vec3 } | null;
} = {}) {
  const kayit = {
    bedeneGiden: [] as { n: Niyet; id: string }[],
    kopruSonuc: [] as NiyetSonucu[],
    kopruAlgi: [] as Algi[],
    tahtaYazilan: [] as string[],
    onerilen: [] as string[],
    panelCizildi: 0,
    gordumBildirildi: 0,
  };
  let konum = ayar.konum ?? TAHTA_ONU;
  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  const durum = (): OrionDurumu => ({
    konum, bakis: { x: 0, y: 0, z: -1 }, poz: "duruyor", mesgul: false, elinde: null, oturuyor_mu: false,
  });
  const beden = {
    durum,
    sonucDinle(cb: (s: NiyetSonucu) => void) { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; },
    niyet(n: Niyet, id: string) {
      kayit.bedeneGiden.push({ n, id });
      const c = ayar.bedenCevabi?.(n);
      if (!c) return;
      if (c.varis) konum = c.varis;
      for (const d of [...dinleyiciler]) d({ niyet_id: id, durum: c.durum });
    },
  };
  const b: YurutucuBaglami = {
    beden: () => (ayar.beden === false ? null : beden),
    kopru: () => ({ sonuc: (s) => { kayit.kopruSonuc.push(s); }, algi: (a) => { kayit.kopruAlgi.push(a); } }),
    tahta: { yaz: (m) => { kayit.tahtaYazilan.push(m); return { eklenen: 1, dusen: 0 }; } },
    monitor: { acikMi: () => false, ac: async () => {} },
    onayKapisi: {
      oner: (_id, komut) => {
        kayit.onerilen.push(komut);
        return ayar.onerKabul === false ? { kabul: false, sebep: "zaten bekleyen var" } : { kabul: true };
      },
      bekleyen: null,
    },
    sema: { vur: () => {} },
    gunluk: { ekle: () => {} },
    algiSor: () => ({ metin: "tahta görünüyor", maliyet: 15, kirpildi: false }),
    altyazi: () => {},
    onayPaneliCiz: () => { kayit.panelCizildi++; },
    gordumBildir: () => { kayit.gordumBildirildi++; },
  };
  return { kayit, y: niyetYurutucusuKur(b) };
}

const bekleBiraz = () => new Promise((r) => setTimeout(r, 0));

test("soyle bedene gitmez (ses hattının işi)", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "soyle", metin: "merhaba" }, "n1");
  assert.equal(kayit.bedeneGiden.length, 0);
});

test("git bedene aynı kimlikle gider", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "git", hedef: { tip: "oyuncu" } }, "n1");
  assert.deepEqual(kayit.bedeneGiden.map((g) => g.id), ["n1"]);
});

test("tahtanın önündeyken yaz hemen tahtaya yazar", () => {
  const { kayit, y } = sahneKur({ konum: TAHTA_ONU });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  assert.deepEqual(kayit.tahtaYazilan, ["not"]);
});

test("uzaktan yaz hemen yazmaz", () => {
  const { kayit, y } = sahneKur({ konum: UZAK });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  assert.deepEqual(kayit.tahtaYazilan, []);
});

test("uzaktan yaz önce tahtaya yürür", () => {
  const { kayit, y } = sahneKur({ konum: UZAK });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  assert.deepEqual(kayit.bedeneGiden.map((g) => g.n), [{ tur: "git", hedef: { tip: "capa", ad: "tahta" } }]);
});

test("uzaktan yaz: vardıktan sonra yazar", async () => {
  const { kayit, y } = sahneKur({ konum: UZAK, bedenCevabi: () => ({ durum: "bitti", varis: TAHTA_ONU }) });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  await bekleBiraz();
  assert.deepEqual(kayit.tahtaYazilan, ["not"]);
});

test("uzaktan yaz: yürüyemezse köprüye hata döner", async () => {
  const { kayit, y } = sahneKur({ konum: UZAK, bedenCevabi: () => ({ durum: "hata" }) });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  await bekleBiraz();
  assert.deepEqual(kayit.kopruSonuc.map((s) => [s.niyet_id, s.durum]), [["n1", "hata"]]);
});

test("komut bedene değil onay kapısına gider", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "komut", metin: "dir", gerekce: "listele" }, "n1");
  assert.deepEqual([kayit.onerilen, kayit.bedeneGiden.length], [["dir"], 0]);
});

test("kabul edilen komut onay panelini çizer", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "komut", metin: "dir", gerekce: "listele" }, "n1");
  assert.equal(kayit.panelCizildi, 1);
});

test("kapının reddettiği komut köprüye sebebiyle hata döner", () => {
  const { kayit, y } = sahneKur({ onerKabul: false });
  y.niyetiYurut({ tur: "komut", metin: "dir", gerekce: "listele" }, "n1");
  assert.deepEqual(kayit.kopruSonuc, [{ niyet_id: "n1", durum: "hata", not: "zaten bekleyen var" }]);
});

test("sor cevabı beyne `gordum` olarak ulaşır", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "sor", ne: "etrafim" }, "n1");
  assert.deepEqual(kayit.kopruAlgi, [{ tur: "gordum", ne: "etrafim", metin: "tahta görünüyor" }]);
});

test("sor `gordum` geldiğini bildirir", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "sor", ne: "etrafim" }, "n1");
  assert.equal(kayit.gordumBildirildi, 1);
});

test("monitör dışı odaklan o çapaya yürür", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "odaklan", capa: "pencere" }, "n1");
  assert.deepEqual(kayit.bedeneGiden, [{ n: { tur: "git", hedef: { tip: "capa", ad: "pencere" } }, id: "n1" }]);
});

test("bedenAdimi: beden yokken hata ile çözülür", async () => {
  const { y } = sahneKur({ beden: false });
  const s = await y.bedenAdimi({ tur: "otur" });
  assert.equal(s.durum, "hata");
});

test("bedenAdimi: bedenin sonucu ile çözülür", async () => {
  const { y } = sahneKur({ bedenCevabi: () => ({ durum: "bitti" }) });
  const s = await y.bedenAdimi({ tur: "otur" });
  assert.equal(s.durum, "bitti");
});

test("bedenAdimi: cevap gelmezse süre dolunca hata", async () => {
  const { y } = sahneKur();
  const s = await y.bedenAdimi({ tur: "otur" }, 20);
  assert.equal(s.not, "zaman aşımı");
});
