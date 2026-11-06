import { print } from 'esrap';
import ts from 'esrap/languages/ts';
import { describe, it } from 'vitest';

import { createRuntimeStoriesImport } from './create-import.ts';

describe(createRuntimeStoriesImport.name, () => {
  it('creates import correctly', ({ expect }) => {
    const stringified = print(createRuntimeStoriesImport(), ts()).code;

    expect(stringified).toMatchInlineSnapshot(
      `"import { createRuntimeStories } from '@storybook/svelte/internal/svelte-csf/create-runtime-stories';"`
    );
  });
});
