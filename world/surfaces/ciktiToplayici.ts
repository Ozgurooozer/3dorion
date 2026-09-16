// world/surfaces/ciktiToplayici.ts — Akan çıktıyı KOMUT birimine toplar.
//
// ÖLÇÜMDEN DOĞDU (mind/akis-olcum.ts, gerçek çıktıyla):
// Süzgeç parça başına karar verdiğinde tek bir `npm test` koşusu beyni
// 11 kez uyandırdı — çünkü testlerin ADLARI içinde "hata" kelimesi geçiyor.
// Sorun desende değil BİRİMDE idi: anlamlı birim parça değil, komuttur.
//
// Çözüm sözcüksel değil yapısal: çıktı AKARKEN sus, akış DURUNCA bir kez
// konuş. Bir test başlığı bunu kandıramaz; sessizlik metinden bağımsızdır.
//
// SAF: zaman dışarıdan verilir, zamanlayıcı yok, Babylon yok.
"use strict";

export interface ToplayiciAyari {
  /** Çıktı bu kadar süre durursa komut bitmiş sayılır (ms). */
  sessizlikMs?: number;
  /** Hiç durmayan akışta bile bu süre sonunda bir rapor çıkar (ms). */
  azamiBekleyisMs?: number;
  /** Rapora girecek azami satır; üstü özetlenir. */
  azamiSatir?: number;
}

export class CiktiToplayici {
  private _sessizlikMs: number;
  private _azamiBekleyisMs: number;
  private _azamiSatir: number;

  private _tampon: string[] = [];
  private _sonEkleme = 0;
  private _ilkEkleme = 0;

  constructor(ayar: ToplayiciAyari = {}) {
    this._sessizlikMs = ayar.sessizlikMs ?? 800;
    this._azamiBekleyisMs = ayar.azamiBekleyisMs ?? 8000;
    this._azamiSatir = ayar.azamiSatir ?? 16;
  }

  /** Yeni çıktı parçası geldi (ciktiFarki çıktısı). */
  ekle(fark: string, simdiMs: number): void {
    if (!fark.trim()) return;
    if (this._tampon.length === 0) this._ilkEkleme = simdiMs;
    for (const s of fark.split("\n")) this._tampon.push(s);
    this._sonEkleme = simdiMs;
  }

  /** Bekleyen içerik var mı (tanılama için). */
  get bekleyenSatir(): number { return this._tampon.length; }

  /**
   * Zaman beklemeden hemen topla. Kabuk "komut bitti" (OSC 133 D) dediğinde
   * kullanılır: gerçek sınır bilindiğinde sessizlik tahminine gerek yoktur.
   */
  zorlaTopla(): string | null {
    if (this._tampon.length === 0) return null;
    const blok = this._ozetle(this._tampon);
    this._tampon = [];
    return blok;
  }

  /**
   * YALNIZCA azami bekleyiş freni. Kabuk entegrasyonu varken sessizlik
   * penceresi kullanılmaz (sınırı kabuk söyler), ama hiç bitmeyen bir süreç
   * (dev server, tail -f) Orion'u kalıcı kör bırakmasın diye bu fren kalır.
   */
  azamiBekleyistenTopla(simdiMs: number): string | null {
    if (this._tampon.length === 0) return null;
    if (simdiMs - this._ilkEkleme < this._azamiBekleyisMs) return null;
    return this.zorlaTopla();
  }

  /**
   * Rapor zamanı geldiyse toplanmış bloğu döner, yoksa null.
   *
   * İki tetik: (1) akış durdu, (2) hiç durmuyor ama azami bekleyiş doldu —
   * ikincisi olmazsa sonsuz akan bir süreç (tail -f, dev server) Orion'u
   * kalıcı olarak kör bırakırdı.
   */
  topla(simdiMs: number): string | null {
    if (this._tampon.length === 0) return null;
    const durdu = simdiMs - this._sonEkleme >= this._sessizlikMs;
    const cokBekledi = simdiMs - this._ilkEkleme >= this._azamiBekleyisMs;
    if (!durdu && !cokBekledi) return null;

    const blok = this._ozetle(this._tampon);
    this._tampon = [];
    return blok;
  }

  /**
   * Uzun blok özeti: baş (komut satırı bağlamı) + son (sonuç) korunur,
   * orta atlanır. `npm test`in 190 satırında da, bir derlemede de sonuç
   * SONDADIR — bu yüzden kuyruk ağırlıklı.
   */
  private _ozetle(satirlar: string[]): string {
    const dolu = satirlar.filter((s, i) => s.trim() !== "" || i === 0);
    if (dolu.length <= this._azamiSatir) return dolu.join("\n").trim();

    const bas = 3;
    const son = this._azamiSatir - bas - 1;
    const atlanan = dolu.length - bas - son;
    return [
      ...dolu.slice(0, bas),
      `… ${atlanan} satır atlandı …`,
      ...dolu.slice(dolu.length - son),
    ].join("\n").trim();
  }
}
