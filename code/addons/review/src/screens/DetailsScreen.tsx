import React, { useCallback, useEffect, useRef, useState, type FC } from 'react';

import { Badge, Button, IconButton, Popover, WithTooltip } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  ChevronSmallLeftIcon,
  ChevronSmallRightIcon,
  SideBySideIcon,
  StopAltHollowIcon,
  StorybookIcon,
  TransferIcon,
} from '@storybook/icons';

import { type StoryInfo } from '../components/CollectionGrid.tsx';
import { ReviewHeader } from '../components/ReviewHeader.tsx';
import { PREVIEW_MODE_SESSION_KEY } from '../constants.ts';
import { buildReviewChangesDetailHref, buildStorybookStoryHref, prettifyComponentId, storyPreviewUrl } from '../review-navigation.ts';
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

const ProgressBar = styled.div<{ $percent: number }>(({ theme, $percent }) => ({
  height: 2,
  width: '100%',
  flexShrink: 0,
  background: `linear-gradient(to right, ${theme.color.secondary} ${$percent}%, ${theme.appBorderColor} ${$percent}%)`,
}));

const SubtitleStrong = styled.span(({ theme }) => ({
  fontWeight: 700,
  color: theme.color.defaultText,
}));

const SubtitleSeparator = styled.span(({ theme }) => ({
  color: theme.color.defaultText,
}));

const SubtitleText = styled.span(({ theme }) => ({
  color: theme.color.defaultText,
}));

const Counter = styled(Button)(({ theme }) => ({
  fontVariantNumeric: 'tabular-nums',
  fontFamily: theme.typography.fonts.mono,
  fontWeight: theme.typography.weight.regular,
}));

const PopoverList = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  padding: '4px 0',
  minWidth: 280,
  maxHeight: '60vh',
  overflowY: 'auto',
  fontFamily: theme.typography.fonts.base,
  // list role applied at usage; defined here as a reminder for future editors
}));

const PopoverItem = styled.a<{ $active: boolean }>(({ theme, $active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 10px',
  background: $active ? theme.background.hoverable : 'transparent',
  textDecoration: 'none',
  color: theme.color.defaultText,
  '&:hover': { background: theme.background.hoverable },
  '&:focus-visible': {
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: -2,
  },
}));

const MiniPreviewWrap = styled.div(({ theme }) => ({
  width: 72,
  height: 48,
  flexShrink: 0,
  position: 'relative',
  borderRadius: 6,
  overflow: 'hidden',
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
}));

const MiniPreviewFrame = styled.iframe({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '200%',
  height: '200%',
  border: 0,
  transform: 'scale(0.5)',
  transformOrigin: 'top left',
  pointerEvents: 'none',
});

const PopoverItemText = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
});

const PopoverItemComponent = styled.span(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flexShrink: 0,
  maxWidth: '55%',
}));

const PopoverItemSep = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  flexShrink: 0,
}));

const PopoverItemStoryName = styled.span(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  color: theme.textMutedColor,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const derivePopoverLabel = (
  storyId: string,
  info?: StoryInfo
): { component: string; story: string } => {
  if (info) {
    return { component: info.title.split('/').pop() ?? info.title, story: info.name };
  }
  const [componentId, ...rest] = storyId.split('--');
  return {
    component: prettifyComponentId(componentId),
    story: prettifyComponentId(rest.join('--')) || 'Story',
  };
};

const MiniPreview: FC<{ storyId: string }> = ({ storyId }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setSrc(storyPreviewUrl(storyId));
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSrc(storyPreviewUrl(storyId));
          observer.disconnect();
        }
      },
      { rootMargin: '40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [storyId]);

  return (
    <MiniPreviewWrap ref={wrapRef}>
      {src ? <MiniPreviewFrame title={storyId} src={src} tabIndex={-1} scrolling="no" /> : null}
    </MiniPreviewWrap>
  );
};

const CollectionList: FC<{
  storyIds: string[];
  storyInfo?: Record<string, StoryInfo>;
  currentStoryId: string;
  collectionIndex: number;
  onClose: () => void;
}> = ({ storyIds, storyInfo, currentStoryId, collectionIndex, onClose }) => {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  return (
    <PopoverList role="list" aria-label="Stories in this collection">
      {storyIds.map((id) => {
        const { component, story } = derivePopoverLabel(id, storyInfo?.[id]);
        const href = buildReviewChangesDetailHref({ collectionIndex, storyId: id });
        const isActive = id === currentStoryId;
        return (
          <PopoverItem
            key={id}
            $active={isActive}
            ref={isActive ? activeRef : undefined}
            href={href}
            onClick={onClose}
          >
            <MiniPreview storyId={id} />
            <PopoverItemText>
              <PopoverItemComponent>{component}</PopoverItemComponent>
              <PopoverItemSep>/</PopoverItemSep>
              <PopoverItemStoryName>{story}</PopoverItemStoryName>
            </PopoverItemText>
          </PopoverItem>
        );
      })}
    </PopoverList>
  );
};

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
  if (stored === '1up') return 'single';
  if (stored === '2up') return 'split';
  return DEFAULT_COMPARE_MODE;
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
  componentTitle?: string;
  storyName?: string;
  /** When true, render the "this review may be stale" banner at the top. */
  isStale?: boolean;
  /** Enables the baseline/latest comparison controls when a baseline exists. */
  hasBaseline?: boolean;
  /** Whether this story is newly added relative to the baseline Storybook. */
  isNewlyAdded?: boolean;
  /** All story IDs in the current collection — used to populate the jump list. */
  storyIds?: string[];
  /** Story metadata for labels in the jump list. */
  storyInfo?: Record<string, StoryInfo>;
  /** Index of the current collection in the review — used to build hrefs in the jump list. */
  collectionIndex?: number;
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
  componentTitle,
  storyName,
  isStale = false,
  hasBaseline = false,
  isNewlyAdded,
  storyIds,
  storyInfo,
  collectionIndex,
}: DetailsScreenProps) => {
  const [mode, setMode] = useState<CompareMode>(readCompareMode);
  const [activePane, setActivePane] = useState<ComparePane>('latest');

  // A newly added story has no baseline counterpart, and some repos have no
  // baseline at all: in either case render only the latest preview, full-width,
  // and hide the baseline pane plus the comparison controls.
  const showBaseline = hasBaseline && !isNewlyAdded;
  const isSingleUp = mode === 'single' || !showBaseline;

  const { baselineFrameRef, latestFrameRef, latestPreviewSrc, baselinePreviewSrc } =
    useBaselineComparison(storyId, showBaseline);

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
        <SubtitleText>{storyName}</SubtitleText>
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

  const progressPercent = totalStories > 0 ? ((storyIndex + 1) / totalStories) * 100 : 0;

  return (
    <Page>
      <ProgressBar
        $percent={progressPercent}
        role="progressbar"
        aria-label="Review progress"
        aria-valuenow={storyIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalStories}
      />
      {isStale ? <StaleBanner /> : null}
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
            {storyIds && storyIds.length > 0 && collectionIndex !== undefined ? (
              <WithTooltip
                trigger="click"
                closeOnOutsideClick
                placement="bottom"
                tooltip={({ onHide }) => (
                  <Popover hasChrome padding={0}>
                    <CollectionList
                      storyIds={storyIds}
                      storyInfo={storyInfo}
                      currentStoryId={storyId}
                      collectionIndex={collectionIndex}
                      onClose={onHide}
                    />
                  </Popover>
                )}
              >
                <Counter
                  variant="ghost"
                  size="small"
                  ariaLabel="Open story list"
                  aria-haspopup="listbox"
                >
                  {storyIndex + 1}/{totalStories}
                </Counter>
              </WithTooltip>
            ) : (
              <Counter variant="ghost" size="small" ariaLabel={false} readOnly>
                {storyIndex + 1}/{totalStories}
              </Counter>
            )}
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
            <IconButton variant="ghost" size="small" padding="small" ariaLabel="Next story" asChild>
              <a href={nextHref}>
                <ChevronSmallRightIcon />
              </a>
            </IconButton>
            <IconButton size="small" padding="small" ariaLabel="View in Storybook" asChild>
              <a href={buildStorybookStoryHref(storyId)} target="_blank" rel="noreferrer">
                <StorybookIcon />
              </a>
            </IconButton>
          </>
        }
        secondRow={baselineBar}
      />

      <PreviewFrameWrap $singleUp={isSingleUp}>
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
