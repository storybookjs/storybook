import React from 'react';

import type { Meta, StoryFn } from '@storybook/react-vite';

import type { API } from 'storybook/manager-api';
import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { IconSymbols } from './IconSymbols.tsx';
import { Search } from './Search.tsx';
import type { SearchProps } from './Search.tsx';
import { SearchResults } from './SearchResults.tsx';
import { noResults } from './SearchResults.stories.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { index } from './mockdata.large.ts';
import type { Selection } from './types.ts';

const refId = DEFAULT_REF_ID;
const data = { [refId]: { id: refId, url: '/', index, previewInitialized: true, allStatuses: {} } };
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 20,
          maxWidth: '230px',
        }}
      >
        <IconSymbols />
        {storyFn()}
      </div>
    ),
  ],
} satisfies Meta<typeof Search>;
export default meta;

const baseProps: Omit<SearchProps, 'children'> = {
  dataset,
  getLastViewed: () => [] as Selection[],
};

export const Simple: StoryFn = () => <Search {...baseProps}>{() => null}</Search>;

export const FilledIn: StoryFn = () => (
  <Search {...baseProps} initialQuery="Foo bar">
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

const escapeAbove = fn().mockName('escapeAbove');

/**
 * Escape in a field with a query only clears the query, and the press goes no further: in the
 * mobile menu drawer, an Escape that reaches the drawer closes it. Escape in an empty field still
 * reaches the ancestors, so the drawer can close.
 */
export const EscapeWithQueryStaysInSearch: StoryFn = () => (
  <div
    onKeyDown={(event) => {
      if (event.key === 'Escape') {
        escapeAbove();
      }
    }}
  >
    <Search {...baseProps} initialQuery="Foo">
      {() => null}
    </Search>
  </div>
);
EscapeWithQueryStaysInSearch.play = async ({ canvasElement }) => {
  escapeAbove.mockClear();
  const input = within(canvasElement).getByRole('searchbox');
  await userEvent.click(input);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(input).toHaveValue(''));
  expect(escapeAbove).not.toHaveBeenCalled();

  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(escapeAbove).toHaveBeenCalledOnce());
};

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
