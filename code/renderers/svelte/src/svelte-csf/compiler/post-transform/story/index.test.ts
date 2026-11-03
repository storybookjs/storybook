import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { print } from 'esrap';
import MagicString from 'magic-string';
import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { dedent } from 'ts-dedent';
import { describe, expect, it } from 'vitest';

import { transformStory } from './index.ts';
import { transformStoriesCode } from '../index.ts';

import { SVELTE_CSF_RENDERER_IMPORT_SOURCE } from '../../../constants.ts';
import { getSvelteAST } from '../../../parser/ast.ts';
import { extractSvelteASTNodes } from '../../../parser/extract/svelte/nodes.ts';
import { extractCompiledASTNodes } from '../../../parser/extract/compiled/nodes.ts';
import { extractStoriesNodesFromExportDefaultFn } from '../../../parser/extract/compiled/stories.ts';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe(transformStory.name, () => {
  it("each transformed compiled 'Story' component matches inlined snapshots", async ({
    expect,
  }) => {
    const filename = path.resolve(__dirname, '../../../__tests__/stories/Example.stories.svelte');
    const originalCode = fs.readFileSync(filename).toString();
    const compiledCode = fs
      .readFileSync(
        path.resolve(__dirname, '../../../__tests__/__compiled__/Example.stories.dev.js')
      )
      .toString();
    const svelteAST = getSvelteAST({ code: originalCode, filename });
    const svelteASTNodes = await extractSvelteASTNodes({
      ast: svelteAST,
      filename,
    });
    const compiledASTNodes = await extractCompiledASTNodes({
      ast: parseAst(compiledCode),
      filename,
    });
    const code = new MagicString(compiledCode);
    const extractedCompiledStoriesNodes = await extractStoriesNodesFromExportDefaultFn({
      nodes: compiledASTNodes,
      filename,
    });
    const svelteStories = [...svelteASTNodes.storyComponents].reverse();
    const compiledStories = [...extractedCompiledStoriesNodes].reverse();

    svelteStories.forEach((svelte, index) => {
      transformStory({
        code,
        nodes: {
          svelte: svelteASTNodes,
          component: {
            svelte,
            compiled: compiledStories[index],
          },
        },
        filename,
        originalCode,
      });
    });

    const compiledPostTransformedStories = await extractStoriesNodesFromExportDefaultFn({
      nodes: await extractCompiledASTNodes({
        ast: parseAst(code.toString()),
      }),
      filename,
    });

    expect(print(compiledPostTransformedStories[0]).code).toMatchInlineSnapshot(`
      "Story(node_1, {
      	name: 'Default',
      	template,
      	parameters: {
      		docs: {
      			description: { story: "Description for the default story" }
      		},
      		__svelteCsf: {
      			rawCode: "<Example {...args} onclick={handleClick}>\\n  <p>{context.name}</p>\\n  You clicked: {count}<br />\\n</Example>"
      		}
      	}
      })"
    `);

    expect(print(compiledPostTransformedStories[1]).code).toMatchInlineSnapshot(`
      "Story(node_2, {
      	name: 'Rounded',
      	args: { rounded: true },
      	template,
      	parameters: {
      		docs: {
      			description: { story: "Description for the rounded story" }
      		},
      		__svelteCsf: {
      			rawCode: "<Example {...args} onclick={handleClick}>\\n  <p>{context.name}</p>\\n  You clicked: {count}<br />\\n</Example>"
      		}
      	}
      })"
    `);
    expect(print(compiledPostTransformedStories[2]).code).toMatchInlineSnapshot(`
      "Story(node_3, {
      	name: 'Square',
      	args: { rounded: false },
      	template,
      	parameters: {
      		docs: {
      			description: { story: "Description for the squared story" }
      		},
      		__svelteCsf: {
      			rawCode: "<Example {...args} onclick={handleClick}>\\n  <p>{context.name}</p>\\n  You clicked: {count}<br />\\n</Example>"
      		}
      	}
      })"
    `);
    expect(print(compiledPostTransformedStories[3]).code).toMatchInlineSnapshot(`
      "Story(node_4, {
      	name: 'As child',
      	asChild: true,
      	children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
      		var fragment_3 = $.comment();
      		var node_5 = $.first_child(fragment_3);

      		Example(node_5, {
      			children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
      				$.next();

      				var text_2 = $.text('Label');

      				$.append($$anchor, text_2);
      			}),
      			$$slots: { default: true }
      		});

      		$.append($$anchor, fragment_3);
      	}),
      	$$slots: { default: true },
      	parameters: {
      		__svelteCsf: { rawCode: "<Example>Label</Example>" }
      	}
      })"
    `);
    expect(print(compiledPostTransformedStories[4]).code).toMatchInlineSnapshot(`
      "Story(node_6, {
      	name: 'Children forwared',
      	children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
      		$.next();

      		var text_3 = $.text('Forwarded label');

      		$.append($$anchor, text_3);
      	}),
      	$$slots: { default: true },
      	parameters: {
      		__svelteCsf: {
      			rawCode: "<Example {...args}>\\n  Forwarded label\\n</Example>"
      		}
      	}
      })"
    `);
  });

  async function transformStories(originalCode: string, filename: string) {
    const compiledCode = compile(originalCode, { filename, dev: true }).js.code;
    const code = new MagicString(compiledCode);

    await transformStoriesCode({
      code,
      nodes: {
        svelte: await extractSvelteASTNodes({
          ast: getSvelteAST({ code: originalCode, filename }),
          filename,
        }),
        compiled: await extractCompiledASTNodes({ ast: parseAst(compiledCode), filename }),
      },
      filename,
      originalCode,
    });

    return code.toString();
  }

  it('names the stories file when the defineMeta component value is invalid', async ({
    expect,
  }) => {
    const filename = path.resolve(__dirname, '../../../__tests__/stories/Invalid.stories.svelte');
    const originalCode = dedent`
      <script module>
        import { defineMeta } from "${SVELTE_CSF_RENDERER_IMPORT_SOURCE}";

        const { Story } = defineMeta({
          component: 'Not a component',
        });
      </script>

      <Story name="Default" />
    `;

    await expect(transformStories(originalCode, filename)).rejects.toThrow(
      `The issue occurred in Stories file: ${url.pathToFileURL(filename).href}`
    );
  });

  it.each([
    ['a named import of an object', 'import { Input } from "./input.ts";', 'Input.Select'],
    ['a namespace import', 'import * as ns from "./components.ts";', 'ns.Button'],
  ])('accepts a member-expression component on %s', async (_, importStatement, componentValue) => {
    const filename = 'MemberExpression.stories.svelte';
    const originalCode = dedent`
      <script module>
        import { defineMeta } from "${SVELTE_CSF_RENDERER_IMPORT_SOURCE}";

        ${importStatement}

        const { Story } = defineMeta({
          component: ${componentValue},
        });
      </script>

      <Story name="Default" />
    `;

    await expect(transformStories(originalCode, filename)).resolves.toContain(
      `rawCode: "<${componentValue} {...args} />"`
    );
  });
});
