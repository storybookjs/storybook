import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import dedent from 'dedent';
import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { codemodLegacyNodes } from './index.js';

import { getSvelteAST } from '$lib/parser/ast.js';

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
      <script>
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
      "<script module>
      	import { defineMeta } from "@storybook/addon-svelte-csf";

      	/** This is a description for the **Button** component stories. */
      	const { Story } = defineMeta({ title: "Atoms/Button", component: Button });
      </script>

      {#snippet sb_default_template(args)}
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
       
      {/snippet} <Story name="Default" children={sample} tags={["autodocs"]} parameters={{
      	docs: { source: { code: "<Button {...args} />" } }
      }}>
      	{#snippet children(args, context)}
      		<p>{context.id}</p>
      		<Button {...args} />
       
      	{/snippet}
      </Story>"
    `);
  });

  it('moves package import declaration from instance to module tag', async ({ expect }) => {
    const code = dedent(`
      <script>
        import { Meta, Story, Template } from "${pkg.name}";
      </script>
    `);
    const ast = getSvelteAST({ code });
    const transformed = await codemodLegacyNodes({ ast });

    expect(print(transformed)).toMatchInlineSnapshot(`
      "<script module>
      	import { defineMeta } from "@storybook/addon-svelte-csf";
      </script>"
    `);
  });

  it('moves transformed export const meta from instance to module tag', async ({ expect }) => {
    const code = dedent(`
      <script>
        import { Story, Template } from "${pkg.name}";

        export const meta = {
          args: {
            primary: true,
          },
          tags: ["autodocs"],
        };
      </script>
    `);
    const ast = getSvelteAST({ code });
    const transformed = await codemodLegacyNodes({ ast });

    expect(print(transformed)).toMatchInlineSnapshot(`
      "<script module>
      	import { defineMeta } from "@storybook/addon-svelte-csf";

      	const { Story } = defineMeta({
      		args: { primary: true },
      		tags: ["autodocs"]
      	});
      </script>"
    `);
  });

  it('moves transformed export const meta and stories component import declaration from instance to module tag', async ({
    expect,
  }) => {
    const code = dedent(`
      <script>
        import { Story, Template } from "${pkg.name}";
        import Button from "./Button.svelte";

        export const meta = {
          component: Button,
          args: {
            primary: true,
          },
          tags: ["autodocs"],
        };
      </script>
    `);
    const ast = getSvelteAST({ code });
    const transformed = await codemodLegacyNodes({ ast });

    expect(print(transformed)).toMatchInlineSnapshot(`
      "<script module>
      	import { defineMeta } from "@storybook/addon-svelte-csf";
      	import Button from "./Button.svelte";

      	const { Story } = defineMeta({
      		component: Button,
      		args: { primary: true },
      		tags: ["autodocs"]
      	});
      </script>"
    `);
  });

  it('throws error on more than one unidentified <Template> components', async ({ expect }) => {
    const code = `
      <script module lang="ts">
        import { Story, Template } from "${pkg.name}";
      </script>

      <Template let:context>
        <p>{context.args}</p>
      </Template>

      <Story name="Default" />

      <Template let:args>
        <Button {...args} />
      </Template>

      <Story name="NextOne" />
    `;
    const ast = getSvelteAST({ code });
    expect(codemodLegacyNodes({ ast })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_SVELTE_CSF_LEGACY_API_0003 (DuplicatedUnidentifiedTemplateError): Stories file: undefined
      has two '<Template />' components without provided prop 'id'. This leads to unwanted runtime behavior.

      Please provide an 'id' to one of them.
      And for the '<Story />' component(s) which are supposed to use it, add the 'template' prop with the same 'id' value.

      More info: https://github.com/storybookjs/addon-svelte-csf/blob/v4.1.2/ERRORS.md#SB_SVELTE_CSF_LEGACY_API_0003
      ]
    `);
  });

  it('moves import declaration of stories target component from instance tag to module tag', async ({
    expect,
  }) => {
    const code = `
      <script context="module" lang="ts">
        export const meta: Meta<Button> = {
          component: Button,
        };
      </script>

      <script>
        import { Story } from "${pkg.name}";
        import Button from "./Button.svelte";
      </script>
    `;

    const ast = getSvelteAST({ code });
    const transformed = await codemodLegacyNodes({ ast });

    expect(print(transformed)).toMatchInlineSnapshot(`
      "<script context="module" lang="ts">
      	import { defineMeta } from "@storybook/addon-svelte-csf";
      	import Button from "./Button.svelte";

      	const { Story } = defineMeta({ component: Button });
      </script>"
    `);
  });
});
