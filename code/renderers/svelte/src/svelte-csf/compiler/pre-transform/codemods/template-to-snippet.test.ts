import { SVELTE_CSF_IMPORT_SOURCE } from '../../../constants.ts';
import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformTemplateToSnippet } from './template-to-snippet.ts';

import type { SvelteAST } from '../../../parser/ast.ts';
import { parseAndExtractSvelteNode } from '../../../__tests__/extractor.ts';

describe(transformTemplateToSnippet.name, () => {
  it("covers a case without provided prop 'id'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Template } from "${SVELTE_CSF_IMPORT_SOURCE}";
      </script>

      <Template let:args>
        <Button {...args} variant="primary" />
      </Template>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(print(transformTemplateToSnippet({ component }))).toMatchInlineSnapshot(`
      "{#snippet sb_default_template(args)}
      	<Button {...args} variant="primary" />
      {/snippet}"
    `);
  });

  it("covers a case with provided prop 'id'", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Template } from "${SVELTE_CSF_IMPORT_SOURCE}";
      </script>

      <Template id="coolTemplate" let:args>
        <Button {...args} variant="primary" />
      </Template>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(print(transformTemplateToSnippet({ component }))).toMatchInlineSnapshot(`
			"{#snippet coolTemplate(args)}
				<Button {...args} variant="primary" />
			{/snippet}"
		`);
  });

  it("covers a case with provided prop 'id' and prop `id` not being a valid identifier", async ({
    expect,
  }) => {
    const code = `
      <script context="module" lang="ts">
        import { Template } from "${SVELTE_CSF_IMPORT_SOURCE}";
      </script>

      <Template id="cool-template" let:args>
        <Button {...args} variant="primary" />
      </Template>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(print(transformTemplateToSnippet({ component }))).toMatchInlineSnapshot(`
      "{#snippet template_haitqt(args)}
      	<Button {...args} variant="primary" />
      {/snippet}"
    `);
  });

  it("works with 'let:context' directive", async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Template } from "${SVELTE_CSF_IMPORT_SOURCE}";
      </script>

      <Template let:context>
        <p>{context.args}</p>
      </Template>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(print(transformTemplateToSnippet({ component }))).toMatchInlineSnapshot(`
      "{#snippet sb_default_template(_args, context)}
      	<p>{context.args}</p>
      {/snippet}"
    `);
  });

  it.for(['{null}', '{0}', '{false}'])(
    "uses the default snippet name when prop 'id' is %s",
    async (value, { expect }) => {
      const code = `
        <script context="module" lang="ts">
          import { Template } from "${SVELTE_CSF_IMPORT_SOURCE}";
        </script>

        <Template id=${value} let:args>
          <Button {...args} />
        </Template>
      `;
      const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

      expect(print(transformTemplateToSnippet({ component }))).toContain(
        '{#snippet sb_default_template(args)}'
      );
    }
  );
});
