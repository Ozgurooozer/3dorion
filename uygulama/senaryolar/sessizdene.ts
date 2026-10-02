// uygulama/senaryolar/sessizdene.ts — `3dorion.bat sessizdene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── SESSIZ BASARI denemesi (?sessiz=1) ────────────────────────────────────
// OSC 133'un asil kazanimini kanitlar: cikti URETMEYEN ama zaman alan bir
// komut bittiginde Orion bunu BILIR. Kod+sure olmadan bu bilgi tamamen
// gorunmezdi (`tsc --noEmit` temiz gecince 0 satir yazar).
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Kopru } from "../../bridge/kopru.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { monitor, monitoreGec } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const gorulen: { ozet: string; terfi: boolean }[] = [];
  window._goruKanca =
    (b, t) => { gorulen.push({ ozet: b, terfi: t }); };

  await bekle(1200);
  await monitoreGec();
  await bekle(1500);
  const basta = gorulen.length;

  // 1) ANLIK ve sessiz: bildirilmemeli.
  monitor.yaz("$null = 1\r");
  await bekle(2500);
  const anlik = gorulen.slice(basta);
  console.log(`[SESSIZDENE] anlik sessiz komut: blok=${anlik.length} terfi=${anlik.filter((g) => g.terfi).length} (beklenen 0 terfi)`);
  const ortada = gorulen.length;

  // 2) UZUN ve sessiz: bildirilmeli. Start-Sleep cikti uretmez.
  monitor.yaz("Start-Sleep -Milliseconds 1600\r");
  await bekle(4000);
  const uzun = gorulen.slice(ortada);
  console.log(`[SESSIZDENE] uzun sessiz komut: blok=${uzun.length} terfi=${uzun.filter((g) => g.terfi).length} (beklenen >=1 terfi)`);
  const k = d.kopru as Kopru | null;
  console.log(`[SESSIZDENE] sayac=${JSON.stringify(k?.sayac() ?? null)}`);
}
