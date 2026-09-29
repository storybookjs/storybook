import { describe, expect, it } from 'vitest';

import { sanitize, toId } from 'storybook/internal/csf';
import { anchorBlockIdFromId } from 'storybook/internal/docs-tools';

import Fuse from 'fuse.js';

import { distinctSearchResults, createDocsSearchItems, fuseOptions } from './Search.utils.ts';
import type { SearchItem, SearchResult } from './types.ts';

// Autodocs entries are named after the docs option, so the documented page only appears in `path`
const autodocsPage = (title: string, headings: string[]) =>
  ({
    type: 'docs',
    id: toId(`Example/${title}`, 'Docs'),
    name: 'Docs',
    parent: sanitize(`Example/${title}`),
    refId: 'storybook_internal',
    path: ['Example', title],
    anchors: headings.map((heading) => ({
      id: anchorBlockIdFromId(toId(`Example/${title}`, heading)),
      title: heading,
    })),
  }) as unknown as Extract<SearchItem, { type: 'docs' }>;

describe('distinctSearchResults', () => {
  const autodocsComponent = (title: string) =>
    ({
      type: 'component',
      id: sanitize(`Example/${title}`),
      name: title,
      refId: 'storybook_internal',
      path: ['Example'],
    }) as unknown as SearchItem;

  const result = (item: SearchItem, key = 'name') =>
    ({ item, matches: [{ key }], score: 0 }) as unknown as SearchResult;

  it('keeps every heading the query hits, even when its component ranks above it', () => {
    const [page, ...headings] = createDocsSearchItems(
      autodocsPage('Text Filter', ['Default', 'Disabled'])
    );
    const results = distinctSearchResults([
      result(autodocsComponent('Text Filter')),
      ...headings.map((heading) => result(heading, 'anchors.title')),
      result(page),
    ]);

    expect(results.map(({ item }) => item.id)).toEqual([
      'example-text-filter',
      'example-text-filter--docs#anchor--example-text-filter--default',
      'example-text-filter--docs#anchor--example-text-filter--disabled',
    ]);
  });

  it('drops a heading when the query only hits the page it belongs to', () => {
    const [, heading] = createDocsSearchItems(autodocsPage('Text Filter', ['Disabled']));

    expect(distinctSearchResults([result(heading, 'path')])).toEqual([]);
  });
});
