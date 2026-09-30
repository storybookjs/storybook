import {
  SVELTE_CSF_LEGACY_IMPORT_SOURCE,
  SVELTE_CSF_RENDERER_IMPORT_SOURCE,
} from '../constants.ts';
import { dedent } from 'ts-dedent';
import { describe, it } from 'vitest';

import { preTransformPlugin } from './plugins.ts';

async function runPreTransform(code: string) {
  const plugin = await preTransformPlugin();
  const { handler } = plugin.transform as {
    handler: (code: string, id: string) => Promise<{ code: string; meta: Record<string, unknown> }>;
  };

  return handler.call({}, code, '/Button.stories.svelte');
}

describe(preTransformPlugin.name, () => {
  it('keeps the original code when there is no legacy syntax', async ({ expect }) => {
    const code = dedent(`
      <script module>
        import { defineMeta } from "${SVELTE_CSF_RENDERER_IMPORT_SOURCE}";
        import Button from "./Button.svelte";

        const { Story } = defineMeta({ component: Button });
      </script>

      <Story name="Custom template">
        {#snippet template(args)}
          <Button {...args}>First</Button>
          <Button {...args}>Second</Button>
        {/snippet}
      </Story>
    `);

    const result = await runPreTransform(code);

    expect(result.code).toBe(code);
    expect(result.meta._storybook_csf_pre_transform).toBe(code);
  });

  it('transforms legacy syntax', async ({ expect }) => {
    const code = dedent(`
      <script context="module">
        import { Story } from "${SVELTE_CSF_LEGACY_IMPORT_SOURCE}";
        import Button from "./Button.svelte";

        export const meta = { component: Button };
      </script>

      <Story name="Default" />
    `);

    const result = await runPreTransform(code);

    expect(result.code).toContain('defineMeta');
    expect(result.meta._storybook_csf_pre_transform).toBe(result.code);
  });

  it('does not repeat the last character of a legacy file', async ({ expect }) => {
    const code = dedent(`
      <script context="module">
        import { Story } from "${SVELTE_CSF_LEGACY_IMPORT_SOURCE}";
        import Button from "./Button.svelte";

        export const meta = { component: Button };
      </script>

      <Story name="Default" />
      foo
    `);

    const result = await runPreTransform(code);

    expect(code.endsWith('foo')).toBe(true);
    expect(result.code).toMatch(/[^o]foo$/);
  });
});
