// tools/ani-politikasi-olc.ts — Hafıza giriş politikasını (mind/aniSuzgeci.ts) bir hafıza dosyasının KOPYASINA uygular ve sayar.
//
// Kullanım: node --experimental-strip-types tools/ani-politikasi-olc.ts [hafiza.json] [--liste]
// SALT OKUMA: hafıza dosyasına yazmaz. Ön-kayıt 001 H6 ölçümü (vault forum/orion-beyin0fis/kanit/on-kayit-001.md).
"use strict";
import { readFileSync } from "node:fs";
import { aniKaydi, KOMUT_ONEMI } from "../mind/aniSuzgeci.ts";
import type { Ani } from "../mind/hafiza.ts";
import type { Algi } from "../protocol/algi.ts";

const yol = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? `${process.env["APPDATA"]}/3dorion/orion-hafiza.json`;
const liste = process.argv.includes("--liste");
const ham = JSON.parse(readFileSync(yol, "utf8")) as Ani[] | { kayitlar: Ani[] };
const aniler = Array.isArray(ham) ? ham : ham.kayitlar;

const sozMetni = (m: string) => m.replace(/^Ozyn said: "?/, "").replace(/"$/, "");
let toplamSoz = 0, dusen = 0, komut = 0, normal = 0;
const dusenler: string[] = [], komutlar: string[] = [];
const dersler = new Map<string, number>();
let dersToplam = 0;
for (const a of aniler) {
  if (a.tur === "konusma") {
    toplamSoz++;
    const algi: Algi = { tur: "duydum", metin: sozMetni(a.metin), kesin: true };
    const k = aniKaydi(algi, "konusma", algi.metin);
    if (!k) { dusen++; dusenler.push(algi.metin); }
    else if (k.onem === KOMUT_ONEMI) { komut++; komutlar.push(algi.metin); }
    else normal++;
  } else if (a.tur === "sonuc" && /^hata\b/.test(a.metin)) {
    dersToplam++;
    const algi: Algi = { tur: "sonuc", sonuc: { niyet_id: "x", durum: "hata", not: a.metin.replace(/^hata:\s*/, "") } };
    const k = aniKaydi(algi, "sonuc", a.metin)!;
    dersler.set(k.icerik, (dersler.get(k.icerik) ?? 0) + 1);
  }
}
const yuzde = (n: number, t: number) => (t ? `%${((100 * n) / t).toFixed(1)}` : "-");
console.log(JSON.stringify({
  dosya: yol, anilar: aniler.length, soz: toplamSoz,
  saklanmayan_selam: { adet: dusen, oran: yuzde(dusen, toplamSoz) },
  dusuk_onemli_komut: { adet: komut, oran: yuzde(komut, toplamSoz) },
  normal_onemli_soz: { adet: normal, oran: yuzde(normal, toplamSoz) },
  hata_dersi: { once: dersToplam, sonra_benzersiz: dersler.size },
}, null, 1));
if (liste) {
  console.log("--- saklanmayan:", dusenler);
  console.log("--- düşük önemle:", komutlar);
  console.log("--- dersler:", [...dersler.entries()]);
}
