import React, { useMemo, useRef, useState } from 'react';

import { Button, ScrollArea } from 'storybook/internal/components';
import type { API_LoadedRefData, StoryIndex, TagsOptions } from 'storybook/internal/types';
import type { StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { PlusIcon } from '@storybook/icons';

import { type State, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants';
import { useLandmark } from '../../hooks/useLandmark';
import { useLayout } from '../layout/LayoutProvider';
import { ChecklistWidget } from './ChecklistWidget';
import { CreateNewStoryFileModal } from './CreateNewStoryFileModal';
import { Explorer } from './Explorer';
import type { HeadingProps } from './Heading';
import { Heading } from './Heading';
import { Search } from './Search';
import { SearchResults } from './SearchResults';
import { SidebarBottom } from './SidebarBottom';
import { TagsFilter } from './TagsFilter';
import type { CombinedDataset, Selection } from './types';
import { useLastViewed } from './useLastViewed';

export const DEFAULT_REF_ID = 'storybook_internal';

const Container = styled.header(({ theme }) => ({
  position: 'absolute',
  zIndex: 1,
  left: 0,
  top: 0,
  bottom: 0,
  right: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: theme.background.content,

  [MEDIA_DESKTOP_BREAKPOINT]: {
    background: theme.background.app,
  },
}));

const Stack = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '16px 12px 20px 12px',
});

const CreateNewStoryButton = styled(Button)<{ isMobile: boolean }>(({ theme, isMobile }) => ({
  color: theme.textMutedColor,
  width: isMobile ? 36 : 32,
  height: isMobile ? 36 : 32,
  borderRadius: theme.appBorderRadius + 2,
}));

const Swap = React.memo(function Swap({
  children,
  condition,
}: {
  children: React.ReactNode;
  condition: boolean;
}) {
  const [a, b] = React.Children.toArray(children);
  return (
    <>
      <div style={{ display: condition ? 'block' : 'none' }}>{a}</div>
      <div style={{ display: condition ? 'none' : 'block' }}>{b}</div>
    </>
  );
});

const useCombination = (
  index: SidebarProps['index'],
  indexError: SidebarProps['indexError'],
  previewInitialized: SidebarProps['previewInitialized'],
  allStatuses: StatusesByStoryIdAndTypeId,
  refs: SidebarProps['refs']
): CombinedDataset => {
  const hash = useMemo(
    () => ({
      [DEFAULT_REF_ID]: {
        index,
        filteredIndex: index,
        indexError,
        previewInitialized,
        allStatuses,
        title: null,
        id: DEFAULT_REF_ID,
        url: 'iframe.html',
      },
      ...refs,
    }),
    [refs, index, indexError, previewInitialized, allStatuses]
  );
  // @ts-expect-error (non strict)
  return useMemo(() => ({ hash, entries: Object.entries(hash) }), [hash]);
};

const isRendererReact = global.STORYBOOK_RENDERER === 'react';

export interface SidebarProps extends API_LoadedRefData {
  refs: State['refs'];
  allStatuses: StatusesByStoryIdAndTypeId;
  menu: any[];
  storyId?: string;
  refId?: string;
  menuHighlighted?: boolean;
  enableShortcuts?: boolean;
  onMenuClick?: HeadingProps['onMenuClick'];
  showCreateStoryButton?: boolean;
  indexJson?: StoryIndex;
  isDevelopment?: boolean;
}
export const Sidebar = React.memo(function Sidebar({
  // @ts-expect-error (non strict)
  storyId = null,
  refId = DEFAULT_REF_ID,
  index,
  indexJson,
  indexError,
  allStatuses,
  previewInitialized,
  menu,
  menuHighlighted = false,
  enableShortcuts = true,
  isDevelopment = global.CONFIG_TYPE === 'DEVELOPMENT',
  refs = {},
  onMenuClick,
  showCreateStoryButton = isDevelopment && isRendererReact,
}: SidebarProps) {
  const [isFileSearchModalOpen, setIsFileSearchModalOpen] = useState(false);
  // @ts-expect-error (non strict)
  const selected: Selection = useMemo(() => storyId && { storyId, refId }, [storyId, refId]);
  const dataset = useCombination(index, indexError, previewInitialized, allStatuses, refs);
  const isLoading = !index && !indexError;
  const hasEntries = Object.keys(indexJson?.entries ?? {}).length > 0;
  const lastViewedProps = useLastViewed(selected);
  const { isMobile } = useLayout();
  const api = useStorybookApi();

  const tagPresets = useMemo(
    () =>
      Object.entries(global.TAGS_OPTIONS ?? {}).reduce((acc, entry) => {
        const [tag, option] = entry;
        acc[tag] = option;
        return acc;
      }, {} as TagsOptions),
    []
  );

  const headerRef = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark(
    {
      'aria-labelledby': 'global-site-h1',
      role: 'banner',
    },
    headerRef
  );

  return (
    <Container className="container sidebar-container" ref={headerRef} {...landmarkProps}>
      <h1 id="global-site-h1" className="sb-sr-only">
        Storybook
      </h1>
      <ScrollArea vertical offset={3} scrollbarSize={6} scrollPadding="4rem">
        <Stack>
          <div>
            <Heading
              className="sidebar-header"
              menuHighlighted={menuHighlighted}
              menu={menu}
              skipLinkHref="#storybook-preview-wrapper"
              isLoading={isLoading}
              onMenuClick={onMenuClick}
            />
            {!isLoading &&
              global.CONFIG_TYPE === 'DEVELOPMENT' &&
              global.FEATURES?.sidebarOnboardingChecklist !== false && <ChecklistWidget />}
          </div>
          <Search
            dataset={dataset}
            enableShortcuts={enableShortcuts}
            searchBarContent={
              showCreateStoryButton && (
                <>
                  <CreateNewStoryButton
                    isMobile={isMobile}
                    onClick={() => {
                      setIsFileSearchModalOpen(true);
                    }}
                    ariaLabel="Create a new story"
                    variant="outline"
                    padding="small"
                  >
                    <PlusIcon />
                  </CreateNewStoryButton>
                  <CreateNewStoryFileModal
                    open={isFileSearchModalOpen}
                    onOpenChange={setIsFileSearchModalOpen}
                  />
                </>
              )
            }
            searchFieldContent={
              indexJson && <TagsFilter api={api} indexJson={indexJson} tagPresets={tagPresets} />
            }
            {...lastViewedProps}
          >
            {({
              query,
              results,
              isBrowsing,
              closeMenu,
              getMenuProps,
              getItemProps,
              highlightedIndex,
            }) => (
              <Swap condition={isBrowsing}>
                <Explorer
                  dataset={dataset}
                  selected={selected}
                  isLoading={isLoading}
                  isBrowsing={isBrowsing}
                  hasEntries={hasEntries}
                />
                <SearchResults
                  query={query}
                  results={results}
                  closeMenu={closeMenu}
                  getMenuProps={getMenuProps}
                  getItemProps={getItemProps}
                  highlightedIndex={highlightedIndex}
                  enableShortcuts={enableShortcuts}
                  isLoading={isLoading}
                  clearLastViewed={lastViewedProps.clearLastViewed}
                />
              </Swap>
            )}
          </Search>
        </Stack>
        {isMobile || isLoading ? null : <SidebarBottom isDevelopment={isDevelopment} />}
      </ScrollArea>
    </Container>
  );
});
