import assert from 'node:assert/strict';
import { symlink } from 'node:fs/promises';
import { resolve } from 'node:path';

assert(process.env.STORYBOOK_MUTATION_ROOT);
await symlink(
  resolve(process.env.STORYBOOK_MUTATION_ROOT, 'node_modules'),
  resolve('node_modules'),
  'junction'
);
const { build } = await import('esbuild');
await symlink(
  resolve(process.env.STORYBOOK_MUTATION_ROOT, 'code/core/dist'),
  resolve('code/core/dist'),
  'dir'
);
await build({
  entryPoints: ['code/addons/vitest/src/node/coverage-reporter.ts'],
  outfile: 'code/addons/vitest/dist/node/coverage-reporter.js',
  bundle: true,
  packages: 'external',
  format: 'esm',
  platform: 'node',
  target: 'node22',
});
