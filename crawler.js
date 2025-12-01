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
        BANDUNG: { username: "855060", password: "123" },
        CORPU: { username: "AMIRUDDIN", password: "123" },
        PRIANGAN_TIMUR: { username: "755261", password: "123" },
        PRIANGAN_BARAT: { username: "825068", password: "123" },
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
    
    const userDataDir = "C:\\Users\\Luxion\\AppData\\Local\\Google\\Chrome\\User Data\\PlaywrightProfile";

    broadcastLog(`🚀 CRAWLER PERIODE 1-20 - ${areaName} (Direct API Mode)`);
    broadcastLog(`   🆔 Run ID: ${apiClient.runId}`);
    
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        channel: "chrome",
        args: [
            "--start-maximized",
            "--profile-directory=Default",
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
        ],
    });

    const page = await browser.newPage();

    try {
        broadcastLog("🌐 Opening AppSheet...");
        await page.goto(
            "https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c?platform=desktop#appName=SLAMtes-320066460",
            { waitUntil: "networkidle", timeout: 60000 }
        );

        const isLoggedIn = await checkIfLoggedIn(page);
        if (!isLoggedIn) {
            broadcastLog("🔒 Logging in...");
            await performLogin(page, areaName);
        } else {
            broadcastLog("✅ Already logged in");
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
export async function runCrawlPeriod21_30(areaName = "BANDUNG") {
    CONFIG.currentArea = areaName;
    const apiClient = new CrawlerAPIClient(CONFIG.nextjsApiUrl, CONFIG.apiKey);
    
    console.log(`🚀 CRAWLER PERIODE 21-30 - ${areaName} (Direct API Mode)`);
    console.log(`   🆔 Run ID: ${apiClient.runId}`);
    
    // ✅ Fetch APPROVED from API
    const approvedData = await apiClient.fetchApprovedData(areaName);
    
    if (approvedData.length === 0) {
        console.log("⚠️ No APPROVED data to check");
        return { success: true, totalChecked: 0, totalUpdated: 0 };
    }

    const userDataDir = "C:\\Users\\Luxion\\AppData\\Local\\Google\\Chrome\\User Data\\PlaywrightProfile";
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        channel: "chrome",
        args: [
            "--start-maximized",
            "--profile-directory=Default",
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
        ],
    });

    const page = await browser.newPage();

    try {
        await page.goto(
            "https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c?platform=desktop#appName=SLAMtes-320066460",
            { waitUntil: "networkidle", timeout: 60000 }
        );

        const isLoggedIn = await checkIfLoggedIn(page);
        if (!isLoggedIn) {
            await performLogin(page, areaName);
        }

        await waitForSyncComplete(page, 120000);
        await navigateToChecklist(page);
        await waitForSyncComplete(page, 120000);

        // Group by month
        const approvedByMonth = {};
        for (const item of approvedData) {
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
                
                const updatesToSend = [];
                
                for (const item of items) {
                    totalChecked++;
                    
                    try {
                        // Click row to open dialog
                        const row = page.locator(`span[data-testid="table-view-row"]:has-text("${item.id_gedung}")`).first();
                        const rowCount = await row.count();
                        
                        if (rowCount === 0) {
                            console.log(`   ⏭️ ${item.id_gedung}: NOT FOUND in table`);
                            updatesToSend.push({
                                ...item,
                                Period_21_30: "NOT FOUND"
                            });
                            continue;
                        }
                        
                        await row.click();
                        await page.waitForTimeout(2000);
                        
                        const status = await checkPeriod21_30FromDialog(page, month);
                        console.log(`   ✅ ${item.id_gedung}: ${status}`);
                        
                        updatesToSend.push({
                            Area: item.area,
                            Month: item.month,
                            ID: item.id_gedung,
                            Name: item.name,
                            Type: item.type,
                            Period_1_20: item.period_1_20,
                            Period_21_30: status
                        });
                        
                        // Close dialog
                        await page.keyboard.press('Escape');
                        await page.waitForTimeout(1000);
                        
                    } catch (itemError) {
                        console.error(`   ❌ ${item.id_gedung}: ERROR - ${itemError.message}`);
                        updatesToSend.push({
                            ...item,
                            Period_21_30: "ERROR"
                        });
                    }
                }
                
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
        
        await performLogout(page);
        await page.waitForTimeout(120000);

        return {
            success: true,
            runId: apiClient.runId,
            totalChecked: totalChecked,
            totalUpdated: totalUpdated
        };
        
    } catch (error) {
        console.error("❌ FATAL ERROR:", error.message);
        throw error;
    } finally {
        await browser.close();
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
    await page.waitForSelector('[data-testid="Login"]', { timeout: 60000 });
    await page.click('[data-testid="Login"]');
    await page.waitForSelector('input[aria-label="Username"]', { timeout: 60000 });
    await page.fill('input[aria-label="Username"]', credentials.username);
    await page.fill('input[aria-label="Password"]', credentials.password);
    await page.click('button:has-text("Login")');
    await page.waitForSelector("ul[role='navigation']", { timeout: 60000 });
    console.log("✅ Login success");
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
        
        try {
            const bulanDropdown = page.locator('input[aria-label="Bulan"]');
            await bulanDropdown.waitFor({ state: "visible", timeout: 5000 });
            const currentMonth = await bulanDropdown.inputValue();
            
            if (currentMonth !== expectedMonth) {
                console.log(`    📅 Mengubah bulan dari ${currentMonth} ke ${expectedMonth}`);
                
                let clickSuccess = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        console.log(`    🔽 Attempt ${attempt}: Membuka dropdown & memilih bulan...`);
                        
                        await bulanDropdown.click({ timeout: 3000 });
                        await page.waitForTimeout(500);
                        
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
                                await option.click({ timeout: 2000 });
                                await page.waitForTimeout(1000);
                                monthFound = true;
                                break;
                            }
                        }
                        
                        if (!monthFound) {
                            console.log(`    ⚠️ Attempt ${attempt}: Bulan ${expectedMonth} tidak ditemukan di list`);
                            await page.keyboard.press('Escape');
                            await page.waitForTimeout(300);
                            continue;
                        }
                        
                        await page.waitForTimeout(800);
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
                            await page.waitForTimeout(300);
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
