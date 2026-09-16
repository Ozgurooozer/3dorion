// bridge/disBeyin.test.ts — dış süreç GÜVENİLMEZDİR.
//
// Bu beyin başka bir dilde, başka bir süreçte koşuyor. Çökebilir, yarım JSON
// dönebilir, hiç dönmeyebilir. Hiçbiri dünyayı çökertmemeli.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DisBeyin } from "./disBeyin.ts";
import { araclariUret } from "./araclar.ts";

const GIRDI = { ozetler: [], dunya: "oda", gecmis: [], araclar: araclariUret() };

/** fetch'i sahteyle değiştirir; son gönderilen gövdeyi de saklar. */
function sunucu(yanit: { kod?: number; govde?: unknown; atla?: () => never }) {
  const eski = globalThis.fetch;
  const kayit: { govde?: unknown; yol?: string } = {};
  globalThis.fetch = (async (u: string | URL, o?: RequestInit) => {
    kayit.yol = String(u);
    if (o?.body) kayit.govde = JSON.parse(String(o.body));
    if (yanit.atla) yanit.atla();
    const g = typeof yanit.govde === "string" ? yanit.govde : JSON.stringify(yanit.govde ?? {});
    return { ok: (yanit.kod ?? 200) < 400, status: yanit.kod ?? 200, text: async () => g } as Response;
  }) as typeof fetch;
  return { geri: () => { globalThis.fetch = eski; }, kayit };
}

test("yapısal çağrılar DOĞRUDAN geçer — satır sözleşmesi gerekmez", async () => {
  const s = sunucu({ govde: {
    metin: "gti→git",
    cagrilar: [{ ad: "dunya_komut", girdi: { metin: "git", gerekce: "yazım hatası" } }],
  } });
  try {
    const c = await new DisBeyin().dusun(GIRDI);
    assert.equal(c.cagrilar.length, 1);
    assert.equal(c.cagrilar[0]?.ad, "dunya_komut");
    assert.deepEqual(c.cagrilar[0]?.girdi, { metin: "git", gerekce: "yazım hatası" });
    assert.equal(c.metin, "gti→git");
  } finally { s.geri(); }
});

test("GİRDİ olduğu gibi gönderilir — dış beyin neyi kullanacağına kendi karar verir", async () => {
  const s = sunucu({ govde: {} });
  try {
    await new DisBeyin().dusun({ ...GIRDI, talimat: "sen Orion'sun", ozetler: ["ekranda hata"] });
    const g = s.kayit.govde as Record<string, unknown>;
    assert.equal(g.talimat, "sen Orion'sun");
    assert.deepEqual(g.ozetler, ["ekranda hata"]);
    assert.ok(Array.isArray(g.araclar) && (g.araclar as unknown[]).length > 0,
      "arac listesi de gitmeli");
  } finally { s.geri(); }
});

test("BOZUK çağrılar ayıklanır, sağlamlar kalır — dünya çökmez", async () => {
  const s = sunucu({ govde: { cagrilar: [
    { ad: "dunya_soyle", girdi: { metin: "merhaba" } },   // sağlam
    { girdi: { metin: "adsız" } },                         // ad yok
    { ad: 42, girdi: {} },                                 // ad dize değil
    { ad: "", girdi: {} },                                 // boş ad
    null, "cop", 7,                                        // hiç nesne değil
    { ad: "dunya_dur" },                                   // girdi yok → {} olmalı
  ] } });
  try {
    const c = await new DisBeyin().dusun(GIRDI);
    assert.deepEqual(c.cagrilar.map((x) => x.ad), ["dunya_soyle", "dunya_dur"]);
    assert.deepEqual(c.cagrilar[1]?.girdi, {}, "eksik girdi bos nesneye donmeli");
  } finally { s.geri(); }
});

test("çağrı listesi DİZİ değilse boş sayılır", async () => {
  for (const kotu of [{ cagrilar: "hepsi" }, { cagrilar: 5 }, { cagrilar: null }, {}]) {
    const s = sunucu({ govde: kotu });
    try {
      assert.deepEqual((await new DisBeyin().dusun(GIRDI)).cagrilar, []);
    } finally { s.geri(); }
  }
});

test("BOZUK JSON hata olarak yükselir — sessizce yutulmaz", async () => {
  const s = sunucu({ govde: "{ yarim json" });
  try {
    await assert.rejects(() => new DisBeyin().dusun(GIRDI));
  } finally { s.geri(); }
});

test("HTTP hatası sebebiyle birlikte yükselir", async () => {
  const s = sunucu({ kod: 500, govde: "beyin coktu" });
  try {
    await assert.rejects(() => new DisBeyin().dusun(GIRDI), /500/);
  } finally { s.geri(); }
});

test("ZAMAN AŞIMI anlamlı mesaj verir — ham AbortError hiçbir şey anlatmaz", async () => {
  const s = sunucu({ atla: () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; } });
  try {
    await assert.rejects(() => new DisBeyin({ zamanAsimiMs: 3000 }).dusun(GIRDI),
      /3 sn icinde cevap vermedi/);
  } finally { s.geri(); }
});

test("hazirMi sunucu yoksa FALSE döner, patlamaz", async () => {
  const s = sunucu({ atla: () => { throw new Error("ECONNREFUSED"); } });
  try {
    assert.equal(await new DisBeyin().hazirMi(), false);
  } finally { s.geri(); }
});

test("hazirMi /saglik yolunu kullanır", async () => {
  const s = sunucu({ kod: 200 });
  try {
    assert.equal(await new DisBeyin().hazirMi(), true);
    assert.match(String(s.kayit.yol), /\/saglik$/);
  } finally { s.geri(); }
});

test("adres ve ad dışarıdan verilebilir — birden çok beyin yan yana koşabilir", () => {
  const b = new DisBeyin({ adres: "http://127.0.0.1:9999/", ad: "torch" });
  assert.equal(b.ad, "torch");
});

test("bilgi alanına süre ve model eklenir — tanı kaybolmasın", async () => {
  const s = sunucu({ govde: { bilgi: { kaynak: "python" } } });
  try {
    const c = await new DisBeyin({ ad: "py" }).dusun(GIRDI);
    assert.equal(c.bilgi?.kaynak, "python", "dis beynin kendi bilgisi korunmali");
    assert.equal(c.bilgi?.model, "py");
    assert.equal(typeof c.bilgi?.sureMs, "number");
  } finally { s.geri(); }
});
