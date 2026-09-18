// bridge/mcpBeyin.ts — MCP ajanı bir Beyin olur (spec 05 §2: "ajan çeker").
//
// NEDEN BÖYLE. Bugün dünya İTİYOR: köprü `Beyin.dusun()` çağırır. Terminal
// ajanı (odadaki `claude`) ise sunucu değil, istek/yanıttır — itilemez. Spec 05
// kontrolü tersine çeviriyor: ajan `dunya_bekle` ile ÇEKER.
//
// Bu dosya iki dünyayı tek bir `Beyin` arkasında buluşturur:
//
//   köprü  → dusun(girdi)  ─┐                       ┌─ bekle()  ← ajan (MCP)
//                           ├── TUR: girdi ajana gider, ajanın araç
//   köprü  ← BeyinCikti   ──┘   çağrıları TOPLANIR, ajanın bir sonraki
//                               bekle()'si turu KAPATIR → cevap köprüye döner
//
// Kazanç — spec 05'in iki şartı SÖZDEN değil YAPIDAN gelir:
//   "çağrılar mevcut dogrula + niyetiYurut yolundan geçer" ve "mind/ korunur":
//   ajanın çağrıları burada ÇALIŞTIRILMAZ, toplanıp köprüye döner. Köprü onları
//   diğer beyinlerinkiyle AYNI yoldan işler: `dogrula`, onay kapısı, zincir
//   bütçesi, susma kapısı, `tik` yasağı. MCP yolu hiçbirini atlayamaz.
//
// Tur DIŞINDA araç çağrısı reddedilir (R7): aksi hâlde ajan köprüyü tamamen
// atlayıp doğrudan dünyaya yazardı.
//
// SAF: G/Ç yok. MCP taşıması (HTTP, IPC röle) dışarıda — `host/mcpSunucu.js`.
"use strict";
import type { Beyin, BeyinGirdisi, BeyinCikti, AracCagrisi } from "./beyin.ts";
import { baglamMetni } from "./baglam.ts";
import { araclariUret, type AracTanimi } from "./araclar.ts";

export interface McpBeyinAyari {
  /**
   * Ajandan bu süre ses gelmezse temas KOPMUŞ sayılır (R1): `hazirMi()` false,
   * `kesikSaniye` > 0 → dünya sağ lobla devam eder. Bekleyen bir `dunya_bekle`
   * varken bu süre İŞLEMEZ — açık bağlantı temastır (bkz. `_temasTaze`).
   */
  temasZamanAsimiMs?: number;
  /** Ajan bir turu bu sürede kapatmazsa köprü toplananla devam eder. */
  turZamanAsimiMs?: number;
  simdi?: () => number;
}

export type BekleSonucu = { sessiz: true } | { metin: string };

/** `dunya_bekle` — protokolde değil, MCP çekme döngüsüne ait tek araç. */
export const BEKLE_ARACI: AracTanimi = {
  ad: "dunya_bekle",
  aciklama:
    "Wait until something happens in the room, then receive your situation. "
    + "Call this in a loop. Calling it also ENDS your current turn: the actions you "
    + "took since the last call are carried out. If nothing happens within "
    + "`azami_sn` seconds it returns 'quiet' — just call it again.",
  sema: {
    type: "object",
    properties: { azami_sn: { type: "number", description: "Max seconds to wait (60-120)." } },
  },
};

interface AcikTur {
  cagrilar: AracCagrisi[];
  coz: (c: BeyinCikti) => void;
  zamanlayici: ReturnType<typeof setTimeout>;
}

export class McpBeyin implements Beyin {
  readonly ad = "mcp";
  private _temasSinir: number;
  private _turSinir: number;
  private _simdi: () => number;

  private _sonTemas = -Infinity;
  /** Köprünün teslim ettiği, ajanın henüz almadığı girdi. */
  private _siradaki: { girdi: BeyinGirdisi; coz: (c: BeyinCikti) => void } | null = null;
  /** Ajanın aldığı ve araç çağrılarının toplandığı tur. */
  private _acikTur: AcikTur | null = null;
  /** Girdi bekleyen ajan çağrısı. */
  private _bekleyen: { coz: (s: BekleSonucu) => void; zamanlayici: ReturnType<typeof setTimeout>; etiket?: unknown } | null = null;
  /** Talimat bu oturumda gönderildi mi — temas kopunca sıfırlanır. */
  private _talimatGitti = false;

  constructor(ayar: McpBeyinAyari = {}) {
    this._temasSinir = ayar.temasZamanAsimiMs ?? 60_000;
    // Bir Haiku turu ~3 sn. 60 sn fazlasıyla yeter; ajan tur ortasında ölürse
    // köprü en fazla bu kadar bekler.
    this._turSinir = ayar.turZamanAsimiMs ?? 60_000;
    this._simdi = ayar.simdi ?? Date.now;
  }

  async hazirMi(): Promise<boolean> { return this._temasTaze(); }

  /** Temas kopuksa kaç saniyedir; bağlıysa 0. Sağ lob buna bakar (R1). */
  get kesikSaniye(): number {
    if (this._temasTaze()) return 0;
    if (!Number.isFinite(this._sonTemas)) return 1;   // hiç bağlanmadı
    return Math.max(1, Math.round((this._simdi() - this._sonTemas) / 1000));
  }

  // ── Köprü tarafı ─────────────────────────────────────────────────────────

  dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    // R1: ajan yoksa köprüyü BEKLETME. Boş cevap, dünya sağ lobla sürer.
    if (!this._temasTaze()) {
      return Promise.resolve({ metin: "", cagrilar: [], bilgi: { model: this.ad, mcp: "temas yok" } });
    }
    return new Promise<BeyinCikti>((coz) => {
      this._siradaki = { girdi, coz };
      if (this._bekleyen) {
        const b = this._bekleyen;
        this._bekleyen = null;
        clearTimeout(b.zamanlayici);
        b.coz(this._turuAc());
      }
    });
  }

  // ── Ajan tarafı (MCP araçları) ───────────────────────────────────────────

  /** `dunya_bekle`: açık turu kapatır, sonra sıradaki girdiyi bekler. */
  bekle(azamiMs: number, etiket?: unknown): Promise<BekleSonucu> {
    this._temasEt();
    this._turuKapat();                        // "turum bitti"
    if (this._siradaki) return Promise.resolve(this._turuAc());

    // Önceki bekleyen varsa (ajan üst üste çağırdı) onu sessizle bırak.
    if (this._bekleyen) {
      clearTimeout(this._bekleyen.zamanlayici);
      this._bekleyen.coz({ sessiz: true });
    }
    return new Promise<BekleSonucu>((coz) => {
      const zamanlayici = setTimeout(() => {
        if (this._bekleyen?.coz === coz) this._bekleyen = null;
        this._temasEt();                      // sessiz bekleyen ajan KOPUK değildir
        coz({ sessiz: true });
      }, Math.max(0, azamiMs));
      this._bekleyen = { coz, zamanlayici, etiket };
    });
  }

  /** Bir `dunya_*` aracı: ÇALIŞTIRILMAZ, açık tura eklenir. */
  cagri(ad: string, girdi: unknown): { ok: boolean; mesaj: string } {
    this._temasEt();
    if (!this._acikTur) {
      return { ok: false, mesaj: "No situation is being handled right now. Call dunya_bekle first, then act." };
    }
    this._acikTur.cagrilar.push({ ad, girdi });
    return {
      ok: true,
      mesaj: ad === "dunya_sor"
        ? "Looked. The answer arrives with your next dunya_bekle."
        : "Queued. It is carried out when you call dunya_bekle.",
    };
  }

  /**
   * Yeni ajan oturumu başladı (MCP `initialize`). Talimat yeniden gitmeli.
   *
   * Canlıda bulundu: ajan oturumu bitti, denetleyici hemen yeniden başlattı.
   * Temas hiç kopmadığı için (60 sn dolmadı) yeni oturum talimatı ALMAYACAKTI
   * — kuralsız bir Orion. Oturum başlangıcı temastan ayrı bir olaydır.
   */
  oturumBasladi(): void { this._talimatGitti = false; }

  /**
   * Ajanın bağlantısı KOPTU (HTTP isteği kapandı → ajan öldü). Temas HEMEN
   * kopar: köprü ölü ajana girdi teslim etmeye çalışmaz, sağ lob devralır (R1).
   *
   * `etiket` verilirse yalnızca O isteğin beklemesi iptal edilir: denetleyici
   * ajanı hızla yeniden başlatırsa eski bağlantının kopma sinyali YENİ ajanın
   * beklemesini öldürmesin.
   */
  bekleIptal(etiket?: unknown): void {
    const b = this._bekleyen;
    if (!b || (etiket !== undefined && b.etiket !== etiket)) return;
    this._bekleyen = null;
    clearTimeout(b.zamanlayici);
    b.coz({ sessiz: true });        // cevap gidecek bir yer yok; söz yine de kapanır
    this._sonTemas = -Infinity;
  }

  /** MCP `tools/list` için: protokol araçları + `dunya_bekle`. İkinci liste yok. */
  araclar(): AracTanimi[] { return [...araclariUret(), BEKLE_ARACI]; }

  // ── İç ──────────────────────────────────────────────────────────────────

  /**
   * TEMAS = AÇIK BAĞLANTI. Bekleyen bir `dunya_bekle` varsa ajan canlıdır —
   * süre ne olursa olsun. Ölçüldü: 25 sn'lik bekleme hem pahalı (her
   * "quiet" bir model turu) hem de ajanın oturumu bitirmesine yol açıyordu;
   * bekleme uzayınca süreye dayalı temas canlı ajanı ölü sanardı.
   */
  private _temasTaze(): boolean {
    return this._bekleyen !== null || this._simdi() - this._sonTemas < this._temasSinir;
  }

  private _temasEt(): void {
    // Temas kopmuştu → yeni oturum: talimat yeniden gitsin.
    if (!this._temasTaze()) this._talimatGitti = false;
    this._sonTemas = this._simdi();
  }

  /** Sıradaki girdiyi ajana ver, tur aç. */
  private _turuAc(): BekleSonucu {
    const s = this._siradaki!;
    this._siradaki = null;
    // K8: bağlam sözleşmesi diğer beyinlerle AYNI. Geçmiş metne girmez —
    // ajanın kendi bağlamı birikiyor (spec 05 §2). Talimat oturumda bir kez.
    // Satır sözleşmesi YOK: ajan gerçek araç çağırıyor (bkz. BaglamSecenek).
    const { sistem, kullanici } = baglamMetni(s.girdi, { gecmis: false, satirSozlesmesi: false });
    const metin = this._talimatGitti ? kullanici : `${sistem}\n\n${kullanici}`;
    this._talimatGitti = true;

    const tur: AcikTur = {
      cagrilar: [],
      coz: s.coz,
      // Ajan turu hiç kapatmazsa köprü sonsuza kadar beklemez.
      zamanlayici: setTimeout(() => { if (this._acikTur === tur) this._turuKapat(); }, this._turSinir),
    };
    this._acikTur = tur;
    return { metin };
  }

  private _turuKapat(): void {
    const t = this._acikTur;
    if (!t) return;
    this._acikTur = null;
    clearTimeout(t.zamanlayici);
    t.coz({ metin: "", cagrilar: t.cagrilar, bilgi: { model: this.ad } });
  }
}
