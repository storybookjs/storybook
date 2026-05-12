/**
 * Prototype E — HubReview (cluster rail + focused pane + persistent state).
 *
 * UX analysis of the previous four prototypes that motivated this one:
 *
 *  FlatList — familiar list metaphor, but 1,025 cards = infinite scroll;
 *    no priority signal beyond status; no review state; cognitively
 *    expensive (every story is a decision).
 *  Clustered — agent grouping is great (1,025 → 6) but the zoom-out/
 *    zoom-in two-step is friction; when zoomed in you lose other clusters'
 *    context; representative-only previews can mislead when a cluster is
 *    heterogeneous.
 *  Focused — full-width preview is right for page-level stories and
 *    sequential walks eliminate decision fatigue, but you have no spatial
 *    sense of where you are in the larger structure, and 1,000 stories is
 *    a long linear walk.
 *  Layered (2D) — gives spatial context (peek strips + active) but is
 *    cognitively novel; two axes can be confusing; competes for attention
 *    between header, active card, and peek bars.
 *
 *  Cross-cutting problems they all share:
 *    • No persistent review state (once you walk past a story, it's gone).
 *    • No progress indication ("how much is left?").
 *    • iframes inline → small in grid prototypes, hard to skim in cascade.
 *    • Each prototype picks one perspective (overview OR focused) and
 *      forces the user to context-switch to see the other.
 *
 * HubReview fixes those by adopting the well-known split-pane "explorer +
 * editor" pattern that VS Code, Finder, Mail clients have trained users
 * on:
 *
 *  • LEFT RAIL — always-visible cluster list, expandable to story rows.
 *    Per-cluster progress bar (X of N reviewed). Reviewed stories
 *    visually de-emphasised. Click anywhere → focus jumps to that story.
 *    Sidebar gives you the zoom-out perspective at all times.
 *
 *  • MAIN PANE — focused single-story preview at full width (the right
 *    answer for page-level stories from FocusedReview), with Latest ↔
 *    Baseline toggle, viewport selector, prev/next within current
 *    cluster, "mark reviewed + auto-advance" primary action.
 *
 *  • TOP BAR — global progress: "47 of 1,025 reviewed (4.6%)", changed
 *    file, "hide reviewed" toggle to trim the rail to remaining work.
 *
 *  • KEYBOARD — familiar j/k or arrows for next/prev, m to mark
 *    reviewed, b to toggle baseline, 1–9 to jump cluster.
 *
 * Both perspectives (cluster vs flat) live in the rail simultaneously
 * via the "Group" toggle — no mode-switch required to see one or the
 * other.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { styled } from 'storybook/theming';

import {
  type MockCluster,
  type MockReviewData,
  type MockStory,
  type StoryStatus,
  statusColors,
  statusLabel,
} from './mockData.ts';

interface HubReviewProps {
  data: MockReviewData;
  initialStoryId?: string;
  initialGroupBy?: 'cluster' | 'status';
}

type ViewportPreset = 'auto' | 'mobile' | 'tablet' | 'desktop';
const VIEWPORT_WIDTHS: Record<ViewportPreset, number | null> = {
  auto: null,
  mobile: 414,
  tablet: 834,
  desktop: 1440,
};

// ──────────────────────────────────────────────────────────────────
// Styled
// ──────────────────────────────────────────────────────────────────

const Page = styled.div(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  color: theme.color.defaultText,
  background: theme.background.app,
  height: '100vh',
  display: 'grid',
  gridTemplateRows: '48px 1fr',
  gridTemplateColumns: '320px 1fr',
  gridTemplateAreas: `
    "top top"
    "rail main"
  `,
  overflow: 'hidden',
}));

const TopBar = styled.div(({ theme }) => ({
  gridArea: 'top',
  padding: '0 16px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 13,
}));

const TopTitle = styled.div(({ theme }) => ({
  fontWeight: 700,
  color: theme.color.darker,
}));

const ChangedFile = styled.code(({ theme }) => ({
  fontSize: 11,
  color: theme.color.mediumdark,
  fontFamily: theme.typography.fonts.mono,
  background: theme.background.hoverable,
  padding: '2px 6px',
  borderRadius: 4,
}));

const ProgressGroup = styled.div({
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
});

const ProgressBar = styled.div(({ theme }) => ({
  width: 180,
  height: 6,
  background: theme.background.hoverable,
  borderRadius: 999,
  overflow: 'hidden',
}));

const ProgressFill = styled.div<{ pct: number }>(({ theme, pct }) => ({
  height: '100%',
  width: `${pct}%`,
  background: theme.color.secondary,
  transition: 'width 0.25s ease-out',
}));

const ProgressText = styled.span(({ theme }) => ({
  fontSize: 12,
  color: theme.color.mediumdark,
  fontVariantNumeric: 'tabular-nums' as const,
}));

const ToggleChip = styled.button<{ active?: boolean }>(({ theme, active }) => ({
  border: `1px solid ${active ? theme.color.secondary : theme.color.border}`,
  background: active ? theme.background.hoverable : theme.background.content,
  color: active ? theme.color.darker : theme.color.mediumdark,
  borderRadius: 4,
  padding: '4px 10px',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover': { borderColor: theme.color.secondary },
}));

// ── Left rail ────────────────────────────────────────────────────────

const Rail = styled.aside(({ theme }) => ({
  gridArea: 'rail',
  borderRight: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
}));

const RailHeader = styled.div(({ theme }) => ({
  padding: '8px 12px',
  borderBottom: `1px solid ${theme.color.border}`,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  fontWeight: 700,
  color: theme.color.mediumdark,
}));

const RailScroll = styled.div({
  flex: 1,
  overflowY: 'auto',
});

const ClusterRow = styled.div(({ theme }) => ({
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
}));

const ClusterHeaderBtn = styled.button<{ expanded: boolean; complete: boolean }>(
  ({ theme, expanded, complete }) => ({
    width: '100%',
    background: expanded ? theme.background.hoverable : 'transparent',
    border: 'none',
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    opacity: complete ? 0.55 : 1,
    '&:hover': { background: theme.background.hoverable },
  })
);

const ClusterRowTop = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12.5,
});

const ClusterName = styled.span(({ theme }) => ({
  fontWeight: 600,
  color: theme.color.darker,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}));

const DepthBadge = styled.span<{ depth: number }>(({ depth }) => {
  const colors = ['#fee2e2', '#fef3c7', '#dbeafe', '#f1f5f9'];
  const fgs = ['#b91c1c', '#b45309', '#1d4ed8', '#64748b'];
  const idx = Math.min(Math.max(depth - 1, 0), colors.length - 1);
  return {
    background: colors[idx],
    color: fgs[idx],
    fontSize: 9,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 999,
    textTransform: 'uppercase' as const,
  };
});

const ClusterRowProgress = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const RailProgressBar = styled.div(({ theme }) => ({
  flex: 1,
  height: 3,
  background: theme.background.hoverable,
  borderRadius: 999,
  overflow: 'hidden',
}));

const RailProgressFill = styled.div<{ pct: number; complete: boolean }>(
  ({ theme, pct, complete }) => ({
    height: '100%',
    width: `${pct}%`,
    background: complete ? '#15803d' : theme.color.secondary,
    transition: 'width 0.2s ease-out',
  })
);

const RailProgressLabel = styled.span(({ theme }) => ({
  fontSize: 10.5,
  color: theme.color.mediumdark,
  fontVariantNumeric: 'tabular-nums' as const,
  minWidth: 36,
  textAlign: 'right' as const,
}));

const ClusterRationale = styled.div(({ theme }) => ({
  fontSize: 11,
  color: theme.color.mediumdark,
  lineHeight: 1.35,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
}));

const StoryList = styled.ul({
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

const StoryRowBtn = styled.button<{ active: boolean; reviewed: boolean }>(
  ({ theme, active, reviewed }) => ({
    width: '100%',
    border: 'none',
    background: active ? theme.background.hoverable : 'transparent',
    borderLeft: `3px solid ${active ? theme.color.secondary : 'transparent'}`,
    padding: '6px 12px 6px 16px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: reviewed ? theme.color.mediumdark : theme.color.darker,
    textDecoration: reviewed ? 'line-through' : 'none',
    opacity: reviewed ? 0.55 : 1,
    '&:hover': { background: theme.background.hoverable },
  })
);

const ReviewedDot = styled.span<{ reviewed: boolean }>(({ theme, reviewed }) => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  border: `1.5px solid ${reviewed ? '#15803d' : theme.color.border}`,
  background: reviewed ? '#15803d' : 'transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontSize: 8,
  flexShrink: 0,
}));

const StatusPill = styled.span<{ kind: StoryStatus }>(({ kind }) => ({
  background: statusColors[kind].bg,
  color: statusColors[kind].fg,
  fontSize: 9,
  fontWeight: 700,
  padding: '1px 5px',
  borderRadius: 4,
  textTransform: 'uppercase' as const,
  flexShrink: 0,
}));

const StoryRowText = styled.span({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
});

// ── Main pane ────────────────────────────────────────────────────────

const Main = styled.section(({ theme }) => ({
  gridArea: 'main',
  display: 'flex',
  flexDirection: 'column' as const,
  background: theme.background.app,
  overflow: 'hidden',
}));

const MainHeader = styled.div(({ theme }) => ({
  padding: '10px 20px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap' as const,
}));

const MainTitle = styled.div(({ theme }) => ({
  fontSize: 15,
  fontWeight: 700,
  color: theme.color.darker,
}));

const MainSubtitle = styled.code(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontSize: 11.5,
  color: theme.color.mediumdark,
}));

const MainToolbar = styled.div(({ theme }) => ({
  padding: '8px 20px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap' as const,
  fontSize: 12,
  color: theme.color.mediumdark,
}));

const SegGroup = styled.div(({ theme }) => ({
  display: 'inline-flex',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  overflow: 'hidden',
  background: theme.background.app,
}));

const SegButton = styled.button<{ active: boolean }>(({ theme, active }) => ({
  background: active ? theme.background.content : 'transparent',
  color: active ? theme.color.darker : theme.color.mediumdark,
  border: 'none',
  borderRight: `1px solid ${theme.color.border}`,
  cursor: 'pointer',
  padding: '4px 10px',
  fontSize: 11.5,
  fontWeight: 600,
  '&:last-child': { borderRight: 'none' },
  '&:hover': { background: theme.background.hoverable },
}));

const Stage = styled.div({
  flex: 1,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 20,
  overflow: 'auto',
  minHeight: 0,
});

const Frame = styled.iframe<{ widthPx: number | null }>(({ theme, widthPx }) => ({
  width: widthPx ? `${widthPx}px` : '100%',
  maxWidth: '100%',
  height: '100%',
  minHeight: 400,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 6,
  background: theme.background.content,
  display: 'block',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
}));

const BaselineBox = styled.div<{ widthPx: number | null }>(({ theme, widthPx }) => ({
  width: widthPx ? `${widthPx}px` : '100%',
  maxWidth: '100%',
  height: '100%',
  minHeight: 400,
  border: `2px dashed ${theme.color.border}`,
  borderRadius: 6,
  background: theme.background.hoverable,
  color: theme.color.mediumdark,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  gap: 8,
  padding: 24,
  textAlign: 'center' as const,
}));

const Footer = styled.div(({ theme }) => ({
  padding: '8px 20px',
  borderTop: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap' as const,
}));

const FootBtn = styled.button<{ primary?: boolean }>(({ theme, primary }) => ({
  background: primary ? theme.color.secondary : theme.background.content,
  color: primary ? theme.color.lightest : theme.color.defaultText,
  border: `1px solid ${primary ? theme.color.secondary : theme.color.border}`,
  borderRadius: 4,
  padding: '6px 14px',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
  '&:hover:not(:disabled)': {
    filter: primary ? 'brightness(1.05)' : undefined,
    background: primary ? undefined : theme.background.hoverable,
  },
}));

const Kbd = styled.kbd(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontSize: 10,
  border: `1px solid ${theme.color.border}`,
  background: theme.background.app,
  borderRadius: 3,
  padding: '1px 5px',
  margin: '0 3px',
  color: theme.color.darker,
}));

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

interface RailRow {
  id: string;
  title: string;
  rationale: string;
  depthHint?: number;
  totalInCluster: number;
  stories: MockStory[];
  statusKind?: StoryStatus;
}

function clustersToRailRows(clusters: MockCluster[]): RailRow[] {
  return clusters.map((c) => ({
    id: c.id,
    title: c.id,
    rationale: c.rationale,
    depthHint: c.depthHint,
    totalInCluster: c.totalStoryCount,
    stories: c.sampleStories,
  }));
}

function statusGroupsToRailRows(stories: MockStory[]): RailRow[] {
  const groups: Record<StoryStatus, MockStory[]> = {
    new: stories.filter((s) => s.status === 'new'),
    modified: stories.filter((s) => s.status === 'modified'),
    related: stories.filter((s) => s.status === 'related'),
  };
  const out: RailRow[] = [];
  for (const kind of ['modified', 'new', 'related'] as StoryStatus[]) {
    const g = groups[kind];
    if (g.length === 0) continue;
    out.push({
      id: `status-${kind}`,
      title: statusLabel[kind] + ' stories',
      rationale: `All ${g.length} ${statusLabel[kind].toLowerCase()} stories in this cascade.`,
      totalInCluster: g.length,
      stories: g,
      statusKind: kind,
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────

export function HubReview({ data, initialStoryId, initialGroupBy = 'cluster' }: HubReviewProps) {
  const [groupBy, setGroupBy] = useState<'cluster' | 'status'>(initialGroupBy);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [hideReviewed, setHideReviewed] = useState(false);
  const [side, setSide] = useState<'latest' | 'baseline'>('latest');
  const [viewport, setViewport] = useState<ViewportPreset>('auto');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo<RailRow[]>(
    () =>
      groupBy === 'cluster'
        ? clustersToRailRows(data.clusters)
        : statusGroupsToRailRows(data.stories),
    [groupBy, data]
  );

  // All stories in the order they appear in the rail — drives prev/next.
  const orderedStories = useMemo(() => rows.flatMap((r) => r.stories), [rows]);

  const [activeStoryId, setActiveStoryId] = useState<string>(
    () => initialStoryId ?? orderedStories[0]?.storyId ?? ''
  );

  // Expand the cluster containing the active story by default.
  useEffect(() => {
    const owner = rows.find((r) => r.stories.some((s) => s.storyId === activeStoryId));
    if (owner) {
      setExpanded((prev) => {
        if (prev.has(owner.id)) return prev;
        const next = new Set(prev);
        next.add(owner.id);
        return next;
      });
    }
  }, [activeStoryId, rows]);

  const activeStory = orderedStories.find((s) => s.storyId === activeStoryId) ?? orderedStories[0];
  const activeIdx = orderedStories.findIndex((s) => s.storyId === activeStory?.storyId);

  const visibleOrder = useMemo(
    () => (hideReviewed ? orderedStories.filter((s) => !reviewed.has(s.storyId)) : orderedStories),
    [orderedStories, reviewed, hideReviewed]
  );

  const goNext = useCallback(() => {
    if (!activeStory) return;
    const visIdx = visibleOrder.findIndex((s) => s.storyId === activeStory.storyId);
    if (visIdx === -1) {
      setActiveStoryId(visibleOrder[0]?.storyId ?? '');
      return;
    }
    const next = visibleOrder[visIdx + 1];
    if (next) setActiveStoryId(next.storyId);
  }, [activeStory, visibleOrder]);

  const goPrev = useCallback(() => {
    if (!activeStory) return;
    const visIdx = visibleOrder.findIndex((s) => s.storyId === activeStory.storyId);
    const prev = visibleOrder[visIdx - 1];
    if (prev) setActiveStoryId(prev.storyId);
  }, [activeStory, visibleOrder]);

  const markReviewed = useCallback(() => {
    if (!activeStory) return;
    setReviewed((prev) => {
      const next = new Set(prev);
      next.add(activeStory.storyId);
      return next;
    });
    goNext();
  }, [activeStory, goNext]);

  const toggleClusterExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        markReviewed();
      } else if (e.key === 'b' || e.key === 'B') {
        setSide((s) => (s === 'latest' ? 'baseline' : 'latest'));
      } else if (e.key === 'h' || e.key === 'H') {
        setHideReviewed((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, markReviewed]);

  // Auto-scroll the active row in the rail into view.
  const railScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = railScrollRef.current?.querySelector<HTMLElement>(
      `[data-story-id="${CSS.escape(activeStoryId)}"]`
    );
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeStoryId]);

  const totalReviewable = orderedStories.length;
  const reviewedHereCount = orderedStories.filter((s) => reviewed.has(s.storyId)).length;
  const pct = totalReviewable === 0 ? 0 : (reviewedHereCount / totalReviewable) * 100;

  const viewportWidth = VIEWPORT_WIDTHS[viewport];

  const activeOwner = activeStory
    ? rows.find((r) => r.stories.some((s) => s.storyId === activeStory.storyId))
    : null;
  const activeIdxInCluster =
    activeOwner && activeStory
      ? activeOwner.stories.findIndex((s) => s.storyId === activeStory.storyId) + 1
      : 0;

  return (
    <Page>
      <TopBar>
        <TopTitle>Review changes</TopTitle>
        <ChangedFile>{data.changedFile}</ChangedFile>
        <ProgressGroup>
          <ProgressText>
            {reviewedHereCount} / {totalReviewable} reviewed
          </ProgressText>
          <ProgressBar>
            <ProgressFill pct={pct} />
          </ProgressBar>
          <ProgressText>{pct.toFixed(0)}%</ProgressText>
          <ToggleChip active={hideReviewed} onClick={() => setHideReviewed((v) => !v)}>
            {hideReviewed ? '✓ ' : ''}Hide reviewed
          </ToggleChip>
        </ProgressGroup>
      </TopBar>

      <Rail>
        <RailHeader>
          <span>Group by</span>
          <SegGroup style={{ marginLeft: 'auto' }}>
            <SegButton active={groupBy === 'cluster'} onClick={() => setGroupBy('cluster')}>
              Cluster
            </SegButton>
            <SegButton active={groupBy === 'status'} onClick={() => setGroupBy('status')}>
              Status
            </SegButton>
          </SegGroup>
        </RailHeader>
        <RailScroll ref={railScrollRef}>
          {rows.map((row) => {
            const reviewedInRow = row.stories.filter((s) => reviewed.has(s.storyId)).length;
            const rowPct = row.stories.length ? (reviewedInRow / row.stories.length) * 100 : 0;
            const complete = reviewedInRow === row.stories.length && row.stories.length > 0;
            const isExpanded = expanded.has(row.id);
            const visibleStories = hideReviewed
              ? row.stories.filter((s) => !reviewed.has(s.storyId))
              : row.stories;
            return (
              <ClusterRow key={row.id}>
                <ClusterHeaderBtn
                  expanded={isExpanded}
                  complete={complete}
                  onClick={() => toggleClusterExpand(row.id)}
                >
                  <ClusterRowTop>
                    <span style={{ width: 12, color: '#94a3b8', fontSize: 10 }}>
                      {isExpanded ? '▾' : '▸'}
                    </span>
                    <ClusterName>{row.title}</ClusterName>
                    {row.depthHint !== undefined && (
                      <DepthBadge depth={row.depthHint}>d{row.depthHint}</DepthBadge>
                    )}
                    {row.statusKind && (
                      <StatusPill kind={row.statusKind}>{statusLabel[row.statusKind]}</StatusPill>
                    )}
                  </ClusterRowTop>
                  <ClusterRowProgress>
                    <RailProgressBar>
                      <RailProgressFill pct={rowPct} complete={complete} />
                    </RailProgressBar>
                    <RailProgressLabel>
                      {reviewedInRow}/{row.stories.length}
                      {complete ? ' ✓' : ''}
                    </RailProgressLabel>
                  </ClusterRowProgress>
                  {!isExpanded && <ClusterRationale>{row.rationale}</ClusterRationale>}
                </ClusterHeaderBtn>
                {isExpanded && (
                  <StoryList>
                    {visibleStories.map((s) => {
                      const isReviewed = reviewed.has(s.storyId);
                      const isActive = s.storyId === activeStory?.storyId;
                      return (
                        <li key={s.storyId}>
                          <StoryRowBtn
                            active={isActive}
                            reviewed={isReviewed}
                            data-story-id={s.storyId}
                            onClick={() => setActiveStoryId(s.storyId)}
                          >
                            <ReviewedDot reviewed={isReviewed}>{isReviewed ? '✓' : ''}</ReviewedDot>
                            <StatusPill kind={s.status}>{statusLabel[s.status]}</StatusPill>
                            <StoryRowText>
                              {s.title} <span style={{ opacity: 0.7 }}>/ {s.name}</span>
                            </StoryRowText>
                          </StoryRowBtn>
                        </li>
                      );
                    })}
                  </StoryList>
                )}
              </ClusterRow>
            );
          })}
          {rows.length === 0 && (
            <div style={{ padding: 24, fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
              No items.
            </div>
          )}
        </RailScroll>
      </Rail>

      <Main>
        {activeStory ? (
          <>
            <MainHeader>
              <MainTitle>
                {activeStory.title}{' '}
                <span style={{ opacity: 0.55, fontWeight: 400 }}>/ {activeStory.name}</span>
              </MainTitle>
              <MainSubtitle>{activeStory.storyId}</MainSubtitle>
              <StatusPill kind={activeStory.status} style={{ fontSize: 10 }}>
                {statusLabel[activeStory.status]}
              </StatusPill>
              {activeOwner && (
                <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>
                  ★ {activeOwner.title} · {activeIdxInCluster} of {activeOwner.stories.length} in
                  cluster
                  {activeOwner.depthHint !== undefined && (
                    <DepthBadge depth={activeOwner.depthHint} style={{ marginLeft: 6 }}>
                      d{activeOwner.depthHint}
                    </DepthBadge>
                  )}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
                {activeIdx + 1} / {orderedStories.length}
              </span>
            </MainHeader>
            <MainToolbar>
              <span
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                  fontSize: 10,
                }}
              >
                View
              </span>
              <SegGroup>
                <SegButton active={side === 'latest'} onClick={() => setSide('latest')}>
                  Latest
                </SegButton>
                <SegButton active={side === 'baseline'} onClick={() => setSide('baseline')}>
                  Baseline
                </SegButton>
              </SegGroup>
              <span
                style={{
                  marginLeft: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                  fontSize: 10,
                }}
              >
                Viewport
              </span>
              <SegGroup>
                {(['auto', 'mobile', 'tablet', 'desktop'] as ViewportPreset[]).map((v) => (
                  <SegButton key={v} active={viewport === v} onClick={() => setViewport(v)}>
                    {v === 'auto' ? 'Auto' : v[0].toUpperCase() + v.slice(1)}
                  </SegButton>
                ))}
              </SegGroup>
            </MainToolbar>
            <Stage>
              {side === 'latest' ? (
                <Frame
                  widthPx={viewportWidth}
                  title={activeStory.storyId}
                  src={`/iframe.html?id=${encodeURIComponent(activeStory.storyId)}&viewMode=story`}
                />
              ) : (
                <BaselineBox widthPx={viewportWidth}>
                  <strong>Baseline view (placeholder)</strong>
                  <span>
                    Production: same story rendered against session-pinned merge-base via
                    addon-before-after's env=before iframe.
                  </span>
                  <span style={{ opacity: 0.7 }}>
                    <Kbd>B</Kbd> to flip back.
                  </span>
                </BaselineBox>
              )}
            </Stage>
            <Footer>
              <FootBtn onClick={goPrev} disabled={activeIdx === 0}>
                ← Prev <Kbd>k</Kbd>
              </FootBtn>
              <FootBtn onClick={() => setSide((s) => (s === 'latest' ? 'baseline' : 'latest'))}>
                Toggle baseline <Kbd>B</Kbd>
              </FootBtn>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: '#64748b' }}>
                {reviewed.has(activeStory.storyId) ? '✓ reviewed' : 'not yet reviewed'} ·{' '}
                <Kbd>m</Kbd> mark · <Kbd>h</Kbd> hide reviewed · <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
              </span>
              <span style={{ flex: 1 }} />
              <FootBtn primary onClick={markReviewed}>
                {reviewed.has(activeStory.storyId) ? '✓ Reviewed · Next' : 'Mark reviewed + Next'}
              </FootBtn>
              <FootBtn onClick={goNext} disabled={activeIdx === orderedStories.length - 1}>
                Next → <Kbd>j</Kbd>
              </FootBtn>
            </Footer>
          </>
        ) : (
          <div style={{ padding: 40, color: '#94a3b8', fontSize: 14 }}>No stories.</div>
        )}
      </Main>
    </Page>
  );
}
