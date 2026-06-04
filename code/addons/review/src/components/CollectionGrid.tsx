import React, { useCallback, useEffect, useRef, useState, type FC, type ReactNode } from 'react';

import { Button } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { prettifyComponentId } from '../review-grouping.ts';
import { storyPreviewUrl } from '../review-navigation.ts';

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

/**
 * Viewport-relative margins (as IntersectionObserver `rootMargin`) for the
 * preview lifecycle. A cell mounts its iframe once within one viewport of the
 * fold and is evicted (iframe unmounted, memory freed) only once roughly three
 * viewports away. The gap is hysteresis: a cell that briefly leaves the mount
 * zone isn't torn down until it's well offscreen, so scrolling near a boundary
 * doesn't thrash. This bounds live iframes to ~6–7 screens regardless of how
 * many stories the review has.
 */
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

function pumpPreviewQueue(): void {
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
  pumpPreviewQueue();
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
  pumpPreviewQueue();
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

/** Component title + story name for a story, resolved from the Storybook index. */
export interface StoryInfo {
  title: string;
  name: string;
}

// Column count is driven entirely by container width — 1 column on narrow
// (mobile) widths up to 4 on wide screens — with each cell clamped to 400px so
// a lone preview never stretches across the card. Each band also caps the grid
// to two rows: once more stories exist than fit, the overflow cells are hidden
// and a "Review all" cell takes the last visible slot. Both behaviors are pure
// CSS (`:has()` + `:nth-child`), so no layout measurement runs in JS.
const band = (cols: number) => {
  const cap = cols * 2;
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 400px))`,
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
  justifyContent: 'start',
  // Fallback for browsers without container-query support: a single column and
  // no two-row cap (every story is shown).
  gridTemplateColumns: 'minmax(0, 400px)',
  // Bands are mutually exclusive (ranged) so a narrower band's overflow rules
  // never bleed into a wider one.
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

const Preview = styled.iframe({
  position: 'absolute',
  inset: 0,
  width: `${(1 / PREVIEW_SCALE) * 100}%`,
  height: `${(1 / PREVIEW_SCALE) * 100}%`,
  border: 0,
  display: 'block',
  transform: `scale(${PREVIEW_SCALE})`,
  transformOrigin: 'top left',
  pointerEvents: 'none',
});

// The info/action bar below the preview: the component/story label stretches
// and ellipsizes on the left; the action slot on the right never wraps.
const ActionBar = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: 36,
});

const Label = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flex: 1,
  minWidth: 0,
  marginLeft: 10,
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
});

const ActionSlot = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

const ReviewAllCell = styled.div(({ theme }) => ({
  display: 'none',
  placeItems: 'center',
  width: '100%',
  aspectRatio: '3 / 2',
  borderRadius: 6,
  background: theme.background.app,
  border: `1px dashed ${theme.appBorderColor}`,
}));

// Search matches are tinted with the accent colour; weight is inherited so a
// match keeps the bold component / normal story styling.
const Mark = styled.mark(({ theme }) => ({
  background: 'transparent',
  color: theme.color.secondary,
  fontWeight: 'inherit',
}));

const isWithinPreloadRange = (element: HTMLElement, margin: number): boolean => {
  const rect = element.getBoundingClientRect();
  // Hidden cells (e.g. overflow beyond the two-row cap) have a zero-size box;
  // don't seed them in-view or they'd boot iframes that never show.
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  const viewportHeight =
    typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight || 0;
  return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
};

// Render `text`, wrapping every case-insensitive occurrence of `query` in a
// <Mark>. With no query the text renders untouched.
const Highlight: FC<{ text: string; query: string }> = ({ text, query }) => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return <>{text}</>;
  }
  const haystack = text.toLowerCase();
  const segments: ReactNode[] = [];
  let cursor = 0;
  let match = haystack.indexOf(needle);
  let key = 0;
  while (match !== -1) {
    if (match > cursor) {
      segments.push(text.slice(cursor, match));
    }
    segments.push(<Mark key={key++}>{text.slice(match, match + needle.length)}</Mark>);
    cursor = match + needle.length;
    match = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }
  return <>{segments}</>;
};

const deriveStoryInfo = (
  storyId: string,
  info?: StoryInfo
): { component: string; name: string } => {
  if (info) {
    return { component: info.title.split('/').pop() ?? info.title, name: info.name };
  }
  const [componentId, ...rest] = storyId.split('--');
  return {
    component: prettifyComponentId(componentId),
    name: prettifyComponentId(rest.join('--')) || 'Story',
  };
};

const StoryPreviewCell: FC<{
  storyId: string;
  href?: string;
  info?: StoryInfo;
  query: string;
}> = ({ storyId, href, info, query }) => {
  const hostRef = useRef<HTMLAnchorElement>(null);
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
    // Snappy first paint for above-the-fold cells: the observers' initial
    // callbacks are deferred to the next frame, so seed the state synchronously.
    if (isWithinPreloadRange(host, typeof window === 'undefined' ? 0 : window.innerHeight)) {
      setIsInView(true);
    }
    // Mount when the cell comes within the mount margin of the viewport.
    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { rootMargin: PREVIEW_MOUNT_ROOT_MARGIN }
    );
    // Evict once the cell moves beyond the (larger) evict margin, unmounting
    // its iframe to free the preview runtime. The margin gap is hysteresis.
    const evictObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setIsInView(false);
        }
      },
      { rootMargin: PREVIEW_EVICT_ROOT_MARGIN }
    );
    mountObserver.observe(host);
    evictObserver.observe(host);
    return () => {
      mountObserver.disconnect();
      evictObserver.disconnect();
    };
  }, []);

  // Eviction: when the cell scrolls well out of range, drop the iframe so its
  // preview runtime is reclaimed. It re-enqueues (below) if it scrolls back.
  useEffect(() => {
    if (!isInView) {
      setSrc(undefined);
    }
  }, [isInView]);

  // Once in view, enqueue a scheduler task; it sets `src` when a slot frees.
  useEffect(() => {
    if (!isInView) {
      return undefined;
    }
    const task: PreviewTask = {
      start: () => setSrc(storyPreviewUrl(storyId)),
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
  }, [isInView, storyId]);

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

  const { component, name } = deriveStoryInfo(storyId, info);

  return (
    <Cell data-cell data-testid="review-collection-grid-cell">
      <Frame
        as={href ? 'a' : 'div'}
        href={href}
        ref={hostRef}
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
      <ActionBar>
        <Label>
          <LabelComponent>
            <Highlight text={component} query={query} />
          </LabelComponent>
          <LabelSeparator>/</LabelSeparator>
          <LabelStory>
            <Highlight text={name} query={query} />
          </LabelStory>
        </Label>
        <ActionSlot />
      </ActionBar>
    </Cell>
  );
};

export interface CollectionGridProps {
  storyIds: string[];
  getStoryHref?: (storyId: string, storyIndex: number) => string | undefined;
  /** Persisted "review all" state from the parent list. */
  showAll?: boolean;
  /** Called when the user expands to "Review all". */
  onShowAll?: () => void;
  /** Story id → component title + story name, for the cell label. */
  storyInfo?: Record<string, StoryInfo>;
  /** Active search query — matches in the cell label are highlighted. */
  query?: string;
}

export const CollectionGrid: FC<CollectionGridProps> = ({
  storyIds,
  getStoryHref,
  showAll = false,
  onShowAll,
  storyInfo,
  query = '',
}) => (
  <GridContainer>
    <Grid data-show-all={showAll || undefined} data-testid="review-collection-grid">
      {storyIds.map((storyId, storyIndex) => (
        <StoryPreviewCell
          key={storyId}
          storyId={storyId}
          href={getStoryHref?.(storyId, storyIndex)}
          info={storyInfo?.[storyId]}
          query={query}
        />
      ))}
      <ReviewAllCell data-review-all>
        <Button size="medium" onClick={() => onShowAll?.()}>
          Review all {storyIds.length}
        </Button>
      </ReviewAllCell>
    </Grid>
  </GridContainer>
);
