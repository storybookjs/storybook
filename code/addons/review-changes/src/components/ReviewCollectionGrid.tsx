import { type FC, useEffect, useRef, useState } from 'react';

import { Button } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

const PREVIEW_SCALE = 0.5;
const GRID_MIN_CELL_WIDTH = 300;
const GRID_GAP = 12;
const GRID_HORIZONTAL_PADDING = 24;
const MAX_ROWS = 2;

const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 12,
  padding: '0 12px 12px',
});

const GridCell = styled.div(({ theme }) => ({
  width: '100%',
  justifySelf: 'stretch',
  aspectRatio: '3 / 2',
  maxHeight: 400,
  borderRadius: 6,
  overflow: 'hidden',
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
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

const storyPreviewUrl = (id: string) => `iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;

const StoryPreviewCell: FC<{ storyId: string }> = ({ storyId }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || hasMounted) {
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

  return (
    <GridCell ref={hostRef} data-testid="review-collection-grid-cell">
      {hasMounted ? (
        <StoryPreview
          title={storyId}
          src={storyPreviewUrl(storyId)}
          loading="lazy"
          tabIndex={-1}
          scrolling="no"
        />
      ) : null}
    </GridCell>
  );
};

export interface ReviewCollectionGridProps {
  storyIds: string[];
}

export const ReviewCollectionGrid: FC<ReviewCollectionGridProps> = ({ storyIds }) => {
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
  const hasOverflow = storyIds.length > maxCells;
  const visibleStoryCount = hasOverflow ? Math.max(0, maxCells - 1) : maxCells;
  const previewStoryIds = storyIds.slice(0, visibleStoryCount);

  return (
    <Grid ref={gridRef} data-testid="review-collection-grid">
      {previewStoryIds.map((storyId) => (
        <StoryPreviewCell key={storyId} storyId={storyId} />
      ))}
      {hasOverflow && (
        <GridCell data-testid="review-collection-grid-cell">
          <CellAction>
            <Button size="medium">Review all {storyIds.length}</Button>
          </CellAction>
        </GridCell>
      )}
    </Grid>
  );
};
