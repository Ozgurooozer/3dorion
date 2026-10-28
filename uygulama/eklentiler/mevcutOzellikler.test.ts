// uygulama/eklentiler/mevcutOzellikler.test.ts — mevcut özellik eklentileri: varsayılan HEPSİ AÇIK (bugünkü motor), panel eklentisi dok'u doğru sürer.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { eklentiDefteriKur } from "../eklenti/eklentiDefteri.ts";
import { ortamKaydi } from "../../protocol/eklenti.ts";
import { AJANDA, FLASH_EKLENTISI, HAFIZA_YONLENDIRICI, PANEL_ICERIK, PANEL_ONIZLEME, PANEL_OUTLINER, mevcutEklentiler } from "./mevcutOzellikler.ts";

const sahteDok = () => { const olay: string[] = []; return { olay, dok: { gorunur: (id: string, g: boolean) => { olay.push(`${id}:${g ? 1 : 0}`); } } }; };

test("varsayılan: altı eklentinin HEPSİ açık (bugünkü davranış), kimlikler benzersiz ve geçerli", () => {
  const { dok } = sahteDok();
  const d = eklentiDefteriKur({}); for (const e of mevcutEklentiler({ dok })) d.kaydet(e); d.baslat();
  assert.deepEqual(d.durum().map((x) => x.bildirim.id), [HAFIZA_YONLENDIRICI, AJANDA, FLASH_EKLENTISI, PANEL_ICERIK, PANEL_OUTLINER, PANEL_ONIZLEME]);
  assert.ok(d.durum().every((x) => x.acik && x.calisiyor && x.hata === null));
});

test("etki dürüstlüğü: hafıza yönlendirici ve Flash KURULUM zamanı okunur (yeniden_baslat); ajanda ve paneller anında", () => {
  const { dok } = sahteDok();
  const etki = Object.fromEntries(mevcutEklentiler({ dok }).map((e) => [e.bildirim.id, e.bildirim.etki]));
  assert.deepEqual(etki, { [HAFIZA_YONLENDIRICI]: "yeniden_baslat", [AJANDA]: "aninda", [FLASH_EKLENTISI]: "yeniden_baslat", [PANEL_ICERIK]: "aninda", [PANEL_OUTLINER]: "aninda", [PANEL_ONIZLEME]: "aninda" });
});

test("panel eklentisi: kapatınca panel gizlenir, açınca görünür; açılışta KAPALIYSA baslat gizler; açık başlangıçta paneli ellemez-gösterir", () => {
  const { dok, olay } = sahteDok();
  const d = eklentiDefteriKur({ ortam: ortamKaydi("panel-outliner:0") }); for (const e of mevcutEklentiler({ dok })) d.kaydet(e); d.baslat();
  assert.ok(olay.includes("outliner:0"), "kapalı başladı: gizlendi");
  assert.ok(!olay.includes("outliner:1"));
  olay.length = 0;
  d.ac("panel-outliner"); assert.deepEqual(olay, ["outliner:1"]);
  d.kapat("panel-icerik"); assert.deepEqual(olay, ["outliner:1", "icerik:0"]);
});

test("ajanda ve Flash eklentisi kapatılabilir; Flash yeniden_baslat olduğundan istenenAcik kurulum kararını verir", () => {
  const { dok } = sahteDok();
  const d = eklentiDefteriKur({ ortam: ortamKaydi("flash:0,ajanda:0") }); for (const e of mevcutEklentiler({ dok })) d.kaydet(e);
  assert.equal(d.istenenAcik(FLASH_EKLENTISI), false, "baslat'tan ÖNCE de okunur: giris.ts Flash'ı kurmadan önce sorar");
  d.baslat();
  assert.equal(d.acikMi(AJANDA), false);
  assert.equal(d.acikMi(FLASH_EKLENTISI), false);
  assert.equal(d.acikMi(HAFIZA_YONLENDIRICI), true);
});
