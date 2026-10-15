// uygulama/senaryolar/gozlemdene.ts — `3dorion.bat gozlemdene`: GÖZ MUAYENESİ canlıda (Ozyn, 2026-10-15): Orion'un gözünden kare → yerel görme modeli → panel.
//
// Gerçek yerel görme modeli (varsayılan gemma4:e4b, `?goz=` ile değişir) KULLANILIR: Ollama ayakta ve model kurulu olmalı. Soğuk yükleme 14–16 sn sürer (zaman
// aşımı 30 sn). Sonuç satırları `[GOZLEMDENE] GECTI/KALDI …`; cevabın KENDİSİ de yazılır (içeriğin doğruluğuna insan BAKAR: bu senaryo "cevap geldi ve
// anlamlı uzunlukta" der, "doğru" demez). Ekran görüntüsü (ORION_SS) sonunda alınır: panel açık, önizleme ve cevap görünür.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[GOZLEMDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };

  await bekle(2500);
  if (!(await d.ovayaCik())) { log("birleşik dünya kurulamadı"); return; }
  await bekle(2000);

  const t0 = Date.now();
  const k = await d.gozlem.bak();
  kontrol("kare çekildi ve model cevap verdi", !!k, k ? `${k.model} · model ${k.ms} ms · toplam ${Date.now() - t0} ms` : "cevap yok (Ollama/model? panelde hata yazılı)");
  if (k) {
    kontrol("önizleme karesi dolu (PNG)", k.png.length > 5000, `${k.png.length} bayt, ${k.en}×${k.boy}`);
    kontrol("cevap anlamlı uzunlukta (≥ 40 karakter)", k.metin.length >= 40, `${k.metin.length} karakter`);
    log(`CEVAP: ${k.metin}`);
  }
  kontrol("bakış bitince çalışma kilidi açıldı (beyin kapısı serbest)", !d.gozlem.suruyor());
  await bekle(1200);
  console.log(`[GOZLEMDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
}
