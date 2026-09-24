import * as fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { analyzeReactDomShimWorkspace } from './react-dom-shim-workspace.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(fs.readFile).mockImplementation(vol.promises.readFile as typeof fs.readFile);
  vi.mocked(fs.readdir).mockImplementation(vol.promises.readdir as typeof fs.readdir);
});

afterEach(() => vi.restoreAllMocks());

const manifest = `${JSON.stringify({
  dependencies: {
    react: '19.1.1',
    'react-dom': '19.1.1',
    '@storybook/react-dom-shim': '10.5.10',
  },
})}\n`;

describe('workspace consumer boundaries', () => {
  it('refuses unresolved loads through createRequire from the bare module builtin', async () => {
    vol.fromNestedJSON({
      '/project/package.json': manifest,
      '/project/bare-module-loader.ts': `import { createRequire } from 'module';
const load = createRequire(import.meta.url);
load(['@storybook', 'react-dom-shim'].join('/'));
`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/bare-module-loader.ts: contains an unresolved module load',
      ]),
    });
  });

  it('refuses unresolved loads through loaders declared after their uses', async () => {
    vol.fromNestedJSON({
      '/project/package.json': manifest,
      '/project/out-of-order-loader.ts': `export function run() {
  const load = base;
  return load(['@storybook', 'react-dom-shim'].join('/'));
}
const base = require;
run();
`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/out-of-order-loader.ts: contains an unresolved module load',
      ]),
    });
  });

  it('refuses unresolved loads through namespace factory and assignment aliases', async () => {
    vol.fromNestedJSON({
      '/project/package.json': manifest,
      '/project/namespace-loader.ts': `import * as moduleBuiltin from 'module';
let factory;
factory = moduleBuiltin.createRequire;
let load;
load = factory(import.meta.url);
load(['@storybook', 'react-dom-shim'].join('/'));
`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/namespace-loader.ts: contains an unresolved module load',
      ]),
    });
  });

  it('refuses nested loader aliases with unresolved module specifiers', async () => {
    vol.fromNestedJSON({
      '/project/package.json': manifest,
      '/project/nested-loader.ts': `export function run() {
  const load = require;
  const name = ['@storybook', 'react-dom-shim'].join('/');
  return load(name);
}\n`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/nested-loader.ts: contains an unresolved module load',
      ]),
    });
  });

  it('refuses executable Vue template expressions that cannot be proven inert', async () => {
    vol.fromNestedJSON({
      '/project/package.json': manifest,
      '/project/consumer.vue': `<template><button @click="import(['@storybook', 'react-dom-shim'].join('/'))">Load</button></template>\n`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/consumer.vue: contains an unresolved module load',
      ]),
    });
  });

  it('marks no-use results as non-proving', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ dependencies: { vue: '3.5.0' } })}\n`,
      '/project/App.vue': '<template><main /></template>\n',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toEqual({
      applicable: false,
      kind: 'none',
      workspaceRoot: '/project',
    });
  });
});
