// bridge/satirSozlesmesi.ts — Modelin doğal cevabını eyleme çeviren sözleşme.
//
// NEDEN BU, JSON DEĞİL:
//
// DÜZELTME — ilk gerekçe yanlıştı. İlk ölçüm şöyleydi:
//   şema YOK 8.6 sn doğru | şema VAR 60 sn abort | + retry 90 sn abort
// ve bundan "OpenCode'un yapısal çıktısı askıda kalıyor" sonucunu çıkarmıştım.
// Aynı sonda tekrar koşulunca sonuç TERSİNE döndü (şemasız abort, şemalı 9.5
// sn). Gövdeye bakınca asıl sebep göründü: OpenRouter `free-models-per-day`
// kotası dolmuş, 429 dönüyor, OpenCode 60-75 sn yeniden deneyip pes ediyor.
// Yani gecikmeyi şema değil kota üretiyordu; iki ölçüm de o gürültüyü ölçmüş.
//
// Satır sözleşmesi yine de tercih ediliyor, ama DOĞRU gerekçeyle:
//   - Ayrıştırma bizde: sağlayıcının şema desteğine bağımlı değiliz.
//   - Deterministik ve testlenebilir (bu dosyanın testleri sağlayıcısız koşar).
//   - Model doğal cevabını yazmaya devam eder; söz ile eylem aynı turda çıkar.
// Kalıcı çözüm yine MCP kaydı (Aşama 3) — bu ara çözüm, gerçek tool-calling
// kadar sağlam DEĞİL.
//
// Onun yerine HAFİF bir satır sözleşmesi: model doğal cevabını yazar, eylem
// gerekiyorsa sonuna tek satır ekler. Metin modelleri bunu JSON'dan çok daha
// güvenilir izler; ayrıştırması deterministik ve test edilebilir.
//
// Sözleşme (her biri isteğe bağlı, cevabın SONUNDA):
//   KOMUT: <tek satır komut> | GEREKCE: <kısa neden>
//   TAHTA: <tahtaya yazılacak>
//   GIDILECEK: <odada gidilecek yerin adı>
//
// `GIDILECEK:` etiketi ÖLÇÜMLE seçildi. İlk sürüm `GIT:` kullanıyordu ve bu
// `git` PROGRAMIYLA çakışıyordu: model "pencereye git" emrini bir kabuk
// komutu sanıp `KOMUT: pencereye git` üretiyor, anlamsız bir öneri onay
// kapısına düşüyordu. Üç etiket aynı iki senaryoda karşılaştırıldı:
//
//   GIT:        1/2 doğru, 1 kez KOMUT'a kaçtı
//   YURU:       2/2 doğru, 1 kez KOMUT'a kaçtı
//   GIDILECEK:  2/2 doğru, 0 kaçak
//
// SAF: bağımlılık yok, yan etki yok.
"use strict";

export interface AyrilmisYanit {
  /** Seslendirilecek doğal cevap (sözleşme satırları ayıklanmış). */
  soz: string;
  /** Önerilen komut — onay kapısına gider. */
  komut?: { metin: string; gerekce: string };
  /** Tahtaya yazılacak metin. */
  tahta?: string;
  /** Gidilecek çapa adı. */
  git?: string;
  /** Odaya bakma isteği — `dunya_sor` sorgusu. */
  bak?: string;
}

/** `BAK:` ile sorulabilecek şeyler. Protokoldeki `sor.ne` ile aynı küme. */
const BAK_SORULARI = ["onumde", "yakin", "oyuncu", "dunya"] as const;

/**
 * Sözleşmenin modele anlatımı. Kısa ve örnekli; her turda bağlama giriyor.
 *
 * ANLATIM İngilizce, ETİKETLER değil (2026-09-18, spec 06 §6.8): `KOMUT:`,
 * `TAHTA:`, `GIDILECEK:`, `BAK:` ve `onumde` gibi değerler protokol kimliği —
 * aşağıdaki `ETIKET` regexi ve `BAK_SORULARI` onları birebir arıyor. Çevirmek
 * sözleşmeyi sessizce kırardı. Örneklerdeki SÖZ kısmı Türkçe kalır: Orion'un
 * sesi Türkçe ve örnek tam da sesin nasıl olacağını gösteriyor.
 */
export const SOZLESME_TALIMATI = [
  "Write your answer in normal sentences, in Turkish.",
  "If an ACTION is needed, append it at the END of your answer as its own line:",
  "KOMUT: <single line to run in the terminal> | GEREKCE: <short reason>",
  "TAHTA: <note to write on the whiteboard>",
  "GIDILECEK: <name of the place in the room to walk to>",
  "BAK: <onumde|yakin|oyuncu|dunya>   — to see what is in the room",
  "If no action is needed, do not write these lines at all.",
  // ÖRNEKLER anlatımdan güçlü çıktı (ölçüm): örneksiz cevaplar markdown'a ve
  // kod bloğuna kaçıyordu; örnekli cevaplar kısa ve sözleşmeye uygun geldi.
  "",
  "EXAMPLES (note that the spoken part is Turkish):",
  "Screen shows `pyhton ... not recognized` → `pyhton` yazım hatası, doğrusu `python`.",
  "KOMUT: python --version | GEREKCE: yazım hatası düzeltmesi",
  "Ozyn said 'kapıya git' → Tamam.",
  "GIDILECEK: kapi",
  "Ozyn said 'önünde ne var' → Bakıyorum.",
  "BAK: onumde",
  "Write ONLY the line you need; never write one you do not.",
].join("\n");

/**
 * Satır başındaki etiketi ve değerini yakalar.
 *
 * Değer `(.*)` — BOŞ da olabilir. Bilerek: `(.+)` kullanıldığında "KOMUT:"
 * gibi boş bir etiket satırı desene uymuyor ve SÖZE karışıyordu; Orion
 * "KOMUT TAHTA" diye sesli okuyordu. Boş etiket sözleşme satırıdır, atılır.
 */
const ETIKET = /^\s*(KOMUT|TAHTA|GIDILECEK|BAK)\s*:\s*(.*)$/i;

/**
 * Modelin ham cevabını söze ve eylemlere ayırır.
 *
 * Sözleşme satırları cevabın herhangi bir yerinde olabilir (model bazen başa
 * koyar); hepsi ayıklanır ve geri kalan söz olur.
 */
export function yanitAyir(ham: string): AyrilmisYanit {
  const sonuc: AyrilmisYanit = { soz: "" };
  const sozSatirlari: string[] = [];

  for (const satir of ham.replace(/\r/g, "").split("\n")) {
    const m = ETIKET.exec(satir);
    if (!m) { sozSatirlari.push(satir); continue; }

    const etiket = (m[1] ?? "").toUpperCase();
    const deger = (m[2] ?? "").trim();
    if (!deger) continue;

    if (etiket === "KOMUT") {
      // `KOMUT: x | GEREKCE: y` — gerekçe aynı satırda, ayraçla.
      const parca = deger.split(/\|\s*GEREKCE\s*:\s*/i);
      const komut = (parca[0] ?? "").trim().replace(/^`+|`+$/g, "");
      const gerekce = (parca[1] ?? "").trim();
      if (komut) {
        // Gerekçe zorunlu (protocol/dogrula.ts reddeder); yoksa makul bir
        // varsayılan üretmek yerine modelin sözünü gerekçe sayarız — sessizce
        // düşürmek, öneriyi tamamen kaybetmekten kötüdür.
        sonuc.komut = { metin: komut, gerekce: gerekce || "Orion önerdi" };
      }
    } else if (etiket === "TAHTA") {
      sonuc.tahta = deger;
    } else if (etiket === "GIDILECEK") {
      sonuc.git = deger.replace(/[`"']/g, "").trim();
    } else if (etiket === "BAK") {
      // Yalnızca bilinen sorular kabul edilir; uydurma sorgu protokolde
      // reddedilir ve beyne "geçersiz" diye geri döner — gereksiz tur.
      const q = deger.replace(/[`"'.]/g, "").trim().toLowerCase();
      if ((BAK_SORULARI as readonly string[]).includes(q)) sonuc.bak = q;
    }
  }

  sonuc.soz = sozSatirlari.join(" ")
    // Model bazen kod bloğu içinde komut yazıyor; söz olarak okunmasın.
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sonuc;
}

/** Ayrılmış yanıtı araç çağrılarına çevirir (köprünün beklediği biçim). */
export function cagrilaraCevir(a: AyrilmisYanit): { ad: string; girdi: Record<string, unknown> }[] {
  const c: { ad: string; girdi: Record<string, unknown> }[] = [];
  // Sıra önemli: önce git (yer değiştirme), sonra tahta (yakınlık gerektirir),
  // sonra söz, en son komut önerisi.
  // BAK en önde: bilgi almak diğer eylemlerden önce gelir ve sonucu beyne
  // geri beslenir (bir sonraki turda kullanılır).
  if (a.bak) c.push({ ad: "dunya_sor", girdi: { ne: a.bak } });
  if (a.git) c.push({ ad: "dunya_git", girdi: { hedef: { tip: "capa", ad: a.git } } });
  if (a.tahta) c.push({ ad: "dunya_yaz", girdi: { metin: a.tahta } });
  if (a.soz) c.push({ ad: "dunya_soyle", girdi: { metin: a.soz } });
  if (a.komut) c.push({ ad: "dunya_komut", girdi: { metin: a.komut.metin, gerekce: a.komut.gerekce } });
  return c;
}
