// uygulama/senaryolar/efektdene.ts — `3dorion.bat efektdene`: ışık/efekt zinciri ÇALIŞMA ANINDA bozulmuyor mu (Ozyn, 2026-10-15).
//
// Neden var: GI (GIRSM) çalışma anında açılınca Babylon'un yansıtıcı gölge haritası (RSM) 3 çıkışlı hedefe PARÇACIK sistemlerini de çiziyordu
// (`renderParticles = false` unutulmuştu): her karede `glDrawArraysInstanced: Active draw buffers with missing fragment shader outputs`,
// ekran bozuldu, Orion ve ofis duvarları kayboldu. Duman koşuları (kapidene, zihindene…) efektleri AÇILIŞTA kurduğu ve çoğu gece/içeride koştuğu
// için bunu hiç görmedi. Bu senaryo her efekti ve önayarı ÇALIŞMA ANINDA açıp kapatır, hem gündüz hem gece, hem ova'da hem ofiste.
//
// Ölçü iki şey: (1) WebGL hatası — `gl.getError()` her 50 ms okunur, INVALID_OPERATION görülen pencere sayılır (konsola bakmaya gerek yok);
// (2) GÖRÜNMEZLİK — görünür, malzemeli her mesh'in `isReady(true)` olması (shader derlenmemiş/çizilemeyen mesh ekranda yok olur).
// Sözler Ozyn'in ağzından, sözlük yolundan (token'sız; LLM'siz): "gi aç", "toon yap" … Sonuç: `[EFEKTDENE] GECTI/KALDI …` satırları.
// Kural (CLAUDE.md): ışık/efekt zincirine (`world/level/stil/`) dokunan her değişiklik bu senaryodan geçer; tek KALDI bile kırmızıdır.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

const EFEKTLER = ["bloom", "huzme", "parıltı", "ao", "eğri", "vinyet", "gren", "sapma", "keskinlik", "derinlik", "gi"] as const;
const STILLER = ["toon", "cel", "anime90", "standart"] as const;
const GL_INVALID_OPERATION = 0x0502;

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[EFEKTDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };

  await bekle(2500);
  if (!d.kopru) { log("köprü yok (beyin kapalı?): senaryo koşamaz"); return; }
  const tuval = d.motor.getRenderingCanvas();
  const gl = tuval?.getContext("webgl2") ?? null;
  if (!gl) { log("WebGL2 bağlamı alınamadı: senaryo koşamaz"); return; }

  const soyle = async (soz: string) => { d.kopru?.algi({ tur: "duydum", metin: soz, kesin: true }); await bekle(700); };
  /** `ms` boyunca GL hatası bayrağını 50 ms'de bir okur; INVALID_OPERATION görülen pencere sayısı. */
  const glHataPencereleri = async (ms: number): Promise<number> => {
    while (gl.getError() !== 0) { /* eski hata bayrağını boşalt */ }
    let n = 0;
    for (let t = 0; t < ms; t += 50) { await bekle(50); if (gl.getError() === GL_INVALID_OPERATION) n++; }
    return n;
  };
  /** Görünür, malzemeli, hazır OLMAYAN mesh'ler (shader derlenmedi/çizilemiyor → ekranda görünmez). */
  const hazirDegil = (): string[] => d.sahne.meshes
    .filter((m) => m.isEnabled() && m.isVisible && m.getTotalVertices() > 0 && !!m.material && !m.isReady(true))
    .map((m) => m.name);
  const olc = async (ad: string) => {
    const hata = await glHataPencereleri(900);
    const yok = hazirDegil();
    kontrol(ad, hata === 0 && yok.length === 0, `GL hata penceresi=${hata} hazır_olmayan_mesh=${yok.length}${yok.length ? ` (${yok.slice(0, 3).join(", ")})` : ""}`);
  };

  const tur = async (yer: string, saatSozu: string) => {
    await soyle("ortamı sıfırla");
    await soyle(saatSozu);
    await bekle(800);
    await olc(`${yer} · ${saatSozu} · başlangıç`);
    for (const e of EFEKTLER) { await soyle(`${e} aç`); await olc(`${yer} · ${saatSozu} · ${e} aç`); }
    await olc(`${yer} · ${saatSozu} · HEPSİ açık`);
    for (const s of STILLER) { await soyle(`${s} yap`); await olc(`${yer} · ${saatSozu} · stil ${s} (hepsi açık üstüne)`); }
    for (const e of EFEKTLER) { await soyle(`${e} kapat`); }
    await olc(`${yer} · ${saatSozu} · efektler kapatıldı`);
  };

  // 1) ova (dışarıda): gündüz + gece. İkisi de: parçacıklar gündüz/gece farklı etkin, GI güneşe/aya bağlı.
  if (!(await d.ovayaCik())) { log("birleşik dünya kurulamadı"); return; }
  await bekle(1500);
  await tur("ova", "saat 12");
  await tur("ova", "gece yap");
  // 2) ofis (içeride): efekt zinciri ofiste KAPALI olmalı ama komutlar hata/görünmezlik üretmemeli.
  if (d.ortam.odayaDon()) {
    await bekle(1500);
    await tur("ofis", "saat 12");
  } else {
    kontrol("ofise dönüldü", false, "odayaDon() false");
  }
  log(`TOPLAM ${gecen} GECTI, ${kalan} KALDI`);
  console.log(`[EFEKTDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
}
