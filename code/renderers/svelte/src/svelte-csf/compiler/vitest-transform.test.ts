import fs from 'node:fs/promises';

import { getStoryTitle } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import { vitestTransform } from 'storybook/internal/csf-tools';
import type { IndexerOptions } from 'storybook/internal/types';

import MagicString from 'magic-string';
import { fs as memfs, vol } from 'memfs';
import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { dedent } from 'ts-dedent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transformStoriesCode } from './post-transform/index.ts';
import { createIndexer } from '../indexer/index.ts';
import { getSvelteAST } from '../parser/ast.ts';
import { extractCompiledASTNodes } from '../parser/extract/compiled/nodes.ts';
import { extractSvelteASTNodes } from '../parser/extract/svelte/nodes.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vi.mocked(getStoryTitle).mockReturnValue('Button');
  vi.mocked(fs.readFile).mockImplementation(memfs.promises.readFile as typeof fs.readFile);
  vol.reset();
});

const filename = 'src/Button.stories.svelte';

const testNamesOf = (output: string) =>
  [...output.matchAll(/_test\("([^"]*)"/g)].map(([, name]) => name);

// The names the story index gives the stories of a file: the Svelte CSF indexer, then the fallback
// of the index generator.
async function indexNamesOf(originalCode: string) {
  vol.fromJSON({ [filename]: originalCode });
  const stories = await createIndexer().createIndex(filename, {
    makeTitle: (title) => title ?? 'Button',
  } as IndexerOptions);
  return stories.map(({ name, exportName }) => name ?? storyNameFromExport(exportName));
}

// The path of a `.stories.svelte` file in addon-vitest: the Svelte compiler, then Svelte CSF, then
// the Vitest transform of core.
async function transform(originalCode: string) {
  const compiledCode = compile(originalCode, { filename, dev: true }).js.code;
  const code = new MagicString(compiledCode);

  await transformStoriesCode({
    code,
    nodes: {
      svelte: await extractSvelteASTNodes({
        ast: getSvelteAST({ code: originalCode, filename }),
        filename,
      }),
      compiled: await extractCompiledASTNodes({ ast: parseAst(compiledCode), filename }),
    },
    filename,
    originalCode,
  });

  const transformed = await vitestTransform({
    code: code.toString(),
    fileName: filename,
    configDir: '.storybook',
    stories: [],
    tagsFilter: { include: ['test'], exclude: [], skip: [] },
    previewLevelTags: [],
  });

  return typeof transformed === 'string' ? transformed : transformed.code;
}

describe('vitestTransform test names of a stories file', () => {
  it('names each test like the index names its story', async () => {
    const source = dedent`
      <script module>
        import { defineMeta } from '@storybook/svelte';
        import Button from './Button.svelte';

        const { Story } = defineMeta({ component: Button });
      </script>

      <Story name="Today" />

      <Story name="Hover Shows Full Date" />

      <Story name="URL input (loading)" />

      <Story name="Custom" exportName="DifferentExport" />

      <Story exportName="OnlyExportName" />
    `;

    const testNames = testNamesOf(await transform(source));

    expect(testNames).toEqual([
      'Today',
      'Hover Shows Full Date',
      'URL input (loading)',
      'Custom',
      'Only Export Name',
    ]);
    expect(testNames).toEqual(await indexNamesOf(source));
  });
});

describe('vitestTransform of a CSF factories stories file', () => {
  it('tests the stories with the meta of the file', async () => {
    const output = await transform(dedent`
      <script module>
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const { Story } = preview.meta({ component: Button });
      </script>

      <Story name="Primary" args={{ label: 'Primary' }} />

      <Story name="Button" args={{ label: 'Button' }} />

      <Story name="Not tested" args={{ label: 'Not tested' }} tags={['!test']} />
    `);

    expect(output).toContain('title: "Button"');
    expect(output.slice(output.indexOf('const _isRunningFromThisFile'))).toMatchInlineSnapshot(`
      "const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
      if (_isRunningFromThisFile) {
        _test("Primary", _testStory({ exportName: "Primary", story: $__Primary, meta: $__meta, skipTags: [], storyId: "button--primary", componentPath: "./Button.svelte", componentName: "Button" }));
        _test("Button", _testStory({ exportName: "Button", story: $__Button, meta: $__meta, skipTags: [], storyId: "button--button", componentPath: "./Button.svelte", componentName: "Button" }));
      }
      "
    `);
  });

  it('names each test like the index names its story', async () => {
    const source = dedent`
      <script module>
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const { Story } = preview.meta({ component: Button });
      </script>

      <Story name="Hover Shows Full Date" />

      <Story name="Without tooltip" extend="Hover Shows Full Date" />
    `;

    const testNames = testNamesOf(await transform(source));

    expect(testNames).toEqual(['Hover Shows Full Date', 'Without tooltip']);
    expect(testNames).toEqual(await indexNamesOf(source));
  });

  it('tests the stories of the Story components from meta.type<>()', async () => {
    const output = await transform(dedent`
      <script module lang="ts">
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const meta = preview.meta({ component: Button });
        const { Story } = meta;
        const { Story: IconStory } = meta.type<{ args: { icon: string } }>();
      </script>

      <Story name="Primary" args={{ label: 'Primary' }} />

      <IconStory name="Icon" args={{ label: 'Icon', icon: 'star' }} />
    `);

    expect(output.slice(output.indexOf('const _isRunningFromThisFile'))).toMatchInlineSnapshot(`
      "const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
      if (_isRunningFromThisFile) {
        _test("Primary", _testStory({ exportName: "Primary", story: $__Primary, meta: meta, skipTags: [], storyId: "button--primary", componentPath: "./Button.svelte", componentName: "Button" }));
        _test("Icon", _testStory({ exportName: "Icon", story: $__Icon, meta: meta, skipTags: [], storyId: "button--icon", componentPath: "./Button.svelte", componentName: "Button" }));
      }
      "
    `);
  });

  it('tests the Story components declared together with Story', async () => {
    const output = await transform(dedent`
      <script module lang="ts">
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const meta = preview.meta({ component: Button });
        const { Story } = meta,
          { Story: IconStory } = meta.type<{ args: { icon: string } }>();
      </script>

      <Story name="Primary" />

      <IconStory name="Icon" args={{ icon: 'star' }} />
    `);

    expect([...output.matchAll(/_test\("(\w+)"/g)].map(([, name]) => name)).toEqual([
      'Primary',
      'Icon',
    ]);
  });
});
