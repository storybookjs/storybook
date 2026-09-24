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

describe('module capability escapes', () => {
  it.each([
    [
      'a call argument',
      `function useModule(nodeModule) {
  const load = nodeModule.createRequire(import.meta.url);
  load(['@storybook', 'react-dom-shim'].join('/'));
}
useModule(require('node:module'));
`,
    ],
    [
      'a return value',
      `function getModule() {
  return require('node:module');
}
const nodeModule = getModule();
const load = nodeModule.createRequire(import.meta.url);
load(['@storybook', 'react-dom-shim'].join('/'));
`,
    ],
    [
      'an object property',
      `const capabilities = { nodeModule: require('node:module') };
const load = capabilities.nodeModule.createRequire(import.meta.url);
load(['@storybook', 'react-dom-shim'].join('/'));
`,
    ],
    [
      'an array element',
      `const capabilities = [require('node:module')];
const load = capabilities[0].createRequire(import.meta.url);
load(['@storybook', 'react-dom-shim'].join('/'));
`,
    ],
    [
      'an inline factory member',
      `consume(require('node:module').createRequire);
`,
    ],
  ])('refuses module acquisition through %s', async (_description, source) => {
    vol.fromNestedJSON({
      '/project/package.json': manifest,
      '/project/module-capability.ts': source,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/module-capability.ts: contains an unresolved module load',
      ]),
    });
  });

  it('preserves a safe literal import', async () => {
    vol.fromNestedJSON({
      '/project/package.json': manifest,
      '/project/safe-import.ts': `import { readFile } from 'node:fs/promises';
export const loadFixture = readFile;
`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'safe',
    });
  });
});
