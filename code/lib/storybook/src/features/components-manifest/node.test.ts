import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StorybookFeatures } from '@storybook/core/internal/types';

import type { StaticOutputWriter } from '../../storybook/server/hooks.ts';
import componentsManifest from './node.ts';

type Route = (req: { params: { name: string } }, res: Response) => Promise<void>;

interface Response {
  statusCode?: number;
  body?: string;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

const DIRS: string[] = [];
const MANIFESTS = { custom: { components: { button: { id: 'button' } } } };
const GENERATOR = {
  getIndex: async () => ({
    v: 5,
    entries: { 'button--primary': { id: 'button--primary', tags: ['manifest'] } },
  }),
};

afterEach(async () => {
  await Promise.all(DIRS.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Run the addon's setup against a recorder whose features resolve to `features`. */
function setUp(features: StorybookFeatures): Record<string, (...args: any[]) => any> {
  const handlers: Record<string, (...args: any[]) => any> = {};
  const results: Record<string, unknown> = {
    'core:features:extend': features,
    'index:manifests:extend': MANIFESTS,
  };
  componentsManifest().setup({
    callHook: vi.fn(async (name: string) => results[name]),
    getStoryIndexGenerator: async () => GENERATOR,
    hook: (name: string, handler: (...args: any[]) => any) => {
      handlers[name] = handler;
    },
  } as never);
  return handlers;
}

describe('components-manifest addon', () => {
  it.each([
    { input: { componentsManifest: true }, expected: { served: true, writers: 1 } },
    { input: { componentsManifest: false }, expected: { served: false, writers: 0 } },
    { input: {}, expected: { served: false, writers: 0 } },
  ])(
    'ships its routes and output only while the flag is on: $input',
    async ({ input, expected }) => {
      const handlers = setUp(input);
      const app = { get: vi.fn() };

      expect(await handlers['server:app:extend'](app)).toBe(app);
      expect({
        served: app.get.mock.calls.length > 0,
        writers: (await handlers['server:static-output:collect']()).length,
      }).toEqual(expected);
    }
  );

  it('writes the manifests through the static output hook', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'sb-manifest-'));
    DIRS.push(outputDir);
    const writers: StaticOutputWriter[] = await setUp({ componentsManifest: true })[
      'server:static-output:collect'
    ]();

    await Promise.all(writers.map((write) => write({ outputDir })));

    expect(JSON.parse(await readFile(join(outputDir, 'manifests', 'custom.json'), 'utf8'))).toEqual(
      MANIFESTS.custom
    );
  });

  it('serves the manifests on the dev app', async () => {
    const routes: Record<string, Route> = {};
    const app = { get: (path: string, route: Route) => (routes[path] = route) };
    const res: Response = {
      setHeader: () => {},
      end(body) {
        this.body = body;
      },
    };

    expect(await setUp({ componentsManifest: true })['server:app:extend'](app)).toBe(app);
    await routes['/manifests/:name.json']({ params: { name: 'custom' } }, res);

    expect({ statusCode: res.statusCode, body: JSON.parse(res.body!) }).toEqual({
      statusCode: undefined,
      body: MANIFESTS.custom,
    });
  });
});
