# 🛠️ Panduan Menjalankan Sistem Secara Manual (Full Local & Hybrid)

Panduan ini berisi cara menjalankan sistem **GIS-AFFNET** secara **manual langkah demi langkah** menggunakan terminal (Command Prompt / PowerShell), baik untuk **Mode Full Lokal (Development di Laptop)** maupun **Mode Hybrid (Lokal + Cloud)**.

---

## 📌 DAFTAR ISI
1. [Mode 1: Menjalankan Full Lokal di Laptop (Frontend + Backend + DB + Zabbix)](#mode-1-menjalankan-full-lokal-di-laptop)
2. [Mode 2: Menjalankan Manual Hybrid (Zabbix Laptop + Railway Cloud)](#mode-2-menjalankan-manual-hybrid-zabbix-laptop--railway-cloud)
3. [Perintah Berguna untuk Troubleshooting Manual](#perintah-berguna-untuk-troubleshooting-manual)

---

## Mode 1: Menjalankan Full Lokal di Laptop

Gunakan mode ini jika Anda ingin menguji atau mengembangkan aplikasi langsung di laptop Anda tanpa bergantung pada Railway atau Vercel.

### 📋 Prasyarat:
* **Docker Desktop** aktif.
* **Go** (Golang v1.20+) terinstall.
* **Node.js** (v18+) terinstall.

---

### Langkah 1: Jalankan Database & Zabbix di Docker
Buka **Terminal 1** (PowerShell / CMD), lalu jalankan:

```powershell
cd d:\projek\GIS-AFFNET

# 1. Jalankan container database PostgreSQL & Zabbix
docker compose up -d affnet_db zabbix-db zabbix-server zabbix-web
```

Untuk memeriksa apakah semua container sudah berjalan normal:
```powershell
docker compose ps
```
*(Pastikan status `affnet_db`, `zabbix_db`, `zabbix_server`, dan `zabbix_web` adalah **Up**).*

---

### Langkah 2: Konfigurasi File `.env` Backend
Pastikan file `d:\projek\GIS-AFFNET\backend\.env` sudah sesuai:

```env
# Koneksi Database Lokal (Docker affnet_db)
DATABASE_URL=postgresql://affnet_user:affnet_password@localhost:5432/affnet_db

# Zabbix Web Lokal
ZABBIX_URL=http://localhost:8082/api_jsonrpc.php
ZABBIX_USER=Admin
ZABBIX_PASSWORD=zabbix

# Token JWT
JWT_SECRET=affnet-super-secret-jwt-key-2026

# MikroTik Remote (DDNS)
MIKROTIK_IP=fahrizal.ddns.net:2428
MIKROTIK_USER=admin
MIKROTIK_PASS=kulo05

# OLT HIOSO Remote (DDNS)
HIOSO_OLT_HOST=fahrizal.ddns.net:9595
HIOSO_OLT_USER=admin
HIOSO_OLT_PASS=kulo05
```

---

### Langkah 3: Jalankan Backend (Go API)
Buka **Terminal 2** (PowerShell / CMD):

```powershell
cd d:\projek\GIS-AFFNET\backend

# Download dependency (jika baru pertama kali)
go mod tidy

# Jalankan server Backend
go run main.go
```
Backend akan aktif dan mendengarkan di: **`http://localhost:8080`** (atau `http://localhost:8081`).

---

### Langkah 4: Jalankan Frontend (React Vite)
Buka **Terminal 3** (PowerShell / CMD):

```powershell
cd d:\projek\GIS-AFFNET\frontend

# Install node_modules (jika belum ada)
npm install

# Jalankan dev server frontend
npm run dev
```
Frontend akan aktif dan menampilkan link: **`http://localhost:5173`** (atau port lain yang tertera di terminal).

---

### Langkah 5: Akses Aplikasi di Browser
Buka browser dan akses:
* **Web GIS-AFFNET Lokal**: `http://localhost:5173`
* **Zabbix Web UI**: `http://localhost:8082` (User: `Admin` | Pass: `zabbix`)

---
---

## Mode 2: Menjalankan Manual Hybrid (Zabbix Laptop + Railway Cloud)

Gunakan mode ini jika Anda menggunakan **Vercel** (`gis-aff.vercel.app`) dan **Railway Backend** di cloud, namun Zabbix tetap berjalan di laptop Anda.

### Langkah 1: Jalankan Container Zabbix
Buka **PowerShell / CMD**:
```powershell
cd d:\projek\GIS-AFFNET
docker compose up -d zabbix-db zabbix-server zabbix-web
```

---

### Langkah 2: Jalankan Cloudflare Tunnel Secara Manual
Jalankan perintah ini di PowerShell / CMD:

```powershell
cmd.exe /c npx -y cloudflared tunnel --url http://localhost:8082
```

Perhatikan baris output yang muncul:
```text
https://xxxx-xxxx-xxxx.trycloudflare.com
```
*Salin (copy) link https tersebut.*
*(⚠️ Jangan tutup jendela terminal ini selama sistem digunakan).*

---

### Langkah 3: Perbarui URL di Dashboard Railway
1. Buka browser: **[https://railway.app](https://railway.app)**.
2. Klik project **GIS-AFFNET** → pilih service **Backend (Go)**.
3. Masuk ke tab **Variables**.
4. Klik pada variabel **`ZABBIX_URL`**, lalu ubah isinya menjadi:
   ```text
   https://xxxx-xxxx-xxxx.trycloudflare.com/api_jsonrpc.php
   ```
   *(Penting: Wajib diakhiri dengan `/api_jsonrpc.php` dan pastikan tidak ada spasi di ujungnya).*
5. Klik **Save**.
6. Railway akan me-restart backend secara otomatis (~30-60 detik).

---

### Langkah 4: Akses Aplikasi Cloud
Buka browser:
* **Dashboard GIS-AFFNET**: `https://gis-aff.vercel.app/dashboard`
* **Menu MikroTik**: `https://gis-aff.vercel.app/mikrotik`
* **Menu Manajemen ONU**: `https://gis-aff.vercel.app/onu`
* **Menu Peta Topologi**: `https://gis-aff.vercel.app/map`

---

## 🔧 Perintah Berguna untuk Troubleshooting Manual

| Keperluan | Perintah Manual |
| :--- | :--- |
| **Melihat status semua container Docker** | `docker ps` atau `docker compose ps` |
| **Melihat log container Zabbix Server** | `docker logs zabbix_server -f` |
| **Melihat log container Zabbix Web** | `docker logs zabbix_web -f` |
| **Menghentikan semua container** | `docker compose down` |
| **Restart container Zabbix saja** | `docker restart zabbix_db zabbix_server zabbix_web` |
| **Tes apakah Zabbix web lokal merespons** | `curl -I http://localhost:8082` |
| **Tes port MikroTik dari laptop** | `Test-NetConnection fahrizal.ddns.net -Port 2428` |
| **Tes port OLT HIOSO dari laptop** | `Test-NetConnection fahrizal.ddns.net -Port 9595` |
