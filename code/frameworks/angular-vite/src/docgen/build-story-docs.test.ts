import type { IndexEntry, StoryDocsPayload } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import type { CompodocJson } from '@storybook/angular-compodoc';
import type { BuildStoryDocsContext } from './build-story-docs.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';
import type { CompodocComponentResolverOptions } from './compodoc-component-resolver.ts';
import { createCompodocComponentResolver } from './compodoc-component-resolver.ts';

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

const compodocResolver = (overrides: Partial<CompodocComponentResolverOptions> = {}) =>
  createCompodocComponentResolver({
    workspaceRoot: FIXTURES,
    readMetadata: documentationJson,
    logger: { warn: vi.fn(), debug: vi.fn() },
    ...overrides,
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
      resolveComponent: compodocResolver(),
      logger: { debug: vi.fn() },
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
    expect(snippetOf(build('./story-docs.stories.ts'), 'Inherits Meta Args')).toBe(
      `<sb-button [label]="'meta'" [count]="2" (clicked)="clicked($event)"></sb-button>`
    );
  });

  it('carries the story JSDoc description through', () => {
    expect(storyOf(build('./story-docs.stories.ts'), 'Basic')?.description).toBe(
      'Renders the button with a label and a count.'
    );
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
      'a component the docgen engine has nothing for',
      './story-docs.stories.ts',
      { resolveComponent: (): undefined => undefined },
    ],
    [
      'a component Compodoc never documented',
      './story-docs.stories.ts',
      {
        resolveComponent: compodocResolver({
          readMetadata: (): CompodocJson => ({ components: [] }),
        }),
      },
    ],
    [
      'unreadable Compodoc metadata',
      './story-docs.stories.ts',
      {
        resolveComponent: compodocResolver({
          readMetadata: () => {
            throw new Error('ENOENT');
          },
        }),
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
          resolveComponent: compodocResolver(),
          logger: { debug: vi.fn() },
        }
      )
    ).toBeUndefined();
  });

  // Compodoc is one source of a component's selector and binding names; an in-process Angular
  // component meta service is meant to be another. Snippet generation must not care which.
  it('builds from a resolver that has never heard of Compodoc', () => {
    const payload = build('./story-docs.stories.ts', {
      resolveComponent: () => ({
        name: 'ButtonComponent',
        selector: 'my-button',
        inputs: ['label'],
        outputs: ['pressed'],
      }),
    });

    expect(snippetOf(payload, 'Basic')).toBe(
      `<my-button [label]="'Save'" (pressed)="pressed($event)"></my-button>`
    );
  });
});
