@echo off
chcp 65001 >nul
cd /d "%~dp0"
title QR Production Prompter
echo.
echo ========================================
echo   QR PRODUCTION PROMPTER - Baslatiliyor
echo ========================================
echo.
echo Sunucu adresi: http://localhost:8777
echo.
echo Tarayici otomatik acilacak...
echo Bu pencereyi KAPATMA (sunucu calisiyor).
echo.
start "" "http://localhost:8777/index.html"
python -m http.server 8777
pause
