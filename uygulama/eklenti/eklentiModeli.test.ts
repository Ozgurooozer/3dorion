// uygulama/eklenti/eklentiModeli.test.ts — panelin yalan söyleyebileceği yerler: yeniden başlat bekleyen eklenti "kapalı" görünmemeli, engel anahtarı kilitlemeli.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { EklentiBildirimi } from "../../protocol/eklenti.ts";
import type { EklentiDurumu } from "./eklentiDefteri.ts";
import { gruplariKur, ozetMetni, rozetMetni, satirKur } from "./eklentiModeli.ts";

const b = (id: string, u: Partial<EklentiBildirimi> = {}): EklentiBildirimi => ({ id, ad: id.toUpperCase(), aciklama: `${id} açıklama`, kategori: "zihin", varsayilan: "acik", etki: "aninda", ...u });
const d = (id: string, u: Partial<EklentiDurumu> & { b?: Partial<EklentiBildirimi> } = {}): EklentiDurumu =>
  ({ bildirim: b(id, u.b), acik: true, secenek: null, calisiyor: true, bekleyen: false, hata: null, engel: null, ...u });

test("rozet: hata her şeyden önce; bekleyen 'kapanacak/açılacak' der (kapalı DEMEZ); açık/kapalı/kilitli", () => {
  assert.deepEqual(rozetMetni(d("a", { hata: "x", bekleyen: true })), { metin: "hata", tur: "hata" });
  assert.deepEqual(rozetMetni(d("a", { acik: false, bekleyen: true })), { metin: "kapanacak · yeniden başlat", tur: "uyari" });
  assert.deepEqual(rozetMetni(d("a", { acik: true, bekleyen: true })), { metin: "açılacak · yeniden başlat", tur: "uyari" });
  assert.deepEqual(rozetMetni(d("a")), { metin: "açık", tur: "iyi" });
  assert.deepEqual(rozetMetni(d("a", { acik: false, calisiyor: false })), { metin: "kapalı", tur: "soluk" });
  assert.equal(rozetMetni(d("a", { b: { kilitli: "güvenlik" } })).metin, "açık · kilitli");
});

test("satır: engel varsa anahtar değiştirilemez ve neden taşınır; seçenek seçili değeri varsayılana düşer", () => {
  assert.equal(satirKur(d("a")).degistirilebilir, true);
  const s = satirKur(d("a", { engel: "kilitli: x" }));
  assert.equal(s.degistirilebilir, false); assert.equal(s.engel, "kilitli: x");
  const sec = { ad: "Kip", varsayilan: "kapali", secenekler: [{ id: "kapali", ad: "K", aciklama: "" }, { id: "cozucu", ad: "Ç", aciklama: "" }] };
  assert.equal(satirKur(d("k", { b: { secenek: sec }, secenek: null })).secenek?.secili, "kapali");
  assert.equal(satirKur(d("k", { b: { secenek: sec }, secenek: "cozucu" })).secenek?.secili, "cozucu");
  assert.equal(satirKur(d("a")).secenek, null);
});

test("gruplama: kategori sırası zihin → ajan → beden → arayüz; boş kategori yok; kayıt sırası korunur", () => {
  const g = gruplariKur([d("ui", { b: { kategori: "arayuz" } }), d("z1"), d("aj", { b: { kategori: "ajan" } }), d("z2")]);
  assert.deepEqual(g.map((x) => x.kategori), ["zihin", "ajan", "arayuz"]);
  assert.deepEqual(g[0]!.satirlar.map((s) => s.id), ["z1", "z2"]);
  assert.equal(g[0]!.ad, "Zihin");
  assert.deepEqual(gruplariKur([]), []);
});

test("özet: açık sayısı, bekleyen ve hata söylenir", () => {
  assert.equal(ozetMetni([d("a"), d("b", { acik: false })]), "1/2 açık");
  assert.equal(ozetMetni([d("a", { bekleyen: true }), d("b", { hata: "x" })]), "2/2 açık · 1 yeniden başlatma bekliyor · 1 hata");
  assert.equal(ozetMetni([]), "0/0 açık");
});
