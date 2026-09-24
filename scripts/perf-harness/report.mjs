// Aggregates the run JSONs in a results folder into report.md and summary.json: before vs after,
// median over runs, ratio after/before. The headline table is short enough for a PR description;
// every metric of every phase follows in collapsed sections.
// Usage: node report.mjs <resultsDir>
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { median, percentile, sum } from './lib/util.mjs';

const dir = process.argv[2];
const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
const runs = { before: [], after: [] };
const failed = [];
for (const file of (await readdir(dir))
  .filter((f) => /^(before|after)-\d+\.json$/.test(f))
  .sort()) {
  const data = JSON.parse(await readFile(join(dir, file), 'utf8'));
  if (data.error) {
    failed.push(`${file}: ${data.error.split('\n')[0]}`);
    continue;
  }
  runs[data.side].push(data);
}

// [label, runtime that records the frame, link, direction as seen by that runtime]
const LINKS = [
  ['server→manager', 'manager', 'ws', 'in'],
  ['server→preview', 'preview', 'ws', 'in'],
  ['manager→server', 'manager', 'ws', 'out'],
  ['preview→server', 'preview', 'ws', 'out'],
  ['manager→preview', 'preview', 'pm', 'in'],
  ['preview→manager', 'manager', 'pm', 'in'],
];
const IPC_LINKS = [
  ['server→vitest child', 'to-child'],
  ['vitest child→server', 'from-child'],
];
const typeLabel = (x) => (x.subtype ? `${x.type} ${x.subtype}` : x.type);

function phaseMetrics(runData, phaseName) {
  const phase = runData.phases[phaseName];
  const m = {};
  if (!phase) return m;
  const { raw, info } = phase;
  const tabs = Object.values(raw.tabs ?? {});
  const framesOf = (runtime) => tabs.flatMap((t) => t[runtime]?.frames ?? []);

  // Wire bytes per link and per event type.
  let total = 0;
  for (const [label, runtime, link, dir] of LINKS) {
    const frames = framesOf(runtime).filter((f) => f.link === link && f.dir === dir);
    if (frames.length === 0) continue;
    const bytes = sum(frames.map((f) => f.bytes));
    total += bytes;
    m[`bytes ${label}`] = bytes;
    m[`frames ${label}`] = frames.length;
    for (const f of frames) {
      const key = `bytes ${label} · ${typeLabel(f)}`;
      m[key] = (m[key] ?? 0) + f.bytes;
    }
  }
  for (const [label, dir] of IPC_LINKS) {
    const messages = (raw.server?.ipc ?? []).filter((x) => x.dir === dir);
    if (messages.length === 0) continue;
    const bytes = sum(messages.map((x) => x.bytes));
    total += bytes;
    m[`bytes ${label}`] = bytes;
    m[`frames ${label}`] = messages.length;
    for (const x of messages) {
      const key = `bytes ${label} · ${typeLabel(x)}`;
      m[key] = (m[key] ?? 0) + x.bytes;
    }
  }
  m['bytes all links'] = total;

  // Browser main thread. Manager and preview are same-origin, so they share one renderer main
  // thread, and each frame's observer reports every task on it (the preview's own tasks show in the
  // manager as `same-origin-descendant`). Use the manager's list. Merging both lists by start time
  // does not work: the two frames' time origins differ by a fraction of a millisecond.
  const longtasks = tabs.flatMap((t) =>
    (t.manager?.longtasks?.length ? t.manager.longtasks : (t.preview?.longtasks ?? [])).map(
      (lt) => ({
        ...lt,
        runtime: t.manager?.longtasks?.length ? 'manager' : 'preview',
      })
    )
  );
  m['main thread long tasks'] = longtasks.length;
  m['main thread total blocking time ms'] = sum(
    longtasks.map((lt) => Math.max(0, lt.duration - 50))
  );
  m['main thread longest task ms'] = Math.max(0, ...longtasks.map((lt) => lt.duration));
  m['main thread long task ms, preview frame'] = sum(
    longtasks
      .filter(
        (lt) =>
          lt.attribution === 'same-origin-descendant' ||
          (lt.runtime === 'preview' && lt.attribution === 'self')
      )
      .map((lt) => lt.duration)
  );

  // Interactions recorded in the manager.
  const interactions = tabs.flatMap((t) => t.manager?.interactions ?? []);
  const latency = (r) =>
    (r.settledAt ?? r.firstFrameAt) === null ? null : (r.settledAt ?? r.firstFrameAt) - r.t0;
  const statuses = interactions.filter((r) => r.kind === 'status');
  if (statuses.length) {
    m['status events received by manager'] = statuses.length;
    m['status event: receipt → settled p50 ms'] = median(statuses.map(latency));
    m['status event: receipt → settled p95 ms'] = percentile(statuses.map(latency), 95);
    m['status event: receipt → settled max ms'] = Math.max(...statuses.map(latency));
    m['status event: handler p50 ms'] = median(statuses.map((r) => r.handlerMs));
    m['status event: bytes p50'] = median(statuses.map((r) => r.bytes));
    m['status event: DOM mutation records p50'] = median(statuses.map((r) => r.mutations));
  }
  const keys = interactions.filter((r) => r.kind.startsWith('key:'));
  if (keys.length) {
    m['key presses'] = keys.length;
    m['key press → settled p50 ms'] = median(keys.map(latency));
    m['key press → settled p95 ms'] = percentile(keys.map(latency), 95);
    m['key press → settled max ms'] = Math.max(...keys.map(latency));
  }
  for (const r of interactions.filter((x) => x.kind !== 'status' && !x.kind.startsWith('key:'))) {
    m[`${r.kind} → settled ms`] = latency(r);
  }

  // Services (OSA) sync path, when there is any.
  const isServices = (type) => type.startsWith('services:');
  for (const runtime of ['manager', 'preview']) {
    const inFrames = framesOf(runtime).filter((f) => f.dir === 'in' && isServices(f.type));
    if (inFrames.length === 0) continue;
    const dispatches = tabs.flatMap((t) => t[runtime]?.dispatches ?? []).filter((d) => d.remote);
    m[`${runtime} services deserialize ms`] = sum(inFrames.map((f) => f.receiveMs - f.dispatchMs));
    m[`${runtime} services apply ms`] = sum(dispatches.map((d) => d.applyMs));
    m[`${runtime} services serialize ms`] = sum(
      tabs.flatMap((t) => t[runtime]?.sends ?? []).map((s) => s.ms)
    );
  }

  // Server and Vitest child processes.
  const server = raw.server;
  if (server) {
    m['server CPU ms'] = server.cpu.userMs + server.cpu.systemMs;
    m['server event-loop max delay ms'] = server.eventLoop.maxDelayMs;
    m['server git processes'] = server.spawns.filter((s) => s.git).length;
    m['server child processes (all)'] = server.spawns.length;
    if (server.sends.length) m['server services serialize ms'] = sum(server.sends.map((s) => s.ms));
    if (server.floodTicks?.length)
      m['server status set() p50 ms'] = median(server.floodTicks.map((t) => t.setMs));
  }
  if (raw.child) {
    m['vitest child CPU ms'] = raw.child.cpu.userMs + raw.child.cpu.systemMs;
    m['vitest child → server IPC bytes (child view)'] = sum(
      raw.child.ipc.filter((x) => x.dir === 'to-parent').map((x) => x.bytes)
    );
    m['server → vitest child IPC bytes (child view)'] = sum(
      raw.child.ipc.filter((x) => x.dir === 'from-parent').map((x) => x.bytes)
    );
  }

  // Phase-specific numbers.
  m['phase wall ms'] = phase.wallMs;
  if (info.openMs !== undefined) m['open: goto → story rendered ms'] = info.openMs;
  if (info.treeItems !== undefined) m['sidebar tree items'] = info.treeItems;
  if (phaseName === 'indexJson') {
    m['index.json request p50 ms'] = median(info.samples);
    m['index.json bytes'] = info.bytes;
    m['server CPU ms per index.json request'] = info.cpuMs / info.requests;
  }
  if (phaseName === 'searchType') m['search results rendered'] = info.results;
  if (phaseName === 'visit') {
    m['visit: select → rendered p50 ms'] = median(info.samples.map((s) => s.ms));
    m['visit: select → rendered max ms'] = Math.max(...info.samples.map((s) => s.ms));
    m['visits not rendered'] = info.samples.filter((s) => s.event === 'timeout').length;
  }
  if (info.runMs !== undefined) m['vitest run ms (click → button enabled)'] = info.runMs;
  if (phaseName === 'extractAll') {
    m['extractAll command ms'] = info.commandMs;
    m['extractAll visible in preview ms'] = info.previewVisibleMs;
  }
  if (phaseName === 'singleSaves') {
    m['save → manager p50 ms'] = median(info.samples.map((s) => s.managerMs));
    m['save → preview p50 ms'] = median(info.samples.map((s) => s.previewMs));
  }
  if (phaseName === 'singleCommands')
    m['extractDocgen command p50 ms'] = median(info.samples.map((s) => s.commandMs));
  if (phaseName === 'bootstrapTab2') {
    m['fresh tab: full state in manager ms'] = info.managerFullStateMs;
    m['fresh tab: full state in preview ms'] = info.previewFullStateMs;
  }
  if (phaseName === 'boot') m['server start → index.json ms'] = phase.wallMs;
  if (phaseName === 'idle' && server)
    m['server idle CPU ms per s'] = m['server CPU ms'] / (phase.wallMs / 1000);
  return m;
}

function heapMetrics(runData) {
  const m = {};
  for (const [when, heaps] of Object.entries(runData.heaps ?? {})) {
    for (const [runtime, h] of Object.entries(heaps)) {
      const label =
        runtime === 'server'
          ? 'server'
          : runtime === 'vitest-child'
            ? 'vitest child'
            : `browser ${runtime} (manager + preview)`;
      m[`heap ${when}: ${label} MB`] = (h.heapUsed ?? h.usedSize) / 2 ** 20;
    }
  }
  return m;
}

const medians = (side, fn) => {
  const perRun = runs[side].map(fn);
  const keys = new Set(perRun.flatMap((x) => Object.keys(x)));
  // A missing key means zero occurrences in that run (e.g. no frames of a type); null means the
  // run could not measure it, so the median skips it.
  return Object.fromEntries(
    [...keys].map((k) => [k, median(perRun.map((x) => (x[k] === undefined ? 0 : x[k])))])
  );
};

const fmt = (key, v) => {
  if (v === null || v === undefined) return '–';
  if (/\bbytes\b/.test(key)) {
    if (v >= 2 ** 20) return `${(v / 2 ** 20).toFixed(2)} MB`;
    if (v >= 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${Math.round(v)} B`;
  }
  if (Math.abs(v) >= 100) return Math.round(v).toLocaleString('en-US');
  return (Math.round(v * 10) / 10).toString();
};
const ratio = (b, a) => {
  if (b === null || a === null || b === undefined || a === undefined) return '–';
  if (b === 0 && a === 0) return '=';
  if (b === 0) return 'after only';
  const r = a / b;
  return r < 0.01 ? `${r.toExponential(1)}×` : `${r.toFixed(2)}×`;
};
// A baseline (no --after build) has one value column.
const single = !meta.builds.after;
const row = (label, key, b, a) =>
  single
    ? `| ${label} | ${fmt(key, b)} |\n`
    : `| ${label} | ${fmt(key, b)} | ${fmt(key, a)} | ${ratio(b, a)} |\n`;
const TABLE_HEAD = single
  ? `| Measure | ${meta.builds.before.label} |\n| --- | ---: |\n`
  : '| Measure | Before | After | After/before |\n| --- | ---: | ---: | ---: |\n';

// Headline rows per workload: [phase, metric key]. Missing rows are skipped.
const perLink = (phase) => [
  ...LINKS.map(([l]) => [phase, `bytes ${l}`]),
  ...IPC_LINKS.map(([l]) => [phase, `bytes ${l}`]),
];
const mainThread = (phase) => [
  [phase, 'main thread long tasks'],
  [phase, 'main thread total blocking time ms'],
];
const HEADLINES = {
  'status-flood': [
    ['flood', 'status event: receipt → settled p50 ms'],
    ['flood', 'status event: receipt → settled p95 ms'],
    ['flood', 'status event: handler p50 ms'],
    ...mainThread('flood'),
    ...perLink('flood'),
    ['flood', 'server CPU ms'],
    ['floodSearch', 'status event: receipt → settled p50 ms'],
    ['floodSearch', 'status event: receipt → settled p95 ms'],
    ...mainThread('floodSearch'),
    ['expandAll', 'expandAll → settled ms'],
    ['indexJson', 'index.json request p50 ms'],
    ['indexJson', 'server CPU ms per index.json request'],
    ['changeScan', 'server CPU ms'],
    ['changeScan', 'server git processes'],
    ['idle', 'server idle CPU ms per s'],
    ['boot', 'server start → index.json ms'],
    ['boot', 'server CPU ms'],
  ],
  'browse-search': [
    ['searchType', 'key press → settled p50 ms'],
    ['searchType', 'key press → settled p95 ms'],
    ...mainThread('searchType'),
    ['searchArrows', 'key press → settled p50 ms'],
    ['searchArrows', 'key press → settled p95 ms'],
    ['treeArrows', 'key press → settled p50 ms'],
    ['treeArrows', 'key press → settled p95 ms'],
    ...mainThread('treeArrows'),
    ['visit', 'visit: select → rendered p50 ms'],
    ...mainThread('visit'),
    ['indexJson', 'index.json request p50 ms'],
    ['indexJson', 'server CPU ms per index.json request'],
    ['changeScan', 'server CPU ms'],
    ['changeScan', 'server git processes'],
    ['open', 'open: goto → story rendered ms'],
  ],
  'vitest-run': [
    ['vitestRun', 'vitest run ms (click → button enabled)'],
    ...perLink('vitestRun'),
    ...mainThread('vitestRun'),
    ['vitestRun', 'main thread longest task ms'],
    ['vitestRun', 'status events received by manager'],
    ['vitestRun', 'status event: receipt → settled p50 ms'],
    ['vitestRun', 'status event: receipt → settled p95 ms'],
    ['vitestRun', 'server CPU ms'],
    ['vitestRun', 'vitest child CPU ms'],
    ['vitestRun', 'server git processes'],
  ],
  docgen: [
    ['extractAll', 'extractAll command ms'],
    ['extractAll', 'bytes all links'],
    ['singleSaves', 'save → preview p50 ms'],
    ['burst', 'bytes all links'],
    ...mainThread('burst'),
    ['bootstrapTab2', 'fresh tab: full state in manager ms'],
  ],
};

const phaseNames = [
  ...new Set([...runs.before, ...runs.after].flatMap((r) => Object.keys(r.phases))),
];
const phaseMedians = Object.fromEntries(
  phaseNames.map((p) => [
    p,
    {
      before: medians('before', (r) => phaseMetrics(r, p)),
      after: medians('after', (r) => phaseMetrics(r, p)),
    },
  ])
);
const heapMedians = {
  before: medians('before', heapMetrics),
  after: medians('after', heapMetrics),
};

const first = runs.after[0] ?? runs.before[0];
let md = `### Perf harness: \`${meta.workload}\` on ${meta.project === 'synthetic' ? `synthetic ${meta.shape}, ${first?.indexEntries ?? meta.size} entries` : `Chromatic webapp (${first?.indexEntries ?? '?'} entries)`}\n\n`;
md += single
  ? `- Build: ${meta.builds.before.label} (baseline, no comparison)\n`
  : `- Before: ${meta.builds.before.label}\n- After: ${meta.builds.after.label}\n`;
md += `- Runs: ${single ? runs.before.length : `before ${runs.before.length}, after ${runs.after.length}`}; median shown. Machine: ${meta.machine.cpu}, ${meta.machine.cores} cores, ${meta.machine.memoryGB} GB, ${meta.machine.platform}, Node ${meta.machine.node}. Harness ${meta.harness}.\n`;
if (failed.length) md += `- Failed runs: ${failed.join('; ')}\n`;
md += '\n' + TABLE_HEAD;
for (const [phase, key] of HEADLINES[meta.workload] ?? []) {
  const pm = phaseMedians[phase];
  if (!pm || (pm.before[key] === undefined && pm.after[key] === undefined)) continue;
  md += row(`${phase}: ${key}`, key, pm.before[key], pm.after[key]);
}
for (const key of Object.keys({ ...heapMedians.before, ...heapMedians.after }).filter((k) =>
  k.startsWith('heap end:')
)) {
  md += row(key, key, heapMedians.before[key], heapMedians.after[key]);
}

md += '\n<details><summary>All metrics per phase</summary>\n\n';
for (const phase of phaseNames) {
  const { before, after } = phaseMedians[phase];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => (before[k] ?? 0) !== 0 || (after[k] ?? 0) !== 0
  );
  if (keys.length === 0) continue;
  md += `#### ${phase}\n\n${TABLE_HEAD}`;
  for (const key of keys) md += row(key, key, before[key], after[key]);
  md += '\n';
}
md += `#### memory (after GC)\n\n${TABLE_HEAD}`;
for (const key of Object.keys({ ...heapMedians.before, ...heapMedians.after }))
  md += row(key, key, heapMedians.before[key], heapMedians.after[key]);
md += '\n</details>\n';

await writeFile(join(dir, 'report.md'), md);
await writeFile(
  join(dir, 'summary.json'),
  JSON.stringify({ meta, failed, phases: phaseMedians, heaps: heapMedians }, null, 2)
);
console.log(md);
