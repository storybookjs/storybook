import React, { type FC } from 'react';

import { Badge, Button } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { fallbackStoryInfo, type StoryInfo } from '../review-types.ts';
import {
  computeThumbnailMinHeight,
  DEFAULT_CONTENT_HEIGHT,
  DEFAULT_CONTENT_WIDTH,
} from './iframeResizeMessage.ts';
import { usePreviewThumbnail } from './usePreviewThumbnail.ts';

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

const GRID_CHILD_ROW_SPAN = 2;

const Grid = styled.div({
  display: 'grid',
  alignItems: 'stretch',
  gap: 12,
  padding: 12,
  gridTemplateColumns: 'minmax(0, 1fr)',
  '@container review-grid (max-width: 629.98px)': band(1),
  '@container review-grid (min-width: 630px) and (max-width: 844.98px)': band(2),
  '@container review-grid (min-width: 845px) and (max-width: 1259.98px)': band(3),
  '@container review-grid (min-width: 1260px)': band(4),
});

const Cell = styled.div({
  display: 'grid',
  gridTemplateRows: 'subgrid',
  gridRow: `span ${GRID_CHILD_ROW_SPAN}`,
  gap: 0,
  minWidth: 0,
});

// Visual fit (scale, aspect ratio) lives in CSS; subgrid row growth uses inline
// minHeight from computeThumbnailMinHeight — CSS minHeight does not propagate.
const Frame = styled.a(({ theme }) => ({
  position: 'relative',
  display: 'block',
  width: '100%',
  height: '100%',
  alignSelf: 'stretch',
  containerType: 'inline-size',
  containerName: 'preview-frame',
  '--content-w': DEFAULT_CONTENT_WIDTH,
  '--content-h': DEFAULT_CONTENT_HEIGHT,
  '--fit': 'min(1, calc(100cqw / (var(--content-w) * 1px)))',
  '--scale': 'max(0.5, min(1, round(down, var(--fit), 0.25)))',
  '--scaled-h': 'calc(var(--content-h) * var(--scale) * 1px)',
  '--thirds': 'clamp(1, round(up, calc(3 * var(--scaled-h) / 100cqw), 1), 4)',
  aspectRatio: 'calc(3 / var(--thirds))',
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
  width: 'calc(100% / var(--scale))',
  height: 'calc(100% / var(--scale))',
  background: theme.background.preview,
  border: 0,
  display: 'block',
  transform: 'scale(var(--scale))',
  transformOrigin: 'top left',
  pointerEvents: 'none',
}));

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
  marginRight: 4,
});

const NewBadge = styled(Badge)({
  flexShrink: 0,
});

const ReviewAllCell = styled(Cell)({
  display: 'none',
});

const ReviewAllFrame = styled.div(({ theme }) => ({
  display: 'grid',
  placeItems: 'center',
  width: '100%',
  height: '100%',
  minHeight: 50,
  alignSelf: 'stretch',
  borderRadius: 6,
  background: theme.background.app,
  border: `1px dashed ${theme.appBorderColor}`,
}));

const deriveStoryInfo = (info: StoryInfo): { component: string; name: string } => ({
  component: info.title.split('/').pop() ?? info.title,
  name: info.name,
});

const StoryPreviewCell: FC<{
  storyId: string;
  href?: string;
  info: StoryInfo;
  getPreviewHref: (storyId: string) => string;
  previewsPaused?: boolean;
}> = ({ storyId, href, info, getPreviewHref, previewsPaused = false }) => {
  const {
    cellRef,
    frameRef,
    iframeRef,
    src,
    rememberedDimensions,
    frameWidth,
    forceStartCurrent,
    finishCurrent,
  } = usePreviewThumbnail({ storyId, getPreviewHref, previewsPaused });

  const { component, name } = deriveStoryInfo(info);
  const contentWidth = rememberedDimensions?.width ?? DEFAULT_CONTENT_WIDTH;
  const contentHeight = rememberedDimensions?.height ?? DEFAULT_CONTENT_HEIGHT;
  const minHeight =
    frameWidth > 0 ? computeThumbnailMinHeight(contentWidth, contentHeight, frameWidth) : undefined;

  const frameStyle = {
    ...(rememberedDimensions
      ? ({
          '--content-w': rememberedDimensions.width,
          '--content-h': rememberedDimensions.height,
        } as React.CSSProperties)
      : undefined),
    ...(minHeight !== undefined ? { minHeight } : undefined),
  };

  const preview = src ? (
    <Preview
      ref={iframeRef}
      title={storyId}
      src={src}
      data-content-width={rememberedDimensions?.width}
      data-content-height={rememberedDimensions?.height}
      tabIndex={-1}
      scrolling="no"
      onLoad={finishCurrent}
      onError={finishCurrent}
    />
  ) : null;

  return (
    <Cell ref={cellRef} data-cell data-testid="review-collection-grid-cell">
      <Frame
        as={href ? 'a' : 'div'}
        {...(href ? { href } : {})}
        ref={frameRef as React.Ref<HTMLAnchorElement>}
        style={frameStyle}
        aria-label={href ? `Review story ${storyId}` : undefined}
        onMouseEnter={forceStartCurrent}
        onFocus={forceStartCurrent}
      >
        {preview}
      </Frame>
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
        <ReviewAllFrame>
          <Button size="medium" onClick={() => onShowAll?.()}>
            Review all {storyIds.length}
          </Button>
        </ReviewAllFrame>
        <ActionBar aria-hidden="true" />
      </ReviewAllCell>
    </Grid>
  </GridContainer>
);
