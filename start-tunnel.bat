@echo off
title Cloudflare Tunnel - Zabbix GIS-AFFNET
cd /d "%~dp0"
echo ========================================================
echo   MENJALANKAN TUNNEL ZABBIX LAPTOP KE CLOUD (RAILWAY)
echo ========================================================
echo.
echo 1. Memastikan Container Zabbix Berjalan...
docker compose up -d zabbix-db zabbix-server zabbix-web
echo.
echo 2. Menghubungkan ke Cloudflare Tunnel...
echo    - Salin link https://xxxx.trycloudflare.com yang muncul di bawah
echo    - Tempel (paste) di Railway ^> Variables ^> ZABBIX_URL
echo    - Jangan tutup jendela ini selama sistem digunakan.
echo ========================================================
echo.
cmd.exe /c npx -y cloudflared tunnel --url http://localhost:8082
pause
