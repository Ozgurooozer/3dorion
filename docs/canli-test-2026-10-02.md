# Ortak canlı test — 2026-10-02, 04:40–05:05

Ozyn ve Claude, yeni ofis derlemesiyle (835eb79; başka oturumun commit'siz avatar değişiklikleri dahil) Orion'u
birlikte denedi. Bu gerçek kullanımdı; karar kaydı ölçüm haftasının günlüğüne yazıldı.

Log: `%APPDATA%/3dorion/oturum-kayitlari/2026-10-02-ofis-testi.log`. Aşağıdaki satır numaraları o dosyaya göre.

Beyin: açılışta hatırlanan seçim `yerel:qwen2.5:7b`. Ozyn M ile önce `ornith-32k`'ya, sonra
`functiongemma-270m`'ye geçti, oradan yine `ornith-32k`'ya döndü.

## Çalışanlar

| ne | kanıt |
|---|---|
| Yeni oda yüklendi, 100 FPS, 38 mesh | satır 42 (`[DUMAN]`) |
| "tahtaya git", "adını yaz tahtaya", "quantum formülü yaz" → yürüdü ve yazdı | 137–182 |
| Kısayol 3 (otur) ve 2 (pencere) | 400–402, `[hizli] 2 → git` |
| `sor dunya` odadaki her şeyi doğru saydı | "yönetim terminali, pencere, çalışma masası…" |
| M seçici canlıda çalıştı (ACIK-ISLER'de "canlıda koşulmadı" diye işaretliydi) | 324–326 `[PANO] teyitli yazma: beyin.model` |
| On dakikalık sessizlikten sonra inisiyatif | `[INISIYATIF] soze_gir` → "Sabah iyi Ozyn." |

## Başarısızlıklar

| # | Ozyn | Orion | kanıt |
|---|---|---|---|
| 1 | "otur" | yalnız `soyle "Oturuyorum Ozyn."`, oturmadı | 375 |
| 2 | "bana gel" | yalnız `soyle "Geliyorum Ozyn."`, yürümedi | `n_muqd5psn_q` |
| 3 | "önündeki bilgisayarı aç" | yalnız `soyle "Bilgisayarı açıyorum Ozyn."`; ayrıca böyle bir yetenek yok (`dunya_odaklan` yürütülmüyor) | `n_muqd7v3n_x` |
| 4 | yaklaş/uzaklaş/bak | her hareket LLM'i uyandırdı ve konuşturdu: "Ozyn yaklaştı. Bekliyorum." (qwen, düz metin sesli okundu), "Uzaklaştın Ozyn." ×4 (ornith, `soyle` çağrısı) | 68–120, 1140+ |
| 5 | (saat) | "gece yarısı mı bu?" 3 kez, "Neden gece yarısı bu Ozyn?". Saat bağlamda doğru (`It is the middle of the night, 4:51`); boşa uyandırılan model eldeki tek bilgiyi soruya çevirdi | 1077–1132 |
| 6 | "ne oldu?" | geçmişi kelime kelime tekrar eden 400 karakterlik metin, kısaltılıp okundu | 227–243 |
| 7 | ilk cümle | `beyin hatası: signal is aborted without reason`. Yerel model zaman aşımı 20 sn, AbortError çevrilmiyor | 54 |
| 8 | "karşında ne var?" | `sor onumde` → "çalışma masası", ardından cevap "Ozyn ne dedi?" | 412+ |
| 9 | functiongemma-270m | Ollama 400: şablon ayrıştırıcısı üretilemedi; model bu kurulumda hiç çalışmıyor | `ollama 400` |
| 10 | yüzeyden çıkış | `SecurityError: Pointer lock cannot be acquired immediately after the user has exited the lock` (3 kez) | 67, 316 |

## Ozyn'in istekleri (bu testten)

- **Model:** "Model küçük kalıyor." M seçiciye API anahtarı girilebilsin, doğrudan API ile model seçilsin.
- **Zihin paneli:** zihin akışı ve günlük ciddi biçimde geliştirilmeli. Orion düşünürken ne olduğu, anlık
  düşünceleri ayrıntılı görünsün.
- **Çağırınca gelsin:** "otur" dendiğinde otursun; "bana gel" dendiğinde odada Ozyn'i bulup yanına gelsin.
- **Bilgisayar:** önündeki bilgisayarı açıp terminali kullanabilsin, Ozyn söyleyince.

Plan ve kararlar: `docs/specs/12-eylem-ve-zihin-akisi.md`.
