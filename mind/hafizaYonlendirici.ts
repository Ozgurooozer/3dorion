// mind/hafizaYonlendirici.ts — Bu uyanışta bağlama HANGİ hafıza parçası girer (spec 16 F4). Saf.
//
// Eskiden her uyanışta, sözle tek kelimesi ortak olan her anıdan 3 tanesi otomatik giriyordu; yerel
// 7B modelin bağlamı hem büyüyor hem kirleniyordu (canlı kayıt: hatırlananların çoğu eski hata ve
// terminal parçası). Yönlendirici LLM'den ÖNCE, söze bakarak karar verir. VARSAYILAN BOŞ: sorulmayan
// şey girmez (Ozyn, 2026-10-08: "sorulmaz ise bu bilgi contexte girmez").
//
// NEDEN KURAL, LLM ARACI DEĞİL (Ozyn'in kararı): hızlı, ölçülebilir, ve 7B modelin araç çağırma
// zayıflığından etkilenmez. Kaçırdığı sorular karar kaydına (`hafizaIstegi`) düşer, tablo büyür.
//
// TABLO TEK KAYNAK: kurallar `KURALLAR`da; testler tablodan türer. Kalıplar Türkçe karakterleri
// sadeleştirilmiş metinde aranır (ı→i, ş→s …): "neredesin", "nerdesin", "nerdesın" aynı.
// mind/komutSozlugu.ts'e DOKUNULMAZ: komut programı eşleşen söz LLM'i hiç uyandırmaz, buraya gelmez.
"use strict";
import type { Cekmece } from "./hafiza.ts";
import type { DurumIstegi } from "./durumDefteri.ts";

/** Çekmeceden nasıl getirilir: `ilgi` = sözle ortak kelimesi olanlar (eşikli), `son` = en yeniler. */
export interface CekmeceIstegi { cekmeceler: readonly Cekmece[]; mod: "ilgi" | "son"; adet: number }

export interface HafizaIstegi {
  durum: DurumIstegi[];
  cekmece: CekmeceIstegi[];
  /** Tetiklenen kuralların kimlikleri (karar kaydı; boş = hiçbir şey istenmedi). */
  kurallar: string[];
}

export interface YonlendiriciGirdisi {
  /** Bu uyanıştaki Ozyn sözleri (kesin). */
  sozler: readonly string[];
  /** Bu uyanışta terminal çıktısı var mı ve başarısız mı. */
  terminal?: "basarili" | "hatali";
  /** Bu uyanışta bir niyet başarısız oldu mu (Orion bir şeyi yapamadı). */
  niyetHatasi?: boolean;
  /** Odadaki yerlerin adları (çapa etiketleri) — sözde geçerse konum istenir. */
  yerAdlari?: readonly string[];
}

interface Kural {
  id: string;
  /** Sadeleştirilmiş, küçük harfli metinde aranır. */
  kalip: RegExp;
  durum?: DurumIstegi[];
  cekmece?: CekmeceIstegi;
  /** Örnek sözler — testler bunlardan türer (her biri bu kuralı tetiklemeli). */
  ornekler: readonly string[];
}

/** Türkçe harfleri sadeleştirir, küçültür: kalıplar ASCII yazılır. */
export function sadelestir(m: string): string {
  return m.toLocaleLowerCase("tr").replace(/[ıİ]/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a");
}

export const KURALLAR: readonly Kural[] = [
  { id: "konum.simdi", kalip: /\b(nere(de)?sin|nerdesin|neredesin|where are you|where r u)\b/,
    durum: ["konum"], ornekler: ["neredesin", "Orion nerdesin?", "where are you"] },
  { id: "konum.once", kalip: /\b(neredeydin|nerdeydin|nereye gittin|nerelerdeydin|where were you|where did you go|where have you been)\b/,
    durum: ["konum", "onceki_konum", "onceki_oturum"], ornekler: ["neredeydin", "where were you", "nereye gittin az önce"] },
  { id: "is.simdi", kalip: /\b(ne yapiyorsun|napiyorsun|n'?apiyorsun|what are you doing|what r u doing|what're you doing)\b/,
    durum: ["yapiyor", "son_is", "konum"], ornekler: ["ne yapıyorsun", "napıyorsun", "What are you doing?"] },
  { id: "is.once", kalip: /\b(ne yaptin|en son ne yaptin|neler yaptin|what did you do|what have you done|what did you just do)\b/,
    durum: ["son_is", "yapiyor"], ornekler: ["ne yaptın", "en son ne yaptın", "what did you do"] },
  { id: "konusma.gecmis", kalip: /\b(ne konus(tuk|mustuk)|neler konus(tuk|mustuk)|ne demistim|ne dedim|ne soylemistim|en son ne dedim|what did we talk|what were we talking|what did i (say|tell you)|what was i saying)\b/,
    durum: ["son_ozyn", "son_orion"], cekmece: { cekmeceler: ["konusma"], mod: "son", adet: 4 },
    ornekler: ["ne konuşmuştuk", "daha önce ne konuştuk", "ne demiştim sana", "what did we talk about"] },
  { id: "hatirla", kalip: /\b(hatirliyor musun|hatirlar misin|hatirla|unuttun mu|daha once|gecen sefer|dun|remember|last time|yesterday|earlier today|did you forget)\b/,
    cekmece: { cekmeceler: ["konusma", "is", "ders"], mod: "ilgi", adet: 3 },
    ornekler: ["hatırlıyor musun terminal süzgecini", "dün ne yaptık", "do you remember the filter"] },
];

/**
 * Sözün kalıbından bağımsız kurallar. BİLEREK YOK: "her söz turunda ilgili dersi getir". Faydalı
 * olabilir ("tahtaya otur" → "hata: tahtaya oturulmaz") ama Ozyn'in kuralı "sorulmayan girmez";
 * ders yalnız bir şey BAŞARISIZ olunca girer. Gerekirse ölçümle ayrı karar (spec 16 §6).
 */
export const DURUM_KURALLARI = {
  /** Terminal hatası: aynı komutun geçmiş hataları ve dersleri. */
  terminalHata: { id: "terminal.hata", cekmece: { cekmeceler: ["ders", "is"], mod: "ilgi", adet: 2 } as CekmeceIstegi },
  /** Orion bir şeyi yapamadı: aynı işten alınmış dersler. */
  niyetHata: { id: "niyet.hata", cekmece: { cekmeceler: ["ders"], mod: "ilgi", adet: 2 } as CekmeceIstegi },
  /** Sözde odadaki bir yerin adı geçti: Orion nerede olduğunu bilsin. */
  yerAdi: { id: "soz.yer", durum: ["konum"] as DurumIstegi[] },
} as const;

/** Bu uyanışın hafıza isteği. Varsayılan BOŞ. */
export function yonlendir(g: YonlendiriciGirdisi): HafizaIstegi {
  const durum = new Set<DurumIstegi>();
  const cekmece: CekmeceIstegi[] = [];
  const kurallar: string[] = [];
  const metin = sadelestir(g.sozler.join(" \n "));

  if (metin.trim()) {
    for (const k of KURALLAR) {
      if (!k.kalip.test(metin)) continue;
      kurallar.push(k.id);
      for (const d of k.durum ?? []) durum.add(d);
      if (k.cekmece) cekmece.push(k.cekmece);
    }
    const yer = (g.yerAdlari ?? []).some((y) => y && metin.includes(sadelestir(y)));
    if (yer) { kurallar.push(DURUM_KURALLARI.yerAdi.id); for (const d of DURUM_KURALLARI.yerAdi.durum) durum.add(d); }
  }
  if (g.terminal === "hatali") { kurallar.push(DURUM_KURALLARI.terminalHata.id); cekmece.push(DURUM_KURALLARI.terminalHata.cekmece); }
  if (g.niyetHatasi) { kurallar.push(DURUM_KURALLARI.niyetHata.id); cekmece.push(DURUM_KURALLARI.niyetHata.cekmece); }
  return { durum: [...durum], cekmece, kurallar };
}
