// uygulama/senaryolar/grafdene.ts — `3dorion.bat grafdene`: Graf editörü yeni kabukta (spec 38 §6): menü çubuğu, araç çubuğu, Esc zinciri. Mantık (komutlar, kaydetme, çalıştırma
// güvenliği) değişmedi ve testli; yerleşimin GÖRÜNÜŞÜ yalnız görüntüyle anlaşılır. Kareler `[KLIPSS] <ad>` satırıyla alınır (ana süreç ORION_SS_DIR'e PNG yazar).
//   G0  kayıtlı bir grafik var ve editör açıldı     G1  menü çubuğunda 5 menü (Dosya, Düzen, Görünüm, Çalıştır, Yardım)
//   G2  her menü açılır ve satırları var            G3  bir menü satırı çalışır (Düzen · Tümünü seç) ve menüyü kapatır
//   G4  araç çubuğunda Kaydet, ▶ Çalıştır, ✕ var    G5  Esc önce açık menüyü kapatır (editör açık kalır), ikincisi editörü gizler
// Görsel karar insana/denetçiye ait: senaryo kareleri üretir, "doğru görünüyor" demez.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[GRAFDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const kare = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(250); };
  const bitir = () => console.log(`[GRAFDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
  const kok = () => document.querySelector<HTMLElement>(".ge-kok");
  const menuDugmeleri = () => [...document.querySelectorAll<HTMLButtonElement>(".ge-kok .kb-menu-dugme")];

  await bekle(3500);
  let adlar = d.graf.adlar();
  if (!adlar.length) { try { await d.graf.ornekOlustur(); await bekle(500); adlar = d.graf.adlar(); } catch (e) { log(`örnek yazılamadı: ${e instanceof Error ? e.message : String(e)}`); } }
  kontrol("G0 kayıtlı grafik var (yoksa geçici örnek yazıldı)", adlar.length > 0, `grafikler: ${adlar.join(", ") || "yok"}`);
  if (!adlar.length) { bitir(); return; }
  d.rig.odakBirak();
  await bekle(800);
  d.graf.ac(adlar[0]!);
  await bekle(1200);
  kontrol("G0b editör açıldı", d.graf.acikMi() && kok()?.dataset.acik === "1", `grafik=${adlar[0]}`);
  await kare("00_graf_editoru");

  const adlariMenu = menuDugmeleri().map((b) => b.textContent);
  kontrol("G1 menü çubuğunda 5 menü", adlariMenu.join(",") === "Dosya,Düzen,Görünüm,Çalıştır,Yardım", `menüler=${adlariMenu.join(",")}`);

  for (const [i, ad] of ["Dosya", "Düzen", "Görünüm", "Çalıştır", "Yardım"].entries()) {
    const b = menuDugmeleri().find((x) => x.textContent === ad);
    b?.click();
    await bekle(250);
    const acik = document.querySelector<HTMLElement>(".ge-kok .kb-menu[data-acik=\"1\"]");
    const satir = acik?.querySelectorAll(".kb-oge").length ?? 0;
    kontrol(`G2 '${ad}' menüsü açılır ve satırları var`, !!acik && satir > 0, `satır=${satir}`);
    if (i < 2) await kare(`0${i + 1}_menu_${ad}`);
  }
  menuDugmeleri()[0]?.click();   // Yardım açıkken Dosya'ya geç, sonra kapat
  await bekle(150);

  // G3: Düzen · Tümünü seç çalışır, menü kapanır.
  menuDugmeleri().find((x) => x.textContent === "Düzen")?.click();
  await bekle(200);
  const secilecek = [...document.querySelectorAll<HTMLElement>(".ge-kok .kb-oge")].find((x) => (x.textContent ?? "").includes("Tümünü seç"));
  secilecek?.click();
  await bekle(250);
  kontrol("G3 menü satırı çalıştı ve menü kapandı", !!secilecek && !document.querySelector(".ge-kok .kb-menu[data-acik=\"1\"]"), `satır bulundu=${!!secilecek}`);
  await kare("03_tumunu_sec");

  // G4: araç çubuğu.
  const dugmeler = [...document.querySelectorAll<HTMLButtonElement>(".ge-kok .kb-aracsatiri button")].map((b) => b.textContent ?? "");
  kontrol("G4 araç çubuğunda Kaydet, ▶ Çalıştır ve ✕ var", dugmeler.some((t) => t.includes("Kaydet")) && dugmeler.some((t) => t.includes("Çalıştır")) && dugmeler.includes("✕"), `düğmeler=${dugmeler.join(" | ")}`);

  // G5: Esc zinciri.
  menuDugmeleri().find((x) => x.textContent === "Dosya")?.click();
  await bekle(200);
  const esc = () => kok()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
  esc();
  await bekle(200);
  const menuKapandi = !document.querySelector(".ge-kok .kb-menu[data-acik=\"1\"]"), hala = d.graf.acikMi();
  esc();
  await bekle(300);
  kontrol("G5 Esc önce menüyü kapatır (editör açık kalır), ikinci Esc editörü gizler", menuKapandi && hala && !d.graf.acikMi(), `menüKapandı=${menuKapandi} · ilkEsctenSonraAçık=${hala} · ikinciEsctenSonraAçık=${d.graf.acikMi()}`);
  if (d.graf.acikMi()) d.graf.gizle();
  await bekle(300);
  bitir();
}
