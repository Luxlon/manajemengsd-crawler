# 🍪 Complete Cookie Extraction Guide

## Masalah Saat Ini

✅ AppSheet cookies berhasil di-extract (4 cookies)  
❌ **Google OAuth cookies BELUM** di-extract  
→ Akibatnya: Crawler masih redirect ke OAuth screen

## Solusi: Extract Cookies dari SEMUA Domains

### Method 1: Menggunakan Browser Extension (RECOMMENDED - EASIEST)

#### Step 1: Install Extension

1. Buka Chrome Web Store
2. Cari & install **"Cookie-Editor"** by cgagnier  
   Link: https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm
3. **ATAU** install **"EditThisCookie"**  
   Link: https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg

#### Step 2: Login ke AppSheet

1. Buka Chrome NORMAL (bukan dari script)
2. Pergi ke: https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c
3. **Login dengan Google account** yang Anda gunakan untuk AppSheet
4. Tunggu sampai **BERHASIL masuk** ke AppSheet app (Anda lihat menu/checklist)

#### Step 3: Export Cookies

1. **Klik icon extension** Cookie-Editor di toolbar Chrome (atas kanan)
2. Klik tombol **"Export"**
3. Pilih format **"JSON"** atau **"Netscape"**
4. **Copy** semua cookies yang muncul
5. Paste ke file `oauth-session.json` dengan format:
   ```json
   {
     "cookies": [ ...paste disini... ],
     "localStorage": {},
     "timestamp": "2025-12-15T09:00:00.000Z",
     "note": "Exported from Cookie-Editor extension"
   }
   ```

#### Step 4: Upload ke Render

```powershell
npm run prepare-env
```

Lalu paste ke Render.com environment variable `OAUTH_SESSION_DATA`

---

### Method 2: Manual Export dari DevTools (ADVANCED)

**PENTING:** Anda harus export cookies dari **MULTIPLE domains**, bukan hanya appsheet.com!

#### Step 1: Login ke AppSheet (sama seperti Method 1)

#### Step 2: Buka DevTools

1. Tekan **F12** atau **Ctrl+Shift+I**
2. Pilih tab **"Application"** (atau "Storage" di browser lain)
3. Di sidebar kiri, expand **"Cookies"**

#### Step 3: Export dari SEMUA Domains (CRITICAL!)

Anda akan lihat beberapa domain di bawah "Cookies":

- ✅ `https://www.appsheet.com` ← **SUDAH di-export**
- ❌ `https://accounts.google.com` ← **BELUM (PENTING!)**
- ❌ `.google.com` ← **BELUM**
- ❌ `.googleusercontent.com` ← **BELUM**

**Untuk SETIAP domain:**

1. Klik domain tersebut
2. Klik di tabel cookies (sembarang row)
3. **Ctrl+A** (select all)
4. **Ctrl+C** (copy)
5. **Append** (tambahkan) ke file `cookies-manual.txt` (jangan replace!)

**Format final `cookies-manual.txt` harus punya cookies dari MULTIPLE domains:**

```
# Cookies from www.appsheet.com
_ga	GA1.1.xxx	.appsheet.com	/	2026-11-18...
.JEENEEATH	xxx	.appsheet.com	/	2026-01-12...

# Cookies from accounts.google.com
SID	xxx	.google.com	/	2027-12-15...
HSID	xxx	.google.com	/	2027-12-15...
SSID	xxx	.google.com	/	2027-12-15...
APISID	xxx	.google.com	/	2027-12-15...
SAPISID	xxx	.google.com	/	2027-12-15...
__Secure-1PSID	xxx	.google.com	/	2027-12-15...
__Secure-3PSID	xxx	.google.com	/	2027-12-15...
```

#### Step 4: Convert & Upload

```powershell
npm run convert-cookies  # Convert ke JSON format
npm run prepare-env      # Prepare for Render
```

---

## Validation Checklist

Sebelum upload ke Render, pastikan `oauth-session.json` punya:

- ✅ **AppSheet cookies** (`.JEENEAETH`, `_ga`, dll) ← SUDAH
- ✅ **Google cookies** (`SID`, `HSID`, `SSID`, `APISID`, etc) ← **BELUM!**
- ✅ **Total cookies:** Minimal 15-20 cookies (bukan hanya 4)

**Saat ini Anda hanya punya 4 cookies** - itu sebabnya gagal!

---

## Quick Fix (RECOMMENDED NOW)

Karena manual DevTools rumit, **gunakan Browser Extension**:

1. Install **Cookie-Editor** extension
2. Login ke AppSheet di Chrome normal
3. Klik extension → Export → JSON
4. Paste ke `oauth-session.json`
5. Run `npm run prepare-env`
6. Upload ke Render

**Total waktu: 3 menit!**

---

## Troubleshooting

**Q: "Saya sudah export cookies tapi masih gagal"**  
A: Pastikan Anda export dari **SEMUA domains** (appsheet + google), bukan hanya appsheet.com

**Q: "Cookie-Editor extension tidak bisa export semua domains"**  
A: Cookie-Editor export cookies dari **current domain** saja. Untuk Google cookies:

- Buka `accounts.google.com` di tab baru (pastikan sudah login)
- Klik Cookie-Editor lagi → Export
- Gabungkan dengan cookies AppSheet

**Q: "Apakah cookies aman di environment variable?"**  
A: Secukupnya aman untuk internal tools. Jangan share akses Render.com ke orang lain.

**Q: "Berapa lama cookies valid?"**  
A: Google session cookies biasanya 1-2 tahun (lihat kolom "Expires" di DevTools)
