# Spec 38 â€” Control Rig, kanonik iskelet, Sekans kamerasÄ± ve editÃ¶r kabuÄŸu

Durum (2026-10-24): yazÄ±ldÄ±, `rigdene` 12/12 ve `kameradene` 8/8 canlÄ± koÅŸuldu (ekran gÃ¶rÃ¼ntÃ¼leri `%TEMP%\rigdene`, `%TEMP%\kameradene`). KullanÄ±cÄ± (Ozyn) canlÄ±da
henÃ¼z denemedi. BaÄŸlam: spec 36 (Sekans), spec 37 (Kimodo hattÄ±). Ozyn'in isteÄŸi: "Kimodo ile yapÄ±p kendi sahnemizde dÃ¼zenleyebilmek; control rig, modÃ¼ler, iskelet
dÃ¼zgÃ¼n; arayÃ¼z kullanÄ±ÅŸsÄ±z, menÃ¼ler/araÃ§lar yerinde olsun, kamera ekleyebilelim".

## 1. Karar Ã¶zeti
- **Rig = Sekans verisini dÃ¼zenleyen gÃ¶rsel katman.** Yeni bir animasyon biÃ§imi YOK: rig, bir kontrolÃ¼ dÃ¶ndÃ¼rÃ¼nce playhead karesine uzuv izlerine ANAHTAR yazar (auto-key).
  Kimodo Ã§Ä±ktÄ±sÄ± (64 izli sekans) doÄŸrudan dÃ¼zenlenir; her dÃ¼zenleme TEK geri al adÄ±mÄ±dÄ±r.
- **ModÃ¼ler, iÃ§ iÃ§e deÄŸil:** saf Ã§ekirdek (Babylon yok) ile ince Babylon katmanÄ± ayrÄ±; tek yÃ¶nlÃ¼ baÄŸÄ±mlÄ±lÄ±k; kontrol kaydÄ± bir TABLO (yeni kontrol = yeni satÄ±r).
- **Kanonik iskelet** kaynak iskeletten ayrÄ±ldÄ± (Â§2). Retarget, IK ve rig yalnÄ±z ona dayanÄ±r.
- **Kamera sekansÄ±n parÃ§asÄ±:** isimli kameralar + kamera kesmeleri (Â§7), dosyada saklanÄ±r; oynatma ve Ã¶nizleme canlÄ± kamerayÄ± sÃ¼rer.
- **EditÃ¶r kabuÄŸu** (menÃ¼ Ã§ubuÄŸu, araÃ§ Ã§ubuÄŸu, yan sekmeler, yeniden boyutlanÄ±r dok, durum Ã§ubuÄŸu) Sekans iÃ§in kuruldu (Â§6); Graf editÃ¶rÃ¼ sonraki adÄ±m.

## 2. Kanonik iskelet (`world/avatar/iskelet/`)
```
kanonik.ts   YAPI: 17 uzuv (kalca kÃ¶kÃ¼; omurga, baÅŸ-boyun, saÄŸ/sol kol, saÄŸ/sol bacak zincirleri), ebeveyn, kutup (dirsek GERÄ° âˆ’Z, diz Ä°LERÄ° +Z)
kaynaklar.ts KAYNAK ADLARI: uzuv â†’ VRM kemik adÄ±, SOMA (Kimodo) eklemi, prosedÃ¼rel dÃ¼ÄŸÃ¼m, yÃ¶n noktasÄ±
zincirler.ts Ä°KÄ°SÄ°NÄ°N BÄ°RLEÅÄ°MÄ° (eski ZincirEklemi biÃ§imi): Ã§evirici, eÅŸleme tablosu ve rig bunu okur â€” tÃ¼keticiler deÄŸiÅŸmedi
```
Yeni kaynak iskelet (Mixamo, Unreal Mannequin) = `kaynaklar.ts`'e bir tablo; yapÄ±ya ve zincirlere dokunulmaz. BirleÅŸik tablo eski tek-tablo hÃ¢liyle anlamca AYNI
(anlÄ±k gÃ¶rÃ¼ntÃ¼ karÅŸÄ±laÅŸtÄ±rmasÄ±; `iskelet/kanonik.test.ts`). Unreal IK Rig / Mixamo karÅŸÄ±lÄ±ÄŸÄ±: kalca = pelvis/Hips, govde = spine_01, gogus = spine_03, boyun = neck_01,
kol = upperarm, on_kol = lowerarm, el = hand, bacak = thigh, diz = calf, ayak = foot.

## 3. Control Rig modÃ¼l haritasÄ±
```
world/avatar/rig/matris.ts      3Ã—3 dÃ¶nme matematiÄŸi (Ã§evirici ile ORTAK tek kopya; tools/kimodo/matris.ts yeniden dÄ±ÅŸa aktarÄ±r)
world/avatar/rig/poz.ts         eksendeDondur(Euler, eksen, derece): gÃ¶vde ekseninde SOLDAN Ã§arpÄ±m, Ã¶ncekine en yakÄ±n Euler (Â±180 sarma, gimbal)
world/avatar/rig/kontroller.ts  KONTROL KAYDI (tablo): ÅŸekil (halka, disk, kutu), yarÄ±Ã§ap, ad, renk (Unreal: saÄŸ kÄ±rmÄ±zÄ±, sol mavi, orta sarÄ±)
world/avatar/rig/surukleme.ts   fare farkÄ± â†’ aÃ§Ä± (halka teÄŸeti ekranda, kenardan bakÄ±ÅŸta sÄ±nÄ±rlÄ±)
world/avatar/rig/halkaSecimi.ts halka seÃ§imi EKRAN UZAYINDA (en yakÄ±n Ã§izgi, 11 px) â€” mesh pick deÄŸil (Ã¼st Ã¼ste binen tÃ¼pler yanlÄ±ÅŸ halkayÄ± seÃ§iyordu)
world/avatar/rig/gosterim.ts    Babylon: ÅŸekiller (gÃ¶vdenin Ã¼stÃ¼nde, renderingGroup 1), seÃ§ili kontrolÃ¼n 3 dÃ¶ndÃ¼rme halkasÄ±
uygulama/rig/anahtarla.ts       rigDuzenle(): hedef toplam dÃ¶nme â†’ izler/anahtarlar (klip altta oynarken katkÄ±sÄ± Ã‡IKARILIR; yeni iz Â±6 kare komÅŸu sÄ±fÄ±rla)
uygulama/rig/rigKipi.ts         denetleyici: seÃ§im, sÃ¼rÃ¼kleme Ã¶nizlemesi (bÄ±rakÄ±nca TEK adÄ±m), geri al, bedene poz (Avatar.rigPozu)
uygulama/yapi/rig/rigPaneli.ts  panel: zincir zincir kontrol listesi, 3 kanal sayÄ± kutusu Â± dÃ¼ÄŸmeleri, anahtar durumu
```
Avatar kamu yÃ¼zÃ¼ne eklenenler: `rigPozu(uzuvDegerleri | null)` (klibin YERÄ°NE uygulanÄ±r; â–¶ sÄ±rasÄ±nda bÄ±rakÄ±lÄ±r), `uzuvKonumu(uzuv)`, `cizimYaw()`; `Beden.rigPozu`,
`AvatarIskeleti.uzuvKonumu`. Sekans scrub'Ä± artÄ±k gÃ¶vdeyi oynatÄ±r (eski aÃ§Ä±k kapandÄ±: rig kipinde playhead karesinin pozu bedende gÃ¶rÃ¼nÃ¼r).

**Auto-key kuralÄ±:** hedef = uzvun O KAREDEKÄ° TOPLAM dÃ¶nmesi (bÃ¼tÃ¼n izlerin toplamÄ±); yazÄ±lan deÄŸer = hedef âˆ’ Ã¶teki izlerin katkÄ±sÄ±. BÃ¶ylece klip bÃ¶lÃ¼mÃ¼ altta oynarken elle
eklenen iz klibin ÃœSTÃœNE biner. Kilitli iz, anahtar tavanÄ± (256), iz tavanÄ± (64) nedenle reddedilir (`sekansDogrula`).

**Kapsam dÄ±ÅŸÄ± (sonraki dilimler):** R2 iki kemikli IK Ã§Ã¶zÃ¼cÃ¼ ve ayak sabitleme (kutup bilgisi kanonik tabloda hazÄ±r), R3 poz kÃ¼tÃ¼phanesi ve Kimodo dÃ¼zeltme akÄ±ÅŸÄ±, konum tutamacÄ±
(yalnÄ±z dÃ¶nme var), Flash'Ä±n bedeni (rig yalnÄ±z Orion'u dÃ¼zenler), yÃ¼z paneli.

## 4. Kamera (sekans biÃ§imi, `protocol/sekans.ts`)
```
kameralar: [{ id, ad, konum:[x,y,z], hedef:[x,y,z], fov }]      en Ã§ok 8; koordinat Â±1000 m; fov 10â€“120Â°; konumâ‰ hedef (â‰¥ 1 cm)
kesmeler:  [{ kare, kamera, gecis:"kesme"|"yumusak", gecis_kare }] en Ã§ok 64; kare KESÄ°N artan; yumuÅŸak iÃ§in 1â€“90 kare (kesme: 0)
```
Ä°steÄŸe baÄŸlÄ± Ã¼st dÃ¼zey alanlar; boÅŸsa YAZILMAZ (eski dosyalar aynen geÃ§erli, SEKANS_SURUMU deÄŸiÅŸmedi). Ä°z deÄŸil: kamera bir ajana baÄŸlÄ± deÄŸil. Ä°lk kesmeden Ã–NCE oyunun kendi kamerasÄ± sÃ¼rer.
DeÄŸerlendirme saf (`uygulama/sekans/kameraDegerlendir.ts`): kare â‰¤ k olan son kesme; yumuÅŸak geÃ§iÅŸte Ã¶nceki kameradan smoothstep harman (konum, hedef, fov).

**CanlÄ± kamera:** `KameraRig.sekansKamerasi(konum, bakis, fov)` odaktan ve sinematikten Ã–NCE gelir, yumuÅŸatmasÄ±z tam poz; `sekansKamerasiBirak()` oyuncuya dÃ¶ner ve fov'u geri koyar.
`kameraOynatici.ts`: â–¶ sÄ±rasÄ±nda oynatÄ±cÄ±nÄ±n ANLIK GÃ–RÃœNTÃœSÃœNDEKÄ° kamera verisi (oynarken dÃ¼zenleme kamerayÄ± deÄŸiÅŸtirmez) ve oynatÄ±cÄ±nÄ±n karesi; oynamÄ±yorken editÃ¶rÃ¼n Ã¶nizlemesi
(Kamera sekmesi: KapalÄ± / SeÃ§ili kamera / SekansÄ±n kamerasÄ±). YalnÄ±z kamera kesmesi olan, hareketsiz sekans da oynar (sÃ¼reyi saat bitirir).
Kamera kaynaklarÄ±: oyuncunun ÅŸu anki gÃ¶rÃ¼nÃ¼mÃ¼ (3 m Ã¶nÃ¼ hedef), Orion'un karÅŸÄ±sÄ±/yanÄ±; sonra sayÄ± kutularÄ± ve yÃ¶rÃ¼nge dÃ¼ÄŸmeleri (â—€ â–¶ â–² â–¼ ï¼‹ âˆ’, hedef sabit). EditÃ¶r aÃ§Ä±kken
sahnede serbest gezinti yok (tuÅŸlar editÃ¶rÃ¼n); Ã¶nizleme canlÄ± olduÄŸundan sayÄ± deÄŸiÅŸince kadraj anÄ±nda deÄŸiÅŸir.
**Ä°leride Ã§aÄŸrÄ±labilirlik:** kameralar adla saklÄ±; "kamerayÄ± Ã§aÄŸÄ±r" iÃ§in grafik dÃ¼ÄŸÃ¼mÃ¼/niyet bu spec'te YOK (Orion'un araÃ§ yÃ¼zeyine hiÃ§bir ÅŸey eklenmedi).

## 5. GÃ¼venlik
Rig yalnÄ±z sekans VERÄ°SÄ°NÄ° dÃ¼zenler; Ã§alÄ±ÅŸtÄ±rma (â–¶) yolu aynÄ±: yalnÄ±z gerÃ§ek tÄ±k (`isTrusted`), menÃ¼de â–¶ YOK. Rig fare olaylarÄ± yalnÄ±z gerÃ§ek tÄ±k; senaryo programlÄ± yolu
yalnÄ±z rigdene/kameradene koÅŸusunda (`senaryoKosusu`). Orion'un araÃ§ yÃ¼zeyi ve niyet sÃ¶zleÅŸmesinde rig/kamera yok (bekÃ§i `sekansBekci.test.ts` korunur).

## 6. EditÃ¶r kabuÄŸu (Sekans)
YerleÅŸim: boyut tutamaÄŸÄ± Â· menÃ¼ Ã§ubuÄŸu (Dosya, DÃ¼zen, GÃ¶rÃ¼nÃ¼m, Oynat, Ekle, Rig, YardÄ±m) Â· sekme satÄ±rÄ± Â· araÃ§ Ã§ubuÄŸu (â® â—€ â–¶ â–  â–¶| â­ âŸ³ | â—† ğŸ§² â¤¢ | ğŸ¦´ ğŸ¥ | okuma | Kaydet âœ•) Â·
gÃ¶vde: sol iz listesi | zaman Ã§izelgesi | saÄŸ sekmeler (AyrÄ±ntÄ±lar Â· Rig Â· Kamera) Â· durum Ã§ubuÄŸu. Zaman Ã§izelgesinin en Ã¼stÃ¼nde ğŸ¥ Kamera satÄ±rÄ± (kesme bloklarÄ±, sÃ¼rÃ¼klenir, Ã§ift tÄ±k ekler).
**Sahne dokun altÄ±nda kalmaz:** dok aÃ§Ä±kken tuval kÃ¼Ã§Ã¼lÃ¼r (`--editor-alt`; `index.html`: `#tuval` yÃ¼ksekliÄŸi `max(--alt-cubuk, --editor-alt)` kadar kÄ±salÄ±r, ResizeObserver motoru boyutlar);
dok yÃ¼ksekliÄŸi tutamakla ayarlanÄ±r (220 px â€“ pencerenin %75'i, oran hatÄ±rlanÄ±r). AltyazÄ± ve sohbet bu payÄ± bilir. YapÄ± Ã§ubuÄŸu aÃ§Ä±kken de tuval onun kadar kÄ±sa (yan etki: alttaki 41 px
ÅŸerit artÄ±k sahnenin parÃ§asÄ± deÄŸil).
Ortak parÃ§alar `uygulama/yapi/ortak/`: `menuModeli.ts` (saf, testli), `menuCubugu.ts`, `yanSekmeler.ts`, `dokBoyutu.ts`, `kabukStili.ts` â€” Graf editÃ¶rÃ¼ de bunlarÄ± kullanacak.

## 7. Ã–lÃ§Ã¼mler
- Birim test: 5274 test, tek eski kÄ±rmÄ±zÄ± ("ova bÃ¼tÃ¼n yerleÅŸimleri dÃ¶nÃ¼ÅŸsÃ¼z"). Yeni testler: iskelet 7, rig Ã§ekirdeÄŸi 11, sÃ¼rÃ¼kleme 8, halka seÃ§imi 7, anahtar yazma 10, sekans kamera biÃ§imi 7,
  kamera deÄŸerlendirme/iÅŸlemler 10, kamera oynatÄ±cÄ± 6, kamera yardÄ±mcÄ±larÄ± 6, menÃ¼ modeli 5, izDuzeni kamera satÄ±rÄ± 2.
- Bozma denemesi: 18 mutant, 17 yakalandÄ± + 1 eÅŸdeÄŸer ("harman bir kare uzun": o karede smoothstep 1, poz aynÄ±). Ä°lk koÅŸuda "halka parÃ§asÄ± sÄ±nÄ±rÄ±" kaÃ§mÄ±ÅŸtÄ±, test eklendi.
- `rigdene` 12/12: 17 kontrol ÅŸekli, el kutusuna tÄ±klama doÄŸru kontrolÃ¼ buluyor, X halkasÄ± seÃ§iliyor, sÃ¼rÃ¼kleme eli 44 cm taÅŸÄ±dÄ± ve anahtar yazdÄ±, geri al eski yere dÃ¶ndÃ¼rdÃ¼ (fark 1,5 cm =
  boÅŸta nefes gÃ¼rÃ¼ltÃ¼sÃ¼), panelden dÃ¶ndÃ¼rme eli 29 cm taÅŸÄ±dÄ±, â–¶ rig aÃ§Ä±kken Ã§alÄ±ÅŸÄ±yor, tuval dokun Ã¼stÃ¼nde (465/861 px), editÃ¶r kapanÄ±nca editÃ¶r payÄ± 0.
- `kameradene` 8/8: iki kamera gerÃ§ek dÃ¼ÄŸmelere tÄ±klanarak eklendi, Ã¶nizleme kamerayÄ± 0,000 m sapmayla taÅŸÄ±dÄ±, â–¶ sÄ±rasÄ±nda kamera 1â†’2 gitti (0,00 m), bitince oyuncuya dÃ¶ndÃ¼,
  yalnÄ±z-kamera sekansÄ± oynadÄ± ve bitti. `sekansdene` 7/7, `klipdene` 5/5, `kimododene` 9/9 bozulmadÄ±.
- Bulunan ve dÃ¼zeltilen: rig aÃ§Ä±kken FPS 100â†’5 (her karede `setEnabled`, Ä±ÅŸÄ±k kaynaÄŸÄ± yeniden hesabÄ±); halka tÄ±klama tÃ¼pÃ¼ 7 mm; Ã¼st Ã¼ste binen tÃ¼pler yanlÄ±ÅŸ halkayÄ± seÃ§iyordu.

## 8. AÃ§Ä±klar (dÃ¼rÃ¼st liste)
- CanlÄ±da insan eliyle denenmedi: gerÃ§ek fare sÃ¼rÃ¼kleme hissi, halka seÃ§im payÄ± (11 px), kamera yÃ¶rÃ¼nge dÃ¼ÄŸmelerinin adÄ±mÄ±, sahnenin tuval kÃ¼Ã§Ã¼lmesiyle gÃ¶rÃ¼nÃ¼ÅŸÃ¼.
- Rig ÅŸekilleri uzaktan kÃ¼Ã§Ã¼k (kamera Orion'dan 4 m); odaklÄ± kadraj iÃ§in Kamera sekmesinin "Orion'un karÅŸÄ±sÄ±" Ã¶nizlemesi kullanÄ±labilir.
- Konum tutamacÄ± yok (yalnÄ±z dÃ¶nme); IK yok, ayak kaymasÄ± dÃ¼zeltilmedi; Flash'Ä±n bedeni rig'de yok.
- Kesme sÃ¼rÃ¼kleme son hÃ¢li ve zaman Ã§izelgesindeki kamera satÄ±rÄ± ayrÄ±ntÄ±larÄ± `kameradene`'de yalnÄ±z gÃ¶rÃ¼ntÃ¼yle (`02_kesmeler_cizelgede`) gÃ¶rÃ¼ldÃ¼.
- Graf editÃ¶rÃ¼ yeni kabuÄŸa taÅŸÄ±nmadÄ± (menÃ¼/araÃ§ Ã§ubuÄŸu/dok yok); sÄ±radaki iÅŸ.
- Animasyon odasÄ± (stÃ¼dyo, boÅŸ sahne) Ã¶nerildi; `world/level/` istisnasÄ± gerektirir, yapÄ±lmadÄ±.
- Kamera Ã§arpÄ±ÅŸmasÄ± yok (iki kamera arasÄ± dÃ¼z Ã§izgi duvardan geÃ§ebilir).
