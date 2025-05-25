import { testTransform } from 'storybook/internal/csf-tools';

import type { Plugin } from 'vite';

/** This transforms the test function of a story into another story */
export async function storybookTestFn(): Promise<Plugin> {
  const storiesRegex = /\.stories\.(tsx?|jsx?|svelte|vue)$/;

  return {
    name: 'storybook:test-function',
    enforce: 'post',
    async transform(src, id) {
      if (!storiesRegex.test(id)) {
        return undefined;
      }

      const result = await testTransform({
        code: src,
        fileName: id,
      });
      return result;
    },
  };
}
