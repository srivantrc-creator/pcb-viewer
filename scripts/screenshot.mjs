import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto("http://localhost:4177/", { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/shot-1-landing.png" });

await page.click("text=Circuit Builder");
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-2-builder-divider.png" });

await page.selectOption("select:near(:text('Preset'))", { label: "Series-parallel network" });
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-3-series-parallel.png" });

await page.selectOption("select:near(:text('Preset'))", { label: "Wheatstone bridge" });
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-4-wheatstone.png" });

await page.selectOption("select:near(:text('Preset'))", { label: "Two sources (superposition demo)" });
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-5-two-sources.png" });

await page.selectOption("select:near(:text('Preset'))", { label: "AC RLC series" });
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-6-ac-rlc.png" });

await browser.close();
console.log("done");
