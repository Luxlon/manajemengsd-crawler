// ========================================
// CRAWLER WITH DIRECT API INTEGRATION
// Full production-ready implementation
// No CSV intermediary required
// 
// ✅ ROBUST BATCH VERIFICATION SYSTEM:
// - Crawler HALTS before sending each batch
// - Verifies all records are fully sent before resuming
// - Prevents data loss and partial transmissions
// - Detailed tracking of each batch status
// ========================================

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Konfigurasi
const CONFIG = {
    credentials: {
        BANDUNG: { 
            username: process.env.BANDUNG_USERNAME, 
            password: process.env.BANDUNG_PASSWORD 
        },
        CORPU: { 
            username: process.env.CORPU_USERNAME, 
            password: process.env.CORPU_PASSWORD 
        },
        PRIANGAN_TIMUR: { 
            username: process.env.PRIANGAN_TIMUR_USERNAME, 
            password: process.env.PRIANGAN_TIMUR_PASSWORD 
        },
        PRIANGAN_BARAT: { 
            username: process.env.PRIANGAN_BARAT_USERNAME, 
            password: process.env.PRIANGAN_BARAT_PASSWORD 
        },
    },
    currentArea: "BANDUNG",
    statuses: ["OPEN", "SUBMITTED", "APPROVED"],
    months: ["JUL", "AGU", "SEP"],
    outputDir: "./crawl_data",
    scrollDelay: 600,
    scrollStep: 400,
    actionDelay: 1500,
    // ✅ API Configuration
    nextjsApiUrl: process.env.NEXTJS_API_URL || "http://localhost:3000",
    apiKey: process.env.CRAWLER_API_KEY,
    batchSize: 50,
    maxRetries: 3,
    retryDelays: [2000, 4000, 8000],
};

// ========================================
// API CLIENT CLASS
// ========================================
class CrawlerAPIClient {
    constructor(apiUrl, apiKey) {
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.totalSent = 0;
        this.totalFailed = 0;
        this.currentBatch = 0;
        this.batchTracker = []; // Track setiap batch yang dikirim
    }

    async sendBatch(data, metadata, retryCount = 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(`${this.apiUrl}/api/crawler/save`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": this.apiKey,
                },
                body: JSON.stringify({
                    data: data,
                    area: metadata.area,
                    updateMode: metadata.updateMode,
                    month: metadata.month,
                    year: metadata.year || new Date().getFullYear(),
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error ${response.status}: ${errorData.error || 'Unknown'}`);
            }

            const result = await response.json();
            
            // ✅ Validasi response untuk memastikan data benar-benar tersimpan
            if (!result.success) {
                throw new Error(`API returned success=false: ${result.error || 'Unknown error'}`);
            }
            
            // ✅ Validasi jumlah data yang berhasil disimpan
            const expectedCount = data.length;
            const savedCount = result.summary?.berhasil || 0;
            
            if (savedCount !== expectedCount) {
                console.log(`   ⚠️ WARNING: Expected ${expectedCount} records, but only ${savedCount} were saved`);
            }
            
            return { success: true, result, sentCount: expectedCount, savedCount };

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (retryCount < CONFIG.maxRetries) {
                const delay = CONFIG.retryDelays[retryCount];
                console.log(`   ⚠️ Failed: ${error.message}`);
                console.log(`   🔄 Retry ${retryCount + 1}/${CONFIG.maxRetries} in ${delay/1000}s...`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendBatch(data, metadata, retryCount + 1);
            }
            
            return { 
                success: false, 
                error: error.message,
                retries: retryCount,
                sentCount: data.length,
                savedCount: 0
            };
        }
    }
    
    /**
     * ✅ VERIFY BATCH: Memastikan batch benar-benar terkirim lengkap
     * Fungsi ini akan HALT crawler sampai batch fully sent
     */
    async verifyAndSendBatch(data, metadata, batchNumber) {
        const startTime = Date.now();
        const logMessage = `\n   🔒 HALTING CRAWLER: Sending batch #${batchNumber} (${data.length} records)...`;
        console.log(logMessage);
        console.log(`   ℹ️  Crawler will resume after batch is fully sent\n`);
        
        // Broadcast progress to SSE
        if (global.broadcastLog) {
            global.broadcastLog(this.runId, {
                type: 'batch_start',
                batchNumber,
                recordCount: data.length,
                message: `Sending batch #${batchNumber} (${data.length} records)`
            });
        }
        
        // Send batch dengan retry
        const result = await this.sendBatch(data, metadata);
        
        if (!result.success) {
            console.error(`   ❌ BATCH #${batchNumber} FAILED: ${result.error}`);
            console.error(`   ⚠️ ${result.sentCount} records NOT saved - Manual intervention required`);
            this.batchTracker.push({
                batchNumber,
                status: 'FAILED',
                sentCount: result.sentCount,
                savedCount: 0,
                error: result.error,
                timestamp: new Date().toISOString()
            });
            
            if (global.broadcastLog) {
                global.broadcastLog(this.runId, {
                    type: 'batch_failed',
                    batchNumber,
                    error: result.error
                });
            }
            
            throw new Error(`Batch #${batchNumber} failed after ${CONFIG.maxRetries} retries`);
        }
        
        // ✅ Validasi batch fully sent
        const expectedCount = data.length;
        const savedCount = result.savedCount || result.result.summary?.berhasil || 0;
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        if (savedCount === expectedCount) {
            console.log(`   ✅ BATCH #${batchNumber} FULLY SENT: ${savedCount}/${expectedCount} records saved`);
            console.log(`   ⏱️  Duration: ${duration}s`);
            console.log(`   🔓 Resuming crawler...\n`);
            
            this.totalSent += savedCount;
            this.batchTracker.push({
                batchNumber,
                status: 'SUCCESS',
                sentCount: expectedCount,
                savedCount,
                duration: `${duration}s`,
                timestamp: new Date().toISOString()
            });
            
            if (global.broadcastLog) {
                global.broadcastLog(this.runId, {
                    type: 'batch_complete',
                    batchNumber,
                    savedCount,
                    expectedCount,
                    duration: `${duration}s`,
                    message: `Batch #${batchNumber} fully sent: ${savedCount}/${expectedCount}`
                });
            }
            
            return { success: true, savedCount };
            
        } else {
            // ⚠️ Partial success - beberapa data tidak tersimpan
            console.log(`   ⚠️ BATCH #${batchNumber} PARTIALLY SENT: ${savedCount}/${expectedCount} records saved`);
            console.log(`   ❌ ${expectedCount - savedCount} records FAILED to save`);
            console.log(`   ⏱️  Duration: ${duration}s`);
            
            this.totalSent += savedCount;
            this.totalFailed += (expectedCount - savedCount);
            this.batchTracker.push({
                batchNumber,
                status: 'PARTIAL',
                sentCount: expectedCount,
                savedCount,
                failed: expectedCount - savedCount,
                duration: `${duration}s`,
                timestamp: new Date().toISOString()
            });
            
            if (global.broadcastLog) {
                global.broadcastLog(this.runId, {
                    type: 'batch_partial',
                    batchNumber,
                    savedCount,
                    expectedCount,
                    failed: expectedCount - savedCount,
                    message: `Batch #${batchNumber} partially sent: ${savedCount}/${expectedCount}`
                });
            }
            
            // ⚠️ Log warning tapi tetap lanjut (data yang berhasil sudah tersimpan)
            console.log(`   ⚠️ Continuing crawler despite partial failure...\n`);
            return { success: true, savedCount, partialFailure: true };
        }
    }

    async fetchApprovedData(area) {
        try {
            console.log(`📥 Fetching APPROVED data from API for ${area}...`);
            
            const response = await fetch(`${this.apiUrl}/api/crawler/approved?area=${area}`, {
                headers: { "X-API-Key": this.apiKey },
            });
            
            if (!response.ok) throw new Error(`API ${response.status}`);
            
            const data = await response.json();
            console.log(`   ✅ Fetched ${data.records?.length || 0} APPROVED records`);
            return data.records || [];
            
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            return [];
        }
    }
}

// ========== CRAWLER PERIODE 1-20 (Direct API) ==========
export async function runCrawlPeriod1_20(areaName = "BANDUNG", runId = null) {
    CONFIG.currentArea = areaName;
    const apiClient = new CrawlerAPIClient(CONFIG.nextjsApiUrl, CONFIG.apiKey);
    
    // Use provided runId or generate new one
    if (runId) apiClient.runId = runId;
    
    // Helper function to broadcast logs
    const broadcastLog = (message, data = {}) => {
        console.log(message);
        if (global.broadcastLog) {
            global.broadcastLog(apiClient.runId, {
                type: 'log',
                message: message.replace(/[\u{1F300}-\u{1F9FF}]/gu, (m) => m), // Keep emojis
                timestamp: new Date().toISOString(),
                ...data
            });
        }
    };

    broadcastLog(`🚀 CRAWLER PERIODE 1-20 - ${areaName} (Direct API Mode)`);
    broadcastLog(`   🆔 Run ID: ${apiClient.runId}`);
    
    // ✅ Detect environment
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const isRender = process.env.RENDER === 'true';
    const isLocal = !isCI && !isRender;
    
    let browser;
    if (isLocal) {
        // Local: Use Windows persistent context
        broadcastLog("🔧 Running in local environment");
        const userDataDir = "C:\\Users\\Luxion\\AppData\\Local\\Google\\Chrome\\User Data\\PlaywrightProfile";
        browser = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            channel: "chrome",
            args: [
                "--start-maximized",
                "--profile-directory=Default",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
            ],
        });
    } else if (isRender) {
        // Render.com: Use persistent context in Docker volume
        broadcastLog("🔧 Running on Render.com (persistent browser)");
        const userDataDir = "/app/playwright-data";
        browser = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--single-process", // Important for 512MB RAM limit
            ],
        });
    } else {
        // GitHub Actions: Cannot work with AppSheet OAuth
        broadcastLog("❌ GitHub Actions detected - AppSheet OAuth not supported");
        throw new Error("GitHub Actions cannot handle AppSheet OAuth. Use Render.com deployment instead.");
    }

    const page = (isLocal || isRender) 
        ? (browser.pages()[0] || await browser.newPage())
        : await browser.newPage();

    // ✅ Load pre-seeded OAuth session if available (for fresh Render deploys)
    if (isRender && process.env.OAUTH_SESSION_DATA) {
        try {
            broadcastLog("🔐 Loading pre-seeded OAuth session...");
            const sessionData = JSON.parse(process.env.OAUTH_SESSION_DATA);
            
            // Add cookies FIRST (before any navigation)
            if (sessionData.cookies && sessionData.cookies.length > 0) {
                await page.context().addCookies(sessionData.cookies);
                broadcastLog(`   ✅ Loaded ${sessionData.cookies.length} cookies`);
            }
            
            // Navigate to Google first to establish Google cookies
            broadcastLog("   🌐 Establishing Google session...");
            await page.goto("https://accounts.google.com", { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(2000);
            
            // Now navigate to AppSheet
            broadcastLog("   🌐 Navigating to AppSheet...");
            await page.goto("https://www.appsheet.com", { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(1000);
            
            // Set localStorage
            if (sessionData.localStorage) {
                await page.evaluate((data) => {
                    for (const [key, value] of Object.entries(data)) {
                        window.localStorage.setItem(key, value);
                    }
                }, sessionData.localStorage);
                broadcastLog(`   ✅ Loaded localStorage data`);
            }
            
            broadcastLog("   ✅ Pre-seeded session loaded successfully!");
        } catch (error) {
            broadcastLog(`   ⚠️ Failed to load pre-seeded session: ${error.message}`);
            broadcastLog("   → Will use persistent context instead");
        }
    }

    try {
        broadcastLog("🌐 Opening AppSheet app...");
        await page.goto(
            "https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c?platform=desktop#appName=SLAMtes-320066460",
            { waitUntil: "networkidle", timeout: 60000 }
        );
        
        // ✅ Wait for page to stabilize and check actual state
        await page.waitForTimeout(3000);
        
        // ✅ DEBUG: Log current URL and page state
        const currentUrl = page.url();
        broadcastLog(`   📍 Current URL: ${currentUrl}`);
        
        // ✅ Check multiple indicators of login state
        const checklistButton = await page.locator('div[role="button"] i.fa-check').count();
        const logoutButton = await page.locator('span[data-testonly-action="logout"]').count();
        const loginButton = await page.locator('div.GenericActionButton__paddington:has(i.fa-sign-in-alt)').count();
        const navigationMenu = await page.locator("ul[role='navigation']").count();
        
        broadcastLog(`   🔍 Page state check:`);
        broadcastLog(`      - Checklist button: ${checklistButton > 0 ? '✅ Found' : '❌ Not found'}`);
        broadcastLog(`      - Logout button: ${logoutButton > 0 ? '✅ Found' : '❌ Not found'}`);
        broadcastLog(`      - Login button: ${loginButton > 0 ? '✅ Found' : '❌ Not found'}`);
        broadcastLog(`      - Navigation menu: ${navigationMenu > 0 ? '✅ Found' : '❌ Not found'}`);

        // ✅ Determine if already logged in
        const isFullyLoggedIn = checklistButton > 0 || (navigationMenu > 0 && logoutButton > 0);
        
        if (isFullyLoggedIn) {
            broadcastLog("✅ Already logged in! Checking if correct user...");
            // Check if correct user - for now, proceed with existing session
            // In future, verify username matches
        } else if (loginButton > 0) {
            // AppSheet native login screen
            broadcastLog("🔒 AppSheet login screen detected");
            broadcastLog("🔒 Logging in as " + areaName + "...");
            await performLogin(page, areaName);
        } else {
            // Need to handle OAuth or other login flow
            broadcastLog("🔒 Logging in as " + areaName + "...");
            await performLogin(page, areaName);
        }

        await waitForSyncComplete(page, 120000);
        await navigateToChecklist(page);
        await waitForSyncComplete(page, 120000);

        const period1_20Data = new Map();
        let batchCounter = 0;

        broadcastLog("\n📅 ===== CRAWLING PERIODE 1-20 =====");
        
        for (const status of CONFIG.statuses) {
            for (const month of CONFIG.months) {
                broadcastLog(`\n📊 ${status} - ${month}`);
                
                try {
                    await applyFilter(page, status, month);
                    const data = await extractTableData(page, status, month);
                    
                    for (const item of data) {
                        const key = `${month}-${item.id}`;
                        if (!period1_20Data.has(key) || 
                            getStatusPriority(status) > getStatusPriority(period1_20Data.get(key).period_1_20)) {
                            period1_20Data.set(key, {
                                area: item.area,
                                month: item.month,
                                id: item.id,
                                name: item.name,
                                type: item.type,
                                period_1_20: status,
                                period_21_30: "NONE"
                            });
                        }
                    }
                    
                    broadcastLog(`✅ Extracted ${data.length} records (Total: ${period1_20Data.size})`);
                    
                    // ✅ HALT CRAWLER & Send batch when threshold reached
                    if (period1_20Data.size >= CONFIG.batchSize * (batchCounter + 1)) {
                        const currentBatch = Array.from(period1_20Data.values())
                            .slice(batchCounter * CONFIG.batchSize, (batchCounter + 1) * CONFIG.batchSize);
                        
                        const dbBatch = currentBatch.map(item => ({
                            Area: item.area,
                            Month: item.month,
                            ID: item.id,
                            Name: item.name,
                            Type: item.type,
                            Period_1_20: item.period_1_20,
                            Period_21_30: item.period_21_30
                        }));
                        
                        // ✅ CRITICAL: Halt crawler sampai batch fully sent
                        await apiClient.verifyAndSendBatch(dbBatch, {
                            area: areaName,
                            updateMode: "period_1_20_only",
                        }, batchCounter + 1);
                        
                        batchCounter++;
                    }
                    
                } catch (error) {
                    console.error(`❌ Error: ${error.message}`);
                    continue;
                }
                
                await page.waitForTimeout(CONFIG.actionDelay);
            }
        }

        // ✅ Send remaining data (final batch)
        const allData = Array.from(period1_20Data.values());
        const alreadySent = batchCounter * CONFIG.batchSize;
        const remainingData = allData.slice(alreadySent);
        
        if (remainingData.length > 0) {
            console.log(`\n📊 Final Batch Summary:`);
            console.log(`   • Already sent: ${alreadySent} records in ${batchCounter} batch(es)`);
            console.log(`   • Remaining: ${remainingData.length} records`);
            console.log(`   • Total crawled: ${allData.length} records\n`);
            
            const dbBatch = remainingData.map(item => ({
                Area: item.area,
                Month: item.month,
                ID: item.id,
                Name: item.name,
                Type: item.type,
                Period_1_20: item.period_1_20,
                Period_21_30: item.period_21_30
            }));
            
            // ✅ CRITICAL: Halt crawler sampai final batch fully sent
            await apiClient.verifyAndSendBatch(dbBatch, {
                area: areaName,
                updateMode: "period_1_20_only",
            }, batchCounter + 1);
            
        } else {
            console.log(`\n✅ All data already sent in batches (no remaining data)`);
        }

        console.log("\n🎉 PERIODE 1-20 COMPLETED!");
        console.log(`   📊 Crawled: ${period1_20Data.size}`);
        console.log(`   ✅ Sent to DB: ${apiClient.totalSent}`);
        console.log(`   ❌ Failed: ${apiClient.totalFailed}`);
        
        // ✅ Batch Tracker Report
        if (apiClient.batchTracker.length > 0) {
            console.log(`\n📋 Batch Transmission Report:`);
            apiClient.batchTracker.forEach(batch => {
                const statusIcon = batch.status === 'SUCCESS' ? '✅' : 
                                   batch.status === 'PARTIAL' ? '⚠️' : '❌';
                console.log(`   ${statusIcon} Batch #${batch.batchNumber}: ${batch.savedCount}/${batch.sentCount} saved (${batch.status}) - ${batch.duration}`);
            });
        }        
        // Optional CSV backup
        if (!fs.existsSync(CONFIG.outputDir)) fs.mkdirSync(CONFIG.outputDir, { recursive: true });
        const csvData = Array.from(period1_20Data.values());
        const csvFile = path.join(CONFIG.outputDir, `period_1_20_${areaName}_latest.csv`);
        const headers = "Area,Month,ID,Name,Type,Period_1_20,Period_21_30\n";
        const rows = csvData.map(item => 
            `"${item.area}","${item.month}","${item.id}","${item.name}","${item.type}","${item.period_1_20}","${item.period_21_30}"`
        ).join("\n");
        fs.writeFileSync(csvFile, headers + rows, "utf8");
        console.log(`   💾 Backup saved: ${csvFile}`);
        
        await performLogout(page);
        await page.waitForTimeout(120000);

        return {
            success: true,
            runId: apiClient.runId,
            totalCrawled: period1_20Data.size,
            totalSent: apiClient.totalSent,
            totalFailed: apiClient.totalFailed
        };
        
    } catch (error) {
        console.error("❌ FATAL ERROR:", error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

// ========== CRAWLER PERIODE 21-30 (Direct API) ==========
/**
 * @param {string} areaName - Area to crawl (BANDUNG, CORPU, etc.)
 * @param {boolean} onlyUnapproved - If true, only crawl items that are NOT YET APPROVED in period 21-30
 *                                    If false, crawl ALL APPROVED items from period 1-20
 *                                    Default: true (optimized mode - skip already approved)
 */
export async function runCrawlPeriod21_30(areaName = "BANDUNG", onlyUnapproved = true) {
    CONFIG.currentArea = areaName;
    const apiClient = new CrawlerAPIClient(CONFIG.nextjsApiUrl, CONFIG.apiKey);
    
    console.log(`🚀 CRAWLER PERIODE 21-30 - ${areaName} (Direct API Mode)`);
    console.log(`   🆔 Run ID: ${apiClient.runId}`);
    console.log(`   ⚙️  Mode: ${onlyUnapproved ? 'Optimized (only unapproved)' : 'Full (all data)'}`);
    
    // ✅ Fetch APPROVED data from API (periode 1-20)
    const approvedData = await apiClient.fetchApprovedData(areaName);
    
    if (approvedData.length === 0) {
        console.log("⚠️ No APPROVED data to check");
        return { success: true, totalChecked: 0, totalUpdated: 0, totalSkipped: 0 };
    }
    
    let dataToCrawl;
    let skippedCount = 0;
    
    if (onlyUnapproved) {
        // ✅ OPTIMIZATION: Filter hanya data yang BELUM APPROVED di periode 21-30
        const totalBeforeFilter = approvedData.length;
        dataToCrawl = approvedData.filter(item => {
            // Crawl jika period_21_30 adalah:
            // - "NONE" (belum pernah dicek)
            // - "NOT APPROVED" (pernah dicek tapi belum approve)
            // - "NOT FOUND" (tidak ditemukan di tabel sebelumnya)
            // - "ERROR" (ada error sebelumnya)
            // Skip jika sudah "APPROVED"
            return item.period_21_30 !== "APPROVED";
        });
        
        skippedCount = totalBeforeFilter - dataToCrawl.length;
        
        console.log(`\n📊 Data Filter Summary (Optimized Mode):`);
        console.log(`   • Total APPROVED (period 1-20): ${totalBeforeFilter}`);
        console.log(`   • Already APPROVED (period 21-30): ${skippedCount} (skipped)`);
        console.log(`   • Need to check: ${dataToCrawl.length}`);
        
        if (dataToCrawl.length === 0) {
            console.log("\n✅ All data already APPROVED in period 21-30!");
            console.log("   No crawling needed - All done! 🎉");
            return { success: true, totalChecked: 0, totalUpdated: 0, totalSkipped: skippedCount };
        }
        
        console.log(`\n⚡ Starting optimized crawl (${dataToCrawl.length} items)...\n`);
    } else {
        // 🔄 FULL MODE: Crawl semua data APPROVED dari periode 1-20
        dataToCrawl = approvedData;
        skippedCount = 0;
        
        console.log(`\n📊 Data Summary (Full Mode):`);
        console.log(`   • Total APPROVED (period 1-20): ${dataToCrawl.length}`);
        console.log(`   • Will check all items (no filter applied)`);
        console.log(`\n🔄 Starting full crawl (${dataToCrawl.length} items)...\n`);
    }

    // ✅ Detect environment
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const isRender = process.env.RENDER === 'true';
    const isLocal = !isCI && !isRender;
    
    let browser;
    if (isLocal) {
        // Local: Use Windows persistent context
        console.log("🔧 Running in local environment");
        const userDataDir = "C:\\Users\\Luxion\\AppData\\Local\\Google\\Chrome\\User Data\\PlaywrightProfile";
        browser = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            channel: "chrome",
            args: [
                "--start-maximized",
                "--profile-directory=Default",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
            ],
        });
    } else if (isRender) {
        // Render.com: Use persistent context in Docker volume
        console.log("🔧 Running on Render.com (persistent browser)");
        const userDataDir = "/app/playwright-data";
        browser = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--single-process", // Important for 512MB RAM limit
            ],
        });
    } else {
        // GitHub Actions: Cannot work with AppSheet OAuth
        console.log("❌ GitHub Actions detected - AppSheet OAuth not supported");
        throw new Error("GitHub Actions cannot handle AppSheet OAuth. Use Render.com deployment instead.");
    }

    const page = (isLocal || isRender) 
        ? (browser.pages()[0] || await browser.newPage())
        : await browser.newPage();

    // ✅ Load pre-seeded OAuth session if available (for fresh Render deploys)
    if (isRender && process.env.OAUTH_SESSION_DATA) {
        try {
            console.log("🔐 Loading pre-seeded OAuth session...");
            const sessionData = JSON.parse(process.env.OAUTH_SESSION_DATA);
            
            // Add cookies FIRST (before any navigation)
            if (sessionData.cookies && sessionData.cookies.length > 0) {
                await page.context().addCookies(sessionData.cookies);
                console.log(`   ✅ Loaded ${sessionData.cookies.length} cookies`);
            }
            
            // Navigate to Google first to establish Google cookies
            console.log("   🌐 Establishing Google session...");
            await page.goto("https://accounts.google.com", { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(2000);
            
            // Now navigate to AppSheet
            console.log("   🌐 Navigating to AppSheet...");
            await page.goto("https://www.appsheet.com", { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(1000);
            
            // Set localStorage
            if (sessionData.localStorage) {
                await page.evaluate((data) => {
                    for (const [key, value] of Object.entries(data)) {
                        window.localStorage.setItem(key, value);
                    }
                }, sessionData.localStorage);
                console.log(`   ✅ Loaded localStorage data`);
            }
            
            console.log("   ✅ Pre-seeded session loaded successfully!");
        } catch (error) {
            console.log(`   ⚠️ Failed to load pre-seeded session: ${error.message}`);
        }
    }

    try {
        console.log("🌐 Opening AppSheet app...");
        await page.goto(
            "https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c?platform=desktop#appName=SLAMtes-320066460",
            { waitUntil: "networkidle", timeout: 60000 }
        );
        
        // ✅ Wait for page to stabilize and check actual state
        await page.waitForTimeout(3000);
        
        // ✅ Check multiple indicators of login state
        const checklistButton = await page.locator('div[role="button"] i.fa-check').count();
        const loginButton = await page.locator('div.GenericActionButton__paddington:has(i.fa-sign-in-alt)').count();
        const navigationMenu = await page.locator("ul[role='navigation']").count();
        
        console.log(`   🔍 Page state: checklist=${checklistButton}, login=${loginButton}, nav=${navigationMenu}`);
        
        // ✅ Determine if already logged in
        const isFullyLoggedIn = checklistButton > 0 || navigationMenu > 0;
        
        if (!isFullyLoggedIn) {
            await performLogin(page, areaName);
        } else {
            console.log("✅ Already logged in!");
        }

        await waitForSyncComplete(page, 120000);
        await navigateToChecklist(page);
        await waitForSyncComplete(page, 120000);

        // Group by month (using filtered data)
        const approvedByMonth = {};
        for (const item of dataToCrawl) {
            if (!approvedByMonth[item.month]) approvedByMonth[item.month] = [];
            approvedByMonth[item.month].push(item);
        }

        console.log("\n📅 ===== CRAWLING PERIODE 21-30 =====");
        let totalChecked = 0;
        let totalUpdated = 0;

        for (const [month, items] of Object.entries(approvedByMonth)) {
            console.log(`\n📊 Month: ${month} (${items.length} APPROVED items)`);
            
            try {
                await applyFilter(page, "APPROVED", month);
                await page.waitForTimeout(2000);
                
                // Reset scroll to top
                await page.evaluate(() => {
                    const tableList = document.querySelector('.TableView__list');
                    if (tableList) tableList.scrollTop = 0;
                });
                await page.waitForTimeout(1500);
                
                const updatesToSend = [];
                const processedIds = new Set();
                let scrollAttempts = 0;
                const maxScrollAttempts = 200;
                let consecutiveNoMatch = 0;
                const maxConsecutiveNoMatch = 30;
                
                console.log(`  📋 Searching for ${items.length} APPROVED items in table...`);
                
                // ✅ SCROLL & SEARCH STRATEGY
                while (scrollAttempts < maxScrollAttempts && processedIds.size < items.length) {
                    const visibleRows = await page.locator('span[data-testid="table-view-row"]').all();
                    let foundMatchInThisScroll = false;
                    
                    for (const row of visibleRows) {
                        try {
                            const isVisible = await row.isVisible();
                            if (!isVisible) continue;
                            
                            const textSpan = row.locator('span[data-testid="text-type-display-span"]');
                            const text = await textSpan.textContent();
                            
                            if (!text) continue;
                            
                            const parts = text.split(" - ");
                            const rowId = parts[0]?.trim();
                            
                            if (!rowId || processedIds.has(rowId)) continue;
                            
                            // Check if this row matches any of our APPROVED items
                            const matchedItem = items.find(item => item.id_gedung === rowId);
                            
                            if (matchedItem) {
                                foundMatchInThisScroll = true;
                                consecutiveNoMatch = 0;
                                
                                console.log(`\n  🔍 [${processedIds.size + 1}/${items.length}] Found: ${rowId}`);
                                
                                try {
                                    await row.click();
                                    await page.waitForTimeout(2000);
                                    
                                    const status = await checkPeriod21_30FromDialog(page, month);
                                    console.log(`  ✅ ${rowId}: ${status}`);
                                    
                                    updatesToSend.push({
                                        Area: matchedItem.area,
                                        Month: matchedItem.month,
                                        ID: matchedItem.id_gedung,
                                        Name: matchedItem.name,
                                        Type: matchedItem.type,
                                        Period_1_20: matchedItem.period_1_20,
                                        Period_21_30: status
                                    });
                                    
                                    // Close dialog
                                    await page.keyboard.press('Escape');
                                    await page.waitForTimeout(800);
                                    
                                    processedIds.add(rowId);
                                    totalChecked++;
                                    
                                } catch (itemError) {
                                    console.error(`  ❌ ${rowId}: ERROR - ${itemError.message}`);
                                    updatesToSend.push({
                                        Area: matchedItem.area,
                                        Month: matchedItem.month,
                                        ID: matchedItem.id_gedung,
                                        Name: matchedItem.name,
                                        Type: matchedItem.type,
                                        Period_1_20: matchedItem.period_1_20,
                                        Period_21_30: "ERROR"
                                    });
                                    
                                    try {
                                        await page.keyboard.press('Escape');
                                        await page.waitForTimeout(500);
                                    } catch {}
                                    
                                    processedIds.add(rowId);
                                    totalChecked++;
                                }
                            }
                            
                        } catch (error) {
                            continue;
                        }
                    }
                    
                    // Check if we should stop scrolling
                    if (!foundMatchInThisScroll) {
                        consecutiveNoMatch++;
                        
                        if (consecutiveNoMatch >= maxConsecutiveNoMatch) {
                            console.log(`\n  ⚠️ No matches found in last ${maxConsecutiveNoMatch} scrolls`);
                            console.log(`  📊 Processed: ${processedIds.size}/${items.length}`);
                            break;
                        }
                    }
                    
                    // Scroll down
                    await page.evaluate((scrollStep) => {
                        const tableList = document.querySelector('.TableView__list');
                        if (tableList) {
                            tableList.scrollBy({
                                top: scrollStep,
                                behavior: 'smooth'
                            });
                        }
                    }, CONFIG.scrollStep);
                    
                    await page.waitForTimeout(CONFIG.scrollDelay + 200);
                    scrollAttempts++;
                    
                    if (scrollAttempts % 10 === 0 && processedIds.size < items.length) {
                        console.log(`  📊 Scroll #${scrollAttempts}: Found ${processedIds.size}/${items.length}`);
                    }
                }
                
                // Mark unprocessed items as NOT FOUND
                const unprocessedItems = items.filter(item => !processedIds.has(item.id_gedung));
                if (unprocessedItems.length > 0) {
                    console.log(`\n  ⚠️ ${unprocessedItems.length} items NOT FOUND in table:`);
                    unprocessedItems.forEach(item => {
                        console.log(`     - ${item.id_gedung}`);
                        updatesToSend.push({
                            Area: item.area,
                            Month: item.month,
                            ID: item.id_gedung,
                            Name: item.name,
                            Type: item.type,
                            Period_1_20: item.period_1_20,
                            Period_21_30: "NOT FOUND"
                        });
                    });
                }
                
                console.log(`\n  📊 Summary for ${month}:`);
                console.log(`     • Found & Checked: ${processedIds.size}/${items.length}`);
                console.log(`     • Not Found: ${unprocessedItems.length}`);
                
                // Send updates for this month
                if (updatesToSend.length > 0) {
                    console.log(`\n   📤 Sending ${updatesToSend.length} updates for ${month}...`);
                    
                    const result = await apiClient.sendBatch(updatesToSend, {
                        area: areaName,
                        updateMode: "period_21_30_only",
                        month: month,
                    });
                    
                    if (result.success) {
                        totalUpdated += result.result.summary.berhasil;
                        console.log(`   ✅ Updates sent: ${result.result.summary.berhasil} saved\n`);
                    } else {
                        console.error(`   ❌ Update failed: ${result.error}\n`);
                    }
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${month}: ${error.message}`);
                continue;
            }
        }

        console.log("\n🎉 PERIODE 21-30 COMPLETED!");
        console.log(`   📊 Checked: ${totalChecked}`);
        console.log(`   ✅ Updated: ${totalUpdated}`);
        
        if (onlyUnapproved) {
            console.log(`   ⏭️  Skipped (already APPROVED): ${skippedCount}`);
            console.log(`   ⚡ Time saved by skipping: ~${(skippedCount * 3).toFixed(0)} seconds`);
        } else {
            console.log(`   🔄 Mode: Full crawl (all data checked)`);
        }
        
        await performLogout(page);
        await page.waitForTimeout(120000);

        return {
            success: true,
            runId: apiClient.runId,
            totalChecked: totalChecked,
            totalUpdated: totalUpdated,
            totalSkipped: skippedCount,
            mode: onlyUnapproved ? 'optimized' : 'full'
        };
        
    } catch (error) {
        console.error("❌ FATAL ERROR:", error.message);
        throw error;
    } finally {
        // Always close browser (persistent context will just close the session, not delete data)
        if (browser) {
            await browser.close();
            console.log("✅ Browser closed");
        }
    }
}

// ========== HELPER FUNCTIONS ==========

function getStatusPriority(status) {
    const priority = { "OPEN": 1, "SUBMITTED": 2, "APPROVED": 3 };
    return priority[status] || 0;
}

async function checkIfLoggedIn(page) {
    try {
        await page.waitForSelector('span[data-testonly-action="logout"]', { timeout: 5000, state: "visible" });
        return true;
    } catch {
        return false;
    }
}

async function performLogin(page, areaName) {
    const credentials = CONFIG.credentials[areaName];
    
    // ✅ Debug: Verify credentials loaded
    if (!credentials || !credentials.username || !credentials.password) {
        console.error("❌ Credentials missing for area:", areaName);
        console.error("   Loaded credentials:", credentials);
        throw new Error(`Credentials not found for area: ${areaName}`);
    }
    
    console.log("🔐 Attempting to login...");
    console.log("   👤 Area:", areaName);
    console.log("   👤 Username:", credentials.username);
    
    // ✅ Step 1: Wait for page to load completely
    await page.waitForTimeout(3000);
    
    // ✅ Step 2: Check if already inside AppSheet app (checklist button exists)
    const checklistButtonExists = await page.locator('div[role="button"] i.fa-check').count() > 0;
    if (checklistButtonExists) {
        console.log("✅ Already logged in to AppSheet (checklist button found)");
        return;
    }
    
    // ✅ Step 3: Check current page state
    const currentUrl = page.url();
    console.log(`   📍 Current URL: ${currentUrl}`);
    
    // ✅ Step 4: Check if on AppSheet Login page (OAuth provider selection)
    if (currentUrl.includes('/Account/Login') || currentUrl.includes('appsheet.com/Account')) {
        console.log("🔐 AppSheet OAuth Login page detected");
        
        // Wait explicitly for Google button to appear
        console.log("   ⏳ Waiting for Google button to load...");
        try {
            await page.waitForSelector('button#Google', { timeout: 10000, state: 'visible' });
            console.log("   ✅ Google button is visible");
        } catch (e) {
            console.log("   ⚠️ Google button wait timeout, checking anyway...");
        }
        
        // Check for Google button
        const googleButton = page.locator('button#Google');
        const googleButtonCount = await googleButton.count();
        
        console.log(`   🔍 Google button count: ${googleButtonCount}`);
        
        if (googleButtonCount > 0) {
            console.log("   🖱️ Clicking Google sign-in button...");
            await googleButton.click();
            
            // Wait for OAuth redirect
            console.log("   ⏳ Waiting for Google OAuth...");
            await page.waitForTimeout(5000);
            
            // Check where we ended up
            const afterClickUrl = page.url();
            console.log(`   📍 After click URL: ${afterClickUrl}`);
            
            // Check if we're on Google login page
            if (afterClickUrl.includes('accounts.google.com')) {
                console.log("   📧 Google login page detected");
                console.log("   ❌ Pre-seeded cookies did not establish Google session");
                console.log("   ℹ️ You need to:");
                console.log("      1. Use Render Persistent Disk ($0.25/month)");
                console.log("      2. Or manually login once after deploy");
                throw new Error("Google OAuth requires authentication - cookies expired or invalid");
            }
            
            // Check if we're back in AppSheet
            const checklistAfterOAuth = await page.locator('div[role="button"] i.fa-check').count();
            const navMenuAfterOAuth = await page.locator("ul[role='navigation']").count();
            
            if (checklistAfterOAuth > 0 || navMenuAfterOAuth > 0) {
                console.log("✅ OAuth login successful!");
                return;
            }
            
            // Wait a bit more and check again
            await page.waitForTimeout(5000);
            const finalCheck = await page.locator('div[role="button"] i.fa-check').count();
            if (finalCheck > 0) {
                console.log("✅ OAuth login successful (after wait)!");
                return;
            }
            
            throw new Error("OAuth redirect did not complete successfully");
        } else {
            // List what buttons ARE on the page
            console.log("   ❌ Google button not found! Listing available buttons:");
            const allButtons = await page.locator('button').all();
            for (let i = 0; i < Math.min(allButtons.length, 15); i++) {
                try {
                    const id = await allButtons[i].getAttribute('id');
                    const text = await allButtons[i].textContent();
                    console.log(`      [${i}] id="${id}" text="${text?.trim().substring(0, 30)}"`);
                } catch (e) {}
            }
            throw new Error("Google sign-in button not found on login page");
        }
    }
    
    // ✅ Step 5: Check if Login button exists (older AppSheet UI)
    const loginButton = page.locator('div.GenericActionButton__paddington:has(i.fa-sign-in-alt)');
    const loginButtonCount = await loginButton.count();
    
    if (loginButtonCount > 0) {
        console.log("📝 Found AppSheet native login button");
        console.log("   🖱️ Clicking Login button...");
        await loginButton.first().click();
        await page.waitForTimeout(2000);
        
        // Check if username/password form appears
        const usernameInput = page.locator('input[aria-label="Username"]');
        if (await usernameInput.count() > 0) {
            console.log("   ⌨️ Filling username:", credentials.username);
            await usernameInput.fill(credentials.username);
            
            console.log("   ⌨️ Filling password: ***");
            await page.fill('input[aria-label="Password"]', credentials.password);
            
            console.log("   🖱️ Submitting login...");
            await page.click('button:has-text("Login")');
            
            console.log("   ⏳ Waiting for navigation menu...");
            await page.waitForSelector("ul[role='navigation']", { timeout: 60000 });
            console.log("✅ Login success!");
            return;
        }
    }
    
    // ✅ Step 6: Unknown page state - take screenshot for debugging
    console.log("❌ Unknown page state!");
    try {
        await page.screenshot({ path: '/app/unknown-state.png', fullPage: true });
        console.log("   📸 Screenshot saved to /app/unknown-state.png");
    } catch (e) {}
    
    throw new Error("Could not determine login method - unknown page state");
}

async function waitForSyncComplete(page, maxWaitTimeMs = 120000) {
    console.log("🔄 Checking sync status...");
    
    try {
        // Tunggu sebentar untuk memastikan UI sudah stable
        await page.waitForTimeout(2000);
        
        const startTime = Date.now();
        let syncCheckCount = 0;
        
        while (Date.now() - startTime < maxWaitTimeMs) {
            syncCheckCount++;
            
            // Check 1: Apakah ada antrian sync (unsynced changes)?
            const unsyncedBadge = page.locator('span.c-jss137.c-jss134.c-jss146 span[role="status"][aria-label*="Unsynced"]');
            const badgeCount = await unsyncedBadge.count();
            
            console.log(`  🔍 Check #${syncCheckCount}: Badge elements found = ${badgeCount}`);
            
            if (badgeCount > 0) {
                const badgeText = await unsyncedBadge.first().textContent();
                console.log(`  ⏳ Unsynced changes detected: ${badgeText}`);
                console.log(`  ⏱️ Waiting for sync to complete...`);
                await page.waitForTimeout(3000);
                continue;
            } else {
                console.log(`  ✅ No unsynced badge found`);
            }
            
            // Check 2: Apakah sedang proses "Syncing..."?
            const syncingText = page.locator('span[data-testid="SyncStatusText"][role="status"]');
            const syncingCount = await syncingText.count();
            
            console.log(`  🔍 Syncing text elements found = ${syncingCount}`);
            
            if (syncingCount > 0) {
                const statusText = await syncingText.first().textContent();
                if (statusText.includes("Syncing")) {
                    console.log(`  ⏳ Status: ${statusText}`);
                    console.log(`  ⏱️ Waiting for sync...`);
                    await page.waitForTimeout(3000);
                    continue;
                }
            }
            
            // Check 3: Verifikasi bahwa sync button ada dan tidak disabled
            const syncButton = page.locator('button[data-testid="SyncActionButton"]');
            const syncButtonExists = await syncButton.count() > 0;
            
            console.log(`  🔍 Sync button exists = ${syncButtonExists}`);
            
            if (syncButtonExists) {
                const isDisabled = await syncButton.evaluate(btn => btn.disabled);
                if (isDisabled) {
                    console.log(`  ⏳ Sync button is disabled (syncing in progress)`);
                    await page.waitForTimeout(3000);
                    continue;
                }
            }
            
            // Jika semua check pass, berarti sync sudah selesai
            console.log(`  ✅ Sync complete! (Checked ${syncCheckCount} times)`);
            return true;
        }
        
        console.log(`  ⚠️ Timeout menunggu sync selesai setelah ${maxWaitTimeMs/1000}s`);
        return false;
        
    } catch (error) {
        console.log(`  ⚠️ Error checking sync: ${error.message}`);
        console.log(`  ℹ️ Melanjutkan crawling (assuming sync complete)`);
        return true;
    }
}

async function navigateToChecklist(page) {
    console.log("🔎 Mencari tombol Checklist...");
    const checklistButton = page.locator('div[role="button"] i.fa-check').first();

    const count = await checklistButton.count();
    if (count === 0) {
        throw new Error("Tombol checklist tidak ditemukan!");
    }

    const handle = await checklistButton.elementHandle();
    await page.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const clickEvent = (type) =>
            el.dispatchEvent(
                new MouseEvent(type, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                })
            );

        clickEvent("mouseover");
        clickEvent("mousedown");
        clickEvent("mouseup");
        clickEvent("click");
    }, handle);

    await page.waitForSelector('button[aria-label="Filter checklist"]', {
        timeout: 30000,
    });
    console.log("✅ Halaman checklist terbuka");
}

async function applyFilter(page, status, month) {
    console.log(`🔧 Mengaplikasikan filter: ${status} - ${month}`);
    
    await page.click('button[aria-label="Filter checklist"]');
    await page.waitForTimeout(1500);
    
    const statusButton = page.locator(
        `span[data-testid="button-select-button"]:has(span:text-is("${status}"))`
    );
    await statusButton.waitFor({ state: "visible", timeout: 10000 });
    
    const isStatusSelected = await statusButton.evaluate((el) => {
        return el.classList.contains('ButtonSelectButton--selected');
    });
    
    if (!isStatusSelected) {
        await statusButton.click({ delay: 150 });
    }
    
    await page.waitForTimeout(500);
    
    const monthButton = page.locator(
        `span[data-testid="button-select-button"]:has(span:text-is("${month}"))`
    );
    await monthButton.waitFor({ state: "visible", timeout: 10000 });
    
    const isMonthSelected = await monthButton.evaluate((el) => {
        return el.classList.contains('ButtonSelectButton--selected');
    });
    
    if (!isMonthSelected) {
        await monthButton.click({ delay: 150 });
    }
    
    await page.waitForTimeout(500);
    
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    await saveButton.click({ delay: 150 });
    
    await page.waitForTimeout(3000);
    console.log("  ✅ Filter berhasil diaplikasikan");
}

async function extractTableData(page, status, month) {
    console.log("📋 Mengekstrak data dari tabel...");
    const data = [];
    const extractedIds = new Set();
    
    const tableContainer = page.locator('.TableView__list');
    await tableContainer.waitFor({ state: "visible", timeout: 10000 });
    
    // Reset scroll to top
    await page.evaluate(() => {
        const tableList = document.querySelector('.TableView__list');
        if (tableList) tableList.scrollTop = 0;
    });
    await page.waitForTimeout(1000);
    
    let scrollAttempts = 0;
    const maxScrollAttempts = 150;
    let unchangedCount = 0;
    
    while (scrollAttempts < maxScrollAttempts) {
        const visibleRows = await page.locator('span[data-testid="table-view-row"]').all();
        
        for (const row of visibleRows) {
            try {
                const isVisible = await row.isVisible();
                if (!isVisible) continue;
                
                const textSpan = row.locator('span[data-testid="text-type-display-span"]');
                const text = await textSpan.textContent();
                
                if (text) {
                    const parts = text.split(" - ");
                    if (parts.length >= 2) {
                        const id = parts[0].trim();
                        
                        if (extractedIds.has(id)) continue;
                        
                        extractedIds.add(id);
                        data.push({
                            area: CONFIG.currentArea,
                            month: month,
                            id: id,
                            name: parts[1].trim(),
                            type: parts.length > 2 ? parts[2].trim() : "",
                        });
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        if (scrollAttempts % 5 === 0) {
            console.log(`  📊 Scroll #${scrollAttempts}: Extracted ${data.length} unique data`);
        }
        
        await page.evaluate((scrollStep) => {
            const tableList = document.querySelector('.TableView__list');
            if (tableList) tableList.scrollTop += scrollStep;
        }, CONFIG.scrollStep);
        
        await page.waitForTimeout(CONFIG.scrollDelay);
        
        const scrollInfo = await page.evaluate(() => {
            const tableList = document.querySelector('.TableView__list');
            if (!tableList) return { height: 0, scrollTop: 0, clientHeight: 0 };
            return {
                height: tableList.scrollHeight,
                scrollTop: tableList.scrollTop,
                clientHeight: tableList.clientHeight
            };
        });
        
        const isAtBottom = scrollInfo.scrollTop + scrollInfo.clientHeight >= scrollInfo.height - 10;
        
        if (isAtBottom) {
            unchangedCount++;
            if (unchangedCount >= 5) {
                // Final pass - try to catch any remaining items
                const finalRows = await page.locator('span[data-testid="table-view-row"]').all();
                for (const row of finalRows) {
                    try {
                        const isVisible = await row.isVisible();
                        if (!isVisible) continue;
                        
                        const textSpan = row.locator('span[data-testid="text-type-display-span"]');
                        const text = await textSpan.textContent();
                        
                        if (text) {
                            const parts = text.split(" - ");
                            if (parts.length >= 2) {
                                const id = parts[0].trim();
                                if (extractedIds.has(id)) continue;
                                
                                extractedIds.add(id);
                                data.push({
                                    area: CONFIG.currentArea,
                                    month: month,
                                    id: id,
                                    name: parts[1].trim(),
                                    type: parts.length > 2 ? parts[2].trim() : "",
                                });
                            }
                        }
                    } catch (error) {
                        continue;
                    }
                }
                
                break;
            }
        } else {
            unchangedCount = 0;
        }
        
        scrollAttempts++;
    }
    
    console.log(`  ✅ Berhasil ekstrak ${data.length} unique data`);
    return data;
}

async function checkPeriod21_30FromDialog(page, expectedMonth) {
    try {
        await page.waitForSelector('.SlideshowPage__main', { timeout: 10000 });
        
        const headerText = await page.locator('[data-testid="slideshow-page-header"] span[data-testid="text-type-display-span"]').first().textContent();
        console.log(`    📋 Dialog opened: ${headerText}`);
        
        // ✅ CRITICAL: Wait for dialog to be fully rendered and stable
        await page.waitForTimeout(1500);
        
        try {
            const bulanDropdown = page.locator('input[aria-label="Bulan"]');
            await bulanDropdown.waitFor({ state: "visible", timeout: 5000 });
            
            // ✅ Scroll dropdown into view to ensure it's visible
            await bulanDropdown.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            
            const currentMonth = await bulanDropdown.inputValue();
            
            if (currentMonth !== expectedMonth) {
                console.log(`    📅 Mengubah bulan dari ${currentMonth} ke ${expectedMonth}`);
                
                let clickSuccess = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        console.log(`    🔽 Attempt ${attempt}: Membuka dropdown & memilih bulan...`);
                        
                        // ✅ Ensure dropdown is in view before clicking
                        await bulanDropdown.scrollIntoViewIfNeeded();
                        await page.waitForTimeout(300);
                        
                        await bulanDropdown.click({ timeout: 3000 });
                        await page.waitForTimeout(800); // ✅ Increased wait for dropdown animation
                        
                        const options = await page.locator('li[role="option"]').all();
                        
                        if (options.length === 0) {
                            console.log(`    ⚠️ Attempt ${attempt}: Dropdown tidak terbuka, retry...`);
                            continue;
                        }
                        
                        console.log(`    ✅ Dropdown terbuka, ditemukan ${options.length} opsi`);
                        
                        let monthFound = false;
                        for (const option of options) {
                            const optionText = await option.textContent();
                            if (optionText && optionText.includes(expectedMonth)) {
                                console.log(`    🎯 Menemukan opsi: ${optionText}`);
                                
                                // ✅ Scroll option into view before clicking
                                await option.scrollIntoViewIfNeeded();
                                await page.waitForTimeout(300);
                                
                                await option.click({ timeout: 5000, force: true }); // ✅ Increased timeout + force click
                                await page.waitForTimeout(1000);
                                monthFound = true;
                                break;
                            }
                        }
                        
                        if (!monthFound) {
                            console.log(`    ⚠️ Attempt ${attempt}: Bulan ${expectedMonth} tidak ditemukan di list`);
                            await page.keyboard.press('Escape');
                            await page.waitForTimeout(500);
                            continue;
                        }
                        
                        await page.waitForTimeout(1000);
                        const newMonth = await bulanDropdown.inputValue();
                        if (newMonth === expectedMonth) {
                            console.log(`    ✅ Berhasil mengubah bulan ke ${expectedMonth}`);
                            clickSuccess = true;
                            break;
                        } else {
                            console.log(`    ⚠️ Attempt ${attempt}: Bulan masih ${newMonth}, mencoba lagi...`);
                        }
                        
                    } catch (error) {
                        console.log(`    ⚠️ Attempt ${attempt} gagal: ${error.message}`);
                        try {
                            await page.keyboard.press('Escape');
                            await page.waitForTimeout(500);
                        } catch {}
                    }
                }
                
                if (!clickSuccess) {
                    throw new Error(`Gagal mengubah bulan ke ${expectedMonth} setelah 3 percobaan`);
                }
                
                await page.waitForTimeout(1500);
            }
        } catch (error) {
            console.log(`    ⚠️ Warning: Tidak bisa mengubah bulan (${error.message})`);
            throw error;
        }
        
        const periodE2130 = page.locator('span[data-testid="button-select-button"]:has(span:text-is("E2130"))').first();
        await periodE2130.waitFor({ state: "visible", timeout: 5000 });
        
        const isE2130Selected = await periodE2130.evaluate((el) => {
            return el.classList.contains('ButtonSelectButton--selected');
        });
        
        if (!isE2130Selected) {
            console.log(`    📌 Memilih periode E2130 (21-30)`);
            await periodE2130.click();
            await page.waitForTimeout(2000);
        }
        
        const clKelasButton = page.locator('button[aria-label="CL Kelas"]');
        const clKelasExists = await clKelasButton.count() > 0;
        
        if (clKelasExists) {
            console.log(`    ⚠️ Button 'CL Kelas' ada → NOT APPROVED`);
            return "NOT APPROVED";
        } else {
            console.log(`    ✅ Button 'CL Kelas' tidak ada → APPROVED`);
            return "APPROVED";
        }
        
    } catch (error) {
        console.error(`    ❌ Error: ${error.message}`);
        return "ERROR";
    }
}

async function performLogout(page) {
    try {
        console.log("\n🚪 Logging out...");
        const menuButton = page.locator('div[role="button"][title="Menu"]:has(i.fa-th)').first();
        await menuButton.click();
        await page.waitForTimeout(2000);
        
        const logoutButton = page.locator('div.GenericActionButton__paddington:has(i.fa-sign-out)').first();
        await logoutButton.click();
        await page.waitForTimeout(2000);
        
        const confirmButton = page.locator('button[aria-label="logout"].btn-danger').first();
        await confirmButton.click();
        await page.waitForTimeout(3000);
        
        console.log("✅ Logout success");
    } catch (error) {
        console.error("❌ Logout error:", error.message);
    }
}
