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

  // When the index is being created, we have a legacy piece of logic that
  // wraps every docs page inside a component entry. This originates from
  // Storybook 6 and has never been removed. Because of it, we must dedupe
  // docs entries that are hidden under a fake component entry.
  // See https://github.com/storybookjs/storybook/issues/35513 for details.
  const docsParentIds = new Set<string>();
  matches.forEach(({ item }) => {
    if (item.type === 'docs' && item.parent) {
      docsParentIds.add(item.parent);
    }
  });

  // Components suppressed in favor of a matching docs child that hasn't been rendered yet.
  // The suppressed component still occupies its slot in `resultIds` so that sibling stories
  // ranked between the component and its docs entry are deduplicated, as they were before.
  const pendingDocsReplacements = new Set<string>();

  return matches.filter(({ item }) => {
    // This always gets called before the corresponding docs item
    // because of the sorting performed by the search index. So it's
    // safe to use `pendingDocsReplacements` in a single-pass lookup.
    if (item.type === 'component' && docsParentIds.has(item.id)) {
      if (!resultIds.has(item.id)) {
        resultIds.add(item.id);
        pendingDocsReplacements.add(item.id);
      }
      return false;
    }

    // When we reach this, we know we found an unattached MDX page with
    // a synthetic docs wrapper. Like in Tree.tsx, remove the wrapper
    // and present the docs item to end users.
    if (item.type === 'docs' && item.parent && pendingDocsReplacements.has(item.parent)) {
      pendingDocsReplacements.delete(item.parent);
      resultIds.add(item.id);
      return true;
    }
    // @ts-expect-error (non strict)
    if (resultIds.has(item.parent)) {
      return false;
    }
    resultIds.add(item.id);
    if (item.type === 'docs' && item.parent) {
      resultIds.add(item.parent);
    }
    return true;
  });
};
