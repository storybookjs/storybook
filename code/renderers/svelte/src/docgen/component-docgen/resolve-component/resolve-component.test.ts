// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { IndexEntry } from 'storybook/internal/types';

import { fs as memoryFs, vol } from 'memfs';
import ts from 'typescript';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', { spy: true });

let resolveStoryComponent: typeof import('./resolve-component.ts').resolveStoryComponent;

beforeAll(async () => {
  ({ resolveStoryComponent } = await import('./resolve-component.ts'));
}, 30000);

const entry: IndexEntry = {
  id: 'button--primary',
  name: 'Primary',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath: resolve('/project/Button.stories.ts'),
  tags: [],
};

beforeEach(() => {
  vol.reset();
  vi.mocked(readFile).mockImplementation(async (filename) =>
    (await memoryFs.promises.readFile(filename.toString(), 'utf8')).toString()
  );
  vi.spyOn(ts.sys, 'fileExists').mockImplementation((filename) => vol.existsSync(filename));
  vi.spyOn(ts.sys, 'readFile').mockImplementation((filename) =>
    vol.existsSync(filename) ? vol.readFileSync(filename, 'utf8').toString() : undefined
  );
  vi.spyOn(ts.sys, 'directoryExists').mockImplementation(
    (filename) => vol.existsSync(filename) && vol.statSync(filename).isDirectory()
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('resolves a SvelteKit alias from an extended tsconfig', async () => {
  vol.fromJSON(
    {
      'tsconfig.json': JSON.stringify({ extends: './.svelte-kit/tsconfig.json' }),
      '.svelte-kit/tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '$lib/*': ['../src/lib/*'] } },
      }),
      'Button.stories.ts':
        "import Button from '$lib/Button.svelte'; export default { component: Button }; export const Primary = {};",
      'src/lib/Button.svelte': '<button>Save</button>',
    },
    resolve('/project')
  );

  expect(await resolveStoryComponent(entry)).toEqual({
    componentPath: resolve('/project/src/lib/Button.svelte'),
    exportName: 'default',
    name: 'Button',
  });
});

it('reports an unresolved component import', async () => {
  vol.fromJSON(
    {
      'Button.stories.ts':
        "import Button from './Missing.svelte'; export default { component: Button }; export const Primary = {};",
    },
    resolve('/project')
  );

  await expect(resolveStoryComponent(entry)).rejects.toThrow('Could not resolve ./Missing.svelte');
});

it.each([
  "export { default as Button } from './Button.svelte';",
  "export { Button } from './nested';",
  "export * from './nested';",
  "import Component from './Button.svelte'; export { Component as Button };",
])('resolves a plain CSF component through a barrel: %s', async (barrel) => {
  vol.fromJSON(
    {
      'Button.stories.ts':
        "import { Button } from './lib'; export default { component: Button }; export const Primary = {};",
      'lib/index.ts': barrel,
      'lib/nested.ts': "export { default as Button } from './Button.svelte';",
      'lib/Button.svelte': '<button>Save</button>',
    },
    resolve('/project')
  );

  expect(await resolveStoryComponent(entry)).toEqual({
    componentPath: resolve('/project/lib/Button.svelte'),
    exportName: 'Button',
    name: 'Button',
  });
});

it('reports a circular barrel export instead of publishing empty argTypes', async () => {
  vol.fromJSON(
    {
      'Button.stories.ts':
        "import { Button } from './lib'; export default { component: Button }; export const Primary = {};",
      'lib/index.ts': "export * from './nested';",
      'lib/nested.ts': "export * from './index';",
    },
    resolve('/project')
  );

  await expect(resolveStoryComponent(entry)).rejects.toThrow(
    'Could not resolve ./lib export Button'
  );
});
