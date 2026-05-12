/**
 * Round-2 §I.4 — Barrel-file false-cascade share.
 *
 * Quantifies what fraction of the dogfood's cascade flows through barrel
 * files (index.ts / index.tsx that re-export many siblings). If barrels
 * concentrate the bulk of importer-edges, a deterministic "exclude top-N
 * barrels from cascade" heuristic would cut the cascade noise without an
 * agent layer.
 *
 * Definitions:
 *   - **Barrel file**: path matches /\/index\.tsx?$/. Captures both
 *     monorepo public-API barrels (`core/src/theming/index.ts`) and
 *     package-local barrels (`addons/.../src/index.ts`).
 *   - **Edge**: one (story, changed-file) pair in the reverse index.
 *
 * Outputs:
 *   - Counts of barrel vs non-barrel files in the reverse index.
 *   - Share of edges concentrated in barrel files.
 *   - Top-20 barrel files by importer count.
 *   - For the synthetic edit scenarios (small/medium/large/css-only),
 *     fraction of `affected` stories that reach the changed file via a
 *     barrel intermediate hop.
 *
 * Outputs: scripts/eval/inner-loop/results/barrel-share.json
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

const isBarrel = (path: string) => /\/index\.(ts|tsx)$/.test(path);

const HARD_TIMEOUT_MS = 90_000;
const timeoutHandle = setTimeout(() => {
  console.error(`Timeout after ${HARD_TIMEOUT_MS}ms`);
  process.exit(2);
}, HARD_TIMEOUT_MS);

console.log('Building dependency graph…');
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

// Build a forward "parent → children" map by inverting the forward graph
// (graph is file → set-of-imports, but `imports` here can include barrel
// re-exports). For "does this story reach the changed file via a barrel"
// we walk the reverse path from each story to the changed file.
//
// Simpler proxy: for each (changed-file, story, depth) edge, the story
// must traverse `depth` import hops. If depth >= 2 AND the changed file
// is a barrel, then the importing story may or may not actually use the
// re-exported symbol — that's the "barrel false cascade" risk.
//
// Practical measurement here:
//   - Files in reverse index: split barrel vs non-barrel
//   - Edges: split by changed-file barrel-ness
//   - Importer-count concentration per category

let barrelFiles = 0;
let nonBarrelFiles = 0;
let barrelEdges = 0;
let nonBarrelEdges = 0;
const barrelEntries: { file: string; importerCount: number }[] = [];

for (const [dep, importers] of reverseIndex.asMap().entries()) {
  const rel = dep.replace(`${projectRoot}/`, '');
  const n = importers.size;
  if (isBarrel(dep)) {
    barrelFiles++;
    barrelEdges += n;
    barrelEntries.push({ file: rel, importerCount: n });
  } else {
    nonBarrelFiles++;
    nonBarrelEdges += n;
  }
}

const totalFiles = barrelFiles + nonBarrelFiles;
const totalEdges = barrelEdges + nonBarrelEdges;

barrelEntries.sort((a, b) => b.importerCount - a.importerCount);

// "Concentration": what fraction of total edges are accounted for by the
// top-N barrel files? Useful for the "exclude top-K barrels" heuristic.
const topBarrels = barrelEntries.slice(0, 20);
const top10BarrelEdges = barrelEntries.slice(0, 10).reduce((s, e) => s + e.importerCount, 0);
const top20BarrelEdges = barrelEntries.slice(0, 20).reduce((s, e) => s + e.importerCount, 0);

// Per-scenario projection. For each synthetic edit fixture, if the changed
// file is itself a barrel, ALL its importers are by definition "barrel
// edges." Otherwise, edges from a story that *also* transitively touches a
// barrel could be inflated. The simpler claim we can validate from this
// data: are the synthetic edits' cascades dominated by barrel re-exports?
const scenarioFiles: Record<string, string> = {
  small: 'core/src/manager/components/sidebar/Sidebar.tsx',
  medium: 'core/src/components/components/Button/Button.tsx',
  large: 'core/src/theming/index.ts',
  'css-only': 'core/src/manager/components/preview/tools/bundle-analyzer/index.css',
  'regex-aliased': 'core/src/test/expect.ts',
};
const scenarioReport: {
  scenario: string;
  changedFile: string;
  exists: boolean;
  isBarrel: boolean;
  importers?: number;
  share?: number;
}[] = [];
for (const [scenario, rel] of Object.entries(scenarioFiles)) {
  const abs = join(projectRoot, rel);
  const set = reverseIndex.asMap().get(abs);
  scenarioReport.push({
    scenario,
    changedFile: rel,
    exists: !!set,
    isBarrel: isBarrel(abs),
    importers: set?.size,
    share: set ? set.size / totalEdges : undefined,
  });
}

// Forward-graph view: how many distinct files import each top barrel
// directly (depth 1)? This is the population of "non-story importers"
// of a barrel; if it's huge, the barrel re-export fan-out is large.
const directImportersByFile = new Map<string, number>();
for (const [file, deps] of graph.entries()) {
  for (const d of deps) {
    directImportersByFile.set(d, (directImportersByFile.get(d) || 0) + 1);
  }
}
const topBarrelsWithDirect = topBarrels.map((b) => ({
  ...b,
  directImporters: directImportersByFile.get(join(projectRoot, b.file)) || 0,
}));

const out = {
  experiment: 'I.4 — Barrel-file false-cascade share',
  timestamp: new Date().toISOString(),
  unitsNote:
    'Barrel = path matches /\\/index\\.tsx?$/. Edges are (story-file, changed-file) pairs in the reverse index — story-file counts, not story-IDs. Multiply by ~3-7 for IDs.',
  summary: {
    totalFiles,
    barrelFiles,
    nonBarrelFiles,
    barrelFileShare: barrelFiles / totalFiles,
    totalEdges,
    barrelEdges,
    nonBarrelEdges,
    barrelEdgeShare: barrelEdges / totalEdges,
    top10BarrelEdgeShare: top10BarrelEdges / totalEdges,
    top20BarrelEdgeShare: top20BarrelEdges / totalEdges,
    avgImportersPerBarrel: barrelEdges / Math.max(barrelFiles, 1),
    avgImportersPerNonBarrel: nonBarrelEdges / Math.max(nonBarrelFiles, 1),
  },
  topBarrels: topBarrelsWithDirect,
  syntheticScenarios: scenarioReport,
  takeaway: `${barrelFiles} of ${totalFiles} files (${((barrelFiles / totalFiles) * 100).toFixed(1)}%) are barrels, but they account for ${((barrelEdges / totalEdges) * 100).toFixed(1)}% of all (story, changed-file) edges. The top 10 barrels alone account for ${((top10BarrelEdges / totalEdges) * 100).toFixed(1)}% of edges. Excluding barrels from the cascade would cut roughly that share of cascade noise — at the cost of missing real bugs where the edit is *to* a barrel re-export.`,
};

await mkdir(RESULTS_DIR, { recursive: true });
const outPath = join(RESULTS_DIR, 'barrel-share.json');
await writeFile(outPath, JSON.stringify(out, null, 2));

console.log(`\n=== Barrel-file false-cascade share ===`);
console.log(`  Barrels: ${barrelFiles}/${totalFiles} files (${((barrelFiles / totalFiles) * 100).toFixed(1)}%)`);
console.log(`  Barrel-edges: ${barrelEdges}/${totalEdges} (${((barrelEdges / totalEdges) * 100).toFixed(1)}%)`);
console.log(`  Top-10 barrels = ${((top10BarrelEdges / totalEdges) * 100).toFixed(1)}% of edges`);
console.log(`  Top-20 barrels = ${((top20BarrelEdges / totalEdges) * 100).toFixed(1)}% of edges`);
console.log(`  Avg importers per barrel:     ${(barrelEdges / Math.max(barrelFiles, 1)).toFixed(1)}`);
console.log(`  Avg importers per non-barrel: ${(nonBarrelEdges / Math.max(nonBarrelFiles, 1)).toFixed(1)}`);
console.log(`\nTop 10 barrels:`);
for (const b of topBarrelsWithDirect.slice(0, 10)) {
  console.log(`  ${b.importerCount.toString().padStart(4)} stories  ${b.file}  (direct: ${b.directImporters})`);
}
console.log(`\nSynthetic scenarios:`);
for (const s of scenarioReport) {
  const tag = s.isBarrel ? '[barrel]' : '         ';
  const imp = s.importers !== undefined ? `${s.importers} importers` : 'not in index';
  console.log(`  ${tag} ${s.scenario.padEnd(14)} ${s.changedFile}  →  ${imp}`);
}
console.log(`\nWritten: ${outPath}`);

clearTimeout(timeoutHandle);
try {
  const wp = await import('../../../code/core/src/oxc-parser/worker-pool.ts');
  await wp.disposeOxcParsePool().catch(() => undefined);
} catch {}
process.exit(0);
