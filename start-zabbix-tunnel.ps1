# ============================================================
# 🚀 START-ZABBIX-TUNNEL.PS1
# Script Sederhana & Stabil: Zabbix Lokal + Cloudflare Tunnel
# ============================================================

Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  🚀 GIS-AFFNET | Zabbix Tunnel Manager" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Menyalakan Container Zabbix
Write-Host "[1/2] Memastikan Container Zabbix Berjalan..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker compose up -d zabbix-db zabbix-server zabbix-web

Write-Host ""
Write-Host "[2/2] Menjalankan Cloudflare Tunnel..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  📋 PETUNJUK:" -ForegroundColor White
Write-Host "  1. Tunggu hingga muncul link https://xxxx.trycloudflare.com" -ForegroundColor Green
Write-Host "  2. Salin (copy) link https tersebut" -ForegroundColor Green
Write-Host "  3. Buka https://railway.app -> Project GIS-AFFNET -> Backend" -ForegroundColor Green
Write-Host "  4. Tempel (paste) di Variables -> ZABBIX_URL -> Save" -ForegroundColor Green
Write-Host "  ⚠️  PENTING: Jendela ini harus tetap TERBUKA!" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

cmd.exe /c npx -y cloudflared tunnel --url http://localhost:8082
