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
