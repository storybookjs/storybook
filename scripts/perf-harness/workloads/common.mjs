// Phases more than one workload uses.
import { readFile, writeFile } from 'node:fs/promises';

// Five quiet seconds: the server's CPU while nothing happens, as a baseline for the other phases.
export async function idlePhase(ctx) {
  await ctx.phase('idle', async () => {
    await ctx.sleep(5000);
    return {};
  });
}

// GET /index.json `count` times in a row. `cpuMs` is server CPU measured tightly around the requests.
export async function indexJsonPhase(ctx) {
  const count = Number(ctx.opts['index-requests']);
  await ctx.phase('indexJson', async () => {
    const samples = [];
    let bytes = 0;
    const cpuBefore = (await ctx.control('/cpu')).ms;
    for (let i = 0; i < count; i += 1) {
      const t0 = performance.now();
      const res = await fetch(`${ctx.baseUrl}/index.json`);
      const text = await res.text();
      samples.push(performance.now() - t0);
      bytes = text.length;
    }
    const cpuMs = (await ctx.control('/cpu')).ms - cpuBefore;
    return { samples, bytes, requests: count, cpuMs };
  });
}

// Saves one story file with an appended comment, waits, then restores it. Each save runs HMR, the
// indexer for that file, and a change-detection scan (git); the phase's server CPU and git spawns
// are the cost of both saves.
export async function changeScanPhase(ctx) {
  const target = ctx.project.components[Math.floor(ctx.project.components.length / 2)];
  const file = target.file;
  const original = await readFile(file, 'utf8');
  ctx.onCleanup(() => writeFile(file, original));
  await ctx.phase(
    'changeScan',
    async () => {
      await writeFile(file, `${original}\n// perf-harness change ${Date.now()}\n`);
      await ctx.sleep(4000);
      await ctx.waitQuiet(2000);
      await writeFile(file, original);
      await ctx.sleep(4000);
      return { file: target.importPath, saves: 2 };
    },
    { quietMs: 2000 }
  );
}

// Opens the manager on the first story; the phase covers page load to first story rendered.
export async function openPhase(ctx) {
  await ctx.phase('open', async () => {
    const { openMs, firstRender } = await ctx.openTab('tab1');
    return { openMs, firstRender };
  });
}

// Starts an interaction record in the manager, runs `fn` in the page, waits until the manager DOM
// is quiet, and closes the record.
export async function measureInPage(page, kind, fn, arg, quietMs = 300) {
  await page.evaluate(([k]) => window.__perf.begin(k), [kind]);
  await page.evaluate(fn, arg);
  await page.evaluate((q) => window.__perf.waitSettled(q), quietMs);
  await page.evaluate(() => window.__perf.endInteraction());
}
