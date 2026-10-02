// uygulama/senaryolar/apidene.ts — `3dorion.bat apidene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── API denemesi (?apidene=1, spec 13 Faz 3) ──────────────────────────────
// Zincir uçtan uca, sahte yerel sunucuyla (tools/sahte-api.mjs): anahtar ana sürece
// kaydedilir (şifreli depo, ayrı dosya) → renderer durumda anahtarı GÖRMEZ → modeller
// taranır → model seçilir → Ozyn konuşur → istek ana süreçten başlıkla gider → Orion
// API'nin sözünü söyler.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Kopru } from "../../bridge/kopru.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);
  const ANAHTAR = "apidene-sahte-anahtar";
  const MODEL = "api:ozel/sahte/orion-test";
  await bekle(2500);
  const om = (globalThis as unknown as { orionModel?: {
    tara(): Promise<void>; secenekVarMi(ad: string): boolean; iste(ad: string): void; aktif(): string;
  } }).orionModel;
  if (!om || typeof window.kopru?.apiKaydet !== "function") { console.log("[APIDENE] KALDI seçici ya da köprü yok"); return; }

  const k = await window.kopru.apiKaydet("ozel", "http://127.0.0.1:8799/v1", ANAHTAR);
  kontrol("anahtar kaydedildi", k.ok, JSON.stringify(k));
  const durum = JSON.stringify(await window.kopru.apiDurum());
  kontrol("renderer durumda anahtarı GÖRMEZ", !durum.includes(ANAHTAR), durum);

  await om.tara();
  kontrol("model seçenek oldu", om.secenekVarMi(MODEL));
  om.iste(MODEL);
  await bekle(3000);
  kontrol("API modeli düşünüyor", om.aktif() === MODEL, om.aktif());

  const duyulan: string[] = [];
  const kp = d.kopru as Kopru | null;   // kurulum beyniBagla'da: TS buradaki daralmayı bilmez
  const cik = kp?.konusmaDinle((m) => duyulan.push(m));
  kp?.algi({ tur: "duydum", metin: "merhaba", kesin: true });
  await bekle(5000);
  cik?.();
  kontrol("Orion API'nin sözünü söyledi", duyulan.includes("API beyni duyuyor."), JSON.stringify(duyulan));

  for (const r of sonuc) console.log("[APIDENE] " + r);
  console.log("[APIDENE] ozet: " + sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
}
