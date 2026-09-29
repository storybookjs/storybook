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

  const distinctIds = (query: string) => {
    const list = [
      autodocsComponent('Text Filter'),
      ...createDocsSearchItems(autodocsPage('Text Filter', ['Default', 'Disabled'])),
    ];
    const results = new Fuse(list, fuseOptions).search(query) as SearchResult[];

    return distinctSearchResults(results).map(({ item }) => item.id);
  };

  it('keeps a docs page and every matching heading, but not its component', () => {
    const ids = distinctIds('Text Filter');

    expect(ids).toHaveLength(3);
    expect(ids).toEqual(
      expect.arrayContaining([
        'example-text-filter--docs',
        'example-text-filter--docs#anchor--example-text-filter--default',
        'example-text-filter--docs#anchor--example-text-filter--disabled',
      ])
    );
  });
});
