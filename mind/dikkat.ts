// mind/dikkat.ts — Hangi algının BEYNE gideceğine karar verir.
//
// Bu dosya projenin maliyet tavanıdır. Dünya saniyede 20 kez durum üretiyor;
// bunların hepsi LLM bağlamına girerse saatlik maliyet patlar ve "AI dünyada
// yaşıyor" iddiası bir token sayacına dönüşür.
//
// KATI KURAL (protocol/SOZLESME.md): `tik` algısı hiçbir koşulda beyin
// kanalına yazılmaz. Dikkat, `VARSAYILAN_KANAL` haritasını yalnızca
// DARALTABİLİR — genişletemez. Testle zorlanır.
//
// Bağımlılık: yalnızca protocol/. Babylon yok, ağ yok, saf karar.
"use strict";
import type { Algi, AlgiTur } from "../protocol/algi.ts";
import { VARSAYILAN_KANAL } from "../protocol/algi.ts";

export interface DikkatAyari {
  /** Dakikada beyne gidebilecek azami mesaj. Bütçe freni. */
  dakikaBasinaAzami?: number;
  /** Aynı olayın tekrarı bu süre içinde yutulur (ms). */
  tekrarPenceresiMs?: number;
  /** Terminal çıktısı bu sıklıktan daha sık gönderilmez (ms). */
  terminalKisMs?: number;
  /** Test edilebilirlik: zaman kaynağı dışarıdan verilebilir. */
  simdi?: () => number;
}

export interface DikkatKarari {
  gecsin: boolean;
  /** Neden geçmedi — sessiz düşme yok, ayıklanabilir olsun. */
  sebep?: "tik_yasak" | "yerel_kanal" | "tekrar" | "kisildi" | "butce" | "onemsiz";
}

/** Beyni ilgilendirmeyen, yalnızca gürültü üreten olay adları. */
const ONEMSIZ_OLAYLAR = new Set(["kamera_degisti", "ipucu", "fare_kilidi"]);

export class Dikkat {
  private _azami: number;
  private _tekrarMs: number;
  private _terminalMs: number;
  private _simdi: () => number;

  /** Beyne gönderilen mesajların zaman damgaları (kayan pencere). */
  private _gecmis: number[] = [];
  private _sonAnahtar = new Map<string, number>();
  private _sonTerminal = 0;
  private _sayac = { gecen: 0, dusen: 0 };

  constructor(ayar: DikkatAyari = {}) {
    this._azami = ayar.dakikaBasinaAzami ?? 20;
    this._tekrarMs = ayar.tekrarPenceresiMs ?? 4000;
    this._terminalMs = ayar.terminalKisMs ?? 2500;
    this._simdi = ayar.simdi ?? (() => Date.now());
  }

  /**
   * Bu algı beyne gitsin mi?
   *
   * Sıra önemli: önce mutlak yasaklar, sonra kanal, sonra kısma/tekrar,
   * en son bütçe. Böylece "neden düşmedi" sorusunun tek bir cevabı olur.
   */
  karar(a: Algi): DikkatKarari {
    // 1) Mutlak yasak. Bu satır kaldırılamaz; testi var.
    if (a.tur === "tik") return { gecsin: false, sebep: "tik_yasak" };

    // 2) Varsayılan kanal yerelse, dikkat onu beyne YÜKSELTEMEZ.
    if (VARSAYILAN_KANAL[a.tur as AlgiTur] !== "beyin") {
      // İstisna: başarısız niyet sonucu beyni ilgilendirir — Orion yapamadığını
      // bilmezse aynı emri tekrar eder.
      if (!(a.tur === "sonuc" && a.sonuc.durum === "hata")) {
        return { gecsin: false, sebep: "yerel_kanal" };
      }
    }

    // 3) Önemsiz olay gürültüsü
    if (a.tur === "olay" && ONEMSIZ_OLAYLAR.has(a.ad)) {
      return { gecsin: false, sebep: "onemsiz" };
    }

    const t = this._simdi();

    // 4) Terminal çıktısı kısma: akan bir derleme çıktısı her satırda beyni uyandırmasın.
    if (a.tur === "terminal") {
      if (t - this._sonTerminal < this._terminalMs) {
        this._sayac.dusen++;
        return { gecsin: false, sebep: "kisildi" };
      }
    }

    // 5) Tekrar penceresi
    const anahtar = this._anahtar(a);
    const onceki = this._sonAnahtar.get(anahtar);
    if (onceki !== undefined && t - onceki < this._tekrarMs) {
      this._sayac.dusen++;
      return { gecsin: false, sebep: "tekrar" };
    }

    // 6) Bütçe freni (kayan 60 sn penceresi)
    this._gecmis = this._gecmis.filter((x) => t - x < 60_000);
    if (this._gecmis.length >= this._azami) {
      this._sayac.dusen++;
      return { gecsin: false, sebep: "butce" };
    }

    this._gecmis.push(t);
    this._sonAnahtar.set(anahtar, t);
    if (a.tur === "terminal") this._sonTerminal = t;
    this._sayac.gecen++;
    return { gecsin: true };
  }

  /** Gözlem: kaç algı geçti, kaçı düştü. HUD ve bütçe denetimi okur. */
  sayac(): { gecen: number; dusen: number } { return { ...this._sayac }; }

  /** Konuşma gibi bir şey olduğunda kısıtları sıfırla — kullanıcı bekletilemez. */
  sifirla(): void {
    this._gecmis = [];
    this._sonAnahtar.clear();
    this._sonTerminal = 0;
  }

  /** Tekrar tespiti için algının kimliği. İçerik değişirse anahtar değişir. */
  private _anahtar(a: Algi): string {
    switch (a.tur) {
      case "duydum":   return `duydum:${a.metin}`;
      case "olay":     return `olay:${a.ad}`;
      case "terminal": return `terminal:${a.kuyruk.slice(-120)}`;
      case "sonuc":    return `sonuc:${a.sonuc.durum}:${a.sonuc.not ?? ""}`;
      case "gordum":   return `gordum:${a.ne}:${a.metin}`;
      case "yakin":    return `yakin:${a.nesneler.map((n) => n.ad).join(",")}`;
      case "dunya":    return "dunya";
      default:         return a.tur;
    }
  }
}
