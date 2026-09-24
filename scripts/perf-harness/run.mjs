// Runs one session of one workload against one installed project and writes the raw measurements
// as JSON. bench.mjs calls this once per run; you can also call it by hand.
//
// Usage: node run.mjs --workload <name> --project <synthetic|chromatic> --dir <projectDir>
//          --side <before|after> --build-label <text> --out <file.json> [workload options]
import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright';

import { sleep } from './lib/util.mjs';
import { workloadOptions } from './workloads/index.mjs';

const { values: opts } = parseArgs({
  options: {
    workload: { type: 'string' },
    project: { type: 'string' },
    dir: { type: 'string' },
    side: { type: 'string', default: 'before' },
    'build-label': { type: 'string', default: '' },
    'build-key': { type: 'string', default: '' },
    out: { type: 'string' },
    port: { type: 'string', default: '6106' },
    shape: { type: 'string', default: 'balanced' },
    headed: { type: 'boolean', default: false },
    'keep-cache': { type: 'boolean', default: false },
    ...workloadOptions,
  },
});
opts.dir = opts.dir && resolve(opts.dir);
if (!opts.workload || !opts.project || !opts.dir || !opts.out) {
  console.error(
    'Usage: node run.mjs --workload <name> --project <synthetic|chromatic> --dir <projectDir> --out <file.json>'
  );
  process.exit(1);
}

const port = Number(opts.port);
const controlPort = port + 1000;
const baseUrl = `http://localhost:${port}`;
const QUIET_MS = 2000;

const workload = (await import(`./workloads/${opts.workload}.mjs`)).default;
const { createProject } = await import(`./projects/${opts.project}.mjs`);
const project = await createProject(opts.dir, { shape: opts.shape });

const log = (...args) =>
  console.log(`[${opts.side} ${new Date().toISOString().slice(11, 19)}]`, ...args);

// ---------------------------------------------------------------------------------------------
// Dev server

// Every run starts cold: no Storybook manager/preview cache and no Vite dependency cache.
async function clearCaches() {
  for (const path of [
    'node_modules/.cache/storybook',
    'node_modules/.vite',
    'node_modules/.cache/sb-vite-plugin-externals',
  ]) {
    await rm(join(opts.dir, path), { recursive: true, force: true });
  }
}

async function startServer() {
  if (!opts['keep-cache']) {
    await clearCaches();
  }
  const child = spawn(
    process.execPath,
    [
      ...(project.nodeArgs ?? []),
      '--import',
      new URL('./instrument/preload.mjs', import.meta.url).pathname,
      join(opts.dir, 'node_modules/storybook/dist/bin/dispatcher.js'),
      'dev',
      '-p',
      String(port),
      '--ci',
      '--exact-port',
    ],
    {
      cwd: opts.dir,
      env: {
        ...process.env,
        ...(workload.env?.(opts) ?? {}),
        PERF_HARNESS_CONTROL_PORT: String(controlPort),
        NODE_ENV: 'development',
        STORYBOOK_DISABLE_TELEMETRY: '1',
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const started = Date.now();
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`Storybook exited early:\n${output.slice(-4000)}`);
    }
    try {
      const res = await fetch(`${baseUrl}/index.json`);
      if (res.ok) {
        const index = await res.json();
        log(
          `server ready in ${((Date.now() - started) / 1000).toFixed(1)} s, ${Object.keys(index.entries).length} index entries`
        );
        return { child, index, startupMs: Date.now() - started, output: () => output };
      }
    } catch {}
    if (Date.now() - started > 600_000) {
      throw new Error(`Storybook did not start within 10 min:\n${output.slice(-4000)}`);
    }
    await sleep(500);
  }
}

function stopServer(server) {
  try {
    process.kill(-server.child.pid, 'SIGKILL');
  } catch {}
}

const control = async (path) => (await fetch(`http://127.0.0.1:${controlPort}${path}`)).json();
// The Vitest child serves on the next port once addon-vitest has started it.
const childControl = async (path) => {
  try {
    return await (await fetch(`http://127.0.0.1:${controlPort + 1}${path}`)).json();
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------------------------
// Browser

const hookSource =
  (await readFile(new URL('./instrument/channel-hooks.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('./instrument/inpage.js', import.meta.url), 'utf8'));

const browser = await chromium.launch({ headless: !opts.headed });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await context.addInitScript({ content: hookSource });

const tabs = [];

function previewFrame(page) {
  return page
    .frames()
    .find((f) => f.name() === 'storybook-preview-iframe' || f.url().includes('/iframe.html'));
}

async function inBoth(tab, fn, arg) {
  const preview = previewFrame(tab.page);
  const [manager, prev] = await Promise.all([
    tab.page.evaluate(fn, arg),
    preview ? preview.evaluate(fn, arg).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  return { manager, preview: prev };
}

// Opens the manager on `storyId` and resolves once the preview has rendered it.
async function openTab(name, storyId = project.firstStoryId) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const tab = { name, page, cdp };
  tabs.push(tab);
  const start = Date.now();
  await page.goto(`${baseUrl}/?path=/story/${storyId}`);
  await page.waitForFunction(
    () => document.querySelector('#storybook-preview-iframe')?.contentWindow?.__perf,
    null,
    { timeout: 180_000 }
  );
  await page.waitForFunction(
    () => {
      const doc = document.querySelector('#storybook-preview-iframe')?.contentDocument;
      return (
        doc?.querySelector('#storybook-root')?.childElementCount > 0 ||
        doc?.querySelector('#storybook-docs')?.childElementCount > 0
      );
    },
    null,
    { timeout: 180_000 }
  );
  await page.waitForSelector('#storybook-explorer-tree', { timeout: 180_000 });
  return { tab, openMs: Date.now() - start };
}

// Waits until no runtime in any tab has recorded a new frame for `quietMs`.
async function waitQuiet(quietMs = QUIET_MS, timeoutMs = 300_000) {
  const count = async () => {
    const counts = await Promise.all(
      tabs.map(async (tab) => {
        const r = await inBoth(tab, () => window.__perf.frameCount());
        return `${r.manager}:${r.preview}`;
      })
    );
    return counts.join('|');
  };
  const started = Date.now();
  let last = await count();
  let stableSince = Date.now();
  while (Date.now() - stableSince < quietMs) {
    if (Date.now() - started > timeoutMs) {
      log('waitQuiet timed out');
      return;
    }
    await sleep(250);
    const next = await count();
    if (next !== last) {
      last = next;
      stableSince = Date.now();
    }
  }
}

async function takeAll() {
  const out = { server: await control('/take'), child: await childControl('/take'), tabs: {} };
  for (const tab of tabs) {
    await tab.page.evaluate(() => window.__perf.endInteraction());
    out.tabs[tab.name] = await inBoth(tab, () => window.__perf.take());
  }
  return out;
}

async function browserHeap(tab) {
  await tab.cdp.send('HeapProfiler.collectGarbage');
  await tab.cdp.send('HeapProfiler.collectGarbage');
  const { usedSize, totalSize } = await tab.cdp.send('Runtime.getHeapUsage');
  return { usedSize, totalSize };
}

async function heaps() {
  const out = { server: await control('/heap') };
  const child = await childControl('/heap');
  if (child) {
    out['vitest-child'] = child;
  }
  for (const tab of tabs) {
    out[tab.name] = await browserHeap(tab);
  }
  return out;
}

const results = {
  workload: opts.workload,
  project: opts.project,
  side: opts.side,
  buildLabel: opts['build-label'],
  buildKey: opts['build-key'],
  startedAt: new Date().toISOString(),
  options: opts,
  phases: {},
  heaps: {},
};

const stopAfter = opts['stop-after'];
let stopped = false;
async function phase(name, fn, { after, quietMs = QUIET_MS } = {}) {
  if (stopped) {
    return;
  }
  await waitQuiet(quietMs);
  await takeAll();
  log(`phase ${name}`);
  const started = Date.now();
  const info = (await fn()) ?? {};
  await waitQuiet(quietMs);
  results.phases[name] = { wallMs: Date.now() - started, info, raw: await takeAll() };
  await after?.();
  stopped = name === stopAfter;
}

// ---------------------------------------------------------------------------------------------
// Session

let server;
let exitCode = 0;
const cleanups = [];
try {
  server = await startServer();
  results.startupMs = server.startupMs;
  results.indexEntries = Object.keys(server.index.entries).length;
  await project.prepare(server.index);
  results.components = project.componentCount;
  // Everything from process start to the first index.json response.
  results.phases.boot = {
    wallMs: server.startupMs,
    info: {},
    raw: { server: await control('/take'), child: null, tabs: {} },
  };

  await workload.session({
    opts,
    project,
    baseUrl,
    context,
    tabs,
    log,
    sleep,
    phase,
    openTab,
    waitQuiet,
    takeAll,
    control,
    childControl,
    heaps,
    previewFrame,
    inBoth,
    results,
    onCleanup: (fn) => cleanups.push(fn),
  });
  results.heaps.end ??= await heaps();
} catch (error) {
  exitCode = 1;
  results.error = String(error?.stack ?? error);
  console.error(error);
  if (server) {
    results.serverOutputTail = server.output().slice(-8000);
  }
} finally {
  for (const fn of cleanups.reverse()) {
    await Promise.resolve()
      .then(fn)
      .catch((e) => console.error('cleanup failed', e));
  }
  await browser.close().catch(() => undefined);
  if (server) {
    stopServer(server);
    await writeFile(`${opts.out}.server.log`, server.output());
  }
  results.finishedAt = new Date().toISOString();
  await writeFile(opts.out, JSON.stringify(results));
  log(`wrote ${opts.out}`);
}
process.exit(exitCode);
