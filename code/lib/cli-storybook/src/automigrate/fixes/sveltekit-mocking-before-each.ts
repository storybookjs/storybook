import { SourceEditor } from 'storybook/internal/csf-tools';

import { dirname, resolve } from 'pathe';
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
import { migrateSvelteStories } from '../helpers/sveltekit-mocks/svelte-stories.ts';
import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;
const STORY_EXTENSION = /\.(svelte|[cm]?[jt]sx?)$/;
const RELATIVE_IMPORT = /\bimport\s+(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

// The stories files, without extension, that an MDX file imports: its docs page can render them
const findMdxDocsPages = async (
  storiesPaths: string[],
  read: (path: string) => Promise<string>
) => {
  const pages = new Set<string>();
  for (const path of storiesPaths.filter((file) => file.endsWith('.mdx'))) {
    const code = await read(path).catch(() => '');
    for (const [, source] of code.matchAll(RELATIVE_IMPORT)) {
      pages.add(resolve(dirname(path), source).replace(STORY_EXTENSION, ''));
    }
  }
  return [...pages];
};

export interface SvelteKitMockingBeforeEachResult {
  preview: PreviewMocks;
  mdxDocsPages: string[];
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

  async check({ mainConfig, storybookVersion, previewConfigPath, storiesPaths, files }) {
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
    const mdxDocsPages = await findMdxDocsPages(storiesPaths, (path) => files.read(path));
    return { preview, mdxDocsPages };
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
        const docs = {
          ...result.preview,
          mdxDocsPage: result.mdxDocsPages.includes(resolve(id).replace(STORY_EXTENSION, '')),
        };
        if (id.endsWith('.svelte')) {
          return migrateSvelteStories(code, id, docs);
        }
        return SCRIPT_FILE.test(id) ? migrateCsfStories(code, id, docs) : null;
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
