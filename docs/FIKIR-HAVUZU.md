# Fikir Havuzu — şimdi değil, ama kaybolmasın

## Beyin v2 sonrası (spec 06 §6) — 2026-09-17

Kaynak: `docs/arastirma/open-notebook.md`, toplantı
`C:\vault\meetings\meeting-2026-09-17-orion-beyin-mimarisi`. Spec 06 Faz 1–5
bitmeden başlatılmaz.

- **Doğrulanmış atıf.** Anılar tipli kimlikle (`[ani:12]`) sunulur, model
  dayandığını işaretler, kimliğin gerçekten var olduğu **kontrol edilir**.
  Open Notebook bunu istemle istiyor ama doğrulamıyor — o eksiği tekrarlamamak.
  Atıf gelince K5 "yalnızca kullanılan anı pekişir" hâline gelir.
- **Konsolidasyon.** Epizodik anılar boşta semantik bilgiye dönüşür, türediği
  anıları kaynak olarak taşır (Open Notebook'un kaynak → içgörü ayrımı).
- **Yoğun gömme.** `nomic-embed-text` makinede kurulu; `HafizaAyari.ilgiOlcer`
  kancası hazır. Eş anlamlıları kaçırmayı çözer. Kelime eşleşmesiyle
  ölçülerek karşılaştırılmalı.
- **İnisiyatif.** Çalışma belleğini okuyan, fayda puanlamalı ajanda (oyun
  yapay zekâsındaki utility AI). Önce doğru bir çalışma belleği gerekir.
- **BM25 / IDF** — spec 06'da koşullu (5c). Kök bulma gerekirse Türkçe'ye
  özgü olmalı; Open Notebook'un İngilizce kök bulucusu işe yaramaz.
- **SmolVLM (görüntü anlayan küçük model) — ertelendi, 2026-09-17.**
  Orion'a "göz" takma fikri. **Şimdi değil, çünkü algı zaten doğru çalışıyor:**
  ölçümde dünya "yönetim terminali" dedi ve doğruydu; hata gördüğünü
  *anlatırken* oldu (eski anılar bağlamı kirletti). Kamera bunu çözmez, modelin
  çelişebileceği ikinci bir girdi ekler. Işın testi sahnenin gerçeğine doğrudan
  erişiyor: 0 ms, kesin. Görüntü modeli aynı soruyu daha yavaş ve daha belirsiz
  cevaplar — bilineni tahmin etmiş olur. Donanım: 8 GB VRAM'de Babylon (~1,5 GB)
  + `qwen2.5:7b` (4,7 GB) var; 2B sığmaz, 500M sığar ama Türkçesi zayıf.
  Asıl darboğaz dil katmanı: yerel model ölçümde dünya satırını papağan gibi
  tekrarladı ("ortalama bakıyorsun, konum 0.9,-1.2...").
  **Tetikleyici koşul — bunlardan biri olursa aç:**
  (a) Orion'un, metin olarak elimizde OLMAYAN bir şeyi okuması gerekirse
  (Ozyn'in gösterdiği ekran görüntüsü, fotoğraf);
  (b) algı hattında çapraz kontrol istenirse — ışın testi ile görüntü modeli
  aynı kareye bakıp çelişirse hata yakalanır (ayna kontrolünün mantığı).
  (b) bir ürün özelliği değil, test aracıdır.
  Doğrulanacaklar: Ollama/llama.cpp desteği, gerçek VRAM ve gecikme, Türkçe.
- **Needle 3 (cactus-compute, 8–29 MB araç-çağırma modeli) — ölçüldü,
  ertelendi, 2026-09-19.** Fikir: eylem seçimini (araç çağrısı) küçük bir
  uzman modele, sözü (Türkçe düzyazı) büyük beyne vermek. Ölçüm (16 sorgu,
  her sorgu `reset()` + yalnız ilk karar `run(max_steps=0)`):

  | | bizim şema | Needle rehberine göre şema |
  |---|---|---|
  | araç + argüman doğru | 2/16 | **8/16** |
  | İngilizce sorgu | — | 9/13 araç |
  | **Türkçe sorgu** | — | **0/3** |
  | gecikme | ~0,8 sn | **0,2–0,6 sn** |

  **Neden şimdi değil:** (1) Ozyn Türkçe konuşuyor ve Needle sorguyu doğrudan
  onun sözünden alıyor — Türkçe 0/3. (2) Güven skoru bizim alanda kalibre
  değil: "Fransa'nın başkenti ne" → `look_in_front`, **güven 1.0**; reddetmesi
  gerekiyordu. Güvene göre yönlendirme (act / confirm / refuse) bu yüzden
  çalışmaz.
  **Ders — şema tasarımı model kadar önemli:** aynı model, bizim çoğullanmış
  şemayla (`dunya_sor` + `ne` enum'u, `dunya_*` adları) 2/16, "her eylem ayrı
  araç, kullanıcının söyleyeceği ad" şemasıyla 8/16. Adaptör taslağı
  `scratchpad/needle-adil.py` → `esle()` içinde (12 satır).
  **Ölçüm hijyeni:** ilk koşum geçersizdi — `run()` bir ajan döngüsü, aracı
  çalıştırmayı deneyip "unknown tool" hatasını geri besliyordu ve çağrılar
  arası konuşma durumu kalıyordu. Doğrusu: her sorguda `reset()`, `max_steps=0`.
  **Telemetri:** binary'de varsayılan AÇIK (anonim sayım, Supabase ucu);
  kullanılırsa `NEEDLE_TELEMETRY=0` ve `DO_NOT_TRACK=1` zorunlu.
  **Tetikleyici — aç:** Needle LoRA ile bizim 12 eylemimiz üzerine **Türkçe**
  ince ayarlanırsa (README: ince ayar 18–36 puan kaldırıyor) ve yeniden
  ölçümde Türkçe ≥ %80 + konu dışında güven < 0,3 olursa.
- **Karşılaştırma değerlendirmesi:** GPT-2 ürün için elendi (Türkçe'de 3,07
  token/kelime, 1.024 bağlam, talimat/araç yok); yalnızca transformer içini
  göstermek için öğretici — zihin duvarında "model nasıl düşünür" paneli fikri.

## MaleCNS connectome (Google/Janelia, Eylül 2026)

Ozyn kaynakları paylaştı; başka bir agent 3dorion için faydalı olacağını
söylemiş. **Değerlendirme: Orion'un beyni olarak kullanılamaz.**

Neden: connectome bir BAĞLANTI HARİTASIDIR, çalışan bir model değil. ~140k
nöronun kimin kime bağlandığı var; sinaptik ağırlık, zamanlama ve
nörotransmitter dinamiği yok. "Haritayı simüle et, zeka çıksın" çözülmemiş bir
problem. Doom/Mario deneyleri connectome'u rastgele bir ağ gibi kullanıp I/O
uçlarını bağlıyor — gösteri, işlevsel beyin değil.
(Eon Systems'in "beyni yükledik" iddiası ayrıca çürütüldü: The Verge.)

Orion'un eksiği zaten nöron değil: **süreklilik ve inisiyatif.**

### Yine de değerli olan tek şey: kavramsal doğrulama

Sinek beyninde gerçek refleks yayları var — görsel girdiden motora giden kısa
yol, merkezi işlemeye uğramadan. Bu, `mind/yerelTepki.ts` (sağ lob) ile
`bridge/opencode.ts` (sol lob) ayrımının biyolojik karşılığıdır: hızlı-yerel
yol ile yavaş-dilsel yol. Tasarımı DOĞRULUYOR ama yeni bir şey öğretmiyor.

### Ayrı bir merak projesi olarak

Veri açık ve erişimi kolay:
- neuPrint API (Python): `pip install neuprint-python`, dataset `male-cns:v1.0`
- Portal/indirme: https://male-cns.janelia.org/
- İnteraktif: https://neuprint.janelia.org/?dataset=male-cns%3Av1.0
- 3D: Neuroglancer (flyem-male-cns v1.0)
- Ön baskı: https://www.biorxiv.org/content/10.1101/2025.10.09.680999v2
- R paketi: https://github.com/natverse/malecns

Zihin duvarına connectome'dan ilham alan bir görselleştirme yapılabilir ama
bu SÜS olur; işlevsel katkısı yok.
