import React, { useCallback, useEffect, useRef, useState, type FC, type ReactNode } from 'react';

import { Button } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { prettifyComponentId } from '../review-grouping.ts';

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

const GRID_MIN_CELL_WIDTH = 300;
const GRID_GAP = 12;
const GRID_HORIZONTAL_PADDING = 24;
const MAX_ROWS = 2;
const INFO_TEXT_COLOR = '#2E3338';

/** Component title + story name for a story, resolved from the Storybook index. */
export interface StoryInfo {
  title: string;
  name: string;
}

const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 12,
  // 6px top padding leaves clearance for the cell's focus outline (2px
  // offset + 2px width = 4px outside the border box) — the parent
  // Collapsible clips with `overflow: hidden` for its open/close animation,
  // so without this the top edge of the outline gets cut off.
  padding: '6px 12px 12px',
});

const GridCell = styled.div(({ theme }) => ({
  position: 'relative',
  width: '100%',
  justifySelf: 'stretch',
  aspectRatio: '3 / 2',
  maxHeight: 400,
  borderRadius: 6,
  overflow: 'hidden',
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  // Reveal the floating story-info banner on hover or while any focusable
  // descendant (the GridLink itself, or the "Review all" button) is focused.
  '&:hover [data-story-info], &:focus-within [data-story-info]': {
    opacity: 1,
    transform: 'translateY(0)',
  },
  // Keyboard focus ring lives on the cell so it isn't clipped by the cell's
  // own `overflow: hidden`. Tabbing into the GridLink triggers `:focus-within`.
  '&:focus-within': {
    outline: 'rgb(0, 109, 235) solid 2px',
    outlineOffset: 2,
  },
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

const GridLink = styled.a({
  display: 'block',
  width: '100%',
  height: '100%',
  textDecoration: 'none',
  // Focus indicator is consolidated onto the parent GridCell so it isn't
  // clipped by the cell's overflow and matches the cell's rounded corners.
  outline: 'none',
});

// Floating story-info footer. Hidden by default — fades in on hover or
// keyboard focus of the parent cell (selectors live on GridCell). Flush
// full-width and clipped by the cell's rounded corners.
const InfoBar = styled.div(({ theme }) => ({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: 41,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '10px 16px',
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderTop: `1px solid ${theme.appBorderColor}`,
  fontFamily: theme.typography.fonts.base,
  fontSize: 14,
  lineHeight: '21px',
  opacity: 0,
  // Hidden state sits flush below the cell and slides up into view on reveal.
  transform: 'translateY(100%)',
  transition: 'opacity 120ms ease, transform 120ms ease',
  pointerEvents: 'none',
  // While the search field is focused, reveal every thumbnail's label at once
  // (the summary marks an ancestor with data-search-active).
  '[data-search-active] &': {
    opacity: 1,
    transform: 'translateY(0)',
  },
}));

const InfoComponent = styled.span({
  fontWeight: 700,
  color: INFO_TEXT_COLOR,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  maxWidth: '60%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const InfoSeparator = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  flexShrink: 0,
}));

const InfoStory = styled.span({
  fontWeight: 400,
  color: INFO_TEXT_COLOR,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

// Search matches are tinted with the accent colour; their weight is inherited
// so a match keeps the bold component / normal story styling.
const Mark = styled.mark(({ theme }) => ({
  background: 'transparent',
  color: theme.color.secondary,
  fontWeight: 'inherit',
}));

const storyPreviewUrl = (id: string) =>
  `iframe.html?id=${encodeURIComponent(id)}&viewMode=story&freeze=finished`;

const isWithinPreloadRange = (element: HTMLElement, margin: number): boolean => {
  const rect = element.getBoundingClientRect();
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
  const hostRef = useRef<HTMLDivElement>(null);
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

  const content = (
    <>
      {src ? (
        <StoryPreview
          title={storyId}
          src={src}
          tabIndex={-1}
          scrolling="no"
          onLoad={finishCurrent}
          onError={finishCurrent}
        />
      ) : null}
      <InfoBar data-story-info>
        <InfoComponent>
          <Highlight text={component} query={query} />
        </InfoComponent>
        <InfoSeparator>/</InfoSeparator>
        <InfoStory>
          <Highlight text={name} query={query} />
        </InfoStory>
      </InfoBar>
    </>
  );

  return (
    <GridCell
      ref={hostRef}
      data-testid="review-collection-grid-cell"
      onMouseEnter={forceStartCurrent}
      onFocus={forceStartCurrent}
    >
      {href ? (
        <GridLink href={href} aria-label={`Review story ${storyId}`}>
          {content}
        </GridLink>
      ) : (
        content
      )}
    </GridCell>
  );
};

export interface CollectionGridProps {
  storyIds: string[];
  getStoryHref?: (storyId: string, storyIndex: number) => string | undefined;
  /** Persisted "review all" state from the parent list. */
  showAll?: boolean;
  /** Called when the user expands to "Review all". */
  onShowAll?: () => void;
  /** Story id → component title + story name, for the floating thumbnail label. */
  storyInfo?: Record<string, StoryInfo>;
  /** Active search query — matches in the thumbnail label are highlighted. */
  query?: string;
}

export const CollectionGrid: FC<CollectionGridProps> = ({
  storyIds,
  getStoryHref,
  showAll = false,
  onShowAll,
  storyInfo,
  query = '',
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [columnsPerRow, setColumnsPerRow] = useState(1);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return undefined;
    }

    const updateColumns = () => {
      const contentWidth = Math.max(0, grid.clientWidth - GRID_HORIZONTAL_PADDING);
      const nextColumns = Math.max(
        1,
        Math.floor((contentWidth + GRID_GAP) / (GRID_MIN_CELL_WIDTH + GRID_GAP))
      );
      setColumnsPerRow(nextColumns);
    };

    updateColumns();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateColumns);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const maxCells = columnsPerRow * MAX_ROWS;
  const hasOverflow = !showAll && storyIds.length > maxCells;
  // Reserve the last cell for the "Review all" button only while collapsed.
  const visibleStoryCount = hasOverflow ? Math.max(0, maxCells - 1) : storyIds.length;
  const previewStoryIds = storyIds.slice(0, visibleStoryCount);

  return (
    <Grid ref={gridRef} data-testid="review-collection-grid">
      {previewStoryIds.map((storyId, storyIndex) => (
        <StoryPreviewCell
          key={storyId}
          storyId={storyId}
          href={getStoryHref?.(storyId, storyIndex)}
          info={storyInfo?.[storyId]}
          query={query}
        />
      ))}
      {hasOverflow && (
        <GridCell data-testid="review-collection-grid-cell">
          <CellAction>
            <Button
              size="medium"
              onClick={() => {
                onShowAll?.();
              }}
            >
              Review all {storyIds.length}
            </Button>
          </CellAction>
        </GridCell>
      )}
    </Grid>
  );
};
