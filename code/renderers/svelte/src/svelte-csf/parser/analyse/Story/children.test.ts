import { describe, it } from 'vitest';

import { getStoryChildrenRawSource } from './children.js';

import { getSvelteAST } from '../../ast.js';
import { extractSvelteASTNodes } from '../../extract/svelte/nodes.js';

describe(getStoryChildrenRawSource.name, () => {
  describe('When a `<Story />` is a self-closing tag...', () => {
    it('works when `children` attribute was provided with a reference to snippet at the root of fragment', async ({
      expect,
    }) => {
      const code = `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        {#snippet template(args)}
          <SomeComponent {...args} />
        {/snippet}

        <Story name="Default" children={template} />
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = await getStoryChildrenRawSource({
        component,
        svelteASTNodes,
        originalCode: code,
      });

      expect(rawSource).toBe('<SomeComponent {...args} />');
    });

    it('works when `setTemplate` was used correctly in the instance tag', async ({ expect }) => {
      const code = `
        <script context="module">
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
      const rawSource = await getStoryChildrenRawSource({
        component,
        svelteASTNodes,
        originalCode: code,
      });

      expect(rawSource).toBe('<SomeComponent {...args} />');
    });

    it('works implicit `children` attribute takes precedence over `setTemplate`', async ({
      expect,
    }) => {
      const code = `
        <script context="module">
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

        <Story name="Default" children={templateForChildren} />
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = await getStoryChildrenRawSource({
        component,
        svelteASTNodes,
        originalCode: code,
      });

      expect(rawSource).toBe(`<SomeComponent wins="childrenAttribute" {...args} />`);
    });

    it('works when no `setTemplate`, no `children` attribute, just a story', async ({ expect }) => {
      const code = `
        <script context="module">
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
      const rawSource = await getStoryChildrenRawSource({
        component,
        svelteASTNodes,
        originalCode: code,
      });

      expect(rawSource).toBe(`<SampleComponent {...args} />`);
    });
  });

  describe('When a `<Story />` is NOT a self-closing tag...', () => {
    it('works when a static children content provided', async ({ expect }) => {
      const code = `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <Story name="Default">
          <SomeComponent foo="bar" />
        </Story>
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = await getStoryChildrenRawSource({
        component,
        svelteASTNodes,
        originalCode: code,
      });

      expect(rawSource).toBe(`<SomeComponent foo="bar" />`);
    });

    it("works when a `children` svelte's snippet block used inside", async ({ expect }) => {
      const code = `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf";

          import SampleComponent from "./SampleComponent.svelte";

          const { Story } = defineMeta({
            component: SampleComponent,
          });
        </script>

        <Story name="Default">
          {#snippet children(args)}
            <SomeComponent {...args} />
          {/snippet}
        </Story>
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = await getStoryChildrenRawSource({
        component,
        svelteASTNodes,
        originalCode: code,
      });

      expect(rawSource).toBe(`<SomeComponent {...args} />`);
    });

    it("inner `<Story>`'s children content takes precedence over `setTemplate`", async ({
      expect,
    }) => {
      const code = `
        <script context="module">
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
          {#snippet children(args)}
            <SomeComponent wins="children" {...args} />
          {/snippet}
        </Story>
      `;
      const ast = getSvelteAST({ code });
      const svelteASTNodes = await extractSvelteASTNodes({ ast });
      const { storyComponents } = svelteASTNodes;
      const component = storyComponents[0].component;
      const rawSource = await getStoryChildrenRawSource({
        component,
        svelteASTNodes,
        originalCode: code,
      });

      expect(rawSource).toBe(`<SomeComponent wins="children" {...args} />`);
    });
  });
});
