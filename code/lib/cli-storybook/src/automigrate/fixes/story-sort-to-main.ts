import { HandledError } from 'storybook/internal/common';
import { type ConfigFile, type CsfValue, loadConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

interface StorySortToMainOptions {
  storySort: CsfValue | undefined;
  // Why the preview cannot give up `storySort` safely; the main config then stays untouched too.
  previewProblem?: string;
}

const storySortPath = ['parameters', 'options', 'storySort'];

const fail = (reason: string): never => {
  throw new HandledError(
    `Cannot automigrate storySort: ${reason}. Storybook no longer reads parameters.options.storySort from the preview. Move it to storySorts in the main config manually and remove the preview property.`
  );
};

const firstProblem = (config: ConfigFile) => config.mutationDiagnostics[0]?.message;

export const storySortToMain: Fix<StorySortToMainOptions> = {
  id: 'story-sort-to-main',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysort-in-the-preview-replaced-by-storysorts-in-main',

  async check({ files, previewConfigPath }) {
    if (!previewConfigPath) {
      return null;
    }
    const source = await files.read(previewConfigPath);
    if (!source.includes('storySort')) {
      return null;
    }
    const preview = loadConfig(source, previewConfigPath).parse();
    const storySort = preview.getValue(storySortPath);
    // The main config is visited first, so its hook learns here whether the preview edit will fail.
    preview.remove(storySortPath);
    return { storySort, previewProblem: firstProblem(preview) };
  },

  prompt: () =>
    `Move ${picocolors.cyan('parameters.options.storySort')} from preview to ${picocolors.cyan('storySorts')} in main?`,

  transform: ({ result: { storySort, previewProblem } }) => [
    {
      filter: { kind: ['main'] },
      editConfig: (main) => {
        if (previewProblem) {
          fail(previewProblem);
        }
        if (main.get(['storySorts'])) {
          fail('The main config already defines storySorts');
        }
        if (storySort === null || typeof storySort !== 'object') {
          fail('storySort must be a statically readable object or array');
        }
        main.set(['storySorts'], [storySort]);
        const mainProblem = firstProblem(main);
        if (mainProblem) {
          fail(mainProblem);
        }
      },
    },
    {
      filter: { kind: ['preview'], code: 'storySort' },
      editConfig: (preview) => preview.remove(storySortPath),
    },
  ],
};
