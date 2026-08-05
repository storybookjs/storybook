import type {
  IndexEntry,
  Options,
  StoryDocsPayload,
  StoryDocsProvider,
} from 'storybook/internal/types';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { experimental_storyDocsProvider } from './story-docs-preset.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

/** Minimal `Options` stand-in: no dev server, no Vite, no builder context beyond the root. */
const options = (frameworkOptions: Record<string, unknown> = {}): Options =>
  ({
    presets: {
      apply: async (key: string, fallback?: unknown): Promise<unknown> =>
        key === 'framework'
          ? { name: '@storybook/angular-vite', options: frameworkOptions }
          : fallback,
    },
    angularBuilderContext: { workspaceRoot: FIXTURES },
  }) as unknown as Options;

const storyEntry: IndexEntry = {
  id: 'storydocs--basic',
  name: 'Basic',
  title: 'StoryDocs',
  type: 'story',
  subtype: 'story',
  importPath: './story-docs.stories.ts',
};

const noDownstream: StoryDocsProvider = async () => undefined;

describe('experimental_storyDocsProvider', () => {
  // NFR3: cold-callable as a plain Node function. Everything it needs comes from the preset
  // options and the filesystem, and the assertion is the real snippet rather than "it returned".
  it('generates snippets from a bare preset call, with no dev server running', async () => {
    const provider = await experimental_storyDocsProvider(noDownstream, options());

    const payload = await provider({ entry: storyEntry });

    expect(Object.values(payload!.stories).map((story) => story.snippet)).toContain(
      `<sb-button [label]="'Save'" [count]="3" (clicked)="clicked($event)"></sb-button>`
    );
  });

  it('falls through to the next provider for an entry that is not a story file', async () => {
    const downstream: StoryDocsPayload = {
      id: 'other',
      name: 'Other',
      path: './other.ts',
      stories: {},
    };
    const provider = await experimental_storyDocsProvider(async () => downstream, options());

    expect(await provider({ entry: { ...storyEntry, importPath: './readme.mdx' } })).toBe(
      downstream
    );
  });

  it('keeps downstream keys our payload does not set', async () => {
    const provider = await experimental_storyDocsProvider(
      async () => ({
        id: 'downstream',
        name: 'Downstream',
        path: './x',
        stories: {},
        import: 'IMPORT',
      }),
      options()
    );

    const payload = await provider({ entry: storyEntry });

    expect(payload).toMatchObject({ id: 'storydocs', name: 'ButtonComponent', import: 'IMPORT' });
  });

  it('does not register at all when the user opted out of Compodoc', async () => {
    const provider = await experimental_storyDocsProvider(
      noDownstream,
      options({ compodoc: false })
    );

    expect(provider).toBe(noDownstream);
  });
});
