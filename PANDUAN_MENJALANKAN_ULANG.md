# 📘 Panduan Menjalankan Ulang Sistem GIS-AFFNET

Dokumen ini berisi panduan lengkap langkah demi langkah untuk menjalankan kembali sistem **GIS-AFFNET** ketika laptop Anda baru dinyalakan atau setelah di-restart.

---

## 🏗️ Gambaran Arsitektur Sistem

| Komponen | Lokasi | Keterangan |
| :--- | :--- | :--- |
| **Frontend (React)** | Vercel Cloud | Aktif 24/7 otomatis (`https://gis-aff.vercel.app`) |
| **Backend (Go API)** | Railway Cloud | Aktif 24/7 otomatis |
| **Database** | Supabase Cloud | Aktif 24/7 otomatis |
| **Router MikroTik** | Jaringan Lapangan | Terhubung via DDNS (`fahrizal.ddns.net:2428`) |
| **OLT HIOSO** | Jaringan Lapangan | Terhubung via DDNS (`fahrizal.ddns.net:9595`) |
| **Zabbix Server & Web** | **Docker Laptop** | Perlu dipastikan aktif saat laptop menyala |
| **Cloudflare Tunnel** | **Laptop** | Jembatan agar Railway bisa mengakses Zabbix laptop |

---

## 🚀 Langkah Menjalankan Ulang (Saat Laptop Baru Menyala)

Hanya ada **2 langkah cepat** yang perlu dilakukan di laptop:

### Langkah 1: Pastikan Docker Zabbix Berjalan

1. Buka aplikasi **Docker Desktop** di Windows.
2. Buka **Command Prompt (CMD)** atau **PowerShell**, lalu arahkan ke folder projek dan jalankan:
   ```powershell
   cd d:\projek\GIS-AFFNET
   docker compose up -d zabbix-db zabbix-server zabbix-web
   ```
3. Cek apakah Zabbix sudah berjalan dengan membuka browser:
   - Buka: **`http://localhost:8082`**
   - Username: `Admin`
   - Password: `zabbix`

---

### Langkah 2: Jalankan Cloudflare Tunnel

Buka **Command Prompt (CMD)** atau **PowerShell**, lalu jalankan:

```cmd
cmd.exe /c npx -y cloudflared tunnel --url http://localhost:8082
```

Tunggu beberapa detik sampai muncul output baris seperti ini:
```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://nama-tunnel-acak.trycloudflare.com                                                |
+--------------------------------------------------------------------------------------------+
```

> ⚠️ **PENTING**:
> Biarkan jendela Command Prompt / PowerShell ini **tetap terbuka** selama Anda menggunakan sistem. Jika jendela ditutup, koneksi tunnel ke Zabbix akan terputus.

---

### Langkah 3: Update `ZABBIX_URL` di Railway (Hanya jika URL Tunnel Berubah)

Jika menggunakan free tunnel *trycloudflare*, setiap kali tunnel dijalankan ulang biasanya akan mendapatkan URL baru.

1. Salin URL HTTPS yang baru dihasilkan (contoh: `https://xxxx.trycloudflare.com`).
2. Tambahkan `/api_jsonrpc.php` di ujungnya.
   - Contoh hasil akhir: `https://xxxx.trycloudflare.com/api_jsonrpc.php`
3. Buka dashboard **[Railway.app](https://railway.app)**.
4. Pilih project **GIS-AFFNET** → klik service **Backend (Go)** → tab **Variables**.
5. Edit variabel **`ZABBIX_URL`** dengan URL baru tersebut.
   *(Pastikan tidak ada spasi atau tombol Enter di akhir teks).*
6. Simpan (Save). Railway akan otomatis me-redeploy dalam 1 menit.

---

## ⚡ Cara Super Cepat (Menggunakan File Shortcut)

Anda bisa menjalankan file otomatis yang sudah disediakan di folder projek dengan **salah satu dari 2 cara**:

1. **Cara 1 (Double-Click):**
   Klik dua kali (double-click) file **`start-tunnel.bat`** di File Explorer.

2. **Cara 2 (Via Terminal / PowerShell):**
   Buka Terminal di folder projek, lalu ketik:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-zabbix-tunnel.ps1
   ```

---
*Script ini akan otomatis:*
- ✅ Mengecek apakah **Docker Desktop** sudah aktif.
- ✅ Memastikan container Zabbix (`zabbix-db`, `zabbix-server`, `zabbix-web`) berjalan.
- ✅ Membuka **Cloudflare Tunnel** publik ke internet.
- ✅ **Menyalin URL Zabbix API baru langsung ke Clipboard (Ctrl+V)** agar bisa langsung Anda paste di **Railway (`ZABBIX_URL`)**.

## 📋 Ringkasan Kredensial & Variabel di Railway

Berikut daftar lengkap variabel environment yang harus ada di **Railway Backend**:

| Nama Variabel | Nilai Contoh | Keterangan |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres:...@...supabase.co:5432/postgres` | Koneksi database Supabase |
| `JWT_SECRET` | `affnet-super-secret-jwt-key-2026` | Token otentikasi login admin |
| `MIKROTIK_IP` | `fahrizal.ddns.net:2428` | IP & Port API MikroTik |
| `MIKROTIK_USER` | `admin` | User MikroTik |
| `MIKROTIK_PASS` | `kulo05` | Password MikroTik |
| `HIOSO_OLT_HOST` | `fahrizal.ddns.net:9595` | IP & Port Web OLT |
| `HIOSO_OLT_USER` | `admin` | User OLT HIOSO |
| `HIOSO_OLT_PASS` | `kulo05` | Password OLT HIOSO |
| `ZABBIX_URL` | `https://xxxx.trycloudflare.com/api_jsonrpc.php  TAMBAH /api_jsonrpc.php` | URL Tunnel Zabbix Laptop |
| `ZABBIX_USER` | `Admin` | Username Zabbix |
| `ZABBIX_PASSWORD`| `zabbix` | Password Zabbix |

---

## 🔍 Checklist Verifikasi Jika Terjadi Kendala

1. **Zabbix Status Merah di Dashboard?**
   - Periksa apakah jendela Cloudflare Tunnel masih berjalan.
   - Periksa apakah URL di `ZABBIX_URL` Railway sama dengan URL yang ada di jendela tunnel.
   - Buka `http://localhost:8082` di browser laptop untuk memastikan Docker Zabbix aktif.
2. **MikroTik Offline?**
   - Pastikan koneksi internet di lokasi router MikroTik normal dan DDNS `fahrizal.ddns.net` mengarah ke IP publik terkini.
   - Cek apakah port `2428` di router masih terbuka (forwarded).
3. **OLT Tidak Merespons?**
   - Pastikan port `9595` di router masih di-forward ke IP lokal OLT.
   - Buka `http://fahrizal.ddns.net:9595` di browser untuk memastikan web management OLT bisa diakses.
