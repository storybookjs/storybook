import React, { type FC, type ReactNode, useEffect, useRef, useState } from 'react';

import { Button } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { prettifyComponentId } from '../review-grouping.ts';

const PREVIEW_SCALE = 0.5;
const GRID_MIN_CELL_WIDTH = 300;
const GRID_GAP = 12;
const GRID_HORIZONTAL_PADDING = 24;
const MAX_ROWS = 2;

/** Component title + story name for a story, resolved from the Storybook index. */
export interface StoryInfo {
  title: string;
  name: string;
}

const Grid = styled.div({
  display: 'grid',
  // Keep the CSS min track width in sync with the JS column-count math so
  // overflow / "Review all" behavior can't drift from the rendered layout.
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${GRID_MIN_CELL_WIDTH}px), 1fr))`,
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
  transition: 'border-color 120ms ease',
  // Reveal the floating story-info banner on hover or while any focusable
  // descendant (the GridLink itself, or the "Review all" button) is focused.
  '&:hover [data-story-info], &:focus-within [data-story-info]': {
    opacity: 1,
    transform: 'translateY(0)',
  },
  '&:hover': {
    borderColor: theme.color.secondary,
  },
  // Keyboard focus ring lives on the cell so it isn't clipped by the cell's
  // own `overflow: hidden`. Tabbing into the GridLink triggers `:focus-within`.
  '&:focus-within': {
    outline: `${theme.barSelectedColor} solid 2px`,
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
  // Frosted overlay tuned per theme base so it stays a light scrim in light
  // mode and a dark scrim in dark mode instead of always translucent white.
  background: theme.base === 'dark' ? 'rgba(22, 23, 24, 0.85)' : 'rgba(255, 255, 255, 0.9)',
  color: theme.color.defaultText,
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
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
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || hasMounted) {
      return undefined;
    }
    // Ensure above-the-fold previews mount on first paint even if the initial
    // IntersectionObserver callback is deferred until the next scroll.
    if (isWithinPreloadRange(host, 200)) {
      setHasMounted(true);
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setHasMounted(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [hasMounted]);

  const { component, name } = deriveStoryInfo(storyId, info);

  const content = (
    <>
      {hasMounted ? (
        <StoryPreview
          title={storyId}
          src={storyPreviewUrl(storyId)}
          loading="lazy"
          tabIndex={-1}
          scrolling="no"
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
    <GridCell ref={hostRef} data-testid="review-collection-grid-cell">
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
