import React, { type CSSProperties, type FC } from 'react';

import { Badge, Button, Loader } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  hasFixedViewportDimensions,
  type IframeResizeDimensions,
} from '../../../../shared/constants/iframe-resize.ts';
import { fallbackStoryInfo, type StoryInfo } from '../review-types.ts';
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
      display: 'flex',
    },
  };
};

const GridContainer = styled.div({
  containerType: 'inline-size',
  containerName: 'review-grid',
});

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
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflow: 'hidden',
});

const FrameShell = styled.div({
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  aspectRatio: '3 / 2',
  position: 'relative',
});

/** Default `--content-w` before the embed iframe reports its size. */
const DEFAULT_CONTENT_WIDTH = 300;

/** Pre-measurement scale so the embed iframe viewport is 2× the frame width (100% / 0.5). */
const THUMBNAIL_BOOTSTRAP_SCALE = 0.5;

// Feeds the CSS variables consumed by `Frame` below (`--scale`, `--content-w`,
// `--vp-w`/`--vp-h`); `viewportFill` toggles the `data-viewport-fill` branch.
const getPreviewFrameLayout = (
  dimensions: IframeResizeDimensions | null
): { style: CSSProperties; viewportFill: boolean } => {
  if (!dimensions) {
    return {
      style: { '--scale': THUMBNAIL_BOOTSTRAP_SCALE } as CSSProperties,
      viewportFill: false,
    };
  }

  if (hasFixedViewportDimensions(dimensions.viewport)) {
    return {
      style: {
        '--vp-w': dimensions.viewport.width,
        '--vp-h': dimensions.viewport.height,
      } as CSSProperties,
      viewportFill: true,
    };
  }

  return { style: { '--content-w': dimensions.width } as CSSProperties, viewportFill: false };
};

const Frame = styled.a(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  display: 'block',
  boxSizing: 'border-box',
  containerType: 'inline-size',
  containerName: 'preview-frame',
  '--content-w': DEFAULT_CONTENT_WIDTH,
  '--fit-w': 'calc(100cqw / (var(--content-w) * 1px))',
  '--fit': 'min(1, var(--fit-w))',
  '--scale': 'max(0.5, min(1, round(down, var(--fit), 0.25)))',
  '--vp-scale': 'calc(100cqw / (var(--vp-w) * 1px))',
  borderRadius: 6,
  overflow: 'hidden',
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  transition: 'border-color 120ms ease',
  textDecoration: 'none',
  outline: 'none',
  '& [data-preview-scale]': {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: 'top left',
  },
  '&[data-viewport-fill] [data-preview-scale]': {
    width: 'calc(var(--vp-w) * 1px)',
    height: 'calc(var(--vp-h) * 1px)',
    transform: 'scale(var(--vp-scale))',
  },
  '&:not([data-viewport-fill]) [data-preview-scale]': {
    width: 'calc(100% / var(--scale))',
    height: 'calc(100% / var(--scale))',
    transform: 'scale(var(--scale))',
  },
  '&[href]:hover': {
    borderColor: theme.color.secondary,
  },
  '&:focus-visible': {
    outline: `${theme.barSelectedColor} solid 2px`,
    outlineOffset: -2,
  },
}));

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
  marginTop: 'auto',
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

const ReviewAllShell = styled.div({
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  aspectRatio: '3 / 2',
  minHeight: 50,
});

const ReviewAllFrame = styled.div(({ theme }) => ({
  display: 'grid',
  placeItems: 'center',
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
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
  summaryHidden?: boolean;
}> = ({ storyId, href, info, getPreviewHref, summaryHidden = false }) => {
  const {
    cellRef,
    iframeRef,
    src,
    isPreviewLoading,
    rememberedDimensions,
    forceStartCurrent,
    finishCurrent,
  } = usePreviewThumbnail({ storyId, getPreviewHref, summaryHidden });

  const { component, name } = deriveStoryInfo(info);
  const readableTitle = `${component} – ${name}`;
  const { style: frameStyle, viewportFill } = getPreviewFrameLayout(rememberedDimensions);

  const preview = src ? (
    <div data-preview-scale>
      <Preview
        ref={iframeRef}
        title={readableTitle}
        src={src}
        data-content-width={rememberedDimensions?.width}
        data-content-height={rememberedDimensions?.height}
        tabIndex={-1}
        scrolling="no"
        onLoad={finishCurrent}
        onError={finishCurrent}
      />
    </div>
  ) : null;

  return (
    <Cell ref={cellRef} role="listitem" data-cell data-testid="review-collection-grid-cell">
      <FrameShell>
        <Frame
          as={href ? 'a' : 'div'}
          {...(href ? { href } : {})}
          data-testid="review-collection-grid-frame"
          data-viewport-fill={viewportFill || undefined}
          style={frameStyle}
          aria-label={href ? `Review story ${readableTitle}` : undefined}
          onMouseEnter={forceStartCurrent}
          onFocus={forceStartCurrent}
        >
          {isPreviewLoading ? (
            <PreviewLoading data-testid="review-preview-loading">
              <Loader />
            </PreviewLoading>
          ) : null}
          {preview}
        </Frame>
      </FrameShell>
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
  summaryHidden?: boolean;
}

export const CollectionGrid: FC<CollectionGridProps> = ({
  storyIds,
  getStoryHref,
  getStoryPreviewHref,
  showAll = false,
  onShowAll,
  storyInfo,
  summaryHidden = false,
}) => (
  <GridContainer>
    <Grid role="list" data-show-all={showAll || undefined} data-testid="review-collection-grid">
      {storyIds.map((storyId, storyIndex) => {
        const info = storyInfo[storyId] ?? fallbackStoryInfo(storyId);
        return (
          <StoryPreviewCell
            key={storyId}
            storyId={storyId}
            href={getStoryHref?.(storyId, storyIndex)}
            info={info}
            getPreviewHref={getStoryPreviewHref}
            summaryHidden={summaryHidden}
          />
        );
      })}
      <ReviewAllCell role="presentation" data-review-all>
        <ReviewAllShell>
          <ReviewAllFrame>
            <Button size="medium" onClick={() => onShowAll?.()}>
              Review all {storyIds.length}
            </Button>
          </ReviewAllFrame>
        </ReviewAllShell>
        <ActionBar aria-hidden="true" />
      </ReviewAllCell>
    </Grid>
  </GridContainer>
);
