import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { join } from 'pathe';

import { globalsNameReferenceMap } from '../manager/globals/globals.ts';
import { getConfig } from './index.ts';
import { bundleManagerEntries } from './utils/bundle.ts';

// Rolldown reads and writes the real file system, so the addons are committed and the bundles are
// written to a temporary directory.
const fixtures = join(import.meta.dirname, '__testfixtures__');
const addon = (name: string) => join(fixtures, 'addons', name, 'manager.js');

// A directory per test: Node.js caches a module by its URL.
let outputDir: string;

beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'sb-builder-manager-'));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(outputDir, { recursive: true, force: true });
});

const configFor = (managerEntries: string[], configDir = fixtures) =>
  getConfig({
    configDir,
    outputDir,
    cacheKey: 'builder-manager-test',
    presets: {
      apply: async (name: string, fallback?: unknown) =>
        ({ managerEntries, env: { NODE_ENV: 'development', EXTRA: 'extra' } })[name] ?? fallback,
    },
  } as unknown as Options);

// Imports the bundles as the manager page does, and returns what they did to it.
const run = async (urls: string[]) => {
  const page = {
    registered: [] as string[],
    added: {} as Record<string, unknown>,
    styles: [] as string[],
    errors: [] as unknown[][],
  };
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', {
    createElement: () => ({}),
    head: { append: (style: { textContent: string }) => page.styles.push(style.textContent) },
  });
  vi.stubGlobal(globalsNameReferenceMap.react, {
    createElement: (type: unknown) => (typeof type === 'function' ? 'component' : type),
    useState: (value: unknown) => [value],
  });
  vi.stubGlobal(globalsNameReferenceMap['storybook/manager-api'], {
    addons: {
      register: (id: string, callback: () => void) => {
        page.registered.push(id);
        callback();
      },
      add: (id: string, value: unknown) => {
        page.added[id] = value;
      },
    },
    types: { PANEL: 'panel', TOOL: 'tool' },
  });
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    page.errors.push(args);
  });
  for (const url of urls) {
    await import(pathToFileURL(join(outputDir, decodeURIComponent(url))).href);
  }
  return page;
};

describe.each([false, true])('manager entries bundled with minify %s', (minify) => {
  it('run in order, each isolated from one that fails', async () => {
    const config = await configFor(
      [
        addon('pure+css'),
        addon('failing'),
        addon('commonjs'),
        addon('esm-on-commonjs'),
        addon('top-level-return'),
      ],
      join(fixtures, 'config')
    );
    const urls = await bundleManagerEntries(config, minify);

    expect(urls.map((url) => url.split('__testfixtures__-').pop())).toEqual([
      'addons-pure%2Bcss-0/manager-bundle.js',
      'addons-failing-1/manager-bundle.js',
      'addons-commonjs-2/manager-bundle.js',
      'addons-esm-on-commonjs-3/manager-bundle.js',
      'addons-top-level-return-4/manager-bundle.js',
      'config-5/manager-bundle.js',
    ]);

    const page = await run(urls);

    expect(page.registered).toEqual([
      'pure+css',
      'commonjs',
      'esm-on-commonjs',
      'before-return',
      'config',
    ]);
    expect(page.added).toMatchObject({
      'pure+css/panel': {
        type: 'panel',
        mode: 'development',
        env: ['NODE_ENV', 'EXTRA'],
        global: 'object',
      },
      'commonjs/tool': { element: 'i' },
      'esm-on-commonjs/tool': { mode: 'development', hello: 'hello' },
      'config/tool': { type: 'tool', title: 'tool' },
    });
    expect((page.added['config/tool'] as { render: () => unknown }).render()).toBe('component');
    await expect(
      (page.added['esm-on-commonjs/tool'] as { optional: Promise<string> }).optional
    ).resolves.toBe('missing');
    expect(page.styles).toEqual([expect.stringContaining('background: url("data:image/svg+xml,')]);
    expect(page.errors).toEqual([
      [
        `[Storybook] One of your manager-entries failed: ${urls[1]}`,
        expect.objectContaining({ message: 'This addon fails' }),
      ],
    ]);
  });
});

it('gives a UMD wrapper that tests `typeof require` its CommonJS branch, as esbuild did', async () => {
  const [url] = await bundleManagerEntries(await configFor([addon('umd-with-require')]), false);
  const code = await readFile(join(outputDir, decodeURIComponent(url)), 'utf-8');

  // A new context has no `require`, like the manager page and unlike the test runner.
  const registered: string[] = [];
  runInNewContext(code, {
    [globalsNameReferenceMap['storybook/manager-api']]: {
      addons: { register: (id: string) => registered.push(id) },
    },
    console: { error: () => {} },
  });

  expect(registered).toEqual(['umd-with-require']);
});

it('fails the build on an import that cannot be resolved', async () => {
  const config = await configFor([addon('unresolved')]);

  await expect(bundleManagerEntries(config, false)).rejects.toThrow(
    'storybook-addon-that-is-not-installed'
  );
});
