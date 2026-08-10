import type { IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import type { AngularComponentMetaSource } from './build-docgen.ts';
import { buildStoryDocsPayload } from './story-docs-build.ts';

vi.mock('node:fs', { spy: true });

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(readFileSync).mockImplementation(memfs.fs.readFileSync as typeof readFileSync);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// The story file sits in the fixtures directory next to the component module it imports, because
// module resolution reads the real filesystem; only the story file's contents come from memfs.
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const STORY_PATH = join(FIXTURES, 'button.stories.ts');

const entry: IndexEntry = {
  id: 'button--default',
  name: 'Default',
  title: 'Example/Button',
  type: 'story',
  subtype: 'story',
  importPath: relative(process.cwd(), STORY_PATH),
};

const givenStoryFile = (source: string) => {
  vol.fromNestedJSON({ [STORY_PATH]: source });
};

describe('buildStoryDocsPayload', () => {
  it('returns undefined for entries without a story file or with an unparsable one', () => {
    const docsEntry: IndexEntry = {
      id: 'docs--page',
      name: 'Page',
      title: 'Docs',
      type: 'docs',
      importPath: './page.mdx',
      storiesImports: [],
      tags: [],
    };
    expect(buildStoryDocsPayload({ entry: docsEntry }, { manager: undefined })).toBeUndefined();

    givenStoryFile('export default { title: "Broken" ');
    expect(buildStoryDocsPayload({ entry }, { manager: undefined })).toBeUndefined();
  });

  it('still emits description-only stories when the analyzer is unavailable', () => {
    givenStoryFile(`
      export default { title: 'Example/Button' };
      /** Documented without a component. */
      export const Default = {};
    `);

    const payload = buildStoryDocsPayload({ entry }, { manager: undefined });

    expect(payload?.name).toBe('Button');
    expect(Object.values(payload!.stories)[0]).toEqual({
      id: 'example-button--default',
      name: 'Default',
      description: 'Documented without a component.',
    });
  });

  it('drops the snippet without erroring when the analyzer throws', () => {
    givenStoryFile(`
      import { ButtonComponent } from './button.component';
      export default { title: 'Example/Button', component: ButtonComponent };
      export const Default = { args: { label: 'Save' } };
    `);
    const manager: AngularComponentMetaSource = {
      extractComponentMeta: () => {
        throw new Error('ts blew up');
      },
    };

    const payload = buildStoryDocsPayload({ entry }, { manager });

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toBeUndefined();
    expect(story.error).toBeUndefined();
  });
});
