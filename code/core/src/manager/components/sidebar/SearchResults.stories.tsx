import React from 'react';

import type { StoriesHash } from '@storybook/core/manager-api';

import { searchItem } from '../../utils/tree';
import { IconSymbols } from './IconSymbols';
import { SearchResults } from './SearchResults';
import { mockDataset } from './mockdata';
import type { CombinedDataset, Refs, SearchItem } from './types';

export default {
  component: SearchResults,
  title: 'Sidebar/SearchResults',
  includeStories: /^[A-Z]/,
  parameters: { layout: 'fullscreen' },
  globals: { sb_theme: 'side-by-side' },
  decorators: [
    (storyFn: any) => (
      <div style={{ padding: '0 20px', maxWidth: '230px' }}>
        <IconSymbols />
        {storyFn()}
      </div>
    ),
  ],
};

const combinedDataset = (refs: Record<string, StoriesHash>): CombinedDataset => {
  const hash: Refs = Object.entries(refs).reduce(
    (acc, [refId, index]) =>
      Object.assign(acc, {
        [refId]: {
          index,
          title: null,
          id: refId,
          url: 'iframe.html',
          ready: true,
          error: false,
        },
      }),
    {}
  );
  return { hash, entries: Object.entries(hash) };
};

// @ts-expect-error (invalid input)
const dataset = combinedDataset({ internal: mockDataset.withRoot, composed: mockDataset.noRoot });

// @ts-expect-error (non strict)
const internal = Object.values(dataset.hash.internal.index).map((item) =>
  searchItem(item, dataset.hash.internal)
);
// @ts-expect-error (non strict)
const composed = Object.values(dataset.hash.composed.index).map((item) =>
  searchItem(item, dataset.hash.composed)
);
const stories: SearchItem[] = internal.concat(composed);

const results = stories
  .filter(({ name }) => name.includes('A2'))
  .map((item) => {
    const i = item.name.indexOf('A2');
    return { item, matches: [{ value: item.name, indices: [[i, i + 1]] }], score: 0 };
  });

const recents = stories
  .filter((item) => item.type === 'component') // even though we track stories, we display them grouped by component
  .map((story) => ({ item: story, matches: [], score: 0 }));

// We need this to prevent react key warnings
const passKey: any = (props = { key: '' }) => ({ key: props.key });

export const searching = {
  query: 'query',
  results,
  closeMenu: () => {},
  getMenuProps: passKey,
  getItemProps: passKey,
  highlightedIndex: 0,
};
export const noResults = {
  ...searching,
  results: [] as any,
};
export const lastViewed = {
  query: '',
  results: recents,
  closeMenu: () => {},
  getMenuProps: passKey,
  getItemProps: passKey,
  highlightedIndex: 0,
};

export const Searching = () => <SearchResults {...searching} />;

export const NoResults = () => <SearchResults {...noResults} />;

export const LastViewed = () => <SearchResults {...lastViewed} />;
