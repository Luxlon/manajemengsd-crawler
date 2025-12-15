#!/usr/bin/env node
/**
 * COOKIE CONVERTER
 * Convert cookies dari Chrome DevTools export ke format Playwright
 * IMPORTANT: Export cookies dari SEMUA domains (appsheet.com, google.com, accounts.google.com)
 */

import fs from "fs";

console.log("🔧 Cookie Converter for Render.com OAuth Session\n");

// Check if there's a cookies file
const cookiesFile = "cookies-manual.txt";

if (!fs.existsSync(cookiesFile)) {
    console.error("❌ File cookies-manual.txt not found!");
    console.error("\n📋 Steps to create cookies-manual.txt:");
    console.error("1. Buka Chrome normal (bukan automated)");
    console.error("2. Login ke AppSheet dengan Google");
    console.error("3. Tekan F12 → Tab 'Application' → Cookies");
    console.error("4. PENTING: Export cookies dari SEMUA domains:");
    console.error("   - www.appsheet.com");
    console.error("   - .appsheet.com");
    console.error("   - accounts.google.com");
    console.error("   - .google.com");
    console.error("5. Select All → Copy → Paste ke cookies-manual.txt");
    process.exit(1);
}

const cookiesData = fs.readFileSync(cookiesFile, "utf-8");

// Parse as TSV (Tab-Separated Values from DevTools)
console.log("📄 Parsing cookies from DevTools format...");

const lines = cookiesData.trim().split('\n');
const cookies = [];

for (const line of lines) {
    if (!line.trim()) continue;
    
    const parts = line.split('\t');
    if (parts.length >= 3) {
        const cookie = {
            name: parts[0].trim(),
            value: parts[1].trim(),
            domain: parts[2].trim(),
            path: parts[3]?.trim() || "/",
            secure: true,
            httpOnly: false,
            sameSite: "Lax"
        };
        
        // Parse expiration
        if (parts[4]) {
            try {
                const expDate = new Date(parts[4].trim());
                cookie.expires = expDate.getTime() / 1000;
            } catch {
                cookie.expires = -1;
            }
        } else {
            cookie.expires = -1;
        }
        
        // Parse httpOnly flag
        if (parts[6]?.includes('✓') || parts[6]?.toLowerCase().includes('true')) {
            cookie.httpOnly = true;
        }
        
        // Parse secure flag  
        if (parts[7]?.includes('✓') || parts[7]?.toLowerCase().includes('true')) {
            cookie.secure = true;
        }
        
        cookies.push(cookie);
    }
}

if (cookies.length === 0) {
    console.error("\n❌ No cookies found in cookies-manual.txt!");
    console.error("Please make sure you copied cookies from DevTools correctly.");
    process.exit(1);
}

console.log(`✅ Found ${cookies.length} cookies`);

// Group by domain for validation
const domains = {};
cookies.forEach(c => {
    const domain = c.domain.replace(/^\./, '');
    domains[domain] = (domains[domain] || 0) + 1;
});

console.log("\n📊 Cookies by domain:");
for (const [domain, count] of Object.entries(domains)) {
    console.log(`   • ${domain}: ${count} cookies`);
}

// Validation warnings
const hasAppSheet = cookies.some(c => c.domain.includes('appsheet'));
const hasGoogle = cookies.some(c => c.domain.includes('google'));
const hasAuthCookie = cookies.some(c => c.name.includes('JEENEEATH') || c.name.includes('auth') || c.name.includes('session'));

console.log("\n🔍 Validation:");
console.log(`   ${hasAppSheet ? '✅' : '❌'} AppSheet cookies`);
console.log(`   ${hasGoogle ? '✅' : '⚠️ '} Google cookies ${!hasGoogle ? '(optional tapi recommended)' : ''}`);
console.log(`   ${hasAuthCookie ? '✅' : '❌'} Auth/Session cookies`);

if (!hasAppSheet) {
    console.error("\n❌ ERROR: No AppSheet cookies found!");
    console.error("Please export cookies from www.appsheet.com domain.");
    process.exit(1);
}

if (!hasAuthCookie) {
    console.warn("\n⚠️  WARNING: No auth cookies (.JEENEEATH) found!");
    console.warn("Session might not work without authentication cookies.");
}

// Create session data structure
const sessionData = {
    cookies: cookies,
    localStorage: {},
    timestamp: new Date().toISOString(),
    note: `Extracted from Chrome DevTools - ${cookies.length} cookies from ${Object.keys(domains).length} domains`
};

// Save to file
fs.writeFileSync("oauth-session.json", JSON.stringify(sessionData, null, 2));

console.log("\n✅ Session data saved to: oauth-session.json");
console.log(`   Total: ${cookies.length} cookies from ${Object.keys(domains).length} domain(s)`);
console.log("\n📋 Next step:");
console.log("   npm run prepare-env");
console.log("   Then paste to Render.com OAUTH_SESSION_DATA variable");

