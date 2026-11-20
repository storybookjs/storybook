#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright';

const usage = 'Usage: node shot.mjs <url> <out.png> [--selector css] [--wait ms]';
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { selector: { type: 'string' }, wait: { type: 'string', default: '0' } },
});
const [url, out] = positionals;
if (!url || !out) {
  console.error(usage);
  process.exit(2);
}

const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (error) => errors.push({ message: error.message, stack: error.stack }));
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  if (values.selector) {
    await page.locator(values.selector).first().waitFor({ timeout: 60_000 });
  }
  await page.waitForTimeout(Number(values.wait));
  const target = values.selector ? page.locator(values.selector).first() : page;
  await target.screenshot({ path: out });
} finally {
  await browser.close();
  writeFileSync(`${out}.errors.json`, `${JSON.stringify(errors, null, 2)}\n`);
}
console.log(`${out} (${errors.length} page errors)`);
