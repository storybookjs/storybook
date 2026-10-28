import { describe, expect, it } from 'vitest';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import type { StoryDocsServiceState } from './definition.ts';
import { summarizeStoryDocsForTelemetry } from './telemetry.ts';

const storyEntry = (id: string): IndexEntry => ({
  id,
  name: id,
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath: './Button.stories.ts',
});

const indexOf = (ids: string[]): StoryIndex => ({
  v: 5,
  entries: Object.fromEntries(ids.map((id) => [id, storyEntry(id)])),
});

const snapshotOf = (stories: StoryDocsServiceState['components'][string]['stories']) => ({
  components: { button: { id: 'button', name: 'Button', path: './Button.stories.ts', stories } },
});

describe('summarizeStoryDocsForTelemetry', () => {
  it('returns undefined when the index has no story', () => {
    expect(summarizeStoryDocsForTelemetry(indexOf([]), [])).toBeUndefined();
  });

  it.each([
    {
      name: 'a full snippet',
      storyDoc: { id: 'story', name: 'Story', snippet: '<Button />' },
      expected: { errorRatio: 0, noSnippetRatio: 0, warningRatio: 0 },
    },
    {
      name: 'a partial snippet',
      storyDoc: { id: 'story', name: 'Story', snippet: '<Button />', warning: 'args.onClick' },
      expected: { errorRatio: 0, noSnippetRatio: 0, warningRatio: 1 },
    },
    {
      name: 'no snippet with a warning',
      storyDoc: { id: 'story', name: 'Story', warning: 'render' },
      expected: { errorRatio: 0, noSnippetRatio: 1, warningRatio: 0 },
    },
    {
      name: 'no snippet without a warning',
      storyDoc: { id: 'story', name: 'Story' },
      expected: { errorRatio: 0, noSnippetRatio: 1, warningRatio: 0 },
    },
    {
      name: 'a provider error',
      storyDoc: {
        id: 'story',
        name: 'Story',
        error: { name: 'Error', message: 'Provider failed' },
      },
      expected: { errorRatio: 1, noSnippetRatio: 0, warningRatio: 0 },
    },
    {
      name: 'no story docs',
      storyDoc: undefined,
      expected: { errorRatio: 1, noSnippetRatio: 0, warningRatio: 0 },
    },
  ])('classifies a story with $name', ({ storyDoc, expected }) => {
    const snapshots = storyDoc ? [snapshotOf({ story: storyDoc })] : [];

    expect(summarizeStoryDocsForTelemetry(indexOf(['story']), snapshots)).toEqual(expected);
  });

  it('divides every outcome by the stories of the index', () => {
    const index = indexOf(['full', 'partial', 'bare', 'missing']);
    const snapshots = [
      snapshotOf({
        full: { id: 'full', name: 'Full', snippet: '<Button />' },
        partial: { id: 'partial', name: 'Partial', snippet: '<Button />', warning: 'args.onClick' },
        bare: { id: 'bare', name: 'Bare' },
      }),
    ];

    expect(summarizeStoryDocsForTelemetry(index, snapshots)).toMatchInlineSnapshot(`
      {
        "errorRatio": 0.25,
        "noSnippetRatio": 0.25,
        "warningRatio": 0.25,
      }
    `);
  });
});
