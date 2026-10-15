import { parseAst } from 'rollup/parseAst';
import type { Plugin } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { generateDocgen } from './generateDocgen.ts';
import { svelteDocgen } from './svelte-docgen.ts';

vi.mock('./generateDocgen.ts', () => ({
  createDocgenCache: () => ({}),
  generateDocgen: vi.fn(() => ({
    props: [{ name: 'title', type: { type: 'string', text: 'string' } }],
  })),
}));

type HandlerContext = {
  parse: typeof parseAst;
  warn: (message: string) => void;
};

type TransformPlugin = {
  order?: 'pre' | 'post' | null;
  handler: (this: HandlerContext, src: string, id: string) => Promise<unknown>;
};

const getTransform = async () => ((await svelteDocgen()) as Plugin).transform as TransformPlugin;

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
  it('runs after the Svelte compile plugin (order post)', async () => {
    expect((await getTransform()).order).toBe('post');
  });

  it.each(['/project/src/Button.stories.svelte', '/project/node_modules/lib/Button.svelte'])(
    'skips %s without a docgen pass or a warning',
    async (id) => {
      const warn = vi.fn();
      const context: HandlerContext = { parse: parseAst, warn };

      const result = await (await getTransform()).handler.call(context, compiledSvelteSource, id);

      expect(result).toBeUndefined();
      expect(generateDocgen).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it('skips docgen for a failing file with a warning instead of failing the module', async () => {
    const warn = vi.fn();
    const context: HandlerContext = { parse: parseAst, warn };

    const result = await (
      await getTransform()
    ).handler.call(context, rawSvelteSource, '/project/src/Legacy.svelte');

    expect(result).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Legacy.svelte');
    expect(warn.mock.calls[0][0]).toContain('skipping docgen');
  });

  it('attaches __docgen to the compiled component', async () => {
    const context: HandlerContext = { parse: parseAst, warn: vi.fn() };

    const result = (await (
      await getTransform()
    ).handler.call(context, compiledSvelteSource, '/project/src/Legacy.svelte')) as {
      code: string;
    };

    expect(result.code).toContain(';App.__docgen = ');
    expect(result.code).toContain('"name":"Legacy.svelte"');
    expect(result.code).toContain('"title"');
  });
});
