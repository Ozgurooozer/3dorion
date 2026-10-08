# CLAUDE.md

3dorion: Orion'un (bir yapay zekâ) yaşadığı 3D oda — Babylon.js sahne, Electron kabuk, monitörde gerçek terminal.
Tez: **"AI'ın oturduğu oda — terminalini onun masasında açıyorsun."** Kod, yorum, commit ve belgeler Türkçe
(brain-lab hariç); mevcut dosyayı düzenlerken ona uy.

**Belgeler:** `docs/INDEX.md` her spec'i tek satırla, durumuyla ve "ne zaman oku" notuyla listeler — bir alana
dokunmadan önce oradan ilgili spec'i aç (kararlar ölçüme dayanır, sezgiye değil). Açık işler: `docs/ACIK-ISLER.md`.

## Komutlar
```
npm run typecheck   # tsc --noEmit (strict; tek statik kapı, linter yok; brain-lab/ dahil)
npm test            # bütün *.test.ts (node:test, Jest yok)
npm run dev         # yalnız vite (Electron'suz)
npm start           # build + Electron
npm run exp / lab   # brain-lab deney koşucusu / görüntüleyici (:5190)
npm run ogret       # tools/ogret.ts gozden — kapı kararlarını kayıttan düzelt (spec 09)
```
Tek test: `node --experimental-strip-types --import ./tools/babylon-cozucu.mjs --test yol/dosya.test.ts`
(`--import` kancası Babylon'un uzantısız alt yol importlarını çözer; dar tutulmuştur).
tsconfig `erasableSyntaxOnly` + `verbatimModuleSyntax`: enum yok, parametre özelliği yok, tip importu `import type`,
import yollarında `.ts` uzantısı.

**`3dorion.bat <mod>`** asıl çalıştırma yolu ve ~25 canlı doğrulama senaryosudur (liste dosya başında:
`gorudene`, `eylemdene`, `tahtadene`, `hafizadene`, `baglamdene`, `takipdene`, `mikrofon`…). Davranış değişikliğini
doğrularken önce var olan bir `*dene` modu ara. Senaryo koşusu (`ORION_SMOKE=1`) gerçek hafıza/durum dosyasına
yazmaz. Önemli env: `ORION_BEYIN` (`yerel:<model>`, `claude:haiku`, `dis`), `ORION_KARAR_DOSYASI`,
`ORION_HAFIZA_DOSYASI`, `ORION_KAYIT=1`, `ORION_SS=<yol>`, `ORION_HAFIZA_KIPI=otomatik` (spec 16 kıyas kolu).

## Mimari: en önemli kural
```
protocol/  ORTAK — beyin ile beden arasındaki TEK sözleşme; hiçbir şeye bağımlı değil
world/     ÖN    — Babylon sahne + simülasyon; yalnız protocol/'ü import eder
voice/     ÖN    — STT (klavye, Nemotron mikrofon) + TTS (Piper)
mind/      ARKA  — dikkat, refleks, hafıza, benlik, karar kaydı, içgüdüler
bridge/    ARKA  — protocol ↔ beyinler (ollama, apiBeyni, opencode, disBeyin, mcpBeyin); köprü `kopru.ts`
host/      KABUK — Electron ana süreç: pty, IPC (kanal adları TEK kaynak `host/kanallar.cjs`), dosyalar
uygulama/  UYGULAMA — kompozisyon: niyet yürütücü, zihin duvarı, beyin seçimi, senaryolar
world/giris.ts — kompozisyon kökü (tek istisna: beyni bedene bağlar)
```
Bağımlılık tek yönlü; `world/` asla `bridge/`/`mind/` import etmez (K4). Bekçiler: `tools/mimari.test.ts`
(katman başına izinli importlar), `world/bagimlilik.test.ts`, `tools/tipKacisi.test.ts` (`as unknown as` izin listesi).

- **protocol/:** `niyet.ts` Orion'un her eylemi (araç yüzeyi buradan türer, `bridge/araclar.ts`); `algi.ts` dünyanın
  söyledikleri; `dogrula.ts` her niyeti dünyadan önce doğrular, reddi sessiz değil. **`tik` algısı asla `beyin`
  kanalına girmez** (`protokol.test.ts`) — maliyet tavanı. Alan/varyant eklemek kırıcı değil; silmek/yeniden adlandırmak
  `SURUM` artırır.
- **Beyinler** `bridge/beyin.ts` `Beyin` arayüzünün arkasında; yerel modeller ve bulut seçenekleri taranır,
  sabit kodlanmaz (`bridge/beyinKatalogu.ts`). Seçim M tuşu (`world/arayuz/modelSecici.ts`).
- **Tek eylem yolu:** her karar `niyetiYurut()`ten geçer (yakınlık kuralı, onay kapısı `mind/onayKapisi.ts`,
  kısaltma aynı yerde). Orion komut ÖNERİR; çalıştıran Ozyn'in tuşudur.
- **LLM'i atlayan yollar** adlı içgüdüdür (`mind/icgudu.ts`, karar kaydına yazılır): `kopru.komut` (doğuştan
  programlar), `kopru.refleks` (beceri), `kopru.sohbet` (yeni/temiz/normal sohbet), `kopru.takip` (beni takip et).
  Kapıya yeni kural = yeni içgüdü kimliği (spec 08).
- **Bağlam (spec 16):** bağlama yalnız sorulan girer — kural yönlendirici `mind/hafizaYonlendirici.ts`, durum
  defteri `mind/durumDefteri.ts`, çekmeceli hafıza `mind/hafiza.ts`. Çerçeve İngilizce, odadaki adlar ve Orion'un
  sesi Türkçe (spec 06 §6.8).

## brain-lab/ — ayrı araştırma alt projesi
Orion'a bağlı değil (hiçbir üretim modülü import etmez). Kendi `brain-lab/CLAUDE.md`'si var ve orada BU dosyanın
yerine geçer — dokunmadan önce oku. Farklar: kod/yorum/commit İngilizce, rastgelelik `world/rng.ts`'ten, her koşu
önceden kayıtlı. Yöntem `themis` skill, deney partileri `atlas` ajanı. `brain-lab/data/` git-dışı, `archive/` donuk.
`graphify-out/` önbellektir, kaynak değil.

## Çalışma kuralları
- **İddia canlı kanıt ister.** Etiketler: `[TEST]` birim testli · `[ÖLÇÜLDÜ]` canlı/gerçek koşuda sayı var ·
  `[YAZILDI-KOŞULMADI]`. Yeşil test "çalışıyor" demek değildir; algıyı ya da tepkiyi etkileyen değişiklikte bir
  `*dene` senaryosu koş.
- **Davranışı sezgiyle ayarlama.** Model/parametre seçimleri `tools/` altındaki ölçüm araçlarıyla kararlaştırıldı
  ve sayıları spec'lerde (`tools/eylem-olc.ts`, `tools/sadakat-olc.ts`, `tools/baglam-ozet.ts`…). Değiştirmeden
  önce ölçüm aracını bul.
- **Çıkış kodu karar verir,** çıktı metninde anahtar kelime aramaz (kabuk bu yüzden PowerShell; OSC 133).
- **Kopya kod: kural değil bekçi.** İkinci kopya bulunca birini sil, ötekinden türet, ayrıştıklarında kırılan bir
  test ekle (`docs/olcum-ponytail.md`). Bir sabiti/metni değiştirmeden önce bütün kullanıcılarını grep'le.
- Yoğun Türkçe "neden" yorumları ürünün parçasıdır; inceltme.
