import { print } from 'esrap';
import { describe, it } from 'vitest';

import { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.ts';

describe(createVariableFromRuntimeStoriesCall.name, () => {
  it('creates a variable correctly', ({ expect }) => {
    const stringified = print(
      createVariableFromRuntimeStoriesCall({
        storiesFunctionDeclaration: {
          type: 'FunctionDeclaration',
          id: {
            type: 'Identifier',
            name: 'Example_stories',
            start: 0,
            end: 0,
          },
          body: {
            type: 'BlockStatement',
            body: [],
            start: 0,
            end: 0,
          },
          params: [],
          start: 0,
          end: 0,
        },
      })
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `"const $__stories = createRuntimeStories(Example_stories, $__meta);"`
    );
  });
});
