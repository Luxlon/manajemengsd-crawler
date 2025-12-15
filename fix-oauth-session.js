#!/usr/bin/env node
/**
 * FIX OAUTH SESSION - Clean up sameSite values
 */

import fs from "fs";

console.log("🔧 Fixing oauth-session.json...\n");

if (!fs.existsSync("oauth-session.json")) {
    console.error("❌ File oauth-session.json not found!");
    process.exit(1);
}

const sessionData = JSON.parse(fs.readFileSync("oauth-session.json", "utf-8"));

console.log(`📊 Original: ${sessionData.cookies.length} cookies`);

let fixedCount = 0;
sessionData.cookies = sessionData.cookies.map(cookie => {
    // Fix sameSite: null -> "Lax" (or "None" for cross-site cookies)
    if (cookie.sameSite === null || cookie.sameSite === undefined) {
        // If secure=true, use "None" (for cross-site)
        // Otherwise use "Lax"
        cookie.sameSite = cookie.secure ? "None" : "Lax";
        fixedCount++;
    }
    
    // Ensure sameSite is capitalized properly
    if (cookie.sameSite === "no_restriction") {
        cookie.sameSite = "None";
        fixedCount++;
    } else if (cookie.sameSite && typeof cookie.sameSite === 'string') {
        // Capitalize first letter
        const normalized = cookie.sameSite.toLowerCase();
        if (normalized === "lax") cookie.sameSite = "Lax";
        else if (normalized === "strict") cookie.sameSite = "Strict";
        else if (normalized === "none") cookie.sameSite = "None";
    }
    
    // Convert expirationDate to expires (Playwright format)
    if (cookie.expirationDate && !cookie.expires) {
        cookie.expires = cookie.expirationDate;
        delete cookie.expirationDate;
    }
    
    // Remove unnecessary fields
    delete cookie.storeId;
    delete cookie.hostOnly;
    delete cookie.session;
    
    return cookie;
});

console.log(`✅ Fixed ${fixedCount} cookies with invalid sameSite values`);
console.log(`📝 All cookies now use: Strict, Lax, or None`);

// Save fixed version
fs.writeFileSync("oauth-session.json", JSON.stringify(sessionData, null, 2));
console.log("\n✅ oauth-session.json updated!");
console.log("\n📋 Next step:");
console.log("   npm run prepare-env");
