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
rem    3dorion.bat soyle "merhaba"   sadece bir cumle soylet
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
