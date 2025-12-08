# Fly.io Deployment Guide - AppSheet Crawler with OAuth

## Prerequisites
- ✅ GitHub account
- ✅ Credit card (for verification only, FREE tier not charged)

---

## Step 1: Install Fly CLI

**Windows (PowerShell):**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Verify installation:**
```bash
fly version
```

---

## Step 2: Login to Fly.io

```bash
fly auth login
```

Browser akan terbuka → Login dengan GitHub account Anda.

---

## Step 3: Create Fly App

```bash
cd C:\Intership\Manajemen-GSD\Playwright-crawler

# Create app (interactive)
fly launch --no-deploy
```

**Questions yang muncul:**
- App name? → `manajemen-gsd-crawler` (atau custom)
- Region? → **Singapore** (closest to Indonesia)
- Setup PostgreSQL? → **No**
- Setup Redis? → **No**
- Deploy now? → **No** (we need to configure volume first)

---

## Step 4: Create Persistent Volume (CRITICAL!)

```bash
# Create 3GB volume for browser data
fly volumes create playwright_data --size 3 --region sin
```

**Output:**
```
        ID: vol_xxxxx
      Name: playwright_data
       App: manajemen-gsd-crawler
    Region: sin
      Zone: xxxxx
   Size GB: 3
 Encrypted: true
Created at: 08 Dec 25 xx:xx UTC
```

✅ This volume will **SURVIVE** container restarts and deployments!

---

## Step 5: Configure Secrets (Environment Variables)

```bash
# Set all environment variables as secrets
fly secrets set NEXTJS_API_URL=https://dashboard-gsd.vercel.app
fly secrets set CRAWLER_API_KEY=your-generated-api-key-here
fly secrets set BANDUNG_USERNAME=855060
fly secrets set BANDUNG_PASSWORD=123
fly secrets set CORPU_USERNAME=AMIRUDDIN
fly secrets set CORPU_PASSWORD=123
fly secrets set PRIANGAN_TIMUR_USERNAME=755261
fly secrets set PRIANGAN_TIMUR_PASSWORD=123
fly secrets set PRIANGAN_BARAT_USERNAME=825068
fly secrets set PRIANGAN_BARAT_PASSWORD=123
fly secrets set RENDER=true
```

**Generate API Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 6: Deploy to Fly.io

```bash
fly deploy
```

**Build process:**
- ✅ Dockerfile detected
- ✅ Installing Chromium dependencies
- ✅ Building container image
- ✅ Deploying to Singapore region
- ✅ Mounting persistent volume
- ⏳ Wait 5-10 minutes...

**Output:**
```
==> Monitoring deployment

 1 desired, 1 placed, 1 healthy, 0 unhealthy
--> v0 deployed successfully
```

---

## Step 7: First-Time OAuth Login (CRITICAL!)

**Option A: Via Fly SSH (Recommended)**

```bash
# SSH into running container
fly ssh console

# Inside container, run crawler manually
node -e "import('./crawler.js').then(m => m.runCrawlPeriod1_20('BANDUNG'))"
```

**What happens:**
1. Crawler opens AppSheet
2. **OAuth provider selection screen appears**
3. ❌ **CANNOT AUTOMATE** (security restriction)
4. You need to manually complete OAuth...

**BUT WAIT!** Fly.io has **Fly Machines Console** with GUI access:

```bash
# Install VNC viewer or use Fly's web console
fly ssh console -C "DISPLAY=:99 node -e \"import('./crawler.js').then(m => m.runCrawlPeriod1_20('BANDUNG'))\""
```

**Option B: Pre-authenticate Browser Data Locally**

1. **Run crawler locally** with `headless: false`
2. Complete OAuth login manually (Google/Yahoo)
3. Browser saves cookies to `C:\Users\Luxion\AppData\Local\Google\Chrome\User Data\PlaywrightProfile`
4. **Copy browser profile to Fly volume:**

```bash
# Create tar archive of browser profile
tar -czf playwright-profile.tar.gz -C "C:\Users\Luxion\AppData\Local\Google\Chrome\User Data" PlaywrightProfile

# Upload to Fly volume
fly ssh sftp shell
put playwright-profile.tar.gz /app/playwright-data/

# Extract on Fly
fly ssh console
cd /app/playwright-data
tar -xzf playwright-profile.tar.gz
rm playwright-profile.tar.gz
```

**Option C: Modify Dockerfile for Interactive Setup**

Add to `Dockerfile`:
```dockerfile
# Install VNC for remote desktop (temporary, for first-time setup)
RUN apt-get update && apt-get install -y x11vnc xvfb

# Expose VNC port
EXPOSE 5900
```

Then:
```bash
fly deploy
fly ssh console
# Start VNC server
Xvfb :99 -screen 0 1280x1024x24 &
x11vnc -display :99 -forever -rfbport 5900
```

Connect with VNC client → Complete OAuth → Done!

---

## Step 8: Verify Deployment

```bash
# Check app status
fly status

# View logs
fly logs

# Open app in browser
fly open

# Test health endpoint
curl https://manajemen-gsd-crawler.fly.dev/health
```

---

## Step 9: Auto-Deploy Setup (Optional)

**Connect to GitHub Actions:**

Create `.github/workflows/deploy-fly.yml`:
```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: superfly/flyctl-actions/setup-flyctl@master
      
      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

**Get API Token:**
```bash
fly auth token
```

Add to GitHub Secrets: `Settings → Secrets → FLY_API_TOKEN`

---

## Step 10: Test Crawler

**From SuperAdmin UI:**
1. Click "Run Crawler" button
2. Backend sends: `POST https://manajemen-gsd-crawler.fly.dev/run-crawler-period-1-20`
3. Fly.io wakes machine (if sleeping)
4. Crawler runs with **saved OAuth cookies** ✅
5. Real-time SSE logs stream to UI

---

## Troubleshooting

**Issue 1: Volume not mounted**
```bash
fly volumes list
# Should show: playwright_data mounted to /app/playwright-data
```

**Issue 2: Browser crashes (512MB RAM not enough)**
```bash
# Upgrade to 1GB RAM
fly scale memory 1024
```

**Issue 3: OAuth cookies not persisting**
```bash
# Check if volume is writable
fly ssh console
ls -la /app/playwright-data
# Should show: drwxr-xr-x
```

**Issue 4: Cold start timeout**
```bash
# Keep machine running (prevent sleep)
# In fly.toml:
auto_stop_machines = false
min_machines_running = 1
```

---

## Cost Breakdown

**Fly.io FREE Allowance:**
- ✅ 3 shared-cpu-1x machines (256MB RAM each)
- ✅ 160GB outbound data transfer
- ✅ 3GB persistent volume storage

**Our Usage:**
- 1 machine × 512MB RAM = **$5.69/month**
- 3GB volume = **FREE** ✅
- Data transfer (~10GB/month) = **FREE** ✅

**With $5 FREE credit:** ~1 month FREE, then **$5.69/month** 💰

---

## Alternative: If Fly.io Credit Card Required

Use **Pre-authenticated Browser Profile** method:
1. Run crawler locally → Complete OAuth
2. Upload profile to **GitHub Release** (private repo)
3. Dockerfile downloads profile on build:
```dockerfile
RUN wget https://github.com/Luxlon/manajemengsd-crawler/releases/download/v1.0/profile.tar.gz
RUN tar -xzf profile.tar.gz -C /app/playwright-data
```

---

## Summary

✅ **Fly.io is BEST for AppSheet OAuth** because:
- Persistent volumes survive restarts
- SSH access for manual OAuth
- $5 FREE credit
- Always-on (no auto-sleep)
- 512MB RAM sufficient

❌ **Railway/Koyeb/Heroku** won't work because:
- Ephemeral filesystem
- OAuth cookies lost on restart
- No persistent browser state

---

Need help with OAuth setup on Fly? Let me know! 🚀
