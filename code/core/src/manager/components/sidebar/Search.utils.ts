import type { FuseOptions } from 'fuse.js';

import type { DocsAnchor } from 'storybook/internal/types';

import type { Match, SearchItem, SearchResult } from './types.ts';

type DocsSearchItem = Extract<SearchItem, { type: 'docs' }>;

const ANCHOR_TITLE_KEY = 'anchors.title';

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
    { name: ANCHOR_TITLE_KEY, weight: 0.1 },
  ],
} as FuseOptions<SearchItem>;

export const createDocsAnchorItem = (
  page: DocsSearchItem,
  anchor: DocsAnchor,
  docsDefaultName: string | undefined
): SearchItem => {
  // Every page named after the docs option reads the same, so only its parent tells them apart
  const label = page.name === docsDefaultName ? (page.path.at(-1) ?? page.name) : page.name;

  return {
    ...page,
    anchors: [anchor],
    // Fuse requires unique ids, so suffix the entry id with the anchor's DOM id
    id: `${page.id}#${anchor.id}`,
    name: `${label} / ${anchor.title}`,
  };
};

export const createDocsSearchItems = (
  item: DocsSearchItem,
  docsDefaultName: string | undefined
): SearchItem[] => {
  const { anchors, ...page } = item;

  return [
    page,
    ...(anchors ?? []).map((anchor) => createDocsAnchorItem(item, anchor, docsDefaultName)),
  ];
};

export const distinctSearchResults = (matches: SearchResult[]): SearchResult[] => {
  const resultIds: Set<string> = new Set();

  return matches.filter(({ item, matches: itemMatches }) => {
    // Headings are separate navigation targets, so their component doesn't hide them,
    // but they only show when the query matches the heading itself, not just its page
    if (item.id.includes('#')) {
      return itemMatches.some(({ key }: Match) => key === ANCHOR_TITLE_KEY);
    }

    // @ts-expect-error (non strict)
    if (resultIds.has(item.parent)) {
      return false;
    }
    resultIds.add(item.id);
    return true;
  });
};
