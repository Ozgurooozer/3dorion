// uygulama/senaryolar/gorudene.ts — `3dorion.bat gorudene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── "Orion görüyor mu?" canlı kanıtı (?gorudene=1) ────────────────────────
// T6b'nin asıl iddiasını kilitler: Orion masasındaki terminali GÖRÜYOR ve
// gürültüyü görmezden geliyor. Sentetik klavye olayları yerine pty'ye
// DOĞRUDAN yazılır — terminaldene'de tuşlar xterm'in girdi yoluna ulaşmıyordu.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Kopru } from "../../bridge/kopru.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { monitor, monitoreGec } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

  const gorulen: { blok: string; terfi: boolean }[] = [];
  (window as unknown as { _goruKanca?: (b: string, t: boolean) => void })._goruKanca =
    (blok, terfi) => { gorulen.push({ blok, terfi }); };

  await bekle(1200);
  await monitoreGec();
  await bekle(1800);
  // Kabuk PowerShell'e geçince `-NoLogo` yüzünden açılış afişi KALMADI,
  // yani sınanacak bir "afiş bloğu" yok. Doğru soru zaten şuydu: açılış
  // beyni gereksiz yere uyandırıyor mu? Blok çıkmaması da geçerli cevaptır.
  kontrol("acilista gereksiz terfi yok",
    gorulen.every((g) => !g.terfi),
    `blok=${gorulen.length} terfi=${gorulen.filter((g) => g.terfi).length}`);
  const afisSonrasi = gorulen.length;

  // DİKKAT: pty ev dizininde açılır, proje dizininde değil. İlk sürümde
  // burada `dir /b node_modules` vardı; ev dizininde o klasör YOK, komut
  // "File Not Found" ile başarısız oluyordu ve süzgeç onu haklı olarak
  // terfi ettiriyordu. Test yanlıştı, süzgeç değil — komut gerçekten
  // BAŞARILI ve rutin olmalı.
  monitor.yaz("dir\r");
  await bekle(3000);
  const rutin = gorulen.slice(afisSonrasi);
  kontrol("rutin dizin listesi beyni uyandirmadi",
    rutin.length > 0 && rutin.every((g) => !g.terfi), `blok=${rutin.length}`);
  const rutinSonrasi = gorulen.length;

  monitor.yaz("boyle_bir_komut_yok\r");
  await bekle(3000);
  const hatali = gorulen.slice(rutinSonrasi);
  kontrol("gercek kabuk hatasi Orion'a ULASTI",
    hatali.some((g) => g.terfi),
    `blok=${hatali.length} terfi=${hatali.filter((g) => g.terfi).length}`);

  for (const r of sonuc) console.log("[GORUDENE] " + r);
  // TS, atamayı .then içinde göremediği için kopru'yu null sanıyor;
  // otodene'deki `orion` ile aynı kalıp: yerel olarak tipe geri al.
  const k = d.kopru as Kopru | null;
  console.log(`[GORUDENE] sayac=${JSON.stringify(k?.sayac() ?? null)}`);
  console.log("[GORUDENE] ozet: " +
    sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
}
