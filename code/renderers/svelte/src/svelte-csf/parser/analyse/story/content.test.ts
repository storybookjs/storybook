import { describe, it } from 'vitest';

import { getStoryContentRawCode } from './content.js';

import { getSvelteAST } from '$lib/parser/ast.js';
import { extractSvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';

describe(getStoryContentRawCode.name, () => {
  describe('When a `<Story />` is a self-closing tag...', () => {
    it('works when `template` attribute was provided with a reference to snippet at the root of fragment', async ({
      expect,
    }) => {
      const code = `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        {#snippet template(args)}
          <SomeComponent {...args} />
        {/snippet}

        <Story name="Default" {template} />
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = getStoryContentRawCode({
        nodes: {
          component,
          svelte: svelteASTNodes,
        },
        originalCode: code,
      });

      expect(rawSource).toBe('<SomeComponent {...args} />');
    });

    it('works when `setTemplate` was used correctly in the instance tag', async ({ expect }) => {
      const code = `
        <script module>
          import { defineMeta, setTemplate } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <script>
          setTemplate(template);
        </script>

        {#snippet template(args)}
          <SomeComponent {...args} />
        {/snippet}

        <Story name="Default" />
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = getStoryContentRawCode({
        nodes: {
          component,
          svelte: svelteASTNodes,
        },
        originalCode: code,
      });

      expect(rawSource).toBe('<SomeComponent {...args} />');
    });

    it('works implicit `template` attribute takes precedence over `setTemplate`', async ({
      expect,
    }) => {
      const code = `
        <script module>
          import { defineMeta, setTemplate } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <script>
          setTemplate(template);
        </script>

        {#snippet templateForSetTemplate(args)}
          <SomeComponent wins="setTemplate" {...args} />
        {/snippet}

        {#snippet templateForChildren(args)}
          <SomeComponent wins="childrenAttribute" {...args} />
        {/snippet}

        <Story name="Default" template={templateForChildren} />
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = getStoryContentRawCode({
        nodes: {
          component,
          svelte: svelteASTNodes,
        },
        originalCode: code,
      });

      expect(rawSource).toBe(`<SomeComponent wins="childrenAttribute" {...args} />`);
    });

    it('works when no `setTemplate`, no `template` attribute, just a story', async ({ expect }) => {
      const code = `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <Story name="Default" />
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = getStoryContentRawCode({
        nodes: {
          component,
          svelte: svelteASTNodes,
        },
        originalCode: code,
      });

      expect(rawSource).toBe(`<SampleComponent {...args} />`);
    });
  });

  describe('When a `<Story />` is NOT a self-closing tag...', () => {
    it('works when a static children content provided', async ({ expect }) => {
      const code = `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <Story name="Default">
          <h1>Static content</h1>
        </Story>
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = getStoryContentRawCode({
        nodes: {
          component,
          svelte: svelteASTNodes,
        },
        originalCode: code,
      });

      expect(rawSource).toBe(`<h1>Static content</h1>`);
    });

    it("works when a `template` svelte's snippet block used inside", async ({ expect }) => {
      const code = `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <Story name="Default">
          {#snippet template(args)}
            <SomeComponent {...args} />
          {/snippet}
        </Story>
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = getStoryContentRawCode({
        nodes: {
          component,
          svelte: svelteASTNodes,
        },
        originalCode: code,
      });

      expect(rawSource).toBe(`<SomeComponent {...args} />`);
    });

    it("inner `<Story>`'s template content takes precedence over `setTemplate`", async ({
      expect,
    }) => {
      const code = `
        <script module>
          import { defineMeta, setTemplate } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <script>
          setTemplate(template);
        </script>

        {#snippet templateForSetTemplate(args)}
          <SomeComponent wins="setTemplate" {...args} />
        {/snippet}

        <Story name="Default">
          {#snippet template(args)}
            <SomeComponent wins="inner-template" {...args} />
          {/snippet}
        </Story>
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = getStoryContentRawCode({
        nodes: {
          component,
          svelte: svelteASTNodes,
        },
        originalCode: code,
      });

      expect(rawSource).toBe(`<SomeComponent wins="inner-template" {...args} />`);
    });
  });
});
