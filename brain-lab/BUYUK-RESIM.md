# Büyük resim

Tarih: 2026-09-26 · Durum: **TASLAK, Ozyn onayı bekliyor**. Onaysız kod yok.
Neden: Ozyn 2026-09-26'da hedeften kayıldığını söyledi; bu not hedefi, nerede kaydığımızı ve yeni yönü tek yerde toplar.

## 1. Hedef, Ozyn'in sözleriyle

- 22 Eylül: "Basit kararlar veren, kendi ekosistemine sahip, dinamik ve dinamik olmayan değişkenlerle çevrelenmiş bir
  karar mekanizması kurmak ve geliştirmek." Önce beyin, sonra omurilik.
- 25 Eylül: "Jev'den daha iyi bir yapı, ileride robot hafızası için yola çıktık; doğru yolda mıyız?"
  - Üç parça: Alice (refleks), Bob (düşünen; küçük model, ileride LLM), Hafıza.
  - Bob'un işe yarayan kararı Alice'e refleks olarak işlenmeli. Ozyn tıklayarak öğretmen olabilmeli.
  - Hafıza kararları etkilemeli.
- 26 Eylül: "Hafıza demek yeni nöronlar, sinapslar demek." Kuralları değişmeyen bir çekirdek; etrafında büyüyen bölgeler;
  hafızaya girişte bir kapı.
- 26 Eylül, akşam:
  - "LLM beyninin etrafındaki karar verme mekanizması."
  - "3D ofisimizdeki Orion'un karar mekanizması olacak. Jev'den daha detaylı; zamanla verdiği kararları hafızaya güzelce
    kaydeden, öğrenen, genişleyen bir yapı."
  - "Hafıza katmanının içinde görsel hafıza, ses hafızası gibi farklı hafızalar; hepsi kural hafızası ve deneyimlenerek
    öğreniliyor, sinek beynindeki gibi. Omurilik tarafı da ileride tasarlanacak."

**Tek cümleyle:** Orion'un LLM'inin etrafında, kararlarını ve sonuçlarını kaydeden, deneyimden kural öğrenen ve büyüyen
bir karar mekanizması. Jev tek bir karar veren durumsuz bir model; bu mekanizma hafızalı, izlenebilir ve kendini
güncelliyor. Bilgi havuzu §3'ün tespiti: Jev ekosisteminde kendini çevrimiçi güncelleyen, izlenebilir bir karar
mekanizması yok.

## 2. Nerede kaydık

- **Karar seviyesi.** 23 Eylül'de "beden kendini kullanmayı öğrenecek" sözünü, 2D bir odada her tik kas komutu (ileri,
  dön) öğrenen bir beyne çevirdim. Kararlar kas komutu seviyesine indi. Bu, Ozyn'in "ileride" dediği omurilik.
- **Kurallar zinciri, ikinci kez.** Ozyn 25 Eylül'de "yapı bir kurallar zincirine döndü" diye uyarmıştı. 26 Eylül'de
  yeni bir biçimde tekrarladı: konum → temas → hafıza → hatırlama → kural → kredi → eleştirmen.
- **Kök neden biliniyordu.** 25 Eylül'deki T1 deneyi iki şey gösterdi:
  - Yoğun bir sinyal veren öğretmenle beyin yönü 10/10 denekte öğreniyor (yönlendirme 0,24; yemek 17,2, tek başına 5,5).
  - Eleştirmen yemek görmeye değer vermiyor.

  Hafızayı yine de bu tabanın üstüne kurduk.
- **Hiç yapılmayanlar:** LLM tarafı (Bob), öğretmen kanalı, kararların kaydı.

## 3. Bugün elimizde

### 3dorion: LLM'in etrafındaki karar mekanizması zaten var, ama elle yazılmış

| modül | ne kararı verir | bugün nasıl |
|---|---|---|
| `mind/dikkat.ts` | bu algı beyne gitsin mi? | sabit kurallar: kanal, tekrar penceresi 4 sn, terminal kısma 2,5 sn, dakikada 20 bütçe |
| `mind/refleks.ts` | büyük beyni uyandırmaya değer mi? | küçük yerel modelin yargısı (functiongemma-270m) |
| `mind/yerelTepki.ts` | LLM susarken ne yapılır? | kurallar |
| `mind/inisiyatif.ts` | kendiliğinden ne zaman davranılır? | güç bütçesi ve fayda formülü |
| `mind/hafiza.ts` | hangi hatıra çağrılır? | Generative Agents puanı |
| `mind/onayKapisi.ts`, `komutRiski.ts` | komut çalışsın mı? | insan onayı; risk bilgisi |
| LLM (`bridge/`) | ne düşünülür, ne yapılır? | qwen2.5:7b ya da bulut modeli |

- Hiçbiri kararını öğrenmek için kaydetmiyor, sonuçtan öğrenmiyor, büyümüyor.
- Kayıt: `ORION_KAYIT=1` ile yalnız LLM'in girdisi ve çıktısı tutuluyor. Diskte 3 örnek (`fixtures/beyin`) ve 10 sadakat
  testi (`fixtures/sadakat`) var.
- Ham algı akışı, kapının kararları ve bu kararların sonuçları kaydedilmiyor.

### brain-lab: taşınan ve donan parçalar

**Taşınanlar:**
- **Defter:** her değişiklik kayıtlı, beyin doğumdan ve defterden yeniden kurulabilir. Karar kaydının altyapısı bu.
- **Büyüyen hafıza mekanizması:** yeni durum yeni bir nöron açar, doğrulanan pekişir, yalanlanan söner, ölen silinir.
  Ölçüldü: isabet %98. Kural hafızasının motoru olacak.
- **Kapı fikri ve öğretmen kanalı:** T1'de öğretmenden öğrenme çalıştı.
- **Themis ölçme yöntemi:** kalibre edilmiş ölçü, kontroller, çürütme denemesi, dürüst karne.

**Donanlar:** Kas seviyesi (hareket seçici, konum, yemek hatırlama, kural sinapsları) donduruluyor. Defterde her şey
yazılı; ileride omurilik adayı.

## 4. Hedef mimari (karar seviyesi)

```
 algı ──► KAPI (öğrenen): bu algı bir karar gerektiriyor mu, LLM uyansın mı?
             │
             ├─ kural hafızası emin ──► kural kararı (hızlı, ucuz)
             └─ emin değil ──────────► LLM düşünür ──► karar
                                              │
 KARAR KAYDI: durum, karar, kararı veren (kural / LLM / insan), güven ── sonuç gelince aynı kayda eklenir
                                              │
 KURAL HAFIZASI büyür:
   - yeni durum ──► yeni nöron;
   - tutarlı LLM kararları ──► kural (derleme);
   - yanlış çıkan kural söner.
 HAFIZA KATMANI: çekirdek + görsel, ses … (ihtiyaç doğdukça, aynı mekanizmayla)
 OMURİLİK (bedenin kas kontrolü): ileride
```

- **Öğrenme motoru dopamin gradyanı değil, hafıza.** Yavaş üç faktörlü kural bizim darboğazımızdı; büyüyen hafıza ise
  çalışıyor.
- **Sinek de bunu söylüyor:**
  - Bir kokuyu bir sonuçla tek bir eğitim döngüsünde öğreniyor (Tully ve Quinn 1985).
  - Görsel ve koku hafızaları aynı mantar gövdesi devresini paylaşıyor (Vogt ve ark. 2014).
  - Yani farklı hafızalar tek bir hızlı ilişkisel mekanizmanın üstünde duruyor.
- **Biyoloji ilham, kısıt değil** (Ozyn, 25 Eylül: "biyolojik bir şey kurmuyoruz, yalnız esinleniyoruz").

## 5. Kilometre taşları (öneri)

- **KT1 — Karar kaydı.**
  - Orion'a bir anahtarla bir kayıt eklenir. Kapıya gelen her algı, kapının kararı (dikkat, refleks), LLM'in cevabı ve
    ardından olanlar bir JSONL dosyasına yazılır.
  - Davranış değişmez.
  - "Kararlarını hafızaya kaydeden" yapının ilk parçası; KT2'nin verisi.
- **KT2 — Öğrenen kapı, brain-lab'de, kayıt üzerinde.**
  - "LLM uyansın mı?" kararını sonuçtan ve öğretmenden öğrenir. Öğretmen adayları: küçük model, LLM'in kendi tepkisi,
    Ozyn.
  - Elle yazılmış dikkat ve refleks ile kıyaslanır.
  - Ölçüler: kaçırılan önemli algı, gereksiz uyandırma, LLM çağrısı tasarrufu, güvenin dürüstlüğü.
- **KT3 — Gölge kip.** Orion'da elle yazılmış kapının yanında karar verir, uygulamaz; kıyas kaydedilir. Kendini
  kanıtlarsa devreye girer.
- **Sonra:** öbür karar noktaları (inisiyatif, hafıza çağırma), görsel ve ses hafızaları, omurilik.

## 6. Ozyn'e açık sorular

1. 3D ofis şimdiye kadar kapsam dışıydı. KT1, Orion'a davranışı değiştirmeyen bir kayıt anahtarı ekler. Olur mu?
2. İyi bir uyandırma nedir? LLM bir şey yaptı mı, Ozyn tepki verdi mi? Bu, KT2 tasarımının asıl sorusu.
3. İlk karar noktası kapı mı olsun, yoksa başka biri mi (inisiyatif, hafıza çağırma)?
4. Adlar birleşsin mi? brain-lab'de Alice ve Bob, Orion'da sağ lob, sol lob ve refleks var.
5. Veri nereden gelsin? Kayıt, Ozyn odayı kullandıkça mı dolsun, yoksa `3dorion.bat`'ın deneme senaryolarıyla mı?

## Kaynaklar

- Tully, T. & Quinn, W. G. (1985). Classical conditioning and retention in normal and mutant *Drosophila melanogaster*.
  *Journal of Comparative Physiology A* 157. Öğrenme tek eğitim döngüsünde doygunluğa ulaşıyor.
- Aso, Y. ve ark. (2014). The neuronal architecture of the mushroom body provides a logic for associative learning.
  *eLife* 3:e04577.
- Vogt, K. ve ark. (2014). Shared mushroom body circuits underlie visual and olfactory memories in *Drosophila*.
  *eLife* 3:e02395.
- Carpenter, G. A. & Grossberg, S. (1987). ART: yeni kategori nöronu, eski bilgi silinmez.
- Laboratuvar:
  - `LAB-DEFTERI.md`: 2026-09-25 (Ozyn'in fikirleri, T1 sonucu) ve 2026-09-26 (A1–A3, eleştirmen teşhisi).
  - `TASARIM-007-MIMARI.md`, `TASARIM-008-BUYUYEN-HAFIZA.md`.
  - 3dorion `CLAUDE.md` ve `mind/`.
