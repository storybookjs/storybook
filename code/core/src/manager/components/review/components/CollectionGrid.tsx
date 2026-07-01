import React, { type FC } from 'react';

import { Badge, Button, Loader } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { fallbackStoryInfo, type StoryInfo } from '../review-types.ts';
import { DEFAULT_CONTENT_WIDTH, THUMBNAIL_BOOTSTRAP_SCALE } from './iframeResizeMessage.ts';
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
  overflow: 'hidden',
});

// Scale to fit content width in a fixed 3/2 frame; tall content is cropped.
const Frame = styled.a(({ theme }) => ({
  position: 'relative',
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  height: '100%',
  alignSelf: 'stretch',
  containerType: 'inline-size',
  containerName: 'preview-frame',
  '--content-w': DEFAULT_CONTENT_WIDTH,
  '--fit-w': 'calc(100cqw / (var(--content-w) * 1px))',
  '--fit': 'min(1, var(--fit-w))',
  '--scale': 'max(0.5, min(1, round(down, var(--fit), 0.25)))',
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

// Frame-sized clip; scaling happens on PreviewScale so layout overflow stays inside.
const PreviewClip = styled.div({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
});

const PreviewScale = styled.div({
  width: 'calc(100% / var(--scale))',
  height: 'calc(100% / var(--scale))',
  transform: 'scale(var(--scale))',
  transformOrigin: 'top left',
});

const Preview = styled.iframe(({ theme }) => ({
  display: 'block',
  width: '100%',
  height: '100%',
  background: theme.background.preview,
  border: 0,
  pointerEvents: 'none',
}));

// Outside PreviewScale so bootstrap scaling does not shrink the loading indicator.
const PreviewLoading = styled.div(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  display: 'grid',
  placeItems: 'center',
  background: theme.background.app,
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
    isPreviewLoading,
    rememberedDimensions,
    forceStartCurrent,
    finishCurrent,
  } = usePreviewThumbnail({ storyId, getPreviewHref, previewsPaused });

  const { component, name } = deriveStoryInfo(info);

  const frameStyle = rememberedDimensions
    ? ({ '--content-w': rememberedDimensions.width } as React.CSSProperties)
    : ({
        // Widen the embed viewport before iframe.resize so stories don't measure
        // and layout in a narrow/mobile breakpoint inside a small thumbnail frame.
        '--scale': THUMBNAIL_BOOTSTRAP_SCALE,
      } as React.CSSProperties);

  const preview = src ? (
    <PreviewClip>
      <PreviewScale>
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
      </PreviewScale>
    </PreviewClip>
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
        {isPreviewLoading ? (
          <PreviewLoading data-testid="review-preview-loading">
            <Loader role="progressbar" />
          </PreviewLoading>
        ) : null}
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
