// world/surfaces/tahtaYazisi.ts — Beyaz tahtanın METİN mantığı. SAF.
//
// NEDEN VAR: `yaz` niyeti protokolde tanımlı ve LLM'e araç olarak sunuluyor,
// ama çağrıldığında HER SEFERİNDE hata dönüyordu:
//   "`yaz` avatarın işi değil: tahta yüzeyi (world/surfaces) yürütür."
// O yüzey hiç yazılmamıştı. Odadaki beyaz tahta bir dekordu; Orion kendi
// ofisinde hiçbir şey yazamıyordu.
//
// Bu dosya yalnızca "hangi kelime hangi satıra düşer" sorusunu çözer.
// Babylon yok, ölçü birimi PİKSEL değil SÜTUN — çizim katmanı ayrı.
//
// Taşma davranışı: tahta dolunca EN ESKİ satırlar düşer (kaydırma). Sessizce
// yutmak yerine kaç satır düştüğü sayılır; `temizle` ile bilinçli silinir.
"use strict";

export interface TahtaAyari {
  /** Bir satıra sığan azami karakter. */
  sutun?: number;
  /** Tahtaya sığan azami satır. */
  satir?: number;
}

/**
 * Metni satırlara böler: önce açık satır sonlarına, sonra KELİME sınırına.
 *
 * Kelime sınırından bölmek şart: tahta insan okuması içindir, terminal
 * değildir. Sığmayan tek bir uzun kelime (uzun bir dosya yolu gibi) zorla
 * kırılır — yoksa satır taşar ve ekrandan çıkar.
 */
export function satirlaraBol(metin: string, sutun: number): string[] {
  const cikti: string[] = [];
  const enAz = Math.max(1, sutun);

  for (const ham of metin.replace(/\r/g, "").split("\n")) {
    const kelimeler = ham.split(/[ \t]+/).filter((w) => w.length > 0);
    if (kelimeler.length === 0) { cikti.push(""); continue; }

    let satir = "";
    for (const kelime of kelimeler) {
      // Tek başına sığmayan kelime: zorla kır.
      if (kelime.length > enAz) {
        if (satir) { cikti.push(satir); satir = ""; }
        let kalan = kelime;
        while (kalan.length > enAz) {
          cikti.push(kalan.slice(0, enAz));
          kalan = kalan.slice(enAz);
        }
        satir = kalan;
        continue;
      }
      const aday = satir ? `${satir} ${kelime}` : kelime;
      if (aday.length <= enAz) { satir = aday; continue; }
      cikti.push(satir);
      satir = kelime;
    }
    if (satir) cikti.push(satir);
  }
  return cikti;
}

export interface YazmaSonucu {
  /** Tahtaya eklenen satır sayısı. */
  eklenen: number;
  /** Yer açmak için düşen en eski satır sayısı. Sessiz kayıp olmasın. */
  dusen: number;
}

export class TahtaMetni {
  private _sutun: number;
  private _azamiSatir: number;
  private _satirlar: string[] = [];
  private _kirli = true;

  constructor(ayar: TahtaAyari = {}) {
    this._sutun = Math.max(8, ayar.sutun ?? 40);
    this._azamiSatir = Math.max(1, ayar.satir ?? 12);
  }

  get sutun(): number { return this._sutun; }
  get azamiSatir(): number { return this._azamiSatir; }
  /** Tahtadaki satırlar (kopya — dışarıdan bozulamaz). */
  satirlar(): string[] { return [...this._satirlar]; }
  get bos(): boolean { return this._satirlar.length === 0; }
  /** Çizim katmanı için: son çizimden beri değişti mi. */
  get kirli(): boolean { return this._kirli; }
  temizlendi(): void { this._kirli = false; }

  /** Tahtayı siler. */
  sil(): void {
    if (this._satirlar.length === 0) return;
    this._satirlar = [];
    this._kirli = true;
  }

  /**
   * Tahtaya yazar. `temizle` verilirse önce siler.
   *
   * Boş/boşluk metin yazmak tahtayı KİRLETMEZ: model boş bir `yaz` çağırırsa
   * tahtada boş satır birikmesin.
   */
  yaz(metin: string, temizle = false): YazmaSonucu {
    if (temizle) this.sil();
    const yeni = satirlaraBol(metin, this._sutun).filter((s, i, d) =>
      // Baştaki ve sondaki boş satırları at; ortadakiler paragraf ayracıdır.
      s.trim() !== "" || (i > 0 && i < d.length - 1));
    if (yeni.length === 0) return { eklenen: 0, dusen: 0 };

    this._satirlar.push(...yeni);
    let dusen = 0;
    while (this._satirlar.length > this._azamiSatir) {
      this._satirlar.shift();
      dusen++;
    }
    this._kirli = true;
    return { eklenen: yeni.length, dusen };
  }
}

/**
 * Ekran ölçüsünden sütun/satır sayısı türetir.
 *
 * Tahta 2.8 × 1.5 m. İnsan el yazısı yüksekliği ~6 cm olsun: 1.5 / 0.075
 * ≈ 20 satır fazla sıkışık olur; okunurluk için daha az satır ve daha büyük
 * yazı tercih edildi. Sütun, en/boy oranından ve karakter en/boy oranından
 * (yaklaşık 0.55) türetilir.
 */
export function tahtaOlcusu(genislikM: number, yukseklikM: number, satir = 10): { sutun: number; satir: number } {
  const satirYuksekligiM = yukseklikM / satir;
  const karakterGenisligiM = satirYuksekligiM * 0.55;
  const sutun = Math.max(12, Math.floor(genislikM / karakterGenisligiM));
  return { sutun, satir };
}
