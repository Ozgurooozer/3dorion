// mind/komutRiski.ts — Önerilen komut ne yapar? BİLGİLENDİRİR, engellemez.
//
// SINIRINI BAŞTAN YAZIYORUM: bu bir güvenlik sınırı DEĞİLDİR. Kara liste
// atlatılabilir (`rm` yerine `cmd /c del`, değişken içine gizleme, base64,
// takma ad...). Bunu "koruma" diye sunmak yanlış güven yaratır.
//
// GERÇEK sınır tektir: komut, Ozyn bir tuşa basmadan ÇALIŞMAZ. Bu dosyanın
// işi o tuşa basacak insanı BİLGİLENDİRMEK — "bu komut dosya siliyor" demek,
// silmeyi engellemek değil.
//
// Neden yine de değerli: onay ekranında "npm test" ile "rmdir /s /q ." aynı
// görünmemeli. Bilgilendirilmiş onay, onaysız güvenden iyidir.
//
// SAF: bağımlılık yok, yan etki yok.
"use strict";

export type RiskSeviyesi = "okur" | "degistirir" | "yikici";

export interface RiskKarari {
  seviye: RiskSeviyesi;
  /** İnsan-okur gerekçeler. Onay ekranında gösterilir. */
  nedenler: string[];
}

/** Geri dönüşü olmayan / geniş etkili işler. */
const YIKICI: { desen: RegExp; neden: string }[] = [
  { desen: /\brm\s+-[a-z]*r|\brm\s+-[a-z]*f|\brmdir\s+\/s|\bdel\s+\/[sq]/i, neden: "dosya/dizin siliyor" },
  { desen: /\bformat\b|\bmkfs\b|\bdiskpart\b/i, neden: "disk biçimlendirme" },
  { desen: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|push\s+.*--force|push\s+.*-f\b)/i, neden: "geri alınamaz git işlemi" },
  { desen: />\s*\/dev\/sd|\bdd\s+if=/i, neden: "ham disk yazımı" },
  { desen: /\bshutdown\b|\breboot\b|\bStop-Computer\b/i, neden: "makineyi kapatıyor" },
  { desen: /\b(taskkill|kill)\s+.*\/f|\bStop-Process\b.*-Force/i, neden: "süreçleri zorla sonlandırıyor" },
  { desen: /\bReg(istry)?\s+delete\b|\bRemove-Item\b.*HK(LM|CU):/i, neden: "kayıt defterini siliyor" },
  // PowerShell silme. Kabuk PowerShell'e geçtiği için EN OLASI yıkıcı komut
  // bu — ama ilk sürümde listede YOKTU, liste Unix/cmd odaklıydı ve
  // `Remove-Item -Recurse -Force` yalnızca "değiştirir" çıkıyordu.
  // Kabuk değişiminin fark edilmemiş yan etkisiydi; kendi testim ortaya çıkardı.
  { desen: /\bRemove-Item\b|\bri\b\s+-(Recurse|Force)/i, neden: "PowerShell ile öğe siliyor" },
  { desen: /\bClear-Content\b/i, neden: "dosya içeriğini siliyor" },
  { desen: /\bchmod\s+-R|\bicacls\b.*\/grant/i, neden: "izinleri değiştiriyor" },
];

/** Durumu değiştiren ama genelde geri alınabilir işler. */
const DEGISTIRIR: { desen: RegExp; neden: string }[] = [
  { desen: /\bnpm\s+(i|install|uninstall|update)\b|\byarn\s+add\b|\bpnpm\s+add\b/i, neden: "bağımlılık kuruyor/kaldırıyor" },
  { desen: /\bpip\s+install\b|\bcargo\s+add\b|\bgo\s+get\b/i, neden: "paket kuruyor" },
  { desen: /\bgit\s+(commit|merge|rebase|checkout|switch|pull|push|stash)\b/i, neden: "depoyu değiştiriyor" },
  { desen: /\b(mv|move|ren|rename|cp|copy|mkdir|touch|New-Item)\b/i, neden: "dosya sistemi değişikliği" },
  { desen: />{1,2}\s*\S/, neden: "çıktıyı dosyaya yazıyor" },
  { desen: /\b(curl|wget|Invoke-WebRequest|iwr)\b/i, neden: "ağdan indiriyor" },
  { desen: /\bsetx?\b|\$env:|\bexport\s+\w+=/i, neden: "ortam değişkeni değiştiriyor" },
  { desen: /\bollama\s+(pull|rm|create)\b/i, neden: "model indiriyor/siliyor" },
];

/**
 * Komutu sınıflandırır.
 *
 * Varsayılan "okur" DEĞİL: tanınmayan bir komut ne yaptığını bilmediğimiz
 * komuttur ve onay ekranında zararsız görünmemelidir. Tanınmayanlar
 * "degistirir" sayılır — güvenli taraf, bilgilendirmede de geçerli.
 */
export function komutRiski(komut: string): RiskKarari {
  const k = komut.trim();
  if (!k) return { seviye: "degistirir", nedenler: ["boş komut"] };

  const nedenler: string[] = [];
  let yikici = false, degistirir = false;

  for (const y of YIKICI) if (y.desen.test(k)) { yikici = true; nedenler.push(y.neden); }
  for (const d of DEGISTIRIR) if (d.desen.test(k)) { degistirir = true; nedenler.push(d.neden); }

  // Zincirleme: `&&`, `;`, `|` ile birden fazla komut. Onay ekranında
  // kullanıcı ikinci komutu gözden kaçırabilir — açıkça söylenmeli.
  if (/&&|\|\||;\s*\S|\|\s*\S/.test(k)) {
    degistirir = true;
    nedenler.push("birden fazla komut zincirlenmiş");
  }

  if (yikici) return { seviye: "yikici", nedenler };
  if (degistirir) return { seviye: "degistirir", nedenler };

  // Bilinen salt-okunur komutlar.
  if (/^(ls|dir|cat|type|Get-Content|head|tail|grep|Select-String|findstr|echo|pwd|cd|git\s+(status|log|diff|show|branch)|npm\s+(test|run|ls)|npx\s+tsc|node\s+--version|ollama\s+(list|ps)|where|which|whoami)\b/i.test(k)) {
    return { seviye: "okur", nedenler: ["salt-okunur görünüyor"] };
  }

  return { seviye: "degistirir", nedenler: ["tanınmayan komut — ne yaptığı bilinmiyor"] };
}

/** Onay ekranında gösterilecek tek satırlık etiket. */
export function riskEtiketi(r: RiskKarari): string {
  const ad = r.seviye === "yikici" ? "YIKICI" : r.seviye === "degistirir" ? "DEGISTIRIR" : "okur";
  return `${ad}: ${r.nedenler.join(", ")}`;
}
