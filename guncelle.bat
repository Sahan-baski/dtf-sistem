@echo off
title DTF Sistem Guncelleyici
cd /d "%~dp0"

echo.
echo  =====================================
echo   DTF Sistem Guncelleyici
echo  =====================================
echo.

echo  [1/3] Frontend derleniyor...
cd frontend
call npm install --silent 2>nul
call npm run build
if errorlevel 1 (
    echo  HATA: Frontend derlenemedi!
    pause
    exit /b 1
)

echo  [2/3] Dosyalar kopyalaniyor...
xcopy /s /e /y /q dist\* ..\backend\public\ >nul

cd ..

echo  [3/3] GitHub a gonderiliyor...
git add .
git commit -m "guncelleme"
git push

echo.
echo  =====================================
echo   Tamamlandi!
echo   Render 2-3 dakika sonra guncellenir.
echo   https://dtf-sistem.onrender.com
echo  =====================================
echo.
pause
