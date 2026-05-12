/**
 * Shared lazy story-preview component for the review prototypes.
 *
 * Three things this module solves:
 *
 *   1. **Hard cap on concurrent iframes.** Each story iframe costs ~8 MB
 *      in this dogfood, so rendering a route-tree grid of 20+ at once
 *      tanks the page. A global LRU pool caps the number actually
 *      mounted (default 8); the rest render a stylised poster.
 *
 *   2. **Priority tiers.** Not every iframe is equally important. The
 *      pool orders requests by tier (`primary` → `high` → `normal` →
 *      `low`) and only falls back to recency within a tier. So the
 *      currently-focused story stays mounted, cluster representatives
 *      keep their slot, and low-priority neighbours are evicted first.
 *
 *   3. **A real loading state.** Until the iframe fires `load`, an
 *      overlay shimmers across the cell so the user gets feedback that
 *      content is incoming (instead of a flash of white). The cold
 *      poster (out-of-pool) shows the same hue as the warm state so
 *      transitions are visually quiet.
 */
import React, { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';

import { keyframes, styled } from 'storybook/theming';

// ────────────────────────────────────────────────────────────────
// Pool
// ────────────────────────────────────────────────────────────────

const POOL_CAP_DEFAULT = 8;

export type Priority = 'primary' | 'high' | 'normal' | 'low';

const TIER_RANK: Record<Priority, number> = {
  primary: 0,
  high: 1,
  normal: 2,
  low: 3,
};

interface PoolEntry {
  ts: number;
  priority: Priority;
}

const wanted = new Map<string, PoolEntry>();
const subscribers = new Set<() => void>();

let poolCap = POOL_CAP_DEFAULT;
/** Allow a prototype to set its own pool cap (e.g. 4 for very dense grids). */
export function setLazyFramePoolCap(cap: number) {
  poolCap = Math.max(1, cap | 0);
  notify();
}

function notify() {
  subscribers.forEach((s) => s());
}

function requestMount(id: string, priority: Priority) {
  wanted.set(id, { ts: performance.now(), priority });
  notify();
}

function releaseMount(id: string) {
  wanted.delete(id);
  notify();
}

function getActiveSet(): Set<string> {
  // Two-key sort: tier rank ascending, then timestamp descending (recent first).
  // Primary items are pinned (never count toward the cap).
  const entries = [...wanted.entries()];
  const primaryIds = entries.filter(([, v]) => v.priority === 'primary').map(([id]) => id);
  const transients = entries
    .filter(([, v]) => v.priority !== 'primary')
    .sort((a, b) => {
      const tierDiff = TIER_RANK[a[1].priority] - TIER_RANK[b[1].priority];
      if (tierDiff !== 0) return tierDiff;
      return b[1].ts - a[1].ts;
    });
  const slotsLeft = Math.max(0, poolCap - primaryIds.length);
  return new Set([...primaryIds, ...transients.slice(0, slotsLeft).map(([id]) => id)]);
}

function useIsMounted(id: string): boolean {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const sub = () => setVersion((v) => v + 1);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = version;
  return getActiveSet().has(id);
}

// ────────────────────────────────────────────────────────────────
// Visual primitives
// ────────────────────────────────────────────────────────────────

const STORYBOOK_PINK = '#FF4785';
const STORYBOOK_PINK_SOFT = 'rgba(255, 71, 133, 0.65)';

// Deterministic hue per story id so each story has a consistent tint.
function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

const shimmer = keyframes({
  '0%': { backgroundPosition: '-200% 0' },
  '100%': { backgroundPosition: '200% 0' },
});

const fadeOut = keyframes({
  '0%': { opacity: 1 },
  '100%': { opacity: 0 },
});

const Wrap = styled.div({
  position: 'relative' as const,
  overflow: 'hidden',
});

const PosterRoot = styled.div<{ hue: number }>(({ hue }) => ({
  width: '100%',
  height: '100%',
  background: `linear-gradient(135deg, hsl(${hue}, 28%, 17%) 0%, hsl(${(hue + 24) % 360}, 24%, 11%) 100%)`,
  color: 'rgba(255, 255, 255, 0.85)',
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'space-between',
  padding: 12,
  fontSize: 11,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
  boxSizing: 'border-box' as const,
  position: 'relative' as const,
}));

const PosterShine = styled.div({
  position: 'absolute' as const,
  inset: 0,
  background:
    'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.05) 50%, transparent 70%)',
  backgroundSize: '300% 100%',
  animation: `${shimmer} 4s ease-in-out infinite`,
  pointerEvents: 'none' as const,
});

const StoryIdRow = styled.div({
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 9,
  letterSpacing: '0.02em',
  opacity: 0.55,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
});

const PosterTitle = styled.div({
  fontSize: 12,
  fontWeight: 600,
  opacity: 0.95,
  lineHeight: 1.3,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 2,
});

const PosterSubtitle = styled.div({
  fontSize: 10,
  fontWeight: 400,
  opacity: 0.7,
});

const PriorityChip = styled.span<{ priority: Priority }>(({ priority }) => {
  const map: Record<Priority, { bg: string; fg: string }> = {
    primary: { bg: STORYBOOK_PINK, fg: '#fff' },
    high: { bg: STORYBOOK_PINK_SOFT, fg: '#fff' },
    normal: { bg: 'rgba(255,255,255,0.10)', fg: 'rgba(255,255,255,0.7)' },
    low: { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.4)' },
  };
  return {
    alignSelf: 'flex-start' as const,
    background: map[priority].bg,
    color: map[priority].fg,
    fontSize: 9,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 999,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };
});

const PosterFooter = styled.div({
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  opacity: 0.55,
  display: 'flex',
  alignItems: 'center',
  gap: 5,
});

const Dot = styled.span<{ colour: string }>(({ colour }) => ({
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: colour,
}));

// ── Loading skeleton (shown over a mounted-but-not-yet-loaded iframe) ──

const SkeletonOverlay = styled.div<{ fading: boolean }>(({ fading }) => ({
  position: 'absolute' as const,
  inset: 0,
  background: '#fdfbf7',
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'flex-start',
  padding: 14,
  gap: 10,
  animation: fading ? `${fadeOut} 0.18s ease-out forwards` : undefined,
  pointerEvents: 'none' as const,
}));

const SkeletonBar = styled.div<{ w: string; h: number }>(({ w, h }) => ({
  width: w,
  height: h,
  borderRadius: 4,
  background:
    'linear-gradient(90deg, rgba(15,23,42,0.05) 0%, rgba(15,23,42,0.12) 30%, rgba(15,23,42,0.05) 60%)',
  backgroundSize: '300% 100%',
  animation: `${shimmer} 1.4s ease-in-out infinite`,
}));

const SpinnerWrap = styled.div({
  marginTop: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  color: 'rgba(15,23,42,0.55)',
});

const spin = keyframes({
  to: { transform: 'rotate(360deg)' },
});

const Spinner = styled.span({
  width: 12,
  height: 12,
  borderRadius: '50%',
  border: `2px solid rgba(255, 71, 133, 0.25)`,
  borderTopColor: STORYBOOK_PINK,
  animation: `${spin} 0.9s linear infinite`,
});

const StyledIframe = styled.iframe({
  width: '100%',
  height: '100%',
  border: 'none',
  display: 'block',
  background: '#fff',
  position: 'relative' as const,
});

const ScaledIframe = styled.iframe({
  border: 'none',
  display: 'block',
  background: '#fff',
  width: '200%',
  height: '200%',
  transform: 'scale(0.5)',
  transformOrigin: 'top left',
  pointerEvents: 'none' as const,
});

// ────────────────────────────────────────────────────────────────
// Posters & Loading state
// ────────────────────────────────────────────────────────────────

interface PosterProps {
  storyId: string;
  title?: string;
  subtitle?: string;
  priority: Priority;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  primary: 'pinned',
  high: 'high priority',
  normal: 'normal priority',
  low: 'low priority',
};

const PRIORITY_DOT: Record<Priority, string> = {
  primary: STORYBOOK_PINK,
  high: '#f59e0b',
  normal: '#94a3b8',
  low: '#475569',
};

function Poster({ storyId, title, subtitle, priority }: PosterProps) {
  const hue = useMemo(() => hashHue(storyId), [storyId]);
  return (
    <PosterRoot hue={hue}>
      <PosterShine />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          position: 'relative',
        }}
      >
        <StoryIdRow>{storyId}</StoryIdRow>
        <PriorityChip priority={priority}>{priority}</PriorityChip>
      </div>
      <PosterTitle style={{ position: 'relative' }}>
        {title || storyId.split('--').pop()}
        {subtitle && <PosterSubtitle>{subtitle}</PosterSubtitle>}
      </PosterTitle>
      <PosterFooter style={{ position: 'relative' }}>
        <Dot colour={PRIORITY_DOT[priority]} />
        Queued · pool full
      </PosterFooter>
    </PosterRoot>
  );
}

function LoadingSkeleton({ fading }: { fading: boolean }) {
  return (
    <SkeletonOverlay fading={fading}>
      <SkeletonBar w="48%" h={11} />
      <SkeletonBar w="78%" h={9} />
      <SkeletonBar w="62%" h={9} />
      <SkeletonBar w="44%" h={9} />
      <SpinnerWrap>
        <Spinner />
        <span>Mounting iframe…</span>
      </SpinnerWrap>
    </SkeletonOverlay>
  );
}

// ────────────────────────────────────────────────────────────────
// Components
// ────────────────────────────────────────────────────────────────

type Mode = 'lazy' | 'hover' | 'always';

interface LazyStoryFrameProps {
  storyId: string;
  title?: string;
  subtitle?: string;
  mode?: Mode;
  priority?: Priority;
  decorations?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function useFrameLoadState(storyId: string, isMounted: boolean) {
  const [loaded, setLoaded] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  useEffect(() => {
    // Reset on storyId or mount changes.
    setLoaded(false);
    setFadingOut(false);
  }, [storyId, isMounted]);
  const onLoad = () => {
    setLoaded(true);
    // Trigger the fadeOut animation; the skeleton unmounts after the
    // animation finishes (in another effect).
    setFadingOut(true);
  };
  useEffect(() => {
    if (!fadingOut) return;
    const t = setTimeout(() => setFadingOut(false), 220);
    return () => clearTimeout(t);
  }, [fadingOut]);
  // Render the skeleton until the iframe has loaded; the fadeOut
  // animation drives the overlay's exit.
  const showSkeleton = !loaded || fadingOut;
  return { onLoad, showSkeleton, fading: fadingOut };
}

export function LazyStoryFrame({
  storyId,
  title,
  subtitle,
  mode = 'lazy',
  priority = 'normal',
  decorations,
  className,
  style,
}: LazyStoryFrameProps) {
  const [hovered, setHovered] = useState(false);
  const isMounted = useIsMounted(storyId);
  const { onLoad, showSkeleton, fading } = useFrameLoadState(storyId, isMounted);

  useEffect(() => {
    const want = mode === 'always' || mode === 'lazy' || (mode === 'hover' && hovered);
    if (want) requestMount(storyId, priority);
    else releaseMount(storyId);
    return () => releaseMount(storyId);
  }, [storyId, mode, hovered, priority]);

  return (
    <Wrap
      className={className}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {decorations}
      {isMounted ? (
        <>
          <StyledIframe
            src={`/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`}
            title={title || storyId}
            loading="lazy"
            onLoad={onLoad}
          />
          {showSkeleton && <LoadingSkeleton fading={fading} />}
        </>
      ) : (
        <Poster storyId={storyId} title={title} subtitle={subtitle} priority={priority} />
      )}
    </Wrap>
  );
}

/**
 * Scaled-down variant for thumbnail-grid cards.
 */
export function LazyThumbFrame(props: LazyStoryFrameProps) {
  const [hovered, setHovered] = useState(false);
  const isMounted = useIsMounted(props.storyId);
  const { onLoad, showSkeleton, fading } = useFrameLoadState(props.storyId, isMounted);

  useEffect(() => {
    const mode = props.mode ?? 'lazy';
    const want = mode === 'always' || mode === 'lazy' || (mode === 'hover' && hovered);
    if (want) requestMount(props.storyId, props.priority ?? 'normal');
    else releaseMount(props.storyId);
    return () => releaseMount(props.storyId);
  }, [props.storyId, props.mode, hovered, props.priority]);

  return (
    <Wrap
      className={props.className}
      style={props.style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {props.decorations}
      {isMounted ? (
        <>
          <ScaledIframe
            src={`/iframe.html?id=${encodeURIComponent(props.storyId)}&viewMode=story`}
            title={props.title || props.storyId}
            loading="lazy"
            onLoad={onLoad}
          />
          {showSkeleton && <LoadingSkeleton fading={fading} />}
        </>
      ) : (
        <Poster
          storyId={props.storyId}
          title={props.title}
          subtitle={props.subtitle}
          priority={props.priority ?? 'normal'}
        />
      )}
    </Wrap>
  );
}
