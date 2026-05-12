/**
 * Round-2 §I.5 — precompute per-scenario depth maps in a standalone
 * process (so `run.ts` doesn't have to build the dep graph inline; the
 * graph build conflicts with a live Storybook UI's OXC parser pool when
 * run in-process).
 *
 * Builds the dependency graph ONCE, then for every scenario writes a JSON
 * `{ storyId → depth }` mapping derived from the reverse index.
 *
 * Output: results/depth-maps/<scenario>.json
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
import { SCENARIOS } from './scenarios.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'results', 'depth-maps');
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

console.log('Building dependency graph…');
const t0 = Date.now();
const storyFiles = await findStoryFiles(projectRoot);
const silent = { debug: () => {}, warn: () => {} };
const registry = new ParserRegistry({ defaultParsers: builtinImportParsers, pluginParsers: [] });
const resolver = new ChangeDetectionResolverFactory({ projectRoot, alias });
const workspaceRoots = new Set([projectRoot]);
const cache = new ParseResolveCache({ registry, resolver, workspaceRoots, projectRoot, logger: silent });
const builder = new DependencyGraphBuilder({ registry, resolver, workspaceRoots, projectRoot, cache, logger: silent });
const { reverseIndex } = await builder.build(storyFiles);
console.log(`Graph built in ${Date.now() - t0}ms.`);

const STORYBOOK_URL = process.env.STORYBOOK_URL || 'http://localhost:6006';
const r = await fetch(`${STORYBOOK_URL}/index.json`);
if (!r.ok) {
  console.error(`Failed to fetch ${STORYBOOK_URL}/index.json: HTTP ${r.status}`);
  process.exit(3);
}
const index = (await r.json()) as { entries: Record<string, { importPath?: string }> };
console.log(`Index: ${Object.keys(index.entries).length} stories.`);

const storyIdToFile: Record<string, string> = {};
for (const [storyId, entry] of Object.entries(index.entries)) {
  if (entry.importPath) {
    const rel = entry.importPath.replace(/^\.\/?/, '');
    storyIdToFile[storyId] = normalize(join(projectRoot, rel));
  }
}

await mkdir(OUT_DIR, { recursive: true });

const summary: Array<{
  scenario: string;
  changedFile: string;
  flagged: number;
  min: number;
  max: number;
  mean: number;
  tiers: { depth: number; count: number }[];
}> = [];

for (const scenario of SCENARIOS) {
  const changedFileAbs = normalize(join(projectRoot, scenario.filePath.replace(/^code\//, '')));
  const importerToDepth = reverseIndex.asMap().get(changedFileAbs);
  if (!importerToDepth) {
    await writeFile(
      join(OUT_DIR, `${scenario.name}.json`),
      JSON.stringify({ scenario: scenario.name, changedFile: scenario.filePath, byStoryId: {} }, null, 2)
    );
    summary.push({ scenario: scenario.name, changedFile: scenario.filePath, flagged: 0, min: 0, max: 0, mean: 0, tiers: [] });
    continue;
  }

  const byStoryId: Record<string, number> = {};
  for (const [storyId, storyFile] of Object.entries(storyIdToFile)) {
    const d = importerToDepth.get(storyFile);
    if (typeof d === 'number') byStoryId[storyId] = d;
  }

  const depths = Object.values(byStoryId);
  const byTier = new Map<number, number>();
  for (const d of depths) byTier.set(d, (byTier.get(d) ?? 0) + 1);
  const tiers = [...byTier.entries()].sort((a, b) => a[0] - b[0]).map(([depth, count]) => ({ depth, count }));

  await writeFile(
    join(OUT_DIR, `${scenario.name}.json`),
    JSON.stringify({ scenario: scenario.name, changedFile: scenario.filePath, byStoryId }, null, 2)
  );

  summary.push({
    scenario: scenario.name,
    changedFile: scenario.filePath,
    flagged: depths.length,
    min: depths.length ? Math.min(...depths) : 0,
    max: depths.length ? Math.max(...depths) : 0,
    mean: depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0,
    tiers,
  });
}

await writeFile(join(OUT_DIR, 'summary.json'), JSON.stringify({ generated: new Date().toISOString(), perScenario: summary }, null, 2));

console.log(`\nDepth-map summary:`);
for (const s of summary) {
  const tiersStr = s.tiers.map((t) => `d${t.depth}=${t.count}`).join(' ');
  console.log(`  ${s.scenario.padEnd(15)} flagged=${s.flagged.toString().padStart(4)} mean=${s.mean.toFixed(2)} max=${s.max}  ${tiersStr}`);
}
console.log(`\nWritten to: ${OUT_DIR}`);

clearTimeout(timeoutHandle);
try {
  const wp = await import('../../../code/core/src/oxc-parser/worker-pool.ts');
  await wp.disposeOxcParsePool().catch(() => undefined);
} catch {}
process.exit(0);
