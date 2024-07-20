import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import { describe, it } from 'vitest';

import { codemodLegacyNodes } from './index';

import { getSvelteAST } from '#parser/ast';
import { print } from 'svelte-ast-print';
import dedent from 'dedent';

describe(codemodLegacyNodes.name, () => {
  it("replaces 'export const meta' with 'defineMeta'", async ({ expect }) => {
    const code = dedent(`
      <script context="module">
        import { Story } from "${pkg.name}";

        /** This is a description for the **Button** component stories. */
				export const meta = {
          title: "Atoms/Button",
          component: Button,
        };
      </script>

			<!-- This is a description for **default** Button. -->
      <Story name="Default" />
    `);
    const ast = getSvelteAST({ code });
    const transformed = await codemodLegacyNodes({ ast });

    expect(print(transformed)).toMatchInlineSnapshot(`
      "<script context="module">
      	import { defineMeta } from "@storybook/addon-svelte-csf";

      	/** This is a description for the **Button** component stories. */
      	const { Story } = defineMeta({ title: "Atoms/Button", component: Button });
      </script>

      <!-- This is a description for **default** Button. -->
      <Story name="Default" />"
    `);
  });

  it("replaces 'Meta' with inserting 'defineMeta' to module tag", async ({ expect }) => {
    const code = dedent(`
      <script context="module">
        import { Meta, Template } from "${pkg.name}";
      </script>

			<!-- This is a description for the **Button** component stories. -->
      <Meta title="Atoms/Button" component={Button} />
    `);
    const ast = getSvelteAST({ code });
    const transformed = await codemodLegacyNodes({ ast });

    expect(print(transformed)).toMatchInlineSnapshot(
      `
      "<script context="module">
      	import { defineMeta } from "@storybook/addon-svelte-csf";

      	/** This is a description for the **Button** component stories. */
      	const { Story } = defineMeta({ title: "Atoms/Button", component: Button });
      </script>"
    `
    );
  });

  it("replaces 'Template' with snippet block", async ({ expect }) => {
    const code = dedent(`
      <script context="module">
        import { Meta, Template } from "${pkg.name}";
      </script>

			<!-- This is a description for the **Button** component stories. -->
      <Meta title="Atoms/Button" component={Button} />

      <Template let:args>
        <Button {...args} />
      </Template>

      <Story name="Default" />
    `);
    const ast = getSvelteAST({ code });
    const transformed = await codemodLegacyNodes({ ast });

    expect(print(transformed)).toMatchInlineSnapshot(`
			"<script context="module">
				import { defineMeta } from "@storybook/addon-svelte-csf";

				/** This is a description for the **Button** component stories. */
				const { Story } = defineMeta({ title: "Atoms/Button", component: Button });
			</script>

			{#snippet children(args)}
				<Button {...args} />
			{/snippet}
			<Story name="Default" />"
		`);
  });

  it('transforms legacy syntax correctly', async ({ expect }) => {
    const code = dedent(`
      <script context="module">
        import { Meta, Story, Template } from "${pkg.name}";
      </script>

			<!-- This is a description for the **Button** component stories. -->
      <Meta title="Atoms/Button" component={Button} />

      <Template id="sample" let:args let:context>
        <p>{context.id}</p>
        <Button {...args} />
      </Template>

      <Story name="Default" autodocs source={"<Button {...args} />"} template="sample" let:args let:context>
        <p>{context.id}</p>
        <Button {...args} />
      </Story>
    `);
    const ast = getSvelteAST({ code });
    const transformed = await codemodLegacyNodes({ ast });

    expect(print(transformed)).toMatchInlineSnapshot(`
      "<script context="module">
      	import { defineMeta } from "@storybook/addon-svelte-csf";

      	/** This is a description for the **Button** component stories. */
      	const { Story } = defineMeta({ title: "Atoms/Button", component: Button });
      </script>

      {#snippet sample(args, context)}
      	<p>{context.id}</p>
      	<Button {...args} />
      {/snippet}
      <Story name="Default" children={sample} tags={["autodocs"]} parameters={{
      	docs: { source: { code: "<Button {...args} />" } }
      }}>
      	{#snippet children(args, context)}
      		<p>{context.id}</p>
      		<Button {...args} />
      	{/snippet}
      </Story>"
    `);
  });
});
