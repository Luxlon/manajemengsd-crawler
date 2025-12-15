# MANUAL OAUTH SESSION EXTRACTION GUIDE
# Karena Google memblokir automated browser, kita extract session dari Chrome normal

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  MANUAL OAuth Session Extraction for Render.com" -ForegroundColor White
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

Write-Host "Google memblokir automated browser. Kita akan extract session dari Chrome normal." -ForegroundColor Yellow
Write-Host ""

Write-Host "STEP 1: Login ke AppSheet di Chrome Normal" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "1. Buka Chrome BIASA (bukan dari script)" -ForegroundColor White
Write-Host "2. Buka URL:" -ForegroundColor White
Write-Host "   https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c" -ForegroundColor Yellow
Write-Host "3. Login dengan Google account yang Anda gunakan untuk AppSheet" -ForegroundColor White
Write-Host "4. Tunggu sampai berhasil masuk ke AppSheet app" -ForegroundColor White
Write-Host ""

Write-Host "STEP 2: Extract Cookies dari DevTools" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "1. Di halaman AppSheet yang sudah login, tekan F12 (buka DevTools)" -ForegroundColor White
Write-Host "2. Pilih tab 'Application' (atau 'Storage' di Firefox)" -ForegroundColor White
Write-Host "3. Di sidebar kiri, expand 'Cookies'" -ForegroundColor White
Write-Host "4. Pilih 'https://www.appsheet.com'" -ForegroundColor White
Write-Host "5. Copy semua cookies (klik kanan -> Select All -> Copy)" -ForegroundColor White
Write-Host ""

Write-Host "STEP 3: Paste Cookies ke File" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "1. Buat file baru: cookies-manual.txt" -ForegroundColor White
Write-Host "2. Paste cookies yang sudah di-copy" -ForegroundColor White
Write-Host "3. Simpan file" -ForegroundColor White
Write-Host ""

Write-Host "STEP 4: Convert ke Format JSON" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Jalankan command berikut untuk convert cookies ke format yang benar:" -ForegroundColor White
Write-Host ""
Write-Host "   npm run convert-cookies" -ForegroundColor Yellow
Write-Host ""

Write-Host "ALTERNATIVE: Use Browser Extension" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Lebih mudah menggunakan Chrome Extension:" -ForegroundColor White
Write-Host "1. Install extension: 'EditThisCookie' atau 'Cookie-Editor'" -ForegroundColor White
Write-Host "2. Login ke AppSheet di Chrome normal" -ForegroundColor White
Write-Host "3. Klik extension icon -> Export cookies (format JSON)" -ForegroundColor White
Write-Host "4. Save to file: oauth-session.json" -ForegroundColor White
Write-Host "5. Run: npm run prepare-env" -ForegroundColor White
Write-Host ""

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Open AppSheet URL in default browser
Write-Host "Opening AppSheet in your default browser..." -ForegroundColor Green
Start-Process "https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c"

Write-Host ""
Write-Host "Browser telah dibuka. Silakan login dan ikuti langkah di atas." -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
