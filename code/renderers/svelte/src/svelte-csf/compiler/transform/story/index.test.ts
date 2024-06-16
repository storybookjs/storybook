import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import type { Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import MagicString from 'magic-string';
import { parseAst } from 'rollup/parseAst';
import { describe, it } from 'vitest';

import { transformStory } from '.';

import { getSvelteAST } from '#parser/ast';
import { extractSvelteASTNodes } from '#parser/extract/svelte/nodes';
import { extractCompiledASTNodes } from '#parser/extract/compiled/nodes';
import { extractStoriesNodesFromExportDefaultFn } from '#parser/extract/compiled/stories';

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

    expect(toJs(compiledPostTransformedStories[0] as unknown as Program).value)
      .toMatchInlineSnapshot(`
        "$.validate_component(Story)(node_1, {
          name: 'Default',
          parameters: {
            docs: {
              description: {
                story: "Description for the default story"
              }
            },
            __svelteCsf: {
              rawCode: "<Example {...args} onclick={handleClick}>\\n  <p>{args?.id}</p>\\n  <p>{context.name}</p>\\n  You clicked: {count}<br />\\n</Example>"
            }
          }
        });"
      `);

    expect(toJs(compiledPostTransformedStories[1] as unknown as Program).value)
      .toMatchInlineSnapshot(`
        "$.validate_component(Story)(node_2, {
          name: 'Rounded',
          args: {
            rounded: true
          },
          parameters: {
            docs: {
              description: {
                story: "Description for the rounded story"
              }
            },
            __svelteCsf: {
              rawCode: "<Example {...args} onclick={handleClick}>\\n  <p>{args?.id}</p>\\n  <p>{context.name}</p>\\n  You clicked: {count}<br />\\n</Example>"
            }
          }
        });"
      `);
    expect(toJs(compiledPostTransformedStories[2] as unknown as Program).value)
      .toMatchInlineSnapshot(`
        "$.validate_component(Story)(node_3, {
          name: 'Square',
          args: {
            rounded: false
          },
          parameters: {
            docs: {
              description: {
                story: "Description for the squared story"
              }
            },
            __svelteCsf: {
              rawCode: "<Example {...args} onclick={handleClick}>\\n  <p>{args?.id}</p>\\n  <p>{context.name}</p>\\n  You clicked: {count}<br />\\n</Example>"
            }
          }
        });"
      `);
    expect(toJs(compiledPostTransformedStories[3] as unknown as Program).value)
      .toMatchInlineSnapshot(`
        "$.validate_component(Story)(node_4, {
          name: 'Without template',
          children: $.wrap_snippet(($$anchor, $$slotProps) => {
            var fragment_3 = $.comment();
            var node_5 = $.first_child(fragment_3);
            $.validate_component(Example)(node_5, {
              children: $.wrap_snippet(($$anchor, $$slotProps) => {
                var fragment_4 = Example_default_1();
                $.append($$anchor, fragment_4);
              }),
              $$slots: {
                default: true
              }
            });
            $.append($$anchor, fragment_3);
          }),
          $$slots: {
            default: true
          },
          parameters: {
            __svelteCsf: {
              rawCode: "<Example>Label</Example>"
            }
          }
        });"
      `);
  });
});
