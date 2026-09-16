// bridge/opencode.ts — Orion'un SOL LOBU: OpenCode üzerinden düşünce beyni.
//
// NEDEN (ölçümle): yerel `qwen2.5:7b` üç cephede duvara çarptı ve aynı üç
// senaryo `inclusionai/ling-3.0-flash-vl:free` ile OpenCode üzerinden ölçüldü:
//
//   terminal hatası : qwen "cd C:\Users\..." (yanlış) | Ling "`gti` yazım
//                     hatası — `git` olarak yaz" ✓
//   hatırlama       : qwen 0/6                        | Ling ✓
//   gecikme         : qwen 858 ms                     | Ling 3572 ms
//
// Kalite bulutta, hız yerelde. Bu dosya "kalite" tarafıdır; hız tarafı
// (refleks, beden) yerel ve kuralcı kalır — bkz. docs/specs/02-beyin-mimarisi.md
//
// ARAÇ ÇAĞRISI — geçici yol, bilerek:
// OpenCode'un `tools` alanı yalnızca KENDİ araçlarını açıp kapatıyor; bizim
// `dunya_*` araçlarımızı vermenin doğru yolu MCP kaydı (`POST /mcp`, Aşama 3).
// O gelene kadar SATIR SÖZLEŞMESİ kullanılıyor (`satirSozlesmesi.ts`): model
// doğal cevabını yazar, eylem gerekiyorsa sonuna `KOMUT:` / `TAHTA:` / `GIT:`
// satırı ekler. Gerekçesi `satirSozlesmesi.ts` başında (ilk "şema askıda
// kalıyor" tezi ölçümle ÇÜRÜTÜLDÜ; gecikmenin sebebi sağlayıcı kotasıydı).
// Sınırı açıkça yazıyorum: bu, gerçek tool-calling kadar sağlam DEĞİLDİR.
//
// `gecmis` ve `ornekler` BİLEREK GÖNDERİLMİYOR — eksik değil, karar:
//
//   * Geçmiş: OpenCode oturumu konuşma sürekliliğini KENDİ tutuyor. Ölçüldü —
//     aynı oturumda söylenen sayı sonraki turda hatırlandı ("4271"), yeni
//     oturumda hatırlanmadı. Bir de biz göndersek aynı bağlam ikiye katlanır.
//     (Ollama beyni için durum tersiydi: orada geçmiş ŞART, çünkü sunucu
//     hiçbir şey tutmuyor.)
//   * Örnekler: `ornekler.ts` few-shot'ları ARAÇ ÇAĞRISI biçiminde tutuyor;
//     OpenCode tek `parts` alıyor ve bizim araçlarımızı tanımıyor. Onun
//     yerine örnekler satır sözleşmesine METİN olarak gömüldü
//     (`SOZLESME_TALIMATI`) ve ölçümde anlatımdan güçlü çıktılar.
//
// Bağımlılık: protocol/ + beyin.ts + fetch. Babylon yok, Electron yok.
"use strict";
import type { Beyin, BeyinGirdisi, BeyinCikti, AracCagrisi } from "./beyin.ts";
import { araclariUret } from "./araclar.ts";
import { metinKurtar } from "./metinKurtarma.ts";
import { yanitAyir, cagrilaraCevir, SOZLESME_TALIMATI } from "./satirSozlesmesi.ts";

export interface OpenCodeAyari {
  adres?: string;
  providerID?: string;
  modelID?: string;
  /** Yanıt bu süreyi aşarsa iptal — dünya donmamalı. */
  zamanAsimiMs?: number;
  /** Sunucu şifreliyse (OPENCODE_SERVER_PASSWORD). */
  sifre?: string;
}

interface OturumYaniti { id?: string; sessionID?: string }
interface Parca { type?: string; text?: string }
interface MesajYaniti {
  parts?: Parca[];
  message?: { parts?: Parca[] };
  text?: string;
  /**
   * OpenCode sağlayıcı hatasını HTTP 200 GÖVDESİNE gömüyor (`y.ok` true kalır).
   * Ölçümle görüldü: OpenRouter kotası dolduğunda 75 sn yeniden deneme sonrası
   * 200 + `info.error.data.statusCode: 429` döndü, `parts` boş geldi. Bu alan
   * okunmazsa Orion sessizce susar ve sebebi hiçbir yerde görünmez.
   */
  info?: { error?: { name?: string; data?: { message?: string; statusCode?: number } } };
}

/** Sağlayıcı hatası — köprü bunu ayırt edip odada görünür kılabilsin diye. */
export class SaglayiciHatasi extends Error {
  readonly kod?: number;
  constructor(mesaj: string, kod?: number) {
    super(mesaj);
    this.name = "SaglayiciHatasi";
    this.kod = kod;
  }
}

export class OpenCodeBeyni implements Beyin {
  readonly ad: string;
  private _adres: string;
  private _providerID: string;
  private _modelID: string;
  private _zamanAsimi: number;
  private _sifre?: string;
  /** Tek kalıcı oturum: OpenCode oturumu konuşma sürekliliğini kendi tutar. */
  private _oturum: string | null = null;

  // ── DEVRE KESİCİ ─────────────────────────────────────────────────────────
  // Kota dolduğunda her algı 30 sn boşa bekliyor: Orion yalnızca susmuyor,
  // sürekli 30 sn'lik kuyruklar biriktiriyor ve dünya kendini tekrar eden
  // arıza mesajlarıyla doluyor. Üst üste arıza olunca bir süre hiç denemeyip
  // ANINDA hata döneriz — çağıran (köprü) böylece hemen kurallı kipe düşer.
  private _ardisikAriza = 0;
  private _kesikBitis = 0;
  /** Kaç arızadan sonra kesilir ve ne kadar dinlenir. */
  private static readonly ARIZA_SINIRI = 3;
  private static readonly KESIK_MS = 5 * 60_000;
  /**
   * GÜNLÜK kota için ayrı, uzun kesik.
   *
   * `free-models-per-day` gün boyu geçerlidir: 5 dakika sonra yeniden denemek
   * kesinlikle başarısız olur ve her deneme ~70 sn harcar (sağlayıcı önce
   * yeniden dener, sonra 429 döner). Kısa kesikle Orion saatlerce 70 sn'lik
   * kuyruklar biriktirirdi.
   *
   * Yine de "gün sonuna kadar" değil: kullanıcı kredi ekleyip kotayı açabilir
   * ve dünyayı yeniden başlatmak zorunda kalmamalı. Yarım saat makul bir orta yol.
   */
  private static readonly KOTA_KESIK_MS = 30 * 60_000;

  /** Devre kesik mi, ne kadar kaldı (saniye)? Panel ve tanı için. */
  get kesikSaniye(): number {
    return Math.max(0, Math.ceil((this._kesikBitis - Date.now()) / 1000));
  }

  constructor(ayar: OpenCodeAyari = {}) {
    this._adres = (ayar.adres ?? "http://127.0.0.1:4096").replace(/\/+$/, "");
    this._providerID = ayar.providerID ?? "openrouter";
    this._modelID = ayar.modelID ?? "inclusionai/ling-3.0-flash-vl:free";
    this._zamanAsimi = ayar.zamanAsimiMs ?? 30_000;
    this._sifre = ayar.sifre;
    this.ad = `opencode:${this._modelID}`;
  }

  private _baslik(): Record<string, string> {
    const b: Record<string, string> = { "Content-Type": "application/json" };
    // OpenCode şifreli çalışıyorsa temel kimlik doğrulaması.
    if (this._sifre) b.Authorization = `Basic ${btoa(`opencode:${this._sifre}`)}`;
    return b;
  }

  private async _istek<T>(yol: string, govde?: unknown, zamanAsimi?: number): Promise<T> {
    const c = new AbortController();
    const saat = setTimeout(() => c.abort(), zamanAsimi ?? this._zamanAsimi);
    try {
      const y = await fetch(`${this._adres}${yol}`, {
        method: govde === undefined ? "GET" : "POST",
        headers: this._baslik(),
        body: govde === undefined ? undefined : JSON.stringify(govde),
        signal: c.signal,
      });
      const metin = await y.text();
      if (!y.ok) throw new Error(`opencode ${y.status} ${yol}: ${metin.slice(0, 160)}`);
      return (metin ? JSON.parse(metin) : null) as T;
    } catch (err) {
      // `AbortError`in ham mesajı "This operation was aborted" — odada bunu
      // göstermek hiçbir şey anlatmaz. Ölçümde kota hatası 70 sn'de geliyor,
      // bizim tavan 30 sn: yani KOTA doluyken kullanıcı hep bunu görecek.
      // O yüzden mesaj süreyi ve olası sebebi söyler.
      if ((err as Error)?.name === "AbortError") {
        const sn = Math.round((zamanAsimi ?? this._zamanAsimi) / 1000);
        throw new Error(`model ${sn} sn icinde cevap vermedi (saglayici yavas ya da kota dolu olabilir)`);
      }
      throw err;
    } finally {
      clearTimeout(saat);
    }
  }

  async hazirMi(): Promise<boolean> {
    try {
      await this._istek<unknown>("/doc", undefined, 2500);
      return true;
    } catch { return false; }
  }

  /** Oturum yoksa açar. OpenCode oturumu konuşma geçmişini kendi tutar. */
  private async _oturumAl(): Promise<string> {
    if (this._oturum) return this._oturum;
    const o = await this._istek<OturumYaniti>("/session", {});
    const id = o?.id ?? o?.sessionID;
    if (!id) throw new Error("opencode oturum kimliği alınamadı");
    this._oturum = id;
    return id;
  }

  async dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    if (this.kesikSaniye > 0) {
      throw new Error(`dusunce gecici kapali: saglayici ariza verdi, ${this.kesikSaniye} sn sonra yeniden denenecek`);
    }
    try {
      const c = await this._dusun(girdi);
      this._ardisikAriza = 0;   // başarı seriyi kırar; arızalar ARDIŞIK sayılır
      return c;
    } catch (err) {
      // GÜNLÜK KOTA TEK BAŞINA YETER: üç deneme beklemeye gerek yok, sonuç
      // baştan belli ve her deneme ~70 sn. Diğer arızalar (ağ dalgalanması,
      // geçici yavaşlık) kendiliğinden düzelebilir; onlar için seri beklenir.
      const m = err instanceof Error ? err.message : String(err);
      const gunlukKota = /free-models-per-day|per-day|daily/i.test(m);

      if (gunlukKota) {
        this._kesikBitis = Date.now() + OpenCodeBeyni.KOTA_KESIK_MS;
        this._ardisikAriza = 0;
        console.warn(`[opencode] GUNLUK KOTA doldu — dusunce ${OpenCodeBeyni.KOTA_KESIK_MS / 60000} dk kapatildi`);
      } else if (++this._ardisikAriza >= OpenCodeBeyni.ARIZA_SINIRI) {
        this._kesikBitis = Date.now() + OpenCodeBeyni.KESIK_MS;
        this._ardisikAriza = 0;
        console.warn(`[opencode] ust uste ${OpenCodeBeyni.ARIZA_SINIRI} ariza — dusunce ${OpenCodeBeyni.KESIK_MS / 60000} dk kapatildi`);
      }
      throw err;
    }
  }

  private async _dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    const oturum = await this._oturumAl();
    const t0 = Date.now();

    const sistem = [
      girdi.talimat,
      girdi.sabit,
      SOZLESME_TALIMATI,
    ].filter(Boolean).join("\n");
    const kullanici = [
      girdi.dunya,
      ...(girdi.anilar?.length ? [`Hatirladiklarin: ${girdi.anilar.join(" | ")}`] : []),
      ...girdi.ozetler,
    ].filter(Boolean).join("\n");

    let yanit: MesajYaniti;
    try {
      yanit = await this._istek<MesajYaniti>(`/session/${oturum}/message`, {
        model: { providerID: this._providerID, modelID: this._modelID },
        system: sistem,
        // OpenCode'un KENDİ kodlama araçları kapalı: Orion'un terminale tek
        // erişimi onay kapısından geçen `dunya_komut` olmalı. İkinci bir yol
        // açmak onay kapısını anlamsızlaştırır (bkz. 02-beyin-mimarisi.md).
        tools: { bash: false, edit: false, write: false, read: false, glob: false, grep: false, webfetch: false },
        parts: [{ type: "text", text: kullanici }],
      });
    } catch (err) {
      // OTURUM KOLAY KOLAY ATILMAZ — burası Orion'un HAFIZASI.
      //
      // Ölçüldü: OpenCode oturumu konuşma geçmişini kendi tutuyor (aynı
      // oturumda söylenen sayı sonraki turda hatırlandı; yeni oturumda
      // hatırlanmadı). Bu yüzden köprünün `gecmis` alanı buraya GÖNDERİLMEZ:
      // göndermek aynı bağlamı ikiye katlardı.
      //
      // Bunun bedeli: oturumu atmak = Orion'un hafızasını silmek. Önceki
      // sürüm HER hatada atıyordu — kota dolduğunda ya da istek zaman
      // aşımına uğradığında (ikisi de oturumu düşürmez) tüm konuşma sessizce
      // siliniyordu. Artık yalnızca oturumun GERÇEKTEN geçersiz olduğu
      // belliyse atılır.
      const m = err instanceof Error ? err.message : String(err);
      if (/\b404\b|session not found|unknown session/i.test(m)) {
        console.warn("[opencode] oturum gecersiz, yenisi acilacak");
        this._oturum = null;
      }
      throw err;
    }

    // Gövdeye gömülü sağlayıcı hatası — HTTP 200 olsa bile yanıt yok demektir.
    const h = yanit?.info?.error;
    if (h) {
      const kod = h.data?.statusCode;
      throw new SaglayiciHatasi(
        `${h.name ?? "hata"}${kod ? ` ${kod}` : ""}: ${h.data?.message ?? "ayrinti yok"}`, kod);
    }

    const ham = this._metniTopla(yanit);
    const bilinen = araclariUret().map((a) => a.ad);

    // BİRİNCİL YOL: satır sözleşmesi. Model doğal cevabını yazar, eylemi
    // sonuna `KOMUT:` / `TAHTA:` / `GIT:` satırı olarak ekler. Ölçüm gereği:
    // `format: json_schema` bu model/sağlayıcıda 60-90 sn askıda kalıyordu,
    // şemasız istek 8.6 sn'de doğru cevabı veriyordu (bkz. satirSozlesmesi.ts).
    const ayrik = yanitAyir(ham);

    // YEDEK: model eski alışkanlıkla söz içine JSON araç çağrısı sızdırabilir.
    // Temizlenmezse Orion bunu SESLİ okur (ekran görüntüsüyle görüldü:
    // `orld {"name":"dunya_bak",...}`). Kurtarma sözü temizler; oradan çıkan
    // çağrıları da alırız — `dunya_soyle` hariç, sözü aşağıda zaten üretiyoruz.
    let ekCagrilar: AracCagrisi[] = [];
    if (ayrik.soz.includes("{") && bilinen.some((ad) => ayrik.soz.includes(ad))) {
      const k = metinKurtar(ayrik.soz, bilinen);
      ayrik.soz = k.konusulabilir;
      ekCagrilar = (k.cagrilar as AracCagrisi[]).filter((c) => c.ad !== "dunya_soyle");
    }

    const cagrilar: AracCagrisi[] = [...ekCagrilar, ...(cagrilaraCevir(ayrik) as AracCagrisi[])];
    if (cagrilar.length === 0 && ham) {
      console.warn(`[opencode] yanittan eylem cikmadi: "${ham.replace(/\s+/g, " ").slice(0, 100)}"`);
    }

    return {
      // `metin` yalnızca günlük/panel içindir; ses cagrilar[dunya_soyle]'den gider.
      metin: ayrik.soz,
      cagrilar,
      bilgi: { model: this.ad, sureMs: Date.now() - t0, oturum },
    };
  }

  /** Yanıt parçalarından okunabilir metni toplar. */
  private _metniTopla(y: MesajYaniti): string {
    const parcalar = y?.parts ?? y?.message?.parts ?? [];
    const yazilar: string[] = [];
    for (const p of Array.isArray(parcalar) ? parcalar : []) {
      if (p?.type === "text" && typeof p.text === "string") yazilar.push(p.text);
    }
    if (yazilar.length === 0 && typeof y?.text === "string") yazilar.push(y.text);
    return yazilar.join("\n").trim();
  }

  /** Yeni oturum başlat (bağlamı sıfırlamak için). */
  oturumuSifirla(): void { this._oturum = null; }
}
