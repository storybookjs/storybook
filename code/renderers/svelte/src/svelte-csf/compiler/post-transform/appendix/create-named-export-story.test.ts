import { print } from 'esrap';
import { describe, it } from 'vitest';

import { createNamedExportStory } from './create-named-export-story.js';
import { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.js';

import type { ESTreeAST } from '$lib/parser/ast.js';

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

    expect(stringified).toMatchInlineSnapshot(`"export const Default = { ...__stories["Default"], tags: [] };"`);
  });
});
