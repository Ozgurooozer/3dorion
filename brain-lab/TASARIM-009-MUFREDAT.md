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
1. Müfredat tabanı: kıt oda tek başına / kolay → yön → kıt / kolay → kıt. **Sonuç (Kart 1, 2026-09-30):** müfredat yönü
   öğretmiyor; sabırlı eğitim (`--egitim sabirli`) taban kural oldu.
2. Ölüm ve acı öğretir: `teachAtDeath` eleştirmenle; tehlikeli oda müfredatta.
3. Seçici iki tarafı okur (`lat` fark hücreleri, P15–P17) — mimari genişleme. **Önce 3a (orta hat kuralı).**
4. Eleştirmende açlık × duyu etkileşimi — mimari genişleme.
5. Kanıt biriktiren seçici (sızıntılı birikim + eşik) — mimari genişleme.
6. Kalıtım: Lamarck (öğrenilenin k = 0,5'i doğuma) ve Darwin/Baldwin (seçilim + doğuştan ağırlıkta mutasyon) paralel,
   rastgele seçilim kontrolüyle, 10 nesil.

## Aşama 2 — ayrıntı (ön-kayıt 005, Kart 2)
- Mimari yok, bir anahtar: `teachAtDeath: true`. Ölüm δ'sı (sonuç −1, eleştirmen tahmini düşülür) uygun sinapslara ve
  eleştirmene ölüm tikinde öğretilir. Kapalıyken defter birebir aynı (`experiments/stage2.test.ts`).
- Kollar: OL1 (kıt oda, D0 = kayıtlı sabırlı H3B97), OT0 / OT1 (oda 2, iki tehlike; kapalı / açık). Hepsi sabırlı eğitim.
- Planın D2'si ("D1 + tehlikeli oda müfredatı") yerine OT0/OT1: tehlike odasında ölüm ve acının birlikte ne öğrettiği,
  müfredat karışıklığı olmadan (Kart 1: müfredatın kendisi iki deneği bozdu).

## Aşama 3a — orta hat kuralı (Ozyn onayı 2026-09-30; tasarım)

**Teşhis** (`experiments/yon-teshis.ts`, defter 2026-09-30): yemeğin yönü öğreniliyor (dönüş farkı 0,10–0,18) ama
açlık tek başına bir yana dönme alışkanlığı öğreniyor (açlık 0,5'te 0,23–0,48). Açlık hep açık; hangi yöne dönülürse
dönülsün sonra gelen yemek o dönüşü ödüllendiriyor, açlık sabit terim gibi öğreniyor. Yemek alışkanlığın karşı tarafındayken
dönüş yarışını %16–38 kazanıyor, doğumdaki %48'in altında.

**İlke:** beden iki yanlı simetrik. Tarafı olmayan bir duyu ("orta hat") dönüşün **yönünü** seçemez; yalnız dönmeyi
artırıp azaltabilir. Doğa yapıyı verir (bu bir bağlantı kuralı), deneyim ağırlığı: hangi duyunun ne kadar döndüreceği yine
öğrenilir, yalnız sol ve sağ için tek sayı olarak.

**Orta hat duyuları:** `intero.hunger`, `intero.injury`, `touch.bump`, `proprio.forward`, `proprio.backward` ve merkez ışının
bütün türleri (`ray{merkez}.*`). Yan ışınlar, onların hatırlananları ve `proprio.left/right` yanlıdır, dokunulmaz.
- **İlk sürümde dışarıda:** merkez ışının hatırlanan duyusu `rec{merkez}`. Onun sinapsları hayatta doğup ölüyor (büyüyen
  kural sinapsları); çift halinde doğup ölmeleri ayrı bir kural ister. Kart 3 teşhisi rec{merkez} → sol/sağ farkını ölçer;
  büyükse ikinci adımda eklenir.
- **Refleksli grubun çarpma refleksi aynalanır:** bugün `touch.bump → Git sol 0,6` (doğuştan sola dönme). Çarpma tarafsız bir
  duyu; kurala göre refleks "çarpınca dön" olur, iki tarafta da 0,6; hangi yana döneceğini gürültü seçer. Acı → ileri
  refleksi dönüş değil, değişmez.

**Kural:** her orta hat duyusu için (Git sol, Git sağ) bir çift, (Gitme sol, Gitme sağ) bir çift. Çiftin iki sinapsı tek
sinapsın iki kopyası:
- **Doğumda** eşit: ikisi de iki rastgele ağırlığın ortalaması (kuantuma yuvarlanmış). Doğum grafiği bu haliyle deftere
  girer; defterin yeniden oynatılması değişmez.
- **Öğrenmede** tek hesap: çiftin bekleyen değişimi ortak, uygunluğu iki kopyanın uygunluğunun ortalaması; bir kuantum
  birikince iki sinaps aynı kuantumla değişir, defterde iki LRN kaydı (aynı tik, aynı sebep, aynı büyüklük).
- Sonuç: seçicide orta hat duyusu sol ve sağa aynı değeri ekler; hangisinin kazanacağını değiştiremez, yalnız dönüşün
  dinlenmeyi yenip yenmeyeceğini değiştirir.

**Anahtar:** `born: { midline: true }` (doğumda eşitle) ve `learning: { midline: true }` (öğrenmede tek hesap). İkisi
birlikte açılır; öğrenme anahtarı simetrik olmayan bir doğum grafiği görürse hata verir. Kapalıyken her şey bit-birebir
aynı (kayıtlı bir H3B97 deneği yeniden eğitilir, kayıtla karşılaştırılır).

**Testler (önce):** doğum simetrisi; bir hayat boyunca her an simetri (değişmez); `yon-teshis` açlık sol−sağ = 0 tam; yan
duyular etkilenmez; kapalıyken bit-birebir; asimetrik doğumla öğrenme anahtarı reddedilir. Sonra bozma denemesi.

**Kart 3 (ön-kayıt 006, kod bittikten sonra, koşmadan önce):** H3B97 + orta hat (sabırlı) vs H3B97 sabırlı. Beklenen:
alışkanlığa karşı kazanma ≥ doğumdaki 0,48; yönlendirme artışı ≥ 0,05 (üçlü puanlama). Çürürse: sorun alışkanlık değil, yemek
farkının büyüklüğü (kredi) → 3b (`lat` fark hücreleri) ya da iz uzunluğu.

## Aşama 5 — Ozyn'in notu: "sürekli hareket etmek zorunda değil, düşünme olarak ekle" (2026-09-30)
- Bugün dinlenme mümkün (`restBias` 0,3) ama açlık bütün hareketlerin belirginliğini birlikte yükseltiyor (`vigor ·
  açlık`), bu yüzden aç beden neredeyse hiç durmuyor.
- Aşama 5'in kanıt biriktiren seçicisi bunu karşılar: belirginlik tik tik birikir; hiçbir aday eşiği geçmezse eksen
  **bekler** (düşünür). Bekleme bir karar olarak sayılır ve ölçülür: düşünme süresi (tik), düşündükten sonra doğru tarafa
  dönme oranı, düşünmenin dürtüye maliyeti.
- Tasarım ayrıntısı Aşama 5 sırasında; 3a'dan sonra sıraya girer.
