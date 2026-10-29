import { fileURLToPath } from 'node:url';

import { expect, it, vi } from 'vitest';

import type { Storybook } from 'storybook/internal/instance';

import mcp from './node.ts';
import { mountMcpServer } from './node/dev-server.ts';

vi.mock('./node/dev-server.ts', () => ({ mountMcpServer: vi.fn(async (app) => app) }));

function setUp(input?: Parameters<typeof mcp>[0]) {
  const hooks: [name: string, handler: (...args: any[]) => any][] = [];
  const storybook = {
    options: { port: 6006, host: 'localhost', configDir: '/project/.storybook' },
    hook: (name: string, handler: (...args: any[]) => any) => hooks.push([name, handler]),
    callHook: vi.fn(async (name: string) =>
      name === 'core:config:extend' ? { allowedHosts: true } : undefined
    ),
    getIndex: vi.fn(async () => ({ v: 5, entries: {} })),
  } as unknown as Storybook;
  mcp(input).setup(storybook);
  const handler = (name: string) => hooks.find(([hook]) => hook === name)![1];
  return { hooks, handler, storybook };
}

it('registers hooks in the order the preset applied them', () => {
  expect(setUp().hooks.map(([name]) => name)).toMatchInlineSnapshot(`
    [
      "server:mcp:extend",
      "preview:annotations:collect",
      "server:app:extend",
    ]
  `);
});

it.each([
  { input: undefined, expected: { status: 'ready', endpoint: '/mcp' } },
  { input: { endpoint: '/custom' }, expected: { status: 'ready', endpoint: '/custom' } },
])('reports the MCP endpoint for $input', ({ input, expected }) => {
  expect(setUp(input).handler('server:mcp:extend')()).toEqual(expected);
});

it('adds the preview resolved from the package', () => {
  expect(setUp().handler('preview:annotations:collect')()).toEqual([
    fileURLToPath(
      new URL('./dist/preview.js', import.meta.resolve('@storybook/addon-mcp/package.json'))
    ),
  ]);
});

it('enables the components manifest before setup', () => {
  expect(mcp().features).toEqual({ componentsManifest: true });
});

it('mounts the server with the instance and the addon options', async () => {
  const { handler, storybook } = setUp({ endpoint: '/custom' });
  const app = { get: vi.fn(), post: vi.fn() };

  expect(await handler('server:app:extend')(app)).toBe(app);

  const [mountedApp, mountedStorybook, input] = vi.mocked(mountMcpServer).mock.calls[0];
  expect(mountedApp).toBe(app);
  expect(mountedStorybook).toBe(storybook);
  expect(input).toMatchInlineSnapshot(`
    {
      "endpoint": "/custom",
    }
  `);
});
