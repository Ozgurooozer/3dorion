# Ön kayıt — hafızadaki yazım hatalı komut sözleri (2026-10-15)

**Soru:** `orion-hafiza.json` içindeki "takip etr" gibi yazım hatalı komut sözlerini, bilinen komut sözlerine yakınlıkla
güvenle ayırıp önemlerini `KOMUT_ONEMI`ye (3) indirebilir miyiz? Silme YOK (yalnız önem), çünkü bu bir tahmin.

**Kural adayı (B):** söz, `sozuNormalle` ile normalleşir. Komut sayılmıyorsa (komutCoz/takipEylemi/sohbetEylemi hepsi yok)
VE sözlükçe (L) bir komut sözüne Damerau–Levenshtein uzaklığı ≤ 1 ise "yazım hatalı komut". En az 6 karakter.
**Sözlükçe L:** aynı hafızada komut olarak tanınan bütün sözler (bugünkü `komutCoz`/`takipEylemi`/`sohbetEylemi` ile). Dar
tutuldu: kesinlik, kapsama değil; kapsama ayrı bir ölçüm (gerçek karar kaydı sözleri) ister.

**Ölçüt (ölçmeden ÖNCE):**
- K1 kapsama: hafızadaki 59 "normal söz"den en az 3'ü yakalanmalı (yoksa kural değmez).
- K2 yanlış yakalama = yakalanan sözün anlamı eşleştiği komutunkinden FARKLI olması. Hedef 0. Tek tane bile varsa kural
  uygulanmaz (yanlışlıkla önem indirmek geri alınabilir ama güveni bozar; Ozyn okur).
- K3 idempotent ve komutu olmayan, bilgi taşıyan sözlere dokunmaz (kontrol: "ben terminalde claude kullanırım").
- Sonuç ne çıkarsa yazılır; tarama tek hafıza (86 anı, tek denek) olduğundan "genel çalışır" denmez.

## SONUÇLAR
Koşu: 2026-10-15, `orion-hafiza.json` (86 anı) kopyası okunarak; dosyaya yazılmadı. Sözlükçe L = 16 tanınan komut sözü;
komut olmayan söz = 60.

- **K1 (≥3 yakalama): BAŞARISIZ.** Yakalanan 1/60: "takip etr" ~ "takip et". Gerçek tek örnek bu.
- K2 (yanlış yakalama 0): sağlandı, ama anlamsız çünkü yakalama yalnız 1 ("takip etr" zaten "takip et"in yazım hatası).
- K3: "ben terminalde claude kullanırım" yakalanmadı (sağlandı).

**Neden az:** yazım hatalı sözlerin çoğu komut sözlüğünün DIŞINDAKİ isteklerin hatası ("zamani degiştir", "shader deiştir",
"terinale claude yaz", "fallow me", "mönitörü aç" tanındı). Bunlar L'de yok (L hafızadaki tanınan komutlardan türüyor), uzaklık
1 yetmiyor, "gçz/gek/tw/gor" gibi tek heceli kısaltmaların komşusu yok. Sözlükçeyi genişletmek (örn. ortam/terminal
kalıpları) ayrı bir ön kayıt ister ve tek hafıza üzerinde zaten 1–3 anıyı etkiler.

**Karar:** B uygulanmadı (ön kayıtlı eşik karşılanmadı). Kod yazılmadı. Kalan 59 söz için yol: elle silme aracı (A) —
duvarda anıya tıkla, "unut". Tek denek (bir hafıza) olduğundan "yazım kuralı genel olarak işe yaramaz" denmez; yalnız bu
sözlükçe ve bu hafıza için değmedi.
