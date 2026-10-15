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

const search = (query: string) => {
  const list = [
    ...createDocsSearchItems(autodocsPage('Text', ['Default', 'Disabled'])),
    ...createDocsSearchItems(autodocsPage('Text Filter', ['Default', 'Disabled'])),
  ];

  return (new Fuse(list, fuseOptions).search(query) as SearchResult[]).map(({ item }) => item.name);
};

describe('createDocsSearchItems', () => {
  it('labels a heading with the page it belongs to, not with the docs entry name', () => {
    expect(createDocsSearchItems(autodocsPage('Text Filter', ['Disabled']))).toMatchObject([
      { id: 'example-text-filter--docs', name: 'Docs' },
      {
        id: 'example-text-filter--docs#anchor--example-text-filter--disabled',
        name: 'Text Filter / Disabled',
      },
    ]);
  });

  it('ranks a heading of the page named in the query above the same heading elsewhere', () => {
    expect(search('Text Filter Disabled')[0]).toBe('Text Filter / Disabled');
  });

  it('still finds a heading that is searched for on its own', () => {
    expect(search('Disabled')).toEqual(
      expect.arrayContaining(['Text / Disabled', 'Text Filter / Disabled'])
    );
  });
});

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
