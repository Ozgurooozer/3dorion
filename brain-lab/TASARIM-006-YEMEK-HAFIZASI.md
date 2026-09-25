# Tasarım 006: Yemek hafızası (işaret değeri)

Tarih: 2026-09-25 · Durum: **Ozyn onayladı** ("onaylıyorum, notu yaz, kodu yaz, tasarımı yaz", 2026-09-25).

## Neden: ölçülenler

- **Seri 005a/005b.** S1n, bağlı bedenini geçiyor ama tek bir karar öğrenmiş: "yemek tam öndeyse ileri". Yemek
  yandayken o tarafa dönmüyor; yönlendirme bağlı bedeninkinden farksız.
  - Kıt odada durum: S1n %39 yaşıyor. Elle yazılmış "önündeyse ileri" kuralı %81 yaşıyor. Öğretmenli beyin %72
    yaşıyor ve 10/10 yemeğe dönüyor.
  - Yani yapı yönü taşıyabiliyor; eksik olan öğretme sinyali.
- **Teşhis** (`experiments/diagnose-critic.ts`, K1n'in 10 öğreneni). Eleştirmenin yemek ışınlarındaki ağırlıkları
  eğitim boyunca toplam 2,24 birim oynuyor ve +0,026'da bitiyor. Duvar ışınları, bias ve hareket duyusu da aynı
  biçimde çalkalanıyor. Eleştirmen anlam biriktirmiyor, gürültü biriktiriyor. İki sebep:
  1. **Tek adımlık kredi (TD(0)).** Yemeğin değeri yalnızca yemekten hemen önceki ana yazılıyor. Birkaç saniye
     önceki görüş hiç pay almıyor.
  2. **Her duyudan birden öğrenme.** Açlık, bias ve hareket duyusu ödülün çoğunu emiyor; işaretlere pay kalmıyor.
- **Ozyn'in gözlemi:** "Yemek yenince yemeğe dair bilgisi, hafızası gelişmeli."

## Fikir

Yemek yenince, **az önce görülen şeylere** bir değer yazılır. Böylece yemeği görmek bile, yemekten önce, küçük bir
iyi haber olur. Beden yemeğe döndüğünde ya da yaklaştığında bu haber artar, uzaklaştığında azalır. Artış ve azalış,
o anki hareketi öğreten dopamine eklenir. Böylece dönüşün kendisi ödüllenir.

Biyolojik karşılığı: Pavlov tipi işaret–sonuç öğrenmesi (amigdala / orbitofrontal korteks). Dopamin yanıtının
ödülden onu haber veren işarete kayması (Schultz 1997). Açık bir "yemeğe git" kuralı yazılmıyor. Hangi görüntünün
neyi haber verdiğini beden kendi yaşadığından çıkarıyor.

## Kural

Yeni parça: `learning/cue-memory.ts` (`CueMemory`). Ağırlıkları deftere `cue/` önekli `critic` kayıtları olarak
yazılır; defter kuralı aynen geçerli.

- **İşaretler (x):** yalnız ışın duyuları, üç tür birden (`ray{i}.food`, `ray{i}.wall`, `ray{i}.threat`), değeri
  1 − uzaklık/menzil.
  - Yemeği biz seçmiyoruz; hangi işaretin değerli olduğunu kural buluyor.
  - Tehlike de aynı kuralla eksi değer alabilir: yaralanma çıktıyı eksiye çeker. Böylece ceza da etiketlenmeden
    keşfedilebilir (Ozyn: "cezayı da kendisi keşfetsin"). Bu odada sınanmaz; oda 2 için hazır.
- **Hafıza izi (az önce görülen):** `e_f ← max(λ·e_f, x_f(s))` (yerine koyan iz; ilk sürüm birikimliydi, `e_f ← λ·e_f + x_f(s)`, K2'de savruldu, bkz. defter 2026-09-25), λ 0,95. Yarı ömrü ~14 tik (0,7 sn), etkisi ~2–3 sn.
  Her odanın başında sıfırlanır.
- **Değer:** `Φ(s) = Σ v_f · x_f(s)`
- **Öğrenme (işaretlere sınırlı TD(λ)):** `δc = r + γ·Φ(s′) − Φ(s)`, `v_f ← v_f + α·δc·e_f / max(1, Σx²)`.
  - r: yalnız bir dürtünün azalması, yani yemeğin verdiği rahatlama. İlk iki sürüm tüm sonuçtan (hareket ve açlık maliyeti dahil) öğrendi; kıt odada yemek "kötü" öğrenildi (K3, bkz. defter). Zarar ileride ayrı bir kaçınma belleğine.
  - Ölümde Φ(s′) = 0.
  - Adım, işaretlerin enerjisine bölünür (normalleştirilmiş LMS). Teşhiste görülen çalkantıya karşı.
- **Öğretmeye katkısı:** Go/NoGo'yu öğreten δ'ya `κ·(γ·Φ(s′) − Φ(s))` eklenir.
  - Bu, "potansiyele dayalı ödül biçimlendirme"dir (Ng, Harada & Russell 1999). Bir yolun toplam ödülünü
    değiştirmez, en iyi davranışı bozmaz; yalnızca krediyi doğru ana taşır.
  - Yemek yandan öne gelince ya da yaklaşınca Φ artar ve o dönüş ödüllenir.
- **Parametreler** (varsayılan): λ 0,95 · γ 0,99 · α 0,05 · κ 1 · kuantum 0,0005.
- **Anahtar:** `AgentSpec.cue`. Kapalıyken (varsayılan) beyin bit-aynıdır.

## Bilinçli olarak dışarıda bırakılanlar

- **Açlığa bağlı değer** ("tokken yemek daha az değerli"): Φ'yi açlıkla çarpmak, açlık artarken yemek görmeyi
  sahte biçimde ödüllendirir. İlk sürümde yok; gerekirse ayrı anahtar.
- **Çalışma hafızası** (görüşten çıkan yemeği hatırlamak): ayrı iş, açık sorulara yazıldı.
- **Mevcut eleştirmen:** değişmiyor. İşaret hafızası onun yanında ayrı bir parça; karşılaştırma temiz kalsın diye.

## Sınama

- **Birim testleri:**
  - İz sönümü.
  - Yemekten k tik önce görülen işaret λ^k ile orantılı pay alıyor.
  - Görülmeyen işaret değişmiyor.
  - Yara, görülen işareti eksiye çekiyor.
  - Φ yaklaşınca artıyor; biçimlendirmenin işareti doğru.
  - Donmuşken yazma yok; her değişiklik defterde ve defter yeniden oynatılabiliyor.
  - Oda başında iz sıfırlanıyor; kötü parametreler reddediliyor.
- **Mutasyon denemesi.**
- **Gerileme:** anahtar kapalıyken K1n yeniden koşulur; kayıtlı sonuçla birebir aynı çıkmalı.
- **Deney:** kıt oda (ROOM3), seed 1–5 × iki grup, bağlı kontrol otomatik. Koşullar:
  - K2: S1n + işaret hafızası, κ 1
  - K2x: κ 3
  - Karşılaştırma: K1n (aynı doğumlar).

  Öngörüler, koşmadan önce `LAB-DEFTERI.md`'ye yazılır.
- **Umut verirse:** taze seed'lerde çürütme paketi (`npm run exp -- curut K2`).
