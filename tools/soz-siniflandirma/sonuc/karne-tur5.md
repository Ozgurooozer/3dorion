# Tur 5 karnesi (olc_uretim.py) — üretim komut sözlüğü (P) vs benim B0'ım
olc_uretim.py 0f340206d0ac97d5 | uretim_sozluk.ts 11a0b01b682d8fab | mind/komutSozlugu.ts c4fdf78cb6fffadb | etiketli cf46cbceab2b29fc | cift 8d6ca2424d9b54bc

| küme | n | pozitif | P kapsama | P yanlış | P nötr | B0 kapsama | B0 yanlış |
|---|---|---|---|---|---|---|---|
| gercek 71 (sözlük yazarları gördü) | 71 | 14 | 12/14 (86%) | 0 | 1 | 12/14 (86%) | 0 |
| tohum orijinal (benim, 163) | 82 | 22 | 8/22 (36%) | 0 | 0 | 21/22 (95%) | 0 |
| tohum türev (ASCII/yazım) | 194 | 46 | 7/46 (15%) | 0 | 0 | 11/46 (24%) | 0 |
| çift tr | 65 | 16 | 3/16 (19%) | 0 | 0 | 2/16 (12%) | 0 |
| çift en | 65 | 16 | 0/16 (0%) | 0 | 0 | 1/16 (6%) | 0 |
| çift tr_ascii | 65 | 16 | 3/16 (19%) | 0 | 0 | 2/16 (12%) | 0 |
| çift tr_yazim | 65 | 16 | 0/16 (0%) | 0 | 0 | 0/16 (0%) | 0 |
| çift en_yazim | 65 | 16 | 0/16 (0%) | 0 | 0 | 0/16 (0%) | 0 |
| canlı 20 | 20 | 6 | 2/6 (33%) | 0 | 0 | 1/6 (17%) | 0 |

P yanlış eşleşmeler (negatif sözde program çalıştı):
  (yok)

P'nin KAÇIRDIĞI pozitif sözler (genişletme adayı):
  çift tr: ['sandalyenin yanına git', 'pencereye doğru yürü', 'hemen otur', 'masanın yanına git', 'tahtaya doğru git', 'pencereden dışarı bak', 'monitöre odaklan', 'bilgisayarın başına geç', 'kıpırdama', 'koltuğa otur', 'bana doğru yürü', 'pencerenin önüne git', 'tahtanın karşısına geç']
  çift en: ['go next to the chair', 'walk toward the window', 'sit right now', 'get up', 'come to me please', 'go next to the table', 'head to the board', 'look out the window', 'focus on the monitor', 'go to the computer', 'freeze', 'take a seat', 'come over here', 'walk toward me', 'go in front of the window', 'go stand by the board']
  canlı 20: ['sandalyenin yanına git', 'go next to the table', 'come over here', 'get up']
  tohum orijinal (benim, 163): ['kalk ayağa', 'pencerenin yanına git', 'tahtanın yanına git', 'yanıma doğru gel', 'go to the table', 'go to the board', 'sit down', 'stand up', 'come here', 'come to me', 'look at the window', 'walk to the window', 'open the computer', 'stop']

P'nin YAKALADIĞI (her kümede pozitifler, tekil):
   ['ayaga kalk', 'ayağa kalk', 'bana gel', 'bilgisayara git', 'bilgisayari ac', 'bilgisayari kullan', 'bilgisayarı aç', 'buraya gel', 'dur', 'dur orada', 'kalk', 'masaya git', 'masaya yuru', 'masaya yürü', 'monitore bak', 'monitöre bak', 'onundeki bilgisayari ac', 'otur', 'otur lutfen', 'otur lütfen', 'pencereye bak', 'pencereye git', 'sandalyeye git', 'sandalyeye otur', 'tahtaya git', 'yanima gel', 'yanima gel lutfen', 'yanıma gel', 'yanıma gel lütfen', 'önündeki bilgisayari aç', 'önündeki bilgisayarı aç']
