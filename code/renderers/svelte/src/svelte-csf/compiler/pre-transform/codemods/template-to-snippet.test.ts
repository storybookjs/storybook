import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformTemplateToSnippet } from './template-to-snippet';

import type { SvelteAST } from '#parser/ast';
import { parseAndExtractSvelteNode } from '#tests/extractor';

describe(transformTemplateToSnippet.name, () => {
  it("covers a case without provided prop 'id'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Template } from "${pkg.name}";
      </script>

      <Template let:args>
        <Button {...args} variant="primary" />
      </Template>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformTemplateToSnippet({ component })
      )
    ).toMatchInlineSnapshot(`
      "{#snippet sb_default_template(args)}
      	<Button {...args} variant="primary" />
      {/snippet}"
    `);
  });

  it("covers a case with provided prop 'id'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Template } from "${pkg.name}";
      </script>

      <Template id="coolTemplate" let:args>
        <Button {...args} variant="primary" />
      </Template>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformTemplateToSnippet({ component })
      )
    ).toMatchInlineSnapshot(`
			"{#snippet coolTemplate(args)}
				<Button {...args} variant="primary" />
			{/snippet}"
		`);
  });

  it("works with 'let:context' directive", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Template } from "${pkg.name}";
      </script>

      <Template let:context>
        <p>{context.args}</p>
      </Template>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformTemplateToSnippet({ component })
      )
    ).toMatchInlineSnapshot(`
      "{#snippet sb_default_template(_args, context)}
      	<p>{context.args}</p>
      {/snippet}"
    `);
  });
});
