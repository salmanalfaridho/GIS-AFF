@echo off
title Cloudflare Tunnel - Zabbix GIS-AFFNET
echo ========================================================
echo   MENJALANKAN TUNNEL ZABBIX LAPTOP KE CLOUD (RAILWAY)
echo ========================================================
echo.
echo Pastikan Docker Desktop dan container Zabbix sudah UP!
echo Zabbix lokal: http://localhost:8082
echo.
echo Menghubungkan ke Cloudflare Tunnel...
echo Jangan tutup jendela ini selama sistem digunakan.
echo ========================================================
echo.

npx -y cloudflared tunnel --url http://localhost:8082

pause
