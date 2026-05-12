/**
 * Prototype F — MeticulousReview (PR-style approve/reject of visual diffs).
 *
 * Based on how meticulous.ai presents visual regression review on a PR.
 * Concrete patterns borrowed (from their website + screenshots of their
 * dashboard):
 *
 *   • PR-comment summary banner up top: "🤖 meticulous spotted visual
 *     differences in X of Y screens tested" — a single, prominent line
 *     that frames the whole review as a gate before merge.
 *   • Per-diff approve / reject workflow (not "mark reviewed" — explicit
 *     accept-as-intentional-change vs reject-as-bug, per Percy/Meticulous
 *     conventions). The merge check stays red until every diff is
 *     resolved.
 *   • "Approve all visual differences" big primary CTA — one click to
 *     accept the entire batch when the reviewer trusts it.
 *   • Hierarchical grouping: routes (clusters here) → screens (stories
 *     here). Each cluster shows its own progress.
 *   • Side-by-side Before / After preview, with a faked "diff overlay"
 *     option that highlights where the change supposedly is. (Real
 *     Meticulous gets the diff from a pixel comparison; we synthesise a
 *     plausible-looking overlay for the prototype.)
 *   • Status badges per item: ● pending, ✓ approved, ✕ rejected,
 *     ↺ needs-followup.
 *
 * Deliberate differences from Meticulous:
 *   • Storybook is single-app rendering, so the "Before" pane is a
 *     placeholder (this is the same plumbing as FocusedReview — the
 *     production version uses addon-before-after's env=before iframe).
 *   • We surface the agent's cluster rationale where Meticulous would
 *     show the route URL, because that's our equivalent of "what bound
 *     these screens together."
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

interface MeticulousReviewProps {
  data: MockReviewData;
  initialStoryId?: string;
}

type DiffState = 'pending' | 'approved' | 'rejected' | 'followup';

interface ItemState {
  state: DiffState;
  comment?: string;
}

// ──────────────────────────────────────────────────────────────────
// Visual constants (Meticulous-inspired peach accent)
// ──────────────────────────────────────────────────────────────────
const PEACH = '#F0A381';
const PEACH_DARK = '#D9866A';
const APPROVED = '#15803d';
const REJECTED = '#b91c1c';
const FOLLOWUP = '#b45309';
const PENDING = '#94a3b8';

// ──────────────────────────────────────────────────────────────────
// Styled
// ──────────────────────────────────────────────────────────────────

const Page = styled.div(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  color: theme.color.defaultText,
  background: theme.background.app,
  height: '100vh',
  display: 'grid',
  gridTemplateRows: '88px 1fr',
  gridTemplateColumns: '320px 1fr',
  gridTemplateAreas: `
    "top top"
    "rail main"
  `,
  overflow: 'hidden',
}));

// ── PR-style summary banner ────────────────────────────────────────

const Banner = styled.div(({ theme }) => ({
  gridArea: 'top',
  background: '#1B1C1D',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column' as const,
  borderBottom: `1px solid ${theme.color.border}`,
}));

const BannerLine1 = styled.div({
  padding: '10px 20px 6px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 13.5,
});

const BotChip = styled.span({
  background: PEACH,
  color: '#1B1C1D',
  fontWeight: 700,
  fontSize: 11,
  padding: '3px 8px',
  borderRadius: 4,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
});

const BannerText = styled.span({
  color: '#fff',
  flex: 1,
});

const ChangedFileCode = styled.code({
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  fontSize: 11.5,
  background: 'rgba(255,255,255,0.08)',
  padding: '2px 6px',
  borderRadius: 4,
  color: '#fbcfb8',
});

const MergeCheck = styled.span<{ ok: boolean }>(({ ok }) => ({
  background: ok ? APPROVED : '#7f1d1d',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 10px',
  borderRadius: 999,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
}));

const BannerLine2 = styled.div({
  padding: '0 20px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
});

const SummaryStats = styled.div({
  display: 'flex',
  gap: 10,
  fontSize: 12,
  color: '#cbd5e1',
});

const Stat = styled.span<{ kind?: DiffState }>(({ kind }) => {
  const color =
    kind === 'approved'
      ? APPROVED
      : kind === 'rejected'
        ? REJECTED
        : kind === 'followup'
          ? FOLLOWUP
          : PENDING;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    '&::before': {
      content: '""',
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: color,
    },
  };
});

const ApproveAllBtn = styled.button({
  marginLeft: 'auto',
  background: PEACH,
  color: '#1B1C1D',
  border: 'none',
  borderRadius: 6,
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background 0.15s',
  '&:hover': { background: PEACH_DARK },
  '&:disabled': {
    background: '#475569',
    color: '#94a3b8',
    cursor: 'not-allowed',
  },
});

// ── Sidebar (screens list) ─────────────────────────────────────────

const Rail = styled.aside(({ theme }) => ({
  gridArea: 'rail',
  background: theme.background.content,
  borderRight: `1px solid ${theme.color.border}`,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
}));

const RailHeader = styled.div(({ theme }) => ({
  padding: '10px 12px',
  borderBottom: `1px solid ${theme.color.border}`,
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  fontWeight: 700,
  color: theme.color.mediumdark,
  display: 'flex',
  gap: 6,
}));

const RailScroll = styled.div({
  flex: 1,
  overflowY: 'auto',
});

const ClusterGroup = styled.div(({ theme }) => ({
  borderBottom: `1px solid ${theme.color.border}`,
}));

const ClusterHead = styled.div(({ theme }) => ({
  padding: '8px 12px',
  background: theme.background.app,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 3,
}));

const ClusterHeadRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

const ClusterIcon = styled.button({
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 10,
  color: '#94a3b8',
  width: 14,
  padding: 0,
});

const ClusterName = styled.span(({ theme }) => ({
  fontWeight: 700,
  fontSize: 12,
  color: theme.color.darker,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}));

const ClusterTally = styled.span(({ theme }) => ({
  fontSize: 10,
  color: theme.color.mediumdark,
  fontVariantNumeric: 'tabular-nums' as const,
}));

const ClusterApproveBtn = styled.button({
  background: 'transparent',
  border: `1px solid ${PEACH}`,
  color: PEACH_DARK,
  fontSize: 10,
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 999,
  cursor: 'pointer',
  '&:hover': { background: PEACH, color: '#1B1C1D' },
});

const ScreensList = styled.ul({
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

const ScreenRow = styled.button<{ active: boolean; state: DiffState }>(
  ({ theme, active, state }) => ({
    width: '100%',
    border: 'none',
    background: active ? theme.background.hoverable : 'transparent',
    borderLeft: `3px solid ${active ? PEACH : 'transparent'}`,
    padding: '6px 12px 6px 16px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 11.5,
    color:
      state === 'approved'
        ? theme.color.mediumdark
        : state === 'rejected'
          ? theme.color.mediumdark
          : theme.color.darker,
    opacity: state === 'approved' ? 0.6 : 1,
    textDecoration: state === 'approved' ? 'line-through' : 'none',
    '&:hover': { background: theme.background.hoverable },
  })
);

const StateDot = styled.span<{ state: DiffState }>(({ state }) => {
  const color =
    state === 'approved'
      ? APPROVED
      : state === 'rejected'
        ? REJECTED
        : state === 'followup'
          ? FOLLOWUP
          : PEACH;
  return {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: state === 'pending' ? 'transparent' : color,
    border: `1.5px solid ${color}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 8,
    flexShrink: 0,
  };
});

const DepthBadge = styled.span<{ depth: number }>(({ depth }) => {
  const colors = ['#fee2e2', '#fef3c7', '#dbeafe', '#f1f5f9'];
  const fgs = ['#b91c1c', '#b45309', '#1d4ed8', '#64748b'];
  const idx = Math.min(Math.max(depth - 1, 0), colors.length - 1);
  return {
    background: colors[idx],
    color: fgs[idx],
    fontSize: 9,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 999,
    textTransform: 'uppercase' as const,
    flexShrink: 0,
  };
});

const ScreenText = styled.span({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
});

// ── Main pane (side-by-side preview) ───────────────────────────────

const Main = styled.section(({ theme }) => ({
  gridArea: 'main',
  display: 'flex',
  flexDirection: 'column' as const,
  background: theme.background.app,
  overflow: 'hidden',
}));

const Crumbs = styled.div(({ theme }) => ({
  padding: '10px 20px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap' as const,
  fontSize: 13,
}));

const ScreenTitle = styled.span(({ theme }) => ({
  fontWeight: 700,
  fontSize: 14,
  color: theme.color.darker,
}));

const ClusterCrumb = styled.span(({ theme }) => ({
  fontSize: 12,
  color: theme.color.mediumdark,
}));

const STATE_COLOURS: Record<DiffState, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#fff7ed', fg: PEACH_DARK, label: '● Pending review' },
  approved: { bg: '#dcfce7', fg: APPROVED, label: '✓ Approved' },
  rejected: { bg: '#fee2e2', fg: REJECTED, label: '✕ Rejected' },
  followup: { bg: '#fef3c7', fg: FOLLOWUP, label: '↺ Follow-up' },
};

const StateChip = styled.span<{ state: DiffState }>(({ state }) => ({
  background: STATE_COLOURS[state].bg,
  color: STATE_COLOURS[state].fg,
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 999,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
}));

const StatusBadgePill = styled.span<{ kind: StoryStatus }>(({ kind }) => ({
  background: statusColors[kind].bg,
  color: statusColors[kind].fg,
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 7px',
  borderRadius: 4,
  textTransform: 'uppercase' as const,
}));

const Toolbar = styled.div(({ theme }) => ({
  padding: '8px 20px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 12,
}));

const ToolbarLabel = styled.span(({ theme }) => ({
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  fontWeight: 700,
  color: theme.color.mediumdark,
}));

const SegGroup = styled.div(({ theme }) => ({
  display: 'inline-flex',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  overflow: 'hidden',
  background: theme.background.app,
}));

const SegBtn = styled.button<{ active: boolean }>(({ theme, active }) => ({
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

const Stage = styled.div<{ mode: 'side-by-side' | 'overlay' }>(({ mode }) => ({
  flex: 1,
  display: 'grid',
  gridTemplateColumns: mode === 'side-by-side' ? '1fr 1fr' : '1fr',
  gridTemplateRows: '1fr',
  gap: 16,
  padding: 16,
  overflow: 'auto',
  minHeight: 0,
}));

const Pane = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column' as const,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 6,
  overflow: 'hidden',
  background: theme.background.content,
  position: 'relative' as const,
}));

const PaneHeader = styled.div<{ kind: 'before' | 'after' }>(({ theme, kind }) => ({
  padding: '6px 12px',
  background: kind === 'before' ? '#1f2937' : theme.color.secondary,
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}));

const FrameWrap = styled.div({
  flex: 1,
  position: 'relative' as const,
  background: '#fff',
  overflow: 'hidden',
});

const Frame = styled.iframe({
  width: '100%',
  height: '100%',
  border: 'none',
  display: 'block',
});

const BeforePlaceholder = styled.div(({ theme }) => ({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: theme.background.hoverable,
  color: theme.color.mediumdark,
  fontSize: 12.5,
  textAlign: 'center' as const,
  padding: 16,
}));

const DiffOverlay = styled.div({
  position: 'absolute' as const,
  inset: 0,
  pointerEvents: 'none' as const,
  background:
    'repeating-linear-gradient(45deg, rgba(255, 165, 0, 0.18) 0 8px, transparent 8px 16px)',
  mixBlendMode: 'multiply' as const,
});

const DiffBadge = styled.span({
  position: 'absolute' as const,
  top: 8,
  right: 8,
  background: PEACH,
  color: '#1B1C1D',
  fontSize: 10,
  fontWeight: 700,
  padding: '3px 7px',
  borderRadius: 4,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
});

const Footer = styled.div(({ theme }) => ({
  padding: '10px 20px',
  borderTop: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap' as const,
}));

const ApproveBtn = styled.button({
  background: APPROVED,
  color: '#fff',
  border: `1px solid ${APPROVED}`,
  borderRadius: 4,
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  '&:hover': { filter: 'brightness(1.05)' },
  '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
});

const RejectBtn = styled.button({
  background: '#fff',
  color: REJECTED,
  border: `1px solid ${REJECTED}`,
  borderRadius: 4,
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover': { background: '#fee2e2' },
});

const FollowupBtn = styled.button({
  background: '#fff',
  color: FOLLOWUP,
  border: `1px solid ${FOLLOWUP}`,
  borderRadius: 4,
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover': { background: '#fef3c7' },
});

const NavBtn = styled.button(({ theme }) => ({
  background: theme.background.content,
  color: theme.color.defaultText,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  padding: '7px 12px',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
  '&:hover:not(:disabled)': { background: theme.background.hoverable },
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
// Component
// ──────────────────────────────────────────────────────────────────

export function MeticulousReview({ data, initialStoryId }: MeticulousReviewProps) {
  const allStories = useMemo(() => data.clusters.flatMap((c) => c.sampleStories), [data.clusters]);

  const [states, setStates] = useState<Record<string, ItemState>>(() => {
    const out: Record<string, ItemState> = {};
    for (const s of allStories) out[s.storyId] = { state: 'pending' };
    return out;
  });

  const [activeId, setActiveId] = useState<string>(initialStoryId ?? allStories[0]?.storyId ?? '');
  const [compareMode, setCompareMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  const [showDiffOverlay, setShowDiffOverlay] = useState(true);
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());

  const activeStory = useMemo(
    () => allStories.find((s) => s.storyId === activeId) ?? allStories[0],
    [allStories, activeId]
  );
  const activeCluster = useMemo(
    () =>
      activeStory
        ? data.clusters.find((c) => c.sampleStories.some((s) => s.storyId === activeStory.storyId))
        : null,
    [activeStory, data.clusters]
  );

  const tally = useMemo(() => {
    const t = { pending: 0, approved: 0, rejected: 0, followup: 0 } as Record<DiffState, number>;
    for (const id of Object.keys(states)) t[states[id].state]++;
    return t;
  }, [states]);
  const allResolved = tally.pending === 0;
  const totalDiffs = allStories.length;

  const advance = useCallback(() => {
    // Move to next pending story (skipping resolved ones), wrap to start.
    const order = allStories.map((s) => s.storyId);
    const idx = order.indexOf(activeId);
    for (let step = 1; step <= order.length; step++) {
      const nextId = order[(idx + step) % order.length];
      if (states[nextId]?.state === 'pending') {
        setActiveId(nextId);
        return;
      }
    }
    // Nothing pending — just go to next regardless.
    if (order.length > 0) setActiveId(order[(idx + 1) % order.length]);
  }, [activeId, allStories, states]);

  const setItem = useCallback((id: string, next: DiffState) => {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], state: next } }));
  }, []);

  const handleApprove = useCallback(() => {
    if (!activeStory) return;
    setItem(activeStory.storyId, 'approved');
    advance();
  }, [activeStory, setItem, advance]);

  const handleReject = useCallback(() => {
    if (!activeStory) return;
    setItem(activeStory.storyId, 'rejected');
    advance();
  }, [activeStory, setItem, advance]);

  const handleFollowup = useCallback(() => {
    if (!activeStory) return;
    setItem(activeStory.storyId, 'followup');
    advance();
  }, [activeStory, setItem, advance]);

  const handleApproveAll = useCallback(() => {
    setStates((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id].state === 'pending') next[id] = { ...next[id], state: 'approved' };
      }
      return next;
    });
  }, []);

  const handleApproveCluster = useCallback((cluster: MockCluster) => {
    setStates((prev) => {
      const next = { ...prev };
      for (const s of cluster.sampleStories) {
        if (next[s.storyId]?.state === 'pending')
          next[s.storyId] = { ...next[s.storyId], state: 'approved' };
      }
      return next;
    });
  }, []);

  const toggleCluster = useCallback((id: string) => {
    setCollapsedClusters((prev) => {
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
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleApprove();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReject();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleFollowup();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const order = allStories.map((s) => s.storyId);
        const idx = order.indexOf(activeId);
        if (idx < order.length - 1) setActiveId(order[idx + 1]);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const order = allStories.map((s) => s.storyId);
        const idx = order.indexOf(activeId);
        if (idx > 0) setActiveId(order[idx - 1]);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleApprove, handleReject, handleFollowup, activeId, allStories]);

  // Scroll the active row into view in the rail.
  const railScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = railScrollRef.current?.querySelector<HTMLElement>(
      `[data-story-id="${CSS.escape(activeId)}"]`
    );
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const activeState = activeStory ? (states[activeStory.storyId]?.state ?? 'pending') : 'pending';

  return (
    <Page>
      <Banner>
        <BannerLine1>
          <BotChip>🤖 meticulous</BotChip>
          <BannerText>
            spotted visual differences in <strong>{totalDiffs}</strong> of {data.cascadeSize}{' '}
            screens tested
          </BannerText>
          <ChangedFileCode>{data.changedFile}</ChangedFileCode>
          <MergeCheck ok={allResolved}>
            {allResolved ? '✓ Safe to merge' : 'Review required'}
          </MergeCheck>
        </BannerLine1>
        <BannerLine2>
          <SummaryStats>
            <Stat kind="pending">{tally.pending} pending</Stat>
            <Stat kind="approved">{tally.approved} approved</Stat>
            <Stat kind="rejected">{tally.rejected} rejected</Stat>
            {tally.followup > 0 && <Stat kind="followup">{tally.followup} follow-up</Stat>}
          </SummaryStats>
          <ApproveAllBtn onClick={handleApproveAll} disabled={tally.pending === 0}>
            ✓ Approve all visual differences ({tally.pending})
          </ApproveAllBtn>
        </BannerLine2>
      </Banner>

      <Rail>
        <RailHeader>
          <span>Screens with diffs</span>
          <span style={{ marginLeft: 'auto' }}>{totalDiffs}</span>
        </RailHeader>
        <RailScroll ref={railScrollRef}>
          {data.clusters.map((c) => {
            const stateCounts = c.sampleStories.reduce(
              (acc, s) => {
                const st = states[s.storyId]?.state ?? 'pending';
                acc[st]++;
                return acc;
              },
              { pending: 0, approved: 0, rejected: 0, followup: 0 } as Record<DiffState, number>
            );
            const isCollapsed = collapsedClusters.has(c.id);
            return (
              <ClusterGroup key={c.id}>
                <ClusterHead>
                  <ClusterHeadRow>
                    <ClusterIcon onClick={() => toggleCluster(c.id)}>
                      {isCollapsed ? '▸' : '▾'}
                    </ClusterIcon>
                    <ClusterName>{c.id}</ClusterName>
                    {c.depthHint !== undefined && (
                      <DepthBadge depth={c.depthHint}>D{c.depthHint}</DepthBadge>
                    )}
                  </ClusterHeadRow>
                  <ClusterHeadRow>
                    <ClusterTally>
                      {stateCounts.approved}/{c.sampleStories.length}{' '}
                      {stateCounts.pending === 0 && c.sampleStories.length > 0 ? '✓' : ''}
                    </ClusterTally>
                    {stateCounts.pending > 0 && (
                      <ClusterApproveBtn onClick={() => handleApproveCluster(c)}>
                        Approve all ({stateCounts.pending})
                      </ClusterApproveBtn>
                    )}
                  </ClusterHeadRow>
                </ClusterHead>
                {!isCollapsed && (
                  <ScreensList>
                    {c.sampleStories.map((s) => {
                      const st = states[s.storyId]?.state ?? 'pending';
                      return (
                        <li key={s.storyId}>
                          <ScreenRow
                            active={s.storyId === activeId}
                            state={st}
                            data-story-id={s.storyId}
                            onClick={() => setActiveId(s.storyId)}
                          >
                            <StateDot state={st}>
                              {st === 'approved'
                                ? '✓'
                                : st === 'rejected'
                                  ? '✕'
                                  : st === 'followup'
                                    ? '↺'
                                    : ''}
                            </StateDot>
                            <ScreenText>
                              {s.title} <span style={{ opacity: 0.65 }}>/ {s.name}</span>
                            </ScreenText>
                            <StatusBadgePill kind={s.status}>
                              {statusLabel[s.status]}
                            </StatusBadgePill>
                          </ScreenRow>
                        </li>
                      );
                    })}
                  </ScreensList>
                )}
              </ClusterGroup>
            );
          })}
        </RailScroll>
      </Rail>

      <Main>
        {activeStory ? (
          <>
            <Crumbs>
              <ScreenTitle>
                {activeStory.title}{' '}
                <span style={{ opacity: 0.55, fontWeight: 400 }}>/ {activeStory.name}</span>
              </ScreenTitle>
              <StatusBadgePill kind={activeStory.status}>
                {statusLabel[activeStory.status]}
              </StatusBadgePill>
              <StateChip state={activeState}>{STATE_COLOURS[activeState].label}</StateChip>
              {activeCluster && (
                <ClusterCrumb>
                  ↳ in <strong>{activeCluster.id}</strong>
                  {activeCluster.depthHint !== undefined && <> · depth {activeCluster.depthHint}</>}
                  {' · '}
                  {activeCluster.rationale}
                </ClusterCrumb>
              )}
            </Crumbs>

            <Toolbar>
              <ToolbarLabel>Layout</ToolbarLabel>
              <SegGroup>
                <SegBtn
                  active={compareMode === 'side-by-side'}
                  onClick={() => setCompareMode('side-by-side')}
                >
                  Side by side
                </SegBtn>
                <SegBtn
                  active={compareMode === 'overlay'}
                  onClick={() => setCompareMode('overlay')}
                >
                  After only
                </SegBtn>
              </SegGroup>
              <ToolbarLabel style={{ marginLeft: 16 }}>Diff overlay</ToolbarLabel>
              <SegGroup>
                <SegBtn active={showDiffOverlay} onClick={() => setShowDiffOverlay(true)}>
                  On
                </SegBtn>
                <SegBtn active={!showDiffOverlay} onClick={() => setShowDiffOverlay(false)}>
                  Off
                </SegBtn>
              </SegGroup>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
                <Kbd>a</Kbd> approve · <Kbd>r</Kbd> reject · <Kbd>f</Kbd> follow-up · <Kbd>↑</Kbd>{' '}
                <Kbd>↓</Kbd> navigate
              </span>
            </Toolbar>

            <Stage mode={compareMode}>
              {compareMode === 'side-by-side' && (
                <Pane>
                  <PaneHeader kind="before">▶ Before · session baseline</PaneHeader>
                  <FrameWrap>
                    <BeforePlaceholder>
                      <strong>Baseline iframe (placeholder)</strong>
                      <span>
                        Production: same story rendered against the session-pinned merge-base via
                        addon-before-after's <code>env=before</code>.
                      </span>
                    </BeforePlaceholder>
                  </FrameWrap>
                </Pane>
              )}
              <Pane>
                <PaneHeader kind="after">▶ After · HEAD</PaneHeader>
                <FrameWrap>
                  <Frame
                    title={activeStory.storyId}
                    src={`/iframe.html?id=${encodeURIComponent(activeStory.storyId)}&viewMode=story`}
                  />
                  {showDiffOverlay && <DiffOverlay />}
                  {showDiffOverlay && <DiffBadge>diff region</DiffBadge>}
                </FrameWrap>
              </Pane>
            </Stage>

            <Footer>
              <NavBtn
                onClick={() => {
                  const order = allStories.map((s) => s.storyId);
                  const idx = order.indexOf(activeId);
                  if (idx > 0) setActiveId(order[idx - 1]);
                }}
                disabled={allStories.findIndex((s) => s.storyId === activeId) === 0}
              >
                ← Prev <Kbd>k</Kbd>
              </NavBtn>
              <NavBtn
                onClick={() => {
                  const order = allStories.map((s) => s.storyId);
                  const idx = order.indexOf(activeId);
                  if (idx < order.length - 1) setActiveId(order[idx + 1]);
                }}
                disabled={
                  allStories.findIndex((s) => s.storyId === activeId) === allStories.length - 1
                }
              >
                Next → <Kbd>j</Kbd>
              </NavBtn>
              <span style={{ flex: 1 }} />
              <FollowupBtn onClick={handleFollowup}>
                ↺ Needs follow-up <Kbd>f</Kbd>
              </FollowupBtn>
              <RejectBtn onClick={handleReject}>
                ✕ Reject <Kbd>r</Kbd>
              </RejectBtn>
              <ApproveBtn onClick={handleApprove}>
                ✓ Approve <Kbd>a</Kbd>
              </ApproveBtn>
            </Footer>
          </>
        ) : (
          <div style={{ padding: 40, color: '#94a3b8', fontSize: 14 }}>No diffs.</div>
        )}
      </Main>
    </Page>
  );
}
