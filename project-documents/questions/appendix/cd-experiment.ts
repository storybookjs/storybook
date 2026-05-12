/**
 * Empirical change-detection experiment.
 *
 * Runs Storybook's real DependencyGraphBuilder against this monorepo's story files
 * to measure blast radius of synthetic file changes. Reproduces the exact algorithm
 * the change-detection backend uses in production, with aliases mirroring
 * code/.storybook/main.ts's viteFinal config.
 *
 * Run with (note --experimental-transform-types is required on `next` branch
 * because the change-detection module transitively uses TypeScript enums):
 *   node --experimental-transform-types --no-warnings \
 *     project-documents/questions/appendix/cd-experiment.ts
 *
 * Requires Node 22+.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
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

const projectRoot = '/Users/yannbraga/open-source/storybook/code';

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

const storyFiles = await findStoryFiles(projectRoot);
console.log(`Found ${storyFiles.length} story files`);

// Aliases mirror code/.storybook/main.ts viteFinal (the dogfood config).
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

const silent = { debug: () => {}, warn: () => {} };
const registry = new ParserRegistry({ defaultParsers: builtinImportParsers, pluginParsers: [] });
const resolver = new ChangeDetectionResolverFactory({ projectRoot, alias });
const workspaceRoots = new Set([projectRoot]);
const cache = new ParseResolveCache({
  registry, resolver, workspaceRoots, projectRoot, logger: silent,
});
const builder = new DependencyGraphBuilder({
  registry, resolver, workspaceRoots, projectRoot, cache, logger: silent,
});

const HARD_TIMEOUT_MS = 90_000;
const timeoutHandle = setTimeout(() => {
  console.error(`\nTimeout after ${HARD_TIMEOUT_MS}ms — exiting`);
  process.exit(2);
}, HARD_TIMEOUT_MS);
// Don't unref — on `next` branch the OXC worker pool's worker_threads need
// the main event loop to stay alive. unref'd timers + worker_threads = the
// process exits before await resolves.

const t0 = Date.now();
console.log('Building dependency graph (this may take 5-30s)...');
const { reverseIndex, graph } = await builder.build(storyFiles);
const elapsed = Date.now() - t0;

console.log(`\n=== Built dependency graph in ${elapsed}ms ===`);
console.log(`Story files (BFS roots): ${storyFiles.length}`);
console.log(`Files in dependency graph: ${graph.size}`);
console.log(`Files in reverse index: ${reverseIndex.asMap().size}`);

const probes = [
  'core/src/manager-api/modules/stories.ts',
  'core/src/manager-api/index.ts',
  'core/src/theming/create.ts',
  'core/src/theming/index.ts',
  'core/src/test/index.ts',
  'core/src/test/spy.ts',
  'core/src/test/expect.ts',
  'core/src/components/components/IconButton/IconButton.tsx',
  'core/src/components/index.ts',
  'core/src/manager/components/sidebar/Sidebar.tsx',
];
console.log('\n=== Empirical blast radius (barrel-aware change detection) ===');
for (const rel of probes) {
  const abs = normalize(`${projectRoot}/${rel}`);
  const importers = reverseIndex.lookup(abs);
  if (importers.size === 0) {
    console.log(`  ${rel}: NO STORIES`);
    continue;
  }
  const byDepth = new Map<number, string[]>();
  for (const [story, depth] of importers.entries()) {
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth)!.push(story);
  }
  const sortedDepths = [...byDepth.keys()].sort((a, b) => a - b);
  const lowestDepth = sortedDepths[0];
  console.log(`\n  ${rel}:`);
  console.log(`    total importers: ${importers.size}`);
  console.log(`    depth ${lowestDepth} (modified): ${byDepth.get(lowestDepth)!.length}`);
  for (const d of sortedDepths.slice(1, 6)) {
    console.log(`    depth ${d} (related): ${byDepth.get(d)!.length}`);
  }
  if (sortedDepths.length > 6) console.log(`    ... ${sortedDepths.length - 6} more depth tiers`);
}

console.log('\n=== Verifications ===');
const cssFile = `${projectRoot}/addons/onboarding/example-stories/button.css`;
const cssImporters = reverseIndex.lookup(normalize(cssFile));
console.log(`CSS file (button.css) importers: ${cssImporters.size}  ← should be 0 if CSS-blind claim holds`);

const dts = `${projectRoot}/addons/vitest/src/typings.d.ts`;
const dtsImporters = reverseIndex.lookup(normalize(dts));
console.log(`.d.ts file (typings.d.ts) importers: ${dtsImporters.size}  ← should be 0 (TS auto-pickup, not imported)`);

console.log('\n=== Top 20 files by blast radius ===');
const blast = [...reverseIndex.asMap().entries()].map(([dep, m]) => ({ dep, count: m.size }));
blast.sort((a, b) => b.count - a.count);
for (const { dep, count } of blast.slice(0, 20)) {
  console.log(`  ${count.toString().padStart(4)} stories  ${dep.replace(`${projectRoot}/`, '')}`);
}

// Dispose the OXC worker pool so Node can exit cleanly (on `next` branch the
// parser uses worker threads which keep the event loop alive).
try {
  const wp = await import('../../../code/core/src/oxc-parser/worker-pool.ts');
  await wp.disposeOxcParsePool().catch(() => undefined);
} catch {}
process.exit(0);
