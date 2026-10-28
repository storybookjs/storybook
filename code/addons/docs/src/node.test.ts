import { expect, it, vi } from 'vitest';

import type { Storybook } from 'storybook/internal/instance';

import docs from './node.ts';

function setUp(callHook: (name: string, value: unknown) => unknown = (_, value) => value) {
  const hooks: [name: string, handler: (...args: any[]) => any, kind?: string][] = [];
  const storybook = {
    configDir: '/project/.storybook',
    hook: (name: string, handler: (...args: any[]) => any, kind?: string) =>
      hooks.push([name, handler, kind]),
    callHook: vi.fn(async (name: string, value: unknown) => callHook(name, value)),
    getStoryIndexGenerator: vi.fn(),
  } as unknown as Storybook;
  docs().setup(storybook);
  const handler = (name: string) => hooks.find(([hook]) => hook === name)![1];
  return { hooks, handler };
}

it('registers hooks in the order the preset applied them', () => {
  const { hooks } = setUp();
  expect(hooks.map(([name, , kind]) => (kind ? `${name} (${kind})` : name))).toMatchInlineSnapshot(`
    [
      "preview:annotations:collect",
      "builder:vite:extend (reduce)",
      "builder:webpack-config:extend (reduce)",
      "core:docs:extend",
      "legacy:resolvedReact:extend (reduce)",
      "core:services:register",
      "builder:vite-deps:collect (collect)",
      "index:manifests:extend",
    ]
  `);
});

it('resolves docs from main, the --docs flag, and the build flags', async () => {
  const { handler } = setUp((name, value) =>
    name === 'core:build:extend' ? { test: { disableAutoDocs: false } } : value
  );
  expect(await handler('core:docs:extend')({ autodocs: 'tag' }, { docs: true }))
    .toMatchInlineSnapshot(`
      {
        "autodocs": "tag",
        "defaultName": "Docs",
        "docsMode": true,
      }
    `);
});

it('drops docs for test builds without autodocs', async () => {
  const { handler } = setUp((name, value) =>
    name === 'core:build:extend' ? { test: { disableAutoDocs: true } } : value
  );
  expect(await handler('core:docs:extend')({ autodocs: 'tag' })).toBeUndefined();
});

it('reads features for docs manifests', async () => {
  const { handler } = setUp((name, value) =>
    name === 'core:features:extend' ? { docgenServer: true, componentsManifest: true } : value
  );
  expect(await handler('index:manifests:extend')({ existing: true }, { manifestEntries: [] }))
    .toMatchInlineSnapshot(`
    {
      "existing": true,
    }
  `);
});
