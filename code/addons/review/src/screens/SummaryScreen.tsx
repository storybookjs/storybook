import React, { useEffect, useLayoutEffect, useMemo, useState, type FC } from 'react';

import {
  Badge,
  Button,
  Card,
  Collapsible,
  IconButton,
  Link,
  ScrollArea,
  ToggleButton,
} from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  CheckIcon,
  ChevronSmallDownIcon,
  CloseAltIcon,
  CollapseIcon,
  ExpandAltIcon,
  SearchIcon,
  StatusNewIcon,
  SweepIcon,
  WandIcon,
} from '@storybook/icons';

import { CollectionGrid, type StoryInfo } from '../components/CollectionGrid.tsx';
import { CopyButton } from '../components/CopyButton.tsx';
import { ReviewHeader } from '../components/ReviewHeader.tsx';
import { StaleBanner } from '../components/StaleBanner.tsx';
import { buildReviewStoryHref } from '../review-navigation.ts';
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
  flexDirection: 'column',
  gap: 16,
  alignItems: 'center',
  justifyContent: 'center',
  height: '100dvh',
  color: theme.color.defaultText,
  '& > div': {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
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
// Light: purple-on-lavender. Dark: lighter purple text on a dark tinted base.
const AICuratedBadge = styled(Badge)(({ theme }) => ({
  color: theme.base === 'dark' ? '#b07fdc' : '#723aa6',
  background: theme.base === 'dark' ? 'rgba(114,58,166,0.15)' : '#f5f0fa',
  boxShadow: `inset 0 0 0 1px ${theme.base === 'dark' ? 'rgba(114,58,166,0.35)' : '#e1d2ef'}`,
  svg: { marginTop: 0 },
}));

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
  /** Builds the (frozen) preview iframe src for a story thumbnail. */
  getStoryPreviewHref: (storyId: string) => string;
  /** When true, render the "this review may be stale" banner at the top. */
  isStale?: boolean;
  /** Keep summary preview iframes mounted while the overlay is hidden. */
  previewsPaused?: boolean;
  /** Clears the active review (if any) and returns to the last viewed story. */
  onDismiss: () => void;
}

export const SummaryScreen: FC<SummaryScreenProps> = ({
  state,
  storyInfo = {},
  getStoryPreviewHref,
  isStale = false,
  previewsPaused = false,
  onDismiss,
}) => {
  const [search, setSearch] = useState('');
  const [expandedCollections, setExpandedCollections] = useState<Set<number>>(() => new Set());
  const [showAllCollections, setShowAllCollections] = useState<Set<number>>(() => new Set());
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  useLayoutEffect(() => {
    if (!state) {
      setExpandedCollections(new Set());
      setShowAllCollections(new Set());
      return;
    }
    setExpandedCollections(new Set(state.collections.map((_, index) => index)));
    setShowAllCollections(new Set());
  }, [state]);

  // Must be computed before the early return — hooks cannot be called conditionally.
  const newStoryCount = useMemo(
    () =>
      new Set(
        (state?.collections ?? []).flatMap((c) => c.storyIds).filter((id) => storyInfo[id]?.isNew)
      ).size,
    [state, storyInfo]
  );

  const normalizedQuery = search.trim().toLowerCase();
  const visibleCollections = useMemo(
    () =>
      (state?.collections ?? [])
        .map((collection, index) => {
          const titleMatch =
            !normalizedQuery || collection.title.toLowerCase().includes(normalizedQuery);
          let storyIds = titleMatch
            ? collection.storyIds
            : collection.storyIds.filter((storyId) =>
                storyMatchesQuery(storyId, storyInfo, normalizedQuery)
              );
          if (showNewOnly) {
            storyIds = storyIds.filter((id) => storyInfo[id]?.isNew);
          }
          return { collection, index, storyIds };
        })
        .filter((entry) => entry.storyIds.length > 0),
    [state?.collections, normalizedQuery, showNewOnly, storyInfo]
  );

  if (!state) {
    return (
      <Empty>
        <span>Waiting for the agent to display a review…</span>
        <div>
          <CopyButton
            padding="small"
            ariaLabel="Copy prompt to refresh this review"
            ariaLabelOnCopy="Prompt copied to clipboard"
            content="Generate a Storybook review including my latest changes using the display-review tool."
            childrenOnCopy={
              <>
                <CheckIcon /> Copy prompt
              </>
            }
          >
            <WandIcon /> Copy prompt
          </CopyButton>
          <Button padding="small" onClick={onDismiss} ariaLabel="Close review screen">
            <CloseAltIcon />
            Close
          </Button>
        </div>
      </Empty>
    );
  }

  const storyCount = new Set(state.collections.flatMap((collection) => collection.storyIds)).size;
  const createdAgo = state.createdAt ? formatCreatedAgo(state.createdAt, nowMs) : null;

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

  return (
    <Page>
      {isStale ? <StaleBanner /> : null}
      <ReviewHeader
        title={state.title}
        subtitle={
          <>
            <AICuratedBadge>
              <WandIcon />
              AI-curated
            </AICuratedBadge>
            <span>
              {storyCount} {storyCount === 1 ? 'story' : 'stories'} for quick review
            </span>
            {createdAgo ? (
              <>
                <span>&bull;</span>
                <span>{createdAgo}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {newStoryCount > 0 ? (
              <ToggleButton
                variant="ghost"
                size="small"
                padding="small"
                ariaLabel={false}
                tooltip="Toggle filtering of new stories"
                pressed={showNewOnly}
                onClick={() => setShowNewOnly((v) => !v)}
              >
                <StatusNewIcon />
                {newStoryCount} new
              </ToggleButton>
            ) : null}
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
          </>
        }
      />

      <ListScroll>
        <ScrollArea vertical>
          <List>
            {visibleCollections.length === 0 ? (
              <NoResults>
                {showNewOnly && !search.trim()
                  ? 'No new stories found.'
                  : `No collections match “${search.trim()}”.`}
              </NoResults>
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
                          buildReviewStoryHref({ collectionIndex: index, storyId })
                        }
                        getStoryPreviewHref={getStoryPreviewHref}
                        previewsPaused={previewsPaused}
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
