import type { PreprocessorGroup } from 'svelte/compiler';
import type { Plugin, ResolvedConfig } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import {
  SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE,
  svelteCsfRuntimeStoriesPath,
  transformSvelteCsf,
} from '@storybook/svelte/internal/svelte-csf/transform';

import { svelteCsf } from './svelte-csf.ts';

vi.mock('@storybook/svelte/internal/svelte-csf/transform', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  transformSvelteCsf: vi.fn(async () => ({ code: '', map: null })),
}));

type Handler<T> = { filter: { id: RegExp }; handler: T };

describe(svelteCsf.name, () => {
  it('resolves the runtime stories import to its file, and leaves other imports alone', () => {
    const { filter, handler } = svelteCsf().resolveId as Handler<() => string>;

    expect(filter.id.test(SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE)).toBe(true);
    expect(filter.id.test(`${SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE}.js`)).toBe(false);
    expect(filter.id.test('./Button.svelte')).toBe(false);
    expect(handler()).toBe(svelteCsfRuntimeStoriesPath);
  });

  it('only transforms stories files and their styles', () => {
    const { filter } = svelteCsf().transform as Handler<unknown>;

    expect(filter.id.test('/project/src/Button.stories.svelte')).toBe(true);
    expect(filter.id.test('/project/src/Button.stories.svelte?svelte&type=style&lang.css')).toBe(
      true
    );
    expect(filter.id.test('/project/src/Button.svelte')).toBe(false);
    expect(filter.id.test('/project/src/Button.svelte?svelte&type=style&lang.css')).toBe(false);
  });

  it('keeps the styles of a stories file while the stories file is used, not only its default export', () => {
    const { handler } = svelteCsf().transform as Handler<(code: string, id: string) => unknown>;

    expect(handler('', '/project/src/Button.stories.svelte?svelte&type=style&lang.css')).toEqual({
      code: '',
      meta: { vite: { cssScopeTo: ['/project/src/Button.stories.svelte', undefined] } },
    });
  });

  it('passes the preprocessors that vite-plugin-svelte resolved, including its inline options', async () => {
    const preprocess: PreprocessorGroup = { name: 'inline' };
    const vitePluginSvelte = { name: 'vite-plugin-svelte:config', api: {} as { options?: object } };
    const plugin = svelteCsf();

    (plugin.configResolved as (config: ResolvedConfig) => void)({
      plugins: [vitePluginSvelte as Plugin],
    } as unknown as ResolvedConfig);
    // vite-plugin-svelte fills its options in its own configResolved hook, which can run later
    vitePluginSvelte.api.options = { preprocess };

    const { handler } = plugin.transform as Extract<Plugin['transform'], { handler: unknown }>;
    const context = {
      parse: () => ({ type: 'Program', body: [] }),
    } as unknown as ThisParameterType<typeof handler>;
    await handler.call(context, 'code', '/Button.stories.svelte');

    expect(transformSvelteCsf).toHaveBeenCalledWith(expect.objectContaining({ preprocess }));
  });
});
