import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformComponentMetaToDefineMeta } from './component-meta-to-define-meta';

import type { SvelteAST } from '$lib/parser/ast';
import { parseAndExtractSvelteNode } from '$lib/tests/extractor';

describe(transformComponentMetaToDefineMeta.name, () => {
  it('works with a simple example', async ({ expect }) => {
    const code = `
      <script context="module">
        import { Meta } from "@storybook/addon-svelte-csf";
      </script>

      <Meta title="Atoms/Button" component={Button} />
    `;
    const node = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(
      print(
        transformComponentMetaToDefineMeta({
          component: node,
        })
      )
    ).toMatchInlineSnapshot(
      `"const { Story } = defineMeta({ title: "Atoms/Button", component: Button });"`
    );
  });

  it('leading comments are included', async ({ expect }) => {
    const code = `
      <script context="module">
        import { Meta } from "@storybook/addon-svelte-csf";
      </script>

			<!-- This is a description for the **Button** component stories. -->
      <Meta title="Atoms/Button" component={Button} />
    `;
    const [comment, component] = await Promise.all([
      parseAndExtractSvelteNode<SvelteAST.Comment>(code, 'Comment'),
      parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component'),
    ]);

    expect(
      print(
        transformComponentMetaToDefineMeta({
          component,
          comment,
        })
      )
    ).toMatchInlineSnapshot(`
      "/** This is a description for the **Button** component stories. */ const { Story } = defineMeta({ title: "Atoms/Button", component: Button });"
    `);
  });

  it('supports <Meta> parameters with functions', async ({ expect }) => {
    const code = `
      <script context="module">
        import { Meta } from "@storybook/addon-svelte-csf";
        import WithParameters from './WithParameters.svelte';
      </script>

      <Meta component={WithParameters} parameters={{
          docs: {
            source: {
              transform: (code) => {
                return code + 'transformed';
              }
            }
          }
        }} />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(print(transformComponentMetaToDefineMeta({ component }))).toMatchInlineSnapshot(`
      "const { Story } = defineMeta({
      	component: WithParameters,
      	parameters: {
      		docs: {
      			source: {
      				transform: (code) => {
      					return code + 'transformed';
      				}
      			}
      		}
      	}
      });"
    `);
  });

  it('supports <Meta> with parameters being referenced to variable in the instance tag', async ({
    expect,
  }) => {
    const code = `
      <script>
        const parameters = { foo: 'bar' };
      </script>

      <Meta component={WithParameters} parameters={{ ...parameters, baz: 'yes'}} />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(print(transformComponentMetaToDefineMeta({ component }))).toMatchInlineSnapshot(`
      "const { Story } = defineMeta({
      	component: WithParameters,
      	parameters: { ...parameters, baz: 'yes' }
      });"
    `);
  });

  it("transforms singular expresion tag with literal string on 'tags' attribute to array expression", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Meta tags={"autodocs"} />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(print(transformComponentMetaToDefineMeta({ component }))).toMatchInlineSnapshot(
      `"const { Story } = defineMeta({ tags: ["autodocs"] });"`
    );
  });

  it("transforms singular text value on 'tags' attribute to array expression", async ({
    expect,
  }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Meta tags="singular" />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(print(transformComponentMetaToDefineMeta({ component }))).toMatchInlineSnapshot(
      `"const { Story } = defineMeta({ tags: ["singular"] });"`
    );
  });

  it('tags with an array expression are left as-is', async ({ expect }) => {
    const code = `
      <script context="module">
        import { Story } from "@storybook/addon-svelte-csf";
      </script>

      <Meta tags={["autodocs", "!dev"]} />
    `;
    const component = await parseAndExtractSvelteNode<SvelteAST.Component>(code, 'Component');

    expect(print(transformComponentMetaToDefineMeta({ component }))).toMatchInlineSnapshot(
      `"const { Story } = defineMeta({ tags: ["autodocs", "!dev"] });"`
    );
  });
});
