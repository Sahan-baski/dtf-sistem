@echo off
title DTF Yonetim Sistemi
echo.
echo  ================================
echo   DTF Yonetim Sistemi Baslatiliyor
echo  ================================
echo.

cd /d "%~dp0backend"
echo  [1/2] Backend baslatiliyor...
start "DTF Backend" cmd /k "node server.js"
timeout /t 2 /nobreak > nul

echo  [2/2] Tarayici aciliyor...
timeout /t 1 /nobreak > nul
start http://localhost:3001

echo.
echo  Sistem calisiyor! Tarayicinizda acilmali.
echo  Kapatmak icin backend penceresini kapatin.
echo.
pause
