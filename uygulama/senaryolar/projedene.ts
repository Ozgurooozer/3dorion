// uygulama/senaryolar/projedene.ts — `3dorion.bat projedene` (spec 39 D1): motor ve proje ayrı mı, dünya projeden mi kuruluyor.
//
// Ölçülenler, hepsi SONUÇ olarak:
//   P1  ana süreç açık bir proje bildirir (`projeBilgi`).
//   P2  senaryo koşusunun projesi GEÇİCİ kökte (`3dorion-projeler-deneme`): Belgeler'deki gerçek projeye yazılmaz.
//   P3  projenin varsayılan level'ı projenin `Content/Levels`ından okunur ve geçerli JSON'dur (repodaki şablonun kopyası).
//   P4  birleşik dünya kurulur (Ozyn'in yeri artık "oda" değil): oyun level'ı projeden aldı.
//   P5–P8  (D2) proje tarayıcısı kanalları: liste, yeni (şablonlar, hata kodları), aç (senaryoda yeniden başlatmaz).
//   P9–P13 (D2) pencere tepesindeki ana menü şeridi: editör açılınca konum/--editor-ust, menü birleşimi, Dosya menüsü, Proje aç… penceresi; kareler ORION_SS_DIR'e PNG.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[PROJEDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const bitir = () => console.log(`[PROJEDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);

  const k = window.kopru;
  const b = await k.projeBilgi();
  const p = b.ok ? b.deger : null;
  kontrol("P1 açık proje var", !!p, p ? `${p.ad} · ${p.dizin}` : (b.ok ? "deger=null" : `${b.kod}: ${b.mesaj}`));
  if (!p) { bitir(); return; }
  kontrol("P2 senaryo projesi geçici kökte (gerçek projeye yazılmaz)", p.kok.includes("3dorion-projeler-deneme"), `kök=${p.kok}`);

  const r = await k.projeLevelOku(p.varsayilanLevel);
  let gecerli = false, ek = r.ok ? "" : `${r.kod}: ${r.mesaj}`;
  if (r.ok) { try { const t = JSON.parse(r.deger) as Record<string, unknown>; gecerli = typeof t === "object" && t !== null; ek = `${r.deger.length} bayt · anahtarlar: ${Object.keys(t).slice(0, 6).join(",")}`; } catch (e) { ek = `JSON değil: ${String(e)}`; } }
  kontrol(`P3 level '${p.varsayilanLevel}' projeden okunur`, gecerli, ek);

  let yer = d.yerler().ozyn.ad;
  for (let t = 0; t < 30_000 && yer === "oda"; t += 250) { await bekle(250); yer = d.yerler().ozyn.ad; }
  kontrol("P4 birleşik dünya kuruldu (projenin level'ıyla)", yer !== "oda", `yer=${yer} · nesne ${d.yerler().ozyn.nesneler.length}`);

  // ── D2: proje tarayıcısı kanalları ──
  const l1 = await k.projeListe();
  kontrol("P5 liste: açık proje işaretli ve listede", l1.ok && l1.deger.acik === p.ad && l1.deger.projeler.some((x) => x.ad === p.ad && x.acik), l1.ok ? `acik=${l1.deger.acik} · ${l1.deger.projeler.length} proje` : `${l1.kod}`);
  // Geçici kök koşular arasında KALIR: her koşuda benzersiz ad (yoksa ikinci koşuda 'var' çıkar); P8'in sonunda son açılan açık projeye geri döner.
  const yeniAd = `Deneme ${Date.now().toString(36)}`;
  const y1 = await k.projeYeni(yeniAd, "bos");
  const l2 = await k.projeListe();
  kontrol("P6 yeni proje (boş ova şablonu) oluştu ve listede", y1.ok && l2.ok && l2.deger.projeler.some((x) => x.ad === yeniAd && !x.hata), y1.ok ? y1.deger.dizin : `${y1.kod}: ${y1.mesaj}`);
  const y2 = await k.projeYeni(yeniAd, "bos"), y3 = await k.projeYeni("../kacak", "ofis"), y4 = await k.projeYeni("Baska", "yok" as never);
  kontrol("P7 aynı ad 'var', yol kaçışı 'gecersiz-ad', bilinmeyen şablon 'gecersiz-sablon'", !y2.ok && y2.kod === "var" && !y3.ok && y3.kod === "gecersiz-ad" && !y4.ok && y4.kod === "gecersiz-sablon",
    `${y2.ok ? "ok" : y2.kod} · ${y3.ok ? "ok" : y3.kod} · ${y4.ok ? "ok" : y4.kod}`);
  const a1 = await k.projeAc(yeniAd), a2 = await k.projeAc("Yok Boyle"), a3 = await k.projeAc(p.ad);   // a3: son açılan tekrar açık proje (sonraki koşu aynı projeyle başlar)
  kontrol("P8 aç: senaryoda yeniden BAŞLATMAZ, olmayan 'yok', açık olan 'zaten açık'", a1.ok && !a1.deger.yeniden && !a2.ok && a2.kod === "yok" && a3.ok && !a3.deger.yeniden && a3.deger.neden === "zaten açık",
    `${a1.ok ? a1.deger.neden : a1.kod} · ${a2.ok ? "ok" : a2.kod} · ${a3.ok ? a3.deger.neden : a3.kod}`);

  // ── D2: pencere tepesindeki ana menü şeridi (editör açılınca menüleri birleşir) ──
  const ss = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(400); };
  await d.sekans.hazir();
  const acilan = await d.sekans.ornegiAc("selamlasma");
  await bekle(600);
  const serit = document.querySelector<HTMLElement>(".kb-ustserit");
  const sr = serit?.getBoundingClientRect();
  const dugmeler = [...(serit?.querySelectorAll(".kb-menu-dugme") ?? [])].map((x) => x.textContent ?? "");
  const tuval = document.getElementById("tuval")?.getBoundingClientRect();
  kontrol("P9 ana şerit pencerenin TEPESİNDE, görünür; --editor-ust yazıldı; tuval şeridin altından başlıyor",
    !!acilan && serit?.dataset.acik === "1" && !!sr && sr.top === 0 && sr.height >= 28 && !!tuval && tuval.top >= sr.height - 1 && document.documentElement.style.getPropertyValue("--editor-ust") === "30px",
    `şerit top=${sr?.top} h=${sr?.height} · tuval top=${tuval?.top}`);
  kontrol("P10 menüler BİRLEŞİK: editörün Dosya/Düzen/… + uygulamanın Pencere; Yardım SON", dugmeler.join(",") === "Dosya,Düzen,Görünüm,Oynat,Ekle,Rig,Pencere,Yardım", dugmeler.join(","));
  await ss("01_ust_serit");
  const dosya = [...(serit?.querySelectorAll<HTMLElement>(".kb-menu-dugme") ?? [])].find((x) => x.textContent === "Dosya");
  dosya?.click(); await bekle(300);
  const liste = [...(serit?.querySelectorAll(".kb-menu[data-acik='1'] .kb-oge-ad") ?? [])].map((x) => x.textContent ?? "");
  kontrol("P11 Dosya menüsü: editörün satırları + Yeni proje…/Proje aç…", liste.includes("Kaydet") && liste.includes("Yeni proje…") && liste.includes("Proje aç…") && liste.indexOf("Kaydet") < liste.indexOf("Yeni proje…"), liste.join(" | "));
  await ss("02_dosya_menusu");
  const satir = [...(serit?.querySelectorAll<HTMLElement>(".kb-menu[data-acik='1'] .kb-oge") ?? [])].find((x) => x.querySelector(".kb-oge-ad")?.textContent === "Proje aç…");
  satir?.click(); await bekle(800);
  const pen = document.querySelector<HTMLElement>(".pp-kok");
  const kartlar = pen?.querySelectorAll(".pp-kart").length ?? 0;
  const acikKart = pen?.querySelector<HTMLElement>(".pp-kart[data-acik='1'] .pp-ad")?.textContent;
  kontrol("P12 Proje aç… tarayıcıyı açar: proje kartları (açık olan işaretli)", pen?.dataset.acik === "1" && kartlar >= 2 && acikKart === p.ad, `kart=${kartlar} açık=${acikKart}`);
  await ss("03_proje_penceresi");
  pen?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await bekle(200);
  kontrol("P13 Esc proje tarayıcısını kapatır", pen?.dataset.acik === "0");
  d.sekans.editor.gizle(); await bekle(300);
  bitir();
}
