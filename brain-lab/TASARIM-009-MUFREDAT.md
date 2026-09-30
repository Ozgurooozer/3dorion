# TASARIM-009 — Müfredatla öğretim, ölüm ve acı, yön, duruma bağlı değer, kaliteli karar, kalıtım

**Durum:** Aşama 0 onaylı (plan, Ozyn 2026-09-30). Aşama 1–6 plan düzeyinde onaylı; her birinin ayrıntısı bu belgeye
koşmadan önce eklenir, mimari genişleme (3–6) ayrıca onaydan geçer.

## Neden

2026-09-30 çürütme sonucu: H3B97 gerçekten öğreniyor ama yönsüz ("yemek/hatıra/açlık → ileri"). Yemek tam önde değilse
umursamıyor. Eleştirmen "açken yemek değerli, tokken değil" diyemiyor (doğrusal, açlık × yemek terimi yok). Ölüm
öğretmiyor. Doğuştan yön içgüdüsü (0,3) öğrenilmiş yönsüz ağırlıkların (~2,0) altında boğuluyor.

Ozyn'in yönü: basitten başla, her seferinde bir şey ekle, gerektiği kadar eğit, paralel ve farklı şekillerde eğit, karar
hıza değil kaliteye göre; ölüm deneyimini sonraki nesle içgüdü olarak aktarsın (Lamarck ve Darwin/Baldwin paralel).

## Aşama 0 — düzenek (beyin değişmez)

### 0.1 Gerektiği kadar eğitim (`--egitim auto`)
- Eğitim 20 bölümlük bloklarla. Her bloğun **eğitim dürtüsü** ölçülür: değerlendirmeyle aynı tanım (her tik açlık² + yara²,
  ölünce son değerde kalır, 3000 tike tamamlanır). Davranışa etkisi yok; yalnız okunur.
- Durma: en az 4 blok; son 3 bloğun en iyisi, önceki bloklardaki en iyiden 0,01'den az iyiyse dur. Tavan 1000 bölüm.
- Neden bu kural: A2'de (2026-09-29) 40 → 200 bölüm uzun izli koşulları yarı yarıya iyileştirdi; sabit uzunluk "öğrenmiyor"
  ile "henüz" ayrımını yapamıyor. Eşikler ölçülmeden seçildi; Kart 0 bunları ölçer (nerede duruyor, 200'ün ötesinde kazanç
  var mı).
- **Kontrollerin adilliği:** ikiz öğrenmez (değişmez). CROSS ve LOCAL, eşleştiği öğrenenin eğitildiği bölüm sayısı kadar
  eğitilir (öğrenenler önce, kontroller sonra). Böylece "kontrol daha kısa eğitildi" kazancı açıklayamaz.

### 0.2 Müfredat
- Koşul `curriculum: [{ world, episodes? }]` taşıyabilir. Aynı denek, aynı ajan ve aynı defterle aşamaları sırayla yaşar;
  bölüm numarası (dolayısıyla dünya ve gürültü seed'i) aşamalar boyunca sürer.
- Değerlendirme koşulun `world`'ünde (son aşamanın odası); denek bu odaya doğar.
- Her aşamanın ışınları aynı olmalı (beyin aynı duyularla doğar); farklıysa hata.

### 0.3 Yön odası (ROOM-S)
- Yeni isteğe bağlı oda ayarı `foodSide: { min, max, near, far }` (radyan / metre). Varsa her yemek — ilk yerleşim ve her
  yenildiğinde yeniden doğuş — bedenin o anki bakışına göre |açı| ∈ [min, max], uzaklık ∈ [near, far] bir yerde, sol ya da
  sağda (eşit olasılık) doğar. Yer bulunamazsa (duvar, tehlike) 200 denemeden sonra düz rastgele yere düşer.
- Yoksa oda bugünkü odanın bit-birebir aynısı (eski kayıtlar ve eski denekler değişmez; alan yalnız yön odasında var).
- ROOM-S: 3 yemek, enerji 0,6, tehlike yok, açı 50–120°, uzaklık 1,5–4 m. "Önde yemek" neredeyse yok: ileri-git alışkanlığı
  kazanamamalı, dönmeyi bilen kazanmalı.
- **Kalibrasyon** (Themis §1.1, testte sabitlenir): rastgele (taban), ileri + hep sol (alışkanlık), arayıcı (tavan);
  beklenti: arayıcı ≫ alışkanlık ≈ taban (yemek/1000 tik), alışkanlığın yönlendirmesi 0.

## Aşama 1–6 (plan; ayrıntı koşmadan önce eklenir)
1. Müfredat tabanı: kıt oda tek başına / kolay → yön → kıt / kolay → kıt.
2. Ölüm ve acı öğretir: `teachAtDeath` eleştirmenle; tehlikeli oda müfredatta.
3. Seçici iki tarafı okur (`lat` fark hücreleri, P15–P17) — mimari genişleme.
4. Eleştirmende açlık × duyu etkileşimi — mimari genişleme.
5. Kanıt biriktiren seçici (sızıntılı birikim + eşik) — mimari genişleme.
6. Kalıtım: Lamarck (öğrenilenin k = 0,5'i doğuma) ve Darwin/Baldwin (seçilim + doğuştan ağırlıkta mutasyon) paralel,
   rastgele seçilim kontrolüyle, 10 nesil.
