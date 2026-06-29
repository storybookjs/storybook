import React, { useCallback, useEffect, useRef, useState, type FC } from 'react';

import { Badge, Button, TooltipNote, WithTooltip } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

const PREVIEW_SCALE = 0.5;

/**
 * Each thumbnail is a full Storybook preview iframe, and booting one fires
 * dozens of module requests. Mounting every in-view thumbnail at once (wide
 * grids, or "Review all") floods the browser's connection pool and trips
 * `net::ERR_INSUFFICIENT_RESOURCES`, leaving some iframes permanently blank.
 *
 * The scheduler below caps how many previews boot concurrently across the
 * whole review page. A cell enqueues a task before it sets the iframe `src`;
 * the task starts when a slot is free and finishes once the iframe loads
 * (or errors / settles), so previews drain in waves instead of all at once.
 * Hovering a cell promotes its task to start immediately, bypassing the cap.
 */
const MAX_CONCURRENT_PREVIEWS = 3;
/**
 * A started preview frees its slot when its iframe fires `load`, or after this
 * delay — whichever comes first. The timeout guarantees the queue keeps
 * draining automatically even when `load` is slow or never fires (so previews
 * advance in steady waves rather than waiting on a single stuck frame), while
 * still rate-limiting how fast new iframes boot to avoid flooding the network.
 */
const PREVIEW_SETTLE_TIMEOUT_MS = 1500;

// IntersectionObserver `rootMargin`s for the preview lifecycle: mount a cell's
// iframe within one root-height of the fold, evict it past two. The gap is
// hysteresis so scrolling near a boundary doesn't thrash. These margins only
// take effect when the observer's `root` is the real scroll container (see
// `getScrollRoot`); `rootMargin` is not applied to intermediate scrollers, so
// against the default viewport root they would be silently clipped to zero.
const PREVIEW_MOUNT_ROOT_MARGIN = '100% 0px';
const PREVIEW_EVICT_ROOT_MARGIN = '200% 0px';

interface PreviewTask {
  /** Assigns the iframe src, kicking off the actual load. */
  start: () => void;
  started: boolean;
  finished: boolean;
}

let activePreviewLoads = 0;
const previewQueue: PreviewTask[] = [];

function startQueuedPreviews(): void {
  while (activePreviewLoads < MAX_CONCURRENT_PREVIEWS) {
    const task = previewQueue.shift();
    if (!task) {
      return;
    }
    if (task.started || task.finished) {
      continue;
    }
    task.started = true;
    activePreviewLoads += 1;
    task.start();
  }
}

function enqueuePreview(task: PreviewTask): void {
  previewQueue.push(task);
  startQueuedPreviews();
}

/** Mark a task done (load/error/settle/unmount) and let the next one start. */
function finishPreview(task: PreviewTask): void {
  if (task.finished) {
    return;
  }
  task.finished = true;
  if (task.started) {
    activePreviewLoads = Math.max(0, activePreviewLoads - 1);
  } else {
    const index = previewQueue.indexOf(task);
    if (index !== -1) {
      previewQueue.splice(index, 1);
    }
  }
  startQueuedPreviews();
}

/** Hover/focus: start a still-queued preview right away, bypassing the cap. */
function forceStartPreview(task: PreviewTask): void {
  if (task.started || task.finished) {
    return;
  }
  const index = previewQueue.indexOf(task);
  if (index !== -1) {
    previewQueue.splice(index, 1);
  }
  task.started = true;
  activePreviewLoads += 1;
  task.start();
}

export type StoryChangeStatus = 'new' | 'modified';

export interface StoryInfo {
  title: string;
  name: string;
  isNewlyAdded?: boolean;
  changeStatus?: StoryChangeStatus;
}

/** Best-effort labels when the Storybook index has not resolved a story yet. */
export const fallbackStoryInfo = (storyId: string): StoryInfo => {
  const separator = storyId.indexOf('--');
  if (separator === -1) {
    return { title: storyId, name: 'Story' };
  }
  return {
    title: storyId.slice(0, separator),
    name: storyId.slice(separator + 2) || 'Story',
  };
};

// Per-breakpoint grid: `cols` columns (each cell clamped to 400px) capped at
// two rows. Overflow beyond the cap is hidden and a "Review all" cell takes the
// last slot — all via CSS (`:has()` + `:nth-child`), no JS measurement.
const band = (cols: number) => {
  const cap = cols * 2;
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    [`&:not([data-show-all]):has(> [data-cell]:nth-child(${cap + 1})) > [data-cell]:nth-child(n + ${cap})`]:
      {
        display: 'none',
      },
    [`&:not([data-show-all]):has(> [data-cell]:nth-child(${cap + 1})) > [data-review-all]`]: {
      display: 'grid',
    },
  };
};

const GridContainer = styled.div({
  containerType: 'inline-size',
  containerName: 'review-grid',
});

const Grid = styled.div({
  display: 'grid',
  gap: 12,
  padding: 12,
  // Fallback for browsers without container-query support: a single column and
  // no two-row cap (every story is shown).
  gridTemplateColumns: 'minmax(0, 1fr)',
  // Bands are mutually exclusive (ranged) so a narrower band's overflow rules
  // never bleed into a wider one. The .98 upper bounds sit just below the next
  // band's integer `min-width` so the two never both match at the boundary.
  '@container review-grid (max-width: 629.98px)': band(1),
  '@container review-grid (min-width: 630px) and (max-width: 844.98px)': band(2),
  '@container review-grid (min-width: 845px) and (max-width: 1259.98px)': band(3),
  '@container review-grid (min-width: 1260px)': band(4),
});

const Cell = styled.div({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

// The bordered, clickable preview frame. Rendered as an <a> when a detail href
// is provided, otherwise a plain <div>. Hover and keyboard focus are indicated
// here (not on the surrounding cell) since the frame is the interactive target.
const Frame = styled.a(({ theme }) => ({
  position: 'relative',
  display: 'block',
  width: '100%',
  aspectRatio: '3 / 2',
  borderRadius: 6,
  overflow: 'hidden',
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  transition: 'border-color 120ms ease',
  textDecoration: 'none',
  outline: 'none',
  '&[href]:hover': {
    borderColor: theme.color.secondary,
  },
  '&:focus-visible': {
    outline: `${theme.barSelectedColor} solid 2px`,
    outlineOffset: 2,
  },
}));

const Preview = styled.iframe(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  width: `${(1 / PREVIEW_SCALE) * 100}%`,
  height: `${(1 / PREVIEW_SCALE) * 100}%`,
  background: theme.background.preview,
  border: 0,
  display: 'block',
  transform: `scale(${PREVIEW_SCALE})`,
  transformOrigin: 'top left',
  pointerEvents: 'none',
}));

// The info/action bar below the preview: the component/story label stretches
// and ellipsizes on the left; the action slot on the right never wraps.
const ActionBar = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: 40,
});

const Label = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flex: 1,
  minWidth: 0,
  marginLeft: 12,
  overflow: 'hidden',
});

const LabelComponent = styled.span({
  fontWeight: 700,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  maxWidth: '60%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const LabelSeparator = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  flexShrink: 0,
}));

const LabelStory = styled.span({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginRight: 4,
});

const NewBadge = styled(Badge)({
  flexShrink: 0,
});

const ReviewAllCell = styled.div(({ theme }) => ({
  display: 'none',
  placeItems: 'center',
  width: '100%',
  aspectRatio: '3 / 2',
  borderRadius: 6,
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
}));

// The cell lives inside a scrollable container (the review page keeps a single
// Radix ScrollArea as its scroller), not the document viewport. The lifecycle
// observers must use that container as their `root`, otherwise `rootMargin` is
// ignored and cells evict the moment they leave the scroller. Falls back to the
// viewport (null) when there is no scroll container, e.g. fullscreen stories.
const getScrollRoot = (element: HTMLElement): HTMLElement | null => {
  const radixViewport = element.closest<HTMLElement>('[data-radix-scroll-area-viewport]');
  if (radixViewport) {
    return radixViewport;
  }
  let current = element.parentElement;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const isWithinPreloadRange = (
  element: HTMLElement,
  root: HTMLElement | null,
  margin: number
): boolean => {
  const rect = element.getBoundingClientRect();
  // Hidden cells (e.g. overflow beyond the two-row cap) have a zero-size box;
  // don't seed them in-view or they'd boot iframes that never show.
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  if (root) {
    const rootRect = root.getBoundingClientRect();
    return rect.bottom >= rootRect.top - margin && rect.top <= rootRect.bottom + margin;
  }
  const viewportHeight =
    typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight || 0;
  return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
};

const deriveStoryInfo = (info: StoryInfo): { component: string; name: string } => ({
  component: info.title.split('/').pop() ?? info.title,
  name: info.name,
});

const getPreloadMargin = (scrollRoot: HTMLElement | null): number => {
  if (!scrollRoot) {
    return typeof window === 'undefined' ? 0 : window.innerHeight;
  }
  return scrollRoot.clientHeight || window.innerHeight;
};

const StoryPreviewCell: FC<{
  storyId: string;
  href?: string;
  info: StoryInfo;
  getPreviewHref: (storyId: string) => string;
  previewsPaused?: boolean;
}> = ({ storyId, href, info, getPreviewHref, previewsPaused = false }) => {
  const hostRef = useRef<HTMLElement>(null);
  const previewsPausedRef = useRef(previewsPaused);
  previewsPausedRef.current = previewsPaused;
  const [isInView, setIsInView] = useState(false);
  // `src` stays unset until the scheduler starts this preview; the iframe only
  // mounts (and starts requesting) once it does.
  const [src, setSrc] = useState<string | undefined>(undefined);
  const taskRef = useRef<PreviewTask | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return undefined;
    }
    const scrollRoot = getScrollRoot(host);
    const effectiveRoot = scrollRoot && scrollRoot.clientHeight > 0 ? scrollRoot : null;
    const markInViewIfClose = () => {
      if (isWithinPreloadRange(host, effectiveRoot, getPreloadMargin(scrollRoot))) {
        setIsInView(true);
      }
    };
    // Snappy first paint for above-the-fold cells: the observers' initial
    // callbacks are deferred to the next frame, so seed the state synchronously.
    markInViewIfClose();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => markInViewIfClose())
        : undefined;
    resizeObserver?.observe(host);
    // Mount when the cell comes within the mount margin of the scroll root.
    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { root: effectiveRoot, rootMargin: PREVIEW_MOUNT_ROOT_MARGIN }
    );
    // Evict once the cell moves beyond the (larger) evict margin, unmounting
    // its iframe to free the preview runtime. The margin gap is hysteresis.
    const evictObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !previewsPausedRef.current) {
          setIsInView(false);
        }
      },
      { root: effectiveRoot, rootMargin: PREVIEW_EVICT_ROOT_MARGIN }
    );
    mountObserver.observe(host);
    evictObserver.observe(host);
    return () => {
      resizeObserver?.disconnect();
      mountObserver.disconnect();
      evictObserver.disconnect();
    };
  }, []);

  // Eviction: when the cell scrolls well out of range, drop the iframe so its
  // preview runtime is reclaimed. It re-enqueues (below) if it scrolls back.
  useEffect(() => {
    if (!isInView && !previewsPaused) {
      setSrc(undefined);
    }
  }, [isInView, previewsPaused]);

  // Once in view, enqueue a scheduler task; it sets `src` when a slot frees.
  useEffect(() => {
    if (!isInView) {
      return undefined;
    }
    const previewHref = getPreviewHref(storyId);
    const task: PreviewTask = {
      start: () => {
        setSrc((current) => current ?? previewHref);
      },
      started: false,
      finished: false,
    };
    taskRef.current = task;
    enqueuePreview(task);
    return () => {
      // Unmounting / scrolling away before load frees the slot (or dequeues).
      finishPreview(task);
      taskRef.current = null;
    };
  }, [isInView, storyId, getPreviewHref]);

  const finishCurrent = useCallback(() => {
    if (taskRef.current) {
      finishPreview(taskRef.current);
    }
  }, []);

  // Hover or keyboard focus promotes this preview to start immediately.
  const forceStartCurrent = useCallback(() => {
    if (taskRef.current) {
      forceStartPreview(taskRef.current);
    }
  }, []);

  // Free this preview's slot a short time after it starts even if `load`
  // hasn't fired, so the queue keeps draining automatically in steady waves.
  useEffect(() => {
    if (!src) {
      return undefined;
    }
    const timer = setTimeout(finishCurrent, PREVIEW_SETTLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [src, finishCurrent]);

  const { component, name } = deriveStoryInfo(info);

  return (
    <Cell data-cell data-testid="review-collection-grid-cell">
      <WithTooltip trigger="hover" tooltip={<TooltipNote note="Open story" />} hasChrome={false}>
        <Frame
          as={href ? 'a' : 'div'}
          href={href}
          ref={hostRef as React.RefObject<HTMLAnchorElement>}
          aria-label={href ? `Review story ${storyId}` : undefined}
          onMouseEnter={forceStartCurrent}
          onFocus={forceStartCurrent}
        >
          {src ? (
            <Preview
              title={storyId}
              src={src}
              tabIndex={-1}
              scrolling="no"
              onLoad={finishCurrent}
              onError={finishCurrent}
            />
          ) : null}
        </Frame>
      </WithTooltip>
      <ActionBar>
        <Label>
          <LabelComponent>{component}</LabelComponent>
          <LabelSeparator>/</LabelSeparator>
          <LabelStory>{name}</LabelStory>
          {info.changeStatus === 'new' || info.isNewlyAdded ? (
            <NewBadge status="positive" compact>
              New
            </NewBadge>
          ) : null}
        </Label>
      </ActionBar>
    </Cell>
  );
};

export interface CollectionGridProps {
  storyIds: string[];
  getStoryHref?: (storyId: string, storyIndex: number) => string | undefined;
  /** Builds the (frozen) preview iframe src for a story thumbnail. */
  getStoryPreviewHref: (storyId: string) => string;
  /** Persisted "review all" state from the parent list. */
  showAll?: boolean;
  /** Called when the user expands to "Review all". */
  onShowAll?: () => void;
  /** Story id → component title + story name, for the cell label. */
  storyInfo: Record<string, StoryInfo>;
  /** Keep loaded previews mounted while the summary overlay is hidden. */
  previewsPaused?: boolean;
}

export const CollectionGrid: FC<CollectionGridProps> = ({
  storyIds,
  getStoryHref,
  getStoryPreviewHref,
  showAll = false,
  onShowAll,
  storyInfo,
  previewsPaused = false,
}) => (
  <GridContainer>
    <Grid data-show-all={showAll || undefined} data-testid="review-collection-grid">
      {storyIds.map((storyId, storyIndex) => {
        const info = storyInfo[storyId] ?? fallbackStoryInfo(storyId);
        return (
          <StoryPreviewCell
            key={storyId}
            storyId={storyId}
            href={getStoryHref?.(storyId, storyIndex)}
            info={info}
            getPreviewHref={getStoryPreviewHref}
            previewsPaused={previewsPaused}
          />
        );
      })}
      <ReviewAllCell data-review-all>
        <Button size="medium" onClick={() => onShowAll?.()}>
          Review all {storyIds.length}
        </Button>
      </ReviewAllCell>
    </Grid>
  </GridContainer>
);
