/**
 * Prototype C — focused / page-level review.
 *
 * Solves the layout problem the team conversation raised: page-level
 * stories (full layouts, dashboards, onboarding screens, mobile views)
 * don't fit in card-grid thumbnails. Review one story at a time with
 * the iframe taking the full viewport width.
 *
 * Design beats:
 *   - One story per screen, full-bleed iframe.
 *   - Latest ↔ baseline toggle (the team conversation's single-up
 *     replacement for side-by-side).
 *   - Viewport selector — constrain iframe width to Mobile/Tablet/
 *     Desktop so the user sees the breakpoint the story was designed
 *     for. Solves the "desktop-only change is invisible at mobile
 *     width" problem from the transcript.
 *   - Prev/Next keyboard navigation (← →).
 *   - Mark-reviewed + skip flow at the bottom — the user is walking
 *     through, not browsing.
 *   - Inline cluster context (cluster id + rationale + depth) when
 *     entering from the clustered prototype.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { styled } from 'storybook/theming';

import {
  type MockReviewData,
  type MockStory,
  type StoryStatus,
  statusColors,
  statusLabel,
} from './mockData.ts';

interface FocusedReviewProps {
  data: MockReviewData;
  /**
   * Optional id of the cluster the user came from. When set, the
   * focused view filters to that cluster's sample stories and shows
   * the cluster's rationale above the preview.
   */
  enteredFromClusterId?: string;
  /** Starting index (default 0). */
  initialIndex?: number;
}

type ViewportPreset = 'auto' | 'mobile' | 'tablet' | 'desktop';
type SideMode = 'latest' | 'baseline';

const VIEWPORT_WIDTHS: Record<ViewportPreset, number | null> = {
  auto: null,
  mobile: 414,
  tablet: 834,
  desktop: 1440,
};

// ───── Layout ─────────────────────────────────────────────

const Page = styled.div(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  color: theme.color.defaultText,
  background: theme.background.app,
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column' as const,
}));

const TopBar = styled.div(({ theme }) => ({
  padding: '12px 24px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap' as const,
}));

const Title = styled.h1(({ theme }) => ({
  fontSize: 18,
  margin: 0,
  color: theme.color.darker,
}));

const BackButton = styled.button(({ theme }) => ({
  background: 'none',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  color: theme.color.defaultText,
  cursor: 'pointer',
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 600,
  '&:hover': { background: theme.background.hoverable },
}));

const StoryMeta = styled.div({
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 2,
  flex: 1,
  minWidth: 0,
});

const StoryId = styled.code(({ theme }) => ({
  fontSize: 12,
  color: theme.color.mediumdark,
  fontFamily: theme.typography.fonts.mono,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}));

const StoryTitle = styled.div(({ theme }) => ({
  fontSize: 15,
  fontWeight: 600,
  color: theme.color.darker,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}));

const StatusBadge = styled.span<{ kind: StoryStatus }>(({ kind }) => ({
  background: statusColors[kind].bg,
  color: statusColors[kind].fg,
  padding: '3px 9px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}));

const ProgressBadge = styled.span(({ theme }) => ({
  background: theme.background.hoverable,
  color: theme.color.darker,
  padding: '5px 10px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums' as const,
}));

// ───── Toolbar row ───────────────────────────────────────

const Toolbar = styled.div(({ theme }) => ({
  padding: '10px 24px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap' as const,
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
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 600,
  '&:last-child': { borderRight: 'none' },
  '&:hover': { background: theme.background.hoverable },
}));

const ToolbarLabel = styled.span(({ theme }) => ({
  fontSize: 11,
  color: theme.color.mediumdark,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  fontWeight: 700,
}));

// ───── Cluster context (optional) ───────────────────────

const ClusterContext = styled.div(({ theme }) => ({
  padding: '10px 24px',
  background: '#eef2ff',
  borderBottom: `1px solid ${theme.color.border}`,
  fontSize: 12.5,
  color: '#3730a3',
  display: 'flex',
  gap: 12,
  alignItems: 'baseline',
}));

const ClusterChip = styled.span({
  fontWeight: 700,
});

const DepthChip = styled.span({
  background: '#c7d2fe',
  color: '#3730a3',
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
});

// ───── Preview stage ─────────────────────────────────────

const Stage = styled.div(({ theme }) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 24,
  background: theme.background.app,
  overflow: 'auto',
}));

const Frame = styled.iframe<{ viewportWidth: number | null }>(({ theme, viewportWidth }) => ({
  width: viewportWidth ? `${viewportWidth}px` : '100%',
  maxWidth: '100%',
  height: 'calc(100vh - 220px)',
  minHeight: 500,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 6,
  background: theme.background.content,
  display: 'block',
  boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
}));

const BaselinePlaceholder = styled.div<{ viewportWidth: number | null }>(
  ({ theme, viewportWidth }) => ({
    width: viewportWidth ? `${viewportWidth}px` : '100%',
    maxWidth: '100%',
    height: 'calc(100vh - 220px)',
    minHeight: 500,
    border: `2px dashed ${theme.color.border}`,
    borderRadius: 6,
    background: theme.background.hoverable,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    color: theme.color.mediumdark,
    fontSize: 14,
    padding: 24,
    textAlign: 'center' as const,
  })
);

// ───── Bottom action bar ────────────────────────────────

const BottomBar = styled.div(({ theme }) => ({
  padding: '12px 24px',
  borderTop: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap' as const,
}));

const NavButton = styled.button<{ primary?: boolean }>(({ theme, primary }) => ({
  background: primary ? theme.color.secondary : theme.background.content,
  color: primary ? theme.color.lightest : theme.color.defaultText,
  border: `1px solid ${primary ? theme.color.secondary : theme.color.border}`,
  borderRadius: 4,
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  '&:disabled': {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  '&:hover:not(:disabled)': {
    filter: primary ? 'brightness(1.05)' : undefined,
    background: primary ? undefined : theme.background.hoverable,
  },
}));

const Kbd = styled.kbd(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontSize: 11,
  border: `1px solid ${theme.color.border}`,
  background: theme.background.app,
  borderRadius: 3,
  padding: '1px 5px',
  margin: '0 4px',
  color: theme.color.darker,
}));

const Spacer = styled.span({ flex: 1 });

const StatusLine = styled.span(({ theme }) => ({
  fontSize: 12,
  color: theme.color.mediumdark,
}));

const SizeHintLine = styled.div(({ theme }) => ({
  fontSize: 11,
  color: theme.color.mediumdark,
  fontStyle: 'italic' as const,
}));

// ───── Component ────────────────────────────────────────

export function FocusedReview({
  data,
  enteredFromClusterId,
  initialIndex = 0,
}: FocusedReviewProps) {
  const cluster = enteredFromClusterId
    ? data.clusters.find((c) => c.id === enteredFromClusterId)
    : null;
  const stories = useMemo<MockStory[]>(
    () => (cluster ? cluster.sampleStories : data.stories),
    [cluster, data.stories]
  );
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(stories.length - 1, 0)));
  const [viewport, setViewport] = useState<ViewportPreset>('auto');
  const [side, setSide] = useState<SideMode>('latest');
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  const current = stories[index];
  const total = stories.length;
  const viewportWidth = VIEWPORT_WIDTHS[viewport];

  const goTo = useCallback(
    (next: number) => {
      const wrapped = ((next % total) + total) % total;
      setIndex(wrapped);
      setSide('latest');
    },
    [total]
  );

  const markReviewed = useCallback(() => {
    if (!current) return;
    setReviewed((prev) => {
      const next = new Set(prev);
      next.add(current.storyId);
      return next;
    });
    if (index < total - 1) goTo(index + 1);
  }, [current, index, total, goTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === 'b') {
        setSide((s) => (s === 'latest' ? 'baseline' : 'latest'));
      } else if (e.key === 'm') {
        markReviewed();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, goTo, markReviewed]);

  if (!current) {
    return (
      <Page>
        <TopBar>
          <Title>Nothing to review</Title>
        </TopBar>
      </Page>
    );
  }

  const reviewedCount = reviewed.size;
  const reviewedHere = reviewed.has(current.storyId);

  return (
    <Page>
      <TopBar>
        <BackButton>← Back to list</BackButton>
        <StoryMeta>
          <StoryTitle>
            {current.title} <span style={{ opacity: 0.6, fontWeight: 400 }}>/ {current.name}</span>
          </StoryTitle>
          <StoryId>{current.storyId}</StoryId>
        </StoryMeta>
        <StatusBadge kind={current.status}>{statusLabel[current.status]}</StatusBadge>
        <ProgressBadge>
          {index + 1} / {total}
        </ProgressBadge>
      </TopBar>

      {cluster && (
        <ClusterContext>
          <ClusterChip>★ Cluster: {cluster.id}</ClusterChip>
          {cluster.depthHint !== undefined && <DepthChip>depth {cluster.depthHint}</DepthChip>}
          <span style={{ flex: 1 }}>{cluster.rationale}</span>
        </ClusterContext>
      )}

      <Toolbar>
        <ToolbarLabel>View</ToolbarLabel>
        <SegGroup>
          <SegButton active={side === 'latest'} onClick={() => setSide('latest')}>
            Latest
          </SegButton>
          <SegButton active={side === 'baseline'} onClick={() => setSide('baseline')}>
            Baseline
          </SegButton>
        </SegGroup>

        <ToolbarLabel style={{ marginLeft: 12 }}>Viewport</ToolbarLabel>
        <SegGroup>
          {(['auto', 'mobile', 'tablet', 'desktop'] as ViewportPreset[]).map((v) => (
            <SegButton key={v} active={viewport === v} onClick={() => setViewport(v)}>
              {v === 'auto' ? 'Auto' : v[0].toUpperCase() + v.slice(1)}
              {v !== 'auto' && VIEWPORT_WIDTHS[v] && (
                <span style={{ opacity: 0.5, marginLeft: 4 }}>{VIEWPORT_WIDTHS[v]}px</span>
              )}
            </SegButton>
          ))}
        </SegGroup>

        <Spacer />

        {current.size === 'page' && (
          <SizeHintLine>This is a page-level story — best reviewed at full width.</SizeHintLine>
        )}

        <StatusLine>
          {reviewedCount} of {total} reviewed
        </StatusLine>
      </Toolbar>

      <Stage>
        {side === 'latest' ? (
          <Frame
            viewportWidth={viewportWidth}
            title={current.storyId}
            src={`/iframe.html?id=${encodeURIComponent(current.storyId)}&viewMode=story`}
          />
        ) : (
          <BaselinePlaceholder viewportWidth={viewportWidth}>
            <strong>Baseline view (placeholder)</strong>
            <span>
              In production this iframe loads the same story rendered against the session-pinned
              merge-base via <code>addon-before-after</code>'s <code>env=before</code> iframe.
            </span>
            <span style={{ opacity: 0.7 }}>
              Press <Kbd>B</Kbd> or click <strong>Latest</strong> to flip back.
            </span>
          </BaselinePlaceholder>
        )}
      </Stage>

      <BottomBar>
        <NavButton disabled={index === 0} onClick={() => goTo(index - 1)}>
          ← Previous <Kbd>←</Kbd>
        </NavButton>
        <NavButton onClick={() => setSide((s) => (s === 'latest' ? 'baseline' : 'latest'))}>
          Toggle baseline <Kbd>B</Kbd>
        </NavButton>
        <Spacer />
        <StatusLine>
          {reviewedHere ? '✓ Marked reviewed' : 'Not yet reviewed'} · <Kbd>M</Kbd> mark ·{' '}
          <Kbd>←</Kbd> <Kbd>→</Kbd> navigate
        </StatusLine>
        <Spacer />
        <NavButton onClick={markReviewed}>Skip</NavButton>
        <NavButton primary onClick={markReviewed} disabled={reviewedHere}>
          {reviewedHere ? '✓ Reviewed' : 'Mark reviewed + next'}
        </NavButton>
        <NavButton disabled={index === total - 1} onClick={() => goTo(index + 1)}>
          Next <Kbd>→</Kbd>
        </NavButton>
      </BottomBar>
    </Page>
  );
}
