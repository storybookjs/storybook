import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformLegacyStory } from './legacy-story';

import type { SvelteAST } from '#parser/ast';
import { parseAndExtractSvelteNode } from '#tests/extractor';

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
    ).toMatchInlineSnapshot(`"<Story name="Default" tags={["autodocs"]} />"`);
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
    ).toMatchInlineSnapshot(`"<Story name="Default" tags={["!dev", "autodocs"]} />"`);
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
    ).toMatchInlineSnapshot(`"<Story name="Default" />"`);
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
			}} />"
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
      }}>
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
			}} />"
		`
    );
  });

  it("transforms 'template' prop to 'children' and text expression becomes expression tag with identifier to snippet", async ({
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
    ).toMatchInlineSnapshot(`"<Story name="Default" children={someTemplate} />"`);
  });

  it("when directive 'let:args' is used then it wraps Story fragment with 'children' snippet block", async ({
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
			"<Story name="Default">
				{#snippet children(args)}
					<Button {...args} />
				{/snippet}
			</Story>"
		`);
  });

  it("when directive 'let:context' is used then it wraps Story fragment with 'children' snippet block", async ({
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
			"<Story name="Default">
				{#snippet children(_args, context)}
					<p>{context.id}</p>
				{/snippet}
			</Story>"
		`);
  });

  it("when both directives 'let:args' and 'let:context' is used then it wraps Story fragment with 'children' snippet block", async ({
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
      "<Story name="Default">
      	{#snippet children(args, context)}
      		<h1>{args.title}</h1>
      		<p>{context.id}</p>
      	{/snippet}
      </Story>"
    `);
  });
});
