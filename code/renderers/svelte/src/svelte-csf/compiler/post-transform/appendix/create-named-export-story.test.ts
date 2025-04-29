import { print } from 'esrap';
import { describe, it } from 'vitest';

import { createNamedExportStory } from './create-named-export-story.js';
import { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.js';

import type { ESTreeAST } from '$lib/parser/ast.js';
import { SVELTE_CSF_V4_TAG } from '../../../constants.js';

describe(createNamedExportStory.name, () => {
  it('correctly creates a variable with named exports order', ({ expect }) => {
    const stringified = print(
      createNamedExportStory({
        exportName: 'Default',
        nodes: {
          variable: createVariableFromRuntimeStoriesCall({
            storiesFunctionDeclaration: {
              type: 'FunctionDeclaration',
              id: {
                type: 'Identifier',
                name: 'Example_stories',
              },
              body: {
                type: 'BlockStatement',
                body: [],
              },
              params: [],
            },
          }),
        },
      }) as unknown as ESTreeAST.Program
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `
      "export const Default = {
      	...__stories["Default"],
      	tags: ["svelte-csf-v5"]
      };"
    `
    );
  });

  it('allows passing Story-level tags', ({ expect }) => {
    const stringified = print(
      createNamedExportStory({
        exportName: 'Default',
        nodes: {
          variable: createVariableFromRuntimeStoriesCall({
            storiesFunctionDeclaration: {
              type: 'FunctionDeclaration',
              id: {
                type: 'Identifier',
                name: 'Example_stories',
              },
              body: {
                type: 'BlockStatement',
                body: [],
              },
              params: [],
            },
          }),
          tags: {
            type: 'ArrayExpression',
            elements: [
              {
                type: 'Literal',
                value: 'autodocs',
              },
              {
                type: 'Literal',
                value: '!test',
              },
            ],
          },
        },
      }) as unknown as ESTreeAST.Program
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `
      "export const Default = {
      	...__stories["Default"],
      	tags: ["autodocs", "!test", "svelte-csf-v5"]
      };"
    `
    );
  });

  it('keeps Svelte CSF v4 tag if present, and does not add Svelte CSF v5 tag', ({ expect }) => {
    const stringified = print(
      createNamedExportStory({
        exportName: 'Default',
        nodes: {
          variable: createVariableFromRuntimeStoriesCall({
            storiesFunctionDeclaration: {
              type: 'FunctionDeclaration',
              id: {
                type: 'Identifier',
                name: 'Example_stories',
              },
              body: {
                type: 'BlockStatement',
                body: [],
              },
              params: [],
            },
          }),
          tags: {
            type: 'ArrayExpression',
            elements: [
              {
                type: 'Literal',
                value: 'autodocs',
              },
              {
                type: 'Literal',
                value: SVELTE_CSF_V4_TAG,
              },
            ],
          },
        },
      }) as unknown as ESTreeAST.Program
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `
      "export const Default = {
      	...__stories["Default"],
      	tags: ["autodocs", "svelte-csf-v4"]
      };"
    `
    );
  });
});
