/**
 * Prototype D — layered / stacked review.
 *
 * Two-axis navigation:
 *   - ↑/↓  changes the active cluster (rows are "sheets of paper" stacked
 *          vertically; inactive sheets peek above and below the active one).
 *   - ←/→  changes the active story within the current cluster (a
 *          horizontal carousel with one big preview centered, neighbours
 *          peeking).
 *
 * Two grouping modes:
 *   - clustered: rows are agent-defined clusters
 *   - flat: rows are status groups (Modified / New / Related); a single
 *     visual model that gives ↑/↓ something to do even without clusters
 *
 * UX value: zoom-out (you see all clusters/groups at once via the peek
 * strips) AND zoom-in (one story rendered at full size) simultaneously.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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

interface LayeredReviewProps {
  data: MockReviewData;
  /** 'clustered' = rows are clusters; 'flat' = rows are status groups. */
  initialMode?: 'clustered' | 'flat';
}

interface Row {
  id: string;
  title: string;
  rationale: string;
  depthHint?: number;
  totalStoryCount: number;
  stories: MockStory[];
  /** Visual chip colour when used to mark a flat-mode status row. */
  statusKind?: StoryStatus;
}

// ──────────────────────────────────────────────────────────────────
// Styled components
// ──────────────────────────────────────────────────────────────────

const Page = styled.div(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  color: theme.color.defaultText,
  background: theme.background.app,
  height: '100vh',
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
  outline: 'none',
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
  fontSize: 16,
  margin: 0,
  color: theme.color.darker,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}));

const ChangedFile = styled.code(({ theme }) => ({
  fontSize: 12,
  color: theme.color.mediumdark,
  fontFamily: theme.typography.fonts.mono,
  background: theme.background.hoverable,
  padding: '3px 8px',
  borderRadius: 4,
}));

const ModeToggle = styled.div(({ theme }) => ({
  display: 'inline-flex',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  overflow: 'hidden',
  background: theme.background.app,
}));

const ModeButton = styled.button<{ active: boolean }>(({ theme, active }) => ({
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

const Stack = styled.div(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column' as const,
  background: theme.background.app,
  overflow: 'hidden',
  position: 'relative' as const,
}));

// ── Peek strips (inactive clusters above and below) ──────────────────

const PeekStrip = styled.button<{ position: 'above' | 'below' }>(({ theme, position }) => ({
  border: 'none',
  background: theme.background.content,
  color: theme.color.defaultText,
  padding: '8px 24px',
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
  transition: 'background 0.15s, transform 0.2s, opacity 0.2s',
  boxShadow:
    position === 'above'
      ? `inset 0 -1px 0 ${theme.color.border}, 0 1px 2px rgba(15,23,42,0.04)`
      : `inset 0 1px 0 ${theme.color.border}, 0 -1px 2px rgba(15,23,42,0.04)`,
  transform:
    position === 'above' ? 'scaleY(0.98) translateY(1px)' : 'scaleY(0.98) translateY(-1px)',
  opacity: 0.85,
  '&:hover': {
    background: theme.background.hoverable,
    opacity: 1,
    transform: 'scaleY(1)',
  },
}));

const PeekArrow = styled.span(({ theme }) => ({
  color: theme.color.mediumdark,
  fontSize: 11,
  fontWeight: 700,
}));

const PeekTitle = styled.span({
  fontWeight: 600,
  flex: 1,
  textAlign: 'left' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
});

const PeekMeta = styled.span(({ theme }) => ({
  color: theme.color.mediumdark,
  fontSize: 11,
}));

// ── Active row ───────────────────────────────────────────────────────

const ActiveSheet = styled.div(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  background: theme.background.content,
  borderTop: `2px solid ${theme.color.secondary}`,
  borderBottom: `2px solid ${theme.color.secondary}`,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
  position: 'relative' as const,
  boxShadow: '0 4px 16px rgba(15,23,42,0.08), 0 -4px 16px rgba(15,23,42,0.08)',
}));

const ActiveHeader = styled.div(({ theme }) => ({
  padding: '12px 24px',
  borderBottom: `1px solid ${theme.color.border}`,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  background: theme.background.content,
}));

const ActiveTitleRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap' as const,
});

const ActiveTitle = styled.div(({ theme }) => ({
  fontSize: 15,
  fontWeight: 700,
  color: theme.color.darker,
}));

const Rationale = styled.div(({ theme }) => ({
  fontSize: 12.5,
  color: theme.color.mediumdark,
  lineHeight: 1.45,
}));

const DepthBadge = styled.span<{ depth: number }>(({ depth }) => {
  const colors = ['#fee2e2', '#fef3c7', '#dbeafe', '#f1f5f9'];
  const fgs = ['#b91c1c', '#b45309', '#1d4ed8', '#64748b'];
  const idx = Math.min(Math.max(depth - 1, 0), colors.length - 1);
  return {
    background: colors[idx],
    color: fgs[idx],
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    textTransform: 'uppercase' as const,
  };
});

const StatusBadge = styled.span<{ kind: StoryStatus }>(({ kind }) => ({
  background: statusColors[kind].bg,
  color: statusColors[kind].fg,
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 999,
  textTransform: 'uppercase' as const,
}));

const StoryCountChip = styled.span(({ theme }) => ({
  background: theme.background.hoverable,
  color: theme.color.darker,
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
}));

// ── Horizontal carousel inside active sheet ─────────────────────────

const Carousel = styled.div({
  flex: 1,
  position: 'relative' as const,
  display: 'flex',
  alignItems: 'center',
  // No justifyContent — the track is positioned manually via translateX
  // so we want it to start at the left edge. With `center`, the flex
  // engine would shift the whole track horizontally, double-centering it
  // and causing the slot to land off-center.
  overflow: 'hidden',
  minHeight: 0,
});

const CarouselTrack = styled.div<{ offset: number }>(({ offset }) => ({
  display: 'flex',
  alignItems: 'stretch',
  gap: 24,
  transform: `translate3d(${offset}px, 0, 0)`,
  // Smooth swipe — ease-out, no overshoot, no bounce.
  transition: 'transform 0.3s ease-out',
  willChange: 'transform',
  padding: '20px 0',
}));

const Slot = styled.div<{ active: boolean }>(({ theme, active }) => ({
  // Width and height come from inline style (computed from carousel size).
  // Every slot is the same size — proper carousel, no zoom-in effect.
  flexShrink: 0,
  // Only opacity and border/shadow animate; never size or transform.
  transition: 'opacity 0.2s linear, border-color 0.2s linear, box-shadow 0.2s linear',
  opacity: active ? 1 : 0.35,
  display: 'flex',
  flexDirection: 'column' as const,
  border: `1px solid ${active ? theme.color.secondary : theme.color.border}`,
  borderRadius: 8,
  background: theme.background.content,
  overflow: 'hidden',
  boxShadow: active ? '0 4px 16px rgba(15,23,42,0.10)' : 'none',
}));

const SlotHeader = styled.div(({ theme }) => ({
  padding: '8px 12px',
  borderBottom: `1px solid ${theme.color.border}`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: theme.background.app,
  fontSize: 12,
  fontWeight: 600,
  color: theme.color.darker,
}));

const SlotStoryName = styled.span(({ theme }) => ({
  color: theme.color.mediumdark,
  fontWeight: 400,
}));

const SlotFrame = styled.iframe({
  width: '100%',
  height: '100%',
  border: 'none',
  flex: 1,
  display: 'block',
});

const NavButton = styled.button<{ side: 'left' | 'right' }>(({ theme, side }) => ({
  position: 'absolute' as const,
  top: '50%',
  [side]: 16,
  transform: 'translateY(-50%)',
  width: 40,
  height: 40,
  borderRadius: 999,
  border: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  color: theme.color.darker,
  cursor: 'pointer',
  fontSize: 18,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2,
  boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
  '&:hover:not(:disabled)': {
    background: theme.background.hoverable,
    transform: 'translateY(-50%) scale(1.05)',
  },
  '&:disabled': {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
}));

const StoryDots = styled.div({
  display: 'flex',
  justifyContent: 'center',
  gap: 6,
  padding: '6px 0 12px',
});

const Dot = styled.button<{ active: boolean }>(({ theme, active }) => ({
  width: active ? 22 : 8,
  height: 8,
  borderRadius: 999,
  border: 'none',
  background: active ? theme.color.secondary : theme.color.border,
  cursor: 'pointer',
  transition: 'width 0.2s, background 0.2s',
  padding: 0,
}));

// ── Help bar ─────────────────────────────────────────────────────────

const HelpBar = styled.div(({ theme }) => ({
  padding: '8px 24px',
  borderTop: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 11,
  color: theme.color.mediumdark,
  flexWrap: 'wrap' as const,
}));

const Kbd = styled.kbd(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontSize: 10,
  border: `1px solid ${theme.color.border}`,
  background: theme.background.app,
  borderRadius: 3,
  padding: '1px 5px',
  color: theme.color.darker,
}));

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function clustersToRows(clusters: MockCluster[]): Row[] {
  return clusters.map((c) => ({
    id: c.id,
    title: c.id,
    rationale: c.rationale,
    depthHint: c.depthHint,
    totalStoryCount: c.totalStoryCount,
    stories: c.sampleStories,
  }));
}

function statusGroupsToRows(stories: MockStory[]): Row[] {
  const groups: Record<StoryStatus, MockStory[]> = {
    new: stories.filter((s) => s.status === 'new'),
    modified: stories.filter((s) => s.status === 'modified'),
    related: stories.filter((s) => s.status === 'related'),
  };
  const rows: Row[] = [];
  for (const kind of ['modified', 'new', 'related'] as StoryStatus[]) {
    const group = groups[kind];
    if (group.length === 0) continue;
    rows.push({
      id: `status-${kind}`,
      title: statusLabel[kind] + ' stories',
      rationale: `All ${group.length} ${statusLabel[kind].toLowerCase()} stories in this cascade.`,
      totalStoryCount: group.length,
      stories: group,
      statusKind: kind,
    });
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────

export function LayeredReview({ data, initialMode = 'clustered' }: LayeredReviewProps) {
  const [mode, setMode] = useState<'clustered' | 'flat'>(initialMode);
  const [clusterIdx, setClusterIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);

  const rows = useMemo<Row[]>(
    () => (mode === 'clustered' ? clustersToRows(data.clusters) : statusGroupsToRows(data.stories)),
    [mode, data]
  );

  // Clamp indices when rows change.
  useEffect(() => {
    if (clusterIdx >= rows.length) setClusterIdx(0);
  }, [rows, clusterIdx]);
  const currentRow = rows[Math.min(clusterIdx, rows.length - 1)] ?? null;
  useEffect(() => {
    if (currentRow && storyIdx >= currentRow.stories.length) setStoryIdx(0);
  }, [currentRow, storyIdx]);

  const moveCluster = useCallback(
    (delta: number) => {
      setClusterIdx((i) => {
        const next = i + delta;
        if (next < 0 || next >= rows.length) return i;
        return next;
      });
      setStoryIdx(0);
    },
    [rows.length]
  );
  const moveStory = useCallback(
    (delta: number) => {
      if (!currentRow) return;
      setStoryIdx((i) => {
        const next = i + delta;
        if (next < 0 || next >= currentRow.stories.length) return i;
        return next;
      });
    },
    [currentRow]
  );

  const pageRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const id = setTimeout(() => pageRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveCluster(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveCluster(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveStory(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveStory(-1);
      } else if (e.key === 'c' || e.key === 'C') {
        setMode((m) => (m === 'clustered' ? 'flat' : 'clustered'));
      }
    },
    [moveCluster, moveStory]
  );

  useEffect(() => {
    const docHandler = (e: KeyboardEvent) => handleKey(e);
    document.addEventListener('keydown', docHandler);
    return () => document.removeEventListener('keydown', docHandler);
  }, [handleKey]);

  if (!currentRow) {
    return (
      <Page>
        <TopBar>
          <Title>Nothing to review</Title>
        </TopBar>
      </Page>
    );
  }

  const above = rows.slice(0, clusterIdx);
  const below = rows.slice(clusterIdx + 1);
  const totalStories = currentRow.stories.length;

  const carouselRef = React.useRef<HTMLDivElement | null>(null);
  const [carouselWidth, setCarouselWidth] = useState(1200);
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === 'number') setCarouselWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Every slot is the same size (no zoom-in animation) — a proper
  // carousel. Slot width is responsive: takes most of the carousel's
  // available width (with a small margin so neighbors hint), capped
  // at 1400px so it doesn't get ridiculous on ultrawide displays.
  const GAP = 24;
  const SLOT_W = Math.max(560, Math.min(1400, carouselWidth - 120));
  const SLOT_H = 'min(480px, calc(100vh - 240px))';

  const trackOffset = useMemo(() => {
    const leftEdge = storyIdx * (SLOT_W + GAP);
    const slotCenter = leftEdge + SLOT_W / 2;
    return carouselWidth / 2 - slotCenter;
  }, [storyIdx, carouselWidth, SLOT_W]);

  return (
    <Page ref={pageRef} tabIndex={-1}>
      <TopBar>
        <Title>
          Review changes
          <ChangedFile>{data.changedFile}</ChangedFile>
        </Title>
        <span style={{ marginLeft: 'auto' }} />
        <span style={{ fontSize: 12, color: '#64748b' }}>Group by:</span>
        <ModeToggle>
          <ModeButton active={mode === 'clustered'} onClick={() => setMode('clustered')}>
            Clusters ({data.clusters.length})
          </ModeButton>
          <ModeButton active={mode === 'flat'} onClick={() => setMode('flat')}>
            Status groups
          </ModeButton>
        </ModeToggle>
      </TopBar>

      <Stack>
        {above.length > 0 && (
          <div>
            {above.slice(-3).map((row, i) => {
              const realIdx = clusterIdx - (Math.min(above.length, 3) - i);
              return (
                <PeekStrip
                  key={row.id}
                  position="above"
                  onClick={() => {
                    setClusterIdx(realIdx);
                    setStoryIdx(0);
                  }}
                  style={{ opacity: 0.5 + i * 0.15 }}
                >
                  <PeekArrow>▲</PeekArrow>
                  <PeekTitle>{row.title}</PeekTitle>
                  {row.depthHint !== undefined && (
                    <DepthBadge depth={row.depthHint}>d{row.depthHint}</DepthBadge>
                  )}
                  {row.statusKind && (
                    <StatusBadge kind={row.statusKind}>{statusLabel[row.statusKind]}</StatusBadge>
                  )}
                  <PeekMeta>{row.totalStoryCount} stories</PeekMeta>
                </PeekStrip>
              );
            })}
          </div>
        )}

        <ActiveSheet>
          <ActiveHeader>
            <ActiveTitleRow>
              <ActiveTitle>{currentRow.title}</ActiveTitle>
              {currentRow.depthHint !== undefined && (
                <DepthBadge depth={currentRow.depthHint}>depth {currentRow.depthHint}</DepthBadge>
              )}
              {currentRow.statusKind && (
                <StatusBadge kind={currentRow.statusKind}>
                  {statusLabel[currentRow.statusKind]}
                </StatusBadge>
              )}
              <StoryCountChip>{currentRow.totalStoryCount} stories</StoryCountChip>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
                {clusterIdx + 1} / {rows.length} {mode === 'clustered' ? 'clusters' : 'groups'} ·{' '}
                Story {storyIdx + 1} of {totalStories}
              </span>
            </ActiveTitleRow>
            <Rationale>{currentRow.rationale}</Rationale>
          </ActiveHeader>

          <Carousel ref={carouselRef}>
            <NavButton side="left" disabled={storyIdx === 0} onClick={() => moveStory(-1)}>
              ←
            </NavButton>

            <CarouselTrack offset={trackOffset}>
              {currentRow.stories.map((s, i) => {
                const active = i === storyIdx;
                return (
                  <Slot
                    key={s.storyId}
                    active={active}
                    onClick={() => !active && setStoryIdx(i)}
                    style={{
                      cursor: active ? 'default' : 'pointer',
                      width: SLOT_W,
                      height: SLOT_H,
                    }}
                  >
                    <SlotHeader>
                      <span>
                        {s.title} <SlotStoryName>/ {s.name}</SlotStoryName>
                      </span>
                      <StatusBadge kind={s.status} style={{ marginLeft: 'auto' }}>
                        {statusLabel[s.status]}
                      </StatusBadge>
                    </SlotHeader>
                    <LazyStoryFrame
                      storyId={s.storyId}
                      title={`${s.title} / ${s.name}`}
                      mode="lazy"
                      priority={active ? 'primary' : 'high'}
                      style={{ flex: 1, minHeight: 0 }}
                    />
                  </Slot>
                );
              })}
            </CarouselTrack>

            <NavButton
              side="right"
              disabled={storyIdx === totalStories - 1}
              onClick={() => moveStory(1)}
            >
              →
            </NavButton>
          </Carousel>

          <StoryDots>
            {currentRow.stories.map((s, i) => (
              <Dot
                key={s.storyId}
                active={i === storyIdx}
                onClick={() => setStoryIdx(i)}
                title={s.storyId}
              />
            ))}
          </StoryDots>
        </ActiveSheet>

        {below.length > 0 && (
          <div>
            {below.slice(0, 3).map((row, i) => (
              <PeekStrip
                key={row.id}
                position="below"
                onClick={() => {
                  setClusterIdx(clusterIdx + 1 + i);
                  setStoryIdx(0);
                }}
                style={{ opacity: 0.85 - i * 0.15 }}
              >
                <PeekArrow>▼</PeekArrow>
                <PeekTitle>{row.title}</PeekTitle>
                {row.depthHint !== undefined && (
                  <DepthBadge depth={row.depthHint}>d{row.depthHint}</DepthBadge>
                )}
                {row.statusKind && (
                  <StatusBadge kind={row.statusKind}>{statusLabel[row.statusKind]}</StatusBadge>
                )}
                <PeekMeta>{row.totalStoryCount} stories</PeekMeta>
              </PeekStrip>
            ))}
          </div>
        )}
      </Stack>

      <HelpBar>
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> change {mode === 'clustered' ? 'cluster' : 'group'}
        </span>
        <span>
          <Kbd>←</Kbd> <Kbd>→</Kbd> change story
        </span>
        <span>
          <Kbd>C</Kbd> toggle clustered ⇄ flat
        </span>
        <span style={{ marginLeft: 'auto' }}>
          Click a peek strip or dot to jump directly · Click a side slot to focus that story
        </span>
      </HelpBar>
    </Page>
  );
}
