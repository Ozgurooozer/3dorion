// bridge/disBeyin.ts — BAŞKA BİR DİLDE yazılmış beyin. HTTP üzerinden.
//
// NEDEN VAR: "beyni ayrı bir süreç yapalım, Babylon'la soket üzerinden
// konuşsun" önerisine karşılık. Ayrım zaten `bridge/beyin.ts` ile vardı —
// `Beyin` üç metotluk bir arayüz ve `protocol/` klasörünün sıfır dış
// bağımlılığı var. Eksik olan tek şey bir TAŞIYICIYDI; bu dosya o.
//
// Python, Go, Rust, C — fark etmez. Beyin şu sözleşmeyi karşılasın yeter:
//
//   GET  /saglik  → 200 (gövde önemsiz)
//   POST /dusun   → gövde: BeyinGirdisi (JSON)
//                   yanıt: { metin?: string, cagrilar?: [{ad, girdi}], bilgi?: {} }
//
// ÖRNEK: `tools/ornek-beyin.py` — bağımlılıksız, Python stdlib ile ~90 satır.
//
// DİKKAT ÇEKEN FARK: bu beyin `cagrilar`ı DOĞRUDAN yapısal olarak döner.
// Satır sözleşmesi (`satirSozlesmesi.ts`) yalnızca LLM'e METİN yazdırıp geri
// ayrıştırmak zorunda olduğumuz için var. Yerel bir süreç o zahmete girmez —
// soyutlamanın kazancı tam olarak burada görünüyor.
//
// Bağımlılık: protocol/ + beyin.ts + fetch. Babylon yok, Electron yok.
"use strict";
import type { Beyin, BeyinGirdisi, BeyinCikti, AracCagrisi } from "./beyin.ts";

export interface DisBeyinAyari {
  /** Sunucu adresi. Varsayılan: Python örneğinin portu. */
  adres?: string;
  /** Tanıda görünecek ad (hangi beyin konuşuyor). */
  ad?: string;
  /** Yanıt bu süreyi aşarsa iptal — dünya donmamalı. */
  zamanAsimiMs?: number;
}

/** Dış beynin dönmesi beklenen gövde. Alanların hepsi isteğe bağlı. */
interface DisYanit {
  metin?: unknown;
  cagrilar?: unknown;
  bilgi?: unknown;
}

export class DisBeyin implements Beyin {
  readonly ad: string;
  private _adres: string;
  private _zamanAsimi: number;

  constructor(ayar: DisBeyinAyari = {}) {
    this._adres = (ayar.adres ?? "http://127.0.0.1:4700").replace(/\/+$/, "");
    this._zamanAsimi = ayar.zamanAsimiMs ?? 10_000;
    this.ad = ayar.ad ?? `dis:${this._adres.replace(/^https?:\/\//, "")}`;
  }

  async hazirMi(): Promise<boolean> {
    try {
      const c = new AbortController();
      const saat = setTimeout(() => c.abort(), 2000);
      try {
        const y = await fetch(`${this._adres}/saglik`, { signal: c.signal });
        return y.ok;
      } finally { clearTimeout(saat); }
    } catch { return false; }
  }

  async dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    const t0 = Date.now();
    const c = new AbortController();
    const saat = setTimeout(() => c.abort(), this._zamanAsimi);
    try {
      const y = await fetch(`${this._adres}/dusun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Girdi OLDUĞU GİBİ gider: dış beyin neyi kullanacağına kendi karar
        // versin. Burada alan seçmek, taşıyıcıyı beynin işine karıştırmak olur.
        body: JSON.stringify(girdi),
        signal: c.signal,
      });
      const ham = await y.text();
      if (!y.ok) throw new Error(`dis beyin ${y.status}: ${ham.slice(0, 160)}`);

      const j = (ham ? JSON.parse(ham) : {}) as DisYanit;
      return {
        metin: typeof j.metin === "string" ? j.metin : "",
        cagrilar: cagrilariSuz(j.cagrilar),
        bilgi: {
          ...(j.bilgi && typeof j.bilgi === "object" ? j.bilgi as object : {}),
          model: this.ad,
          sureMs: Date.now() - t0,
        },
      };
    } catch (err) {
      // `AbortError`in ham mesajı hiçbir şey anlatmaz; sebebi söyle.
      if ((err as Error)?.name === "AbortError") {
        throw new Error(`dis beyin ${Math.round(this._zamanAsimi / 1000)} sn icinde cevap vermedi`);
      }
      throw err;
    } finally { clearTimeout(saat); }
  }
}

/**
 * Gelen çağrı listesini biçim olarak süzer.
 *
 * İÇERİK doğrulaması YAPILMAZ — o köprünün işi (`cagriyiNiyete`) ve orada
 * zaten yapılıyor; iki yerde doğrulamak ikisinin ayrışmasına davetiye.
 * Burada yalnızca "bu gerçekten bir çağrı listesi mi" sorusu yanıtlanır:
 * dış süreç güvenilmezdir ve bozuk bir gövde dünyayı çökertmemeli.
 */
function cagrilariSuz(ham: unknown): AracCagrisi[] {
  if (!Array.isArray(ham)) return [];
  const cikti: AracCagrisi[] = [];
  for (const c of ham) {
    if (!c || typeof c !== "object") continue;
    const o = c as { ad?: unknown; girdi?: unknown };
    if (typeof o.ad !== "string" || !o.ad) continue;
    cikti.push({ ad: o.ad, girdi: o.girdi && typeof o.girdi === "object" ? o.girdi : {} });
  }
  return cikti;
}
