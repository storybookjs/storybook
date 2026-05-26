import React, { type FC, type ReactNode, useEffect, useState } from 'react';

import { Button, Collapsible, TabsView } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  ChevronSmallDownIcon,
  ChevronSmallUpIcon,
  FilterIcon,
  SearchIcon,
  StorybookIcon,
} from '@storybook/icons';

import { CollectionGrid, type StoryInfo } from '../components/CollectionGrid.tsx';
import { groupStoriesByComponent, prettifyComponentId } from '../review-grouping.ts';
import { buildReviewChangesDetailHref, type ReviewTab } from '../review-navigation.ts';
import type { ReviewCollection, ReviewState } from '../review-state.ts';

// A definite height (not `minHeight`) is what makes the page scrollable:
// the inner flex chain — Body → TabsView → TabPanel — needs a bounded height
// to resolve against so the TabsView's own ScrollArea can take over
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

const Heading = styled.h1({
  margin: 0,
  alignSelf: 'stretch',
  fontFamily: '"Nunito Sans", sans-serif',
  fontStyle: 'normal',
  fontWeight: 700,
  fontSize: 20,
  lineHeight: '24px',
  color: '#2E3338',
});

const HeaderMeta = styled.div({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
});

const DetailsText = styled.p({
  margin: 0,
  fontFamily: '"Nunito Sans", sans-serif',
  fontStyle: 'normal',
  fontWeight: 400,
  fontSize: 14,
  lineHeight: '20px',
  color: '#5C6570',
});

const BranchCode = styled.code({
  boxSizing: 'border-box',
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  padding: '3px 5px',
  background: '#F7FAFC',
  border: '1px solid #DDE0E3',
  borderRadius: 2,
  fontFamily: '"SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontStyle: 'normal',
  fontWeight: 400,
  fontSize: 12,
  lineHeight: '14px',
  color: '#2E3338',
  opacity: 0.9,
});

const Body = styled.div({
  flex: 1,
  minHeight: 0,
});

const TabPanelBody = styled.div({});

// Compact search row — the search field shares the row with optional
// trailing controls (e.g. the Components tab change-filter toggle).
const SearchRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 8,
  margin: '10px 12px',
});

const SearchField = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
  minHeight: 30,
  borderRadius: theme.appBorderRadius + 2,
  boxShadow: `${theme.button.border} 0 0 0 1px inset`,
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

const CollectionHead = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 12px 6px 16px',
  minHeight: 40,
  cursor: 'pointer',
});

const CollectionLabel = styled.strong({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: '"Nunito Sans", sans-serif',
  fontStyle: 'normal',
  fontWeight: 700,
  fontSize: 14,
  lineHeight: '20px',
  color: '#2E3338',
});

// The leading group segments of a component title ("Components /"), kept
// lighter so the component name itself stands out.
const ComponentPathPrefix = styled.span(({ theme }) => ({
  fontWeight: 400,
  color: theme.textMutedColor,
}));

const ClusterControls = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
  flexShrink: 0,
});

const ClusterHeadText = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  flex: 1,
  minWidth: 0,
});

const ClusterRationale = styled.span({
  fontFamily: '"Nunito Sans", sans-serif',
  fontStyle: 'normal',
  fontWeight: 400,
  fontSize: 12,
  lineHeight: '16px',
  color: '#5C6570',
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
  onToggleCluster: (index: number) => void;
}> = ({ collections, expanded, query, activeTab, storyInfo, onToggleCluster }) => {
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
                <CollectionHead onClick={() => onToggleCluster(index)}>
                  <ClusterHeadText>
                    <CollectionLabel>{collection.title}</CollectionLabel>
                    {collection.rationale ? (
                      <ClusterRationale>{collection.rationale}</ClusterRationale>
                    ) : null}
                  </ClusterHeadText>
                  <ClusterControls>
                    <CollectionCount>{storyIds.length}</CollectionCount>
                    <Button
                      variant="ghost"
                      size="small"
                      padding="small"
                      ariaLabel={isExpanded ? 'Collapse cluster' : 'Expand cluster'}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleCluster(index);
                      }}
                    >
                      {isExpanded ? <ChevronSmallUpIcon /> : <ChevronSmallDownIcon />}
                    </Button>
                  </ClusterControls>
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
                  <ClusterHeadText>{renderComponentTitle(name)}</ClusterHeadText>
                  <ClusterControls>
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
                      {isExpanded ? <ChevronSmallUpIcon /> : <ChevronSmallDownIcon />}
                    </Button>
                  </ClusterControls>
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
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('agent');

  useEffect(() => {
    if (!state) {
      return;
    }
    setExpandedClusters(new Set(state.collections.map((_, index) => index)));
    setExpandedComponents(
      new Set(groupStoriesByComponent(state.collections).map((group) => group.componentId))
    );
  }, [state]);

  if (!state) {
    return <Empty>Waiting for the agent to push a review…</Empty>;
  }

  return (
    <Page>
      <Header>
        <HeaderText>
          <Heading>{state.title}</Heading>
          {state.branchName ? (
            <HeaderMeta>
              <DetailsText>Showing unstaged changes on</DetailsText>
              <BranchCode>{state.branchName}</BranchCode>
            </HeaderMeta>
          ) : null}
        </HeaderText>
        <Button padding="small" asChild>
          <a href={window.location.href} target="_blank" rel="noreferrer">
            <StorybookIcon />
            Storybook
          </a>
        </Button>
      </Header>

      <Body>
        <TabsView
          selected={tab}
          onSelectionChange={(key) => setTab(key as ReviewTab)}
          panelProps={{ renderAllChildren: true }}
          tabs={[
            {
              id: 'collections',
              title: 'Collections',
              children: (
                <TabPanelBody>
                  <SearchRow>
                    <SearchBox value={search} onChange={setSearch} />
                  </SearchRow>
                  <CollectionsTab
                    collections={state.collections}
                    expanded={expandedClusters}
                    query={search}
                    activeTab={tab}
                    storyInfo={storyInfo}
                    onToggleCluster={(index) => {
                      setExpandedClusters((prev) => {
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
                </TabPanelBody>
              ),
            },
            {
              id: 'components',
              title: 'Components',
              children: (
                <TabPanelBody>
                  <SearchRow>
                    <SearchBox value={search} onChange={setSearch} />
                    <ToggleGroup>
                      <FilterToggle
                        type="button"
                        $selected={changeFilter === 'all'}
                        aria-pressed={changeFilter === 'all'}
                        onClick={() => setChangeFilter('all')}
                      >
                        Show all changes
                      </FilterToggle>
                      <FilterToggle
                        type="button"
                        $selected={changeFilter === 'agent'}
                        aria-pressed={changeFilter === 'agent'}
                        onClick={() => setChangeFilter('agent')}
                      >
                        Agent filtered
                      </FilterToggle>
                    </ToggleGroup>
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
                </TabPanelBody>
              ),
            },
          ]}
        />
      </Body>
    </Page>
  );
};
