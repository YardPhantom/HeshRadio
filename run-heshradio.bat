@echo off
title HeshRadio // Tactical SDR Transceiver
cd /d "%~dp0"
echo =====================================================================
echo   HESHRADIO // TACTICAL TRANSCEIVER, SDR WATERFALL ^& RIG CONTROLLER
echo =====================================================================
echo.
echo Desktop URL: http://localhost:5173/
echo S26 Ultra Mobile (Wi-Fi): http://192.168.1.79:5173/
echo.
start http://localhost:5173/
npm run dev
pause
