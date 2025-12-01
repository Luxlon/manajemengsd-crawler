# 🚀 Quick Start Guide - Automated Crawler

## 📋 Prerequisites
- Node.js 18+ installed
- Chrome/Chromium installed
- Access to AppSheet credentials

---

## ⚡ Local Development Setup

### 1. Install Dependencies
```bash
cd Playwright-crawler
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
nano .env
```

Update `.env`:
```env
NEXTJS_API_URL=http://localhost:3000
CRAWLER_API_KEY=your-api-key
ENABLE_CRON=true
```

### 3. Run Server with Cron
```bash
npm run start:cron
```

Server will start on `http://localhost:4000` with cron scheduler enabled.

---

## 🧪 Testing

### Test Crawler Manually
```bash
# Test periode 1-20 only
npm run test:period1

# Test periode 21-30 only
npm run test:period2

# Test full crawler via API
curl -X POST http://localhost:4000/cron/trigger
```

### Check Status
```bash
# Health check
curl http://localhost:4000/health

# Cron status
curl http://localhost:4000/cron/status
```

---

## 📅 Cron Schedule

Default schedule (can be changed in `cron-scheduler.js`):
- **Morning**: 08:00 WIB (Asia/Jakarta)
- **Afternoon**: 14:00 WIB (Asia/Jakarta)

To change schedule:
```javascript
// In cron-scheduler.js
const CONFIG = {
  schedules: {
    morning: '0 8 * * *',    // Change this
    afternoon: '0 14 * * *',  // Change this
  }
};
```

Cron format: `minute hour day month weekday`
- `0 8 * * *` = Every day at 08:00
- `0 */6 * * *` = Every 6 hours
- `0 8,14,20 * * *` = 08:00, 14:00, 20:00

---

## 📊 Monitoring

### View Logs
```bash
# Real-time logs
npm run logs

# View job history
npm run logs:history

# PM2 logs (if using PM2)
pm2 logs crawler-cron
```

### Check Job History
```bash
cat logs/job-history.jsonl | jq .
```

---

## 🐛 Troubleshooting

### Crawler Stuck
```bash
# Kill all node processes
pkill -f node

# Restart
npm run start:cron
```

### Logs Not Showing
```bash
# Create logs directory
mkdir -p logs

# Check permissions
chmod -R 755 logs
```

### Chrome Not Found
```bash
# Verify Chrome installation
google-chrome --version

# Reinstall Playwright browsers
npx playwright install chromium
```

---

## 🚀 Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production setup.

Quick production start:
```bash
# Using PM2
pm2 start server-with-cron.js --name crawler-cron
pm2 save
pm2 startup
```

---

## 📞 API Endpoints

### Health Check
```bash
GET /health
```

### Cron Status
```bash
GET /cron/status
```

### Manual Trigger
```bash
POST /cron/trigger
```

### Manual Crawl (Single Area)
```bash
POST /run-crawler-both
Body: { "area": "BANDUNG" }
```

---

## 🔔 Notifications

### Setup Telegram Bot
1. Create bot via @BotFather
2. Get bot token
3. Get chat ID from `/getUpdates`
4. Add to `.env`:
```env
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```

---

## 📝 Directory Structure

```
Playwright-crawler/
├── crawler.js              # Main crawler logic
├── server.js              # Original server (no cron)
├── server-with-cron.js    # Server with cron enabled
├── cron-scheduler.js      # Cron job scheduler
├── merge_status.js        # CSV merger
├── package.json           # Dependencies
├── .env                   # Environment config
├── DEPLOYMENT.md          # Detailed deployment guide
├── README.md              # This file
├── logs/                  # Log files
│   ├── crawler-YYYY-MM-DD.log
│   └── job-history.jsonl
└── crawl_data/           # Crawler output
    ├── period_1_20_*.csv
    ├── final_data_*.csv
    └── merged_latest_status.csv
```

---

## 🎯 Next Steps

1. ✅ Install dependencies
2. ✅ Configure environment
3. ✅ Test crawler locally
4. ✅ Setup Telegram notifications
5. ✅ Deploy to production (see DEPLOYMENT.md)
6. ✅ Monitor job execution

---

**Need Help?** Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guides.
