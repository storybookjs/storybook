import { describe, expect, it, vi } from 'vitest';

import { svelteDocgen } from './svelte-docgen.ts';

vi.mock('./generateDocgen.ts', () => ({
  createDocgenCache: () => ({}),
  generateDocgen: () => ({
    props: [{ name: 'title', type: { type: 'string', text: 'string' } }],
  }),
}));

type HandlerContext = {
  parse: (code: string) => unknown;
  warn: (message: string) => void;
};

type TransformPlugin = {
  order?: 'pre' | 'post' | null;
  filter: { id: { include: RegExp; exclude: RegExp } };
  handler: (this: HandlerContext, src: string, id: string) => Promise<unknown>;
};

// Raw template markup, as a JS parser sees it when the Svelte compile plugin has not run yet
const rawSvelteSource = `<script lang="ts">
  export let title: string = 'legacy';
</script>

<div>{title}</div>`;

// What @sveltejs/vite-plugin-svelte hands to later transforms
const compiledSvelteSource = `
  function App($$anchor, $$props) {}
  export default App;
`;

describe(svelteDocgen.name, () => {
  it('runs after the Svelte compile plugin (order post) and only transforms .svelte modules', async () => {
    const plugin = (await svelteDocgen()) as { transform: TransformPlugin };

    expect(plugin.transform.order).toBe('post');
    expect(plugin.transform.filter.id.include.test('/project/src/Button.svelte')).toBe(true);
    expect(plugin.transform.filter.id.include.test('/project/src/Button.stories.svelte')).toBe(true);
    expect(
      plugin.transform.filter.id.exclude.test('/project/node_modules/lib/Button.svelte')
    ).toBe(true);
  });

  it('skips docgen for a failing file with a warning instead of failing the module', async () => {
    const plugin = (await svelteDocgen()) as { transform: TransformPlugin };
    const warn = vi.fn();
    const context: HandlerContext = {
      parse: () => {
        // e.g. raw `.svelte` markup parsed as JSX: "Unexpected JSX expression"
        throw new Error('Unexpected JSX expression');
      },
      warn,
    };

    const result = await plugin.transform.handler.call(
      context,
      rawSvelteSource,
      '/project/src/Legacy.svelte'
    );

    expect(result).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Legacy.svelte');
    expect(warn.mock.calls[0][0]).toContain('Unexpected JSX expression');
  });

  it('attaches __docgen to the compiled component', async () => {
    const plugin = (await svelteDocgen()) as { transform: TransformPlugin };
    const context: HandlerContext = {
      parse: () => ({
        body: [
          { type: 'ExportDefaultDeclaration', declaration: { type: 'Identifier', name: 'App' } },
        ],
      }),
      warn: () => {},
    };

    const result = (await plugin.transform.handler.call(
      context,
      compiledSvelteSource,
      '/project/src/Legacy.svelte'
    )) as { code: string };

    expect(result.code).toContain(';App.__docgen = ');
    expect(result.code).toContain('"name":"Legacy.svelte"');
    expect(result.code).toContain('"title"');
  });
});
