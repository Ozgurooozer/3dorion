# Tur 3 karnesi (olc_cift.py)
olc_cift.py cfd1de337c2f11cf | cift.json 8d6ca2424d9b54bc | etiketli cf46cbceab2b29fc | çift: 65 tutuldu, 0 atıldı []

## Dil tespiti (T6): doğru oran, koşul bazında
| tr | en | tr_ascii | tr_yazim | en_yazim | genel |
|---|---|---|---|---|---|
| 100% | 98% | 100% | 100% | 94% | 98% |

## Eşleşmiş çiftler: doğruluk (65 çift; belleğin tamamı, dil kısıtsız)
| aday | tr | en | tr_ascii | tr_yazim | en_yazim | EN−TR fark [95% AA] | yalnız EN doğru / yalnız TR doğru |
|---|---|---|---|---|---|---|---|
| b0 | 42% | 37% | 42% | 26% | 26% | -5 [-12, +3] | 2 / 5 |
| c1 | 69% | 68% | 55% | 58% | 62% | -2 [-14, +11] | 9 / 10 |
| c3 | 80% | 89% | 74% | 77% | 80% | +9 [-2, +20] | 10 / 4 |
| e1 | 71% | 74% | 72% | 66% | 62% | +3 [-9, +15] | 10 / 8 |
| e2 | 69% | 75% | 72% | 72% | 69% | +6 [-8, +20] | 13 / 9 |

makro-F1 (tr / en): b0 0.39/0.36, c1 0.66/0.68, c3 0.79/0.88, e1 0.70/0.74, e2 0.68/0.74

İngilizce encoder seçimi (kalibrasyon EN doğruluğu, n=57): {'e1': '44%', 'e2': '46%'} → seçilen **e2**

## H2 (B0 → dil → TR: C1 / EN: e2), τ_H2 = 0.61
kalibrasyon: yola giden 50, doğru 50, yanlış 0, kesinlik 100.0%

### Gerçek sözler (71; etiketler onaysız)
| sistem | yola giden | doğru | yanlış | kesinlik | kapsama |
|---|---|---|---|---|---|
| B0 | 17 | 17 | 0 | 100% | 74% |
| H2 | 23 | 19 | 4 | 83% | 83% |
H2'nin B0'a eklediği doğru yol: 2 | eklediği yanlış yol: 4
H2 yanlış yola giden: [('ee', 'hareket', 'sohbet'), ('ne oldu?', 'sorgu', 'sohbet'), ('ne yapıyorsun', 'sorgu', 'sohbet'), ('neler yapabilirsin', 'sorgu', 'sohbet')]
H2'nin kurtardığı (B0 kaçırdı): ['ner görüyorsun', 'odada başka neler var']
tartışmasız (68 söz): B0 doğru 17 / H2 doğru 19, H2 yanlış 4

### Çift koşulları: etiketi hareket/sorgu olan çiftlerde LLM'siz DOĞRU yol oranı (yanlış yol sayısı)
| sistem | tr | en | tr_ascii | tr_yazim | en_yazim |
|---|---|---|---|---|---|
| B0 | 14% (0) | 11% (0) | 14% (0) | 0% (0) | 0% (0) |
| H2 | 71% (2) | 57% (1) | 32% (1) | 32% (3) | 25% (2) |

## Gecikme (tek söz, 130 çift metni; p50 / p95 ms) ve parametre
- c1: 37.7 / 42.1 ms, 149M
- c3: 32.0 / 36.0 ms, 278M
- e1: 6.2 / 7.2 ms, 23M
- e2: 11.4 / 13.0 ms, 33M
