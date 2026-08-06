import type { IndexEntry, StoryDocsPayload } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import type { CompodocJson } from '@storybook/angular-compodoc';
import type { BuildStoryDocsContext } from './build-story-docs.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

/** The same shape production reads out of the resolved output directory. */
const documentationJson = () =>
  JSON.parse(readFileSync(join(FIXTURES, 'documentation.json'), 'utf8')) as CompodocJson;

const entry = (importPath: string, title = 'StoryDocs'): IndexEntry => ({
  id: 'storydocs--basic',
  name: 'Basic',
  title,
  type: 'story',
  subtype: 'story',
  importPath,
});

const build = (
  importPath: string,
  overrides: Partial<BuildStoryDocsContext> = {},
  title?: string
): StoryDocsPayload | undefined =>
  buildStoryDocsPayload(
    { entry: entry(importPath, title) },
    {
      storyRoot: FIXTURES,
      workspaceRoot: FIXTURES,
      outputDir: FIXTURES,
      readDocumentationJson: documentationJson,
      logger: { warn: vi.fn(), debug: vi.fn() },
      ...overrides,
    }
  );

/** Snippet for one story export, keyed the way the payload is: by story id. */
const snippetOf = (payload: StoryDocsPayload | undefined, storyName: string) =>
  Object.values(payload?.stories ?? {}).find((story) => story.name === storyName)?.snippet;

const storyOf = (payload: StoryDocsPayload | undefined, storyName: string) =>
  Object.values(payload?.stories ?? {}).find((story) => story.name === storyName);

describe('buildStoryDocsPayload', () => {
  it('builds a payload for a real Angular story file', () => {
    const payload = build('./story-docs.stories.ts');

    expect(payload).toMatchObject({
      id: 'storydocs',
      name: 'ButtonComponent',
      path: './story-docs.stories.ts',
    });
    expect(snippetOf(payload, 'Basic')).toBe(
      `<sb-button [label]="'Save'" [count]="3" (clicked)="clicked($event)"></sb-button>`
    );
  });

  it('merges meta args under story args', () => {
    // `label` comes from the meta, `count` from the story.
    expect(snippetOf(build('./story-docs.stories.ts'), 'Null Template')).toBe(
      `<sb-button [label]="'meta'" [count]="2" (clicked)="clicked($event)"></sb-button>`
    );
  });

  it('carries the story JSDoc description through', () => {
    expect(storyOf(build('./story-docs.stories.ts'), 'Basic')?.description).toBe(
      'Renders the button with a label and a count.'
    );
  });

  it.each([
    ['Own Template', '<sb-button emphasis>hi</sb-button>'],
    // An empty string is a user-defined template, matching the preview's own rule.
    ['Empty Template', ''],
    ['Render Template', '<sb-button rendered></sb-button>'],
    // CSF2: the story is the render function, and Angular's idiom is to return `{ template }`.
    ['Csf 2 Function', '<sb-button csf2></sb-button>'],
  ])('leaves the %s story alone', (storyName, expected) => {
    expect(snippetOf(build('./story-docs.stories.ts'), storyName)).toBe(expected);
  });

  it('reports args a spread hid rather than shipping a snippet that looks complete', () => {
    expect(snippetOf(build('./story-docs.stories.ts'), 'Spread Args')).toBe(
      `<!-- unresolved: ...sharedArgs -->\n<sb-button [label]="'meta'" [count]="1" (clicked)="clicked($event)"></sb-button>`
    );
  });

  it('reports a spread at the config level, not only one inside args', () => {
    expect(snippetOf(build('./story-docs.stories.ts'), 'Config Spread')).toBe(
      `<!-- unresolved: ...Basic -->\n<sb-button [label]="'meta'" [count]="5" (clicked)="clicked($event)"></sb-button>`
    );
  });

  it.each([
    // Emitting the identifier's source text would put JavaScript in the Source block where the
    // user expects markup, so the template is reported as unresolvable instead.
    ['Hoisted Template', 'HOISTED_TEMPLATE'],
    // A `render` that is not an inline function returning an object literal may still produce
    // markup; generating an element from args would silently replace it.
    ['Render Identifier', 'render: renderFn'],
  ])('reports the %s story rather than printing its JavaScript', (storyName, expected) => {
    const snippet = snippetOf(build('./story-docs.stories.ts'), storyName);
    expect(snippet).toContain(`<!-- unresolved: ${expected}`);
    expect(snippet).toContain('<sb-button');
  });

  // `export { X }` is registered by a different branch of the CSF parser, which records no
  // declaration path. Reading only that path silently fell back to the meta's args.
  it.each([
    [
      'ReExported',
      `<sb-button [label]="'reexported'" [count]="9" (clicked)="clicked($event)"></sb-button>`,
    ],
    [
      'RenamedStory',
      `<!-- unresolved: ...sharedArgs -->\n<sb-button [label]="'meta'" [count]="10" (clicked)="clicked($event)"></sb-button>`,
    ],
    ['ReExportedTemplate', '<sb-button reexported></sb-button>'],
  ])('reads the re-exported %s story from its own config', (storyName, expected) => {
    expect(snippetOf(build('./story-docs.stories.ts'), storyName)).toBe(expected);
  });

  it('isolates a story it cannot read and still ships the rest of the file', () => {
    const payload = build('./story-docs.stories.ts');

    expect(storyOf(payload, 'Unclassifiable')).toMatchObject({
      error: { message: expect.stringContaining('Could not evaluate story expression') },
    });
    expect(storyOf(payload, 'Unclassifiable')?.snippet).toBeUndefined();
    expect(snippetOf(payload, 'Basic')).toBeDefined();
  });

  it.each([
    ['a story file that does not exist', './missing.stories.ts', {}],
    ['a story file with no meta.component', './no-component.stories.ts', {}],
    [
      'a component Compodoc never documented',
      './story-docs.stories.ts',
      { readDocumentationJson: (): CompodocJson => ({ components: [] }) },
    ],
    [
      'an unreadable documentation.json',
      './story-docs.stories.ts',
      {
        readDocumentationJson: () => {
          throw new Error('ENOENT');
        },
      },
    ],
  ])('falls through for %s', (_case, importPath, overrides) => {
    expect(build(importPath, overrides as Partial<BuildStoryDocsContext>)).toBeUndefined();
  });

  it('falls through when the entry has no story import path', () => {
    expect(
      buildStoryDocsPayload(
        {
          entry: { id: 'x', name: 'x', title: 'x', type: 'docs', storiesImports: [] } as IndexEntry,
        },
        {
          storyRoot: FIXTURES,
          workspaceRoot: FIXTURES,
          outputDir: FIXTURES,
          readDocumentationJson: documentationJson,
          logger: { warn: vi.fn(), debug: vi.fn() },
        }
      )
    ).toBeUndefined();
  });
});
