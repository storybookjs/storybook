import { readFile, writeFile } from 'node:fs/promises';

import { HandledError } from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

interface StorySortToMainOptions {
  mainConfigPath: string;
  mainSource: string;
  previewConfigPath: string;
  previewSource: string;
}

const storySortPath = ['parameters', 'options', 'storySort'];

export const storySortToMain: Fix<StorySortToMainOptions> = {
  id: 'story-sort-to-main',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysort-moved-to-main',

  async check({ mainConfigPath, previewConfigPath }) {
    if (!mainConfigPath || !previewConfigPath) {
      return null;
    }

    const [mainSource, previewSource] = await Promise.all([
      readFile(mainConfigPath, 'utf8'),
      readFile(previewConfigPath, 'utf8'),
    ]);
    const main = loadConfig(mainSource, mainConfigPath).parse();
    const preview = loadConfig(previewSource, previewConfigPath).parse();
    const storySort = preview.getValue(storySortPath);
    if (storySort === undefined && preview.mutationDiagnostics.length === 0) {
      return null;
    }

    const fail = (reason: string): never => {
      throw new HandledError(
        `Cannot automigrate storySort: ${reason}. Move parameters.options.storySort from ${previewConfigPath} to top-level storySort in ${mainConfigPath} manually, reconcile any existing value, and remove the preview property.`
      );
    };
    if (main.get(['storySort'])) {
      fail('Both main and preview define storySort');
    }
    if (storySort === null || typeof storySort !== 'object') {
      fail('storySort must be a statically readable object or array');
    }

    main.set(['storySort'], storySort);
    preview.remove(storySortPath);
    const [diagnostic] = [...preview.mutationDiagnostics, ...main.mutationDiagnostics];
    if (diagnostic) {
      fail(diagnostic.message);
    }

    return {
      mainConfigPath,
      mainSource: formatConfig(main),
      previewConfigPath,
      previewSource: formatConfig(preview),
    };
  },

  prompt: () =>
    `Move ${picocolors.cyan('parameters.options.storySort')} from preview to ${picocolors.cyan('storySort')} in main?`,

  async run({ dryRun, result }) {
    if (!dryRun) {
      await writeFile(result.mainConfigPath, result.mainSource);
      await writeFile(result.previewConfigPath, result.previewSource);
    }
  },
};
