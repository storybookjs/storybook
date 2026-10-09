import { print } from 'esrap';
import { describe, it } from 'vitest';

import { createRuntimeStoriesImport } from './create-import.ts';

describe(createRuntimeStoriesImport.name, () => {
  it('creates import correctly', ({ expect }) => {
    const stringified = print(createRuntimeStoriesImport()).code;

    expect(stringified).toMatchInlineSnapshot(
      `"import { createRuntimeStories } from "@storybook/svelte/internal/svelte-csf/create-runtime-stories";"`
    );
  });
});
