# Impostor Techno (Social Deduction Multiplayer Web Game)
> *"Server Down, Wi-Fi Putus, Siapa yang Nge-drop Database?!"*

Game web multiplayer real-time bergaya deduksi sosial ("Among Us") bertema krisis engineering kantor tech modern. Didesain untuk dimainkan bersama rekan kerja melalui browser di laptop maupun smartphone via jaringan lokal (LAN / Wi-Fi kantor).

---

## 🌟 Fitur Utama

- **Real-Time Multiplayer** dengan **Socket.IO** (Authoritative Server loop pada 20 ticks/sec).
- **Desain Cyber-Office Glassmorphism**:
  - Palet warna Dark Slate (`#0b1120`, `#0f172a`), Neon Cyan (`#06b6d4`), Emerald Green (`#10b981`), Rose Red (`#f43f5e`), dan Warning Amber (`#f59e0b`).
  - Efek blur frosted glass, tipografi modern (*Plus Jakarta Sans* & *JetBrains Mono*).
- **Multi-Platform Responsif**:
  - **PC / Laptop**: Kontrol keyboard `WASD`, `Space` (Use), `R` (Report), `Q` (Revoke), `E` (Vent).
  - **Smartphone**: Dynamic on-screen virtual joystick pada jempol kiri, floating action buttons empuk pada jempol kanan.
- **2 Roles**:
  - **The Engineers / Devs**: Selesaikan 4 mini-game interaktif di sekitar denah kantor:
    1. *Fix Switch & Patch Cord* (Kabel LAN drag-and-drop matching warna).
    2. *Deploy Hotfix ke Production* (Test suite runner & swipe-to-deploy slider).
    3. *Restock Biji Kopi Pantry* (Hold lever espresso machine dengan gauge crema hijau).
    4. *Restart Core Router* (Cold reboot countdown 5 detik).
  - **The Impostor (Bug Maker)**:
    - *Kernel Panic Sabotase* (Pemadaman listrik server dengan hitung mundur 40s & reduced vision).
    - *Silent Terminate / Revoke Access* (Meninggalkan laptop dengan layar BSOD di lantai).
    - *Server Rack Vent* (Berpindah instan antar lorong server rack).
- **Incident War Room (Emergency Meeting)**:
  - Dipicu lewat tombol rapat darurat atau pelaporan laptop BSOD.
  - Live ticket incident chat dengan quick reaction chips.
  - 40 detik voting countdown dan tally eliminasi akun tersangka.
- **Web Audio API Synthesizer**: Efek suara sintetis murni (arpeggio melodi, sirine alarm darurat, kill glitch) tanpa perlu file aset audio eksternal.
- **Fitur Simulasi Bot Rekan Kerja**: Host dapat menambahkan bot coworker untuk pengujian game kapan saja.

---

## 🚀 Quick Start

### 1. Install & Jalankan Server
```bash
npm install
npm start
```
Server akan aktif di `http://127.0.0.1:3000` (atau fallback `3001` jika port 3000 sedang terpakai).

### 2. Integrasi XAMPP Apache di Windows
Lihat panduan lengkap di [PANDUAN_SETUP_XAMPP.md](PANDUAN_SETUP_XAMPP.md) untuk setup VirtualHost Apache dan PM2 background process.

---

## 📁 Struktur Berkas

```
impostor_techno/
├── httpd-vhosts.conf          # Konfigurasi Apache VirtualHost Reverse Proxy (Port 80 -> 3000)
├── package.json               # Dependensi Express, Socket.IO, CORS
├── server.js                  # Authoritative Game Server & State Management
├── PANDUAN_SETUP_XAMPP.md     # Panduan komprehensif setup XAMPP Windows & LAN Wi-Fi
├── README.md                  # Dokumentasi umum proyek
└── public/
    ├── index.html             # Struktur UI, HUD, Mini-games, War Room & Game Over
    ├── style.css              # Cyber-Glassmorphism styling & responsivitas mobile
    └── game.js                # Canvas rendering, 2D characters, input touch & audio synth
```
