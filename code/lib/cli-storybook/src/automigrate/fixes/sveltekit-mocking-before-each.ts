import { SourceEditor } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import {
  MIGRATION_LINK,
  type PreviewMocks,
  failWith,
  findUnmigrated,
  migrateCsfStories,
  migratePreview,
  noPreviewMocks,
  readPreviewMocks,
} from '../helpers/sveltekit-mocks/csf-files.ts';
import { KEY } from '../helpers/sveltekit-mocks/mock-statements.ts';
import { migrateSvelteStories } from '../helpers/sveltekit-mocks/svelte-csf-files.ts';
import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

export interface SvelteKitMockingBeforeEachResult {
  preview: PreviewMocks;
}

export const sveltekitMockingBeforeEach: Fix<SvelteKitMockingBeforeEachResult> = {
  id: 'sveltekit-mocking-before-each',
  link: MIGRATION_LINK,

  prompt(result) {
    const message = `Rewrite ${picocolors.cyan(`parameters.${KEY}`)} into ${picocolors.cyan('beforeEach')} code that sets up the SvelteKit mocks`;
    return result?.preview.setsMocks
      ? `${message}. Your preview sets the mocks for every story, so docs pages with several stories will fail; see ${picocolors.cyan('https://storybook.js.org/docs/get-started/frameworks/sveltekit#docs-pages')}`
      : message;
  },

  async check({ mainConfig, storybookVersion, previewConfigPath, files }) {
    if (
      !isAtOrPastVersion(storybookVersion, '11.0.0') ||
      getFrameworkPackageName(mainConfig) !== '@storybook/sveltekit'
    ) {
      return null;
    }
    const preview = previewConfigPath
      ? readPreviewMocks(
          await files.read(previewConfigPath).catch(() => undefined),
          previewConfigPath
        )
      : noPreviewMocks();
    return { preview };
  },

  // Text handlers keep a file as written outside the edits: the runner formats a file that an
  // `editCsf` changed with the project's Prettier, which can restyle all of it
  transform: ({ result }) => [
    {
      filter: { kind: ['preview'], code: KEY },
      handler: (code, { id }) => migratePreview(code, id),
    },
    {
      filter: { kind: ['story'], code: KEY },
      handler: (code, { id }) => {
        if (id.endsWith('.svelte')) {
          return migrateSvelteStories(code, id, result.preview);
        }
        return SCRIPT_FILE.test(id) ? migrateCsfStories(code, id, result.preview) : null;
      },
    },
    {
      // A helper in the config directory that builds the parameters for stories to import
      filter: { kind: ['config'], code: KEY },
      handler: (code, { id }) => {
        const problems = findUnmigrated(new SourceEditor(code, id).program, new Set());
        return problems.length > 0 ? failWith(code, problems) : null;
      },
    },
  ],
};
