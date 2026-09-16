// world/surfaces/kabukIsaret.ts — OSC 133 kabuk entegrasyonu ayrıştırıcısı.
//
// NEDEN VAR (üç ayrı ölçüm aynı yere işaret etti):
//   1. `tsc --noEmit` temiz geçince HİÇBİR ŞEY yazmıyor — "başarıyla bitti"
//      bilgisi metin tabanlı bir süzgeç için tamamen görünmez.
//   2. Windows hata metinleri tutarsız: cmd "is not recognized...", dir
//      "File Not Found", PowerShell "is not recognized as the name of a
//      cmdlet" — hiçbiri "error"/"fail" içermiyor.
//   3. Metne bakan süzgeç, hata ANLATAN bir test adını hata OLAN bir olaydan
//      ayıramıyor.
//
// Çözüm metni daha iyi yoklamak değil: kabuğun kendisi komutun bittiğini ve
// ÇIKIŞ KODUNU söylüyor. Çıkış kodu yalan söylemez; "error" kelimesi geçen
// bir commit mesajı onu kandıramaz.
//
// Diziler (doğrulandı — Windows Terminal / WezTerm / iTerm2 belgeleri ve
// bu makinede node-pty üzerinden canlı ölçüm):
//   OSC 133 ; A ST          istem başlıyor
//   OSC 133 ; B ST          komut girişi başlıyor
//   OSC 133 ; C ST          komut çıktısı başlıyor
//   OSC 133 ; D ; <kod> ST  komut bitti, çıkış kodu (kod isteğe bağlı)
// ST = BEL (\x07) veya ESC \ (\x1b\\).
//
// SAF: Babylon yok, pty yok, zaman yok. Girdi ham metin, çıktı temiz metin +
// işaret listesi.
"use strict";

export type IsaretTuru = "istem" | "girdi" | "cikti" | "bitti";

export interface KabukIsareti {
  tur: IsaretTuru;
  /** Yalnızca `bitti` için ve kabuk bildirdiyse. cmd.exe kod YAYMAZ. */
  kod?: number;
  /**
   * Komutun çalışma süresi (ms) — `bitti` işaretinde doldurulur.
   *
   * Neden gerekli: "başarıyla bitti" bilgisinin söylenmeye DEĞER olup
   * olmadığını süre belirler. `cd` 5 ms sürer ve kimse beklemez; `npm test`
   * 3 sn sürer ve Ozyn ekrana bakar. Ölçüt "Ozyn bekledi mi" sorusudur.
   *
   * Başlangıç anı: kullanıcının Enter'ı (pty'ye giden ``). OSC 133 `C`
   * işareti bu kabuk entegrasyonunda yayılmıyor; `B` ise istem gösterilince
   * gelir ve YAZMA süresini de içerir — o yüzden ikisi de kullanılmadı.
   */
  sureMs?: number;
}

/**
 * Akış ayrıştırıcısı.
 *
 * DURUMLU olması şart: pty verisi rastgele yerlerden bölünür ve bir OSC
 * dizisi iki parçaya ayrılabilir (`\x1b]133;` bir parçada, `D;0\x07`
 * diğerinde). Durumsuz bir ayrıştırıcı bunu kaçırır ve yarısını ekrana
 * çöp olarak basar.
 */
export class KabukIsaretAyiklayici {
  /** Yarım kalmış dizi parçası — sonraki veriyle birleştirilir. */
  private _artik = "";

  /**
   * Ham pty verisini işler.
   * @returns `metin` — işaretleri AYIKLANMIŞ, terminale yazılacak metin.
   *          `isaretler` — bu parçada bulunan işaretler, sırayla.
   */
  isle(ham: string): { metin: string; isaretler: KabukIsareti[] } {
    const veri = this._artik + ham;
    this._artik = "";

    const isaretler: KabukIsareti[] = [];
    let metin = "";
    let i = 0;

    while (i < veri.length) {
      const bas = veri.indexOf("\x1b]133;", i);
      if (bas === -1) {
        // Dizi başlangıcı yok. Ama sonda YARIM bir "\x1b]13" olabilir.
        const kuyruk = this._yarimBaslangic(veri, i);
        metin += veri.slice(i, veri.length - kuyruk);
        if (kuyruk) this._artik = veri.slice(veri.length - kuyruk);
        break;
      }

      metin += veri.slice(i, bas);
      const govdeBas = bas + 6; // "\x1b]133;".length

      // Sonlandırıcıyı ara: BEL ya da ESC \
      const bel = veri.indexOf("\x07", govdeBas);
      const esc = veri.indexOf("\x1b\\", govdeBas);
      let son = -1, sonUzunluk = 0;
      if (bel !== -1 && (esc === -1 || bel < esc)) { son = bel; sonUzunluk = 1; }
      else if (esc !== -1) { son = esc; sonUzunluk = 2; }

      if (son === -1) {
        // Dizi henüz tamamlanmadı: kalanı sakla, sonraki veriyle birleştir.
        this._artik = veri.slice(bas);
        break;
      }

      const isaret = cozumle(veri.slice(govdeBas, son));
      if (isaret) isaretler.push(isaret);
      i = son + sonUzunluk;
    }

    return { metin, isaretler };
  }

  /** Bekleyen yarım veri var mı (tanılama/test için). */
  get bekleyen(): string { return this._artik; }

  /**
   * Verinin sonundaki, "\x1b]133;" önekinin YARIM hâli olabilecek kuyruğun
   * uzunluğu. Örn. veri "...abc\x1b]13" ile bitiyorsa 4 döner.
   */
  private _yarimBaslangic(veri: string, en_az: number): number {
    const onek = "\x1b]133;";
    const azami = Math.min(onek.length - 1, veri.length - en_az);
    for (let n = azami; n > 0; n--) {
      if (veri.endsWith(onek.slice(0, n))) return n;
    }
    return 0;
  }
}

/** "A" | "B" | "C" | "D" | "D;0" gövdesini işarete çevirir. */
function cozumle(govde: string): KabukIsareti | null {
  const parca = govde.split(";");
  switch (parca[0]) {
    case "A": return { tur: "istem" };
    case "B": return { tur: "girdi" };
    case "C": return { tur: "cikti" };
    case "D": {
      const ham = parca[1];
      if (ham === undefined || ham === "") return { tur: "bitti" };
      const kod = Number.parseInt(ham, 10);
      return Number.isFinite(kod) ? { tur: "bitti", kod } : { tur: "bitti" };
    }
    default: return null;  // tanınmayan alt komut sessizce atılır
  }
}

/**
 * PowerShell için kabuk entegrasyonu kodu.
 *
 * cmd.exe KULLANILMADI: `PROMPT` değişkeni `%ERRORLEVEL%`'i her istemde
 * yeniden genişletmez, bu yüzden Microsoft'un belgelediği cmd dizisi bile
 * `D`'yi ÇIKIŞ KODU OLMADAN yayar — yani asıl aradığımız sinyali vermez.
 * PowerShell'in `prompt` fonksiyonu `$LASTEXITCODE`'a erişebilir.
 *
 * `$?` ile `$LASTEXITCODE` birlikte kullanılır: yerleşik cmdlet'ler
 * `$LASTEXITCODE` yazmaz (yalnızca yerel exe'ler yazar), bu yüzden tek
 * başına ikisi de yetmez.
 */
export function powershellEntegrasyonu(): string {
  const E = "$([char]27)";
  const BEL = "$([char]7)";
  return [
    "function prompt {",
    "  $k = if ($?) { 0 } else { 1 };",
    "  if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { $k = $LASTEXITCODE };",
    `  "${E}]133;D;$k${BEL}${E}]133;A${BEL}PS $($executionContext.SessionState.Path.CurrentLocation)> ${E}]133;B${BEL}"`,
    "}",
  ].join(" ");
}
