/**
 * Round-2 follow-up I.1: Module-graph blast-radius histogram across the
 * entire dogfood reverse index. Complements cd-experiment.ts (which probes
 * a hand-picked file list) by characterising the *distribution* of importer
 * counts across every file in the reverse index.
 *
 * Output: scripts/eval/inner-loop/results/module-graph.json
 *
 * Run with:
 *   node --experimental-transform-types --no-warnings \
 *     scripts/eval/inner-loop/module-graph-experiment.ts
 */
import { readdir, mkdir, writeFile } from 'node:fs/promises';
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

const HARD_TIMEOUT_MS = 90_000;
const timeoutHandle = setTimeout(() => {
  console.error(`Timeout after ${HARD_TIMEOUT_MS}ms`);
  process.exit(2);
}, HARD_TIMEOUT_MS);

console.log('Building dependency graph for dogfood...');
const t0 = Date.now();
const storyFiles = await findStoryFiles(projectRoot);
const silent = { debug: () => {}, warn: () => {} };
const registry = new ParserRegistry({ defaultParsers: builtinImportParsers, pluginParsers: [] });
const resolver = new ChangeDetectionResolverFactory({ projectRoot, alias });
const workspaceRoots = new Set([projectRoot]);
const cache = new ParseResolveCache({
  registry,
  resolver,
  workspaceRoots,
  projectRoot,
  logger: silent,
});
const builder = new DependencyGraphBuilder({
  registry,
  resolver,
  workspaceRoots,
  projectRoot,
  cache,
  logger: silent,
});
const { reverseIndex, graph } = await builder.build(storyFiles);
const buildMs = Date.now() - t0;

console.log(`Graph built in ${buildMs}ms (${storyFiles.length} story files, ${graph.size} files in graph, ${reverseIndex.asMap().size} files in reverse index).`);

// Build histogram
const buckets = [
  { label: '1', min: 1, max: 1 },
  { label: '2-5', min: 2, max: 5 },
  { label: '6-10', min: 6, max: 10 },
  { label: '11-50', min: 11, max: 50 },
  { label: '51-100', min: 51, max: 100 },
  { label: '101-500', min: 101, max: 500 },
  { label: '501-1000', min: 501, max: 1000 },
  { label: '1000+', min: 1001, max: Infinity },
];
const histogram = buckets.map((b) => ({ ...b, count: 0 }));
const allEntries: { file: string; importerCount: number }[] = [];

for (const [dep, importers] of reverseIndex.asMap().entries()) {
  const n = importers.size;
  allEntries.push({ file: dep.replace(`${projectRoot}/`, ''), importerCount: n });
  for (const b of histogram) {
    if (n >= b.min && n <= b.max) {
      b.count++;
      break;
    }
  }
}

const totalFiles = allEntries.length;
const totalStories = storyFiles.length;
allEntries.sort((a, b) => b.importerCount - a.importerCount);

// Depth-tier distribution: for each importing-story relationship, group by depth
const depthHistogram = new Map<number, number>();
let totalEdges = 0;
for (const importers of reverseIndex.asMap().values()) {
  for (const depth of importers.values()) {
    depthHistogram.set(depth, (depthHistogram.get(depth) || 0) + 1);
    totalEdges++;
  }
}
const depthRows = [...depthHistogram.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([depth, count]) => ({ depth, count, share: count / totalEdges }));

// "Tied at lowest distance" — for each story file, find the importers it
// reaches at minimum depth, and see how many files are tied at that minimum.
// In practice we want the inverse: for each changed file, the modified set is
// determined by its lowest-distance importing story per file. Compute the
// distribution of |modified| across all files in the reverse index.
const modifiedSizeBuckets = [0, 0, 0, 0, 0]; // 1, 2-3, 4-9, 10-49, 50+
let totalReverseFiles = 0;
for (const [, importers] of reverseIndex.asMap().entries()) {
  if (importers.size === 0) continue;
  totalReverseFiles++;
  let minDepth = Infinity;
  for (const d of importers.values()) if (d < minDepth) minDepth = d;
  let tied = 0;
  for (const d of importers.values()) if (d === minDepth) tied++;
  if (tied === 1) modifiedSizeBuckets[0]++;
  else if (tied <= 3) modifiedSizeBuckets[1]++;
  else if (tied <= 9) modifiedSizeBuckets[2]++;
  else if (tied <= 49) modifiedSizeBuckets[3]++;
  else modifiedSizeBuckets[4]++;
}
const modifiedSizeHistogram = [
  { label: '1 (single modified)', count: modifiedSizeBuckets[0] },
  { label: '2-3', count: modifiedSizeBuckets[1] },
  { label: '4-9', count: modifiedSizeBuckets[2] },
  { label: '10-49', count: modifiedSizeBuckets[3] },
  { label: '50+', count: modifiedSizeBuckets[4] },
];

// Top-50 files for the report (already sorted desc).
const top50 = allEntries.slice(0, 50);

// "Long tail": share of files with ≤10 importers (the "good" case).
const lowFanIn = allEntries.filter((e) => e.importerCount <= 10).length;
const highFanIn = allEntries.filter((e) => e.importerCount > 100).length;
const veryHighFanIn = allEntries.filter((e) => e.importerCount > 500).length;

// Serialise the FORWARD dependency graph (file -> set of imports) as a
// flat Record<string, string[]> for the HTML report's per-run file-level
// graph view. Path are relative to projectRoot (../code/) to keep size down.
const forwardEdges: Record<string, string[]> = {};
for (const [file, deps] of graph.entries()) {
  const rel = file.replace(`${projectRoot}/`, '');
  forwardEdges[rel] = [...deps].map((d) => d.replace(`${projectRoot}/`, ''));
}

const out = {
  timestamp: new Date().toISOString(),
  projectRoot,
  buildMs,
  totalStoryFiles: totalStories,
  totalFilesInGraph: graph.size,
  totalFilesInReverseIndex: totalFiles,
  unitsNote:
    'All counts in this report are *story-file* counts, not *story-ID* counts. Each story file can contain multiple story exports; e.g. one file with 7 named stories counts as 1 importer here but emits 7 status rows when change-detection fires. Multiply by ~3-7 for typical story-ID counts.',
  forwardEdges,
  histogram,
  summary: {
    lowFanIn_lte10: { count: lowFanIn, share: lowFanIn / totalFiles },
    highFanIn_gt100: { count: highFanIn, share: highFanIn / totalFiles },
    veryHighFanIn_gt500: { count: veryHighFanIn, share: veryHighFanIn / totalFiles },
  },
  depthHistogram: depthRows,
  modifiedSizeHistogram: {
    description:
      'For each file in the reverse index, count how many stories tie at the LOWEST depth (i.e. would be marked `modified` if the file were edited). Bucketed.',
    totalFiles: totalReverseFiles,
    buckets: modifiedSizeHistogram,
  },
  top50FilesByImporterCount: top50,
};

await mkdir(RESULTS_DIR, { recursive: true });
const outPath = join(RESULTS_DIR, 'module-graph.json');
await writeFile(outPath, JSON.stringify(out, null, 2));

console.log(`\nWrote: ${outPath}`);
console.log(`\nKey findings:`);
console.log(`  Total files in reverse index: ${totalFiles}`);
console.log(`  Files with ≤10 importers (good case): ${lowFanIn} (${((lowFanIn / totalFiles) * 100).toFixed(1)}%)`);
console.log(`  Files with >100 importers: ${highFanIn} (${((highFanIn / totalFiles) * 100).toFixed(1)}%)`);
console.log(`  Files with >500 importers (cascade case): ${veryHighFanIn} (${((veryHighFanIn / totalFiles) * 100).toFixed(1)}%)`);

console.log(`\nBlast-radius histogram:`);
for (const b of histogram) {
  const bar = '█'.repeat(Math.round((b.count / totalFiles) * 50));
  console.log(`  ${b.label.padEnd(10)} ${b.count.toString().padStart(5)} files  ${bar}`);
}

console.log(`\nDepth distribution (edges, not files):`);
for (const r of depthRows.slice(0, 12)) {
  const bar = '█'.repeat(Math.round((r.share) * 50));
  console.log(`  depth ${r.depth.toString().padStart(2)}  ${r.count.toString().padStart(6)} edges (${(r.share * 100).toFixed(1)}%)  ${bar}`);
}
if (depthRows.length > 12) console.log(`  ... ${depthRows.length - 12} deeper tiers`);

console.log(`\n|modified| (tied-at-lowest-depth) distribution:`);
for (const b of modifiedSizeHistogram) {
  const share = totalReverseFiles > 0 ? b.count / totalReverseFiles : 0;
  const bar = '█'.repeat(Math.round(share * 50));
  console.log(`  ${b.label.padEnd(22)} ${b.count.toString().padStart(5)} (${(share * 100).toFixed(1)}%)  ${bar}`);
}

clearTimeout(timeoutHandle);

// Dispose the OXC worker pool so Node can exit cleanly.
try {
  const wp = await import('../../../code/core/src/oxc-parser/worker-pool.ts');
  await wp.disposeOxcParsePool().catch(() => undefined);
} catch {}
process.exit(0);
