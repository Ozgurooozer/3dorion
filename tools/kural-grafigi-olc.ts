// tools/kural-grafigi-olc.ts — Kural grafiği ölçümü (Markov hafıza aşama 2, docs/olcum/on-kayit-markov-hafiza-2.md: G1–G4, G6).
// GERÇEK kural tablosunun `grafik()`i üç tuval boyutunda yerleşir; canvas yerine kayıt tutan sahte bağlam çizer.
// Koşu: node --experimental-strip-types tools/kural-grafigi-olc.ts   (çıkış kodu 0 = hepsi geçti)
"use strict";
import { grafik, VARSAYILAN_TABLO } from "../mind/hafizaKurallari.ts";
import { kuralYerlesimi, cizKuralGrafigi } from "../world/surfaces/duvar/kuralGrafigi.ts";

const BOYUTLAR: readonly [number, number][] = [[1024, 512], [910, 512], [640, 360]];
const g = grafik();
const kuralSayisi = VARSAYILAN_TABLO.flatMap((x) => x.kurallar).length;
let basarisiz = 0;
const kontrol = (ad: string, tamam: boolean, ayrinti = "") => { console.log(`${tamam ? "GECTI" : "KALDI"}  ${ad}${ayrinti ? " — " + ayrinti : ""}`); if (!tamam) basarisiz++; };

for (const [w, h] of BOYUTLAR) {
  const alan = { x: 10, y: 50, g: w - 20, yuk: h - 50 - 55 };
  const y = kuralYerlesimi(g, alan);
  // G1
  const ids = y.kutular.map((k) => k.id).sort(), beklenen = g.dugumler.map((d) => d.id).sort();
  let kesisen = 0;
  for (let i = 0; i < y.kutular.length; i++) for (let j = i + 1; j < y.kutular.length; j++) {
    const a = y.kutular[i]!, b = y.kutular[j]!;
    if (a.x < b.x + b.g && b.x < a.x + a.g && a.y < b.y + b.yuk && b.y < a.y + a.yuk) kesisen++;
  }
  const disarda = y.kutular.filter((k) => k.x < alan.x - 0.5 || k.y < alan.y - 0.5 || k.x + k.g > alan.x + alan.g + 0.5 || k.y + k.yuk > alan.y + alan.yuk + 0.5).length;
  kontrol(`G1 ${w}×${h}`, JSON.stringify(ids) === JSON.stringify(beklenen) && kesisen === 0 && disarda === 0, `kutu=${y.kutular.length} kesisen=${kesisen} disarda=${disarda}`);
  // G2
  const kutu = new Map(y.kutular.map((k) => [k.id, k]));
  const yakin = (k: { x: number; y: number; g: number; yuk: number }, p: { x: number; y: number }) => p.x >= k.x - 0.5 && p.x <= k.x + k.g + 0.5 && p.y >= k.y - 0.5 && p.y <= k.y + k.yuk + 0.5;
  const kotuOk = y.oklar.filter((o) => !yakin(kutu.get(o.kimden)!, o.noktalar[0]!) || !yakin(kutu.get(o.kime)!, o.noktalar[o.noktalar.length - 1]!)).length;
  kontrol(`G2 ${w}×${h}`, y.oklar.length === g.kenarlar.length && kotuOk === 0, `ok=${y.oklar.length}/${g.kenarlar.length} ucu_disarida=${kotuOk}`);

  // G6 + sayım: sahte bağlamla çiz, bölgelere bak.
  const metinler: { s: string; x: number }[] = [];
  const sahte = new Proxy({ textAlign: "left", font: "10px mono" } as Record<string, unknown>, {
    get(t, k: string) {
      if (k === "measureText") return (s: string) => ({ width: s.length * 6.2 });
      if (k === "fillText") return (s: string, x: number) => { metinler.push({ s, x }); };
      return k in t ? t[k] : () => undefined;
    },
    set(t, k: string, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  const bolgeler = cizKuralGrafigi(sahte, { genislik: w, yukseklik: h }, { grafik: g, secili: g.dugumler.find((d) => d.tur === "kural")!.id });
  const islemler = [...new Set(bolgeler.map((b) => b.islem))].sort();
  const kuralBolge = bolgeler.filter((b) => b.islem === "kural").length;
  kontrol(`G3/G6 ${w}×${h}`, kuralBolge === kuralSayisi && islemler.join() === "gorunum,kural", `kural_bolgesi=${kuralBolge}/${kuralSayisi} islemler=${islemler.join("+")}`);
}
process.exit(basarisiz ? 1 : 0);
