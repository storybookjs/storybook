/**
 * Builds only the manager of a Storybook, through the real manager builder, so the result can be
 * opened in a browser without building the preview. A stub story index and preview frame are
 * written next to it so the manager has a story to select.
 *
 * Run from `code/`:
 * `STORYBOOK_MANAGER_BENCH_ADDONS=1 STORYBOOK_MANAGER_BUNDLER=rolldown node core/scripts/manager-bundler-bench/validate-build.ts <outputDir>`
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { experimental_loadStorybook } from 'storybook/internal/core-server';

import { loadManagerBuilder } from './builder.ts';

const outputDir = resolve(process.argv[2]);
const configDir = resolve(process.argv[3] ?? '.storybook');

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const options = await experimental_loadStorybook({ configDir, packageJson: {}, outputDir });
// Only the full addon selection contains addons that need the removed component exports
const { build } = await loadManagerBuilder({
  shimRemovedExports: process.env.STORYBOOK_MANAGER_BENCH_ADDONS !== 'compatible',
});

const start = performance.now();
await build({ startTime: process.hrtime(), options: { ...options, outputDir } });
process.stdout.write(`manager built in ${Math.round(performance.now() - start)}ms\n`);

writeFileSync(
  join(outputDir, 'index.json'),
  JSON.stringify({
    v: 5,
    entries: {
      'bench--default': {
        type: 'story',
        subtype: 'story',
        id: 'bench--default',
        name: 'Default',
        title: 'Bench',
        importPath: './bench.stories.ts',
        tags: ['dev', 'test'],
      },
    },
  })
);
writeFileSync(join(outputDir, 'iframe.html'), '<!doctype html><title>stub preview</title>');
process.exit(0);
