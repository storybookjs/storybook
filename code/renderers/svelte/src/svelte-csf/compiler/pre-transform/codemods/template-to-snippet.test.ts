import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformTemplateToSnippet } from './template-to-snippet';

import { extractLegacySvelteComponents } from '#compiler/pre-transform/extractor';
import { getSvelteAST } from '#parser/ast';

describe(transformTemplateToSnippet.name, () => {
  it("covers a case without provided prop 'id'", ({ expect }) => {
    const code = `
      <Template let:args>
        <Button {...args} variant="primary" />
      </Template>
    `;
    const parsed = getSvelteAST({ code });
    const { componentsTemplate } = extractLegacySvelteComponents(parsed);
    const template = componentsTemplate[0];

    expect(print(transformTemplateToSnippet(template))).toMatchInlineSnapshot(`
			"{#snippet children(args, storyContext)}
				<Button {...args} variant="primary" />
			{/snippet}"
		`);
  });

  it("covers a case with provided prop 'id'", ({ expect }) => {
    const code = `
      <Template id="coolTemplate" let:args>
        <Button {...args} variant="primary" />
      </Template>
    `;
    const parsed = getSvelteAST({ code });
    const { componentsTemplate } = extractLegacySvelteComponents(parsed);
    const template = componentsTemplate[0];

    expect(print(transformTemplateToSnippet(template))).toMatchInlineSnapshot(`
			"{#snippet coolTemplate(args, storyContext)}
				<Button {...args} variant="primary" />
			{/snippet}"
		`);
  });
});
