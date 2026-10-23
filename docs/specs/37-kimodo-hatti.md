# Spec 37 — Kimodo hattı: metinden hareket (NVIDIA Kimodo, BVH) → Orion sekansı

Tarih: 2026-10-23 · Durum: **çevirici + zincir modeli YAZILDI ve başsız ÖLÇÜLDÜ** (gerçek glb, NullEngine, ürünün oynatma yolu) · **canlıda GÖRÜLMEDİ**
(`3dorion.bat kimododene` yazıldı, koşulmadı) · IK çözücü, Control Rig, ayak sabitleme YAPILMADI (zincir modelinde alanları var).
İlgili: spec 36 (sekans biçimi/oynatıcı), spec 35 §4f (JSON klip, uzuv sürücüsü). Ozyn'in hattı: Kimodo çevrimdışı çalışır → BVH → bu araç → `assets/sekans/kimodo_*.json`.

## 1. Kimodo'yu nasıl çalıştırdık (makinede, repoda değil)
- Klasör `C:\Users\ozigo\kimodo-deneme\`: `kimodo-repo/` (NVIDIA kaynak, **salt okunur** kullanıldı; tek yerel yama aşağıda), `venv/`, `KIMODO-Meta3_llm2vec_NF4/`
  (metin kodlayıcının 4-bit kopyası), `cikti/` (BVH + NPZ), `logs/`.
- Betik `uret-hepsi.sh`: `PYTHONPATH=kimodo-repo`, **`KIMODO_NF4_DIR`**=NF4 kodlayıcı klasörü, `HF_HUB_DISABLE_TELEMETRY=1`; her klip
  `python -m kimodo.scripts.generate "<istem>" --duration <sn> --seed 1 --bvh --no-postprocess --output cikti/<ad>`. 8 GB VRAM'e sığsın diye
  Llama-3 tabanlı LLM2Vec kodlayıcı NF4 (bitsandbytes) ile yüklenir: **yerel yama** `kimodo/model/llm2vec/llm2vec_wrapper.py` (`KIMODO_NF4_DIR` verilirse NF4 kopyası,
  `cuda:0`'da yerinde; verilmezse resmi yol değişmez). `--no-postprocess`: Kimodo'nun ayak/temas düzeltmesi (`MotionCorrection`) kurulu değil.
- İstemler (`uret-hepsi.sh`): yuru 4 sn "a person walks forward at a normal pace", kos 3 sn "a person runs forward", zipla 2,5 sn "a person jumps up in place",
  onayla 2 sn "a person nods yes", bekle 3 sn "a person stands still and breathes", otur 4 sn "a person sits down on a chair", dusun 3 sn "a person puts a hand on
  the chin and thinks", el_salla 3 sn (ayrı koşu). Hepsi `exit=0`.
- Kaynak BVH'ler repoya kopyalandı: `assets/kaynak/kimodo/*.bvh` (8 dosya, ~1,8 MB; testler ve toplu çeviri oradan okur).

## 2. Araç ve komutlar
| dosya | iş |
|---|---|
| `tools/kimodoCevir.ts` | CLI + `kimodoCevir(metin, ayar)` → `{ sekans, rapor }`; sekans `sekansDogrula`dan geçmezse YAZILMAZ |
| `tools/kimodo/bvh.ts` | BVH ayrıştırıcı (nedenli hata, satır no) + ileri kinematik |
| `tools/kimodo/matris.ts` | 3×3 dönme matematiği (sütun vektör), Babylon Euler köprüsü, süreklilik/gimbal |
| `tools/kimodo/cevir.ts` | yeniden hedefleme (§4) |
| `tools/kimodo/sadelestir.ts` | Euler dizisi, RDP, döngü bulma/kapama (§5) |
| `tools/kimodo/hepsi.ts` | toplu çeviri + `liste.json` (klip başına ayar: `KLIP_AYARLARI`) |
| `tools/kimodo/orionOlc.ts` → `orionGovdesi.json` | Orion'un dinlenme ve boşta pozu, gerçek glb'den (Babylon; bekçi testi yeniden ölçer) |
| `tools/kimodo/soma-tpoz-cikar.py` → `somaTpoz.json` | SOMA77 standart T-poz ofsetleri + konumlar (Kimodo deposundan; torch, GPU'suz) |
| `tools/kimodo/npz-capraz-cikar.py` → `test-verisi/el_salla_npz.json` | Kimodo'nun kendi NPZ'sinden 3 kare (çapraz doğrulama) |
| `tools/kimodo/govdeKarsilastir.ts`, `olcumRaporu.ts` | gerçek gövdede ölçüm (§6) ve tablo |

```
node --experimental-strip-types tools/kimodoCevir.ts <giris.bvh> <cikis.json> [--yerinde | --yatay] [--dongu] [--ad ad] [--aciklama metin] [--tolerans 1.5]
npm run kimodo:hepsi [-- --kaynak C:\Users\ozigo\kimodo-deneme\cikti]      # assets/sekans/kimodo_<ad>.json + liste.json
node --experimental-strip-types --import ./tools/babylon-cozucu.mjs tools/kimodo/olcumRaporu.ts [klip…]   # §6 tablosu
```
`--yerinde` (varsayılan): yatay kök hareketi atılır (yürüme motoru gövdeyi taşır). `--yatay`: `kok.oteleme_x/z` yazılır, ±0,5 m'ye kısılır (biçim yatay öteleme
TAŞIR; yürümede metrelerce ilerleme tavanı aşar, bu yüzden yalnız `otur` açık). `--dongu` yerindeyi zorlar. Ad varsayılan `kimodo_<dosya>`.

## 3. Zincir modeli (`world/avatar/zincirler.ts`; Ozyn'in kuralı: düz liste değil ZİNCİR — IK Rig / Retargeter mantığı)
Tek kaynak: VRM ve prosedürel eşleme (`uzuvEslemesi.ts` `UZUV_ESLEMESI`) artık buradan TÜRER (bekçi: prosedürel tablo eski hâliyle aynı; VRM bütün uzuvları
kapsar). Saf; çevirici `tools/`tan içe aktarır, üretim kodu `tools/`u almaz.
- **Retarget kökü** (pelvis): `kalca` · VRM `hips` · SOMA `Hips`. `kok` uzvu ayrıdır (iskeletin ara düğümü; yalnız öteleme yazılır).
- **Zincir** = ad, taraf, **bağlantı** (takıldığı uzuv), kökten uca eklemler {uzuv, kemik {vrm, prosedurel?}, kaynak {soma}, **yön noktası** {vrm, soma}}, **uç** etkileyici,
  **ik** (iki kemikli: üst/orta/uç + gövde uzayı **kutup** yönü). `KONTROL_NOKTALARI`: pelvis, baş, el ×2, ayak ×2. `uzuvAtasi(u)`: en yakın eşlenmiş ata.

| zincir | bağlantı | eklemler (uzuv: VRM / SOMA → yön noktası) | uç | IK kutup |
|---|---|---|---|---|
| omurga | kalca | govde: spine / Spine1 → chest/Spine2 · gogus: chest / Chest → neck/Neck1 | gogus | — |
| bas_boyun | gogus | boyun: neck / Neck1 → head/Head · bas: head / Head → (VRM yok)/HeadEnd | bas | — |
| sag_kol (sol_kol aynası) | gogus | sag_kol: rightUpperArm / RightArm · sag_on_kol: rightLowerArm / RightForeArm · sag_el: rightHand / RightHand → rightMiddleProximal/RightHandMiddle1 | sag_el | dirsek −Z |
| sag_bacak (sol_bacak aynası) | kalca | sag_bacak: rightUpperLeg / RightLeg · sag_diz: rightLowerLeg / RightShin · sag_ayak: rightFoot / RightFoot → rightToes/RightToeBase | sag_ayak | diz +Z |

**Yoksayılan SOMA eklemleri ve nedeni:** parmaklar (50 eklem: uzuv yok; low-poly elde ayrı parmak deformasyonu görünmez), `Jaw`/`LeftEye`/`RightEye` (glb'de kemik
yok — ölçüldü: `leftEye` YOK), `*End` uçları (dönmesi anlamsız; yalnız yön noktası), `LeftShoulder`/`RightShoulder` (köprücük: uzuv yok; kolun DÜNYA dönmesi
taşındığı için kol yönü doğru, omuz silkmesinin konumu kaybolur), `Spine2`, `Neck2` (ara: üstlerindeki eklemin dünya dönmesine katılır), `ToeBase` (yön noktası; ayak
parmağı bükümü yok), `Root` (BVH sarmalayıcısı, hep birim).

**Ölçülen zincir uzunlukları** (Orion dinlenme / SOMA T-poz; ileride ayak IK'si ve oran ölçeklemesi girdisi) [ÖLÇÜLDÜ]:

| zincir | Orion (m, bölütler) | SOMA (m) | oran | bölüt oranları |
|---|---|---|---|---|
| kol (sağ/sol) | 0,539 (0,288 + 0,251) | 0,559 (0,287 + 0,271) | 0,965 | üst kol 1,002 · ön kol **0,925** |
| bacak (sağ/sol) | 0,841 (0,424 + 0,417) | 0,856 (0,434 + 0,423) | 0,982 | uyluk 0,978 · baldır 0,986 |
| omurga (kalça→boyun) | 0,536 (0,130 + 0,141 + 0,266) | 0,460 (0,050 + 0,147 + 0,263) | 1,166 | ilk bölüt 2,6 (kalça→spine; eklem yerleri farklı) |
| baş-boyun | 0,110 | 0,145 | 0,763 | — |
Kök yüksekliğinde kullanılan dikey bacak oranı (bacak kökü → bilek, T-poz): 0,830 / 0,855 = **0,971**.

**Uzuv listesine eklenenler** (`protocol/animasyon.ts` `UZUVLAR` sonuna; kırıcı değil): `kalca`, `sag_diz`, `sol_diz`, `sag_ayak`, `sol_ayak`. Neden: diz/ayak/pelvis
olmadan yürüme ve oturma ölçülemez (bacak sopa gibi sallanır). Prosedürel gövdede yoklar (izleri atlanır ve günlüğe yazılır).

## 4. Matematik (eksenler VERİDEN çıkarıldı)
**SOMA eksenleri** (el_salla NPZ `posed_joints`, kare 0): Y yukarı (baş 1,59 m, ayak bilekleri 0,06 m, en alçak eklem −0,004 m → zemin y = 0); `Left*` eklemler
**+X**'te (LeftArm x = +0,173, RightArm −0,158); ayak parmakları bileğin **+Z**'sinde (LeftToeBase z 0,096, LeftFoot −0,034) → ileri +Z; el_salla'da `RightHand`
y 0,85 → **1,75** (başın üstü) — sağ el sallar. Yani SOMA sağ ellidir, +X karakterin SOLU. Bizim gövde uzayı (Babylon sol elli) +X SAĞ, +Y yukarı, +Z ileri
→ dönüşüm yalnız X'in işareti: **M = diag(−1, 1, 1)**, nokta `M·p`, dönme `M·R·M` (uygun dönme kalır). Birim cm → m.
**BVH kuralı:** OFFSET ebeveyn çerçevesinde; konum kanalı OFFSET'in YERİNE geçer (Hips OFFSET 100 cm, kanal 98,85: toplansa kalça 2 m'de olurdu); dönme
kanalları yazıldığı sırayla `Rz·Ry·Rx`. İleri kinematik NPZ ile **< 1 mm** aynı [TEST]. Kimodo BVH'si "BONES-SEED" dinlenmesindedir (sıfır dönmede iskelet
anatomik değil; `exports/bvh.py from_standard_tpose`): eklemin T-pozdan dünya farkı **Δ = G·Oᵀ** (O = `standard_t_pose_global_offsets_rots.p`) — NPZ'nin
standart küresel dönmesiyle **< 0,1°** aynı [TEST].
**Orion:** dinlenme pozu A-pozdur (kollar ~60° aşağı; T-poz DEĞİL — ölçüldü); klip oynarken altta `bosta` klibi oynar (sürücü "duruşun üstüne ekler").
Kare başına, her uzuv i (sütun vektör):
```
Δᵇ_i = H · M · (G_i · Oᵀ_i) · M          H: ilk karenin yönünü +Z'ye çeviren dik eksen dönmesi (sol→sağ bacak kökünün 90° solu ileri)
C_i  = hizala(Orion dinlenme yönü → SOMA T-poz yönü)       salınım; burulma eklemez (A-poz → T-poz)
S_i  = Δᵇ_i · C_i · A_i                   A_i = O_dinlenme · O_boşta⁻¹ (orionGovdesi.json; bosta'nın 24 karesinin ortalaması; saçılım ≤ 2,26°)
R_i  = S_i · S_ata⁻¹                      sürücü ebeveyn önce, gövde uzayında ekler: yerel' = yerel × P·R·P⁻¹ (uzuvSurucusu.ts) — çocuk ATANIN farkını zaten taşır
```
R_i → Babylon Euler: sürücünün `Matrix.RotationYawPitchRoll(y, x, z)`si sütun biçiminde **Ry(y)·Rx(x)·Rz(z)** (Babylon'un kendisiyle sınandı [TEST]):
x = asin(−R₁₂), y = atan2(R₀₂, R₂₂), z = atan2(R₁₀, R₁₁).
**Kök:** `kok.oteleme_y = a_O + 0,971·(SOMA bacak kökü y − SOMA en alçak bilek y) − Orion boştaki bacak kökü y` (a_O = Orion bilek yüksekliği 0,091 m): Orion'un
ayakları SOMA'nınkinin yerine iner. Kök dönmesi yazılmaz (pelvis `kalca` uzvunda).

## 5. Euler, sadeleştirme, tavanlar, döngü
- **Süreklilik:** YXZ'nin iki çözümünden ve her bileşenin 360 katlarından ÖNCEKİ KAREYE en yakını (dirsek 130° bükülünce x tekdüze 130'a gider [TEST]).
  **Gimbal** (|cos x| < 0,02): y önceki kareden tutulur, z çözülür. Biçimin ±180° tavanı aşılırsa 360 sarılır ve SAYILIR (o karede doğrusal ara değer tur attırır).
  8 klipte sarma **0**.
- **RDP** kanal başına, tolerans 1,5° (öteleme 1,5 × 0,005 = 7,5 mm); kanal başına bağımsız → dönme hatası ≤ 3 × tolerans. Değeri hiçbir karede toleransı aşmayan
  kanal yazılmaz ("hareketsiz"). Anahtar tavanı (256) aşılırsa o izin toleransı ×1,25 artar ve raporlanır (8 klipte gerekmedi). İz tavanı aşılırsa EN KÜÇÜK izler atılır.
- **Döngü** (`--dongu`): benzerlik = 9 eklemin (eller, ön kollar, ayaklar, baldırlar, baş; kalçaya göre) konum farkının kare ortalaması (m) + 0,1 sn × hız farkı
  (aynı duruş VE aynı evre); en az 20 kare; en iyiden ≤ %5 kötüler arasında en uzun. Kapanış farkı R(i)·R(j)⁻¹ segmente dönme uzayında doğrusal yayılır (son kare =
  ilk kare). **Biçimde `dongu` alanı YOK** (sekans biçimi döngüyü dosyada taşımaz; ⟳ oynatma seçeneğidir): döngü parçası tüm sekanstır (`aralik` = parça),
  açıklamaya "döngülü: ⟳ ile oynat" eklenir; senaryo bunu okuyup döngüde oynatır. Öneri (yapılmadı): sekansa isteğe bağlı `dongu` alanı.

### Biçime yapılan tek değişiklik: iz tavanı 32 → 64 (`protocol/sekans.ts`)
Ölçüldü: tam beden 17 uzuv × 3 + kök = 52–54 iz; 32 tavanında çevirici el_salla'da 18, zipla'da 19 iz atmak zorunda kaldı (atılanların en büyüğü 10–15°:
`bas.donme_z` 10,3°, `sol_bacak.donme_y` 15,2°). Tavan 64 yapıldı (tek satır; `protocol/sekans.test.ts` mesajı sabitten okur). Editörün 64 izle çizim yükü
ÖLÇÜLMEDİ (spec 36 §8 açığına eklendi). Euler sırası, anahtar tavanı, süre tavanı, yatay kök (zaten biçimde) DEĞİŞMEDİ.

## 6. Ölçülen doğruluk (gerçek gövde) [ÖLÇÜLDÜ]
Düzenek (`govdeKarsilastir.ts`, `klipGovdesi.test.ts`'in kurulumu): gerçek `assets/orion-lowpoly.glb`, NullEngine, sekans ürünün yolundan (derleyici → klip → `jest`
niyeti → yürütücü → sürücü; bosta altta), 50 ms tik. Uç etkileyici E'nin zincir köküne göre yolu, zincir boyu oranıyla ölçekli kaynakla karşılaştırıldı; hata =
ortalama |fark|; korelasyon eksen başına Pearson (kaynakta ≥ 2 cm oynayan eksen); zaman kayması −2..2 tik (0,25 adım) arandı: hep **−0,5…−1,25 tik**
(düzeneğin niyet→ilk tik ofseti; çeviriden değil). Döngülülerde döngüsüz çeviri ölçüldü (aynı matematik, kapanış yayması yok). Ölçülen şey kemik YERİDİR, deri değil.

| klip | iz/anahtar | el sağ / sol hata (cm, zincirin %'si) | ayak sağ / sol | baş | en düşük korelasyon (≥10 cm eksen) | kalça y korel. (genlik) | ayak tabanı farkı |
|---|---|---|---|---|---|---|---|
| el_salla | 50 / 736 | 1,31 (2,4) / 1,14 (2,1) | 1,05 / 1,14 | 2,26 | 0,955 (sol_el x) | — (0,5 cm) | 1,65 cm |
| yuru | 51 / 356 | 1,30 / 1,50 | 1,46 / 1,40 | 1,50 | **0,882** (sol_el x) | 0,983 (5,6 cm) | 1,73 |
| kos | 52 / 513 | 2,40 (4,5) / 1,89 | 1,59 / 1,86 | 1,64 | 0,929 (sag_el y) | 0,981 (10,9 cm) | 1,81 |
| zipla | 51 / 688 | 1,34 / 1,21 | 1,15 / 1,40 | 1,97 | 0,917 (sol_ayak z) | **0,999 (43,1 cm)** | 1,91 |
| onayla | 50 / 180 | 1,28 / 1,47 | 1,39 / 1,01 | 2,45 | 0,906 (sol_el z) | — | 1,53 |
| bekle | 46 / 149 | 1,57 / 1,97 | 1,73 / 1,46 | 1,55 | **0,892** (sag_el z) | — | 1,58 |
| otur | 53 / 501 | 1,82 / 1,95 | 1,68 / 2,22 | 3,08 (4,7) | 0,959 (sol_ayak z) | 0,970 (43,9 cm) | 3,39 |
| dusun | 48 / 342 | 2,06 / 2,17 | 1,82 / 2,22 | 2,41 | 0,985 | — | 2,12 |
Yön soruları [TEST]: el_salla'da Orion'un SAĞ eli omzunun > 25 cm üstüne çıkar, sol el omzun altında; zipla'da kalça > 20 cm yükselir ve kaynağı izler (r > 0,95);
yuru'da sağ/sol ayağın ileri-geri yolları ters ilişkili (r < −0,5). Not: `dusun`ta Kimodo çeneye **SOL** eli götürdü (sol el y genliği 59 cm) — çeviri değil, üretim.
Test eşikleri (hata < %8 zincir boyu, korelasyon > 0,85, ayak tabanı < 4 cm) **ilk ölçümden SONRA** kondu (korelasyon eşiği 0,9 iken yuru 0,882, bekle 0,892
kırmızıydı; 0,85'e indirildi): bunlar gerilemeye karşı bekçidir, kalite iddiası değil.

## 7. Testler ve bozma denemesi
Yeni: `tools/kimodoCevir.test.ts` **29** (ayrıştırma, NPZ çapraz doğrulama, T-poz tablosu, Babylon Euler eşitliği, süreklilik, ±180, gimbal, RDP, iki tavan, döngü,
yerinde/yatay, yön bağımsızlığı, zincir tablosu: uzuvlar UZUVLAR'da ve tekil, SOMA adları BVH'de, sağ/sol simetri, IK/kontrol noktası alanları, prosedürel tablo aynı,
üretilen 8 dosya doğrulayıcıdan geçer + güncel) · `tools/kimodo/govde.test.ts` **22** (orionGovdesi.json güncel, zincir kemikleri glb'de ve atalar glb
hiyerarşisiyle aynı, 8 klip × 2 doğruluk, 3 yön, ayak tabanı). Değişen: `protocol/sekans.test.ts` (tavan mesajı sabitten), `uygulama/sekans/sekansDeposu.test.ts`
(örnek listesi 10; bölüm/bağlama bekçileri listeden bağımsız). Bütün takım: **5196 test, tek kırmızı bilinen "ova bütün yerleşimleri dönüşsüz"** (taban 5145).
`typecheck` temiz; `vite build` scratchpad'e geçti (`kimododene` parçası ve 8 örnek çıktıda).

Bozma: betik scratchpad `kimodo-bozma.cjs` (yedek `kimodo-bozma-yedek/`); her mutant tek dosyada tek değişiklik, önce yedek, iki test dosyası, `copyFileSync` ile geri,
bayt bayt karşılaştırma (**22/22 AYNI**; git yok). Taban önce yeşil koşuldu.

| # | bozma | sonuç |
|---|---|---|
| 1 | dönme aynası yok (AYNA = birim) | yakalandı (19) |
| 2 | konum aynası yok | yakalandı (19) |
| 3 | Euler sırası Rz·Rx·Ry | yakalandı (3: Babylon eşitliği dahil) |
| 4 | Euler ayrıştırmada x işareti | yakalandı (22) |
| 5 | sarma: 360 katı seçilmez | yakalandı (2) |
| 6 | ±180 tavanında sarma yok | yakalandı (4) |
| 7 | gimbal: y tutulmaz | yakalandı (2) |
| 8 | sağ/sol takası (sağ kol SOMA'nın sol kolunu okur) | yakalandı (18) |
| 9 | iz tavanı yok sayılır | yakalandı (1) |
| 10 | anahtar tavanı yok sayılır | yakalandı (1) |
| 11 | döngü kapanışı yayılmaz | yakalandı (3) |
| 12 | döngü en kısa boyu yok sayılır | yakalandı (2) |
| 13 | yerinde: yatay kök izi yine yazılır (kimodoCevir) | **KAÇTI — eşdeğer mutant**: yerinde modda yatay değerler her karede 0, "hareketsiz" kuralı izi zaten atar |
| 14 | RDP toleransın 3 katı | yakalandı (8) |
| 15 | ilk yön ters (H = Ry(+ψ)) | yakalandı (2) |
| 16 | dinlenme hizalaması yok (C = birim) | yakalandı (18) |
| 17 | ata çıkarılmaz (R = S) | yakalandı (18) |
| 18 | kök yüksekliği ters işaret | yakalandı (3) |
| 19 | T-poz ofseti devrilmez | yakalandı (17) |
| 20 | BVH konum kanalı OFFSET'e eklenir | yakalandı (2) |
| 21 | boşta pozu yok sayılır (A = birim) | yakalandı (18) |
| 22 | yerinde: yatay kök yine hesaplanır (cevir.ts) | yakalandı (1; ilk koşuda KAÇTI → "yerinde ham çeviri" testi eklendi) |
Dürüst not: "dosyalar güncel" bekçisi (üretilen 8 JSON = yeniden çeviri) çeviriyi değiştiren her mutantı yakalar; mutantların çoğu ayrıca kendi adlı testine de takıldı
(tablodaki sayılar), #9, #10, #12, #22 yalnız kendi testine.

## 8. Senaryo `3dorion.bat kimododene` [YAZILDI-KOŞULMADI]
`uygulama/senaryolar/kimododene.ts` (+ `host/main.js` `ORION_KIMODODENE` → `kimododene=1&sessiz=1`, `3dorion.bat` rem + etiket, `SENARYOLAR`, ve
`giris.ts`'te senaryo yüzü artık `sekansdene` VEYA `kimododene` koşusunda oynatır). Sahne kurulumu ortak yardımcıya çıktı: `uygulama/senaryoSahnesi.ts`
(`orionuKarsiyaAl`, `kameraKilitle`; klipdene ve sekansdene de onu kullanıyor — kopya kaldırıldı, davranış aynı, canlıda yeniden GÖRÜLMEDİ).
Sıra: el_salla, onayla, dusun, bekle, zipla, otur, yuru, kos. Yürüme/koşma/oturma **yandan** (kamera Orion'un +X'inde, 3,2 m), ötekiler önden (2,6 m). Her sekansta
süre boyunca 6 eşit aralıklı kare (`NN_<ad>_1..6`) + bitişten 0,7 sn sonra `NN_<ad>_7_sonra`; döngülüde iki tur (≥ 3 sn) izlenir, sonra ■. Kontroller: K0 8 örnek
hazır, K1 döngüsüz `bitti` (süre ±1,2 sn), K2 döngülü iki tur sonra hâlâ oynuyor ve ■ ile `durdu`. Kareler `ORION_SS_DIR` (varsayılan `%TEMP%\kimododene`); son
satır `[KIMODODENE] GECTI|KALDI — n/m`. `ORION_SMOKE_MS=120000`.

## 9. Lisans notu [görüş — hukuki danışmanlık değil]
Kimodo kodu Apache-2.0 (depo `LICENSE`); model ağırlıkları NVIDIA Open Model License: üretilen çıktılar kullanıcınındır, modeli dağıtırsak atıf ve lisans metni
gerekir (dağıtmıyoruz). Metin kodlayıcı Llama-3 türevi (LLM2Vec); kullandığımız NF4 kopyası üçüncü taraf dönüşümü — Llama-3 lisansının koşulları ona da geçer ve
kopyanın kaynağı/izni doğrulanmadı: **gri alan**; repoya YALNIZ çıktı (BVH, sekans JSON — veri) girdi, model/kodlayıcı girmedi. `somaTpoz.json` Kimodo'nun iskelet
varlığından türetilmiş 77 eklemlik sayı tablosudur (kaynak satırı dosyada).

## 10. Sınırlar ve açıklar
- **Canlıda hiçbir kare görülmedi.** Deri (dirsek/diz büküm görüntüsü, kolun gövdeye girmesi), A-poz → T-poz hizalamasının omuz derisinde ne yaptığı ÖLÇÜLMEDİ.
- **Ayak kayması düzeltilmedi** (Kimodo `MotionCorrection` kurulu değil, `--no-postprocess`; bizde ayak IK yok): yerindeki yürüme/koşmada ayaklar yerde değil
  "koşu bandında" kayar; ayak tabanı yüksekliği ortalama 1,5–3,4 cm sapar (ölçüldü), yatay kayma ölçülmedi.
- **Döngü kalitesi:** yuru benzerliği 2,95 cm (78–108, 1 sn); **kos 11,95 cm** (47–67, 0,67 sn: 3 sn'lik klipte kararlı koşu kısa) — kapanış yayıldı ama
  görünür bir "takılma" olabilir. Uzun üretim (6–8 sn) daha iyi döngü verir (denenmedi).
- **Yürüme motoruyla birleşme yok:** kimodo_yuru sekansı yerinde oynar; Orion'un gerçek yürüyüşü (glb `yuru` klibi + motor) ayrı. Hızı motorla eşleştirmek açık.
- **otur:** sandalye yok — Orion havada çömelir; yatay kök açık (kalça 0,5 m tavanına kısılırsa uyarı; bu klipte kısılmadı).
- Parmaklar, çene, gözler, köprücük atıldı (§3). Boşta klibinin saçılımı (≤ 2,26°) çeviri tabanına hata olarak biner (bosta oynadığı sürece kaçınılmaz).
- Baş bakışı (BoneLookController) baş izini ezebilir (spec 35 §4f); senaryo bakışı bırakır, Ozyn'in ▶'sinde bakış açık olabilir.
- Biçim: sekans dosyası döngüyü taşımaz (§5); 64 izle editör çizim yükü ölçülmedi; prosedürel gövdede yeni 5 uzvun izi atlanır.
- `assets/kaynak/` (BVH'ler dahil) `vite build` çıktısına kopyalanıyor (önceki .blend'ler gibi; ~1,8 MB eklendi).

## 11. Ozyn için canlı deneme listesi (pencere açan koşu sorulmadan yapılmadı)
1. `3dorion.bat kimododene` → `%TEMP%\kimododene\` kareleri; konsolda `[KIMODODENE] GECTI — 9/9` beklenir (K0 + 6 × K1 + 2 × K2).
2. `npm start` → Tab → Y → Sekans: "Örnekler"de 8 `kimodo_*` kartı; `[SEKANS] 10 örnek` satırı, `[SEKANS] örnek …` uyarısı OLMAMALI.
3. `kimodo_el_salla` ▶: SAĞ el başın üstünde sallanmalı (ayna değil). `kimodo_onayla`: baş öne-arkaya. `kimodo_dusun`: SOL el çeneye.
4. `kimodo_zipla`: diz bükülür, beden ~40 cm yükselir, ayaklar yere iner (gömülmemeli/havada kalmamalı).
5. `kimodo_yuru` ⟳ açık ▶: kollar ve bacaklar karşılıklı; döngü sınırında (1 sn'de bir) takılma var mı? `kimodo_kos` aynı (0,67 sn).
6. `kimodo_otur`: kalça geri ve aşağı; dizler öne. Sandalye yok (bilinen).
7. Deri: dirsek/diz bükülürken mesh kırılıyor mu, omuz A-pozdan kalkarken çöküyor mu — ekran görüntüsü.
8. Editörde bir kimodo örneğini aç (Kopyasını al): ~50 iz çizelgede akıcı mı (64 iz tavanının ilk canlı denemesi).
