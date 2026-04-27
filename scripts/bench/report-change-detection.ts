import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.join(__dirname, '..', '..');
const BENCH_DIR = path.join(REPO_ROOT, 'scripts', 'bench');
const RESULTS_DIR = path.join(BENCH_DIR, 'results');
const BASELINE_PATH = path.join(BENCH_DIR, 'baselines', 'change-detection-next.json');

interface BenchResult {
  timestamp: string;
  git: { branch: string; sha: string };
  median: { coldStartMs: number };
}

function loadLatestResult(): BenchResult {
  const files = readdirSync(RESULTS_DIR)
    .filter((f) => f.startsWith('change-detection-'))
    .sort();
  if (files.length === 0) {
    throw new Error('No results found. Run yarn benchmark:change-detection first.');
  }
  return JSON.parse(readFileSync(path.join(RESULTS_DIR, files[files.length - 1]), 'utf-8')) as BenchResult;
}

function loadBaseline(): BenchResult | null {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as BenchResult;
  } catch {
    return null;
  }
}

function formatRatio(base: number, current: number): string {
  if (base < 0 || current < 0) {
    return 'n/a';
  }
  const ratio = base / current;
  return `${ratio.toFixed(2)}x`;
}

function formatMs(ms: number): string {
  return ms < 0 ? 'n/a' : `${ms}`;
}

const result = loadLatestResult();
const baseline = loadBaseline();

console.log('## Change-Detection Benchmark\n');
console.log(
  `Branch: \`${result.git.branch}\` (\`${result.git.sha.slice(0, 7)}\`) — ${result.timestamp}\n`
);
if (baseline) {
  console.log(
    `Baseline: \`${baseline.git.branch}\` (\`${baseline.git.sha.slice(0, 7)}\`) — ${baseline.timestamp}\n`
  );
}

console.log('| Scenario      | Baseline (ms) | This branch (ms) | Ratio |');
console.log('|---------------|---------------|------------------|-------|');

const scenarios: Array<[string, keyof BenchResult['median']]> = [
  ['cold-start', 'coldStartMs'],
];

for (const [label, key] of scenarios) {
  const cur = result.median[key];
  const base = baseline?.median[key] ?? -1;
  console.log(
    `| ${label.padEnd(13)} | ${formatMs(base).padEnd(13)} | ${formatMs(cur).padEnd(16)} | ${formatRatio(base, cur).padEnd(5)} |`
  );
}
