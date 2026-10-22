// uygulama/yapi/graf/grafEditoruBekci.test.ts — GÖRSEL EDİTÖRÜN DOM KATMANI İÇİN KAYNAK BEKÇİLERİ (spec 35 dilim 2b).
//
// Bu projede tarayıcı test ortamı yok: DOM davranışı canlıda görülmeden "çalışıyor" denemez. Ama iki kural metinden sınanabilir ve bozulursa sessizce
// bozulur (bozma #10, #14 ilk koşuda YAKALANMADI): (1) editör açıkken tuşlar oyuna sızmaz — kök keydown/keyup/keypress'i durdurur, pencere yakalayıcısı
// yutar ve gizlenince kaldırılır; (2) kirli sekmenin ✕'u onayı sekme modeline sorar (kapatmayı zorla "onaylı" çağırmaz). Bu bekçi davranışı KANITLAMAZ,
// yalnız bu satırların silinmesini/değişmesini yakalar; canlı deneme listesi spec 35 §4e.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const oku = (d: string) => fs.readFileSync(path.join(import.meta.dirname, d), "utf8");

test("BEKÇİ (tuş sızıntısı): editör kökü keydown, keyup ve keypress'i durdurur", () => {
  const k = oku("grafEditoru.ts");
  assert.match(k, /kok\.addEventListener\("keydown", \(e\) => \{ e\.stopPropagation\(\);/);
  assert.match(k, /kok\.addEventListener\("keyup", \(e\) => e\.stopPropagation\(\)\)/);
  assert.match(k, /kok\.addEventListener\("keypress", \(e\) => e\.stopPropagation\(\)\)/);
});

test("BEKÇİ (tuş sızıntısı): odak dışarıdayken pencere yakalayıcısı tuşu yutar; açılınca kurulur, gizlenince kaldırılır (keydown ve keyup)", () => {
  const k = oku("grafEditoru.ts");
  const yakala = k.slice(k.indexOf("const yakala = (e: KeyboardEvent)"), k.indexOf("};", k.indexOf("const yakala = (e: KeyboardEvent)")));
  assert.match(yakala, /e\.stopImmediatePropagation\(\);/);
  for (const tur of ["keydown", "keyup"]) {
    assert.match(k, new RegExp(`addEventListener\\("${tur}", yakala, \\{ capture: true \\}\\)`));
    assert.match(k, new RegExp(`removeEventListener\\("${tur}", yakala, \\{ capture: true \\}\\)`));
  }
});

test("BEKÇİ (kirli sekme): ✕ kapatmayı modele SORAR — onay yalnız aynı sekmenin ikinci tıkında verilir", () => {
  const k = oku("sekmeSeridi.ts");
  const cagrilar = [...k.matchAll(/a\.sekmeler\.kapat\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(cagrilar, ["s.ad, onayBekleyen === s.ad"]);
});
