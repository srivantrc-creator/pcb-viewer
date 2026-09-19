import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });

// Load the sample board
await page.click("text=Load sample board");
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/screenshot-1-loaded.png" });

// Click a net in the sidebar to test highlighting
const gndButton = page.locator(".net-item", { hasText: "GND" }).first();
await gndButton.click();
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/screenshot-2-highlight.png" });

await browser.close();
console.log("done");
