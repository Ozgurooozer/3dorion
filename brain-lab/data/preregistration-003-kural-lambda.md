# Ön-kayıt 003 — Kural sinapsları için daha uzun iz (λ 0,97) (TASLAK)

**Durum: TASLAK — Ozyn onayı bekleniyor.** Onaylanmadan kod yazılmaz, koşu yapılmaz. Bu belge tarama (ayar
seed'leri 1–10) içindir; test seed'lerine (≥ 1001) dokunmaz ve dondurulmaz.

## Soru
A3.2 (2026-09-26): kural sinapsı (rec → Go/NoGo) doğru yöne büyüyor ama 40 odada ortalama 0,02'ye çıkıyor; kapasite
fikstüründe etki ~0,25'te görünüyordu (~15 kat açık). Teşhis, kredi açığının iki parçası olduğunu söyledi: temsil
(eleştirmen yemeğe değer vermiyor) ve iz (öğünde iz çok sönmüş; λ 0,9 → ~%14 kalıyor, λ 0,97 → ~%32).
**Yalnız iz parçasını, öbürünü sabit tutarak sınıyoruz:** kural sinapslarının izi uzarsa açık kapanır mı?

## Toplantı durumu (bağlayıcı olanı gizlemiyorum)
- A3 kredi açığı toplantısı (2026-09-26) "hatıraya kredi taşıma"yı seçti (K 36 · U 32 · T 29 · A 23 · E 14).
- Ozyn sonra kök nedeni öne aldı; toplantının K1–K4'ü askıda, A3b önce teşhis → tasarım → toplantı.
- Bu deney bir **teşhis taramasıdır**, K kararı değildir: sonuç ne olursa olsun A3b tasarımına girdi olur.
  Seçenek 2'yi seçtirme iddiası yoktur; Ozyn "önce bunu ölçelim" derse koşar.

## Değişiklik (tek anahtar, varsayılan kapalı)
`LearningParams.ruleLambda: number | null` (varsayılan null). Doluysa, izi güncellenirken yalnız kural sinapsları
(`from` bir `rec.*` düğümü; büyüyen adaylar dahil) λ yerine `ruleLambda` kullanır. `senseFilter` bu iş için uygun
değil: hangi duyuların öğreneceğini süzer, izin ömrünü değil. İkinci `Learner` da gerekmiyor; iki iz döngüsü
(`updateEligibility`, `updateEligibilityDirect`) tek yerde λ'yı seçer.
- null iken beyin **bit-birebir** aynı: kayıtlı bir denek baştan eğitilip değerlendirmesi kayıtla karşılaştırılır.
- Testler önce, düşman: (a) null = aynı iz, (b) yalnız `rec.*` kenarlarının izi değişir, gerçek duyu kenarlarınınki
  değişmez, (c) iz λ^n ile söner (ızgara, 0 ve sınır değerleri), (d) aralık dışı değer atar. Ardından bozma denemesi.

## Koşullar (experiments/conditions.ts)
| kod | ne |
|---|---|
| H3B / H3D | mevcut (λ 0,9), yeniden koşulmaz; kayıtlı satırlar referans |
| H3B97 | H3B + ruleLambda 0,97 |
| H3D97 | H3D + ruleLambda 0,97 |
| H3B99 | H3B + ruleLambda 0,99 (doz-yanıt; iz kararsızlaşırsa görünür) |

Oda 3 (kıt: 5 yemek, enerji 0,8), tohum 1–5 × iki doğuş grubu, 40 eğitim + 10 değerlendirme; ikiz ve bağlı beden
kontrolleri mevcut düzenekle. Eğitim dünyası ve gürültü H3B/H3D ile aynı: fark yalnız λ.

## Öngörüler (koşmadan önce; çürütme ölçütüyle)
| # | öngörü | çürütülürse |
|---|---|---|
| Ö1 | H3B97'de ortalama kural ağırlığı (40 oda sonu) H3B'nin ≥ 2 katı | < 1,5 kat: iz darboğaz değil |
| Ö2 | Yine de kapasite fikstürünün (~0,25) altında kalır: < 0,12 | ≥ 0,12: iz asıl darboğazdı, A3b aciliyeti düşer |
| Ö3 | Değerlendirmede hafıza kullanımı (recall-a3) H3B97'de H3B'den iyi ama ikizle fark anlamsız (p > 0,05) | fark anlamlıysa "iz yetti" adayı, `curut` gerekir |
| Ö4 | H3B99, H3B97'den iyi değil (iz uzadıkça yanlış öğünlere de kredi sızar) | iyiyse doz-yanıt monoton, sınır daha da yukarıda |
| Ö5 | Aç/tok ayrımı yine yok: kural tok halde de Go'yu artırır (temsil açığı sürer) | ayırıyorsa iz, temsil açığını da örtmüş |

Ö2 ve Ö5 baştan "iz tek başına yetmez" yönünde: teşhis (kritik yemek değerini 3,5× eksik öğreniyor, açlık×yemek
etkileşimi yok) bunu söylüyordu. Yanılırsam bu da bilgidir.

## Durma kuralı
- H3B97 Ö1'i tutturmazsa H3D97/H3B99 koşulmaz; kısa rapor.
- Herhangi bir kararsızlık (ağırlık wMax'a yapışması, ölüm oranı artışı): dur, raporla.

## Ölçüler
Birincil: ortalama kural ağırlığı (`diagnose.ts`), recall-a3 hafıza kullanımı. İkincil: meanDrive, survival, steering.
Doğrulama (20 + CROSS) ve çürütme (`curut`) yalnız Ö1–Ö3 birlikte umut verirse, Ozyn onayıyla.
