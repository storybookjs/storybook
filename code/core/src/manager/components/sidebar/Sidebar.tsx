import React, { useMemo, useState } from 'react';

import {
  IconButton,
  ScrollArea,
  Spaced,
  TooltipNote,
  WithTooltip,
} from '@storybook/core/components';
import { styled } from '@storybook/core/theming';
import type { API_LoadedRefData, Addon_SidebarTopType, StoryIndex } from '@storybook/core/types';
import { global } from '@storybook/global';
import { PlusIcon } from '@storybook/icons';

import { type State, useStorybookApi } from '@storybook/core/manager-api';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants';
import { useLayout } from '../layout/LayoutProvider';
import { CreateNewStoryFileModal } from './CreateNewStoryFileModal';
import { Explorer } from './Explorer';
import type { HeadingProps } from './Heading';
import { Heading } from './Heading';
import { Search } from './Search';
import { SearchResults } from './SearchResults';
import { SidebarBottom } from './SidebarBottom';
import { TagsFilter } from './TagsFilter';
import { TEST_PROVIDER_ID } from './Tree';
import type { CombinedDataset, Selection } from './types';
import { useLastViewed } from './useLastViewed';

export const DEFAULT_REF_ID = 'storybook_internal';

const Container = styled.nav(({ theme }) => ({
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

const Top = styled(Spaced)({
  paddingLeft: 12,
  paddingRight: 12,
  paddingBottom: 20,
  paddingTop: 16,
  flex: 1,
});

const TooltipNoteWrapper = styled(TooltipNote)({
  margin: 0,
});

const CreateNewStoryButton = styled(IconButton)(({ theme }) => ({
  color: theme.color.mediumdark,
  width: 32,
  height: 32,
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

const useCombination = ({
  index,
  indexError,
  previewInitialized,
  actions,
  status,
  refs,
}: {
  index: SidebarProps['index'];
  indexError: SidebarProps['indexError'];
  previewInitialized: SidebarProps['previewInitialized'];
  actions: SidebarProps['actions'];
  status: SidebarProps['status'];
  refs: SidebarProps['refs'];
}): CombinedDataset => {
  const hash = useMemo(
    () => ({
      [DEFAULT_REF_ID]: {
        index,
        indexError,
        previewInitialized,
        actions,
        status,
        title: null,
        id: DEFAULT_REF_ID,
        url: 'iframe.html',
      },
      ...refs,
    }),
    [refs, index, indexError, previewInitialized, actions, status]
  );
  // @ts-expect-error (non strict)
  return useMemo(() => ({ hash, entries: Object.entries(hash) }), [hash]);
};

const isRendererReact = global.STORYBOOK_RENDERER === 'react';

export interface SidebarProps extends API_LoadedRefData {
  refs: State['refs'];
  actions: State['actions'];
  status: State['status'];
  menu: any[];
  extra: Addon_SidebarTopType[];
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
  actions,
  status,
  previewInitialized,
  menu,
  extra,
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
  const dataset = useCombination({ index, indexError, previewInitialized, actions, status, refs });
  const isLoading = !index && !indexError;
  const lastViewedProps = useLastViewed(selected);
  const { isMobile } = useLayout();
  const api = useStorybookApi();

  return (
    <Container className="container sidebar-container">
      <ScrollArea vertical offset={3} scrollbarSize={6}>
        <Top row={1.6}>
          <Heading
            className="sidebar-header"
            menuHighlighted={menuHighlighted}
            menu={menu}
            extra={extra}
            skipLinkHref="#storybook-preview-wrapper"
            isLoading={isLoading}
            onMenuClick={onMenuClick}
          />
          <Search
            dataset={dataset}
            enableShortcuts={enableShortcuts}
            searchBarContent={
              showCreateStoryButton && (
                <>
                  <WithTooltip
                    trigger="hover"
                    hasChrome={false}
                    tooltip={<TooltipNoteWrapper note="Create a new story" />}
                  >
                    <CreateNewStoryButton
                      onClick={() => {
                        setIsFileSearchModalOpen(true);
                      }}
                      variant="outline"
                    >
                      <PlusIcon />
                    </CreateNewStoryButton>
                  </WithTooltip>
                  <CreateNewStoryFileModal
                    open={isFileSearchModalOpen}
                    onOpenChange={setIsFileSearchModalOpen}
                  />
                </>
              )
            }
            searchFieldContent={
              indexJson && (
                <TagsFilter api={api} indexJson={indexJson} isDevelopment={isDevelopment} />
              )
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
        </Top>
        {isMobile || isLoading ? null : <SidebarBottom isDevelopment={isDevelopment} />}
      </ScrollArea>
    </Container>
  );
});
