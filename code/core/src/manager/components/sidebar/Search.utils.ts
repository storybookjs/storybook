import type { FuseOptions } from 'fuse.js';

import type { DocsAnchor } from 'storybook/internal/types';

import type { SearchItem, SearchResult } from './types.ts';

type DocsSearchItem = Extract<SearchItem, { type: 'docs' }>;

export const fuseOptions = {
  shouldSort: true,
  tokenize: true,
  findAllMatches: true,
  includeScore: true,
  includeMatches: true,
  threshold: 0.2,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  minMatchCharLength: 1,
  keys: [
    { name: 'name', weight: 0.6 },
    { name: 'path', weight: 0.3 },
    { name: 'anchors.title', weight: 0.1 },
  ],
} as FuseOptions<SearchItem>;

export const createDocsAnchorItem = (page: DocsSearchItem, anchor: DocsAnchor): SearchItem => {
  const namePostfix = page.path?.[0] === anchor.title ? '' : ` / ${anchor.title}`;

  return {
    ...page,
    anchors: [anchor],
    // Fuse requires unique ids, so suffix the entry id with the anchor's DOM id
    id: `${page.id}#${anchor.id}`,
    name: `${page.name}${namePostfix}`,
  };
};

export const createDocsSearchItems = (item: DocsSearchItem): SearchItem[] => {
  const { anchors, ...page } = item;

  return [page, ...(anchors ?? []).map((anchor) => createDocsAnchorItem(item, anchor))];
};

export const distinctSearchResults = (matches: SearchResult[]): SearchResult[] => {
  const resultIds: Set<string> = new Set();

  return matches.filter(({ item }) => {
    // @ts-expect-error (non strict)
    if (resultIds.has(item.parent)) {
      return false;
    }
    resultIds.add(item.id);
    return true;
  });
};
