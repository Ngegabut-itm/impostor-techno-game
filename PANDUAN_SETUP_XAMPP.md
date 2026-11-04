# 🚀 PANDUAN LENGKAP DEPLOYMENT & SETUP WINDOWS + XAMPP + PM2
## Game Web Multiplayer Real-Time: "Impostor Techno"
*Tagline: "Server Down, Wi-Fi Putus, Siapa yang Nge-drop Database?!"*

---

## 🏗️ 1. Arsitektur Infrastruktur

```
  [📱 Smartphone Rekan Kantor]       [💻 Laptop Rekan Kantor]
           \                                 /
            \--- (Wi-Fi / LAN Kantor) ------/
                          |
                          v
         [ Alamat IP Host: http://192.168.1.18/ ]
                          |
               +----------------------+
               |   Apache 2.4 (XAMPP) |  (Port 80)
               +----------------------+
                 |                  |
   (File Statis HTML/CSS/JS)   (WebSocket /socket.io/)
                 |                  |
                 v                  v  (Reverse Proxy mod_proxy_wstunnel)
         [ public/ folder ]    [ Node.js + Socket.IO Server ] (Port 3000 / 3001)
                                      |
                               (Dikelola via PM2)
```

- **Frontend**: Single Page Application Cyber-Glassmorphism responsif (HTML5 Canvas, CSS3 Glassmorphism, Web Audio API).
- **Web Server / Reverse Proxy**: Apache HTTP Server (XAMPP) pada Port 80.
- **Real-Time Backend**: Node.js + Socket.io authoritative game loop pada Port 3000 (dengan auto-fallback ke 3001 jika port 3000 sedang digunakan).
- **Process Manager**: PM2 untuk menjaga server tetap hidup 24/7 di latar belakang Windows.

---

## ⚙️ 2. Langkah Demi Langkah Setup di Windows

### Langkah 1: Instalasi Dependensi Node.js
Buka Terminal / PowerShell di folder proyek (`C:\GAME\impostor_techno`):
```powershell
cd C:\GAME\impostor_techno
npm install
```
*Dependensi yang terpasang:* `express`, `socket.io`, `cors`.

---

### Langkah 2: Konfigurasi Apache di XAMPP Windows

#### A. Aktifkan Modul Proxy & WebSocket di `httpd.conf`
1. Buka file konfigurasi Apache:
   `C:\xampp\apache\conf\httpd.conf` (atau klik tombol **Config -> Apache (httpd.conf)** di XAMPP Control Panel).
2. Cari baris-baris berikut dan pastikan tanda pagar (`#`) di depannya telah **dihapus (uncomment)**:
   ```apache
   LoadModule proxy_module modules/mod_proxy.so
   LoadModule proxy_http_module modules/mod_proxy_http.so
   LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
   LoadModule rewrite_module modules/mod_rewrite.so
   ```
3. Pastikan baris include virtual host aktif:
   ```apache
   Include conf/extra/httpd-vhosts.conf
   ```
4. Simpan file `httpd.conf`.

#### B. Daftarkan VirtualHost di `httpd-vhosts.conf`
Buka file `C:\xampp\apache\conf\extra\httpd-vhosts.conf`, lalu tambahkan blok konfigurasi berikut di bagian paling bawah:

```apache
# ==============================================================================
# VIRTUALHOST: IMPOSTOR TECHNO
# ==============================================================================
<VirtualHost *:80>
    ServerName localhost
    ServerAlias 127.0.0.1 192.168.* game.kantor.local

    DocumentRoot "C:/GAME/impostor_techno/public"

    <Directory "C:/GAME/impostor_techno/public">
        Options Indexes FollowSymLinks MultiViews
        AllowOverride All
        Require all granted
    </Directory>

    # 1. Forward WebSocket Socket.IO handshake ke Node.js
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/socket.io/(.*) ws://127.0.0.1:3000/socket.io/$1 [P,L]

    # 2. HTTP Polling Fallback Socket.io
    ProxyPass /socket.io/ http://127.0.0.1:3000/socket.io/
    ProxyPassReverse /socket.io/ http://127.0.0.1:3000/socket.io/

    # 3. API Status endpoint
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/

    ErrorLog "logs/impostor_techno_error.log"
    CustomLog "logs/impostor_techno_access.log" combined
</VirtualHost>
```

> **Catatan Port Node.js:** Jika port 3000 di komputer Anda sedang dipakai oleh service lain, Node.js game ini akan otomatis memakai port `3001`. Ubah angka `3000` di atas menjadi `3001` jika diperlukan.

#### C. Restart Apache
Buka **XAMPP Control Panel**, klik **Stop** pada modul Apache, lalu klik **Start** kembali hingga indikator berwarna hijau.

---

### Langkah 3: Menjalankan Backend Node.js dengan PM2

Jalankan game server secara persisten di background Windows menggunakan **PM2**:

```powershell
cd C:\GAME\impostor_techno

# Jalankan server dengan PM2
pm2 start server.js --name "impostor-techno"

# Cek status proses
pm2 list

# Melihat live logs transaksi game
pm2 logs impostor-techno
```

Perintah tambahan PM2 yang berguna:
- Restart server: `pm2 restart impostor-techno`
- Stop server: `pm2 stop impostor-techno`
- Simpan konfigurasi autostart: `pm2 save`

*(Opsi tanpa PM2 untuk pengujian cepat):*
Cukup jalankan: `npm start` atau `node server.js`.

---

### Langkah 4: Buka Windows Defender Firewall (Akses Wi-Fi LAN)

Agar smartphone atau laptop rekan kantor di jaringan Wi-Fi kantor dapat mengakses game:

1. Buka PowerShell sebagai Administrator, lalu jalankan perintah berikut untuk mengizinkan Port 80 dan Port 3000/3001:
   ```powershell
   New-NetFirewallRule -DisplayName "Impostor Techno Game (HTTP 80)" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "Impostor Techno Game (Node.js 3000-3001)" -Direction Inbound -LocalPort 3000-3001 -Protocol TCP -Action Allow
   ```
2. Cek alamat IP LAN komputer host Anda:
   ```powershell
   ipconfig
   ```
   *Contoh IP LAN kantor Anda saat ini: `192.168.1.18`.*

---

## 🎮 3. Panduan Bermain & Fitur Game

### Akses Game:
- **Dari Laptop Host**: Buka browser ke `http://localhost/` atau `http://localhost:3000/`.
- **Dari HP / Laptop Rekan Kantor**: Buka browser ke `http://192.168.1.18/`.

---

### Alur Permainan (Core Gameplay Loop):

#### 1. Ruang Tunggu (Lobby & War Room)
- Masukkan nama developer (misal: "Budi Backend").
- Pilih warna badge avatar (Cyan, Emerald, Amber, Rose, Violet, Sky, Lime).
- Klik **"BUAT WAR ROOM BARU"** untuk membuat room dengan kode 5 karakter (misal: `TECH9`).
- Rekan kantor cukup memilih tab **"GABUNG ROOM"** dan memasukkan kode tersebut dari HP mereka.
- **Fitur Simulasi / Solo Test**: Host dapat menekan tombol **"🤖 + Tambah Bot Rekan"** untuk menambahkan bot simulasi (Sdr. Budi, Andi Sysadmin, Siti DevOps) untuk langsung menguji mekanik task, kill, dan voting tanpa menunggu banyak pemain!
- Host menekan tombol **"🚀 MULAI SPRINT (START GAME)"**.

#### 2. Peran: The Engineers / Devs (Crewmates)
- **Tujuan**: Menyelesaikan semua task di sprint checklist sebelum sistem kantor crash atau semua dev dieliminasi.
- **4 Mini-Game Interaktif**:
  1. **Fix Switch & Patch Cord** *(Server Room)*: Tarik konektor 4 kabel LAN berwarna (Cyan 10GbE, Magenta VLAN, Amber iSCSI, Emerald Core) ke port RJ45 switch yang sesuai warnanya.
  2. **Deploy Hotfix ke Production** *(Dev Open Space)*: Jalankan unit test CI/CD (AuthSuite, DbPool, RedisCache) hingga 100% PASS, lalu geser horizontal slider untuk deploy ke cluster Kubernetes.
  3. **Restock Biji Kopi Pantry** *(Tech Pantry)*: Tekan dan tahan tombol tuas espresso sampai cairan kopi di mug mencapai zona hijau "OPTIMAL CREMA" (80-95%).
  4. **Restart Core Router** *(Server Room)*: Tekan inisiasi reboot, tunggu proses flushing routing table BGP/ARP selama 5 detik penuh tanpa menutup jendela modal.

#### 3. Peran: The Impostor (Penyusup / Bug Maker)
- **Aksi Sabotase: Kernel Panic**:
  - Tekan tombol **SABOTASE** untuk memicu *Kernel Panic & Gateway Failure*.
  - Lampu kantor berubah merah sirine darurat, jarak pandang para Dev berkurang drastis (hanya lampu senter kecil).
  - Waktu hitung mundur 40 detik: Seluruh tim harus bergegas ke konsol Server Room untuk mereboot sistem. Jika waktu habis, **Impostor menang seketika!**
- **Silent Terminate / Revoke Access**:
  - Tombol **REVOKE** menyala saat berada dekat dengan rekan kerja (cooldown 25s).
  - Rekan yang dieliminasi akan meninggalkan **Laptop BSOD** (`:( Blue Screen of Death`) di lantai dan berubah menjadi Ghost (masih bisa bergerak menembus dinding dan menyelesaikan task).
- **Server Rack Vent**:
  - Berpindah instan antara 3 titik ventilasi: Rack Alpha (Server Room), Duct Beta (Dev Space), dan Shaft Gamma (Pantry).

#### 4. Incident War Room (Emergency Meeting)
- Dipicu dengan menekan **Tombol Darurat Besar** di meja rapat War Room atau menekan tombol **REPORT** saat menemukan Laptop BSOD.
- Semua pemain ditransportasikan ke Incident War Room.
- **Live Ticket Incident Chat**: Mengirim pesan tiket insiden atau menekan tombol reaksi cepat (*"Siapa di Server?", "Gue lagi task", "Sus banget!"*).
- **Voting 40 Detik**: Klik avatar rekan kerja untuk memberikan suara, atau pilih **"SKIP VOTE"**.
- Hasil pemungutan suara ditampilkan: Akun yang di-revoke diumumkan apakah dia Impostor atau bukan!

---

## 📱 4. Kontrol Multi-Platform

| Aksi | Kontrol Laptop / Desktop | Kontrol Smartphone (Layar Sentuh) |
|---|---|---|
| **Gerakan (Move)** | Tombol `W, A, S, D` atau Panah | Virtual Joystick transparan di jempol kiri |
| **Use / Kerjakan Task** | Tombol `Spacebar` | Tombol bundar empuk `USE` di jempol kanan |
| **Report Laptop BSOD** | Tombol `R` | Tombol `REPORT` (berkedip merah saat dekat BSOD) |
| **Revoke Access (Kill)** | Tombol `Q` | Tombol `REVOKE` (khusus Impostor) |
| **Masuk / Pindah Vent** | Tombol `E` atau `V` | Tombol `VENT` (khusus Impostor) |
| **Pemicu Sabotase** | Klik tombol HUD Sabotase | Tombol `SABOTASE` (khusus Impostor) |

---

## 🛠️ 5. Troubleshooting Cepat

1. **Koneksi WebSocket gagal connect di browser HP:**
   - Pastikan modul `mod_proxy_wstunnel.so` di Apache sudah di-uncomment.
   - Pastikan Windows Defender Firewall mengizinkan port 80 dan port backend (3000/3001).
   - Pastikan HP terhubung ke SSID Wi-Fi kantor yang sama dengan laptop host (bukan data seluler).
2. **Port 3000 EADDRINUSE:**
   - Server Node.js sudah dilengkapi proteksi fallback otomatis ke port `3001`. Cek log terminal untuk melihat port yang aktif.
3. **Suara efek tidak berbunyi:**
   - Browser modern memerlukan 1 kali interaksi/klik sebelum memutar audio sintetis (Web Audio API). Cukup klik atau sentuh layar sekali untuk mengaktifkan audio.
