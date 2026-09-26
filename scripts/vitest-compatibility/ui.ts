import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:6026';
const component = await readFile('Button.jsx', 'utf8');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
page.setDefaultTimeout(60000);
try {
  await page.goto(`${url}/?path=/story/compatibility--primary:renders-ready`);
  await page.getByRole('button', { name: 'Expand testing module' }).click();
  const watch = page.getByRole('switch', { name: 'Watch mode', exact: true });
  await watch.waitFor();
  if ((await watch.getAttribute('aria-checked')) === 'true') await watch.click();
  const start = page.getByRole('button', { name: 'Start test run', exact: true });
  await start.click();
  await page.getByRole('button', { name: 'Stop test run', exact: true }).waitFor();
  await start.waitFor();
  await page.getByRole('button', { name: 'Component tests passed', exact: true }).waitFor();
  assert.match(await page.locator('body').innerText(), /Ran 4 tests/);
  await watch.click();
  await page.getByRole('switch', { name: 'Watch mode', exact: true, checked: true }).waitFor();
  await writeFile('Button.jsx', component.replace('Ready', 'Changed'));
  await page.getByRole('button', { name: /^Component tests failed/ }).waitFor();
  await start.waitFor();
  await page.screenshot({ path: 'ui-watch-failure.png' });
  await writeFile('Button.jsx', component);
  await page.getByRole('button', { name: 'Component tests passed', exact: true }).waitFor();
  await start.waitFor();
  await watch.click();
  await page.getByRole('switch', { name: 'Watch mode', exact: true, checked: false }).waitFor();
  await page.screenshot({ path: 'ui-watch-recovery.png' });
  process.stdout.write('PASS UI: story selection, run, watch failure and recovery\n');
} catch (error) {
  await writeFile(
    'ui-failure.txt',
    (await page.locator('body').innerText()) +
      '\n' +
      JSON.stringify(
        await page
          .getByRole('button')
          .evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')))
      )
  );
  await page.screenshot({ path: 'ui-failure.png' });
  throw error;
} finally {
  await writeFile('Button.jsx', component);
  await context.tracing.stop({ path: 'ui-trace.zip' });
  await browser.close();
}
