# 🔐 Setup OAuth untuk Render.com (GRATIS - Semi-Manual)

## Masalah
Render.com free tier mereset `/app/playwright-data` setiap deploy, sehingga Google OAuth session hilang.

## Solusi: Pre-Seeded Session (100% Gratis!)

### Langkah 1: Extract OAuth Session (Di Komputer Lokal)

```powershell
# Jalankan script extractor
node extract-oauth-session.js
```

Script akan:
1. Membuka browser Chrome
2. Meminta Anda login manual ke Google
3. Extract cookies & localStorage
4. Simpan ke file `oauth-session.json`

**Penting:** Login dengan akun Google yang sama dengan yang digunakan di AppSheet!

### Langkah 2: Upload Session ke Render.com

1. **Buka file `oauth-session.json`**
2. **Copy seluruh isinya**
3. **Buka Render.com Dashboard** → Pilih service `crawler-service`
4. **Environment Variables** → Add new variable:
   - **Key:** `OAUTH_SESSION_DATA`
   - **Value:** *Paste seluruh content oauth-session.json (sebagai satu baris JSON)*
   
   **Tip:** Minify JSON dulu agar tidak terlalu panjang:
   ```powershell
   # Di PowerShell
   Get-Content oauth-session.json | ConvertFrom-Json | ConvertTo-Json -Compress | Set-Clipboard
   ```

5. **Save** dan **Redeploy** service

### Langkah 3: Test Crawler

Panggil API dari dashboard Next.js Anda untuk trigger crawler. Crawler akan:
1. Load cookies & localStorage dari environment variable
2. Auto-login ke AppSheet (skip OAuth flow)
3. Mulai crawling

## Durasi Session

- **Google OAuth session:** Biasanya valid 30-90 hari
- **AppSheet session:** Linked ke Google session

Jika session expire, ulangi Langkah 1-2 (cukup 5 menit).

## Alternative: Render Persistent Disk ($0.25/month)

Jika tidak mau repeat setup setiap expire:

1. **Render.com Dashboard** → Service Settings → Disks
2. **Create Disk:** 1GB ($0.25/month)
3. **Mount Path:** `/app/playwright-data`
4. **Deploy** dan login manual sekali
5. **Session persist selamanya** (tidak perlu repeat)

**Cost:** Rp ~4,000/bulan

## Troubleshooting

**Error: "Google sign-in button not found"**
- Session sudah expire
- Ulangi extraction dengan `node extract-oauth-session.js`
- Update environment variable `OAUTH_SESSION_DATA`

**Error: "Cannot login: OAuth provider selection required"**
- `OAUTH_SESSION_DATA` tidak di-set atau invalid
- Pastikan JSON format benar (single line, no line breaks)

**Error: JSON parse error in environment variable**
- JSON tidak valid atau ada karakter escape yang salah
- Gunakan JSON minifier sebelum paste

## FAQ

**Q: Apakah aman menyimpan session di environment variable?**
A: Secukupnya aman untuk internal tools. Jangan share Render.com dashboard access ke orang lain.

**Q: Berapa lama harus repeat setup?**
A: 30-90 hari (ketika Google session expire). Anda akan dapat error saat crawling.

**Q: Apakah bisa otomatis refresh session?**
A: Tidak untuk free tier. Harus manual extract ulang atau upgrade ke Persistent Disk.

**Q: Apakah support multiple regions?**
A: Ya! Session Google berlaku untuk semua 4 regions karena menggunakan akun Google yang sama.
