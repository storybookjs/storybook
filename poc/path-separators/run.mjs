// Runs every path-separator probe in its own Node process and writes a report.
//
//   node poc/path-separators/run.mjs              # all probes
//   node poc/path-separators/run.mjs esbuild vite # selected probes
//
// Run `yarn` at the repository root first; probes use the repo's installed packages.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { POC_DIR } from './lib/context.mjs';

const TIMEOUT_MS = 180_000;

const available = readdirSync(path.join(POC_DIR, 'probes'))
  .filter((file) => file.endsWith('.mjs'))
  .map((file) => file.slice(0, -'.mjs'.length))
  .sort();
const selected = process.argv.slice(2);
const unknown = selected.filter((name) => !available.includes(name));
if (unknown.length) {
  console.error(`Unknown probe(s): ${unknown.join(', ')}. Available: ${available.join(', ')}`);
  process.exit(1);
}
const probes = selected.length ? selected : available;

const outDir = path.join(POC_DIR, '.tmp', 'results');
mkdirSync(outDir, { recursive: true });

const results = [];
for (const probe of probes) {
  const outFile = path.join(outDir, `${probe}.json`);
  process.stdout.write(`- ${probe} ... `);
  const started = Date.now();
  const child = spawnSync(
    process.execPath,
    [path.join(POC_DIR, 'lib', 'child.mjs'), probe, outFile],
    {
      cwd: POC_DIR,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  let result;
  try {
    result = JSON.parse(readFileSync(outFile, 'utf8'));
  } catch {
    result = {
      probe,
      claims: [],
      fatal: child.error ? String(child.error) : `exited with ${child.status}, no result file`,
    };
  }
  result.durationMs = Date.now() - started;
  result.stderr = child.stderr?.slice(-4000) ?? '';
  results.push(result);
  const failed = result.claims.filter((c) => !c.pass).length;
  console.log(
    result.fatal
      ? `FATAL (${result.claims.length} claims recorded before it)`
      : `${result.claims.length - failed}/${result.claims.length} as predicted`
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  release: os.release(),
  node: process.version,
  cwd: process.cwd(),
  results,
};
const reportFile = path.join(POC_DIR, `report-${process.platform}.json`);
writeFileSync(reportFile, JSON.stringify(report, null, 2));

console.log('\nClaims that did not behave as predicted:');
let mismatches = 0;
for (const result of results) {
  if (result.fatal) {
    mismatches++;
    console.log(`\n[${result.probe}] FATAL\n${result.fatal}`);
  }
  for (const c of result.claims.filter((c) => !c.pass)) {
    mismatches++;
    console.log(`\n[${result.probe}] ${c.id}: ${c.claim}`);
    console.log(`  expected: ${JSON.stringify(c.expected)}`);
    console.log(`  observed: ${JSON.stringify(c.observed)}`);
    if (c.error) console.log(`  error: ${c.error.split('\n')[0]}`);
  }
}
if (!mismatches) console.log('  none');
console.log(`\nFull report: ${reportFile}`);
