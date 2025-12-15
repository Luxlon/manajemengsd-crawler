# OAuth Setup Guide untuk Render.com (GRATIS)

## Masalah

Setiap kali redeploy Render.com (free tier), directory `/app/playwright-data` direset, sehingga Google OAuth session hilang dan crawler tidak bisa auto-login.

## Solusi Semi-Manual (100% GRATIS)

### Setup Pertama Kali (One-time per redeploy)

#### **Option 1: SSH Manual Login (Recommended - Mudah)**

Jika Render.com support SSH (available di free tier untuk beberapa menit):

1. **Buka Render.com Dashboard** → Pilih service `crawler-service`

2. **Buka Shell/SSH** → Klik tombol "Shell" di dashboard Render

3. **Jalankan crawler sekali dengan manual intervention:**

   ```bash
   # Install xvfb untuk virtual display (headless mode tidak bisa manual click)
   apt-get update && apt-get install -y xvfb

   # Set display virtual
   export DISPLAY=:99
   Xvfb :99 -screen 0 1920x1080x24 &

   # Temporary: Ubah headless mode ke false
   # (Edit crawler.js line ~319 atau ~584)
   sed -i 's/headless: true/headless: false/g' crawler.js

   # Jalankan crawler (akan gagal di OAuth tapi browser terbuka)
   node -e "import('./crawler.js').then(m => m.runCrawlPeriod1_20('BANDUNG'))"
   ```

4. **Manual Login via VNC/noVNC:**
   - Install noVNC viewer atau
   - Gunakan `x11vnc` untuk remote ke display virtual
   - Login manual ke Google saat diminta
   - Session tersimpan di `/app/playwright-data`

⚠️ **Ini kompleks dan tidak praktis untuk free tier**

---

#### **Option 2: Workaround dengan Webhook Trigger (EASIEST - Recommended)**

Karena Render.com free tier sulit untuk manual intervention, kita bisa:

**A. Setup Local untuk Generate Persistent Context:**

1. **Di komputer lokal Windows, jalankan:**

   ```powershell
   # Buat direktori temporary untuk simulate Render environment
   mkdir C:\temp\playwright-render-session

   # Edit crawler.js sementara untuk local testing:
   # Ganti line ~584:
   # const userDataDir = "/app/playwright-data";
   # Jadi:
   # const userDataDir = "C:\\temp\\playwright-render-session";
   ```

2. **Jalankan crawler lokal:**

   ```powershell
   npm run test:period1
   ```

3. **Login manual ke Google** saat diminta (browser akan terbuka)

4. **Session tersimpan** di `C:\temp\playwright-render-session`

5. **Upload session ke Render.com:**

   Sayangnya, Render.com free tier **tidak support upload manual** ke persistent volume.

---

#### **Option 3: Render Persistent Disk ($0.25/month - BEST PERMANENT SOLUTION)**

Jika budget sangat terbatas tapi perlu reliability:

1. **Attach Persistent Disk** di Render.com:

   - Dashboard → Service Settings → Disks
   - Create disk: 1GB ($0.25/month)
   - Mount path: `/app/playwright-data`

2. **Deploy ulang** - Session akan persist across deploys

3. **One-time manual login:**
   - Trigger crawler dari dashboard
   - Jika gagal OAuth, lihat Option 1 untuk manual intervention
   - Setelah berhasil, session persist selamanya

**Total cost: $0.25/month (Rp 4,000/bulan)**

---

### **Option 4: Hybrid - Pre-authenticated Session via Environment Variable**

**Solusi paling praktis untuk FREE tier:**

1. **Login sekali di lokal**, ambil cookies/localStorage

2. **Inject via code** sebelum navigate:

   ```javascript
   // Di crawler.js, setelah browser.newPage()
   await page
     .context()
     .addCookies([
       {
         name: "google_auth",
         value: process.env.GOOGLE_AUTH_COOKIE,
         domain: ".appsheet.com",
       },
     ]);
   ```

3. **Set environment variable** di Render.com dengan cookie value

⚠️ **Masalah:**

- Cookies expire (perlu refresh berkala)
- Security risk (cookie di environment variable)

---

## Rekomendasi Final (GRATIS)

**Untuk Render.com Free Tier:**

1. **Accept manual intervention** setelah setiap redeploy (jarang terjadi)
2. Crawler auto-click "Sign in with Google"
3. Jika Google form muncul:
   - Temporary deploy dengan `headless: false` + VNC
   - Atau tunggu hingga ada deploy yang tidak reset `/app/playwright-data` (rare case)
4. Session tersimpan dan reusable hingga redeploy berikutnya

**Untuk Production (Recommended):**

- Gunakan **Render Persistent Disk** ($0.25/month)
- One-time setup, no maintenance
- 100% automated selamanya

---

## Current Implementation

Crawler sudah **auto-handle OAuth**:

- ✅ Auto-click "Sign in with Google" button
- ✅ Jika persistent context punya session → Auto-login berhasil
- ❌ Jika persistent context kosong → Manual intervention needed (first time only)

**Trade-off:** Gratis tapi perlu manual login setelah redeploy vs $0.25/month tapi fully automated.
