import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { print } from 'esrap';
import MagicString from 'magic-string';
import { parseAst } from 'rollup/parseAst';
import { describe, it } from 'vitest';

import { transformStory } from './index.js';

import { getSvelteAST } from '$lib/parser/ast.js';
import { extractSvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';
import { extractCompiledASTNodes } from '$lib/parser/extract/compiled/nodes.js';
import { extractStoriesNodesFromExportDefaultFn } from '$lib/parser/extract/compiled/stories.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe(transformStory.name, () => {
  it("each transformed compiled 'Story' component matches inlined snapshots", async ({
    expect,
  }) => {
    const filename = path.resolve(__dirname, '../../../../tests/stories/Example.stories.svelte');
    const originalCode = fs.readFileSync(filename).toString();
    const compiledPreTransformCode = fs
      .readFileSync(
        path.resolve(
          __dirname,
          '../../../../tests/__compiled__/pre-transform/Example.stories.dev.js'
        )
      )
      .toString();
    const svelteAST = getSvelteAST({ code: originalCode, filename });
    const svelteASTNodes = await extractSvelteASTNodes({
      ast: svelteAST,
      filename,
    });
    const compiledASTNodes = await extractCompiledASTNodes({
      ast: parseAst(compiledPreTransformCode),
      filename,
    });
    const code = new MagicString(compiledPreTransformCode);
    const extractedCompiledStoriesNodes = await extractStoriesNodesFromExportDefaultFn({
      nodes: compiledASTNodes,
      filename,
    });
    const svelteStories = [...svelteASTNodes.storyComponents].reverse();
    const compiledPreTransformedStories = [...extractedCompiledStoriesNodes].reverse();

    svelteStories.forEach((svelte, index) => {
      transformStory({
        code,
        nodes: {
          svelte: svelteASTNodes,
          component: {
            svelte,
            compiled: compiledPreTransformedStories[index],
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
      			rawCode: "<Example {...args} onclick={handleClick}>\\n  <p>{args.id}</p>\\n  <p>{context.name}</p>\\n  You clicked: {count}<br />\\n</Example>"
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
      			rawCode: "<Example {...args} onclick={handleClick}>\\n  <p>{args.id}</p>\\n  <p>{context.name}</p>\\n  You clicked: {count}<br />\\n</Example>"
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
      			rawCode: "<Example {...args} onclick={handleClick}>\\n  <p>{args.id}</p>\\n  <p>{context.name}</p>\\n  You clicked: {count}<br />\\n</Example>"
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

      				var text_3 = $.text('Label');

      				$.append($$anchor, text_3);
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

      		var text_4 = $.text('Forwarded label');

      		$.append($$anchor, text_4);
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
});
