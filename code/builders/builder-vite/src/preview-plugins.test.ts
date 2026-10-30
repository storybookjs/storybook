import { describe, expect, it, vi } from 'vitest';

import type { Storybook } from '@storybook/core';

import type { Plugin } from 'vite';

import { vitePreviewPlugins } from './preview-plugins.ts';

const { serveStaticDirsMock } = vi.hoisted(() => ({ serveStaticDirsMock: vi.fn() }));

vi.mock('storybook/internal/preview-page', () => ({
  getPreviewSources: vi.fn(async () => 'preview-sources'),
}));
vi.mock('@storybook/core/internal/story-index', () => ({ serveStaticDirs: serveStaticDirsMock }));
vi.mock('./vite-config.ts', () => ({
  viteCorePlugins: vi.fn(async (_storybook: unknown, preview: unknown) => [
    { name: `core(${preview})` },
  ]),
  getViteHookContext: () => ({ configType: 'DEVELOPMENT' }),
}));

const HOOK_RESULTS: Record<string, unknown> = {
  'core:framework-options:extend': { strictMode: true },
  'preview:head:extend': '<meta name="preview-head" />',
  'preview:body:extend': undefined,
};

function createStorybook(): { storybook: Storybook; callHook: ReturnType<typeof vi.fn> } {
  const callHook = vi.fn(async (name: string, value: unknown) =>
    name === 'builder:vite:extend'
      ? {
          ...(value as object),
          plugins: [{ name: 'addon' }, [{ name: 'framework' }]],
          define: { FEATURES: '"from viteFinal"', OTHER: '1' },
        }
      : HOOK_RESULTS[name]
  );
  const storybook = {
    configDir: '/repo/app/.storybook',
    options: { features: { docgenServer: true }, staticDirs: ['../public'] },
    callHook,
  } as unknown as Storybook;
  return { storybook, callHook };
}

async function getPlugins(storybook: Storybook): Promise<Plugin[]> {
  return (await vitePreviewPlugins(storybook)) as Plugin[];
}

describe('vitePreviewPlugins', () => {
  it('returns the core plugins, the builder:vite:extend plugins, then the host plugin', async () => {
    const { storybook, callHook } = createStorybook();

    const plugins = await getPlugins(storybook);

    expect(JSON.stringify(plugins.map((plugin) => plugin.name ?? plugin))).toMatchInlineSnapshot(
      `"["core(preview-sources)","addon",[{"name":"framework"}],"storybook:preview-host-plugin"]"`
    );
    expect(callHook).toHaveBeenCalledWith(
      'builder:vite:extend',
      { root: '/repo/app' },
      { configType: 'DEVELOPMENT' }
    );
  });

  it('applies the rest of the builder:vite:extend config, letting it win over FEATURES', async () => {
    const { storybook } = createStorybook();
    const host = (await getPlugins(storybook)).at(-1)!;

    const config = await (host.config as () => Promise<unknown>)();

    expect(config).toMatchInlineSnapshot(`
      {
        "define": {
          "FEATURES": ""from viteFinal"",
          "OTHER": "1",
        },
        "root": "/repo/app",
      }
    `);
  });

  it('sets the framework options global ahead of the preview head', async () => {
    const { storybook } = createStorybook();
    const host = (await getPlugins(storybook)).at(-1)!;
    const transformIndexHtml = host.transformIndexHtml as (html: string) => Promise<string>;

    expect(await transformIndexHtml('<html><head></head><body></body></html>')).toBe(
      '<html><head><script>window.FRAMEWORK_OPTIONS = {"strictMode":true};</script><meta name="preview-head" /></head><body></body></html>'
    );
  });

  it('serves the static dirs on the host server', async () => {
    const { storybook } = createStorybook();
    const host = (await getPlugins(storybook)).at(-1)!;
    const middlewares = { use: vi.fn() };

    (host.configureServer as (server: unknown) => void)({ middlewares });

    expect(serveStaticDirsMock).toHaveBeenCalledWith(middlewares, {
      configDir: '/repo/app/.storybook',
      staticDirs: ['../public'],
    });
  });
});
