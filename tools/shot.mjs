// Usage: node tools/shot.mjs <url> <out.png> [waitMs] [width] [height] [js-to-eval-before-shot]
import { chromium } from 'playwright-core';
const [url, out, wait = '3000', width = '1600', height = '900', js] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log('eval:', JSON.stringify(r).slice(0, 2000)); await page.waitForTimeout(800); }
await page.screenshot({ path: out });
if (errors.length) console.log(errors.join('\n'));
await browser.close();
