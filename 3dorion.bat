@echo off
setlocal
chcp 65001 >nul 2>&1
title Orion - Sanal Alan

rem  3dorion.bat - Orion'un odasini baslatir.
rem
rem  Kullanim:
rem    3dorion.bat            derle + baslat (varsayilan)
rem    3dorion.bat hizli      derlemeyi atla, dogrudan baslat
rem    3dorion.bat gelistir   vite watch + Electron (kod degisince aninda yenile)
rem    3dorion.bat test       birim testleri + tip kontrolu
rem    3dorion.bat otodene    sahnede otomatik entegrasyon denemesi (4 kontrol)
rem    3dorion.bat gorudene   Orion terminali GORUYOR mu? (3 kontrol, gercek komut)
rem    3dorion.bat olcum      gercek cikti uzerinde suzgec olcumu (tablo)
rem    3dorion.bat sessizdene sessiz basarili komut Orion'a ulasiyor mu
rem    3dorion.bat yuzdene   agiz senkronu ve goz kirpma MESH uzerinde oynuyor mu
rem    3dorion.bat hafizadene eski bilgi 13 tur sonra hatirlaniyor mu
rem    3dorion.bat tahtadene  Orion tahtaya yaziyor mu (yakinlik kurali dahil)
rem    3dorion.bat zihindene  zihin duvari panelleri (sema + gunluk) gozle dogrulanir
rem    3dorion.bat admindene  yonetim terminali gercek kabuk mu, Orion'a siziyor mu
rem    3dorion.bat gordene    Orion odayi goruyor mu (cevap konuma bagli mi)
rem    3dorion.bat senaryodene senaryo kipi rakip niyetleri susturuyor mu
rem    3dorion.bat pybeyin    beyni PYTHON surecinde kostur (dil bagimsizlik kaniti)
rem    3dorion.bat tahtabeyin uctan uca: soyle -> beyin -> yuru -> tahtaya yaz
rem    3dorion.bat davranis   Orion gorduguna DOGRU tepki veriyor mu (3 senaryo)
rem    3dorion.bat soyle "merhaba"   sadece bir cumle soylet
rem
rem  Cevre degiskeniyle kosanlar (bat modu yok):
rem    ORION_TEZDENE=1      uctan uca tez: gordu -> onerdi -> onaylandi -> calisti
rem    ORION_SAGLOBDENE=1   sol lob kapaliyken sag lob duzeltme oneriyor mu
rem    ORION_ACIDENE=1      terminal kamera acisi (ORION_FPS=1 ile 1. sahis)
rem    ORION_SS=<yol>       duman kosusunda pencereyi PNG olarak kaydet
rem    ORION_SAGLAYICI / ORION_MODEL   beyin saglayici/model degistir
rem    ORION_BEYIN=dis      beyni HTTP uzerinden baska bir dile ver
rem    ORION_BEYIN_ADRES=   dis beynin adresi (varsayilan 127.0.0.1:4700)
rem    ORION_KAYIT=1        beyne giden GERCEK girdileri gunluge yaz
rem
rem  Beyni SAHNESIZ denemek (Python/Go/Rust ile beyin yazarken):
rem    3dorion.bat pybeyin > gunluk.txt        (ORION_KAYIT=1 ile)
rem    node tools/beyin-ayikla.mjs gunluk.txt  → fixtures/beyin/
rem    node --experimental-strip-types tools/beyin-tekrar.ts
rem      (0.2 sn; Electron acmadan, gercek girdiyle, eskisiyle karsilastirarak)
rem
rem  Not: ComfyUI acikken calistirma - bosta bile ~2.6 GB VRAM tutuyor,
rem  8 GB kartta Babylon + yerel model butcesini kiriyor.

cd /d "%~dp0"

if not exist "node_modules\" (
  echo [kurulum] node_modules yok, bagimliliklar kuruluyor...
  call npm install --no-fund --no-audit
  if errorlevel 1 goto :hata
)

set MOD=%~1
if "%MOD%"=="" set MOD=normal

if /i "%MOD%"=="test"     goto :test
if /i "%MOD%"=="otodene"  goto :otodene
if /i "%MOD%"=="gorudene" goto :gorudene
if /i "%MOD%"=="olcum"    goto :olcum
if /i "%MOD%"=="sessizdene" goto :sessizdene
if /i "%MOD%"=="davranis" goto :davranis
if /i "%MOD%"=="yuzdene"  goto :yuzdene
if /i "%MOD%"=="hafizadene" goto :hafizadene
if /i "%MOD%"=="pybeyin" goto :pybeyin
if /i "%MOD%"=="senaryodene" goto :senaryodene
if /i "%MOD%"=="gordene" goto :gordene
if /i "%MOD%"=="admindene" goto :admindene
if /i "%MOD%"=="zihindene" goto :zihindene
if /i "%MOD%"=="tahtadene" goto :tahtadene
if /i "%MOD%"=="tahtabeyin" goto :tahtabeyin
if /i "%MOD%"=="gelistir" goto :gelistir
if /i "%MOD%"=="soyle"    goto :soyle
if /i "%MOD%"=="hizli"    goto :baslat

:derle
echo [1/2] derleniyor...
call npx vite build
if errorlevel 1 goto :hata

:baslat
echo [2/2] Orion'un odasi aciliyor...
echo.
echo   WASD yuru  ^|  Shift kos  ^|  F kamera  ^|  E etkilesim  ^|  Esc cik
echo   T ile Orion'a yaz (yerel model dusunur, sesle cevap verir)
echo   1 tahtaya git  2 pencereye git  3 otur  4 kalk  5 sana bak  6 el salla
echo   Monitore E ile gec, sonra: claude
echo.
call npx electron .
goto :son

:gelistir
echo [gelistirme] vite watch + Electron. Kod degisince yeniden derlenir.
start "vite" /min cmd /c "npx vite build --watch"
timeout /t 3 >nul
call npx electron .
goto :son

:otodene
echo [otodene] sahne aciliyor, entegrasyon kontrolleri kosuyor...
call npx vite build
if errorlevel 1 goto :hata
set "ORION_OTODENE=1"
set "ORION_SMOKE=1"
call npx electron .
goto :son

:pybeyin
echo [pybeyin] beyin PYTHON'da kosar (tools/ornek-beyin.py ayri pencerede acilir)
call npx vite build
if errorlevel 1 goto :hata
start "Orion beyni (Python)" cmd /k python "%~dp0tools\ornek-beyin.py"
timeout /t 2 >nul
set "ORION_BEYIN=dis"
call npx electron .
goto :son

:senaryodene
echo [senaryodene] senaryo kipi rakip niyetleri gercekten susturuyor mu
call npx vite build
if errorlevel 1 goto :hata
set "ORION_SENARYODENE=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=15000"
call npx electron .
goto :son

:gordene
echo [gordene] Orion odayi goruyor mu? cevap konuma bagli mi?
call npx vite build
if errorlevel 1 goto :hata
set "ORION_GORDENE=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=28000"
call npx electron .
goto :son

:admindene
echo [admindene] yonetim terminali gercek kabuk mu, Orion'a siziyor mu
call npx vite build
if errorlevel 1 goto :hata
set "ORION_ADMINDENE=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=22000"
call npx electron .
goto :son

:zihindene
echo [zihindene] zihin duvari panelleri (sema + gunluk) gozle dogrulanir
call npx vite build
if errorlevel 1 goto :hata
set "ORION_ZIHINDENE=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=30000"
call npx electron .
goto :son

:tahtadene
echo [tahtadene] Orion tahtaya yaziyor mu? (uzaktan yazmak reddedilmeli)
call npx vite build
if errorlevel 1 goto :hata
set "ORION_TAHTADENE=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=25000"
call npx electron .
goto :son

:tahtabeyin
echo [tahtabeyin] uctan uca: Ozyn soyler, beyin karar verir, Orion yurur ve yazar
call npx vite build
if errorlevel 1 goto :hata
set "ORION_TAHTABEYIN=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=32000"
call npx electron .
goto :son

:hafizadene
echo [hafizadene] bilgi verilir, 13 alakasiz tur gecer, sonra sorulur.
call npx vite build
if errorlevel 1 goto :hata
set "ORION_HAFIZADENE=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=75000"
call npx electron .
goto :son

:yuzdene
echo [yuzdene] agiz ve goz MESH uzerinde gercekten oynuyor mu?
call npx vite build
if errorlevel 1 goto :hata
set "ORION_YUZDENE=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=25000"
call npx electron .
goto :son

:davranis
echo [davranis] Orion'a uc gercek senaryo yasatiliyor...
echo   1) Ozyn selam veriyor     - cevap vermeli
echo   2) terminalde gercek hata - fark edip SOYLEMELI
echo   3) rutin basarili komut   - SUSMALI
call npx vite build
if errorlevel 1 goto :hata
set "ORION_DAVRANIS=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=72000"
call npx electron .
goto :son

:sessizdene
echo [sessizdene] cikti uretmeyen ama zaman alan komut Orion'a ulasiyor mu?
call npx vite build
if errorlevel 1 goto :hata
set "ORION_SESSIZDENE=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=30000"
call npx electron .
goto :son

:gorudene
echo [gorudene] Orion masasindaki terminali goruyor mu?
echo   1) acilis afisi gurultu sayilmali
echo   2) basarili rutin komut beyni UYANDIRMAMALI
echo   3) gercek kabuk hatasi Orion'a ULASMALI
call npx vite build
if errorlevel 1 goto :hata
set "ORION_GORUDENE=1"
set "ORION_SMOKE=1"
set "ORION_SMOKE_MS=26000"
call npx electron .
goto :son

:olcum
echo [olcum] gercek terminal ciktisi uzerinde suzgec davranisi...
echo   (yakalama dizini yoksa once gercek komutlar calistirilmali)
if "%~2"=="" (
  echo   kullanim: 3dorion.bat olcum "<yakalama-dizini>"
  goto :son
)
call npx node --experimental-strip-types mind\akis-olcum.ts "%~2"
goto :son

:test
echo [test] tip kontrolu...
call npx tsc --noEmit
if errorlevel 1 goto :hata
echo [test] birim testleri...
call npm test
goto :son

:soyle
if "%~2"=="" (
  echo Kullanim: 3dorion.bat soyle "soyletmek istedigin cumle"
  goto :son
)
call npx vite build >nul 2>&1
set "ORION_SOZ=%~2"
rem Soyleyip kendiliginden kapansin - bu bir arac, oturum degil.
set "ORION_SMOKE=1"
call npx electron .
goto :son

:hata
echo.
echo [HATA] Islem basarisiz. Yukaridaki ciktiya bak.
pause
exit /b 1

:son
endlocal
