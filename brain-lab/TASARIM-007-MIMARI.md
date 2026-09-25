# Tasarım 007: Mimari gözden geçirme (Alice, Bob, Hafıza)

Tarih: 2026-09-25 · Durum: **TASLAK, Ozyn onayı bekliyor.** Kod yazılmadı. Toplantı: vault `forum/beyin0fis/toplantilar/2026-09-25-mimari-gozden-gecirme` (K1–K8, öneri).
Kaynak: Ozyn'in fikirleri (LAB-DEFTERI.md, 2026-09-25 "Mimari gözden geçirme öncesi") ve seri 005–006'nın ölçümleri.
Kapsam: yalnız 2D laboratuvar. 3D ofis kapsam dışı (Ozyn, 2026-09-25).

## 1. Neden

**Ölçülen:**
- Kendi başına öğrenen en iyi beyin (S1n) tek bir karar öğrendi: "yemek tam öndeyse ileri". Yana dönmüyor.
  Kıt odada %39 yaşıyor; elle yazılmış "önündeyse ileri" kuralı %81 yaşıyor. Ders kitabı TD öğrenicisi oda 1'de
  onu geçiyor (8,4'e 5,5 yemek/1000 tik).
- Öğretmenden öğrenme çalışıyor: kâhin öğretmenle yönlendirme 0,24, 10 denekten 10'unda. Bizim en güçlü olumlu
  sonucumuz bu.
- Kurallar zinciri: dopamin tabanı, bölmeler, seçici, işaret hafızası. Her biri bir öncekinin açığını yamadı.
  Son üç işaret hafızası denemesi (K2–K4) üç ayrı tasarım hatası buldu.
- **Beyinde durum yok.** Her tik yalnız o anki beş ışına bakıyor. Yemek görüşten çıkınca beyin için yok oluyor.
  Bu bir öğrenme kuralı sorunu değil, mimari eksiği. Daha iyi bir kural bunu düzeltemez.

**Ozyn'in hedefi:**
- Biyolojik bir şey kurmuyoruz, esinleniyoruz.
- Beyin üç parça: refleks, düşünen, hafıza.
- Yeni keşfedileni kullanmayı öğrenince bunu refleks olarak sürdürebilmeli; bozulan refleks çürümeli.
- Beyin gördüğünü hatırlamalı, "hayal edebilmeli", yer değişikliğini fark etmeli.
- Hafıza modüler olmalı ve bir çekirdeği olmalı; basitten karmaşığa ilerlemeli.

## 2. İlkeler (değişen ve değişmeyen)

- **Değişmeyen:**
  - Davranış elle yazılmaz.
  - Her öğrenme deftere yazılır, beyin defterden birebir yeniden kurulur.
  - Her iddia ölçülür: ikiz, bağlı beden, çürütme.
  - Test seed'leri yalnız ön-kayıtla kullanılır.
- **Değişen:** "Her şey Git/Gitme hücresi olmalı" zorunluluğu kalkar. Bölgelerin içinde işe yarayan her yöntem
  serbest (K8). Seçim, biyolojik benzerliğe göre değil, ölçülmüş faydaya göre yapılır.

## 3. Genel yapı

```
            ┌─────────────── Öğretmen kanalı ────────────────┐
            │   kaynaklar: Bob · kâhin (fikstür) · Ozyn · Claude │
            └───────────────────────┬────────────────────────┘
                                    │ "bu durumda şunu yapmalıydın" (defterde, kaynağıyla)
 duyular ──►┌──────────┐  okur  ┌───┴────┐  belirsizse sorar  ┌─────────┐
 (ışınlar,  │  HAFIZA  │◄──────►│ ALICE  │───────────────────►│   BOB   │
  hareket,  │ (çekirdek│        │(refleks│◄───────────────────│(düşünen)│
  iç duyu)  │ +modüller│        │ seçim) │   karar + gerekçe  │         │
            └────┬─────┘        └───┬────┘                    └────┬────┘
                 │ hatırlanan duyular, sürpriz, güven              │ haritayı okur
                 └──────────────────────────────────────────────────┘
                                    │
                                 beden (itme, dönüş)
```

- **Alice** her tik karar verir. Girdileri: ışınlar, iç duyu ve hafızanın verdiği **hatırlanan duyular**.
- **Bob** yalnız Alice emin değilken çağrılır. Hafızayı okur, bir karar ve gerekçe üretir.
- **Hafıza** her tik güncellenir. Alice'e ve Bob'a okuma arayüzü verir.
- **Öğretmen kanalı** tek bir giriş: kim öğretirse öğretsin (Bob, sen, ben, kâhin), Alice aynı yoldan öğrenir. Kaynak
  deftere yazılır.

## 4. Hafıza çekirdeği

Bütün hafıza modüllerinin ortak dili; 3dorion'daki `protocol/` gibi tek sözleşme.

**Bir kayıt:** `{ ne, nerede, ne zaman, güven, kaynak }`
- ne: tür (yemek, duvar, tehlike, …).
- nerede: odaya göre konum (x, y).
- ne zaman: tik.
- güven: 0–1.
- kaynak: gördüm / hatırladım / Bob söyledi / öğretmen söyledi.

**Kurallar** (3dorion spec 06'da ölçülmüş derslerden):
- **Durum ≠ anı (K2).** "Şu an ne var" çalışma hafızasına yazılır: üzerine yazılır, eskir. Olay hafızasına yalnız
  olaylar yazılır: yemek yedim, çarptım, yaralandım, Bob'a sordum.
  - Sebep, ölçülmüş: anlık algıyı olay hafızasına yazmak Orion'un dünkü gözlemini bugünmüş gibi anlatmasına yol açtı.
- **Her bilgi zaman ve kaynak taşır (K3).** Okuyan, şimdikiyle eskiyi ayırabilir.
- **Unutma:** her kaydın güveni, yeniden görülmedikçe zamanla azalır. Hız bir parametredir, ölçülür.
- **Getirme eşiği (K4):** güveni eşiğin altındaki kayıt okunmaz; "belki" bilgisi karar vermez.
- **Sürpriz:** beklenen ile görülen arasındaki fark, çekirdeğin ortak sinyalidir. Unutmayı, Bob'a sormayı ve
  keşfi yönetir.

**Defter ile iz ayrımı:**
- Hafızanın öğrenilen parametreleri (unutma hızı, işaret değerleri) **deftere** yazılır.
- Hafızanın içeriği (harita, konum) bir durumdur, her oda yeniden başlar; **koşu izine** yazılır.
- Karıştırılırsa defter şişer ve yeniden oynatma bozulur.

## 5. Hafıza modülleri ve matematik (basitten karmaşığa)

### H1: Konum ("ben neredeyim?")

Beden kendi hareketini hissediyor: `motion.forward` (hız / azami hız) ve `motion.turn` (dönüş komutu). Yol entegrasyonu:

```
θ̂ ← θ̂ + turn · maxTurnRate · dt
x̂ ← x̂ + forward · maxSpeed · cos(θ̂) · dt
ŷ ← ŷ + forward · maxSpeed · sin(θ̂) · dt
```

- Başlangıç noktası (0, 0, 0) kabul edilir. Beden odanın gerçek koordinatlarını bilmez; kendi başlangıcına göre
  bir harita kurar.
- Dünya belirlenimci ve hareket duyusu gerçek hıza eşit, bu yüzden sapma küçük beklenir. Duvara çarpma, hız
  duyusunun sıfırlanmasıyla zaten yansır.
- **Ölçü:** tahmin edilen konum ile gerçek konum arasındaki hata (metre, derece), zamana göre. Kapı: 3000 tik
  sonunda ortalama hata < 0,5 m.

### H2: Harita ("nerede ne var?")

- Oda 0,25 m'lik hücrelere bölünür: 40 × 40 hücre, oda büyüklüğünü bilmeden büyüyebilen ızgara.
- Her hücre ve tür için bir **log-olasılık** tutulur (olasılık ızgarası; Elfes 1989):
  - Işının geçtiği hücreler "boş" kanıtı alır: `L ← L − l_boş`.
  - Çarptığı hücre, türünün kanıtını alır: `L_tür ← L_tür + l_var`.
  - Görülmeyen hücre zamanla önsele döner (unutma): `L ← L · e^(−Δt/τ)`.
- Bir şeyin orada olma olasılığı: `p = 1 / (1 + e^(−L))`.
- **Ölçü:** harita ile gerçek oda karşılaştırılır. Hangi yemeği doğru yerde hatırlıyor (isabet), olmayan yerde
  yemek var sanıyor mu (yanlış alarm)? Görüşten çıkan yemeği ne kadar süre hatırlıyor? Gerçek bir robotta
  imkânsız olan bu notlama, simülasyonda bedava.

### H3: Hayal ve sürpriz ("şu an ne görmem gerekirdi?")

- Beden, kendi haritasında beş ışını tahmini konumundan hayali olarak atar. Beklenen görüntüyü çıkarır:
  her ışın için beklenen tür ve uzaklık.
- **Sürpriz** = beklenen ile görülenin farkı. Işın başına: tür uyuşmazlığı ya da uzaklık farkı / menzil.
- Hatırlanan yerde yemek görülmezse (ışın oradan geçtiği halde) o kayıt hızla söner: "yenmiş ya da yer değiştirmiş".
  Beklenmeyen yerde yemek görülürse yeni kayıt açılır.
- Bizim dünyada yemek yenince başka bir yerde yeniden çıkıyor. "Yer değişikliğini fark etme" bu odada hemen
  sınanabilir.
- **Ölçü:** yemek gerçekten kaybolduğunda sürpriz sinyali kaç tikte yükseliyor (isabet), gerçekte bir şey
  değişmemişken ne sıklıkla yükseliyor (yanlış alarm).

### H4: Değer ("neresi iyi?")

- İşaret hafızası (seri 006, K4 sürümü): yalnız yemekten öğrenir, yemek görmeyi değerli bulmayı doğru öğrendi
  (+0,20; duvar ~0).
- Davranışa **biçimlendirme olarak** bağlanması hareketi bastırdı (K4). Yeni mimaride değer, doğrudan öğretme
  sinyali olarak değil, **Bob'un planında hedef seçimi** ve **Alice'in belirsizlik ölçerinde** "burada değerli bir
  şey var" girdisi olarak kullanılır.

### H5: Olay hafızası, H6: Anlam/harita-üstü (sonraya)

- H5: "Şurada şunu yaptım, şu oldu" kayıtları. Bob'un geçmişe bakması; puanlama 3dorion `mind/hafiza.ts`'teki
  gibi (yenilik + önem + ilgi).
- H6: Odalar arası bilgi, örneğin "yemek duvardan uzak çıkar". Bir oda bitince harita biter, bu bilgi taşınır.

## 6. Alice (refleks)

- Bugünkü S1n (Git/Gitme + rekabetçi seçim) başlangıç olarak kalır. Değişen şey girdileri:
- **Hatırlanan duyular:** hafızadan en yakın hatırlanan yemeğin göreli yönü ve uzaklığı, güveniyle. Işın duyuları
  gibi kodlanır. Onu kullanmayı beyin öğrenir; "hatırlanan yemeğe git" diye bir kural yazılmaz.
- **Belirsizlik ölçer** (Bob'a ne zaman sorulacağı):
  - Seçimde birinci ile ikinci aday arasındaki fark küçükse,
  - ya da sürpriz yüksekse,
  - ya da hafıza "değerli bir şey var ama nerede bilmiyorum" diyorsa,

  Bob'a sorulur. Eşikler ölçülerek seçilir.

## 7. Bob (düşünen)

- **Ölçülmüş gerçek:** Needle bu odada öğretmen olamadı (T1, 2026-09-24).
  - 28 sahnenin hiçbirinde "ileri" demedi.
  - Yakın yemekte hep sağa döndü.
  - Yanlışken de %91–98 emindi.
  - Telefon uygulaması araç çağırmak için eğitilmiş; mekânsal akıl yürütme alanı dışında.
- **Öneri, Bob v1:** hafıza haritası üzerinde çalışan bir **planlayıcı**. v0.3'teki `DeliberativePlanner`'ın sürekli
  odaya uyarlanmış hali:
  1. Haritadaki en değerli ve en güvenilir hedefi seçer.
  2. Hücre ızgarasında engelleri aşan yolu arar (A*).
  3. İlk adımın komutunu ("sola dön", "ileri") ve gerekçesini ("hatırlanan yemek 40° solda, 3 m") döner.

  Ucuz, belirlenimci ve ölçülebilir; "düşünme"yi haritaya dayandırır.
- **Needle ve LLM:** yeri tasarımda kalır:
  - (a) oda örnekleriyle ince ayar (100–10 000 örnek) sonrası planlayıcıyla kıyaslanarak,
  - ya da (b) dil ve soyut işlerde (ileride "derin düşünme" katmanı).

  Birden fazla Bob (yön, tehlike) planlayıcının tek başına yetmediği ölçülünce eklenir.

## 8. Öğretmen kanalı ve insan öğretmen

- Tek giriş: `teach(durum, doğru hareket, kaynak, güven)`. Alice bunu T1'de çalıştığı ölçülen öğretmen yoluyla öğrenir.
- Kaynaklar: Bob, kâhin (yalnız fikstür), **Ozyn**, **Claude**. Defterde her düzeltme kaynağıyla yazılır:
  `cause: ["öğretmen:Ozyn"]`.
- **İnsan arayüzü** (Deney Odası):
  - Denek yaşarken duraklatılır.
  - Beyin haritasında bir harekete ya da nörona tıklanır: "şimdi sola dön" ya da "bu yanlıştı".
  - Öğretmen sinyali olarak gider.
  - Sayfa, beynin öğretileni öğrenip öğrenmediğini gösterir: aynı durum tekrar gelince ne yapıyor?

## 9. Refleks derleme ve çürüme

v0.3'teki beceri motorunun mantığı (güven, başarı oranı, askıya alma), Alice'in öğrenen ağırlıklarına uygulanır:
1. Bob bir durumda karar verir → beden uygular → sonuç iyiyse karar öğretmen sinyali olarak Alice'e yazılır.
2. Aynı bağlamda Alice'in seçim farkı ve başarısı arttıkça belirsizlik ölçer Bob'u çağırmaz: karar **refleks**
   olmuştur.
3. Refleks kötü sonuç verir ya da sürpriz yükselirse güven düşer, Bob yeniden çağrılır, yanlış refleks yeni
   öğretimle **çürür**.

**Ana ölçü: Bob'a sorma oranı** (tik başına):
- Zamanla düşmeli, başarı korunmalı.
- Oda değişince (tehlike eklenince, yemek azalınca) önce yükselmeli, sonra yeniden düşmeli. Bu, Basamak 2'nin
  ("koşullar değişince de") doğrudan ölçüsü.

## 10. Duyular (sonraki aşama; Ozyn'in notları)

- **Işın sayısı ve görüş açısı:** 5 ışın, 120°. Hafıza bununla birlikte daha değerli, çünkü dönerken gördüklerini
  birleştirir.
- **İki göz:** bugünkü ışınlar uzaklığı doğrudan veriyor (lidar gibi, bir kestirme). Duyular gerçekçileşince iki
  gözün farkından derinlik (üçgenleme) anlam kazanır. Bu adım H1–H3'ten sonra.

## 11. Ölçüler (her parça kendi kapısıyla)

| parça | ölçü | kapı (öneri) |
|---|---|---|
| H1 konum | konum hatası (m), yön hatası (°) | 3000 tikte < 0,5 m |
| H2 harita | yemek isabeti / yanlış alarm; görüşten çıkan yemeği hatırlama süresi | isabet > %80, yanlış alarm < %10 |
| H3 sürpriz | kaybolan yemeği fark etme süresi (tik), yanlış alarm oranı | < 20 tik, < %5 |
| Alice + hatırlanan duyular | bağlı bedene göre dürtü ve yönelme; "gözden çıkan yemeğe dönme" | bağlı bedene göre p < 0,05 |
| Bob + refleks derleme | Bob'a sorma oranı eğrisi; başarı | oran düşer, başarı korunur |
| Genel | kıt odada hayatta kalma, oda değişiminde toparlanma | K1n'i (%39) ve "önündeyse ileri" (%81) sırayla geçmek |

## 12. Yol haritası (her aşamanın kapısı bir sayı; aynı anda tek değişken)

1. **A0.** Bu belge, toplantı, Ozyn onayı.
2. **A1. H1 konum.** Yalnız hafıza; davranış değişmez. Gerçek konumla ölçülür.
3. **A2. H2 harita + H3 hayal/sürpriz.** Yine yalnız hafıza. Gerçek odayla notlanır.
4. **A3. Hatırlanan duyular → Alice.** İlk davranış değişikliği. Bağlı bedene ve K1n'e göre ölçülür.
5. **A4. Öğretmen kanalı + insan arayüzü.** Ozyn tıklayarak öğretir; Alice'in öğrendiği ölçülür.
6. **A5. Bob v1 (planlayıcı) + belirsizlik ölçer + refleks derleme/çürüme.** Bob'a sorma oranı eğrisi.
7. **A6. Oda değişimi:** koşullar değişince yeniden öğrenme ve çürüme.
8. **Sonra:** H5 olay hafızası; duyuların gerçekçileşmesi (iki göz); Needle/LLM Bob'ları; derin düşünme.

## 13. Toplantıya giden sorular

1. Üç parçalı yapı ve öğretmen kanalı: onay?
2. Bob v1: harita üzerinde planlayıcı mı, Needle mı (ince ayarlı), ikisi birden mi?
3. Hafıza sırası: önce konum + harita (A1–A2) mi, yoksa önce öğretmen kanalı + insan arayüzü (A4) mü? A4 görünür ve
   hızlı; A1–A2 temel.
4. Alice'in öğrenme kuralı: S1n mi kalsın, yoksa kanıtlanmış bir öğrenici mi (TD / aktör-eleştirmen)?
5. Işın sayısı artışı: şimdi mi, H3'ten sonra mı?

## 14. Kapsam dışı

3D ofis (Ozyn, 2026-09-25). Duyuların gerçekçileşmesi ve iki göz (A6 sonrası). Birden fazla Needle. Derin düşünme LLM'i.
