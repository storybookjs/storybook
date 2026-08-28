import type { FuseOptions } from 'fuse.js';

import type { DocsAnchor } from 'storybook/internal/types';

import type { SearchItem } from './types.ts';

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

/** A search item for a single heading of a docs page. */
export const docsAnchorItem = (page: DocsSearchItem, anchor: DocsAnchor): SearchItem => {
  const namePostfix = page.path?.[0] === anchor.title ? '' : ` / ${anchor.title}`;

  return {
    ...page,
    anchors: [anchor],
    // Fuse requires unique ids, so suffix the entry id with the anchor's DOM id
    id: `${page.id}#${anchor.id}`,
    name: `${page.name}${namePostfix}`,
  };
};

/** The docs page itself, followed by one item per heading so headings are findable on their own. */
export const expandDocsAnchors = (item: DocsSearchItem): SearchItem[] => {
  const { anchors, ...page } = item;

  return [page, ...(anchors ?? []).map((anchor) => docsAnchorItem(item, anchor))];
};
