// Drive the game in a headless browser with real mouse input and take screenshots.
// Usage: node tools/play.mjs <url> <steps.mjs> [outDir] [width] [height]
// steps.mjs exports `default async function (page, shot, log)`; shot(name) saves <outDir>/<name>.png.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [url, stepsFile, outDir = 'shots', width = '1600', height = '900'] = process.argv.slice(2);
if (!url || !stepsFile) {
  console.error('Usage: node tools/play.mjs <url> <steps.mjs> [outDir] [width] [height]');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}\n${e.stack}`));
await page.goto(url, { waitUntil: 'load' });
const shot = async (name) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`shot ${outDir}/${name}.png`);
};
const log = (...a) => console.log(...a);
let failed = false;
try {
  const mod = await import(pathToFileURL(resolve(stepsFile)).href);
  await mod.default(page, shot, log);
} catch (e) {
  failed = true;
  console.error('step failed:', e);
  await page.screenshot({ path: `${outDir}/failure.png` }).catch(() => {});
}
if (problems.length) console.log(problems.join('\n'));
await browser.close();
process.exit(failed ? 1 : 0);
