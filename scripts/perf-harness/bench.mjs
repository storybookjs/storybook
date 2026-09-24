// One command per workload: prepares a project for each build, runs the workload against both
// builds alternately, and writes report.md (before, after, ratio; medians over runs).
//
// Usage: node bench.mjs <workload> --before <ref> [--after <ref>] [--runs 3] [--project <name>]
//          [--size <n>] [--shape balanced|wide|docgen] [--out <dir>] [workload options]
// A ref is local:<path to a compiled storybook checkout> or canary:<sha>. See README.md.
// Without --after, it runs the --before build only and reports one column (a baseline).
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { resolveBuild } from './lib/builds.mjs';
import { DEFAULT_WORK_DIR, HARNESS_DIR, log, run } from './lib/util.mjs';
import { WORKLOADS, workloadOptions } from './workloads/index.mjs';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    before: { type: 'string' },
    after: { type: 'string' },
    runs: { type: 'string', default: '3' },
    project: { type: 'string' },
    size: { type: 'string' },
    shape: { type: 'string' },
    out: { type: 'string' },
    port: { type: 'string', default: '6106' },
    'work-dir': { type: 'string', default: DEFAULT_WORK_DIR },
    chromatic: { type: 'string', default: join(process.env.HOME, 'dev/chromaui/chromatic') },
    'chromatic-ref': { type: 'string' },
    'prepare-only': { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    ...workloadOptions,
  },
});

const workloadName = positionals[0];
const workload = WORKLOADS[workloadName];
if (!workload || !opts.before) {
  console.error(
    `Usage: node bench.mjs <${Object.keys(WORKLOADS).join('|')}> --before <ref> [--after <ref>] [--runs 3]`
  );
  process.exit(1);
}
const projectName = opts.project ?? workload.defaultProject;
if (!workload.projects.includes(projectName)) {
  throw new Error(`${workloadName} does not run on ${projectName}`);
}
const shape = opts.shape ?? (workloadName === 'docgen' ? 'docgen' : 'balanced');
const size = Number(opts.size ?? (shape === 'docgen' ? 2000 : 5000));
const workDir = resolve(opts['work-dir']);
const projectLabel = projectName === 'synthetic' ? `synthetic-${shape}-${size}` : projectName;
const out = resolve(
  opts.out ??
    join(
      HARNESS_DIR,
      'results',
      `${workloadName}-${projectLabel}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`
    )
);
await mkdir(out, { recursive: true });

// Without --after, the harness runs one build only (a baseline).
const sides = opts.after ? ['before', 'after'] : ['before'];
const builds = {};
for (const side of sides) {
  builds[side] = await resolveBuild(opts[side], { workDir });
}

const projectModule = await import(`./projects/${projectName}.mjs`);
const chromaticRef = opts['chromatic-ref'] ?? projectModule.DEFAULT_CHROMATIC_REF;
const dirs = {};
for (const side of sides) {
  dirs[side] =
    projectName === 'synthetic'
      ? await projectModule.ensureProject({ build: builds[side], workDir, size, shape })
      : await projectModule.ensureProject({
          build: builds[side],
          chromaticDir: resolve(opts.chromatic),
          chromaticRef,
        });
  log(`${side}: ${builds[side].label} → ${dirs[side]}`);
}

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: HARNESS_DIR, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};
const meta = {
  workload: workloadName,
  project: projectName,
  shape: projectName === 'synthetic' ? shape : undefined,
  size: projectName === 'synthetic' ? size : undefined,
  chromaticRef: projectName === 'chromatic' ? chromaticRef : undefined,
  runs: Number(opts.runs),
  builds: Object.fromEntries(
    Object.entries(builds).map(([side, b]) => [
      side,
      { ref: opts[side], label: b.label, key: b.key, sha: b.sha },
    ])
  ),
  machine: {
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memoryGB: Math.round(totalmem() / 2 ** 30),
    platform: `${process.platform} ${process.arch}`,
    node: process.version,
  },
  harness: git('rev-parse', '--short', 'HEAD'),
  options: Object.fromEntries(
    Object.keys(workloadOptions)
      .filter((k) => opts[k] !== undefined)
      .map((k) => [k, opts[k]])
  ),
  startedAt: new Date().toISOString(),
};
await writeFile(join(out, 'meta.json'), JSON.stringify(meta, null, 2));
if (opts['prepare-only']) {
  process.exit(0);
}

// Runs alternate so slow drift on the machine hits both sides: before, after, after, before, ...
const passThrough = Object.entries(meta.options).flatMap(([k, v]) => [`--${k}`, String(v)]);
for (let i = 1; i <= meta.runs; i += 1) {
  const order = i % 2 ? sides : [...sides].reverse();
  for (const side of order) {
    const file = join(out, `${side}-${i}.json`);
    log(`run ${i}/${meta.runs} ${side}`);
    await run(process.execPath, [
      join(HARNESS_DIR, 'run.mjs'),
      '--workload',
      workloadName,
      '--project',
      projectName,
      '--dir',
      dirs[side],
      '--shape',
      shape,
      '--side',
      side,
      '--build-label',
      builds[side].label,
      '--build-key',
      builds[side].key,
      '--port',
      opts.port,
      '--out',
      file,
      ...(opts.headed ? ['--headed'] : []),
      ...passThrough,
    ]).catch((error) => log(`run ${i} ${side} failed: ${error.message}; continuing`));
  }
}

await run(process.execPath, [join(HARNESS_DIR, 'report.mjs'), out]);
log(`report: ${join(out, 'report.md')}`);
