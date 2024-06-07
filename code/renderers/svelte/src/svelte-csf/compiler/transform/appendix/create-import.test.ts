import type { Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import { describe, it } from 'vitest';

import { creatRuntimeStoriesImport } from './create-import.js';

describe(creatRuntimeStoriesImport.name, () => {
  it('creates import correctly', ({ expect }) => {
    const stringified = toJs(creatRuntimeStoriesImport() as unknown as Program).value;

    expect(stringified).toMatchInlineSnapshot(
      `"import {createRuntimeStories} from \"@storybook/addon-svelte-csf/internal/create-runtime-stories\";"`
    );
  });
});
