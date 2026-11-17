import React from 'react';

import type { Decorator, Meta, StoryFn } from '@storybook/react-vite';

import { PRELOAD_ENTRIES } from 'storybook/internal/core-events';

import type { API } from 'storybook/manager-api';
import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';

import { destroyAnnouncer } from '@react-aria/live-announcer';

import { LayoutProvider } from '../layout/LayoutProvider.tsx';
import { MobileMenuDrawer } from '../mobile/navigation/MobileMenuDrawer.tsx';
import { IconSymbols } from './IconSymbols.tsx';
import { Search } from './Search.tsx';
import type { SearchProps } from './Search.tsx';
import { SearchResults } from './SearchResults.tsx';
import { noResults } from './SearchResults.stories.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { index } from './mockdata.large.ts';

const refId = DEFAULT_REF_ID;
const data = { [refId]: { id: refId, url: '/', index, previewInitialized: true, allStatuses: {} } };
const dataset = { hash: data, entries: Object.entries(data) };
const lastViewed = Object.values(index)
  .filter((item, i) => item.type === 'story' && i % 20 === 0)
  .map((story) => ({ storyId: story.id, refId }));
const recentlyOpened = [
  'emails-buildnotification--with-changes',
  'emails-introduction',
  'webapp-components-radar--radar',
  'tooltip-tooltipbuildlist--default',
].map((storyId) => ({ storyId, refId }));

const composedData = {
  ...data,
  composed: {
    id: 'composed',
    title: 'Composed',
    url: '/composed',
    index,
    previewInitialized: true,
    allStatuses: {},
  },
};
const composedDataset = { hash: composedData, entries: Object.entries(composedData) };

const selectStory = fn().mockName('api::selectStory');
const emit = fn().mockName('api::emit');
const clearLastViewed = fn().mockName('clearLastViewed');

const withApi: Decorator = (storyFn) => (
  <ManagerContext.Provider
    value={
      {
        api: {
          getShortcutKeys: () => ({ search: ['/'] }),
          selectStory,
          resolveStory: (storyId: string) => index[storyId],
          emit,
        },
      } as unknown as React.ContextType<typeof ManagerContext>
    }
  >
    {storyFn()}
  </ManagerContext.Provider>
);

const renderOpenResults: SearchProps['children'] = ({
  query,
  results,
  isRecentlyOpened,
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
      isRecentlyOpened={isRecentlyOpened}
      closeMenu={closeMenu}
      getMenuProps={getMenuProps}
      getItemProps={getItemProps}
      highlightedIndex={highlightedIndex}
      clearLastViewed={clearLastViewed}
    />
  ) : null;

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
  lastViewed: [],
};

export const Simple: StoryFn = () => <Search {...baseProps}>{() => null}</Search>;

export const FilledIn: StoryFn = () => (
  <Search {...baseProps} initialQuery="Foo bar">
    {() => <SearchResults {...noResults} />}
  </Search>
);

export const LastViewed: StoryFn = () => (
  <Search {...baseProps} lastViewed={lastViewed}>
    {({
      query,
      results,
      isRecentlyOpened,
      closeMenu,
      getMenuProps,
      getItemProps,
      highlightedIndex,
    }) => (
      <SearchResults
        query={query}
        results={results}
        isRecentlyOpened={isRecentlyOpened}
        closeMenu={closeMenu}
        getMenuProps={getMenuProps}
        getItemProps={getItemProps}
        highlightedIndex={highlightedIndex}
      />
    )}
  </Search>
);
LastViewed.play = async ({ canvasElement }) => {
  await expect(within(canvasElement).getAllByRole('option')).toHaveLength(50);
};

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

export const RecentlyOpened: StoryFn = () => (
  <Search {...baseProps} lastViewed={recentlyOpened}>
    {renderOpenResults}
  </Search>
);
RecentlyOpened.decorators = [withApi];
RecentlyOpened.beforeEach = () => {
  destroyAnnouncer();
};
RecentlyOpened.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole('switch', { name: 'Recently opened' });
  await expect(toggle).not.toBeChecked();
  await expect(canvas.queryByRole('option')).not.toBeInTheDocument();
  await expect(canvas.getByText('/')).not.toBeVisible();

  await userEvent.click(toggle);
  await expect(toggle).toBeChecked();
  await expect(canvas.getByRole('searchbox')).not.toHaveFocus();
  await expect(canvas.getByText('Recently opened')).toBeVisible();
  await expect(canvas.getByRole('listbox', { name: 'Recently opened' })).toBeVisible();
  await waitFor(() =>
    expect(document.body).toHaveLiveRegion({
      text: 'Showing 4 recently opened items',
      level: 'polite',
    })
  );
  const options = canvas.getAllByRole('option');
  await expect(options).toHaveLength(4);
  await expect(options[0]).toHaveAccessibleName('BuildNotification / with changes Emails');
  await expect(options[1]).toHaveAccessibleName('Introduction Emails');
  await expect(options[2]).toHaveAccessibleName('Radar Webapp components');
  await expect(options[3]).toHaveAccessibleName('TooltipBuildList / default tooltip');

  await userEvent.click(toggle);
  await expect(toggle).not.toBeChecked();
  await expect(canvas.queryByRole('option')).not.toBeInTheDocument();
};

export const RecentlyOpenedOpensTheStory: StoryFn = RecentlyOpened.bind({});
RecentlyOpenedOpensTheStory.decorators = [withApi];
RecentlyOpenedOpensTheStory.play = async ({ canvasElement }) => {
  selectStory.mockClear();
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole('switch', { name: 'Recently opened' });

  await userEvent.click(toggle);
  await userEvent.click(canvas.getByRole('option', { name: 'TooltipBuildList / default tooltip' }));

  await expect(selectStory).toHaveBeenCalledWith('tooltip-tooltipbuildlist--default', undefined, {
    ref: false,
    scrollTo: undefined,
  });
  await expect(toggle).toBeChecked();
  await expect(canvas.getAllByRole('option')).toHaveLength(4);
};

export const RecentlyOpenedSearch: StoryFn = RecentlyOpened.bind({});
RecentlyOpenedSearch.decorators = [withApi];
RecentlyOpenedSearch.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole('switch', { name: 'Recently opened' });
  const searchbox = canvas.getByRole('searchbox');

  await userEvent.click(toggle);
  await userEvent.type(searchbox, 'default');
  await waitFor(() => expect(canvas.getAllByRole('option')).toHaveLength(1));
  await expect(canvas.getByRole('option')).toHaveTextContent('TooltipBuildList / defaulttooltip');
  await expect(canvas.getByText('Recently opened')).toBeVisible();

  await userEvent.click(toggle);
  await expect(toggle).not.toBeChecked();
  await waitFor(() => expect(canvas.getAllByRole('option').length).toBeGreaterThan(1));
  await expect(canvas.queryByText('Recently opened')).not.toBeInTheDocument();

  await userEvent.click(toggle);
  await waitFor(() => expect(canvas.getAllByRole('option')).toHaveLength(1));

  await userEvent.type(searchbox, 'zzz');
  await expect(await canvas.findByText('No recently opened items found')).toBeVisible();
};

export const RecentlyOpenedClosesOnEscape: StoryFn = RecentlyOpened.bind({});
RecentlyOpenedClosesOnEscape.decorators = [withApi];
RecentlyOpenedClosesOnEscape.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole('switch', { name: 'Recently opened' });

  await userEvent.click(toggle);
  await expect(toggle).toBeChecked();
  await userEvent.keyboard('{Escape}');
  await expect(toggle).not.toBeChecked();
  await expect(canvas.queryByRole('option')).not.toBeInTheDocument();

  await userEvent.click(toggle);
  await userEvent.click(canvas.getByRole('searchbox'));
  await userEvent.keyboard('{Escape}');
  await expect(toggle).not.toBeChecked();
  await expect(canvas.queryByRole('option')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(canvasElement.querySelector('#storybook-explorer-menu')).toHaveFocus()
  );
};

export const RecentlyOpenedWithoutHistory: StoryFn = () => (
  <Search {...baseProps} lastViewed={[{ storyId: 'removed--story', refId }]}>
    {renderOpenResults}
  </Search>
);
RecentlyOpenedWithoutHistory.decorators = [withApi];
RecentlyOpenedWithoutHistory.play = async ({ canvasElement }) => {
  await expect(
    within(canvasElement).queryByRole('switch', { name: 'Recently opened' })
  ).not.toBeInTheDocument();
};

export const EscapeAfterOpeningAResult: StoryFn = () => (
  <Search {...baseProps}>{renderOpenResults}</Search>
);
EscapeAfterOpeningAResult.decorators = [withApi];
EscapeAfterOpeningAResult.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const searchbox = canvas.getByRole('searchbox');

  await userEvent.type(searchbox, 'default');
  await userEvent.click((await canvas.findAllByRole('option'))[0]);
  await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }));
  await expect(searchbox).toHaveValue('');

  await userEvent.keyboard('{Escape}');
  await expect(searchbox).toHaveValue('');
};

export const RecentlyOpenedClearWithKeyboard: StoryFn = RecentlyOpened.bind({});
RecentlyOpenedClearWithKeyboard.decorators = [withApi];
RecentlyOpenedClearWithKeyboard.play = async ({ canvasElement }) => {
  clearLastViewed.mockClear();
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole('switch', { name: 'Recently opened' });
  const clear = () => canvas.getByRole('button', { name: 'Clear recently opened items' });

  await userEvent.click(toggle);
  await expect(clear()).not.toBeVisible();

  await userEvent.tab();
  await expect(clear()).toHaveFocus();
  await expect(clear()).toBeVisible();

  await userEvent.keyboard('{Enter}');
  await expect(clearLastViewed).toHaveBeenCalledOnce();
  await expect(toggle).not.toBeChecked();
};

export const TouchOutsideKeepsTheQuery: StoryFn = () => (
  <Search {...baseProps}>{renderOpenResults}</Search>
);
TouchOutsideKeepsTheQuery.decorators = [withApi];
TouchOutsideKeepsTheQuery.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const searchbox = canvas.getByRole('searchbox');

  await userEvent.type(searchbox, 'default');
  await userEvent.click((await canvas.findAllByRole('option'))[0]);
  await userEvent.clear(searchbox);
  await userEvent.type(searchbox, 'radar');

  document.body.dispatchEvent(new Event('touchstart', { bubbles: true }));
  document.body.dispatchEvent(new Event('touchend', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  await expect(searchbox).toHaveValue('radar');
};

export const NewQueryAfterOpeningAResult: StoryFn = () => (
  <Search {...baseProps}>{renderOpenResults}</Search>
);
NewQueryAfterOpeningAResult.decorators = [withApi];
NewQueryAfterOpeningAResult.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const searchbox = canvas.getByRole('searchbox');

  await userEvent.type(searchbox, 'default');
  await userEvent.click((await canvas.findAllByRole('option'))[0]);
  await userEvent.click(searchbox);
  await userEvent.keyboard('{Backspace}');
  await userEvent.tab();

  await expect(searchbox).not.toHaveFocus();
  await expect(searchbox).toHaveValue('defaul');
  await waitFor(() => expect(canvas.getAllByRole('option').length).toBeGreaterThan(0));
};

export const RecentlyOpenedPreloadsStories: StoryFn = () => (
  <Search
    dataset={composedDataset}
    lastViewed={[
      { storyId: 'tooltip-tooltipbuildlist--default', refId },
      { storyId: 'emails-buildnotification--with-changes', refId: 'composed' },
    ]}
  >
    {renderOpenResults}
  </Search>
);
RecentlyOpenedPreloadsStories.decorators = [withApi];
RecentlyOpenedPreloadsStories.play = async ({ canvasElement }) => {
  emit.mockClear();
  const canvas = within(canvasElement);

  await userEvent.click(canvas.getByRole('switch', { name: 'Recently opened' }));
  await userEvent.hover(canvas.getByRole('option', { name: /BuildNotification/ }));
  await expect(emit).toHaveBeenCalledWith(PRELOAD_ENTRIES, {
    ids: ['emails-buildnotification--with-changes'],
    source: 'search',
    options: { target: 'composed' },
  });

  emit.mockClear();
  await userEvent.click(canvas.getByRole('searchbox'));
  await userEvent.keyboard('{ArrowDown}');
  await expect(emit).toHaveBeenCalledWith(PRELOAD_ENTRIES, {
    ids: ['tooltip-tooltipbuildlist--default'],
    source: 'search',
    options: { target: refId },
  });
};

const drawerOpenChange = fn().mockName('onOpenChange');

const InMobileDrawer = () => {
  const [isOpen, setOpen] = React.useState(true);
  return (
    <LayoutProvider forceDesktop={false}>
      <MobileMenuDrawer
        isOpen={isOpen}
        onOpenChange={(open) => {
          drawerOpenChange(open);
          setOpen(open);
        }}
      >
        <Search {...baseProps} lastViewed={recentlyOpened}>
          {renderOpenResults}
        </Search>
      </MobileMenuDrawer>
    </LayoutProvider>
  );
};

export const RecentlyOpenedInMobileDrawer: StoryFn = () => <InMobileDrawer />;
RecentlyOpenedInMobileDrawer.decorators = [withApi];
RecentlyOpenedInMobileDrawer.play = async () => {
  drawerOpenChange.mockClear();
  const toggle = await screen.findByRole('switch', { name: 'Recently opened' });

  await userEvent.click(toggle);
  await expect(toggle).toBeChecked();

  await userEvent.keyboard('{Escape}');
  await expect(toggle).not.toBeChecked();
  await expect(screen.queryByRole('option')).not.toBeInTheDocument();
  await expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  await expect(drawerOpenChange).not.toHaveBeenCalledWith(false);

  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(drawerOpenChange).toHaveBeenCalledWith(false));
};
