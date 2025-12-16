#!/usr/bin/env node
/**
 * FIX OAUTH SESSION - Clean up for Playwright compatibility
 */

import fs from "fs";

console.log("🔧 Fixing oauth-session.json for Playwright...\n");

if (!fs.existsSync("oauth-session.json")) {
    console.error("❌ File oauth-session.json not found!");
    process.exit(1);
}

const sessionData = JSON.parse(fs.readFileSync("oauth-session.json", "utf-8"));

console.log(`📊 Original: ${sessionData.cookies.length} cookies`);

let fixedCount = 0;
sessionData.cookies = sessionData.cookies.map((cookie, index) => {
    let fixed = false;
    
    // Fix 1: sameSite must be "Strict", "Lax", or "None" (case-sensitive)
    if (cookie.sameSite === null || cookie.sameSite === undefined) {
        cookie.sameSite = cookie.secure ? "None" : "Lax";
        fixed = true;
    } else if (cookie.sameSite === "no_restriction") {
        cookie.sameSite = "None";
        fixed = true;
    } else if (typeof cookie.sameSite === 'string') {
        const normalized = cookie.sameSite.toLowerCase();
        if (normalized === "lax") cookie.sameSite = "Lax";
        else if (normalized === "strict") cookie.sameSite = "Strict";
        else if (normalized === "none") cookie.sameSite = "None";
    }
    
    // Fix 2: expires must be a NUMBER (Unix timestamp in seconds)
    if (cookie.expirationDate) {
        // Convert expirationDate to expires
        if (typeof cookie.expirationDate === 'number') {
            cookie.expires = cookie.expirationDate;
        } else if (typeof cookie.expirationDate === 'string') {
            cookie.expires = new Date(cookie.expirationDate).getTime() / 1000;
        }
        delete cookie.expirationDate;
        fixed = true;
    }
    
    // Ensure expires is a number
    if (cookie.expires !== undefined && cookie.expires !== -1) {
        if (typeof cookie.expires === 'string') {
            cookie.expires = parseFloat(cookie.expires);
            fixed = true;
        } else if (typeof cookie.expires === 'object') {
            // If it's a Date object or something else, convert to timestamp
            cookie.expires = new Date(cookie.expires).getTime() / 1000;
            fixed = true;
        }
    }
    
    // Remove unnecessary fields that Playwright doesn't need
    delete cookie.storeId;
    delete cookie.hostOnly;
    delete cookie.session;
    
    if (fixed) {
        fixedCount++;
        console.log(`  ✓ Fixed cookie #${index + 1}: ${cookie.name} (domain: ${cookie.domain})`);
    }
    
    return cookie;
});

console.log(`\n✅ Fixed ${fixedCount} cookies`);
console.log(`📝 All cookies now Playwright-compatible`);

// Validate all cookies
console.log("\n🔍 Validating cookies...");
let validationErrors = 0;
sessionData.cookies.forEach((cookie, index) => {
    // Check sameSite
    if (!["Strict", "Lax", "None"].includes(cookie.sameSite)) {
        console.error(`  ❌ Cookie #${index + 1} (${cookie.name}): Invalid sameSite="${cookie.sameSite}"`);
        validationErrors++;
    }
    
    // Check expires is number
    if (cookie.expires !== undefined && cookie.expires !== -1 && typeof cookie.expires !== 'number') {
        console.error(`  ❌ Cookie #${index + 1} (${cookie.name}): expires is ${typeof cookie.expires}, expected number`);
        validationErrors++;
    }
});

if (validationErrors === 0) {
    console.log("  ✅ All cookies valid!");
} else {
    console.error(`  ❌ Found ${validationErrors} validation errors`);
    process.exit(1);
}

// Save fixed version
fs.writeFileSync("oauth-session.json", JSON.stringify(sessionData, null, 2));
console.log("\n✅ oauth-session.json updated!");
console.log("\n📋 Next step:");
console.log("   npm run prepare-env");

