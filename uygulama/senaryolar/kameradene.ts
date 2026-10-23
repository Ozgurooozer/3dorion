// uygulama/senaryolar/kameradene.ts — `3dorion.bat kameradene`: sekans kamerası (spec 38 §7) GERÇEK sahnede: isimli kameralar eklenir, kesmeler konur, önizleme kamerayı
// gerçekten taşır mı, ▶ oynarken kamera kesmelere göre gezer mi, bitince oyuncunun kendi kamerasına döner mi.
//
// Birim testler biçimi, değerlendirmeyi (kareye göre poz, harman) ve oynatıcıyı ölçer; kadrajın GÖRÜNÜŞÜ ve editör paneli yalnız görüntüyle anlaşılır. Kareler
// `[KLIPSS] <ad>` satırıyla alınır (ana süreç ORION_SS_DIR'e PNG yazar).
//   C0  Orion ve örnek hazır, editör açıldı     C1  Kamera sekmesinden iki kamera eklendi (Orion karşısı, Orion yanı) — gerçek düğmelere tıklanarak
//   C2  kesmeler eklendi (kare 0 → kamera 1, kare 45 → kamera 2, yumuşak)        C3  önizleme: playhead 10'da kamera 1, 80'de kamera 2 konumunda
//   C4  ▶ sırasında kamera kamera 1'den 2'ye gider; bitince oyuncuya döner       C5  yalnız kamera kesmeli (hareketsiz) sekans oynar ve biter
// Görsel karar insana/denetçiye ait: senaryo kareleri üretir, "doğru görünüyor" demez.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import { orionuKarsiyaAl } from "../senaryoSahnesi.ts";
import { kesmeEkle } from "../sekans/editor/kameraIslemleri.ts";
import { sekansDogrula, type Nokta3 } from "../../protocol/sekans.ts";

const uzaklik = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[KAMERADENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const kare = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(250); };
  const bitir = () => console.log(`[KAMERADENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
  const bitene = async (enCokMs: number) => { const son = performance.now() + enCokMs; while (d.sekans.durum().calisiyor && performance.now() < son) await bekle(100); };
  const kamPoz = (): Nokta3 => [d.rig.kamera.position.x, d.rig.kamera.position.y, d.rig.kamera.position.z];
  /** Panelde yazısı `metin`i içeren düğmeye (gerçek DOM) tıkla. */
  const tikla = (metin: string): boolean => {
    const b = [...document.querySelectorAll<HTMLButtonElement>(".kp-kok button")].find((x) => (x.textContent ?? "").includes(metin) && !x.disabled);
    b?.click();
    return !!b;
  };

  await bekle(3000);
  await d.sekans.hazir();
  const orion = d.orion;
  const ornek = d.sekans.ornekler().find((s) => s.ad === "kimodo_el_salla");
  kontrol("C0 Orion ve kimodo_el_salla hazır", !!orion && !!ornek);
  if (!orion || !ornek) { bitir(); return; }
  await orionuKarsiyaAl(d, "kameradene");
  d.rig.odakBirak();
  await bekle(1200);
  const oyuncuPoz = kamPoz();
  await kare("00_oyuncu_gorunumu");

  const ad = await d.sekans.ornegiAc("kimodo_el_salla");
  const oturum = d.sekans.editor.etkinOturum();
  kontrol("C0b editör açıldı (kopya)", !!ad && !!oturum, `ad=${ad ?? "yok"}`);
  if (!oturum) { bitir(); return; }
  d.sekans.editor.yanSekmeAc("kamera");
  await bekle(800);

  // C1: gerçek düğmelere tıkla.
  const t1 = tikla("Orion'un karşısı");
  await bekle(300);
  const t2 = tikla("Orion'un yanı");
  await bekle(300);
  const s1 = oturum.sekans();
  kontrol("C1 Kamera sekmesinden iki kamera eklendi", t1 && t2 && (s1.kameralar ?? []).length === 2, `düğmeler=${t1},${t2} · kamera=${(s1.kameralar ?? []).map((k) => `${k.ad}[${k.konum.map((v) => Math.round(v * 10) / 10).join(",")}]`).join(" ")}`);
  await kare("01_kamera_sekmesi");
  const [k1, k2] = [s1.kameralar?.[0], s1.kameralar?.[1]];
  if (!k1 || !k2) { bitir(); return; }

  // C2: kesmeler (API; zaman çizelgesi sürüklemesi canlı insan denemesi).
  let yeni = kesmeEkle(oturum.sekans(), 0, k1.id);
  if (yeni.ok) yeni = kesmeEkle(yeni.deger, 45, k2.id, "yumusak", 20);
  if (yeni.ok) oturum.uygula(yeni, "kesmeler eklendi");
  d.sekans.editor.tazele();
  const s2 = sekansDogrula(oturum.sekans());
  kontrol("C2 kesmeler eklendi (kare 0 → 1. kamera, kare 45 → 2. kamera yumuşak)", yeni.ok && s2.ok && (oturum.sekans().kesmeler ?? []).length === 2, yeni.ok ? "" : yeni.hata);
  await bekle(500);
  await kare("02_kesmeler_cizelgede");

  // C3: önizleme (Kamera sekmesindeki seçim kutusu: "Sekansın kamerası (playhead)").
  const sec = document.querySelector<HTMLSelectElement>(".kp-kok select");
  if (sec) { sec.value = "sekans"; sec.dispatchEvent(new Event("change")); }
  oturum.kareyeGit(10); d.sekans.editor.tazele(); await bekle(500);
  const p10 = kamPoz();
  await kare("03_onizleme_kare10");
  oturum.kareyeGit(80); d.sekans.editor.tazele(); await bekle(500);
  const p80 = kamPoz();
  await kare("04_onizleme_kare80");
  kontrol("C3 önizleme kamerayı taşıdı: kare 10 → 1. kamera, kare 80 → 2. kamera konumu (±5 cm)", !!sec && uzaklik(p10, k1.konum) < 0.05 && uzaklik(p80, k2.konum) < 0.05,
    `kare10 ${uzaklik(p10, k1.konum).toFixed(3)} m, kare80 ${uzaklik(p80, k2.konum).toFixed(3)} m uzakta (sec=${!!sec})`);

  // C4: ▶ sırasında kamera gezer; bitince oyuncuya döner. Önizleme kapatılır (oynatma kendi kaynağını kullanır).
  if (sec) { sec.value = "kapali"; sec.dispatchEvent(new Event("change")); }
  await bekle(500);
  const sonrakiOyuncu = kamPoz();
  oturum.kareyeGit(0); d.sekans.editor.tazele();
  const t0 = performance.now();
  const r = d.sekans.oynat(oturum.sekans(), { baslangic: 0, dongu: false });
  await bekle(250);
  const pBas = kamPoz();
  await bekle(1100);
  await kare("05_oynarken_gecis");
  // Yumuşak geçiş kare 45 + 20 = 65'te biter (2,17 sn); sekans 89 kare (2,97 sn): ölçüm 2,5. saniyede, oynatma bitmeden.
  const kalanMs = 2500 - (performance.now() - t0);
  if (kalanMs > 0) await bekle(kalanMs);
  const pSon = kamPoz();
  await bitene(6000);
  await bekle(300);
  kontrol("C4 ▶ sırasında kamera 1. kameradan 2. kameraya gitti", r.ok && uzaklik(pBas, k1.konum) < 0.3 && uzaklik(pSon, k2.konum) < 0.3, r.ok ? `başta ${uzaklik(pBas, k1.konum).toFixed(2)} m (1. kamera), sonda ${uzaklik(pSon, k2.konum).toFixed(2)} m (2. kamera)` : r.neden);
  await kare("06_oynatma_bitti");
  await bekle(1500);
  const geriPoz = kamPoz();
  kontrol("C4b oynatma bitince kamera oyuncuya döndü (2. kameradan uzak)", !d.rig.sekansKamerasiAktif && uzaklik(geriPoz, k2.konum) > 0.5 && uzaklik(geriPoz, sonrakiOyuncu) < 0.6,
    `aktif=${d.rig.sekansKamerasiAktif} · 2. kameradan ${uzaklik(geriPoz, k2.konum).toFixed(2)} m · oyuncu görünümüne ${uzaklik(geriPoz, sonrakiOyuncu).toFixed(2)} m (ilk oyuncu poz ${uzaklik(oyuncuPoz, sonrakiOyuncu).toFixed(2)} m)`);

  // C5: yalnız kamera kesmeli, hareketsiz sekans oynar ve biter.
  const bos = sekansDogrula({ surum: 1, ad: "kamera_denemesi", fps: 30, sure_kare: 60, baglamalar: [{ id: "b1", ajan: "orion" }], izler: [], kameralar: oturum.sekans().kameralar, kesmeler: [{ kare: 0, kamera: k1.id }, { kare: 30, kamera: k2.id }] });
  if (bos.ok) {
    const r5 = d.sekans.oynat(bos.deger, { baslangic: 0, dongu: false });
    await bitene(4000);
    const son = d.sekans.durum().son;
    kontrol("C5 yalnız kamera kesmeli sekans oynar ve 'bitti' olur", r5.ok && son?.sekans === "kamera_denemesi" && son.durum === "bitti", r5.ok ? `son=${son?.durum ?? "yok"}${son?.neden ? ` (${son.neden})` : ""}` : r5.neden);
  } else kontrol("C5 yalnız kamera kesmeli sekans oynar", false, bos.hata);

  d.sekans.editor.gizle();
  await bekle(500);
  d.rig.odakBirak();
  bitir();
}
