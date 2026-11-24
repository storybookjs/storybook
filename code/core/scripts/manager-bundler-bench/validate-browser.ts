/**
 * Opens manager builds (see `validate-build.ts`) in a headless browser and reports, for each, which
 * addons registered and what the page logged, so builds made by different bundlers can be compared.
 *
 * Usage: `node validate-browser.ts <report.json> <name>=<staticDir> [<name>=<staticDir> ...]`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';

import { chromium } from 'playwright';

const [reportFile, ...targets] = process.argv.slice(2);

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

const serve = (root: string) =>
  new Promise<{ url: string; close: () => void }>((done) => {
    const server = createServer((request, response) => {
      const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const file = join(root, normalize(path === '/' ? '/index.html' : path));
      try {
        const body = readFileSync(file);
        response.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(file)] ?? 'text/plain' });
        response.end(body);
      } catch {
        response.writeHead(404).end();
      }
    }).listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      done({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });

// A system browser is used when the installed Playwright has no matching download
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const report: Record<string, unknown> = {};

for (const target of targets) {
  const [name, dir] = target.split('=');
  const server = await serve(dir);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text().slice(0, 300));
    }
  });
  page.on('pageerror', (error) => pageErrors.push(String(error.message).slice(0, 300)));
  // Keep the run hermetic: addons and refs must not reach the network
  await page.route('**/*', (route) =>
    route.request().url().startsWith(server.url) ? route.continue() : route.abort()
  );

  await page.goto(`${server.url}/?path=/story/bench--default`, { waitUntil: 'load' });
  await page.waitForTimeout(6000);

  const registered = await page.evaluate(() => {
    const store = (globalThis as any).__STORYBOOK_ADDONS_MANAGER;
    if (!store) {
      return null;
    }
    const types = ['tab', 'panel', 'tool', 'toolextra', 'preview', 'page', 'test-provider'];
    return {
      loaders: Object.keys(store.loaders ?? {}).sort(),
      elements: Object.fromEntries(
        types.map((type) => [type, Object.keys(store.getElements(type) ?? {}).sort()])
      ),
    };
  });
  const rendered = await page.evaluate(() => ({
    rootChildren: document.querySelector('#root')?.childElementCount ?? 0,
    text: document.body.innerText.slice(0, 400),
  }));
  await page.screenshot({ path: reportFile.replace(/\.json$/, `-${name}.png`) });

  report[name] = { registered, rendered, consoleErrors, pageErrors };
  await page.close();
  server.close();
}

await browser.close();
writeFileSync(reportFile, JSON.stringify(report, null, 2));

const names = Object.keys(report);
const signature = (name: string) => JSON.stringify((report[name] as any).registered);
for (const name of names) {
  const { registered, consoleErrors, pageErrors } = report[name] as any;
  const elementCount = Object.values(registered?.elements ?? {}).flat().length;
  process.stdout.write(
    `${name}: ${registered?.loaders.length ?? 0} addons registered, ${elementCount} elements, ` +
      `${consoleErrors.length} console errors, ${pageErrors.length} page errors, ` +
      `same registrations as ${names[0]}: ${signature(name) === signature(names[0])}\n`
  );
}
process.exit(0);
