import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformLegacyStory } from './legacy-story.js';

import type { SvelteAST } from '$lib/parser/ast.js';
import { parseAndExtractSvelteNode } from '../../../../tests/extractor.js';

describe(transformLegacyStory.name, () => {
  it("it moves 'autodocs' prop to 'tags' correctly", async ({ expect }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="Default" autodocs />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`"<Story name="Default" tags={["autodocs", "legacy"]} />"`);
  });

  it("moving 'autodocs' prop doesn't break with existing 'tags' prop", async ({ expect }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="Default" autodocs tags={["!dev"]} />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`"<Story name="Default" tags={["!dev", "autodocs", "legacy"]} />"`);
  });

  it("'source' prop when is a shorthand gets removed", async ({ expect }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="Default" source />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`"<Story name="Default" tags={["legacy"]} />"`);
  });

  it("'source' prop when is a text expression gets moved to 'parameters' prop", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="Default" source="'<Button primary />'" />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(
      `
      "<Story name="Default" parameters={{
      	docs: { source: { code: "'<Button primary />'" } }
      }} tags={["legacy"]} />"
    `
    );
  });

  it("'source' prop when is a text expression and Story has children, gets moved to 'parameters' prop", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="With source as text" source="<LegacyStory>Hi</LegacyStory>">
        <LegacyStory>{'Hi'}</LegacyStory>
      </Story>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(
      `
      "<Story name="With source as text" parameters={{
      	docs: {
      		source: { code: "<LegacyStory>Hi</LegacyStory>" }
      	}
      }} tags={["legacy"]}>
      	<LegacyStory>{'Hi'}</LegacyStory>
      </Story>"
    `
    );
  });

  it("'source' prop when is a text expression gets moved to existing 'parameters'", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story
        name="Default"
        source="'<Button primary />'"
        parameters={{
          controls: { disable: true },
          interactions: { disable: true },
        }}
      />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(
      `
      "<Story name="Default" parameters={{
      	controls: { disable: true },
      	interactions: { disable: true },
      	docs: { source: { code: "'<Button primary />'" } }
      }} tags={["legacy"]} />"
    `
    );
  });

  it("transforms 'template' id prop to 'template' reference prop and text expression becomes expression tag with identifier to snippet", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="Default" template="someTemplate" />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`"<Story name="Default" template={someTemplate} tags={["legacy"]} />"`);
  });

  it("transforms 'template' id prop to 'template' reference prop and text expression becomes expression tag with identifier to snippet (case with invalid identifier)", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="Default" template="some template with non valid identifier" />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`"<Story name="Default" template={template_r71ke5} tags={["legacy"]} />"`);
  });

  it("when directive 'let:args' is used then it wraps Story fragment with 'template' snippet block", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="Default" let:args>
        <Button {...args} />
      </Story>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`
      "<Story name="Default" tags={["legacy"]}>
      	{#snippet template(args)}
      		<Button {...args} />
      	{/snippet}
      </Story>"
    `);
  });

  it("when directive 'let:context' is used then it wraps Story fragment with 'template' snippet block", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="Default" let:context>
        <p>{context.id}</p>
      </Story>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`
      "<Story name="Default" tags={["legacy"]}>
      	{#snippet template(_args, context)}
      		<p>{context.id}</p>
      	{/snippet}
      </Story>"
    `);
  });

  it("when both directives 'let:args' and 'let:context' is used then it wraps Story fragment with 'template' snippet block", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story name="Default" let:args let:context>
        <h1>{args.title}</h1>
        <p>{context.id}</p>
      </Story>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`
      "<Story name="Default" tags={["legacy"]}>
      	{#snippet template(args, context)}
      		<h1>{args.title}</h1>
      		<p>{context.id}</p>
      	{/snippet}
      </Story>"
    `);
  });

  it('leaves existing Story parameters untouched', async ({ expect }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story
        name="Default"
        parameters={{ 
          sveltekit_experimental: {
            stores: {
              page: {
                data: {
                  test: 'passed',
                },
              },
              navigating: {
                route: {
                  id: '/storybook',
                },
              },
              updated: true,
            },
          },
        }}
      >
        <h1>{"Test"}</h1>
      </Story>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`
      "<Story name="Default" parameters={{
      	sveltekit_experimental: {
      		stores: {
      			page: { data: { test: 'passed' } },
      			navigating: { route: { id: '/storybook' } },
      			updated: true
      		}
      	}
      }} tags={["legacy"]}>
      	<h1>{"Test"}</h1>
      </Story>"
    `);
  });

  it('legacy `source` prop with template literal value is supported _(moved to parameters)_', async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Story
        name="Default"
        source={\`
          <Foo bar />
        \`}
      >
        <h1>{"Test"}</h1>
      </Story>
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformLegacyStory({
          component,
          state: { componentIdentifierName: {} },
        })
      )
    ).toMatchInlineSnapshot(`
      "<Story name="Default" parameters={{
      	docs: { source: { code: "\\n    <Foo bar />\\n  " } }
      }} tags={["legacy"]}>
      	<h1>{"Test"}</h1>
      </Story>"
    `);
  });
});
