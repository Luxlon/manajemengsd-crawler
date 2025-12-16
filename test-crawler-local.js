/**
 * LOCAL CRAWLER TEST - dengan browser VISIBLE
 * Jalankan: node test-crawler-local.js
 * 
 * ALUR BARU:
 * 1. Launch browser dengan persistent context
 * 2. Load cookies Google & AppSheet (jika ada)
 * 3. LANGSUNG ke App URL (tidak ke homepage!)
 * 4. Cek tombol Login di page tersebut
 * 5. Jika ada tombol Login → klik → isi username/password
 * 6. Proses crawling seperti biasa
 */

import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// ====== CONFIGURATION ======
const CONFIG = {
    // Set ke true untuk pause di setiap langkah
    pauseAtEachStep: true,
    
    // Area yang akan ditest
    area: "BANDUNG",
    
    // Load cookies dari file (opsional, untuk test)
    loadCookies: true,
    
    // Credentials
    credentials: {
        BANDUNG: {
            username: process.env.BANDUNG_USERNAME,
            password: process.env.BANDUNG_PASSWORD,
        },
    },
    
    // App URL - langsung ke sini!
    appUrl: "https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c?platform=desktop#appName=SLAMtes-320066460",
};

async function pause(message) {
    if (CONFIG.pauseAtEachStep) {
        console.log(`\n⏸️  ${message}`);
        console.log("   Press ENTER to continue...");
        await new Promise(resolve => process.stdin.once('data', resolve));
    }
}

async function runLocalTest() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("   🧪 LOCAL CRAWLER TEST - VISIBLE BROWSER");
    console.log("   📋 ALUR: Cookies → App URL → Login Button → Crawl");
    console.log("═══════════════════════════════════════════════════════════\n");
    
    // ========================================
    // STEP 1: Launch Browser
    // ========================================
    console.log("📍 STEP 1: Launching browser dengan persistent context...");
    const userDataDir = "./playwright-profile-test";
    
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: false,  // 👀 BROWSER VISIBLE!
        args: [
            "--start-maximized",
            "--disable-blink-features=AutomationControlled",
        ],
        viewport: null,  // Full screen
    });
    
    const page = browser.pages()[0] || await browser.newPage();
    console.log("   ✅ Browser launched!");
    console.log(`   📂 User data dir: ${userDataDir}\n`);
    
    try {
        // ========================================
        // STEP 2: Load Cookies (Opsional)
        // ========================================
        if (CONFIG.loadCookies) {
            console.log("📍 STEP 2: Loading cookies (jika ada)...");
            
            let cookiesLoaded = false;
            
            // Try loading from oauth-session.json
            if (fs.existsSync('./oauth-session.json')) {
                console.log("   📂 Found oauth-session.json");
                try {
                    const sessionData = JSON.parse(fs.readFileSync('./oauth-session.json', 'utf8'));
                    
                    if (sessionData.cookies && sessionData.cookies.length > 0) {
                        // Filter cookies untuk domain yang valid
                        const validCookies = sessionData.cookies.filter(c => {
                            // Skip cookies dengan domain yang bermasalah
                            if (!c.domain) return false;
                            return true;
                        });
                        
                        console.log(`   📦 Loading ${validCookies.length} cookies...`);
                        await page.context().addCookies(validCookies);
                        console.log("   ✅ Cookies loaded ke browser context!");
                        cookiesLoaded = true;
                    }
                } catch (e) {
                    console.log(`   ⚠️ Error loading cookies: ${e.message}`);
                }
            } else {
                console.log("   ℹ️ oauth-session.json tidak ditemukan (tidak masalah)");
            }
            
            if (!cookiesLoaded) {
                console.log("   ℹ️ Tidak ada cookies yang di-load - akan login dengan username/password");
            }
        } else {
            console.log("📍 STEP 2: Skip loading cookies (CONFIG.loadCookies = false)");
        }
        
        await pause("Cookies loaded (atau skip). Selanjutnya langsung ke App URL.");
        
        // ========================================
        // STEP 3: LANGSUNG ke App URL
        // ========================================
        console.log("\n📍 STEP 3: LANGSUNG navigasi ke App URL...");
        console.log(`   🔗 URL: ${CONFIG.appUrl}`);
        console.log("   ⚠️ TIDAK ke appsheet.com homepage! Langsung ke app!");
        
        await page.goto(CONFIG.appUrl, { waitUntil: "networkidle", timeout: 60000 });
        console.log("   ✅ Navigation complete!");
        
        // Wait for page to stabilize
        console.log("   ⏳ Waiting 5 seconds for page to fully load...");
        await page.waitForTimeout(5000);
        
        const currentUrl = page.url();
        console.log(`   📍 Current URL: ${currentUrl}`);
        
        await pause("Sekarang di App URL. Lihat browser - apa yang muncul?");
        
        // ========================================
        // STEP 4: Check Page State & Elements
        // ========================================
        console.log("\n📍 STEP 4: Checking page state...");
        
        // Check all relevant elements
        const elements = {
            'Checklist button (fa-check)': 'div[role="button"] i.fa-check',
            'Login button (fa-sign-in-alt)': 'div.GenericActionButton__paddington:has(i.fa-sign-in-alt)',
            'Navigation menu': "ul[role='navigation']",
            'Username input': 'input[aria-label="Username"]',
            'Google OAuth button': 'button#Google',
        };
        
        console.log("\n   🔍 Element check:");
        const elementStatus = {};
        for (const [name, selector] of Object.entries(elements)) {
            const count = await page.locator(selector).count();
            elementStatus[name] = count;
            const status = count > 0 ? `✅ Found (${count})` : '❌ Not found';
            console.log(`      ${name}: ${status}`);
        }
        
        // Determine page state
        let pageState = 'unknown';
        if (elementStatus['Checklist button (fa-check)'] > 0) {
            pageState = 'logged_in';
            console.log("\n   🎉 STATE: SUDAH LOGIN! (checklist button ditemukan)");
        } else if (elementStatus['Login button (fa-sign-in-alt)'] > 0) {
            pageState = 'need_login';
            console.log("\n   🔐 STATE: PERLU LOGIN (tombol Login ditemukan)");
        } else if (elementStatus['Google OAuth button'] > 0) {
            pageState = 'oauth_page';
            console.log("\n   🔐 STATE: OAuth page (tombol Google ditemukan)");
        } else if (elementStatus['Username input'] > 0) {
            pageState = 'login_form';
            console.log("\n   📝 STATE: Login form sudah terbuka");
        }
        
        await pause(`Page state: ${pageState}. Selanjutnya akan handle login jika perlu.`);
        
        // ========================================
        // STEP 5: Handle Login
        // ========================================
        if (pageState === 'logged_in') {
            console.log("\n📍 STEP 5: Skip login - sudah logged in!");
        } else if (pageState === 'need_login') {
            console.log("\n📍 STEP 5: Melakukan login dengan username/password...");
            
            const credentials = CONFIG.credentials[CONFIG.area];
            if (!credentials || !credentials.username) {
                throw new Error(`Credentials tidak ditemukan untuk area: ${CONFIG.area}`);
            }
            
            console.log(`   👤 Area: ${CONFIG.area}`);
            console.log(`   👤 Username: ${credentials.username}`);
            
            // Click Login button
            console.log("\n   🖱️ Clicking Login button...");
            const loginButton = page.locator('div.GenericActionButton__paddington:has(i.fa-sign-in-alt)');
            await loginButton.first().click();
            
            console.log("   ⏳ Waiting for login form...");
            await page.waitForTimeout(2000);
            
            // Wait for username input
            try {
                await page.waitForSelector('input[aria-label="Username"]', { timeout: 15000, state: 'visible' });
                console.log("   ✅ Login form appeared!");
            } catch (e) {
                console.log("   ⚠️ Timeout waiting for form, checking anyway...");
            }
            
            await pause("Login form should be visible. Check browser.");
            
            // Fill username
            const usernameInput = page.locator('input[aria-label="Username"]');
            if (await usernameInput.count() > 0) {
                console.log(`   ⌨️ Filling username: ${credentials.username}`);
                await usernameInput.fill(credentials.username);
                
                // Fill password
                console.log("   ⌨️ Filling password: ***");
                await page.fill('input[aria-label="Password"]', credentials.password);
                
                await pause("Username & password filled. Check browser, lalu tekan ENTER untuk submit.");
                
                // Click submit
                console.log("   🖱️ Clicking Login submit button...");
                await page.click('button:has-text("Login")');
                
                // Wait for app to load
                console.log("   ⏳ Waiting for app to load after login...");
                try {
                    await Promise.race([
                        page.waitForSelector("ul[role='navigation']", { timeout: 30000 }),
                        page.waitForSelector('div[role="button"] i.fa-check', { timeout: 30000 }),
                    ]);
                    console.log("   ✅ LOGIN SUCCESSFUL!");
                } catch (e) {
                    // Check if actually logged in
                    await page.waitForTimeout(3000);
                    const checkAfter = await page.locator('div[role="button"] i.fa-check').count();
                    if (checkAfter > 0) {
                        console.log("   ✅ LOGIN SUCCESSFUL! (checklist found)");
                    } else {
                        console.log("   ❌ Login might have failed - check browser");
                    }
                }
            } else {
                console.log("   ❌ Username input tidak ditemukan setelah click Login button");
            }
            
        } else if (pageState === 'login_form') {
            // Login form already open
            console.log("\n📍 STEP 5: Login form sudah terbuka, mengisi credentials...");
            
            const credentials = CONFIG.credentials[CONFIG.area];
            
            const usernameInput = page.locator('input[aria-label="Username"]');
            console.log(`   ⌨️ Filling username: ${credentials.username}`);
            await usernameInput.fill(credentials.username);
            
            console.log("   ⌨️ Filling password: ***");
            await page.fill('input[aria-label="Password"]', credentials.password);
            
            await pause("Credentials filled. Tekan ENTER untuk submit.");
            
            await page.click('button:has-text("Login")');
            console.log("   ⏳ Waiting for app...");
            await page.waitForTimeout(5000);
            
        } else if (pageState === 'oauth_page') {
            console.log("\n📍 STEP 5: OAuth page detected");
            console.log("   ⚠️ Ini seharusnya tidak terjadi jika langsung ke App URL");
            console.log("   ⚠️ Mungkin app memang pakai OAuth, bukan username/password");
            
            await pause("Check browser - apakah ini OAuth page?");
            
        } else {
            console.log("\n📍 STEP 5: Unknown state - cannot determine login method");
            console.log("   📸 Taking screenshot for debugging...");
            await page.screenshot({ path: './test-unknown-state.png', fullPage: true });
        }
        
        await pause("Login process complete. Check browser state.");
        
        // ========================================
        // STEP 6: Verify Final State
        // ========================================
        console.log("\n📍 STEP 6: Verifying final state...");
        
        const finalChecklist = await page.locator('div[role="button"] i.fa-check').count();
        const finalNav = await page.locator("ul[role='navigation']").count();
        
        console.log(`   Checklist button: ${finalChecklist > 0 ? '✅ Found' : '❌ Not found'}`);
        console.log(`   Navigation menu: ${finalNav > 0 ? '✅ Found' : '❌ Not found'}`);
        
        if (finalChecklist > 0 || finalNav > 0) {
            console.log("\n   🎉 SUCCESS! App is ready for crawling!");
            
            // Try clicking checklist button
            if (finalChecklist > 0) {
                await pause("Mau coba click Checklist button? Tekan ENTER.");
                
                console.log("   🖱️ Clicking Checklist button...");
                await page.locator('div[role="button"] i.fa-check').first().click();
                await page.waitForTimeout(3000);
                
                console.log("   ✅ Checklist view should be open now!");
            }
        } else {
            console.log("\n   ❌ App not ready - login might have failed");
        }
        
        // ========================================
        // STEP 7: Take Final Screenshot
        // ========================================
        console.log("\n📍 STEP 7: Taking final screenshot...");
        await page.screenshot({ path: './test-final-state.png', fullPage: true });
        console.log("   📸 Screenshot saved: test-final-state.png");
        
        await pause("Test complete! Review browser state, lalu tekan ENTER untuk close.");
        
    } catch (error) {
        console.error("\n❌ ERROR:", error.message);
        console.error(error.stack);
        
        await page.screenshot({ path: './test-error-state.png', fullPage: true });
        console.log("   📸 Error screenshot saved: test-error-state.png");
        
        await pause("Error occurred. Check browser and screenshot.");
    } finally {
        console.log("\n📍 CLOSING BROWSER...");
        await browser.close();
        console.log("✅ Test complete!\n");
    }
}

// Run the test
runLocalTest().catch(console.error);
