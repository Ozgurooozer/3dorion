# Ön kayıt — açık iş hatırlatmasının doğruluğu (2026-10-13, koşudan ÖNCE)

**Gözlem (n=1, canlı):** öneri onaysız düştükten 2 dk sonra Haiku "Git status komutu hala bekliyor—çalıştırmak
istiyor musun?" dedi (`d1-acik-is-canli-haiku.jsonl`). Öneri o an artık beklemiyordu: Ozyn Y'ye basarsa bir şey
olmaz. Olay metni yalnız "Ozyn did not decide in time" diyor; düştüğünü söylemiyor.

**Hipotez:** olay metni önerinin DÜŞTÜĞÜNÜ açıkça söylerse model "hâlâ bekliyor" demeyi bırakır, hatırlatma
davranışı (tek kısa söz, sor/komut yok) bozulmaz.

**Set:** `fixtures/f0/acikis-hatirlat.json` h1–h4: canlı bağlamı taklit eder (geçmişte Ozyn'in sözü + önerinin
kendisi `dunya_komut` çağrısı olarak; h3/h4'te ayrıca Orion'un bir sözü). Olay metni `inisiyatifOlayi`'den türer.

**Kollar:** TABAN = şimdiki metin. YENİ = önerinin düştüğünü ve artık beklemediğini söyleyen metin (tek değişiklik
`mind/inisiyatif.ts inisiyatifOlayi` acik_is dalı). Haiku (`claude-beyin.ts --mod=yapisal`), her senaryo n=3 → kol
başına 12 deneme.

**Yanlış iddia (tanım, koşudan önce):** söz önerinin ŞU AN onay beklediğini ya da şimdi onaylanabileceğini
söylüyorsa yanlış: "hâlâ bekliyor", "onayını bekliyor", "beklemede", "Y'ye basabilirsin", "still pending". Yanlış
DEĞİL: "çalıştırayım mı?", "ister misin?", "tekrar önereyim mi?", "onaylamadın". Susmak ya da söz yoksa yanlış
değil (f0 puanı zaten kaldırır). Yargı: iki kolun sözleri etiketsiz, karışık sırayla tek listede okunur, sonra açılır.

**Ölçütler:**
- K1 (sorun ölçülebiliyor mu): TABAN'da yanlış iddia ≥ 2/12. Değilse set kusuru üretmiyor demektir; metin
  DEĞİŞMEZ, sonuç olumsuz olarak yazılır.
- K2 (düzeltme): YENİ'de yanlış iddia ≤ 1/12 VE f0 geçme (söz var + `sor`/`komut` yok) ≥ TABAN geçme − 1.
- K3 (gerileme): YENİ metinle `ozerk3` y1–y4 Haiku n=1 → 4/4 (önceki 4/4); yerel `qwen2.5:7b` bu sette
  geçme ≥ TABAN − 1 (qwen'de yanlış iddia sayılır ama ölçüt değil).

K1 ve K2 ve K3 geçerse yeni metin kalır; biri kalırsa geri alınır, sonuç yazılır.
