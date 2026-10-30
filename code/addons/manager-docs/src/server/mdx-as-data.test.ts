import { readFile } from 'node:fs/promises';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { viteFinal, webpackFinal } from '../preset.ts';
import { addMdxSourceRule, inertMdxModule, loadMdxModule, mdxFileFromId } from './mdx-as-data.ts';

vi.mock('node:fs/promises', { spy: true });

const source =
  "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';\n\n# Vue preview\n\n<SB.Story of={SourceCodeStories.Default} />\n";

describe('mdx as data', () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({ '/proj/src/Vue.mdx': source });
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof readFile
    );
  });

  it('recognizes an mdx module id and ignores other files', () => {
    expect(mdxFileFromId('/proj/src/Vue.mdx')).toBe('/proj/src/Vue.mdx');
    expect(mdxFileFromId('/proj/src/Vue.mdx?raw')).toBe('/proj/src/Vue.mdx');
    expect(mdxFileFromId('/proj/src/Vue.MDX')).toBe('/proj/src/Vue.MDX');
    expect(mdxFileFromId('/proj/src/Button.stories.ts')).toBeUndefined();
    expect(mdxFileFromId('/proj/src/file.mdx.ts')).toBeUndefined();
    expect(mdxFileFromId('\0virtual.mdx')).toBeUndefined();
    expect(mdxFileFromId({ id: '/proj/src/Vue.mdx' })).toBeUndefined();
  });

  it('loads mdx as a js module so Vite 8 can transform it', async () => {
    expect(inertMdxModule(source)).toBe(`export default ${JSON.stringify(source)};`);
    expect(await loadMdxModule('/proj/src/Vue.mdx')).toEqual({
      code: inertMdxModule(source),
      moduleType: 'js',
    });
    expect(await loadMdxModule('/proj/src/Vue.mdx?raw')).toEqual({
      code: inertMdxModule(source),
      moduleType: 'js',
    });
    expect(await loadMdxModule('/proj/src/Button.stories.ts')).toBeUndefined();
  });

  it('registers the vite load hook and the webpack source rule', async () => {
    const viteConfig = await viteFinal(
      { plugins: [{ name: 'vue' }] },
      { configType: 'DEVELOPMENT' }
    );
    expect(viteConfig.plugins?.[0]).toMatchObject({
      name: 'storybook:manager-docs-mdx-data',
      enforce: 'pre',
      load: loadMdxModule,
    });
    expect(viteConfig.plugins?.[1]).toMatchObject({ name: 'vue' });

    const webpackConfig = await webpackFinal(
      { module: { rules: [{ test: /\.vue$/ }] } },
      { configType: 'DEVELOPMENT' }
    );
    expect(webpackConfig.module?.rules).toEqual([
      { test: /\.vue$/ },
      { test: /\.mdx$/i, type: 'asset/source' },
    ]);
  });

  it('creates the webpack module config when it is missing', () => {
    expect(addMdxSourceRule({}).module?.rules).toEqual([{ test: /\.mdx$/i, type: 'asset/source' }]);
  });
});
