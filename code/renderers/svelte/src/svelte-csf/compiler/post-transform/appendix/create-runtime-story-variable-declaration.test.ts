import { print } from 'esrap';
import { describe, it } from 'vitest';

import { createASTArrayExpression, createASTIdentifier } from '../../../parser/ast.ts';

import { createRuntimeStoryVariableDeclaration } from './create-runtime-story-variable-declaration.ts';
import { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.ts';

describe(createRuntimeStoryVariableDeclaration, () => {
  it('correctly creates a runtime story variable', ({ expect }) => {
    const stringified = print(
      createRuntimeStoryVariableDeclaration({
        exportName: 'Default',
        nodes: {
          variable: createVariableFromRuntimeStoriesCall({
            storiesFunctionDeclaration: {
              type: 'FunctionDeclaration',
              id: createASTIdentifier('Example_stories'),
              body: {
                type: 'BlockStatement',
                body: [],
              },
              params: [],
            },
          }),
        },
      })
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `
      "const $__Default = {
      	...$__stories["Default"],
      	tags: ["svelte-csf-v5"]
      };"
    `
    );
  });

  it('allows passing Story-level tags', ({ expect }) => {
    const stringified = print(
      createRuntimeStoryVariableDeclaration({
        exportName: 'Default',
        nodes: {
          variable: createVariableFromRuntimeStoriesCall({
            storiesFunctionDeclaration: {
              type: 'FunctionDeclaration',
              id: createASTIdentifier('Example_stories'),
              body: {
                type: 'BlockStatement',
                body: [],
              },
              params: [],
            },
          }),
          tags: createASTArrayExpression([
            {
              type: 'Literal',
              value: 'autodocs',
            },
            {
              type: 'Literal',
              value: '!test',
            },
          ]),
        },
      })
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `
      "const $__Default = {
      	...$__stories["Default"],
      	tags: ["autodocs", "!test", "svelte-csf-v5"]
      };"
    `
    );
  });
});
