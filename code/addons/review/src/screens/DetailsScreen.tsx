import React, { useEffect, useState, type FC } from 'react';

import { Badge, Button, IconButton } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  ChevronSmallLeftIcon,
  ChevronSmallRightIcon,
  SideBySideIcon,
  StopAltHollowIcon,
  StorybookIcon,
  TransferIcon,
} from '@storybook/icons';

import { ReviewHeader } from '../components/ReviewHeader.tsx';
import { PREVIEW_MODE_SESSION_KEY } from '../constants.ts';
import { sessionStore } from '../session-store.ts';
import { useBaselineComparison } from './useBaselineComparison.ts';

import { StaleBanner } from '../components/StaleBanner.tsx';

const Page = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  minHeight: 0,
  overflow: 'hidden',
  background: theme.background.content,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
}));

const HeaderWrap = styled.div({
  position: 'relative',
  flexShrink: 0,
});

const ProgressBar = styled.div(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: 1,
  width: '100%',
  height: 3,
  overflow: 'hidden',
  background: theme.background.hoverable,
}));

const ProgressFill = styled.div(({ theme }) => ({
  position: 'absolute',
  insetBlock: 0,
  left: 0,
  background: theme.color.secondary,
  transition: 'width 200ms ease',
}));

const SubtitleStrong = styled.span({
  fontWeight: 700,
});

const SubtitleSeparator = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

const Counter = styled(Button)(({ theme }) => ({
  fontVariantNumeric: 'tabular-nums',
  fontFamily: theme.typography.fonts.mono,
  fontWeight: theme.typography.weight.regular,
}));

const PreviewFrameWrap = styled.div<{ $singleUp: boolean }>(({ $singleUp }) => ({
  flex: 1,
  minHeight: 0,
  width: '100%',
  display: 'flex',
  position: 'relative',
  ...($singleUp ? { overflow: 'hidden' } : {}),
}));

const PreviewPane = styled.div<{ $singleUp: boolean; $active: boolean }>(
  ({ $singleUp, $active }) => ({
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    ...($singleUp
      ? {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: $active ? 1 : -1,
          pointerEvents: $active ? 'auto' : 'none',
          visibility: $active ? 'visible' : 'hidden',
        }
      : {
          flex: 1,
          position: 'relative',
        }),
  })
);

const PaneDivider = styled.div(({ theme }) => ({
  width: 1,
  flexShrink: 0,
  background: theme.color.border,
}));

const PreviewDivider = styled(PaneDivider)<{ $singleUp: boolean }>(({ $singleUp }) => ({
  display: $singleUp ? 'none' : 'block',
}));

const PreviewFrame = styled.iframe({
  flex: 1,
  width: '100%',
  height: '100%',
  border: 0,
  display: 'block',
});

// The baseline comparison bar. A two-up (side-by-side) and one-up (single)
// mode share a control cluster; the "switch" control only applies in one-up
// mode, where it flips which pane (baseline or latest) is shown.
const BaselineBar = styled.div({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
});

const BarHalf = styled.div({
  display: 'flex',
  flex: 1,
  minWidth: 0,
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

const BarLabel = styled.strong(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  fontSize: 14,
  lineHeight: '20px',
  whiteSpace: 'nowrap',
}));

const BarControls = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
});

type CompareMode = 'split' | 'single';
type ComparePane = 'baseline' | 'latest';

const DEFAULT_COMPARE_MODE: CompareMode = 'single';

// The persisted preview layout reuses the historical '1up'/'2up' values so the
// choice carries across sessions; map them to the local split/single model.
const readCompareMode = (): CompareMode => {
  const stored = sessionStore.read(PREVIEW_MODE_SESSION_KEY);
  return stored === '2up' ? 'split' : DEFAULT_COMPARE_MODE;
};

export interface DetailsScreenProps {
  /** Fallback title shown when story metadata is unavailable. */
  title: string;
  storyId: string;
  storyIndex: number;
  totalStories: number;
  backHref: string;
  previousHref: string;
  nextHref: string;
  /** Preview iframe src for the latest (current) story. */
  previewHref: string;
  /** Manager href to open the story in the regular Storybook UI. */
  storybookHref: string;
  componentTitle?: string;
  storyName?: string;
  /** When true, render the "this review may be stale" banner at the top. */
  isStale?: boolean;
  /** Enables the baseline/latest comparison controls when a baseline exists. */
  hasBaseline?: boolean;
  /** Whether this story is newly added relative to the baseline Storybook. */
  isNewlyAdded?: boolean;
}

const componentName = (componentTitle: string): string =>
  componentTitle
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop() ?? componentTitle;

const CompareControls: FC<{
  mode: CompareMode;
  onModeChange: (mode: CompareMode) => void;
  onSwitch: () => void;
}> = ({ mode, onModeChange, onSwitch }) => (
  <BarControls>
    {mode === 'single' ? (
      <IconButton
        variant="ghost"
        size="small"
        padding="small"
        ariaLabel="Switch baseline and latest"
        onClick={onSwitch}
      >
        <TransferIcon />
      </IconButton>
    ) : null}
    <IconButton
      variant="ghost"
      size="small"
      padding="small"
      active={mode === 'single'}
      ariaLabel="Single view"
      onClick={() => onModeChange('single')}
    >
      <StopAltHollowIcon />
    </IconButton>
    <IconButton
      variant="ghost"
      size="small"
      padding="small"
      active={mode === 'split'}
      ariaLabel="Side-by-side view"
      onClick={() => onModeChange('split')}
    >
      <SideBySideIcon />
    </IconButton>
  </BarControls>
);

// The preview <iframe>s are intentionally stable elements: when the story
// changes the parent only updates `src`, so each iframe navigates in place
// without the manager (or this component) remounting — no flash. The baseline
// pane mirrors the latest pane through the dev-server proxy and keeps its
// scroll position in sync so side-by-side diffs line up.
export const DetailsScreen = ({
  title,
  storyId,
  storyIndex,
  totalStories,
  backHref,
  previousHref,
  nextHref,
  previewHref,
  storybookHref,
  componentTitle,
  storyName,
  isStale = false,
  hasBaseline = false,
  isNewlyAdded,
}: DetailsScreenProps) => {
  const [mode, setMode] = useState<CompareMode>(readCompareMode);
  const [activePane, setActivePane] = useState<ComparePane>('latest');

  // A newly added story has no baseline counterpart, and some repos have no
  // baseline at all: in either case render only the latest preview, full-width,
  // and hide the baseline pane plus the comparison controls.
  const showBaseline = hasBaseline && !isNewlyAdded;
  const isSingleUp = mode === 'single' || !showBaseline;

  const { baselineFrameRef, latestFrameRef, latestPreviewSrc, baselinePreviewSrc } =
    useBaselineComparison(previewHref, showBaseline);

  // Persist the user's layout choice so it carries across navigation between
  // the detail and summary screens.
  useEffect(() => {
    sessionStore.write(PREVIEW_MODE_SESSION_KEY, mode === 'single' ? '1up' : '2up');
  }, [mode]);

  const metadataSubtitle =
    componentTitle && storyName ? (
      <>
        <SubtitleStrong>{componentName(componentTitle)}</SubtitleStrong>
        <SubtitleSeparator>/</SubtitleSeparator>
        <span>{storyName}</span>
      </>
    ) : null;

  const subtitle =
    metadataSubtitle || isNewlyAdded ? (
      <>
        {metadataSubtitle}
        {isNewlyAdded ? <Badge status="positive">New</Badge> : null}
      </>
    ) : undefined;

  const baselineBar = showBaseline ? (
    mode === 'split' ? (
      <BaselineBar>
        <BarHalf>
          <BarLabel>Baseline</BarLabel>
          <span />
        </BarHalf>
        <BarHalf>
          <BarLabel>Latest</BarLabel>
          <CompareControls mode={mode} onModeChange={setMode} onSwitch={() => {}} />
        </BarHalf>
      </BaselineBar>
    ) : (
      <BaselineBar>
        <BarHalf>
          <BarLabel>{activePane === 'baseline' ? 'Baseline' : 'Latest'}</BarLabel>
          <CompareControls
            mode={mode}
            onModeChange={setMode}
            onSwitch={() => setActivePane((pane) => (pane === 'baseline' ? 'latest' : 'baseline'))}
          />
        </BarHalf>
      </BaselineBar>
    )
  ) : undefined;

  // Fill maps the current position across the sequence so the first story reads
  // as 0% and the last as 100%. A lone story has no span to traverse, so it
  // stays at 0%.
  const progress = totalStories > 1 ? storyIndex / (totalStories - 1) : 0;

  return (
    <Page>
      {isStale ? <StaleBanner /> : null}
      <HeaderWrap>
        <ProgressBar aria-hidden data-testid="review-progress">
          <ProgressFill
            data-testid="review-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </ProgressBar>
        <ReviewHeader
          autoFocusTitle
          leading={
            <IconButton
              variant="ghost"
              size="small"
              padding="small"
              ariaLabel="Back to review"
              asChild
            >
              <a href={backHref}>
                <ChevronSmallLeftIcon />
              </a>
            </IconButton>
          }
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <Counter variant="ghost" size="small" readOnly>
                {storyIndex + 1}/{totalStories}
              </Counter>
              <IconButton
                variant="ghost"
                size="small"
                padding="small"
                ariaLabel="Previous story"
                asChild
              >
                <a href={previousHref}>
                  <ChevronSmallLeftIcon />
                </a>
              </IconButton>
              <IconButton
                variant="ghost"
                size="small"
                padding="small"
                ariaLabel="Next story"
                asChild
              >
                <a href={nextHref}>
                  <ChevronSmallRightIcon />
                </a>
              </IconButton>
              <IconButton size="small" padding="small" ariaLabel="View in Storybook" asChild>
                <a href={storybookHref} target="_blank" rel="noreferrer">
                  <StorybookIcon />
                </a>
              </IconButton>
            </>
          }
          secondRow={baselineBar}
        />
      </HeaderWrap>

      <PreviewFrameWrap $singleUp={isSingleUp} data-testid="review-details-screen-preview">
        {showBaseline ? (
          <>
            <PreviewPane $singleUp={isSingleUp} $active={!isSingleUp || activePane === 'baseline'}>
              <PreviewFrame
                ref={baselineFrameRef}
                title={`Baseline ${storyId}`}
                src={baselinePreviewSrc}
              />
            </PreviewPane>
            <PreviewDivider $singleUp={isSingleUp} />
          </>
        ) : null}
        <PreviewPane
          $singleUp={isSingleUp}
          $active={!showBaseline || !isSingleUp || activePane === 'latest'}
        >
          <PreviewFrame ref={latestFrameRef} title={`Latest ${storyId}`} src={latestPreviewSrc} />
        </PreviewPane>
      </PreviewFrameWrap>
    </Page>
  );
};
