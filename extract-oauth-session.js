#!/usr/bin/env node
/**
 * OAUTH SESSION EXTRACTOR
 * Jalankan script ini di local untuk extract Google OAuth session
 * yang bisa digunakan di Render.com
 */

import { chromium } from "playwright";
import fs from "fs";

async function extractOAuthSession() {
    console.log("🔧 Extracting OAuth session for Render.com...\n");
    
    const userDataDir = "./temp-session-extraction";
    
    // Hapus directory lama jika ada
    if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true });
    }
    
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: "chrome",
    });
    
    const page = browser.pages()[0] || await browser.newPage();
    
    console.log("🌐 Opening AppSheet...");
    await page.goto(
        "https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c?platform=desktop#appName=SLAMtes-320066460",
        { waitUntil: "networkidle", timeout: 60000 }
    );
    
    console.log("\n⏸️  PAUSED - Please complete the following steps:");
    console.log("   1. Login with Google account");
    console.log("   2. Complete OAuth flow");
    console.log("   3. Wait until you see the AppSheet app (checklist icon)");
    console.log("\n📝 Press ENTER after you've successfully logged in...");
    
    // Wait for user input
    await new Promise(resolve => {
        process.stdin.once('data', resolve);
    });
    
    console.log("\n💾 Extracting session data...");
    
    // Extract cookies
    const cookies = await page.context().cookies();
    
    // Extract localStorage for AppSheet domain
    const localStorage = await page.evaluate(() => {
        const data = {};
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            data[key] = window.localStorage.getItem(key);
        }
        return data;
    });
    
    // Save to JSON
    const sessionData = {
        cookies,
        localStorage,
        timestamp: new Date().toISOString(),
        note: "Use this data to pre-seed browser context in Render.com"
    };
    
    fs.writeFileSync("oauth-session.json", JSON.stringify(sessionData, null, 2));
    
    console.log("\n✅ Session extracted successfully!");
    console.log("   📄 File saved: oauth-session.json");
    console.log("\n📋 Next steps:");
    console.log("   1. Copy oauth-session.json content");
    console.log("   2. Create environment variable in Render.com:");
    console.log("      OAUTH_SESSION_DATA=<paste the JSON content here>");
    console.log("   3. Redeploy crawler");
    console.log("\n⚠️  Note: Session may expire after 30-90 days");
    
    await browser.close();
    
    // Cleanup
    if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true });
    }
}

extractOAuthSession().catch(console.error);
