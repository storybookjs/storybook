import React, { type FC, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Collapsible } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  ChevronSmallDownIcon,
  CollapseIcon,
  ExpandAltIcon,
  SearchIcon,
  StorybookIcon,
} from '@storybook/icons';

import { CollectionGrid, type StoryInfo } from '../components/CollectionGrid.tsx';
import { StaleBanner } from '../components/StaleBanner.tsx';
import { groupStoriesByComponent, prettifyComponentId } from '../review-grouping.ts';
import { buildReviewChangesDetailHref, type ReviewTab } from '../review-navigation.ts';
import type { ReviewCollection, ReviewState } from '../review-state.ts';

// A definite height (not `minHeight`) is what makes the page scrollable:
// the inner flex chain — Body → TabPanels → TabPanelBody — needs a bounded
// height to resolve against so the panel content can take over
// scrolling. `minHeight: 100vh` left the page free to grow taller than its
// container with nothing scrollable — hence the "can't scroll" bug. `100dvh`
// (matching DetailsScreen) fills the manager's page cell and also works in
// the addon's own fullscreen stories, where #storybook-root has no height.
const Page = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  minHeight: 0,
  overflow: 'hidden',
  background: theme.background.content,
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

const Header = styled.header({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 20,
  padding: '16px 16px 8px',
  minHeight: 72,
});

const HeaderText = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  flexGrow: 1,
  minWidth: 0,
});

const Heading = styled.h1(({ theme }) => ({
  margin: 0,
  alignSelf: 'stretch',
  fontSize: theme.typography.size.m1,
  fontWeight: theme.typography.weight.bold,
}));

const HeaderMeta = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  color: theme.textMutedColor,
}));

const Body = styled.div({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
});

const TabHeader = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  minHeight: 40,
}));
const TabButton = styled.button<{ $selected: boolean }>(({ theme, $selected }) => ({
  appearance: 'none',
  border: 0,
  borderBottom: `3px solid ${$selected ? theme.barSelectedColor : 'transparent'}`,
  background: 'transparent',
  color: $selected ? theme.barSelectedColor : theme.barTextColor,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  height: 40,
  padding: '0 15px',
  '&:hover': {
    color: $selected ? theme.barSelectedColor : theme.barHoverColor,
  },
  '&:focus-visible': {
    outline: '0 none',
    boxShadow: `inset 0 0 0 2px ${theme.barSelectedColor}`,
  },
}));
const TabPanels = styled.div(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  background: theme.background.app,
  overflow: 'hidden',
}));

const TabPanelBody = styled.div({
  height: '100%',
  minHeight: 0,
  overflow: 'auto',
});

// Compact search row — the search field shares the row with optional
// trailing controls (e.g. the Components tab change-filter toggle).
const SearchRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 8,
  margin: '10px 12px',
});

const SearchActions = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginLeft: 'auto',
});

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

const CollectionList = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const CollectionBlock = styled.section(({ theme }) => ({
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

// A plain clickable row, not a semantic control: making the whole header
// toggle is just a convenience affordance for pointer users. The real
// accessible control is the chevron <Button> inside, which carries the
// aria-label and aria-expanded state for assistive technologies.
const CollectionHead = styled.div(({ theme }) => ({
  display: 'flex',
  width: '100%',
  cursor: 'pointer',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: theme.background.app,
  containerType: 'scroll-state',
  containerName: 'sticky-heading',
}));

const CollectionHeadInner = styled.div(({ theme }) => ({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 12px',
  minHeight: 40,
  boxShadow: 'inset 0 -1px 0 transparent',
  '@container sticky-heading scroll-state(stuck: top)': {
    boxShadow: `0 1px 0 ${theme.appBorderColor}`,
  },
  '&:hover [data-collapsible-title], &:hover [data-collapsible-title] *': {
    color: theme.color.secondary,
  },
}));

const CollectionLabel = styled.strong(({ theme }) => ({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 700,
  lineHeight: '20px',
  color: theme.color.defaultText,
}));

// The leading group segments of a component title ("Components /"), kept
// lighter so the component name itself stands out.
const ComponentPathPrefix = styled.span(({ theme }) => ({
  fontWeight: 400,
  color: theme.textMutedColor,
}));

const CollectionControls = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
  flexShrink: 0,
});

const ToggleChevronIcon = styled(ChevronSmallDownIcon)({
  transition: 'transform 160ms ease',
});

const CollectionHeadText = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  flex: 1,
  minWidth: 0,
});

const CollectionRationale = styled.p(({ theme }) => ({
  color: theme.textMutedColor,
  margin: '0 12px 6px 12px',
}));

const CollectionCount = styled.span(({ theme }) => ({
  minWidth: 28,
  height: 20,
  fontFamily: '"SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontStyle: 'normal',
  fontWeight: 400,
  fontSize: 13,
  lineHeight: '20px',
  textAlign: 'center',
  color: theme.textMutedColor,
}));

const NoResults = styled.div(({ theme }) => ({
  color: theme.textMutedColor,
  padding: 16,
  fontSize: 14,
}));

// Renders a component title ("Components/Button") as a path with the leading
// group segments dimmed and the component name emphasised.
const renderComponentTitle = (title: string): ReactNode => {
  const parts = title
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  const last = parts.pop() ?? title;
  return (
    <CollectionLabel>
      {parts.length > 0 ? <ComponentPathPrefix>{parts.join(' / ')} / </ComponentPathPrefix> : null}
      {last}
    </CollectionLabel>
  );
};

// A story matches the search if its id, component title, or story name
// contains the query. Search narrows results down to this story level, so a
// collection/component is shown with only its matching stories.
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

const CollectionsTab: FC<{
  collections: ReviewCollection[];
  query: string;
  storyInfo: Record<string, StoryInfo>;
  expandedCollections: ReadonlySet<number>;
  showAllCollections: ReadonlySet<number>;
  onToggleCollection: (index: number) => void;
  onMarkCollectionShowAll: (index: number) => void;
}> = ({
  collections,
  query,
  storyInfo,
  expandedCollections,
  showAllCollections,
  onToggleCollection,
  onMarkCollectionShowAll,
}) => {
  const normalizedQuery = query.trim().toLowerCase();
  // Search narrows to the story level: a collection whose title matches keeps
  // all its stories, otherwise only the matching stories are shown. The
  // original collection index is kept so expand state and detail links stay
  // correct after filtering.
  const visibleCollections = collections
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

  if (visibleCollections.length === 0) {
    return <NoResults>No collections match “{query.trim()}”.</NoResults>;
  }

  return (
    <CollectionList>
      {visibleCollections.map(({ collection, index, storyIds }) => {
        const isExpanded = expandedCollections.has(index);

        return (
          <CollectionBlock key={`${collection.title}-${index}`}>
            <Collapsible
              collapsed={!isExpanded}
              summary={() => (
                <CollectionHead onClick={() => onToggleCollection(index)}>
                  <CollectionHeadInner>
                    <CollectionHeadText data-collapsible-title>
                      <CollectionLabel>{collection.title}</CollectionLabel>
                    </CollectionHeadText>
                    <CollectionControls>
                      <CollectionCount>{storyIds.length}</CollectionCount>
                      <Button
                        variant="ghost"
                        size="small"
                        padding="small"
                        ariaLabel={isExpanded ? 'Collapse cluster' : 'Expand cluster'}
                        aria-expanded={isExpanded}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleCollection(index);
                        }}
                      >
                        <ToggleChevronIcon
                          style={{ transform: `rotate(${isExpanded ? -180 : 0}deg)` }}
                        />
                      </Button>
                    </CollectionControls>
                  </CollectionHeadInner>
                </CollectionHead>
              )}
            >
              {collection.rationale ? (
                <CollectionRationale>{collection.rationale}</CollectionRationale>
              ) : null}
              <CollectionGrid
                storyIds={storyIds}
                showAll={showAllCollections.has(index)}
                onShowAll={() => onMarkCollectionShowAll(index)}
                storyInfo={storyInfo}
                query={query}
                getStoryHref={(storyId) =>
                  // The detail-route prefix encodes the detail *kind*, not the
                  // active tab: a collection detail must always be
                  // `collections/<index>/<story>` so it parses back with an
                  // index (using the active tab here would drop the index for
                  // the inactive panel and break navigation).
                  buildReviewChangesDetailHref(
                    {
                      kind: 'collection',
                      collectionIndex: index,
                      storyId,
                    },
                    'collections'
                  )
                }
              />
            </Collapsible>
          </CollectionBlock>
        );
      })}
    </CollectionList>
  );
};

const ComponentsTab: FC<{
  collections: ReviewCollection[];
  storyInfo: Record<string, StoryInfo>;
  query: string;
  expandedComponents: ReadonlySet<string>;
  showAllComponents: ReadonlySet<string>;
  onToggleComponent: (componentId: string) => void;
  onMarkComponentShowAll: (componentId: string) => void;
}> = ({
  collections,
  storyInfo,
  query,
  expandedComponents,
  showAllComponents,
  onToggleComponent,
  onMarkComponentShowAll,
}) => {
  const normalizedQuery = query.trim().toLowerCase();
  // Search narrows to the story level here too: a component whose name
  // matches keeps all its stories, otherwise only matching stories show.
  const visibleGroups = groupStoriesByComponent(collections)
    .map((group) => {
      const name = storyInfo[group.storyIds[0]]?.title ?? prettifyComponentId(group.componentId);
      const nameMatch =
        !normalizedQuery ||
        name.toLowerCase().includes(normalizedQuery) ||
        group.componentId.toLowerCase().includes(normalizedQuery);
      const storyIds = nameMatch
        ? group.storyIds
        : group.storyIds.filter((storyId) =>
            storyMatchesQuery(storyId, storyInfo, normalizedQuery)
          );
      return { group, name, storyIds };
    })
    .filter((entry) => entry.storyIds.length > 0);

  if (visibleGroups.length === 0) {
    return <NoResults>No components match “{query.trim()}”.</NoResults>;
  }

  return (
    <CollectionList>
      {visibleGroups.map(({ group, name, storyIds }) => {
        const isExpanded = expandedComponents.has(group.componentId);

        return (
          <CollectionBlock key={group.componentId}>
            <Collapsible
              collapsed={!isExpanded}
              summary={() => (
                <CollectionHead onClick={() => onToggleComponent(group.componentId)}>
                  <CollectionHeadInner>
                    <CollectionHeadText data-collapsible-title>
                      {renderComponentTitle(name)}
                    </CollectionHeadText>
                    <CollectionControls>
                      <CollectionCount>{storyIds.length}</CollectionCount>
                      <Button
                        variant="ghost"
                        size="small"
                        padding="small"
                        ariaLabel={isExpanded ? 'Collapse component' : 'Expand component'}
                        aria-expanded={isExpanded}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleComponent(group.componentId);
                        }}
                      >
                        <ToggleChevronIcon
                          style={{ transform: `rotate(${isExpanded ? -180 : 0}deg)` }}
                        />
                      </Button>
                    </CollectionControls>
                  </CollectionHeadInner>
                </CollectionHead>
              )}
            >
              <CollectionGrid
                storyIds={storyIds}
                showAll={showAllComponents.has(group.componentId)}
                onShowAll={() => onMarkComponentShowAll(group.componentId)}
                storyInfo={storyInfo}
                query={query}
                getStoryHref={(storyId) =>
                  // Component details always live under the `components/`
                  // prefix regardless of which tab is currently active, so the
                  // inactive panel's links stay valid.
                  buildReviewChangesDetailHref(
                    {
                      kind: 'component',
                      storyId,
                    },
                    'components'
                  )
                }
              />
            </Collapsible>
          </CollectionBlock>
        );
      })}
    </CollectionList>
  );
};

const SearchBox: FC<{
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}> = ({ value, onChange, onFocus, onBlur }) => (
  <SearchField>
    <SearchIconWrap>
      <SearchIcon />
    </SearchIconWrap>
    <SearchInput
      type="search"
      aria-label="Find stories"
      placeholder="Find stories"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  </SearchField>
);

const formatCreatedAgo = (createdAt: number, nowMs: number): string => {
  const elapsedMs = Math.max(0, nowMs - createdAt);
  if (elapsedMs < 60_000) {
    return 'Created just now.';
  }
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  const minuteLabel = elapsedMinutes === 1 ? 'minute' : 'minutes';
  return `Created ${elapsedMinutes} ${minuteLabel} ago.`;
};

export interface SummaryScreenProps {
  state: ReviewState | null;
  /** Tab to open initially — carried in the URL so the back button restores it. */
  initialTab?: ReviewTab;
  /** Optional callback to keep summary-tab URL in sync with tab switches. */
  onTabChange?: (tab: ReviewTab) => void;
  /** Story id → component title + name, resolved from the Storybook index. */
  storyInfo?: Record<string, StoryInfo>;
  /** When true, render the "this review may be stale" banner at the top. */
  isStale?: boolean;
}

export const SummaryScreen: FC<SummaryScreenProps> = ({
  state,
  initialTab = 'collections',
  onTabChange,
  storyInfo = {},
  isStale = false,
}) => {
  const [tab, setTab] = useState<ReviewTab>(initialTab);
  const [search, setSearch] = useState('');
  const [expandedCollections, setExpandedCollections] = useState<Set<number>>(() => new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(() => new Set());
  const [showAllCollections, setShowAllCollections] = useState<Set<number>>(() => new Set());
  const [showAllComponents, setShowAllComponents] = useState<Set<string>>(() => new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Focusing the search field reveals every thumbnail's info bar at once, so
  // labels are scannable while filtering (they otherwise only show on hover).
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const tabOrder: [ReviewTab, ReviewTab] = ['collections', 'components'];
  const tabRefs = useRef<Record<ReviewTab, HTMLButtonElement | null>>({
    collections: null,
    components: null,
  });
  const collectionsTabId = 'review-tab-collections';
  const componentsTabId = 'review-tab-components';
  const collectionsPanelId = 'review-tabpanel-collections';
  const componentsPanelId = 'review-tabpanel-components';
  const storybookRootHref = useMemo(() => {
    const rootUrl = new URL(window.location.href);
    rootUrl.searchParams.delete('path');
    rootUrl.searchParams.set('statuses', 'modified;new;related');
    return rootUrl.toString();
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!state) {
      setExpandedCollections(new Set());
      setExpandedComponents(new Set());
      setShowAllCollections(new Set());
      setShowAllComponents(new Set());
      return;
    }
    setExpandedCollections(new Set(state.collections.map((_, index) => index)));
    setExpandedComponents(
      new Set(groupStoriesByComponent(state.collections).map((g) => g.componentId))
    );
    setShowAllCollections(new Set());
    setShowAllComponents(new Set());
  }, [state]);

  if (!state) {
    return <Empty>Waiting for the agent to push a review…</Empty>;
  }

  const storyCount = new Set(state.collections.flatMap((collection) => collection.storyIds)).size;
  const createdAgo = state.createdAt ? formatCreatedAgo(state.createdAt, nowMs) : null;
  const componentIds = groupStoriesByComponent(state.collections).map((group) => group.componentId);
  const areAllCollectionsExpanded = state.collections.every((_, index) =>
    expandedCollections.has(index)
  );
  const areAllComponentsExpanded = componentIds.every((componentId) =>
    expandedComponents.has(componentId)
  );
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
  const toggleComponent = (componentId: string) => {
    setExpandedComponents((previous) => {
      const next = new Set(previous);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  };
  const markCollectionShowAll = (index: number) => {
    setShowAllCollections((previous) =>
      previous.has(index) ? previous : new Set(previous).add(index)
    );
  };
  const markComponentShowAll = (componentId: string) => {
    setShowAllComponents((previous) =>
      previous.has(componentId) ? previous : new Set(previous).add(componentId)
    );
  };
  const setActiveTab = (nextTab: ReviewTab) => {
    setTab(nextTab);
    onTabChange?.(nextTab);
  };
  const moveTabFocus = (nextTab: ReviewTab) => {
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: ReviewTab
  ) => {
    const currentIndex = tabOrder.indexOf(currentTab);
    let nextTab: ReviewTab | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        nextTab = tabOrder[(currentIndex - 1 + tabOrder.length) % tabOrder.length];
        break;
      case 'ArrowRight':
        nextTab = tabOrder[(currentIndex + 1) % tabOrder.length];
        break;
      case 'Home':
        nextTab = tabOrder[0];
        break;
      case 'End':
        nextTab = tabOrder[tabOrder.length - 1];
        break;
      default:
        break;
    }

    if (nextTab) {
      event.preventDefault();
      moveTabFocus(nextTab);
    }
  };

  return (
    <Page data-search-active={isSearchFocused || undefined}>
      {isStale ? <StaleBanner /> : null}
      <Header>
        <HeaderText>
          <Heading>{state.title}</Heading>
          <HeaderMeta>
            <span>
              Showing {storyCount} agent-curated {storyCount === 1 ? 'story' : 'stories'} for quick
              review.{createdAgo ? ` ${createdAgo}` : ''}
            </span>
          </HeaderMeta>
        </HeaderText>
        <Button padding="small" asChild>
          <a href={storybookRootHref} target="_blank" rel="noreferrer">
            <StorybookIcon />
            Storybook
          </a>
        </Button>
      </Header>

      <Body>
        <TabHeader role="tablist" aria-label="Review tabs">
          <TabButton
            id={collectionsTabId}
            type="button"
            role="tab"
            ref={(element) => {
              tabRefs.current.collections = element;
            }}
            $selected={tab === 'collections'}
            aria-selected={tab === 'collections'}
            aria-controls={collectionsPanelId}
            tabIndex={tab === 'collections' ? 0 : -1}
            onClick={() => setActiveTab('collections')}
            onKeyDown={(event) => handleTabKeyDown(event, 'collections')}
          >
            Collections
          </TabButton>
          <TabButton
            id={componentsTabId}
            type="button"
            role="tab"
            ref={(element) => {
              tabRefs.current.components = element;
            }}
            $selected={tab === 'components'}
            aria-selected={tab === 'components'}
            aria-controls={componentsPanelId}
            tabIndex={tab === 'components' ? 0 : -1}
            onClick={() => setActiveTab('components')}
            onKeyDown={(event) => handleTabKeyDown(event, 'components')}
          >
            Components
          </TabButton>
        </TabHeader>

        <TabPanels>
          <TabPanelBody
            id={collectionsPanelId}
            role="tabpanel"
            aria-labelledby={collectionsTabId}
            hidden={tab !== 'collections'}
          >
            <SearchRow>
              <SearchBox
                value={search}
                onChange={setSearch}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
              <SearchActions>
                <Button
                  variant="ghost"
                  size="small"
                  padding="small"
                  ariaLabel={
                    areAllCollectionsExpanded
                      ? 'Collapse all collections'
                      : 'Expand all collections'
                  }
                  onClick={() => {
                    setExpandedCollections(
                      new Set(
                        areAllCollectionsExpanded ? [] : state.collections.map((_, index) => index)
                      )
                    );
                  }}
                >
                  {areAllCollectionsExpanded ? <CollapseIcon /> : <ExpandAltIcon />}
                </Button>
              </SearchActions>
            </SearchRow>
            <CollectionsTab
              collections={state.collections}
              query={search}
              storyInfo={storyInfo}
              expandedCollections={expandedCollections}
              showAllCollections={showAllCollections}
              onToggleCollection={toggleCollection}
              onMarkCollectionShowAll={markCollectionShowAll}
            />
          </TabPanelBody>

          <TabPanelBody
            id={componentsPanelId}
            role="tabpanel"
            aria-labelledby={componentsTabId}
            hidden={tab !== 'components'}
          >
            <SearchRow>
              <SearchBox
                value={search}
                onChange={setSearch}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
              <SearchActions>
                <Button
                  variant="ghost"
                  size="small"
                  padding="small"
                  ariaLabel={
                    areAllComponentsExpanded ? 'Collapse all components' : 'Expand all components'
                  }
                  onClick={() => {
                    setExpandedComponents(new Set(areAllComponentsExpanded ? [] : componentIds));
                  }}
                >
                  {areAllComponentsExpanded ? <CollapseIcon /> : <ExpandAltIcon />}
                </Button>
              </SearchActions>
            </SearchRow>
            <ComponentsTab
              collections={state.collections}
              storyInfo={storyInfo}
              query={search}
              expandedComponents={expandedComponents}
              showAllComponents={showAllComponents}
              onToggleComponent={toggleComponent}
              onMarkComponentShowAll={markComponentShowAll}
            />
          </TabPanelBody>
        </TabPanels>
      </Body>
    </Page>
  );
};
