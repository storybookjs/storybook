import React, { type FC, useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card, Collapsible, IconButton, ScrollArea } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  ChevronSmallDownIcon,
  CollapseIcon,
  ExpandAltIcon,
  WandIcon,
  SearchIcon,
  StorybookIcon,
} from '@storybook/icons';

import { CollectionGrid, type StoryInfo } from '../components/CollectionGrid.tsx';
import { ReviewHeader } from '../components/ReviewHeader.tsx';
import { StaleBanner } from '../components/StaleBanner.tsx';
import { buildReviewChangesDetailHref } from '../review-navigation.ts';
import type { ReviewState } from '../review-state.ts';

// `100dvh` fills the manager's page cell and also works in the addon's own
// fullscreen stories, where #storybook-root has no height. The card list below
// the fixed header is the single scroll container.
const Page = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  minHeight: 0,
  overflow: 'hidden',
  background: theme.background.app,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
  fontSize: theme.typography.size.s2,
}));

const Empty = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100dvh',
  color: theme.color.mediumdark,
}));

const SearchField = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flex: '0 1 240px',
  width: 240,
  maxWidth: '100%',
  minWidth: 0,
  minHeight: 30,
  borderRadius: theme.appBorderRadius + 2,
  boxShadow: `${theme.button.border} 0 0 0 1px inset`,
  padding: 2,
  paddingLeft: 6,
  // Mirror the sidebar search field: the wrapper owns the focus ring while the
  // inner input stays outline-less, so the whole field reads as focused.
  '&:has(input:focus), &:has(input:active)': {
    background: theme.background.app,
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: 2,
  },
}));

const SearchInput = styled.input(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  border: 0,
  background: 'transparent',
  outline: 0,
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s1,
  height: 26,
  '&::placeholder': {
    color: theme.textMutedColor,
    opacity: 1,
  },
  '&::-ms-clear': {
    display: 'none',
  },
  '&::-webkit-search-decoration, &::-webkit-search-cancel-button, &::-webkit-search-results-button, &::-webkit-search-results-decoration':
    {
      display: 'none',
    },
}));

const SearchIconWrap = styled.span(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.textMutedColor,
  width: 22,
}));

// Wrapper that gives the overlay ScrollArea a bounded height to scroll within.
const ListScroll = styled.div({
  flex: 1,
  minHeight: 0,
});

const List = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 12,
  // Cards must keep their intrinsic height so the list scrolls; without this
  // the default flex-shrink collapses them to fit the viewport and Card's
  // overflow:hidden clips the content at the bottom.
  '& > *': {
    flexShrink: 0,
  },
});

// A plain clickable row, not a semantic control: making the whole header
// toggle is just a convenience affordance for pointer users. The real
// accessible control is the chevron <IconButton> inside, which carries the
// aria-label and aria-expanded state for assistive technologies.
const CardHead = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 10px 6px 12px',
  minHeight: 40,
  cursor: 'pointer',
});

const CardTitle = styled.strong(({ theme }) => ({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: theme.typography.weight.bold,
  lineHeight: '20px',
  color: theme.color.defaultText,
}));

const CardControls = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
  flexShrink: 0,
});

const CardCount = styled.span(({ theme }) => ({
  minWidth: 28,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '20px',
  textAlign: 'center',
  color: theme.textMutedColor,
}));

const ToggleChevronIcon = styled(ChevronSmallDownIcon)({
  transition: 'transform 160ms ease',
});

const NoResults = styled.div(({ theme }) => ({
  color: theme.textMutedColor,
  padding: 16,
  fontSize: 14,
}));

// Temporary purple override until a shared "AI" badge variant is decided.
const AICuratedBadge = styled(Badge)({
  color: '#723aa6',
  background: '#f5f0fa',
  boxShadow: 'inset 0 0 0 1px #e1d2ef',
  svg: { marginTop: 0 },
});

// A story matches the search if its id, component title, or story name
// contains the query. Search narrows results to this story level, so a
// collection is shown with only its matching stories.
const storyMatchesQuery = (
  storyId: string,
  storyInfo: Record<string, StoryInfo>,
  query: string
) => {
  if (storyId.toLowerCase().includes(query)) {
    return true;
  }
  const meta = storyInfo[storyId];
  if (!meta) {
    return false;
  }
  return meta.title.toLowerCase().includes(query) || meta.name.toLowerCase().includes(query);
};

const formatCreatedAgo = (createdAt: number, nowMs: number): string => {
  const elapsedMs = Math.max(0, nowMs - createdAt);
  if (elapsedMs < 60_000) {
    return 'just now';
  }
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }
  return `${Math.floor(elapsedMinutes / 60)}h ago`;
};

export interface SummaryScreenProps {
  state: ReviewState | null;
  /** Story id → component title + name, resolved from the Storybook index. */
  storyInfo?: Record<string, StoryInfo>;
  /** When true, render the "this review may be stale" banner at the top. */
  isStale?: boolean;
}

export const SummaryScreen: FC<SummaryScreenProps> = ({
  state,
  storyInfo = {},
  isStale = false,
}) => {
  const [search, setSearch] = useState('');
  const [expandedCollections, setExpandedCollections] = useState<Set<number>>(() => new Set());
  const [showAllCollections, setShowAllCollections] = useState<Set<number>>(() => new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());

  const storybookRootHref = useMemo(() => {
    const rootUrl = new URL(window.location.href);
    rootUrl.searchParams.delete('path');
    rootUrl.searchParams.set('statuses', 'modified;new;related');
    return rootUrl.toString();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!state) {
      setExpandedCollections(new Set());
      setShowAllCollections(new Set());
      return;
    }
    setExpandedCollections(new Set(state.collections.map((_, index) => index)));
    setShowAllCollections(new Set());
  }, [state]);

  if (!state) {
    return <Empty>Waiting for the agent to push a review…</Empty>;
  }

  const storyCount = new Set(state.collections.flatMap((collection) => collection.storyIds)).size;
  const createdAgo = state.createdAt ? formatCreatedAgo(state.createdAt, nowMs) : null;
  const areAllExpanded = state.collections.every((_, index) => expandedCollections.has(index));

  const toggleCollection = (index: number) => {
    setExpandedCollections((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };
  const markCollectionShowAll = (index: number) => {
    setShowAllCollections((previous) =>
      previous.has(index) ? previous : new Set(previous).add(index)
    );
  };

  const normalizedQuery = search.trim().toLowerCase();
  // Search narrows to the story level: a collection whose title matches keeps
  // all its stories, otherwise only the matching stories are shown. The
  // original index is kept so expand state and detail links stay correct.
  const visibleCollections = state.collections
    .map((collection, index) => {
      const titleMatch =
        !normalizedQuery || collection.title.toLowerCase().includes(normalizedQuery);
      const storyIds = titleMatch
        ? collection.storyIds
        : collection.storyIds.filter((storyId) =>
            storyMatchesQuery(storyId, storyInfo, normalizedQuery)
          );
      return { collection, index, storyIds };
    })
    .filter((entry) => entry.storyIds.length > 0);

  return (
    <Page>
      {isStale ? <StaleBanner /> : null}
      <ReviewHeader
        title={state.title}
        subtitle={
          <>
            <span>
              {storyCount} {storyCount === 1 ? 'story' : 'stories'} for quick review
              {createdAgo ? ` • ${createdAgo}` : ''}
            </span>
            <AICuratedBadge>
              <WandIcon />
              AI-curated
            </AICuratedBadge>
          </>
        }
        actions={
          <Button padding="small" asChild>
            <a href={storybookRootHref} target="_blank" rel="noreferrer">
              <StorybookIcon />
              View Storybook
            </a>
          </Button>
        }
        secondRow={
          <>
            <SearchField>
              <SearchIconWrap>
                <SearchIcon />
              </SearchIconWrap>
              <SearchInput
                type="search"
                aria-label="Find stories"
                placeholder="Find stories"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </SearchField>
            <IconButton
              variant="ghost"
              size="small"
              padding="small"
              ariaLabel={areAllExpanded ? 'Collapse all collections' : 'Expand all collections'}
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setExpandedCollections(
                  new Set(areAllExpanded ? [] : state.collections.map((_, index) => index))
                );
              }}
            >
              {areAllExpanded ? <CollapseIcon /> : <ExpandAltIcon />}
            </IconButton>
          </>
        }
      />

      <ListScroll>
        <ScrollArea vertical>
          <List>
            {visibleCollections.length === 0 ? (
              <NoResults>No collections match “{search.trim()}”.</NoResults>
            ) : (
              visibleCollections.map(({ collection, index, storyIds }) => {
                const isExpanded = expandedCollections.has(index);
                return (
                  <Card key={`${collection.title}-${index}`}>
                    <Collapsible
                      collapsed={!isExpanded}
                      summary={
                        <CardHead onClick={() => toggleCollection(index)}>
                          <CardTitle>{collection.title}</CardTitle>
                          <CardControls>
                            <CardCount>{storyIds.length}</CardCount>
                            <IconButton
                              variant="ghost"
                              size="small"
                              padding="small"
                              ariaLabel={
                                isExpanded
                                  ? `Collapse collection ${collection.title}`
                                  : `Expand collection ${collection.title}`
                              }
                              aria-expanded={isExpanded}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleCollection(index);
                              }}
                            >
                              <ToggleChevronIcon
                                style={{ transform: `rotate(${isExpanded ? -180 : 0}deg)` }}
                              />
                            </IconButton>
                          </CardControls>
                        </CardHead>
                      }
                    >
                      <CollectionGrid
                        storyIds={storyIds}
                        showAll={showAllCollections.has(index)}
                        onShowAll={() => markCollectionShowAll(index)}
                        storyInfo={storyInfo}
                        query={search}
                        getStoryHref={(storyId) =>
                          buildReviewChangesDetailHref({ collectionIndex: index, storyId })
                        }
                      />
                    </Collapsible>
                  </Card>
                );
              })
            )}
          </List>
        </ScrollArea>
      </ListScroll>
    </Page>
  );
};
