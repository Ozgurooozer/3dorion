// uygulama/senaryolar/efektdene.ts — `3dorion.bat efektdene`: ışık/efekt zinciri ÇALIŞMA ANINDA bozulmuyor mu (Ozyn, 2026-10-15).
//
// Neden var: GI (GIRSM) çalışma anında açılınca Babylon'un yansıtıcı gölge haritası (RSM) 3 çıkışlı hedefe PARÇACIK sistemlerini de çiziyordu
// (`renderParticles = false` unutulmuştu): her karede `glDrawArraysInstanced: Active draw buffers with missing fragment shader outputs`,
// ekran bozuldu, Orion ve ofis duvarları kayboldu. Duman koşuları (kapidene, zihindene…) efektleri AÇILIŞTA kurduğu ve çoğu gece/içeride koştuğu
// için bunu hiç görmedi.
//
// Muayenenin kendisi ORION DOKTOR'dur (`uygulama/doktor.ts`): Ozyn "doktor" ya da "tam muayene" dediğinde Orion canlıda AYNISINI çalıştırır
// (token'sız). Bu senaryo yalnız onu duman koşusunda sürer: TAM muayene (her efekt + önayar, gündüz/gece; `gl.getError` + `mesh.isReady`).
// Birleşik dünyada ofis ova'nın içindedir (`odayaDon` yok): ayrı bir "ofiste" turu gerekmez, ortam her yerde aynı sahneye uygulanır.
// Sonuç satırları `[EFEKTDENE] GECTI/KALDI …`.
// Kural (CLAUDE.md): ışık/efekt zincirine (`world/level/stil/`) dokunan her değişiklik bu senaryodan geçer; tek KALDI bile kırmızıdır.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[EFEKTDENE] " + m);
  await bekle(2500);

  if (!(await d.ovayaCik())) { log("birleşik dünya kurulamadı"); return; }
  await bekle(1500);
  const r = await d.doktor.muayene("tam");
  for (const s of r.ayrinti) log(s);

  const kontroller = r.ayrinti.filter((s) => s.startsWith("GECTI") || s.startsWith("KALDI"));
  const kalan = kontroller.filter((s) => s.startsWith("KALDI")).length;
  log(`${r.ozet} | ${r.sureMs} ms`);
  console.log(`[EFEKTDENE] ${kalan === 0 && r.saglikli ? "GECTI" : "KALDI"} — ${kontroller.length - kalan}/${kontroller.length}`);
}
