import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/shot-1-map.png" });

await page.click("text=Circuit Builder");
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-2-builder-dc.png" });

// Switch to Thevenin tab and pick ports
await page.selectOption("select:near(:text('Preset'))", { label: "Thevenin practice network" });
await page.waitForTimeout(200);
await page.click("text=Thevenin / Norton");
await page.waitForTimeout(200);
const selects = await page.locator(".port-selectors select").all();
await selects[0].selectOption("2");
await selects[1].selectOption("0");
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/shot-3-thevenin.png" });

// AC preset
await page.click("text=Node/Element Results");
await page.selectOption("select:near(:text('Preset'))", { label: "AC RLC series" });
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-4-ac.png" });

await page.click("text=First-Order (RC/RL)");
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-5-firstorder.png" });

await page.click("text=Diodes");
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-6-diode.png" });

await page.click("text=MOSFETs");
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-7-mosfet.png" });

await page.click("text=Magnetics");
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-8-magnetics.png" });

await browser.close();
console.log("done");
