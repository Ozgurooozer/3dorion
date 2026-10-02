// uygulama/senaryolar/otodene.ts — `3dorion.bat otodene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── Otomatik entegrasyon denemesi (?otodene=1) ─────────────────────────────
// Ozyn'in elle bulduğu üç hatayı bir daha geri gelmesinler diye kilitler.
// Gerçek klavye/fare olaylarıyla, gerçek sahnede koşar.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import { EtkilesimOlaylari } from "../../world/player/etkilesim.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { saat, rig, oyuncu } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuclar: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuclar.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

  await bekle(1500);

  // 1) Orion GÖRSEL olarak hareket ediyor mu? (mantık değil, mesh)
  // TS, .then içindeki atamayı göremediği için orion'u null sanıyor; yerel al.
  const o = d.orion as Avatar | null;
  if (!o) { kontrol("avatar yuklendi", false); }
  else {
    const once = o.cizimKonumu();
    o.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "dene_git");
    await bekle(2500);
    const sonra = o.cizimKonumu();
    const yol = Math.hypot(sonra.x - once.x, sonra.z - once.z);
    kontrol("orion gorsel olarak hareket etti", yol > 0.5,
      `yol=${yol.toFixed(2)}m mantik=${o.durum().konum.x.toFixed(2)},${o.durum().konum.z.toFixed(2)}`);
  }

  // 2) Terminale gir — E tuşunun yaptığı akışın AYNISI: önce etkileşim
  //    yayıcıya kaydolur, sonra monitöre geçilir. (Doğrudan monitoreGec()
  //    çağırmak gerçek akışı atlar ve Esc'in kapatacağı bir şey kalmaz.)
  EtkilesimOlaylari.baslat({
    capa: "monitor", eylem: "odaklan", t: saat.t,
    kaynak: oyuncu.oyuncuDurumu().konum,
  });
  await bekle(900);
  const odakOnce = rig.odakta;
  for (let i = 0; i < 10; i++) {
    dispatchEvent(new MouseEvent("mousemove", { movementX: 40, movementY: 25, bubbles: true }));
  }
  await bekle(300);
  kontrol("fare oynayinca terminal odagi korunuyor", odakOnce && rig.odakta,
    `odakOnce=${odakOnce} odakSonra=${rig.odakta}`);

  // 3) TEXTAREA odaktayken Esc dunyaya ulasiyor mu? (hapsolma hatasi)
  const sahteAlan = document.createElement("textarea");
  document.body.appendChild(sahteAlan);
  sahteAlan.focus();
  sahteAlan.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  await bekle(400);
  kontrol("TEXTAREA odaktayken Esc cikis yapiyor",
    !rig.odakta && oyuncu.oyuncuDurumu().etkilesim === null,
    `odak=${rig.odakta} etkilesim=${oyuncu.oyuncuDurumu().etkilesim ?? "-"}`);
  sahteAlan.remove();

  // 4) Cikis sonrasi yurume yeniden calisiyor mu?
  const yurumeOnce = oyuncu.oyuncuDurumu().konum;
  dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w", bubbles: true }));
  await bekle(700);
  dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", key: "w", bubbles: true }));
  const yurumeSonra = oyuncu.oyuncuDurumu().konum;
  const gidilen = Math.hypot(yurumeSonra.x - yurumeOnce.x, yurumeSonra.z - yurumeOnce.z);
  kontrol("cikistan sonra oyuncu yeniden yuruyor", gidilen > 0.1, `yol=${gidilen.toFixed(2)}m`);

  for (const r of sonuclar) console.log("[OTODENE] " + r);
  console.log("[OTODENE] ozet: " +
    sonuclar.filter((r) => r.startsWith("GECTI")).length + "/" + sonuclar.length);
}
