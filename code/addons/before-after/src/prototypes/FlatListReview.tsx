/**
 * Prototype A — flat-list review page (no AI categorisation).
 *
 * Represents the deterministic-only iteration-1 fork: list every flagged
 * story grouped by status only, no clusters, latest-only preview iframe.
 * Filterable by status + searchable by ID/title.
 */
import React, { useMemo, useState } from 'react';

import { styled } from 'storybook/theming';

import { LazyStoryFrame } from './LazyStoryFrame.tsx';
import {
  type MockCluster,
  type MockReviewData,
  type MockStory,
  type StoryStatus,
  statusColors,
  statusLabel,
} from './mockData.ts';

interface FlatListReviewProps {
  data: MockReviewData;
  initialGroupBy?: 'status' | 'cluster';
}

const Page = styled.div(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  color: theme.color.defaultText,
  background: theme.background.app,
  minHeight: '100vh',
}));

const TopBar = styled.div(({ theme }) => ({
  padding: '16px 24px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 10,
}));

const TopBarRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
});

const Title = styled.h1(({ theme }) => ({
  fontSize: 18,
  margin: 0,
  color: theme.color.darker,
}));

const ChangedFile = styled.code(({ theme }) => ({
  fontSize: 12,
  color: theme.color.mediumdark,
  fontFamily: theme.typography.fonts.mono,
  background: theme.background.hoverable,
  padding: '3px 8px',
  borderRadius: 4,
}));

const Counts = styled.div(({ theme }) => ({
  display: 'flex',
  gap: 12,
  marginLeft: 'auto',
  fontSize: 12,
  color: theme.color.mediumdark,
}));

const CountChip = styled.span<{ kind: StoryStatus }>(({ kind }) => ({
  background: statusColors[kind].bg,
  color: statusColors[kind].fg,
  padding: '3px 10px',
  borderRadius: 999,
  fontWeight: 600,
}));

const SearchRow = styled.div({
  display: 'flex',
  gap: 12,
  alignItems: 'center',
});

const SearchInput = styled.input(({ theme }) => ({
  flex: 1,
  padding: '7px 12px',
  fontSize: 13,
  borderRadius: 4,
  border: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  color: theme.color.defaultText,
  outline: 'none',
  '&:focus': { borderColor: theme.color.secondary },
}));

const FilterChip = styled.button<{ active: boolean; kind?: StoryStatus }>(
  ({ theme, active, kind }) => ({
    border: `1px solid ${active ? theme.color.secondary : theme.color.border}`,
    background: active
      ? kind
        ? statusColors[kind].bg
        : theme.background.hoverable
      : theme.background.content,
    color: active ? (kind ? statusColors[kind].fg : theme.color.darker) : theme.color.mediumdark,
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    '&:hover': { borderColor: theme.color.secondary },
  })
);

const Content = styled.div({
  padding: 24,
  maxWidth: 1100,
  margin: '0 auto',
});

const Section = styled.section({ marginBottom: 32 });

const SectionTitle = styled.h2(({ theme }) => ({
  fontSize: 14,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: theme.color.mediumdark,
  margin: '0 0 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}));

const SectionCount = styled.span<{ kind: StoryStatus }>(({ kind }) => ({
  background: statusColors[kind].bg,
  color: statusColors[kind].fg,
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
}));

const StoryGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 16,
});

const StoryCard = styled.div(({ theme }) => ({
  background: theme.background.content,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 6,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column' as const,
  cursor: 'pointer',
  transition: 'transform 0.1s, box-shadow 0.1s',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
}));

const StoryHeader = styled.div(({ theme }) => ({
  padding: '10px 14px',
  borderBottom: `1px solid ${theme.color.border}`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}));

const StoryTitle = styled.div(({ theme }) => ({
  flex: 1,
  fontSize: 13,
  fontWeight: 600,
  color: theme.color.darker,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}));

const StoryName = styled.span(({ theme }) => ({
  color: theme.color.mediumdark,
  fontWeight: 400,
}));

const StatusBadge = styled.span<{ kind: StoryStatus }>(({ kind }) => ({
  background: statusColors[kind].bg,
  color: statusColors[kind].fg,
  padding: '2px 7px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
}));

const PreviewFrame = styled.iframe(({ theme }) => ({
  width: '100%',
  height: 180,
  border: 'none',
  background: theme.background.content,
}));

const StoryPath = styled.div(({ theme }) => ({
  padding: '8px 14px',
  fontFamily: theme.typography.fonts.mono,
  fontSize: 11,
  color: theme.color.mediumdark,
  background: theme.background.hoverable,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}));

const Empty = styled.div(({ theme }) => ({
  padding: 40,
  textAlign: 'center' as const,
  color: theme.color.mediumdark,
  fontSize: 13,
  background: theme.background.content,
  border: `1px dashed ${theme.color.border}`,
  borderRadius: 6,
}));

const Banner = styled.div(({ theme }) => ({
  background: '#fffbeb',
  border: '1px solid #fde68a',
  color: '#92400e',
  padding: '8px 14px',
  borderRadius: 4,
  fontSize: 12,
  marginBottom: 16,
}));

type Filter = 'all' | StoryStatus;

function groupByStatus(stories: MockStory[]): Record<StoryStatus, MockStory[]> {
  return {
    new: stories.filter((s) => s.status === 'new'),
    modified: stories.filter((s) => s.status === 'modified'),
    related: stories.filter((s) => s.status === 'related'),
  };
}

export function FlatListReview({ data, initialGroupBy = 'status' }: FlatListReviewProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'status' | 'cluster'>(initialGroupBy);

  const filteredStories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.stories.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (!q) return true;
      return (
        s.storyId.includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
      );
    });
  }, [data.stories, filter, query]);

  const grouped = useMemo(() => groupByStatus(filteredStories), [filteredStories]);

  const renderStoryCard = (s: MockStory) => (
    <StoryCard key={s.storyId}>
      <StoryHeader>
        <StoryTitle>
          {s.title} <StoryName>/ {s.name}</StoryName>
        </StoryTitle>
        <StatusBadge kind={s.status}>{statusLabel[s.status]}</StatusBadge>
      </StoryHeader>
      <LazyStoryFrame
        storyId={s.storyId}
        title={`${s.title} / ${s.name}`}
        subtitle={s.importPath.split('/').pop()}
        priority={s.status === 'new' ? 'high' : s.status === 'modified' ? 'high' : 'low'}
        style={{ width: '100%', height: 180 }}
      />
      <StoryPath title={s.importPath}>{s.importPath.replace(/^\.\//, '')}</StoryPath>
    </StoryCard>
  );

  const renderSection = (kind: StoryStatus) => {
    const items = grouped[kind];
    if (items.length === 0) return null;
    return (
      <Section key={kind}>
        <SectionTitle>
          {statusLabel[kind]}
          <SectionCount kind={kind}>{items.length}</SectionCount>
        </SectionTitle>
        <StoryGrid>{items.map(renderStoryCard)}</StoryGrid>
      </Section>
    );
  };

  /** Group filteredStories into cluster sections using the data.clusters
   *  shape — a story is placed in the FIRST cluster whose sample contains
   *  its id (the actual production system uses signature expansion; the
   *  prototype short-circuits via the sample list). */
  const renderClusterSections = () => {
    const idToCluster = new Map<string, MockCluster>();
    for (const c of data.clusters) {
      for (const s of c.sampleStories)
        if (!idToCluster.has(s.storyId)) idToCluster.set(s.storyId, c);
    }
    const buckets = new Map<string, MockStory[]>();
    const orderedIds: string[] = [];
    const uncategorised: MockStory[] = [];
    for (const s of filteredStories) {
      const c = idToCluster.get(s.storyId);
      if (!c) {
        uncategorised.push(s);
        continue;
      }
      if (!buckets.has(c.id)) {
        buckets.set(c.id, []);
        orderedIds.push(c.id);
      }
      buckets.get(c.id)!.push(s);
    }
    return (
      <>
        {orderedIds.map((cid) => {
          const cluster = data.clusters.find((c) => c.id === cid)!;
          const items = buckets.get(cid)!;
          return (
            <Section key={cid}>
              <SectionTitle style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <span>
                  <strong style={{ color: '#0f172a' }}>{cluster.id}</strong>
                  {cluster.depthHint !== undefined && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        fontWeight: 700,
                        background: '#dbeafe',
                        color: '#1d4ed8',
                        padding: '2px 7px',
                        borderRadius: 999,
                        textTransform: 'uppercase',
                      }}
                    >
                      depth {cluster.depthHint}
                    </span>
                  )}
                  <SectionCount kind="modified" style={{ marginLeft: 8 }}>
                    {items.length} of {cluster.totalStoryCount}
                  </SectionCount>
                </span>
                <span
                  style={{ fontSize: 12, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
                >
                  {cluster.rationale}
                </span>
              </SectionTitle>
              <StoryGrid>{items.map(renderStoryCard)}</StoryGrid>
            </Section>
          );
        })}
        {uncategorised.length > 0 && (
          <Section>
            <SectionTitle>
              Uncategorised
              <SectionCount kind="related">{uncategorised.length}</SectionCount>
            </SectionTitle>
            <StoryGrid>{uncategorised.map(renderStoryCard)}</StoryGrid>
          </Section>
        )}
      </>
    );
  };

  return (
    <Page>
      <TopBar>
        <TopBarRow>
          <Title>Review changes</Title>
          <ChangedFile>{data.changedFile}</ChangedFile>
          <Counts>
            <CountChip kind="new">{data.newCount} new</CountChip>
            <CountChip kind="modified">{data.modifiedCount} modified</CountChip>
            <CountChip kind="related">{data.relatedCount} related</CountChip>
          </Counts>
          <span
            style={{
              marginLeft: 16,
              fontSize: 11,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
            }}
          >
            Group by
          </span>
          <FilterChip active={groupBy === 'status'} onClick={() => setGroupBy('status')}>
            Status
          </FilterChip>
          <FilterChip active={groupBy === 'cluster'} onClick={() => setGroupBy('cluster')}>
            Clusters ({data.clusters.length})
          </FilterChip>
        </TopBarRow>
        <SearchRow>
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All ({data.cascadeSize})
          </FilterChip>
          <FilterChip active={filter === 'new'} kind="new" onClick={() => setFilter('new')}>
            New ({data.newCount})
          </FilterChip>
          <FilterChip
            active={filter === 'modified'}
            kind="modified"
            onClick={() => setFilter('modified')}
          >
            Modified ({data.modifiedCount})
          </FilterChip>
          <FilterChip
            active={filter === 'related'}
            kind="related"
            onClick={() => setFilter('related')}
          >
            Related ({data.relatedCount})
          </FilterChip>
          <SearchInput
            placeholder="Search by story ID or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </SearchRow>
      </TopBar>
      <Content>
        <Banner>
          <strong>Prototype</strong> — flat-list review with no AI grouping. Showing{' '}
          {data.stories.length} of {data.cascadeSize} stories in this cascade (real eval would show
          all of them; this prototype uses a representative sample). Preview iframes are live and
          render against the dogfood UI.
        </Banner>
        {filteredStories.length === 0 ? (
          <Empty>No stories match this filter.</Empty>
        ) : groupBy === 'cluster' ? (
          renderClusterSections()
        ) : (
          (['modified', 'new', 'related'] as StoryStatus[]).map(renderSection)
        )}
      </Content>
    </Page>
  );
}
