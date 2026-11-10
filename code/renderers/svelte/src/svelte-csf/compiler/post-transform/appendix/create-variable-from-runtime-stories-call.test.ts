import { print } from 'esrap';
import ts from 'esrap/languages/ts';
import { describe, expect, it } from 'vitest';

import { createVariableFromRuntimeStoriesCall } from './create-variable-from-runtime-stories-call.ts';

describe(createVariableFromRuntimeStoriesCall.name, () => {
  it('creates a variable correctly', () => {
    const stringified = print(
      createVariableFromRuntimeStoriesCall({
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
      ts()
    ).code;

    expect(stringified).toMatchInlineSnapshot(
      `"const $__stories = createRuntimeStories(Example_stories, $__meta);"`
    );
  });
});
