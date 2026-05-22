import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Collapsible, TabsView } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  ChevronSmallDownIcon,
  ChevronSmallUpIcon,
  CheckIcon,
  FilterIcon,
  SearchIcon,
  StorybookIcon,
} from '@storybook/icons';

import type { ReviewCollection, ReviewState } from '../review-state.ts';

const PREVIEW_SCALE = 0.5;

const Page = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  background: theme.background.content,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
}));

const Empty = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
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

const SearchRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 8,
  margin: 12,
});

const SearchField = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  minHeight: 34,
  borderRadius: theme.appBorderRadius + 2,
  boxShadow: `${theme.button.border} 0 0 0 1px inset`,
  paddingLeft: 8,
}));

const SearchInput = styled.input(({ theme }) => ({
  flex: 1,
  border: 0,
  background: 'transparent',
  outline: 0,
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s2,
  height: 30,
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
  width: 24,
}));

const ComponentsPlaceholder = styled.div(({ theme }) => ({
  color: theme.textMutedColor,
  padding: '8px 2px',
}));

const ClusterList = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const ClusterBlock = styled.section(({ theme }) => ({
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const ClusterHead = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 12px 6px 16px',
  minHeight: 40,
  cursor: 'pointer',
});

const ClusterLabel = styled.strong({
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

const ClusterControls = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
  flexGrow: 1,
});

const ClusterCount = styled.span({
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

const ClusterGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  padding: '0 12px 12px',
});

const GridCell = styled.div(({ theme }) => ({
  aspectRatio: '3 / 2',
  borderRadius: 6,
  overflow: 'hidden',
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
}));

const StoryPreview = styled.iframe({
  width: `${(1 / PREVIEW_SCALE) * 100}%`,
  height: `${(1 / PREVIEW_SCALE) * 100}%`,
  border: 0,
  display: 'block',
  transform: `scale(${PREVIEW_SCALE})`,
  transformOrigin: 'top left',
  pointerEvents: 'none',
});

const CellAction = styled.div({
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
});

type ReviewTab = 'collections' | 'components';

const storyPreviewUrl = (id: string) => `iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;

const StoryPreviewCell: React.FC<{ storyId: string }> = ({ storyId }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '100px 0px 100px 0px',
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <GridCell ref={hostRef}>
      {visible ? (
        <StoryPreview
          title={storyId}
          src={storyPreviewUrl(storyId)}
          loading="lazy"
          tabIndex={-1}
          scrolling="no"
        />
      ) : null}
    </GridCell>
  );
};

const CollectionsTab: React.FC<{
  collections: ReviewCollection[];
  expanded: Set<number>;
  onToggleCluster: (index: number) => void;
}> = ({ collections, expanded, onToggleCluster }) => (
  <ClusterList>
    {collections.map((collection, index) => {
      const isExpanded = expanded.has(index);
      const sampleCount = collection.storyIds.length;
      const gridStories = collection.storyIds.slice(0, 3);

      return (
        <ClusterBlock key={`${collection.title}-${index}`}>
          <Collapsible
            collapsed={!isExpanded}
            summary={() => (
              <ClusterHead onClick={() => onToggleCluster(index)}>
                <ClusterLabel>{collection.title}</ClusterLabel>
                <ClusterControls>
                  <ClusterCount>{sampleCount}</ClusterCount>
                  <Button
                    variant="ghost"
                    size="small"
                    padding="small"
                    ariaLabel="Mark cluster reviewed"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <CheckIcon />
                  </Button>
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
              </ClusterHead>
            )}
          >
            <ClusterGrid>
              {gridStories.map((storyId) => (
                <StoryPreviewCell key={storyId} storyId={storyId} />
              ))}
              {sampleCount > 3 && (
                <GridCell>
                  <CellAction>
                    <Button size="medium">Review all {sampleCount}</Button>
                  </CellAction>
                </GridCell>
              )}
            </ClusterGrid>
          </Collapsible>
        </ClusterBlock>
      );
    })}
  </ClusterList>
);

export interface ReviewChangesScreenProps {
  state: ReviewState | null;
}

export const ReviewChangesScreen: React.FC<ReviewChangesScreenProps> = ({ state }) => {
  const [tab, setTab] = useState<ReviewTab>('collections');
  const initialExpanded = useMemo(() => new Set([0]), []);
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(initialExpanded);

  useEffect(() => {
    if (!state) {
      return;
    }
    setExpandedClusters(new Set([0]));
    setTab('collections');
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
          tabs={[
            {
              id: 'collections',
              title: 'Collections',
              children: (
                <TabPanelBody>
                  <SearchRow>
                    <SearchField>
                      <SearchIconWrap>
                        <SearchIcon />
                      </SearchIconWrap>
                      <SearchInput type="search" placeholder="Find stories" />
                      <Button
                        variant="ghost"
                        size="small"
                        padding="small"
                        ariaLabel="Filter stories"
                      >
                        <FilterIcon />
                      </Button>
                    </SearchField>
                  </SearchRow>
                  <CollectionsTab
                    collections={state.collections}
                    expanded={expandedClusters}
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
                    <SearchField>
                      <SearchIconWrap>
                        <SearchIcon />
                      </SearchIconWrap>
                      <SearchInput type="search" placeholder="Find stories" />
                      <Button
                        variant="ghost"
                        size="small"
                        padding="small"
                        ariaLabel="Filter stories"
                      >
                        <FilterIcon />
                      </Button>
                    </SearchField>
                  </SearchRow>
                  <ComponentsPlaceholder>Components view coming soon.</ComponentsPlaceholder>
                </TabPanelBody>
              ),
            },
          ]}
        />
      </Body>
    </Page>
  );
};
