import type { Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import { describe, it } from 'vitest';

import { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.js';

describe(createVariableFromRuntimeStoriesCall.name, () => {
  it('creates a variable correctly', ({ expect }) => {
    const stringified = toJs(
      createVariableFromRuntimeStoriesCall({
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
      }) as unknown as Program
    ).value;

    expect(stringified).toMatchInlineSnapshot(
      `"const __stories = createRuntimeStories(Example_stories, meta);"`
    );
  });
});
