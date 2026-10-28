import { describe, expect, it } from 'vitest';

import type { Storybook } from '@storybook/core';
import type { PreviewSources } from '@storybook/core/internal/preview-page';

import type { UserConfig } from 'vite';

import {
  escapeGlobPath,
  getMockRedirectIncludeEntries,
  storybookOptimizeDepsPlugin,
} from './storybook-optimize-deps-plugin.ts';

describe('optimizer entries', () => {
  async function getOptimizeConfig(inputConfig: UserConfig = {}) {
    const storybook = {
      configDir: '/project/.storybook',
      options: {},
      callHook: async () => ['framework-dep'],
      getStoryIndexGenerator: async () => ({
        getIndex: async () => ({
          v: 5,
          entries: { a: { importPath: './src/(group)/A.stories.ts' } },
        }),
      }),
    } as unknown as Storybook;
    const preview = {
      previewAnnotations: ['/project/renderer.js', '/project/.storybook/preview.ts'],
      previewConfigPath: undefined,
      previewRuntimePath: '/storybook/dist/core/preview/runtime.js',
    } as unknown as PreviewSources;
    const hook = storybookOptimizeDepsPlugin(storybook, preview).config!;
    const handler = typeof hook === 'function' ? hook : hook.handler;
    const config = await handler.call({} as never, inputConfig, { command: 'serve', mode: 'test' });
    return config && { build: config.build, optimizeDeps: config.optimizeDeps };
  }

  it('scans stories and preview annotations and includes the preview runtime', async () => {
    expect(await getOptimizeConfig()).toMatchInlineSnapshot(`
      {
        "build": {
          "outDir": "storybook-static",
        },
        "optimizeDeps": {
          "entries": [
            "./src/\\(group\\)/A.stories.ts",
            "/project/renderer.js",
            "/project/.storybook/preview.ts",
          ],
          "include": [
            "/storybook/dist/core/preview/runtime.js",
            "framework-dep",
          ],
        },
      }
    `);
  });

  it('preserves a configured build output directory and user entries', async () => {
    expect(
      await getOptimizeConfig({
        build: { outDir: 'custom-output' },
        optimizeDeps: { entries: 'user-entry.ts', include: ['user-dep'] },
      })
    ).toMatchInlineSnapshot(`
      {
        "build": {
          "outDir": "custom-output",
        },
        "optimizeDeps": {
          "entries": [
            "user-entry.ts",
            "./src/\\(group\\)/A.stories.ts",
            "/project/renderer.js",
            "/project/.storybook/preview.ts",
          ],
          "include": [
            "/storybook/dist/core/preview/runtime.js",
            "framework-dep",
            "user-dep",
          ],
        },
      }
    `);
  });
});

describe('escapeGlobPath', () => {
  it('should not modify a plain path without special characters', () => {
    expect(escapeGlobPath('./src/Button.stories.tsx')).toBe('./src/Button.stories.tsx');
  });

  it('should escape parentheses in path segments (e.g. Next.js route groups)', () => {
    expect(escapeGlobPath('./src/(group)/Button.stories.tsx')).toBe(
      './src/\\(group\\)/Button.stories.tsx'
    );
  });

  it('should escape square brackets in path segments', () => {
    expect(escapeGlobPath('./src/[id]/Button.stories.tsx')).toBe(
      './src/\\[id\\]/Button.stories.tsx'
    );
  });

  it('should escape curly braces in path segments', () => {
    expect(escapeGlobPath('./src/{group}/Button.stories.tsx')).toBe(
      './src/\\{group\\}/Button.stories.tsx'
    );
  });

  it('should escape glob wildcard characters', () => {
    expect(escapeGlobPath('./src/Button*.stories.tsx')).toBe('./src/Button\\*.stories.tsx');
    expect(escapeGlobPath('./src/Button?.stories.tsx')).toBe('./src/Button\\?.stories.tsx');
  });

  it('should escape all special glob characters together', () => {
    expect(escapeGlobPath('./src/(group)/[id]/{name}/*.stories.tsx')).toBe(
      './src/\\(group\\)/\\[id\\]/\\{name\\}/\\*.stories.tsx'
    );
  });

  it('should not modify paths that contain no special glob characters', () => {
    expect(escapeGlobPath('./src/my-component/Button.stories.tsx')).toBe(
      './src/my-component/Button.stories.tsx'
    );
  });
});

describe('getMockRedirectIncludeEntries', () => {
  it('should include only manual mock redirect paths', () => {
    expect(
      getMockRedirectIncludeEntries([
        { redirectPath: '/project/src/lib/__mocks__/db.ts' },
        { redirectPath: null },
      ])
    ).toEqual(['/project/src/lib/__mocks__/db.ts']);
  });

  it('should escape special glob characters in redirect paths', () => {
    expect(
      getMockRedirectIncludeEntries([
        { redirectPath: '/project/src/(group)/__mocks__/db.ts' },
        { redirectPath: '/project/src/[id]/__mocks__/db.ts' },
      ])
    ).toEqual([
      '/project/src/\\(group\\)/__mocks__/db.ts',
      '/project/src/\\[id\\]/__mocks__/db.ts',
    ]);
  });

  it('should dedupe redirect paths', () => {
    expect(
      getMockRedirectIncludeEntries([
        { redirectPath: '/project/src/lib/__mocks__/db.ts' },
        { redirectPath: '/project/src/lib/__mocks__/db.ts' },
      ])
    ).toEqual(['/project/src/lib/__mocks__/db.ts']);
  });
});
