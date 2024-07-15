import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type { Component } from 'svelte/compiler';
import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformLegacyStory } from './legacy-story';

import { parseAndExtractSvelteNode } from '#tests/extractor';

describe(transformLegacyStory.name, () => {
  it("it moves 'autodocs' prop to 'tags' correctly", async ({ expect }) => {
    const code = `
      <script context="module">
        import { Story } from "${pkg.name}";
      </script>

      <Story name="Default" autodocs />
    `;
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformLegacyStory({ node }))).toMatchInlineSnapshot(
      `"<Story name="Default" tags={["autodocs"]} />"`
    );
  });

  it("moving 'autodocs' prop doesn't break with existing 'tags' prop", async ({ expect }) => {
    const code = `
      <script context="module">
        import { Story } from "${pkg.name}";
      </script>

      <Story name="Default" autodocs tags={["!dev"]} />
    `;
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformLegacyStory({ node }))).toMatchInlineSnapshot(
      `"<Story name="Default" tags={["!dev", "autodocs"]} />"`
    );
  });

  it("'source' prop when is a shorthand gets removed", async ({ expect }) => {
    const code = `
      <script context="module">
        import { Story } from "${pkg.name}";
      </script>

      <Story name="Default" source />
    `;
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformLegacyStory({ node }))).toMatchInlineSnapshot(
      `"<Story name="Default" />"`
    );
  });

  it("'source' prop when is a text expression gets moved to 'parameters' prop", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "${pkg.name}";
      </script>

      <Story name="Default" source="'<Button primary />'" />
    `;
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformLegacyStory({ node }))).toMatchInlineSnapshot(
      `
			"<Story name="Default" parameters={{
				docs: { source: { code: "'<Button primary />'" } }
			}} />"
		`
    );
  });

  it("'source' prop when is a text expression gets moved to existing 'parameters'", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "${pkg.name}";
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
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformLegacyStory({ node }))).toMatchInlineSnapshot(
      `
			"<Story name="Default" parameters={{
				controls: { disable: true },
				interactions: { disable: true },
				docs: { source: { code: "'<Button primary />'" } }
			}} />"
		`
    );
  });

  it("'source' prop when is a text expression doesn't override existing 'parameters.docs.source.code'", async ({
    expect,
  }) => {
    // TODO: Check if warning was emitted?
    const code = `
      <script context="module">
        import { Story } from "${pkg.name}";
      </script>

      <Story
        name="Default"
        source="'<Button primary />'"
        parameters={{
          controls: { disable: true },
          interactions: { disable: true },
          docs: {
            source: { code: '<Button variant="outlined" />' }
          }
        }}
      />
    `;
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformLegacyStory({ node }))).toMatchInlineSnapshot(
      `
			"<Story name="Default" parameters={{
				controls: { disable: true },
				interactions: { disable: true },
				docs: {
					source: { code: '<Button variant="outlined" />' }
				}
			}} />"
		`
    );
  });

  it("transforms 'template' prop to 'children' and text expression becomes expression tag with identifier to snippet", async ({
    expect,
  }) => {
    // TODO: Check if warning was emitted?
    const code = `
      <script context="module">
        import { Story } from "${pkg.name}";
      </script>

      <Story name="Default" template="someTemplate" />
    `;
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformLegacyStory({ node }))).toMatchInlineSnapshot(
      `"<Story name="Default" children={SomeTemplate} />"`
    );
  });

  it("when directive 'let:args' is used then it wraps Story fragment with 'children' snippet block", async ({
    expect,
  }) => {
    // TODO: Check if warning was emitted?
    const code = `
      <script context="module">
        import { Story } from "${pkg.name}";
      </script>

      <Story name="Default" let:args>
        <Button {...args} />
      </Story>
    `;
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformLegacyStory({ node }))).toMatchInlineSnapshot(`
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
    // TODO: Check if warning was emitted?
    const code = `
      <script context="module">
        import { Story } from "${pkg.name}";
      </script>

      <Story name="Default" let:context>
        <p>{context.id}</p>
      </Story>
    `;
    const node = await parseAndExtractSvelteNode<Component>(code, 'Component');

    expect(print(transformLegacyStory({ node }))).toMatchInlineSnapshot(`
			"<Story name="Default">
				{#snippet children(_args, context)}
					<p>{context.id}</p>
				{/snippet}
			</Story>"
		`);
  });
});
