import { print } from 'esrap';
import ts from 'esrap/languages/ts';
import { describe, expect, it } from 'vitest';

import { createASTArrayExpression, createASTIdentifier } from '../../../parser/ast.ts';

import { createRuntimeStoryVariableDeclaration } from './create-runtime-story-variable-declaration.ts';
import { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.ts';

describe(createRuntimeStoryVariableDeclaration.name, () => {
  it('declares a story from the runtime stories with the svelte-csf-v5 tag', () => {
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
      }),
      ts()
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `"const $__Default = { ...$__stories['Default'], tags: ['svelte-csf-v5'] };"`
    );
  });

  it('allows passing Story-level tags', () => {
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
      }),
      ts()
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `
      "const $__Default = {
      	...$__stories['Default'],
      	tags: ['autodocs', '!test', 'svelte-csf-v5']
      };"
    `
    );
  });
});
