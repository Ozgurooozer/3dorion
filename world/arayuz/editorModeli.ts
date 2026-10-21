// world/arayuz/editorModeli.ts — DÜZENLEYİCİ PENCERESİ MODELİ (Yapı çubuğu · Hafıza sekmesi, spec 32): kirli mi, dışarıdan değişince ne yapılır, imleç yeri, girinti. SAF (DOM yok).
//
// Pencere (`editorPenceresi.ts`) yalnız çizer; "kaydedilmemiş değişiklik var mı", "diskteki dosya değişti — sessizce yenile mi, çakışma mı" ve Tab girintisi burada ve testli.
// Dışarıdan değişim (örn. Orion anlık hafızayı güncelledi) kuralı: kirli DEĞİLSE sessizce yenilenir; kirliyse ÇAKIŞMA — Ozyn'in yazdığı hiçbir şey sessizce ezilmez.
"use strict";

export interface DuzenleyiciDurumu {
  /** Düzenleyicideki (ekrandaki) metin. */
  metin: string;
  /** Diskte bilinen son hâl (açılışta okunan ya da son kaydedilen). */
  disk: string;
}

export const kirliMi = (d: DuzenleyiciDurumu): boolean => d.metin !== d.disk;

export type DiskKarari = "yok" | "yenile" | "catisma";

/** Disk `yeniDisk` oldu: değişmediyse yok; kirli değilse yenile; kirliyse çakışma. */
export function diskDegisti(d: DuzenleyiciDurumu, yeniDisk: string): DiskKarari {
  if (yeniDisk === d.disk) return "yok";
  return kirliMi(d) ? "catisma" : "yenile";
}

/** İmleç konumundan (0 tabanlı karakter sırası) 1 tabanlı satır ve sütun. */
export function imlecYeri(metin: string, konum: number): { satir: number; sutun: number } {
  const k = Math.max(0, Math.min(konum, metin.length));
  const onceki = metin.slice(0, k);
  const satir = onceki.split("\n").length;
  return { satir, sutun: k - (onceki.lastIndexOf("\n") + 1) + 1 };
}

export function sayilar(metin: string): { karakter: number; satir: number; sozcuk: number } {
  return { karakter: metin.length, satir: metin === "" ? 0 : metin.split("\n").length, sozcuk: (metin.match(/\S+/g) ?? []).length };
}

export interface GirintiSonucu { metin: string; bas: number; son: number }

/**
 * Tab / Shift+Tab. Seçim tek satırın içindeyse (ya da yoksa): Tab imlece girinti ekler, Shift+Tab satırın başındaki girintiyi azaltır.
 * Seçim birden çok satıra yayılıyorsa: seçili satırların hepsi girintilenir / girintisi azaltılır (kod düzenleyicilerdeki gibi); seçim yeni konumlara oturur.
 */
export function girintile(metin: string, bas: number, son: number, ters: boolean, girinti = "  "): GirintiSonucu {
  const b = Math.min(bas, son), s = Math.max(bas, son);
  const cokSatir = metin.slice(b, s).includes("\n");
  if (!ters && !cokSatir) return { metin: metin.slice(0, b) + girinti + metin.slice(s), bas: b + girinti.length, son: b + girinti.length };

  const satirBasi = metin.lastIndexOf("\n", b - 1) + 1;
  // Seçim bir satırın en başında bitiyorsa o son satır dahil edilmez.
  const bitis = s > b && metin[s - 1] === "\n" ? s - 1 : s;
  const sonSatirSonu = metin.indexOf("\n", bitis) < 0 ? metin.length : metin.indexOf("\n", bitis);
  const satirlar = metin.slice(satirBasi, sonSatirSonu).split("\n");
  let ilkDegisim = 0, toplamDegisim = 0;
  const yeni = satirlar.map((satir, i) => {
    let degisim: number, sonuc: string;
    if (!ters) { sonuc = girinti + satir; degisim = girinti.length; }
    else {
      const bosluk = /^ */.exec(satir)![0].length;
      const al = satir.startsWith("\t") ? 1 : Math.min(bosluk, girinti.length);
      sonuc = satir.slice(al); degisim = -al;
    }
    if (i === 0) ilkDegisim = degisim;
    toplamDegisim += degisim;
    return sonuc;
  });
  const govde = yeni.join("\n");
  const yeniMetin = metin.slice(0, satirBasi) + govde + metin.slice(sonSatirSonu);
  // İlk satırdaki değişim başlangıcı, toplam değişim bitişi kaydırır (başlangıç satır başının gerisine düşmesin).
  return { metin: yeniMetin, bas: Math.max(satirBasi, b + ilkDegisim), son: Math.max(satirBasi, s + toplamDegisim) };
}
