import React from 'react';

import type { Decorator, Meta, StoryFn } from '@storybook/react-vite';

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
 * Escape never leaves the field: with a query it clears the query, with an empty field it hands
 * focus to the explorer. Only an Escape from the explorer reaches the ancestors, where the mobile
 * menu drawer closes on it. Without this ladder the drawer closed on the first press, or kept the
 * focus trapped in the empty field (the drawer's focus scope returns it there after a blur).
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

  const explorer = canvasElement.querySelector('#storybook-explorer-menu');
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(explorer).toHaveFocus());
  expect(escapeAbove).not.toHaveBeenCalled();

  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(escapeAbove).toHaveBeenCalledOnce());
};

const selectStory = fn().mockName('selectStory');

// Renders the search results only while they are open, as the sidebar does.
const renderOpenResults: SearchProps['children'] = ({
  query,
  results,
  isSearchResultRendered,
  closeMenu,
  getMenuProps,
  getItemProps,
  highlightedIndex,
}) =>
  isSearchResultRendered ? (
    <SearchResults
      query={query}
      results={results}
      closeMenu={closeMenu}
      getMenuProps={getMenuProps}
      getItemProps={getItemProps}
      highlightedIndex={highlightedIndex}
    />
  ) : null;

const SearchWithResults: StoryFn = () => <Search {...baseProps}>{renderOpenResults}</Search>;

const selectStoryContext = {
  api: {
    getShortcutKeys: () => ({ search: ['/'] }),
    selectStory,
    resolveStory: () => undefined,
    emit: () => {},
  },
} as unknown as React.ContextType<typeof ManagerContext>;

const withSelectStoryApi: Decorator = (storyFn) => (
  <ManagerContext.Provider value={selectStoryContext}>{storyFn()}</ManagerContext.Provider>
);

/**
 * Selecting a search result opens it and keeps both the query and the results, so the next result
 * is one click away. Clearing the query removes them.
 */
export const KeepsResultsAfterSelecting: StoryFn = SearchWithResults.bind({});
KeepsResultsAfterSelecting.decorators = [withSelectStoryApi];
KeepsResultsAfterSelecting.play = async ({ canvasElement }) => {
  selectStory.mockClear();
  const canvas = within(canvasElement);
  const input = canvas.getByRole('searchbox');

  await userEvent.type(input, 'Default');
  const [firstResult] = await canvas.findAllByRole('option');
  const firstResultId = firstResult.getAttribute('data-id');
  await userEvent.click(firstResult);

  await waitFor(() => expect(selectStory).toHaveBeenCalledOnce());
  await waitFor(() => expect(input).not.toHaveFocus());
  expect(input).toHaveValue('Default');
  expect(canvasElement.querySelector(`[data-id="${firstResultId}"]`)).toBeInTheDocument();

  await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }));
  await waitFor(() => expect(input).toHaveValue(''));
  expect(canvas.queryAllByRole('option')).toHaveLength(0);
};

/**
 * "Show more" stays expanded after selecting a result, so a result beyond the first 50 stays in the
 * list once it is opened. A new query collapses the list again.
 */
export const KeepsShowMoreAfterSelecting: StoryFn = SearchWithResults.bind({});
KeepsShowMoreAfterSelecting.decorators = [withSelectStoryApi];
KeepsShowMoreAfterSelecting.play = async ({ canvasElement }) => {
  selectStory.mockClear();
  const canvas = within(canvasElement);
  const input = canvas.getByRole('searchbox');

  await userEvent.type(input, 'Default');
  await userEvent.click(await canvas.findByRole('option', { name: /more results/ }));
  await waitFor(() => expect(canvas.getAllByRole('option').length).toBeGreaterThan(51));

  const laterResult = canvas.getAllByRole('option')[60];
  const laterResultId = laterResult.getAttribute('data-id');
  await userEvent.click(laterResult);

  await waitFor(() => expect(selectStory).toHaveBeenCalledOnce());
  await waitFor(() => expect(input).not.toHaveFocus());
  expect(canvasElement.querySelector(`[data-id="${laterResultId}"]`)).toBeInTheDocument();
  expect(canvas.queryByRole('option', { name: /more results/ })).not.toBeInTheDocument();

  await userEvent.type(input, '{backspace}');
  await waitFor(() =>
    expect(canvas.getByRole('option', { name: /more results/ })).toBeInTheDocument()
  );
};

/**
 * A query of only spaces lists the recently opened items, as an empty query does. Opening one
 * returns to the tree view, because the trimmed query is empty.
 */
export const RecentlyOpenedFromSpacesOnlyQuery: StoryFn = () => (
  <Search {...baseProps} getLastViewed={getLastViewed}>
    {renderOpenResults}
  </Search>
);
RecentlyOpenedFromSpacesOnlyQuery.decorators = [withSelectStoryApi];
RecentlyOpenedFromSpacesOnlyQuery.play = async ({ canvasElement }) => {
  selectStory.mockClear();
  const canvas = within(canvasElement);

  await userEvent.type(canvas.getByRole('searchbox'), '  ');
  const [firstRecentItem] = await canvas.findAllByRole('option');
  await userEvent.click(firstRecentItem);

  await waitFor(() => expect(selectStory).toHaveBeenCalledOnce());
  await waitFor(() => expect(canvas.queryAllByRole('option')).toHaveLength(0));
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
