# Tur 4 (a) — HTTP sınırı (http_dene.py)
hizmet.py 33dd855d933909f2 | http_dene.py 45aa9f527c3c9e3b | olc.py 1e5c51482c41f2ea | etiketli cf46cbceab2b29fc | cift 8d6ca2424d9b54bc

U3 uyum: 396/396 HTTP == çevrimdışı B0 (uyumsuz: [])
U4 gecikme (istemci, loopback, her istek yeni bağlantı): p50 0.61 ms · p95 15.85 ms · p99 20.93 ms · n=396
   hizmet içi (ms) p50 0.017 · max 0.216
U5 hedef çıkarımı: 146/167 (87%) | yanlışlar: [('bide quantum formülü yaz sen yaz', None, 'tahta'), ('birseyler yaz', None, 'tahta'), ('serbet düşüncelerini yaz şimdi', None, 'tahta'), ('write sometings', None, 'tahta'), ('write your name', None, 'tahta'), ('penceerye doğru yürü', None, 'pencere'), ('maasnın yanına git', None, 'masa'), ('look out the wndow', None, 'pencere'), ('focus on the montor', None, 'monitor'), ('bilgisaarın başına geç', None, 'monitor')]

U2 /dusun (fixtures/beyin):
  001-komut: biçim geçerli · çıkarılan söz 0 · sınıf []
  002-soyle: biçim geçerli · çıkarılan söz 1 · sınıf [('ekranda ne oldu, duzeltmek icin bir komu', 'emin_degil', 'llm')]
  003-sessiz: biçim geçerli · çıkarılan söz 0 · sınıf []

U1 beyin-tekrar.ts --beyin=dis:
  çıkış kodu 1
     yeni  : (eylem yok)
     eski  : dunya_komut  ✗ FARKLI
  
  002-soyle.json       3 ms
     girdi : Ozyn dedi: "ekranda ne oldu, duzeltmek icin bir komut onerir misin"
     yeni  : (eylem yok)
     eski  : dunya_soyle  ✗ FARKLI
  
  003-sessiz.json       3 ms
     girdi : Niyet n_mu3gl9qa_2 → hata (Ozyn komutu reddetti. Israr etme; baska bir yol oner ya da sor.
     yeni  : (eylem yok)
     eski  : (eylem yok)  ✓ ayni
  
  sonuc: 3 fixture | karsilastirilan 3: 1 ayni, 2 farkli
