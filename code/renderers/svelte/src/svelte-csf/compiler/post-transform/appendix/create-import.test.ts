import { print } from 'esrap';
import ts from 'esrap/languages/ts';
import { describe, expect, it } from 'vitest';

import { createRuntimeStoriesImport } from './create-import.ts';

describe(createRuntimeStoriesImport.name, () => {
  it('imports createRuntimeStories from the internal entry', () => {
    const stringified = print(createRuntimeStoriesImport(), ts()).code;

    expect(stringified).toMatchInlineSnapshot(
      `"import { createRuntimeStories } from '@storybook/svelte/internal/svelte-csf/create-runtime-stories';"`
    );
  });
});
