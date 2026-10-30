import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { STATIC_COMPONENT_BLOCKS_FILE } from '../constants.ts';
import { parseManagerDocs } from '../parser/parse-mdx.ts';
import {
  BLOCK_BUILDER_ENV,
  componentBlocksEntry,
  componentModules,
  emitStaticComponentBlocks,
  projectReactAliases,
  redirectStylesToShadowRoots,
  withProjectReact,
} from './component-blocks.ts';

vi.mock('node:fs/promises', { spy: true });

describe('componentModules', () => {
  it('imports each rendered component once, resolving relative sources from the docs file', () => {
    const intro = parseManagerDocs(
      [
        "import { DocsCallout } from './components/DocsCallout';",
        "import { Tip } from '@acme/ui';",
        '',
        '<DocsCallout tone="info" />',
        '',
        '<Tip />',
        '',
      ].join('\n'),
      './src/Intro.mdx'
    );
    const nested = parseManagerDocs(
      "import { DocsCallout } from '../components/DocsCallout';\n\n<DocsCallout />\n",
      './src/docs/Nested.mdx'
    );

    expect(
      componentModules('/project', [
        { importPath: './src/Intro.mdx', blocks: intro.blocks },
        { importPath: './src/docs/Nested.mdx', blocks: nested.blocks },
      ])
    ).toEqual([
      {
        blockId: './src/components/DocsCallout#DocsCallout',
        specifier: '/project/src/components/DocsCallout',
        exportName: 'DocsCallout',
      },
      { blockId: '@acme/ui#Tip', specifier: '@acme/ui', exportName: 'Tip' },
    ]);
  });
});

describe('componentBlocksEntry', () => {
  it('registers each component and renders it as-is, without composing stories or decorators', () => {
    expect(
      componentBlocksEntry({
        modules: [
          {
            blockId: './src/DocsCallout#DocsCallout',
            specifier: '/project/src/DocsCallout',
            exportName: 'DocsCallout',
          },
          { blockId: '@acme/ui#default', specifier: '@acme/ui', exportName: 'default' },
        ],
        reactRefresh: true,
      })
    ).toMatchInlineSnapshot(`
      "import '@vitejs/plugin-react/preamble';
      import { createElement } from 'react';
      import { createRoot } from 'react-dom/client';
      import { defineManagerDocsBlocks } from "virtual:manager-docs-blocks/runtime";
      import { DocsCallout as block0 } from "/project/src/DocsCallout";
      import { default as block1 } from "@acme/ui";

      defineManagerDocsBlocks({
        components: {
          "./src/DocsCallout#DocsCallout": block0,
          "@acme/ui#default": block1,
        },
        mount(container) {
          const root = createRoot(container);
          return {
            render: (component, props) => root.render(createElement(component, props)),
            unmount: () => root.unmount(),
          };
        },
      });

      if (import.meta.hot) {
        import.meta.hot.accept();
      }
      "
    `);
  });
});

describe('redirectStylesToShadowRoots', () => {
  it('points a Vite dev CSS module at the block runtime instead of the Vite client', () => {
    const cssModule = [
      'import { createHotContext as __vite__createHotContext } from "/@vite/client";',
      'import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from "/@vite/client"',
      'const __vite__id = "/project/src/DocsCallout.module.css"',
      '__vite__updateStyle(__vite__id, ".a{}")',
    ].join('\n');

    expect(redirectStylesToShadowRoots(cssModule)).toBe(
      cssModule.replace(
        'removeStyle as __vite__removeStyle } from "/@vite/client"',
        'removeStyle as __vite__removeStyle } from "virtual:manager-docs-blocks/runtime"'
      )
    );
    expect(redirectStylesToShadowRoots('export const a = 1;')).toBeUndefined();
  });
});

describe('projectReactAliases', () => {
  it('pins React specifiers to the project copy and skips missing packages', () => {
    const aliases = projectReactAliases('/app', (root, specifier) =>
      specifier === 'react-dom' ? undefined : `${root}/nm/${specifier}.js`
    );

    expect(aliases).toEqual([
      { find: 'react/jsx-dev-runtime', replacement: '/app/nm/react/jsx-dev-runtime.js' },
      { find: 'react/jsx-runtime', replacement: '/app/nm/react/jsx-runtime.js' },
      { find: 'react-dom/client', replacement: '/app/nm/react-dom/client.js' },
      { find: /^react$/, replacement: '/app/nm/react.js' },
    ]);
  });

  it('prepends project aliases and dedupes react so later preview aliases cannot win', () => {
    const resolveFrom = () => '/app/react.js';
    expect(
      withProjectReact(
        { resolve: { alias: { react: '/addon/react.js' }, dedupe: ['preact'] } },
        '/app',
        resolveFrom
      ).resolve
    ).toEqual({
      alias: [
        ...projectReactAliases('/app', resolveFrom),
        { find: 'react', replacement: '/addon/react.js' },
      ],
      dedupe: ['preact', 'react', 'react-dom'],
    });
  });
});

describe('emitStaticComponentBlocks', () => {
  const storyMdx = [
    "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';",
    "import * as ButtonStories from './Button.stories';",
    '',
    '<SB.Story of={ButtonStories.Primary} />',
    '',
  ].join('\n');
  const calloutMdx = [
    "import { Callout } from './Callout';",
    '',
    '<Callout tone="info">Shadow root</Callout>',
    '',
  ].join('\n');
  let mdxSource = storyMdx;

  beforeEach(() => {
    mdxSource = storyMdx;
    vi.mocked(readFile).mockImplementation(async () => mdxSource);
  });

  it('skips outside production and when the block builder is already running', async () => {
    const build = vi.fn();
    expect(
      await emitStaticComponentBlocks(
        { configType: 'DEVELOPMENT', outputDir: '/out' } as Options,
        build
      )
    ).toBeUndefined();
    const previous = process.env[BLOCK_BUILDER_ENV];
    process.env[BLOCK_BUILDER_ENV] = 'true';
    try {
      expect(
        await emitStaticComponentBlocks(
          { configType: 'PRODUCTION', outputDir: '/out' } as Options,
          build
        )
      ).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env[BLOCK_BUILDER_ENV];
      } else {
        process.env[BLOCK_BUILDER_ENV] = previous;
      }
    }
    expect(build).not.toHaveBeenCalled();
  });

  it('skips when indexed MDX has no component blocks', async () => {
    const build = vi.fn();
    expect(
      await emitStaticComponentBlocks(productionOptions('/out', 'src/Button.mdx'), build)
    ).toBeUndefined();
    expect(build).not.toHaveBeenCalled();
  });

  it('builds the blocks bundle into the static output', async () => {
    mdxSource = calloutMdx;
    const build = vi.fn(async () => undefined);
    const target = await emitStaticComponentBlocks(
      productionOptions('/out', 'src/Guide.mdx'),
      build
    );

    expect(target).toBe(`/out/${STATIC_COMPONENT_BLOCKS_FILE}`);
    expect(build).toHaveBeenCalledTimes(1);
    const config = build.mock.calls[0]?.[0] as {
      publicDir?: boolean;
      build?: {
        copyPublicDir?: boolean;
        rollupOptions?: { input?: string; output?: { entryFileNames?: string } };
      };
    };
    expect(config.publicDir).toBe(false);
    expect(config.build?.copyPublicDir).toBe(false);
    expect(config.build?.rollupOptions?.input).toBe('/manager-docs-blocks.js');
    expect(config.build?.rollupOptions?.output?.entryFileNames).toBe(STATIC_COMPONENT_BLOCKS_FILE);
  });
});

function productionOptions(outputDir: string, docsFile: string): Options {
  return {
    configType: 'PRODUCTION',
    outputDir,
    configDir: '/proj/.storybook',
    cacheKey: 'test',
    presets: {
      apply: async (name: string, config?: unknown) => {
        if (name === 'storyIndexGenerator') {
          return {
            getIndex: async () => ({
              entries: {
                docs: { type: 'docs', id: 'guide--docs', importPath: docsFile },
              },
            }),
          };
        }
        if (name === 'viteCorePlugins') {
          return [];
        }
        return config;
      },
    },
  } as Options;
}
