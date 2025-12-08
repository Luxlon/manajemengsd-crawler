# 🚀 Oracle Cloud Always Free Deployment Guide

## Panduan Lengkap Deploy Crawler AppSheet di Oracle Cloud (100% GRATIS SELAMANYA)

**Waktu Setup:** ~2 jam (pertama kali)  
**Biaya:** $0 selamanya (tidak ada expiry)  
**Spesifikasi:** 1-4 vCPU ARM, 6-24GB RAM, 50GB Boot Volume

---

## 📋 Prerequisites

1. **Email aktif** (untuk registrasi Oracle Cloud)
2. **Nomor HP** (untuk verifikasi SMS)
3. **Kartu kredit/debit** (hanya untuk verifikasi identitas, **tidak akan dicharge**)
4. **Koneksi internet stabil** (untuk setup awal)

⚠️ **PENTING:** Oracle tidak akan mencharge kartu Anda kecuali Anda SECARA MANUAL upgrade ke paid account. Always Free tier benar-benar GRATIS selamanya.

---

## 🎯 FASE 1: Registrasi Oracle Cloud Account (15 menit)

### Step 1.1: Buat Akun Oracle Cloud

1. Buka browser dan kunjungi: https://www.oracle.com/cloud/free/

2. Klik tombol **"Start for free"** atau **"Try Oracle Cloud Free Tier"**

3. Isi form registrasi:
   ```
   Country/Territory: Indonesia
   First Name: [Nama depan Anda]
   Last Name: [Nama belakang Anda]
   Email: [Email aktif Anda]
   ```

4. Klik **"Verify my email"**

5. Buka email dari Oracle, klik link verifikasi

### Step 1.2: Lengkapi Data Account

1. Setelah verifikasi email, isi data berikut:
   ```
   Password: [Buat password kuat]
   Company Name: [Boleh nama pribadi atau perusahaan]
   Cloud Account Name: [Nama unik, contoh: manajemengsd]
   Home Region: [PILIH: South Korea (Seoul) atau Japan (Tokyo)]
   ```

   ⚠️ **PENTING:** Home Region **TIDAK BISA DIUBAH** setelah dibuat!
   - Pilih **South Korea (Seoul)** untuk latensi terbaik ke Indonesia
   - Alternatif: **Japan (Tokyo)** atau **Singapore** (kalau available)

2. Klik **"Continue"**

### Step 1.3: Verifikasi Identitas

1. Masukkan alamat lengkap Anda:
   ```
   Address Line 1: [Alamat jalan]
   City: [Kota]
   State/Province: [Provinsi]
   Postal Code: [Kode pos]
   Country: Indonesia
   ```

2. Masukkan nomor HP untuk verifikasi:
   ```
   Phone Number: +62 [nomor HP Anda tanpa 0 di depan]
   ```

3. Klik **"Text me a code"**

4. Masukkan kode 6 digit yang dikirim via SMS

### Step 1.4: Verifikasi Payment (TIDAK AKAN DICHARGE)

1. Pilih **"Credit Card"** atau **"Debit Card"**

2. Isi data kartu:
   ```
   Card Number: [16 digit nomor kartu]
   Expiration Date: [MM/YY]
   CVV: [3 digit di belakang kartu]
   Cardholder Name: [Nama di kartu]
   ```

3. Klik **"Finish"**

4. Oracle akan melakukan **pre-authorization $1** (akan dikembalikan dalam 2-5 hari)

5. Tunggu **5-10 menit** untuk account provisioning

6. Setelah selesai, Anda akan masuk ke **Oracle Cloud Console**

✅ **Registrasi selesai!** Anda sekarang punya akun Always Free tier.

---

## 🖥️ FASE 2: Buat Virtual Machine (VM) Instance (20 menit)

### Step 2.1: Masuk ke Compute Instances

1. Di Oracle Cloud Console, klik menu hamburger (☰) di kiri atas

2. Pilih: **Compute** → **Instances**

3. Klik tombol **"Create Instance"**

### Step 2.2: Konfigurasi Instance (PILIH YANG ALWAYS FREE!)

**Basic Configuration:**

```
Name: manajemen-gsd-crawler
Create in compartment: (root) [biarkan default]
Placement: [Biarkan default - Availability Domain 1]
```

**Image and Shape:**

1. Klik **"Edit"** di bagian **Image and Shape**

2. **Image:**
   - Klik **"Change Image"**
   - Pilih: **"Canonical Ubuntu 22.04"** (recommended)
   - Klik **"Select Image"**

3. **Shape:**
   - Klik **"Change Shape"**
   - Pilih **"Ampere"** (ARM processor)
   - Pilih **"VM.Standard.A1.Flex"** ✅ **(Always Free Eligible)**
   
   ⚠️ **PENTING - Spesifikasi Always Free:**
   ```
   Number of OCPUs: 4 (maksimal Always Free)
   Amount of Memory (GB): 24 (maksimal Always Free)
   ```
   
   **TIPS:** Jika Anda dapat error "Out of capacity", coba:
   - Kurangi OCPU menjadi 2 dan RAM menjadi 12GB
   - Atau coba region lain (Japan/Singapore)
   - Atau coba lagi beberapa jam kemudian
   
4. Klik **"Select Shape"**

**Networking:**

```
Virtual Cloud Network: [Biarkan auto-create VCN]
Subnet: [Biarkan auto-create subnet]
Public IPv4 address: ✅ Assign a public IPv4 address (HARUS dicentang!)
```

**Add SSH Keys:**

1. Pilih **"Generate a key pair for me"**

2. Klik **"Save Private Key"** → Save file sebagai `oracle-ssh-key.key`

3. Klik **"Save Public Key"** → Save file sebagai `oracle-ssh-key.key.pub`

4. **SIMPAN FILE INI BAIK-BAIK!** Anda butuh ini untuk SSH ke server

⚠️ **PENTING:** Tanpa private key ini, Anda TIDAK BISA login ke server!

**Boot Volume:**

```
Boot volume size (GB): 50 (Always Free dapat 200GB total, kita pakai 50GB)
Use in-transit encryption: ✅ (dicentang)
```

### Step 2.3: Launch Instance

1. Scroll ke bawah, klik **"Create"**

2. Tunggu status berubah dari **"PROVISIONING"** (orange) menjadi **"RUNNING"** (hijau)

3. Proses ini memakan waktu **3-5 menit**

4. Setelah **RUNNING**, catat **Public IP Address** Anda:
   ```
   Public IP: xxx.xxx.xxx.xxx (contoh: 132.145.89.123)
   ```

✅ **VM berhasil dibuat!** Sekarang kita setup networking.

---

## 🌐 FASE 3: Setup Network Security (Firewall) (10 menit)

### Step 3.1: Buka Port di Oracle Cloud

1. Di halaman **Instance Details**, scroll ke bagian **Primary VNIC**

2. Klik nama VCN (Virtual Cloud Network), contoh: "vcn-20241208-xxxx"

3. Di sidebar kiri, klik **"Security Lists"**

4. Klik **"Default Security List for vcn-xxx"**

5. Klik **"Add Ingress Rules"**

**Rule 1: HTTP (port 80)**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 80
Description: HTTP traffic
```
Klik **"Add Ingress Rules"**

6. Klik **"Add Ingress Rules"** lagi

**Rule 2: HTTPS (port 443)**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 443
Description: HTTPS traffic
```
Klik **"Add Ingress Rules"**

7. Klik **"Add Ingress Rules"** lagi

**Rule 3: Crawler API (port 4000)**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 4000
Description: Crawler API
```
Klik **"Add Ingress Rules"**

✅ **Firewall Oracle Cloud sudah dikonfigurasi!**

---

## 🔐 FASE 4: SSH ke Server dan Setup Ubuntu Firewall (15 menit)

### Step 4.1: SSH ke Server

**Untuk Windows (menggunakan PowerShell):**

1. Buka **PowerShell** (klik kanan Start → Windows PowerShell)

2. Pindahkan SSH private key ke folder yang mudah diakses:
   ```powershell
   Move-Item "$env:USERPROFILE\Downloads\oracle-ssh-key.key" "$env:USERPROFILE\.ssh\"
   ```

3. Set permission private key (agar SSH tidak complain):
   ```powershell
   icacls "$env:USERPROFILE\.ssh\oracle-ssh-key.key" /inheritance:r
   icacls "$env:USERPROFILE\.ssh\oracle-ssh-key.key" /grant:r "$env:USERNAME:(R)"
   ```

4. SSH ke server (ganti `xxx.xxx.xxx.xxx` dengan Public IP Anda):
   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\oracle-ssh-key.key" ubuntu@xxx.xxx.xxx.xxx
   ```

5. Ketik **"yes"** saat ditanya "Are you sure you want to continue connecting?"

✅ **Anda sekarang sudah masuk ke Ubuntu server!**

### Step 4.2: Setup Ubuntu Firewall (iptables)

Oracle menggunakan firewall di level OS juga. Kita perlu buka port di Ubuntu:

```bash
# Buka port 80 (HTTP)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT

# Buka port 443 (HTTPS)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Buka port 4000 (Crawler API)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 4000 -j ACCEPT

# Save iptables rules agar tidak hilang saat reboot
sudo netfilter-persistent save
```

✅ **Firewall Ubuntu sudah dikonfigurasi!**

---

## 🐳 FASE 5: Install Docker dan Docker Compose (10 menit)

### Step 5.1: Update System

```bash
# Update package list
sudo apt update

# Upgrade installed packages
sudo apt upgrade -y
```

### Step 5.2: Install Docker

```bash
# Install dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update apt package list
sudo apt update

# Install Docker Engine
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group (agar tidak perlu sudo setiap kali)
sudo usermod -aG docker ubuntu

# Logout dan login lagi untuk apply group membership
exit
```

Setelah `exit`, SSH lagi ke server:
```powershell
ssh -i "$env:USERPROFILE\.ssh\oracle-ssh-key.key" ubuntu@xxx.xxx.xxx.xxx
```

Verify Docker installed:
```bash
docker --version
# Output: Docker version 24.x.x, build xxxxx

docker compose version
# Output: Docker Compose version v2.x.x
```

✅ **Docker dan Docker Compose sudah terinstall!**

---

## 📦 FASE 6: Clone Repository dan Setup Environment (10 menit)

### Step 6.1: Install Git (jika belum ada)

```bash
sudo apt install -y git
```

### Step 6.2: Clone Repository

```bash
# Clone repository Anda
cd ~
git clone https://github.com/Luxlon/manajemengsd-crawler.git

# Masuk ke folder Playwright-crawler
cd manajemengsd-crawler/Playwright-crawler
```

### Step 6.3: Buat File Environment Variables

```bash
# Buat file .env
nano .env
```

Copy-paste konfigurasi berikut (ganti dengan credentials Anda):

```env
# Next.js Dashboard API
NEXTJS_API_URL=https://manajemen-gsd.vercel.app/api/status/batch
CRAWLER_API_KEY=your_secure_api_key_here_change_this

# Credentials BANDUNG
CORPU_USERNAME=your_corpu_username
CORPU_PASSWORD=your_corpu_password

# Credentials CORPU
PRIANGANBARAT_USERNAME=your_prianganbarat_username
PRIANGANBARAT_PASSWORD=your_prianganbarat_password

# Credentials PRIANGAN BARAT
PRIANGANTIMUR_USERNAME=your_priangantimur_username
PRIANGANTIMUR_PASSWORD=your_priangantimur_password

# Credentials PRIANGAN TIMUR
KARAWANG_USERNAME=your_karawang_username
KARAWANG_PASSWORD=your_karawang_password
```

**Cara save di nano:**
1. Tekan `Ctrl + X`
2. Tekan `Y` (yes)
3. Tekan `Enter`

✅ **Environment variables sudah dikonfigurasi!**

---

## 🐳 FASE 7: Build dan Run Docker Container (15 menit)

### Step 7.1: Build Docker Image

```bash
# Build image (akan memakan waktu 5-10 menit pertama kali)
docker build -t manajemen-gsd-crawler .
```

Output yang benar:
```
[+] Building 300.5s (15/15) FINISHED
 => [internal] load build definition from Dockerfile
 => => transferring dockerfile: 1.2kB
 ...
 => => naming to docker.io/library/manajemen-gsd-crawler
```

### Step 7.2: Buat Persistent Volume untuk OAuth

```bash
# Buat folder untuk menyimpan browser profile (OAuth cookies)
mkdir -p ~/playwright-data
```

### Step 7.3: Run Container

```bash
# Run container dengan volume mount
docker run -d \
  --name crawler \
  --restart unless-stopped \
  -p 4000:4000 \
  -v ~/playwright-data:/app/playwright-data \
  --env-file .env \
  manajemen-gsd-crawler
```

Penjelasan parameter:
- `-d`: Run di background (detached mode)
- `--name crawler`: Nama container
- `--restart unless-stopped`: Auto-restart jika crash atau reboot server
- `-p 4000:4000`: Map port 4000 (host:container)
- `-v ~/playwright-data:/app/playwright-data`: Mount folder untuk OAuth persistence
- `--env-file .env`: Load environment variables dari file .env

### Step 7.4: Check Container Status

```bash
# Check apakah container running
docker ps
```

Output yang benar:
```
CONTAINER ID   IMAGE                      STATUS         PORTS                    NAMES
abc123def456   manajemen-gsd-crawler      Up 10 seconds  0.0.0.0:4000->4000/tcp   crawler
```

Check logs:
```bash
docker logs crawler
```

Output yang benar:
```
Playwright Crawler Server berjalan di port 4000
Environment: production
```

✅ **Crawler sudah running di Docker!**

---

## 🌐 FASE 8: Setup Nginx Reverse Proxy (Optional tapi Recommended) (15 menit)

Nginx berguna untuk:
- SSL/HTTPS support (Let's Encrypt)
- Better performance (caching, gzip)
- Load balancing (jika nanti scale)

### Step 8.1: Install Nginx

```bash
sudo apt install -y nginx
```

### Step 8.2: Konfigurasi Nginx

```bash
# Buat config file untuk crawler
sudo nano /etc/nginx/sites-available/crawler
```

Copy-paste konfigurasi berikut:

```nginx
server {
    listen 80;
    server_name xxx.xxx.xxx.xxx;  # Ganti dengan Public IP Anda

    # Increase timeouts untuk crawler yang lama
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Support untuk SSE (Server-Sent Events) logs
        proxy_buffering off;
        proxy_cache off;
    }
}
```

Save dengan `Ctrl + X`, `Y`, `Enter`

### Step 8.3: Enable Site dan Restart Nginx

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/crawler /etc/nginx/sites-enabled/

# Test konfigurasi
sudo nginx -t
# Output: nginx: configuration file /etc/nginx/nginx.conf test is successful

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx auto-start on boot
sudo systemctl enable nginx
```

✅ **Nginx reverse proxy sudah aktif!**

---

## 🔐 FASE 9: Setup SSL/HTTPS dengan Let's Encrypt (Optional - 10 menit)

⚠️ **CATATAN:** Anda butuh **domain name** (beli di Namecheap/Cloudflare ~$10/tahun) untuk SSL.

Jika Anda hanya pakai IP public, **skip fase ini** dan akses crawler via HTTP.

### Step 9.1: Point Domain ke Server

1. Beli domain di Namecheap/Cloudflare (contoh: `manajemen-gsd.com`)

2. Tambahkan DNS A Record:
   ```
   Type: A
   Name: @
   Value: xxx.xxx.xxx.xxx (Public IP Oracle)
   TTL: Automatic
   ```

3. Tunggu 5-15 menit untuk DNS propagation

### Step 9.2: Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Step 9.3: Dapatkan SSL Certificate

```bash
# Ganti manajemen-gsd.com dengan domain Anda
sudo certbot --nginx -d manajemen-gsd.com
```

Jawab pertanyaan:
```
Email address: [email Anda]
Terms of Service: A (Agree)
Share email: N (No)
```

Certbot akan otomatis:
1. Dapatkan SSL certificate dari Let's Encrypt
2. Update Nginx config untuk HTTPS
3. Setup auto-renewal (certificate valid 90 hari, auto-renew setiap 60 hari)

✅ **HTTPS sudah aktif!** Akses crawler via `https://manajemen-gsd.com`

---

## 🎯 FASE 10: First-Time OAuth Login (PENTING!) (30 menit)

Ini adalah bagian **PALING KRUSIAL** karena AppSheet butuh OAuth (Google/Yahoo) login pertama kali.

### Metode 1: Manual Login via VNC (RECOMMENDED - Paling Mudah)

#### Step 10.1: Install Desktop Environment

```bash
# Install lightweight desktop (XFCE)
sudo apt install -y xfce4 xfce4-goodies

# Install VNC server
sudo apt install -y tightvncserver

# Install Chrome untuk OAuth
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
```

#### Step 10.2: Setup VNC Server

```bash
# Start VNC server (akan meminta set password)
vncserver :1
```

Set VNC password (akan ditanya):
```
Password: [Buat password 6-8 karakter]
Verify: [Ketik lagi password yang sama]
Would you like to enter a view-only password? n [No]
```

#### Step 10.3: Setup SSH Tunnel (Agar VNC aman)

**Di komputer Windows Anda** (PowerShell baru):

```powershell
# Buat SSH tunnel untuk VNC (port 5901)
ssh -i "$env:USERPROFILE\.ssh\oracle-ssh-key.key" -L 5901:localhost:5901 ubuntu@xxx.xxx.xxx.xxx
```

Biarkan PowerShell ini tetap terbuka!

#### Step 10.4: Connect dengan VNC Viewer

1. Download **TightVNC Viewer** dari: https://www.tightvnc.com/download.php

2. Install TightVNC Viewer

3. Buka **TightVNC Viewer**

4. Connect ke:
   ```
   Remote Host: localhost:5901
   ```

5. Masukkan VNC password yang Anda buat tadi

6. Anda sekarang melihat desktop Ubuntu server!

#### Step 10.5: Login OAuth di Chrome

**Di VNC desktop:**

1. Buka **Terminal** di VNC desktop (Applications → Terminal)

2. Stop container crawler yang running:
   ```bash
   docker stop crawler
   ```

3. Run crawler dalam mode manual (headful) untuk OAuth:
   ```bash
   cd ~/manajemen-gsd-crawler/Playwright-crawler
   
   # Run dengan headful mode (browser tampil)
   docker run --rm -it \
     -v ~/playwright-data:/app/playwright-data \
     -e HEADLESS=false \
     --env-file .env \
     manajemen-gsd-crawler node crawler.js
   ```

4. **Chrome akan terbuka otomatis** di VNC desktop

5. Crawler akan otomatis ke halaman AppSheet login

6. **Pilih OAuth provider** (Google atau Yahoo)

7. **Login dengan akun Google/Yahoo Anda**

8. **Izinkan AppSheet** akses account

9. Tunggu sampai crawler selesai (bisa 5-15 menit untuk semua area)

10. Setelah selesai, browser akan menutup otomatis

11. **PENTING:** Browser profile (dengan OAuth cookies) sudah tersimpan di `~/playwright-data/`

#### Step 10.6: Run Crawler Normal (Headless)

**Di SSH terminal (bukan VNC):**

```bash
# Start crawler container lagi (headless mode)
docker start crawler

# Check logs
docker logs -f crawler
```

#### Step 10.7: Test Crawler API

**Di komputer Windows Anda:**

```powershell
# Test health endpoint
curl http://xxx.xxx.xxx.xxx:4000/health
```

Output yang benar:
```json
{"status":"ok"}
```

✅ **OAuth login berhasil! Crawler sekarang bisa jalan otomatis tanpa OAuth lagi!**

---

### Metode 2: Pre-Authenticated Profile Upload (Advanced)

Jika Anda sudah punya browser profile yang authenticated di komputer local:

1. Di komputer local (Windows), jalankan crawler sekali dengan headful:
   ```bash
   cd C:\Intership\Manajemen-GSD\Playwright-crawler
   node crawler.js
   ```

2. Login OAuth manual di browser yang muncul

3. Setelah selesai, compress folder `playwright-data`:
   ```powershell
   Compress-Archive -Path "playwright-data" -DestinationPath "playwright-data.zip"
   ```

4. Upload ke Oracle server:
   ```powershell
   scp -i "$env:USERPROFILE\.ssh\oracle-ssh-key.key" playwright-data.zip ubuntu@xxx.xxx.xxx.xxx:~
   ```

5. Di Oracle server, extract:
   ```bash
   cd ~
   unzip playwright-data.zip
   rm playwright-data.zip
   ```

6. Run crawler container:
   ```bash
   docker start crawler
   ```

✅ **OAuth profile sudah terupload!**

---

## 🕐 FASE 11: Setup Scheduled Crawling (Cron Jobs) (10 menit)

Kita akan setup cron job untuk jalankan crawler otomatis setiap hari jam 06:00 WIB.

### Step 11.1: Buat Script Wrapper

```bash
# Buat folder untuk scripts
mkdir -p ~/scripts

# Buat script untuk trigger crawler
nano ~/scripts/run-crawler.sh
```

Copy-paste script berikut:

```bash
#!/bin/bash

# Log file
LOG_FILE="/home/ubuntu/crawler-cron.log"

# Timestamp
echo "==================================" >> $LOG_FILE
echo "Crawl started at: $(date)" >> $LOG_FILE

# Trigger crawler via API (ganti xxx.xxx.xxx.xxx dengan Public IP)
RESPONSE=$(curl -s -X POST http://localhost:4000/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "areaName": "BANDUNG",
    "startDate": "01",
    "endDate": "31",
    "month": "current",
    "year": "current"
  }')

echo "Response: $RESPONSE" >> $LOG_FILE
echo "Crawl finished at: $(date)" >> $LOG_FILE
```

Save dengan `Ctrl + X`, `Y`, `Enter`

```bash
# Buat script executable
chmod +x ~/scripts/run-crawler.sh
```

### Step 11.2: Setup Cron Job

```bash
# Edit crontab
crontab -e
```

Pilih editor (pilih `1` untuk nano jika ditanya)

Tambahkan line berikut di paling bawah:

```bash
# Crawl BANDUNG setiap hari jam 06:00 WIB (23:00 UTC, karena WIB = UTC+7)
0 23 * * * /home/ubuntu/scripts/run-crawler.sh

# Crawl CORPU setiap hari jam 06:30 WIB
30 23 * * * /home/ubuntu/scripts/run-crawler.sh

# Crawl PRIANGAN BARAT setiap hari jam 07:00 WIB
0 0 * * * /home/ubuntu/scripts/run-crawler.sh

# Crawl PRIANGAN TIMUR setiap hari jam 07:30 WIB
30 0 * * * /home/ubuntu/scripts/run-crawler.sh
```

⚠️ **CATATAN:** Oracle server menggunakan UTC timezone, jadi:
- 06:00 WIB = 23:00 UTC (hari sebelumnya)
- 07:00 WIB = 00:00 UTC (hari yang sama)

Save dengan `Ctrl + X`, `Y`, `Enter`

### Step 11.3: Verify Cron Job

```bash
# List cron jobs
crontab -l
```

Output yang benar:
```
0 23 * * * /home/ubuntu/scripts/run-crawler.sh
30 23 * * * /home/ubuntu/scripts/run-crawler.sh
0 0 * * * /home/ubuntu/scripts/run-crawler.sh
30 0 * * * /home/ubuntu/scripts/run-crawler.sh
```

Check timezone:
```bash
timedatectl
```

Output:
```
                      Local time: Sun 2024-12-08 23:45:00 UTC
                  Universal time: Sun 2024-12-08 23:45:00 UTC
                        RTC time: Sun 2024-12-08 23:45:00
                       Time zone: Etc/UTC (UTC, +0000)
```

✅ **Cron job sudah aktif! Crawler akan jalan otomatis setiap hari!**

---

## 🎯 FASE 12: Testing Lengkap (15 menit)

### Test 1: Health Check

```bash
curl http://localhost:4000/health
```

Expected output:
```json
{"status":"ok"}
```

### Test 2: Manual Trigger Crawl

```bash
curl -X POST http://localhost:4000/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "areaName": "BANDUNG",
    "startDate": "01",
    "endDate": "05",
    "month": "11",
    "year": "2024"
  }'
```

Expected output:
```json
{"message":"Crawl started","areaName":"BANDUNG","periode":"2024-11"}
```

### Test 3: Check Logs (Real-time)

```bash
docker logs -f crawler
```

Tekan `Ctrl + C` untuk stop watching logs

### Test 4: Check dari Dashboard Next.js

1. Buka dashboard: https://manajemen-gsd.vercel.app

2. Login sebagai SuperAdmin

3. Klik **"Crawl Data"** di sidebar

4. Pilih Area: **BANDUNG**

5. Klik **"Mulai Crawling"**

6. Lihat progress bar dan logs real-time

✅ **Semua test berhasil! Deployment selesai!**

---

## 📊 Monitoring dan Maintenance

### Check Container Status

```bash
# Check running containers
docker ps

# Check container logs
docker logs crawler

# Check last 50 lines
docker logs --tail 50 crawler

# Follow logs (real-time)
docker logs -f crawler
```

### Check Disk Usage

```bash
# Check disk usage
df -h

# Check crawler data folder size
du -sh ~/playwright-data
```

### Check RAM Usage

```bash
# Check memory usage
free -h

# Check top processes
top
```

Press `q` to quit

### Restart Crawler

```bash
# Restart container
docker restart crawler

# Stop container
docker stop crawler

# Start container
docker start crawler

# Rebuild image (jika ada update code)
cd ~/manajemen-gsd-crawler/Playwright-crawler
git pull
docker build -t manajemen-gsd-crawler .
docker stop crawler
docker rm crawler
docker run -d \
  --name crawler \
  --restart unless-stopped \
  -p 4000:4000 \
  -v ~/playwright-data:/app/playwright-data \
  --env-file .env \
  manajemen-gsd-crawler
```

### Check Cron Job Logs

```bash
# Check cron execution logs
cat ~/crawler-cron.log

# Follow cron logs (real-time)
tail -f ~/crawler-cron.log
```

---

## 🔧 Troubleshooting

### Problem 1: "Out of capacity" saat buat VM

**Solution:**
1. Coba kurangi OCPU menjadi 2 dan RAM menjadi 12GB
2. Atau coba region lain (Japan/Singapore)
3. Atau coba lagi beberapa jam kemudian (peak hours: 09:00-17:00 UTC)

### Problem 2: Tidak bisa SSH

**Solution:**
1. Check security list sudah ada rule untuk port 22 (SSH)
2. Check private key permission sudah benar
3. Pastikan Public IP Address sudah dicopy dengan benar
4. Coba reboot instance: `Compute` → `Instances` → `More Actions` → `Reboot`

### Problem 3: Container crash terus

**Solution:**
```bash
# Check logs untuk error message
docker logs crawler

# Check RAM usage (mungkin OOM killed)
free -h

# Restart dengan memory limit
docker stop crawler
docker rm crawler
docker run -d \
  --name crawler \
  --restart unless-stopped \
  --memory="20g" \
  -p 4000:4000 \
  -v ~/playwright-data:/app/playwright-data \
  --env-file .env \
  manajemen-gsd-crawler
```

### Problem 4: OAuth login gagal terus

**Solution:**
1. Check credentials di `.env` file
2. Pastikan AppSheet account masih aktif
3. Coba login manual via VNC lagi
4. Check browser profile folder: `ls -la ~/playwright-data/`

### Problem 5: Crawler timeout saat period 21-30

**Solution:**
```bash
# Check logs
docker logs crawler | grep -i timeout

# Increase Docker timeout (edit docker run command)
# Tambahkan environment variable:
-e TIMEOUT=300000  # 5 minutes timeout
```

### Problem 6: Nginx 502 Bad Gateway

**Solution:**
```bash
# Check crawler container running
docker ps

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx config
sudo nginx -t
```

---

## 💰 Biaya dan Limits Always Free Tier

Oracle Cloud Always Free tier **SELAMANYA GRATIS** dengan limits berikut:

### Compute (VM):
- **2 VM** dengan specs:
  - **AMD**: 1/8 OCPU + 1 GB RAM (x2 VM)
  - **ARM (Ampere)**: 4 OCPU + 24 GB RAM (total untuk ALL ARM VMs)
- Kita pakai: **1 VM ARM** dengan **4 OCPU + 24 GB RAM** ✅

### Storage:
- **200 GB** total Boot Volume
- Kita pakai: **50 GB** ✅

### Network:
- **10 TB/month** outbound data transfer
- Crawler biasanya < 100 GB/month ✅

### Database (opsional):
- 2 Autonomous Database dengan 20 GB storage each

⚠️ **PENTING:** Selama Anda TIDAK upgrade ke paid account, **TIDAK ADA BIAYA SAMA SEKALI**.

---

## 🎉 Deployment Selesai!

Congratulations! Crawler Anda sekarang berjalan di Oracle Cloud dengan spesifikasi:

✅ **100% GRATIS selamanya** (tidak ada expiry)  
✅ **4 vCPU ARM + 24 GB RAM** (sangat powerful!)  
✅ **50 GB persistent storage** (OAuth cookies aman)  
✅ **Automated scheduling** (cron jobs setiap hari)  
✅ **Auto-restart** on crash atau reboot  
✅ **Nginx reverse proxy** untuk better performance  
✅ **SSL/HTTPS ready** (jika pakai domain)  

### Next Steps:

1. **Update Dashboard dengan Oracle IP:**
   - Edit `Dashboard-GSD/src/app/(admin)/superadmin/crawl/page.tsx`
   - Ganti `CRAWLER_API_URL` menjadi `http://xxx.xxx.xxx.xxx:4000` (atau `https://domain.com` jika pakai SSL)

2. **Monitor Logs Berkala:**
   ```bash
   # SSH ke server
   ssh -i "$env:USERPROFILE\.ssh\oracle-ssh-key.key" ubuntu@xxx.xxx.xxx.xxx
   
   # Check logs
   docker logs -f crawler
   ```

3. **Setup Email Notifications (opsional):**
   - Install `mailutils`: `sudo apt install -y mailutils`
   - Edit cron script untuk kirim email jika crawl gagal

4. **Backup Berkala:**
   ```bash
   # Backup playwright-data (OAuth cookies)
   tar -czf playwright-data-backup-$(date +%Y%m%d).tar.gz ~/playwright-data/
   ```

---

## 📚 Referensi

- **Oracle Cloud Free Tier:** https://www.oracle.com/cloud/free/
- **Oracle Cloud Documentation:** https://docs.oracle.com/en-us/iaas/
- **Docker Documentation:** https://docs.docker.com/
- **Nginx Documentation:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/

---

## 🆘 Support

Jika ada masalah atau pertanyaan:

1. Check logs: `docker logs crawler`
2. Check Troubleshooting section di atas
3. Restart container: `docker restart crawler`
4. Check GitHub Issues: https://github.com/Luxlon/manajemengsd-crawler/issues

---

**🎊 Selamat! Deployment Oracle Cloud Anda berhasil! 🎊**

*Last updated: December 8, 2024*
