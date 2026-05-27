import React, { type FC, type ReactNode, useEffect, useMemo, useState } from 'react';

import { Button, Collapsible } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  ChevronSmallDownIcon,
  CollapseIcon,
  ExpandAltIcon,
  FilterIcon,
  SearchIcon,
  StorybookIcon,
} from '@storybook/icons';

import { CollectionGrid, type StoryInfo } from '../components/CollectionGrid.tsx';
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

const BranchCode = styled.code(({ theme }) => ({
  boxSizing: 'border-box',
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  padding: '3px 5px',
  background: '#F7FAFC',
  border: '1px solid #DDE0E3',
  borderRadius: 2,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
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
}));

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
}));

const SearchIconWrap = styled.span(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.textMutedColor,
  width: 22,
}));

const ToggleGroup = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
});

// State-only toggle (no filtering logic wired yet): selecting one option
// deselects the other.
const FilterToggle = styled.button<{ $selected: boolean }>(({ theme, $selected }) => ({
  appearance: 'none',
  cursor: 'pointer',
  border: `1px solid ${$selected ? theme.color.secondary : 'transparent'}`,
  borderRadius: theme.appBorderRadius + 2,
  padding: '5px 10px',
  fontFamily: theme.typography.fonts.base,
  fontSize: theme.typography.size.s1,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  background: $selected ? `${theme.color.secondary}1A` : 'transparent',
  color: $selected ? theme.color.secondary : theme.textMutedColor,
}));

const CollectionList = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const CollectionBlock = styled.section(({ theme }) => ({
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const CollectionHead = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 12px',
  minHeight: 40,
  cursor: 'pointer',
  '&:hover [data-collapsible-title], &:hover [data-collapsible-title] *': {
    color: theme.color.secondary,
  },
}));

const CollectionLabel = styled.strong({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 700,
  lineHeight: '20px',
  color: '#2E3338',
});

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

const CollectionRationale = styled.p({
  color: '#5C6570',
  margin: '0 12px 6px 12px',
});

const CollectionCount = styled.span({
  minWidth: 28,
  height: 20,
  fontFamily: '"SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontStyle: 'normal',
  fontWeight: 400,
  fontSize: 13,
  lineHeight: '20px',
  textAlign: 'center',
  color: '#5C6570',
});

const NoResults = styled.div(({ theme }) => ({
  color: theme.textMutedColor,
  padding: 16,
  fontSize: 14,
}));

type ChangeFilter = 'all' | 'agent';

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
  expanded: Set<number>;
  query: string;
  activeTab: ReviewTab;
  storyInfo: Record<string, StoryInfo>;
  onToggleCollection: (index: number) => void;
}> = ({ collections, expanded, query, activeTab, storyInfo, onToggleCollection }) => {
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
        const isExpanded = expanded.has(index);

        return (
          <CollectionBlock key={`${collection.title}-${index}`}>
            <Collapsible
              collapsed={!isExpanded}
              summary={() => (
                <CollectionHead onClick={() => onToggleCollection(index)}>
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
                </CollectionHead>
              )}
            >
              {collection.rationale ? (
                <CollectionRationale>{collection.rationale}</CollectionRationale>
              ) : null}
              <CollectionGrid
                storyIds={storyIds}
                storyInfo={storyInfo}
                query={query}
                getStoryHref={(storyId) =>
                  buildReviewChangesDetailHref(
                    {
                      kind: 'collection',
                      collectionIndex: index,
                      storyIndex: collection.storyIds.indexOf(storyId),
                    },
                    activeTab
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
  expanded: Set<string>;
  query: string;
  activeTab: ReviewTab;
  onToggleComponent: (componentId: string) => void;
}> = ({ collections, storyInfo, expanded, query, activeTab, onToggleComponent }) => {
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
        const isExpanded = expanded.has(group.componentId);

        return (
          <CollectionBlock key={group.componentId}>
            <Collapsible
              collapsed={!isExpanded}
              summary={() => (
                <CollectionHead onClick={() => onToggleComponent(group.componentId)}>
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
                </CollectionHead>
              )}
            >
              <CollectionGrid
                storyIds={storyIds}
                storyInfo={storyInfo}
                query={query}
                getStoryHref={(storyId) =>
                  buildReviewChangesDetailHref(
                    {
                      kind: 'component',
                      componentId: group.componentId,
                      storyIndex: group.storyIds.indexOf(storyId),
                    },
                    activeTab
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

const SearchBox: FC<{ value: string; onChange: (value: string) => void }> = ({
  value,
  onChange,
}) => (
  <SearchField>
    <SearchIconWrap>
      <SearchIcon />
    </SearchIconWrap>
    <SearchInput
      type="search"
      placeholder="Find stories"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    <Button variant="ghost" size="small" padding="small" ariaLabel="Filter stories">
      <FilterIcon />
    </Button>
  </SearchField>
);

export interface SummaryScreenProps {
  state: ReviewState | null;
  /** Tab to open initially — carried in the URL so the back button restores it. */
  initialTab?: ReviewTab;
  /** Story id → component title + name, resolved from the Storybook index. */
  storyInfo?: Record<string, StoryInfo>;
}

export const SummaryScreen: FC<SummaryScreenProps> = ({
  state,
  initialTab = 'collections',
  storyInfo = {},
}) => {
  const [tab, setTab] = useState<ReviewTab>(initialTab);
  const [expandedCollections, setExpandedCollections] = useState<Set<number>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const collectionsTabId = 'review-tab-collections';
  const componentsTabId = 'review-tab-components';
  const collectionsPanelId = 'review-tabpanel-collections';
  const componentsPanelId = 'review-tabpanel-components';
  const storybookRootHref = useMemo(() => {
    const rootUrl = new URL(window.location.href);
    rootUrl.searchParams.delete('path');
    return rootUrl.toString();
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }
    setExpandedCollections(new Set(state.collections.map((_, index) => index)));
    setExpandedComponents(
      new Set(groupStoriesByComponent(state.collections).map((group) => group.componentId))
    );
  }, [state]);

  if (!state) {
    return <Empty>Waiting for the agent to push a review…</Empty>;
  }

  const componentIds = groupStoriesByComponent(state.collections).map((group) => group.componentId);
  const areAllCollectionsExpanded = state.collections.every((_, index) =>
    expandedCollections.has(index)
  );
  const areAllComponentsExpanded = componentIds.every((componentId) =>
    expandedComponents.has(componentId)
  );

  return (
    <Page>
      <Header>
        <HeaderText>
          <Heading>{state.title}</Heading>
          {state.branchName ? (
            <HeaderMeta>
              <span>Showing unstaged changes on</span>
              <BranchCode>{state.branchName}</BranchCode>
            </HeaderMeta>
          ) : null}
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
            $selected={tab === 'collections'}
            aria-selected={tab === 'collections'}
            aria-controls={collectionsPanelId}
            tabIndex={tab === 'collections' ? 0 : -1}
            onClick={() => setTab('collections')}
          >
            Collections
          </TabButton>
          <TabButton
            id={componentsTabId}
            type="button"
            role="tab"
            $selected={tab === 'components'}
            aria-selected={tab === 'components'}
            aria-controls={componentsPanelId}
            tabIndex={tab === 'components' ? 0 : -1}
            onClick={() => setTab('components')}
          >
            Components
          </TabButton>
        </TabHeader>

        <TabPanels>
          <div
            id={collectionsPanelId}
            role="tabpanel"
            aria-labelledby={collectionsTabId}
            hidden={tab !== 'collections'}
          >
            <SearchRow>
              <SearchBox value={search} onChange={setSearch} />
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
                      areAllCollectionsExpanded
                        ? new Set()
                        : new Set(state.collections.map((_, index) => index))
                    );
                  }}
                >
                  {areAllCollectionsExpanded ? <CollapseIcon /> : <ExpandAltIcon />}
                </Button>
              </SearchActions>
            </SearchRow>
            <CollectionsTab
              collections={state.collections}
              expanded={expandedCollections}
              query={search}
              activeTab={tab}
              storyInfo={storyInfo}
              onToggleCollection={(index) => {
                setExpandedCollections((prev) => {
                  const next = new Set(prev);
                  if (next.has(index)) {
                    next.delete(index);
                  } else {
                    next.add(index);
                  }
                  return next;
                });
              }}
            />
          </div>

          <div
            id={componentsPanelId}
            role="tabpanel"
            aria-labelledby={componentsTabId}
            hidden={tab !== 'components'}
          >
            <SearchRow>
              <SearchBox value={search} onChange={setSearch} />
              <SearchActions>
                <Button
                  variant="ghost"
                  size="small"
                  padding="small"
                  ariaLabel={
                    areAllComponentsExpanded ? 'Collapse all components' : 'Expand all components'
                  }
                  onClick={() => {
                    setExpandedComponents(
                      areAllComponentsExpanded ? new Set() : new Set(componentIds)
                    );
                  }}
                >
                  {areAllComponentsExpanded ? <CollapseIcon /> : <ExpandAltIcon />}
                </Button>
              </SearchActions>
            </SearchRow>
            <ComponentsTab
              collections={state.collections}
              storyInfo={storyInfo}
              expanded={expandedComponents}
              query={search}
              activeTab={tab}
              onToggleComponent={(componentId) => {
                setExpandedComponents((prev) => {
                  const next = new Set(prev);
                  if (next.has(componentId)) {
                    next.delete(componentId);
                  } else {
                    next.add(componentId);
                  }
                  return next;
                });
              }}
            />
          </div>
        </TabPanels>
      </Body>
    </Page>
  );
};
