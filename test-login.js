import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

async function testLogin() {
    console.log("🧪 Testing AppSheet Login Flow...\n");
    
    // Use local directory for persistent context
    const userDataDir = "./playwright-profile";
    
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: false,  // Visible browser
        args: [
            "--start-maximized",
        ],
    });
    
    const page = browser.pages()[0] || await browser.newPage();
    
    console.log("🌐 Opening AppSheet...");
    await page.goto(
        "https://www.appsheet.com/start/c08488d5-d2b3-4411-b6cc-8f387c028e7c?platform=desktop#appName=SLAMtes-320066460",
        { waitUntil: "networkidle", timeout: 60000 }
    );
    
    await page.waitForTimeout(3000);
    
    // Log current page state
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Check for various elements
    const checklistButton = await page.locator('div[role="button"] i.fa-check').count();
    const loginButton = await page.locator('div.GenericActionButton__paddington:has(i.fa-sign-in-alt)').count();
    const googleButton = await page.locator('button#Google').count();
    const navigationMenu = await page.locator("ul[role='navigation']").count();
    
    console.log("\n🔍 Page Elements Found:");
    console.log(`   - Checklist button: ${checklistButton}`);
    console.log(`   - Login button (fa-sign-in-alt): ${loginButton}`);
    console.log(`   - Google button (#Google): ${googleButton}`);
    console.log(`   - Navigation menu: ${navigationMenu}`);
    
    // List all buttons
    console.log("\n📋 All buttons on page:");
    const allButtons = await page.locator('button').all();
    for (let i = 0; i < allButtons.length; i++) {
        try {
            const text = await allButtons[i].textContent();
            const id = await allButtons[i].getAttribute('id');
            const name = await allButtons[i].getAttribute('name');
            const type = await allButtons[i].getAttribute('type');
            console.log(`   [${i}] id="${id}" name="${name}" type="${type}" text="${text?.trim().substring(0, 50)}"`);
        } catch (e) {}
    }
    
    // List all divs with GenericActionButton
    console.log("\n📋 GenericActionButton elements:");
    const actionButtons = await page.locator('div.GenericActionButton__paddington').all();
    for (let i = 0; i < actionButtons.length; i++) {
        try {
            const text = await actionButtons[i].textContent();
            const html = await actionButtons[i].innerHTML();
            console.log(`   [${i}] text="${text?.trim()}" html="${html.substring(0, 100)}"`);
        } catch (e) {}
    }
    
    // Take screenshot
    await page.screenshot({ path: './test-login-screenshot.png', fullPage: true });
    console.log("\n📸 Screenshot saved to: test-login-screenshot.png");
    
    console.log("\n⌨️  Press Enter to close browser...");
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    await browser.close();
    console.log("✅ Done!");
}

testLogin().catch(console.error);
