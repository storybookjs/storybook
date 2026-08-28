import { describe, expect, it } from 'vitest';

import Fuse from 'fuse.js';

import { expandDocsAnchors, fuseOptions } from './Search.utils.ts';
import type { SearchItem, SearchResult } from './types.ts';

/**
 * The shape `makeFuse` produces for an autodocs page: the docs entry is named after the docs
 * option (`Docs`), and the page it documents only shows up in the item's path.
 */
const autodocsPage = (title: string, headings: string[]) =>
  ({
    type: 'docs',
    id: `${title.toLowerCase().replace(/ /g, '-')}--docs`,
    name: 'Docs',
    parent: title.toLowerCase().replace(/ /g, '-'),
    refId: 'storybook_internal',
    path: ['Example', title],
    anchors: headings.map((heading) => ({ id: `anchor--${heading}`, title: heading })),
  }) as unknown as Extract<SearchItem, { type: 'docs' }>;

const search = (query: string) => {
  const list = [
    ...expandDocsAnchors(autodocsPage('Text', ['Default', 'Disabled'])),
    ...expandDocsAnchors(autodocsPage('Text Filter', ['Default', 'Disabled'])),
  ];

  return (new Fuse(list, fuseOptions).search(query) as SearchResult[]).map(({ item }) => item.name);
};

describe('expandDocsAnchors', () => {
  it('labels a heading with the page it belongs to, not with the docs entry name', () => {
    expect(expandDocsAnchors(autodocsPage('Text Filter', ['Disabled']))).toMatchObject([
      { id: 'text-filter--docs', name: 'Docs' },
      { id: 'text-filter--docs#anchor--Disabled', name: 'Text Filter / Disabled' },
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
