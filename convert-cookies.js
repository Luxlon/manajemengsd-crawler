#!/usr/bin/env node
/**
 * COOKIE CONVERTER
 * Convert cookies dari Chrome DevTools export ke format Playwright
 */

import fs from "fs";
import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise(resolve => rl.question(prompt, resolve));
}

console.log("🔧 Cookie Converter for Render.com OAuth Session\n");

// Check if there's a cookies file
const cookiesFile = "cookies-manual.txt";
let cookiesData;

if (fs.existsSync(cookiesFile)) {
    console.log(`📄 Found ${cookiesFile}`);
    cookiesData = fs.readFileSync(cookiesFile, "utf-8");
} else {
    console.log("📋 Paste your cookies from Chrome DevTools (Right-click -> Copy All in Cookies table)");
    console.log("   Then press Ctrl+D (Linux/Mac) or Ctrl+Z then Enter (Windows) when done:\n");
    
    // Read from stdin
    const chunks = [];
    await new Promise((resolve) => {
        process.stdin.on('data', chunk => chunks.push(chunk));
        process.stdin.on('end', resolve);
    });
    cookiesData = Buffer.concat(chunks).toString();
}

// Try to parse as JSON (if from extension like EditThisCookie)
let cookies = [];

try {
    // Check if it's already JSON from extension
    const parsed = JSON.parse(cookiesData);
    if (Array.isArray(parsed)) {
        cookies = parsed.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || "/",
            expires: c.expirationDate ? c.expirationDate : -1,
            httpOnly: c.httpOnly || false,
            secure: c.secure || false,
            sameSite: c.sameSite || "Lax"
        }));
    }
} catch {
    // Not JSON, try to parse as TSV (Tab-Separated Values from DevTools)
    console.log("Parsing as TSV format from DevTools...");
    
    const lines = cookiesData.trim().split('\n');
    for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 7) {
            cookies.push({
                name: parts[0],
                value: parts[1],
                domain: parts[2] || ".appsheet.com",
                path: parts[3] || "/",
                expires: parts[4] ? new Date(parts[4]).getTime() / 1000 : -1,
                httpOnly: parts[5] === "✓" || parts[5] === "true",
                secure: parts[6] === "✓" || parts[6] === "true",
                sameSite: "Lax"
            });
        }
    }
}

if (cookies.length === 0) {
    console.error("\n❌ Could not parse cookies!");
    console.error("Please use one of these methods:");
    console.error("1. Install 'EditThisCookie' Chrome extension and export as JSON");
    console.error("2. Copy cookies from DevTools Application tab (Tab-separated format)");
    process.exit(1);
}

console.log(`✅ Found ${cookies.length} cookies`);

// Create session data structure
const sessionData = {
    cookies: cookies,
    localStorage: {},
    timestamp: new Date().toISOString(),
    note: "Extracted from normal Chrome browser (not automated)"
};

// Save to file
fs.writeFileSync("oauth-session.json", JSON.stringify(sessionData, null, 2));

console.log("\n✅ Session data saved to: oauth-session.json");
console.log("\n📋 Next step:");
console.log("   Run: npm run prepare-env");
console.log("   Then paste to Render.com environment variable");

rl.close();
