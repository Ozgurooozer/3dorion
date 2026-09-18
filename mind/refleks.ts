// mind/refleks.ts — Terfi kararı: bu algı BÜYÜK beyni uyandırmaya değer mi?
//
// dikkat.ts sabit kurallarla (bütçe/tekrar/kanal) filtreler — burada "kural"
// yok, YARGI var: "oyuncu odaya girdi" mi önemli yoksa halihazırda üçüncü kez
// mi oluyor, "kamera bir çapaya çok yaklaştı" mı ilgi çekici. Bu yargıyı
// pahalı ana modele (qwen2.5:7b, tam bağlamla) sormak israf; bunun için özel
// olarak seçilmiş çok küçük bir yerel model var: functiongemma-270m (253MB,
// spec bkz. docs/specs/01-sanal-alan.md satır 58).
//
// Refleks İKİ ŞEYE karar verebilir:
//   - terfi: true  → dikkat'in tamponuna eklensin, ana beyin uyansın
//   - terfi: false + niyet → küçük, geri dönüşü olmayan bir yerel tepki ver
//     (ör. sesin geldiği yöne "bak") ve ana beyni HİÇ rahatsız etme
//
// Bağımlılık: yalnızca protocol/. Ollama'ya HTTP ile konuşur (fetch),
// Babylon yok. hazirMi() başarısız olursa (model çekilmemiş/servis kapalı)
// arayan taraf HER ZAMAN terfi:true varsaymalı — refleks "belki yanlışlıkla
// atlama" değil, en fazla "gereksiz uyandırma" riski taşımalı.
"use strict";
import type { Niyet } from "../protocol/niyet.ts";
import { OZET_ONEKI, type AlgiTur } from "../protocol/algi.ts";

export interface RefleksGirdi {
  /** Kısa, tek satırlık algı özeti (protocol/algi.ts ozetle() çıktısı). */
  ozet: string;
  /**
   * Algının TÜRÜ. Verilirse sınıflandırma buna göre yapılır.
   *
   * Neden var: ilk sürüm türü özetin DÜZYAZI ÖNEKİNDEN çıkarıyordu
   * ("Terminal çıktısı:" ile başlıyor mu?). `ozetle()` metni iyileştirmek
   * için değiştirildiğinde süzgeç terminali tanıyamaz oldu ve her şeyi
   * beyne geçirdi — canlı ölçümde yakalandı. Düzyazı bir arayüz değildir.
   */
  tur?: AlgiTur;
  /**
   * Terminal komutunun ÇIKIŞ KODU. Verildiyse metin desenlerini EZER:
   * 0 = basarili, digeri = basarisiz. Kabuk yalan soylemez; "error" kelimesi
   * gecen bir commit mesaji ya da hata ANLATAN bir test adi onu kandiramaz.
   */
  kod?: number;
  /**
   * Komutun calisma suresi (ms). "Basarili bitti" bilgisinin soylenmeye
   * DEGER olup olmadigini bu belirler: olcut "Ozyn bekledi mi" sorusudur.
   * `cd` 5 ms surer, kimse beklemez; `npm test` 3 sn surer, Ozyn ekrana bakar.
   */
  sureMs?: number;
  /** Son N terfi kararının özeti — "aynı şeyi tekrar terfi ettirme" bağlamı. */
  baglam?: readonly string[];
}

export interface RefleksKarar {
  terfi: boolean;
  /** terfi:false ise, yine de küçük bir yerel tepki önerilebilir (opsiyonel). */
  niyet?: Niyet;
  /** Tanılama: modelin ham gerekçesi (log için, karara etkisi yok). */
  gerekce?: string;
}

export interface Refleks {
  degerlendir(g: RefleksGirdi): Promise<RefleksKarar>;
}

// ── Aday A: kural tabanlı refleks ────────────────────────────────────────────
//
// Neden var: spec "refleks = 270M yerel model" diyor, ama bu KANITLANMADI.
// Bir yargı katmanı eklemeden önce, ucuz taban çizgisinin ne kadar iyi
// olduğunu bilmek gerekir — yoksa modelin katkısı ölçülemez, yalnızca
// varsayılır. Bu sınıf o taban çizgisi; ölçümde kazanırsa üretim kodudur.
//
// Ölçüm: mind/refleks-olcum.ts

/**
 * Terminal çıktısında "bu önemli" diyen desenler.
 *
 * İkinci satırdaki kalıplar GERÇEK ÇIKTIDAN geldi (mind/akis-olcum.ts,
 * 2026-09-12): bu makinede cmd.exe "is not recognized as an internal or
 * external command", dir "File Not Found", PowerShell "is not recognized as
 * the name of a cmdlet" diyor — üçü de "error"/"fail" kelimesi İÇERMİYOR.
 * Yalnızca İngilizce hata sözcüklerine bakan bir desen, Windows'ta en sık
 * görülen üç başarısızlığı birden kaçırıyordu.
 */
const ONEMLI_DESEN =
  /\b(error|err!|fatal|exception|refused|econnrefused|cannot find|failed|fail\b|hata|çöktü)\b|✗|traceback/i;
const ONEMLI_KABUK =
  /\b(is not recognized|not found|no such file|permission denied|access is denied|segmentation fault|core dumped|killed|timeout|timed out)\b/i;
/** Terminal çıktısında "iş bitti, sonucu söylenmeye değer" diyen desenler. */
const BITIS_DESEN =
  /\b(pass(ed)?\s+\d+|tests?\s+\d+|fail\s+0|built in|build succeeded|bitti|tamamlandı)\b|✓/i;
/**
 * Bu süreyi aşan BAŞARILI komutlar da bildirilir.
 *
 * Gerekçe: uzun süren bir işin bitmesi Ozyn'in BEKLEDİĞİ bir andır; anlık
 * komutlarınki değil.
 *
 * Eşik GERÇEKTEN ölçülerek seçildi (bu makine, 2026-09-12):
 *   `dir`            47 ms   ← önemsiz, bildirilmemeli
 *   `tsc --noEmit` 1178 ms   ← iş, üstelik BAŞARIDA HİÇ ÇIKTI YAZMAZ
 *   `npm test`     2859 ms   ← iş, sonucu söylenmeli
 *
 * Not: ilk yazdığımda eşik 3000 ms'ti ve yorumda "tsc ~8 sn (ölçüldü)"
 * diyordu — ikisi de yanlıştı, ölçmeden yazılmıştı. 3000 ms hem `tsc`'yi hem
 * `npm test`'i elerdi, yani çözmek istediğim sorunu çözmezdi. 1000 ms, 47 ms
 * ile 1178 ms'yi rahatça ayırıyor ve insanın "bekliyorum" hissettiği yere
 * denk düşüyor.
 */
export const UZUN_ISLEM_MS = 1000;

/** Yığın izi satırları: hatanın KENDİSİ değil, gürültüsü. */
const YIGIN_IZI = /^\s+at\s+\S+|node:internal\//im;

export class KuralRefleksi implements Refleks {
  async degerlendir(g: RefleksGirdi): Promise<RefleksKarar> {
    return this.karar(g);
  }

  /** Senkron sürüm: kural tabanlı olduğu için beklemeye gerek yok. */
  karar(g: RefleksGirdi): RefleksKarar {
    const o = g.ozet;
    const t = g.tur;

    // Konuşma her zaman terfi eder — kullanıcı bekletilemez.
    if (t === "duydum" || (!t && o.startsWith(OZET_ONEKI.duydum))) {
      return { terfi: true, gerekce: "konuşma" };
    }

    if (t === "terminal" || (!t && o.startsWith(OZET_ONEKI.terminal))) {
      // ÇIKIŞ KODU her şeyden önce gelir: kesin sinyal, tahmin değil.
      if (g.kod !== undefined) {
        if (g.kod !== 0) return { terfi: true, gerekce: `komut hata ile bitti (çıkış kodu ${g.kod})` };
        // Komut BAŞARIYLA bitti. Metindeki korkutucu kelimelere artık
        // bakılmaz: gerçek veride yanlış pozitiflerin TAMAMI bu sınıftandı —
        // "fix error handling" commit mesajı, `"error": null` JSON alanı,
        // `grep "error"` yankısı. Hiçbiri hata değildi, kabuk de öyle diyor.
        // Geriye tek soru kalır: sonuç söylenmeye değer mi (test/derleme)?
        if (BITIS_DESEN.test(govdesi(o))) {
          return { terfi: true, gerekce: "başarılı komut, sonucu bildirmeye değer" };
        }
        // Uzun suren bir is BASARIYLA bittiyse bu da haberdir: Ozyn bekledi.
        // Cikis kodu olmadan bu bilgi hic gorunmuyordu (`tsc` temiz gecince
        // 0 satir yazar) — OSC 133 entegrasyonunun asil kazanimi budur.
        if (g.sureMs !== undefined && g.sureMs >= UZUN_ISLEM_MS) {
          return { terfi: true, gerekce: `uzun iş başarıyla bitti (${(g.sureMs / 1000).toFixed(1)} sn)` };
        }
        return { terfi: false, gerekce: "komut başarılı, rutin çıktı" };
      }
      return this._terminal(o);
    }

    if (t === "olay" || (!t && o.startsWith(OZET_ONEKI.olay))) {
      // Önekin UZUNLUĞU da tek kaynaktan: sabit 5 yazılıydı ("Olay:") ve önek
      // İngilizceye dönünce bir harf kayıp olay adı bozulacaktı.
      const ad = o.slice(OZET_ONEKI.olay.length).trim();
      const gurultu = ONEMSIZ_OLAYLAR.has(ad);
      return { terfi: !gurultu, gerekce: gurultu ? "gürültü olay" : "dünya olayı" };
    }

    // Niyet sonucu: yalnızca BAŞARISIZLIK öğreticidir.
    // Sorunun cevabı HER ZAMAN terfi eder: beyin onu kendisi istedi.
    // Süzmek, Orion'un sorup cevabı hiç duymaması demek (canlıda yaşandı).
    if (t === "gordum" || (!t && o.startsWith(OZET_ONEKI.gordum))) {
      return { terfi: true, gerekce: "sorunun cevabı" };
    }

    if (t === "sonuc" || (!t && o.startsWith(OZET_ONEKI.sonuc))) {
      const hata = /→\s*hata/.test(o);
      return { terfi: hata, gerekce: hata ? "niyet hatası" : "rutin başarı" };
    }

    // Dünya/yakın anlık görüntüleri istenmeden gelirse rutindir.
    if (t === "dunya" || t === "yakin" || (!t && (o.startsWith(OZET_ONEKI.dunya) || o.startsWith(OZET_ONEKI.yakin)))) {
      return { terfi: false, gerekce: "rutin anlık görüntü" };
    }

    // Tanınmayan biçim → GÜVENLİ TARAF. Sessizce yutmak en kötü sonuç.
    return { terfi: true, gerekce: "tanınmayan biçim, güvenli terfi" };
  }

  /** Terminal bloğunun içerik yargısı — yalnızca ÇIKIŞ KODU YOKKEN. */
  private _terminal(o: string): RefleksKarar {
    const govde = govdesi(o);
    // Yığın izi koruması ÖNEMLİ desenlerin İKİSİNİ birden hesaba katmalı.
    // Gerçek veri bu hatayı yakaladı: PowerShell'in "is not recognized"
    // hatası, çıktısındaki "At line:1" satırı yüzünden "yığın izi" sanılıp
    // susturuluyordu — yalnızca ONEMLI_DESEN'e bakıldığı için.
    const onemli = ONEMLI_DESEN.test(govde) || ONEMLI_KABUK.test(govde);
    if (YIGIN_IZI.test(govde) && !onemli) return { terfi: false, gerekce: "yığın izi gürültüsü" };
    if (ONEMLI_DESEN.test(govde)) return { terfi: true, gerekce: "hata deseni" };
    if (ONEMLI_KABUK.test(govde)) return { terfi: true, gerekce: "kabuk başarısızlığı" };
    if (BITIS_DESEN.test(govde)) return { terfi: true, gerekce: "iş bitiş deseni" };
    return { terfi: false, gerekce: "rutin terminal gürültüsü" };
  }
}

/** Özet başlığını atıp yalnızca çıktı gövdesini döner. */
function govdesi(o: string): string {
  const i = o.indexOf("\n");
  return i === -1 ? o : o.slice(i + 1);
}

/** dikkat.ts ile aynı liste — tek kaynak olması için oradan türetilmeli
 *  ama dikkat onu dışa vermiyor; ölçüm sonrası birleştirilecek. */
const ONEMSIZ_OLAYLAR = new Set(["kamera_degisti", "ipucu", "fare_kilidi"]);

const TALIMAT =
  "Sen bir 3D odadaki AI'ın refleks katmanısın. Sana odadaki küçük bir " +
  "olayın özeti verilecek. Görevin: bu olay büyük beyni (asıl konuşma/karar " +
  "modeli) uyandırmaya değer mi, yoksa göz ardı edilebilir mi karar vermek. " +
  "SADECE şu JSON ile yanıt ver, başka metin yazma: " +
  '{"terfi": true|false, "gerekce": "kısa neden"}. ' +
  "Önemsiz/tekrarlı/gürültü olaylar için terfi:false. Kullanıcı davranışı, " +
  "yeni bir durum, ya da doğrudan hitap için terfi:true.";

export interface OllamaRefleksAyari {
  model?: string;
  adres?: string;
  zamanAsimiMs?: number;
}

export class OllamaRefleks implements Refleks {
  private _model: string;
  private _adres: string;
  private _zamanAsimi: number;

  constructor(ayar: OllamaRefleksAyari = {}) {
    this._model = ayar.model ?? "hf.co/unsloth/functiongemma-270m-it-GGUF";
    this._adres = (ayar.adres ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
    this._zamanAsimi = ayar.zamanAsimiMs ?? 3000;
  }

  async hazirMi(): Promise<boolean> {
    try {
      const c = new AbortController();
      const saat = setTimeout(() => c.abort(), 1500);
      const y = await fetch(`${this._adres}/api/tags`, { signal: c.signal });
      clearTimeout(saat);
      if (!y.ok) return false;
      const d = (await y.json()) as { models?: { name?: string }[] };
      // Etiket normalizasyonu: Ollama "x" modelini "x:latest" diye kaydeder.
      // Birebir karşılaştırma bu yüzden kurulu modeli "yok" sanıyordu —
      // ölçüm sırasında yakalandı, hattı sessizce devre dışı bırakıyordu.
      const norm = (s: string) => (s.includes(":") ? s : `${s}:latest`);
      const aranan = norm(this._model);
      return (d.models ?? []).some((m) => m.name && norm(m.name) === aranan);
    } catch { return false; }
  }

  async degerlendir(g: RefleksGirdi): Promise<RefleksKarar> {
    const kullanici = [
      ...(g.baglam?.length ? [`Son terfi kararları: ${g.baglam.join(" | ")}`] : []),
      `Olay: ${g.ozet}`,
    ].join("\n");

    const govde = {
      model: this._model,
      messages: [
        { role: "system", content: TALIMAT },
        { role: "user", content: kullanici },
      ],
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
    };

    const c = new AbortController();
    const saat = setTimeout(() => c.abort(), this._zamanAsimi);
    try {
      const y = await fetch(`${this._adres}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
        signal: c.signal,
      });
      if (!y.ok) throw new Error(`ollama ${y.status}: ${await y.text()}`);
      const d = (await y.json()) as { message?: { content?: string } };
      return this._cozumle(d.message?.content ?? "");
    } catch (err) {
      // Ağ/model hatası → GÜVENLİ TARAF: terfi et, ana beyin karar versin.
      console.warn("[refleks] değerlendirme başarısız, güvenli tarafa terfi:", err instanceof Error ? err.message : err);
      return { terfi: true, gerekce: "refleks hatası, güvenli terfi" };
    } finally {
      clearTimeout(saat);
    }
  }

  /** Modelin JSON yanıtını ayrıştırır; bozuksa güvenli tarafa (terfi:true) düşer. */
  private _cozumle(ham: string): RefleksKarar {
    try {
      const j = JSON.parse(ham) as { terfi?: unknown; gerekce?: unknown };
      if (typeof j.terfi !== "boolean") throw new Error("terfi alanı boolean değil");
      return { terfi: j.terfi, gerekce: typeof j.gerekce === "string" ? j.gerekce : undefined };
    } catch {
      console.warn(`[refleks] model yanıtı JSON değil, güvenli terfi: "${ham}"`);
      return { terfi: true, gerekce: "ayrıştırma hatası, güvenli terfi" };
    }
  }
}
