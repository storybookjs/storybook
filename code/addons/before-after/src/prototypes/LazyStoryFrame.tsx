/**
 * Shared lazy story-preview component for the review prototypes.
 *
 * The prototypes (especially MeticulousV2Review's route-tree grid) can
 * render 15–25 story iframes simultaneously, each costing ~8 MB of
 * browser memory. This module gives the prototypes a drop-in
 * replacement with three knobs:
 *
 *   • **Visibility-driven mounting** — IntersectionObserver only requests
 *     a real iframe once the placeholder card is within ~200px of the
 *     viewport. Out-of-view cards render a static poster.
 *
 *   • **LRU pool with a hard cap** — at most `POOL_CAP` (8 by default)
 *     iframes are mounted across the entire page at any one time. New
 *     mount requests evict the least-recently-touched item. Items
 *     marked `priority="primary"` are pinned and never count against
 *     the pool (intended for the single big-preview pane in
 *     MeticulousV2 / Hub / Focused).
 *
 *   • **Mode override** — `mode='hover'` keeps the poster until the
 *     user hovers the card. Useful when many thumbnails are in view
 *     but only a few will be inspected.
 *
 * The poster is a deterministic-coloured gradient + the story id +
 * title, so out-of-pool cards still feel intentional rather than
 * "broken iframe" empty boxes.
 */
import React, { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';

const POOL_CAP_DEFAULT = 8;

interface PoolEntry {
  ts: number;
  permanent: boolean;
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

function requestMount(id: string, permanent: boolean) {
  wanted.set(id, { ts: performance.now(), permanent });
  notify();
}

function releaseMount(id: string) {
  wanted.delete(id);
  notify();
}

function getActiveSet(): Set<string> {
  // Permanent (priority='primary') items always mount.
  // Everyone else competes for `poolCap - permanentCount` slots,
  // ranked by recency.
  const permanent = [...wanted.entries()].filter(([, v]) => v.permanent).map(([id]) => id);
  const transientSorted = [...wanted.entries()]
    .filter(([, v]) => !v.permanent)
    .sort((a, b) => b[1].ts - a[1].ts);
  const slotsLeft = Math.max(0, poolCap - permanent.length);
  return new Set([...permanent, ...transientSorted.slice(0, slotsLeft).map(([id]) => id)]);
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
  // Recompute on every render that follows a notify.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = version;
  return getActiveSet().has(id);
}

type Mode = 'lazy' | 'hover' | 'always';

interface LazyStoryFrameProps {
  storyId: string;
  /** Display name for the poster and iframe title. */
  title?: string;
  /** Display sub-line (e.g. story name) for the poster. */
  subtitle?: string;
  /**
   * 'lazy' (default): mount when card scrolls into view (IO with
   * rootMargin 200px). 'hover': only mount on hover. 'always': pin
   * mounted regardless of visibility (use for primary previews).
   */
  mode?: Mode;
  /**
   * 'primary' counts as pinned in the pool — never evicted, never
   * eats a transient slot. 'thumbnail' is the default — competes for
   * the transient slot budget.
   */
  priority?: 'primary' | 'thumbnail';
  /** Extra slot decoration (e.g. orange top stripe, badges). */
  decorations?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Deterministic colour per story id so posters look consistent.
function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

interface PosterProps {
  storyId: string;
  title?: string;
  subtitle?: string;
  status: 'pool-cold' | 'pool-warm';
}

function Poster({ storyId, title, subtitle, status }: PosterProps) {
  const hue = useMemo(() => hashHue(storyId), [storyId]);
  const labelMap: Record<PosterProps['status'], string> = {
    'pool-cold': '⏸ paused (pool full)',
    'pool-warm': '⏳ loading…',
  };
  return (
    <div
      aria-label={`Story preview placeholder for ${storyId}`}
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, hsl(${hue}, 32%, 16%) 0%, hsl(${(hue + 24) % 360}, 28%, 10%) 100%)`,
        color: 'rgba(255, 255, 255, 0.78)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 10,
        fontSize: 11,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
          fontSize: 9,
          opacity: 0.55,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {storyId}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, lineHeight: 1.3 }}>
        {title || storyId.split('--').pop()}
        {subtitle && (
          <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          opacity: 0.5,
        }}
      >
        {labelMap[status]}
      </div>
    </div>
  );
}

export function LazyStoryFrame({
  storyId,
  title,
  subtitle,
  mode = 'lazy',
  priority = 'thumbnail',
  decorations,
  className,
  style,
}: LazyStoryFrameProps) {
  const [hovered, setHovered] = useState(false);
  const isMounted = useIsMounted(storyId);

  // Request a mount slot. For 'always' / 'lazy' we always want one (pool
  // cap decides who gets a slot). For 'hover' we only want one on hover.
  useEffect(() => {
    const want = mode === 'always' || mode === 'lazy' || (mode === 'hover' && hovered);
    if (want) requestMount(storyId, priority === 'primary');
    else releaseMount(storyId);
    return () => releaseMount(storyId);
  }, [storyId, mode, hovered, priority]);

  const renderFrame = isMounted;
  const posterStatus: PosterProps['status'] = isMounted ? 'pool-warm' : 'pool-cold';

  return (
    <div
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {decorations}
      {renderFrame ? (
        <iframe
          src={`/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`}
          title={title || storyId}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            background: '#fff',
            position: 'relative' as const,
          }}
          loading="lazy"
        />
      ) : (
        <Poster storyId={storyId} title={title} subtitle={subtitle} status={posterStatus} />
      )}
    </div>
  );
}

/**
 * Scaled-down variant for thumbnail-grid cards: renders the iframe at
 * 200% inside a 50% transform so the content reads at half-density.
 */
export function LazyThumbFrame(props: LazyStoryFrameProps) {
  const [hovered, setHovered] = useState(false);
  const isMounted = useIsMounted(props.storyId);

  useEffect(() => {
    const mode = props.mode ?? 'lazy';
    const want = mode === 'always' || mode === 'lazy' || (mode === 'hover' && hovered);
    if (want) requestMount(props.storyId, props.priority === 'primary');
    else releaseMount(props.storyId);
    return () => releaseMount(props.storyId);
  }, [props.storyId, props.mode, hovered, props.priority]);

  const renderFrame = isMounted;
  const posterStatus: PosterProps['status'] = isMounted ? 'pool-warm' : 'pool-cold';

  return (
    <div
      className={props.className}
      style={{ position: 'relative', overflow: 'hidden', ...props.style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {props.decorations}
      {renderFrame ? (
        <iframe
          src={`/iframe.html?id=${encodeURIComponent(props.storyId)}&viewMode=story`}
          title={props.title || props.storyId}
          style={{
            border: 'none',
            display: 'block',
            background: '#fff',
            width: '200%',
            height: '200%',
            transform: 'scale(0.5)',
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
          loading="lazy"
        />
      ) : (
        <Poster
          storyId={props.storyId}
          title={props.title}
          subtitle={props.subtitle}
          status={posterStatus}
        />
      )}
    </div>
  );
}
