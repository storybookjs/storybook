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
    ...createDocsSearchItems(autodocsPage('Text', ['Default', 'Disabled']), 'Docs'),
    ...createDocsSearchItems(autodocsPage('Text Filter', ['Default', 'Disabled']), 'Docs'),
  ];

  return (new Fuse(list, fuseOptions).search(query) as SearchResult[]).map(({ item }) => item.name);
};

describe('createDocsSearchItems', () => {
  it('labels a heading with the page it belongs to, not with the docs entry name', () => {
    expect(createDocsSearchItems(autodocsPage('Text Filter', ['Disabled']), 'Docs')).toMatchObject([
      { id: 'example-text-filter--docs', name: 'Docs' },
      {
        id: 'example-text-filter--docs#anchor--example-text-filter--disabled',
        name: 'Text Filter / Disabled',
      },
    ]);
  });

  it('labels a heading of a page with a name of its own with that name', () => {
    const attachedMdx = { ...autodocsPage('Button', ['Primary']), name: 'Usage' };
    const unattachedMdx = {
      ...autodocsPage('Typography', ['Monospace']),
      name: 'Typography',
      path: ['brand'],
    };

    expect(createDocsSearchItems(attachedMdx, 'Docs')[1]).toMatchObject({
      name: 'Usage / Primary',
    });
    expect(createDocsSearchItems(unattachedMdx, 'Docs')[1]).toMatchObject({
      name: 'Typography / Monospace',
    });
  });

  it('keeps the label on a heading that repeats it, so it reads apart from the page', () => {
    const page = { ...autodocsPage('Button', ['Usage']), name: 'Usage' };

    expect(createDocsSearchItems(page, 'Docs').map(({ name }) => name)).toEqual([
      'Usage',
      'Usage / Usage',
    ]);
  });

  it('labels a heading of a page named after a custom docs option with its parent', () => {
    const page = { ...autodocsPage('Text Filter', ['Disabled']), name: 'Overview' };

    expect(createDocsSearchItems(page, 'Overview')[1]).toMatchObject({
      name: 'Text Filter / Disabled',
    });
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

  const result = (item: SearchItem, key = 'name') =>
    ({ item, matches: [{ key }], score: 0 }) as unknown as SearchResult;

  it('keeps every heading the query hits, even when its component ranks above it', () => {
    const [page, ...headings] = createDocsSearchItems(
      autodocsPage('Text Filter', ['Default', 'Disabled']),
      'Docs'
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
    const [, heading] = createDocsSearchItems(autodocsPage('Text Filter', ['Disabled']), 'Docs');

    expect(distinctSearchResults([result(heading, 'path')])).toEqual([]);
  });
});
