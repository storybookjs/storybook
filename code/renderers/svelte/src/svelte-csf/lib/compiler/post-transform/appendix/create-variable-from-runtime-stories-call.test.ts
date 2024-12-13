import { print } from 'esrap';
import { describe, it } from 'vitest';

import { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call';

describe(createVariableFromRuntimeStoriesCall.name, () => {
  it('creates a variable correctly', ({ expect }) => {
    const stringified = print(
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
      })
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `"const __stories = createRuntimeStories(Example_stories, meta);"`
    );
  });
});
