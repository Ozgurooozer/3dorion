// uygulama/senaryolar/gordene.ts — `3dorion.bat gordene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── ONAY KAPISI denemesi (?onaydene=1) ────────────────────────────────────
// Dort iddiayi kanitlar:
//   1. Oneri ONAYSIZ calismaz (terminale hicbir sey gitmez)
//   2. Ret, komutu calistirmaz ve gerekce beyne geri doner
//   3. Onay, komutu GERCEKTEN calistirir
//   4. Bekleyen oneri EZILEMEZ
// ── ALGI HİZMETİ denemesi (?gordene=1) ────────────────────────────────────
// "Orion odayı görebiliyor mu?" sorusunun KANITI.
//
// Sınanan şey cevabın varlığı değil, KONUMA BAĞLI olması: aynı soru farklı
// yerlerden farklı cevap vermeli. Vermiyorsa görüş kısıtı sahtedir ve elimizde
// yalnızca süslenmiş bir veri dökümü var demektir.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import type { Niyet } from "../../protocol/niyet.ts";
import type { Soru } from "../../mind/algiHizmeti.ts";
import { BUTCE } from "../../mind/algiHizmeti.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { niyetiYurut, algiSor } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(2500);   // avatar yüklensin

  const sorular: Soru[] = ["onumde", "yakin", "oyuncu", "dunya"];
  const oku = () => sorular.map((q) => `${q}: ${algiSor(q).metin}`);
  // Bakış da ölçülür: `onumde` cevabı doğrudan buna bağlı, yani yanlış
  // görünen bir algı cevabı aslında yanlış BAKIŞ olabilir.
  const bakisOku = (): string => {
    const b = (d.orion as Avatar | null)?.durum().bakis;
    return b ? `${b.x.toFixed(2)},${b.z.toFixed(2)}` : "yok";
  };

  // 1) Masanın başında.
  niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "masa" } } as Niyet, "gor_1");
  await bekle(5000);
  const masada = oku();
  console.log(`[GORDENE] masada bakis=${bakisOku()}`);
  for (const r of masada) console.log(`[GORDENE] masada  ${r}`);

  // 2) Tahtanın önünde — odanın öbür ucu.
  niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "tahta" } } as Niyet, "gor_2");
  await bekle(4500);
  const varista = bakisOku();
  await bekle(9000);
  const sonra = bakisOku();
  console.log(`[GORDENE] bakis varista=${varista} 9sn-sonra=${sonra} `
    + `→ ${varista === sonra ? "SABIT" : "DEGISTI (boşta davranışı sürüyor)"}`);
  const tahtada = oku();
  for (const r of tahtada) console.log(`[GORDENE] tahtada ${r}`);

  const degisen = masada.filter((m, i) => m !== tahtada[i]).length;
  console.log(`[GORDENE] ${degisen > 0 ? "GECTI" : "KALDI"} `
    + `cevap konuma bagli (${degisen}/${sorular.length} soru degisti)`);

  // Bütçe denetimi: hiçbir cevap tavanını aşmamalı.
  const asan = sorular.filter((q) => algiSor(q).maliyet > BUTCE[q]);
  console.log(`[GORDENE] ${asan.length === 0 ? "GECTI" : "KALDI"} `
    + `butce tavani korundu${asan.length ? ` (asan: ${asan.join(",")})` : ""}`);
}
