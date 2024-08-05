import React from 'react';
import type { StoryFn, Meta } from '@storybook/react';
import type { API } from '@storybook/core/manager-api';
import { ManagerContext } from '@storybook/core/manager-api';
import { action } from '@storybook/addon-actions';

import { index } from './mockdata.large';
import { Search } from './Search';
import { SearchResults } from './SearchResults';
import { noResults } from './SearchResults.stories';
import { DEFAULT_REF_ID } from './Sidebar';
import type { Selection } from './types';
import { IconSymbols } from './IconSymbols';

const refId = DEFAULT_REF_ID;
const data = { [refId]: { id: refId, url: '/', index, previewInitialized: true } };
const dataset = { hash: data, entries: Object.entries(data) };
const getLastViewed = () =>
  Object.values(index)
    .filter((item, i) => item.type === 'component' && item.parent && i % 20 === 0)
    .map((component) => ({ storyId: component.id, refId }));

const meta = {
  component: Search,
  title: 'Sidebar/Search',
  parameters: { layout: 'fullscreen' },
  globals: { sb_theme: 'side-by-side' },
  decorators: [
    (storyFn: any) => (
      <div style={{ padding: 20, maxWidth: '230px' }}>
        <IconSymbols />
        {storyFn()}
      </div>
    ),
  ],
} satisfies Meta<typeof Search>;
export default meta;

const baseProps = {
  dataset,
  clearLastViewed: action('clear'),
  getLastViewed: () => [] as Selection[],
};

export const Simple: StoryFn = () => <Search {...baseProps}>{() => null}</Search>;

export const SimpleWithCreateButton: StoryFn = () => (
  <Search {...baseProps} showCreateStoryButton={true}>
    {() => null}
  </Search>
);

export const FilledIn: StoryFn = () => (
  <Search {...baseProps} initialQuery="Search query">
    {() => <SearchResults {...noResults} />}
  </Search>
);

export const LastViewed: StoryFn = () => (
  <Search {...baseProps} getLastViewed={getLastViewed}>
    {({ query, results, closeMenu, getMenuProps, getItemProps, highlightedIndex }) => (
      <SearchResults
        query={query}
        results={results}
        closeMenu={closeMenu}
        getMenuProps={getMenuProps}
        getItemProps={getItemProps}
        highlightedIndex={highlightedIndex}
      />
    )}
  </Search>
);

export const ShortcutsDisabled: StoryFn = () => (
  <Search {...baseProps} enableShortcuts={false}>
    {() => null}
  </Search>
);

export const CustomShortcuts: StoryFn = () => <Search {...baseProps}>{() => null}</Search>;

CustomShortcuts.decorators = [
  (storyFn) => (
    <ManagerContext.Provider
      value={
        {
          api: {
            getShortcutKeys: () => ({ search: ['control', 'shift', 's'] }),
          } as API,
        } as any
      }
    >
      {storyFn()}
    </ManagerContext.Provider>
  ),
];
