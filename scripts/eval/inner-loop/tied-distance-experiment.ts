/**
 * Round-2 §I.3 — tied-distance distribution.
 *
 * For each file in the reverse index, find the minimum depth at which
 * any story imports it, then count how many stories share that minimum
 * depth (these are all flagged `modified` together). Outputs the
 * distribution + summary stats.
 *
 * Use case: validates the "70.4% single-modified case" claim from §I.1
 * and computes useful percentiles for the iteration-1 UI design (e.g.
 * does the lead-with-modified-story-card UX need to handle 5+ ties?).
 */
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from 'pathe';
import {
  ChangeDetectionResolverFactory,
  DependencyGraphBuilder,
  ParseResolveCache,
} from '../../../code/core/src/core-server/change-detection/dependency-graph/index.ts';
import {
  ParserRegistry,
  builtinImportParsers,
} from '../../../code/core/src/core-server/change-detection/parser-registry/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, 'results');
const projectRoot = '/Users/yannbraga/open-source/storybook/code';

const alias: Record<string, string> = {
  'storybook/internal/components': `${projectRoot}/core/src/components/index.ts`,
  'storybook/manager-api': `${projectRoot}/core/src/manager-api/index.ts`,
  'storybook/theming/create': `${projectRoot}/core/src/theming/create.ts`,
  'storybook/theming': `${projectRoot}/core/src/theming/index.ts`,
  'storybook/test': `${projectRoot}/core/src/test/index.ts`,
  'storybook/preview-api': `${projectRoot}/core/src/preview-api/index.ts`,
  'storybook/internal/types': `${projectRoot}/core/src/types/index.ts`,
  'storybook/actions': `${projectRoot}/core/src/actions/index.ts`,
};

async function findStoryFiles(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const path = join(dir, e.name);
    if (e.isDirectory()) await findStoryFiles(path, acc);
    else if (/\.stories\.(tsx?|jsx?)$/.test(e.name)) acc.push(normalize(path));
  }
  return acc;
}

const HARD_TIMEOUT_MS = 60_000;
const timeoutHandle = setTimeout(() => {
  console.error(`Timeout after ${HARD_TIMEOUT_MS}ms`);
  process.exit(2);
}, HARD_TIMEOUT_MS);

console.log('Building dependency graph…');
const storyFiles = await findStoryFiles(projectRoot);
const silent = { debug: () => {}, warn: () => {} };
const registry = new ParserRegistry({ defaultParsers: builtinImportParsers, pluginParsers: [] });
const resolver = new ChangeDetectionResolverFactory({ projectRoot, alias });
const cache = new ParseResolveCache({
  registry,
  resolver,
  workspaceRoots: new Set([projectRoot]),
  projectRoot,
  logger: silent,
});
const builder = new DependencyGraphBuilder({
  registry,
  resolver,
  workspaceRoots: new Set([projectRoot]),
  projectRoot,
  cache,
  logger: silent,
});
const { reverseIndex } = await builder.build(storyFiles);

// For each file in the reverse index, compute |modified|: the number of
// importing stories tied at the minimum depth.
const tieSizes: number[] = [];
for (const importers of reverseIndex.asMap().values()) {
  if (importers.size === 0) continue;
  let minDepth = Infinity;
  for (const d of importers.values()) if (d < minDepth) minDepth = d;
  let tied = 0;
  for (const d of importers.values()) if (d === minDepth) tied++;
  tieSizes.push(tied);
}

tieSizes.sort((a, b) => a - b);
const total = tieSizes.length;
const mean = tieSizes.reduce((s, n) => s + n, 0) / total;
const median = tieSizes[Math.floor(total / 2)];
const p75 = tieSizes[Math.floor(total * 0.75)];
const p90 = tieSizes[Math.floor(total * 0.9)];
const p95 = tieSizes[Math.floor(total * 0.95)];
const p99 = tieSizes[Math.floor(total * 0.99)];
const max = tieSizes[total - 1];

// Stratified by tie size
const singleModified = tieSizes.filter((n) => n === 1).length;
const tieSizesNonTrivial = tieSizes.filter((n) => n >= 2);
const meanWhenTied = tieSizesNonTrivial.reduce((s, n) => s + n, 0) / tieSizesNonTrivial.length;
const medianWhenTied = tieSizesNonTrivial[Math.floor(tieSizesNonTrivial.length / 2)];

const out = {
  experiment: 'I.3 — Tied-distance distribution',
  timestamp: new Date().toISOString(),
  totalFiles: total,
  unitsNote:
    'Each file in the reverse index → count of stories tied at the minimum import depth (= |modified| if that file is edited). Counts are story files, not story IDs.',
  summary: {
    singleModified,
    singleModifiedShare: singleModified / total,
    mean: Math.round(mean * 100) / 100,
    median,
    p75,
    p90,
    p95,
    p99,
    max,
    meanWhenTied: Math.round(meanWhenTied * 100) / 100,
    medianWhenTied,
  },
  takeaway: `${singleModified} of ${total} files (${((singleModified / total) * 100).toFixed(1)}%) resolve to exactly 1 modified story when edited. The median tie size is ${median}. Across the ${tieSizesNonTrivial.length} files with ties, the median tie size is ${medianWhenTied} and the 90th percentile is ${p90}. The "lead with one modified card" UX is sufficient for ${((singleModified / total) * 100).toFixed(1)}% of edits; for the remaining ${((1 - singleModified / total) * 100).toFixed(1)}%, the UI needs to handle multiple modified cards (median ${medianWhenTied} stories, occasionally up to ${max}).`,
};

await mkdir(RESULTS_DIR, { recursive: true });
await writeFile(join(RESULTS_DIR, 'tied-distance.json'), JSON.stringify(out, null, 2));

console.log(`\n=== Tied-distance distribution across ${total} files ===`);
console.log(`  Single-modified: ${singleModified} (${((singleModified / total) * 100).toFixed(1)}%)`);
console.log(`  Mean tie size:   ${mean.toFixed(2)} (when tied: ${meanWhenTied.toFixed(2)})`);
console.log(`  Median tie size: ${median} (when tied: ${medianWhenTied})`);
console.log(`  p75 / p90 / p95 / p99 / max: ${p75} / ${p90} / ${p95} / ${p99} / ${max}`);
console.log(`\nWritten: ${join(RESULTS_DIR, 'tied-distance.json')}`);

clearTimeout(timeoutHandle);
try {
  const wp = await import('../../../code/core/src/oxc-parser/worker-pool.ts');
  await wp.disposeOxcParsePool().catch(() => undefined);
} catch {}
process.exit(0);
