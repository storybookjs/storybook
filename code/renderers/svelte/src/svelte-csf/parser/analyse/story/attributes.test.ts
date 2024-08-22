import { describe, it } from 'vitest';

import { getArrayOfStringsValueFromAttribute, getStringValueFromAttribute } from './attributes';

import { getSvelteAST } from '#parser/ast';
import { extractSvelteASTNodes } from '#parser/extract/svelte/nodes';
import { extractStoryAttributesNodes } from '#parser/extract/svelte/story/attributes';
import { StorybookSvelteCSFError } from '#utils/error';

describe(getStringValueFromAttribute.name, () => {
  it("throws error when a `<Story />` 'name' attribute value is not a string", async ({
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

        <Story name />
      `;
    const ast = getSvelteAST({ code });
    const svelteASTNodes = await extractSvelteASTNodes({ ast });
    const { storyComponents } = svelteASTNodes;
    const component = storyComponents[0].component;
    const { name } = extractStoryAttributesNodes({
      attributes: ['name'],
      component,
    });

    expect(() => getStringValueFromAttribute({ component, node: name }))
      .toThrowErrorMatchingInlineSnapshot(`
        [SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0001 (AttributeNotStringError): In the stories file: <path not specified>

        A '<Story name="undefined" />' has a prop 'name' whose value must be a static literal string.

        More info: https://github.com/storybookjs/addon-svelte-csf/blob/v4.1.2/ERRORS.md#SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0001
        ]
      `);
  });
});

describe(getArrayOfStringsValueFromAttribute.name, () => {
  it("throws error when a `<Story />` 'tags' attribute value is not an array expression", async ({
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

        <Story name="Default" tags={0} />
      `;
    const ast = getSvelteAST({ code });
    const svelteASTNodes = await extractSvelteASTNodes({ ast });
    const { storyComponents } = svelteASTNodes;
    const component = storyComponents[0].component;
    const { tags } = extractStoryAttributesNodes({
      attributes: ['tags'],
      component,
    });

    expect(() =>
      getArrayOfStringsValueFromAttribute({ component, node: tags })
    ).toThrowErrorMatchingInlineSnapshot(
      `
      [SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0002 (AttributeNotArrayError): In the stories file: <path not specified>

      A '<Story name="Default" />' has a prop'tags' whose value was expected to be a static array.
      Instead the value type is '0'.

      More info: https://github.com/storybookjs/addon-svelte-csf/blob/v${StorybookSvelteCSFError.packageVersion}/ERRORS.md#SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0002
      ]
    `
    );
  });

  it("throws error when a `<Story />` 'tags' attribute value is not an array of strings only", async ({
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

        <Story name="Default" tags={[null, "autodocs"]} />
      `;
    const ast = getSvelteAST({ code });
    const svelteASTNodes = await extractSvelteASTNodes({ ast });
    const { storyComponents } = svelteASTNodes;
    const component = storyComponents[0].component;
    const { tags } = extractStoryAttributesNodes({
      attributes: ['tags'],
      component,
    });

    expect(() =>
      getArrayOfStringsValueFromAttribute({ component, node: tags })
    ).toThrowErrorMatchingInlineSnapshot(
      `
      [SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0003 (AttributeNotArrayOfStringsError): In the stories file: <path not specified>

      A '<Story name="Default" />' has attribute 'tags' whose value was expected to be an array expression.
      All elements in the array must be static literal strings only, but one of the elements is of type 'undefined'.

      More info: https://github.com/storybookjs/addon-svelte-csf/blob/v${StorybookSvelteCSFError.packageVersion}/ERRORS.md#SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0003
      ]
    `
    );
  });

  it("extracts 'tags' attribute when is a correct type - array of strings", async ({ expect }) => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="Default" tags={["autodocs", "!dev"]} />
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const { tags } = extractStoryAttributesNodes({
      component,
      attributes: ['tags'],
    });
    const tagsValue = getArrayOfStringsValueFromAttribute({
      node: tags,
      component,
    });

    expect(tagsValue).toBeInstanceOf(Array);
    expect(tagsValue).toEqual(['autodocs', '!dev']);
  });

  it("returns empty array when 'tags' attribute is not provided", async ({ expect }) => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="Default" />
      `,
    });
    const nodes = await extractSvelteASTNodes({ ast });
    const { component } = nodes.storyComponents[0];
    const { tags } = extractStoryAttributesNodes({
      component,
      attributes: ['tags'],
    });

    const tagsValue = getArrayOfStringsValueFromAttribute({
      node: tags,
      component,
    });

    expect(tagsValue).toEqual([]);
  });
});
