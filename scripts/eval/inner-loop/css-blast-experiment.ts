/**
 * Experiment C runner — exercises the CSS blast-radius synthesis on
 * scenarios where change-detection alone returns 0 (the css-only scenario)
 * and on synthetic edits to other CSS files in the dogfood. Output is a
 * JSON report describing the synthesised stories per CSS file plus a
 * per-sibling breakdown for hand-labelling.
 *
 * Run with:
 *   node --experimental-transform-types --no-warnings \
 *     scripts/eval/inner-loop/css-blast-experiment.ts
 */
import { computeCssBlastRadius } from './lib/css-blast-radius.ts';

const projectRoot = '/Users/yannbraga/open-source/storybook/code';

// Aliases mirror code/.storybook/main.ts viteFinal — same as cd-experiment.ts.
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

const probes = [
  '.storybook/bench/bundle-analyzer/index.css',
  'addons/onboarding/example-stories/button.css',
  'addons/pseudo-states/src/stories/button.css',
  'addons/pseudo-states/src/stories/input.css',
  'addons/pseudo-states/src/stories/grid.css',
  'addons/pseudo-states/src/stories/nested.css',
  'addons/pseudo-states/src/stories/cssatrules.css',
];

console.log('Computing CSS blast radius for probe stylesheets...');
console.log('(this builds the full reverse index — takes ~5-10s)\n');

const HARD_TIMEOUT_MS = 60_000;
const timeoutHandle = setTimeout(() => {
  console.error(`\nTimeout after ${HARD_TIMEOUT_MS}ms — exiting`);
  process.exit(2);
}, HARD_TIMEOUT_MS);

let results;
try {
  results = await computeCssBlastRadius(
    probes.map((p) => `${projectRoot}/${p}`),
    projectRoot,
    alias
  );
} catch (e) {
  console.error('FAILED:', (e as Error).message);
  console.error((e as Error).stack);
  process.exit(1);
}
clearTimeout(timeoutHandle);

for (const r of results) {
  const rel = r.changedCssFile.replace(`${projectRoot}/`, '');
  console.log(`━━━ ${rel} ━━━`);
  console.log(`  siblings (JS/TS in same dir): ${r.siblingFiles.length}`);
  for (const s of r.siblingFiles) {
    console.log(`    ${s}`);
  }
  console.log(`  importing stories (synthesised affected): ${r.importingStories.length}`);
  if (r.importingStories.length > 0) {
    console.log(`    sample: ${r.importingStories.slice(0, 6).join(', ')}${r.importingStories.length > 6 ? ', ...' : ''}`);
  }
  console.log(`  per-sibling breakdown:`);
  for (const ps of r.perSibling) {
    console.log(`    ${ps.sibling}: ${ps.storyCount} importing stories`);
  }
  console.log();
}

// Persist as JSON for the HTML report.
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, 'results');
await mkdir(RESULTS_DIR, { recursive: true });
const reportPath = join(RESULTS_DIR, 'css-blast-radius.json');
await writeFile(
  reportPath,
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      projectRoot,
      probes,
      results,
      caveat:
        'Precision is bounded by "co-located JS imports the same look" — the synthesis unions all siblings in the directory, so a change to button.css and a change to input.css produce the same set of importing stories when both live in the same directory. Refinement: filter siblings by matching base name (button.css → Button.tsx).',
    },
    null,
    2
  )
);
console.log(`\nReport: ${reportPath}`);

// Dispose the OXC worker pool so Node can exit cleanly.
try {
  const wp = await import('../../../code/core/src/oxc-parser/worker-pool.ts');
  await wp.disposeOxcParsePool().catch(() => undefined);
} catch {}
process.exit(0);
