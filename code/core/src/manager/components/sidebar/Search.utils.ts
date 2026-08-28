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

/**
 * A search item for a single heading of a docs page.
 *
 * The label is built from the page's own label rather than its entry name, because autodocs pages
 * are all named "Docs": scoring "Docs / Installation" gives Fuse nothing to tell one page's heading
 * from another's, so every page with that heading ranks alike.
 */
export const docsAnchorItem = (page: DocsSearchItem, anchor: DocsAnchor): SearchItem => {
  const label = page.path.at(-1) ?? page.name;

  return {
    ...page,
    anchors: [anchor],
    // Fuse requires unique ids, so suffix the entry id with the anchor's DOM id
    id: `${page.id}#${anchor.id}`,
    name: label === anchor.title ? label : `${label} / ${anchor.title}`,
  };
};

/** The docs page itself, followed by one item per heading so headings are findable on their own. */
export const expandDocsAnchors = (item: DocsSearchItem): SearchItem[] => {
  const { anchors, ...page } = item;

  return [page, ...(anchors ?? []).map((anchor) => docsAnchorItem(item, anchor))];
};
