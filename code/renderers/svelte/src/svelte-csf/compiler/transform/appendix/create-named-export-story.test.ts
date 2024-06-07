import type { Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import { describe, it } from 'vitest';

import { createNamedExportStory } from './create-named-export-story.js';
import { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.js';

describe(createNamedExportStory.name, () => {
  it('correctly creates a variable with named exports order', ({ expect }) => {
    const stringified = toJs(
      createNamedExportStory({
        exportName: 'Default',
        node: createVariableFromRuntimeStoriesCall({
          metaIdentifier: {
            type: 'Identifier',
            name: 'meta',
          },
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
      }) as unknown as Program
    ).value;

    expect(stringified).toMatchInlineSnapshot(`"export const Default = __stories["Default"];"`);
  });
});
