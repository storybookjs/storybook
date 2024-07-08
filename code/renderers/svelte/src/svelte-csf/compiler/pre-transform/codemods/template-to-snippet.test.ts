import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type { Component } from 'svelte/compiler';
import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformTemplateToSnippet } from './template-to-snippet';

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
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformTemplateToSnippet(node))).toMatchInlineSnapshot(`
			"{#snippet children(args)}
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
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformTemplateToSnippet(node))).toMatchInlineSnapshot(`
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
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformTemplateToSnippet(node))).toMatchInlineSnapshot(`
			"{#snippet children(_args, context)}
				<p>{context.args}</p>
			{/snippet}"
		`);
  });
});
