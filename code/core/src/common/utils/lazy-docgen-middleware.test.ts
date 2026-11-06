import { describe, expect, it } from 'vitest';

import type { DocgenPayload } from '../../shared/open-service/services/docgen/types.ts';
import { createLazyDocgenMiddleware } from './lazy-docgen-middleware.ts';

const DOWNSTREAM: DocgenPayload = {
  id: 'button',
  name: 'Downstream',
  path: './Button.stories.ts',
  description: 'From downstream',
  jsDocTags: {},
};

const OURS: DocgenPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.ts',
  jsDocTags: {},
  renderer: 'svelte',
};

const MERGED: DocgenPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.ts',
  description: 'From downstream',
  jsDocTags: {},
  renderer: 'svelte',
};

describe('createLazyDocgenMiddleware', () => {
  it.each([
    { importPath: './Button.stories.ts', storyFileTest: undefined, expected: MERGED },
    { importPath: './Button.stories.svelte', storyFileTest: undefined, expected: DOWNSTREAM },
    { importPath: './Button.stories.svelte', storyFileTest: /\.svelte$/, expected: MERGED },
    { importPath: './Button.stories.ts', storyFileTest: /\.svelte$/, expected: DOWNSTREAM },
  ])(
    '$importPath with storyFileTest $storyFileTest',
    async ({ importPath, storyFileTest, expected }) => {
      const provider = createLazyDocgenMiddleware({
        storyFileTest,
        createManager: async () => ({}),
        extract: async () => OURS,
      })(async () => DOWNSTREAM);

      await expect(
        provider({
          entry: {
            id: 'button--primary',
            name: 'Primary',
            title: 'Button',
            type: 'story',
            subtype: 'story',
            importPath,
          },
        })
      ).resolves.toEqual(expected);
    }
  );
});
