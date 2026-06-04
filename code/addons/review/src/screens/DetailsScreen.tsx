import React, { type FC, useCallback, useEffect, useRef, useState } from 'react';

import { Badge, Button, IconButton } from 'storybook/internal/components';
import { STORY_RENDERED } from 'storybook/internal/core-events';
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
import { StaleBanner } from '../components/StaleBanner.tsx';
import { PREVIEW_MODE_SESSION_KEY } from '../constants.ts';
import { buildStorybookStoryHref } from '../review-navigation.ts';
import { sessionStore } from '../session-store.ts';

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

// The baseline comparison bar lives in the header's second row. A two-up
// (side-by-side) and one-up (single) mode share a control cluster; the
// "switch" control only applies in one-up mode, where it flips which pane
// (baseline or latest) is shown.
//
// A two-column 1fr/1fr grid guarantees the column boundary sits at exactly
// 50%, matching the split between the preview iframes below (flex halves can
// drift when their content differs). Negative margins cancel ReviewHeader's
// asymmetric second-row padding (16 left / 12 right) so the grid spans the
// full header width and its center aligns with the iframe seam; each cell then
// re-applies its own inset.
const BaselineBar = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  alignItems: 'center',
  // Full-bleed: cancel ReviewHeader's second-row padding (16 left / 12 right)
  // with negative margins and grow the width to match, so the 50% column seam
  // lines up with the preview iframes' seam below. flexShrink:0 stops the flex
  // parent from collapsing it back to content width.
  width: 'calc(100% + 28px)',
  flexShrink: 0,
  margin: '0 -12px 0 -16px',
});

const BarHalf = styled.div({
  display: 'flex',
  minWidth: 0,
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  // Inset the label to line up with the title/back-button column above, and
  // mirror it on the right cell so "Baseline" and "Latest" share one offset.
  padding: '0 12px 0 16px',
});

// Single (one-up) mode shows one full-width row, so no 1fr/1fr split is needed
// — just the same full-bleed insets as a grid cell.
const SingleBar = styled(BarHalf)({
  margin: '0 -12px 0 -16px',
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

const PreviewDivider = styled.div<{ $singleUp: boolean }>(({ theme, $singleUp }) => ({
  width: 1,
  flexShrink: 0,
  background: theme.color.border,
  display: $singleUp ? 'none' : 'block',
}));

const PreviewFrame = styled.iframe({
  flex: 1,
  width: '100%',
  height: '100%',
  border: 0,
  display: 'block',
});

type PreviewMode = '1up' | '2up';
type VisibleSide = 'baseline' | 'latest';

const DEFAULT_PREVIEW_MODE: PreviewMode = '2up';

// Read the persisted preview layout, defaulting to side-by-side.
const readPreviewMode = (): PreviewMode =>
  sessionStore.read(PREVIEW_MODE_SESSION_KEY) === '1up' ? '1up' : DEFAULT_PREVIEW_MODE;

const BASELINE_PROXY_PATH = '/__review-baseline';
// No `freeze=finished` here: the detail view shows both previews live so the
// reviewer can interact with them. (The grid thumbnails still freeze.) The
// baseline URL is derived from this one, so both panes inherit the same params.
const storyPreviewUrl = (id: string) => `iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;
const toBaselinePreviewUrl = (latestUrlString: string) => {
  const latestUrl = new URL(latestUrlString, window.location.href);
  return new URL(
    `${BASELINE_PROXY_PATH}${latestUrl.pathname}${latestUrl.search}${latestUrl.hash}`,
    window.location.origin
  ).toString();
};

const componentName = (componentTitle: string): string =>
  componentTitle
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop() ?? componentTitle;

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
  /** Whether this story is newly added relative to the baseline Storybook. */
  isNew?: boolean;
}

const CompareControls: FC<{
  previewMode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  onSwitch: () => void;
}> = ({ previewMode, onModeChange, onSwitch }) => (
  <BarControls>
    {previewMode === '1up' ? (
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
      active={previewMode === '1up'}
      ariaLabel="Single view"
      onClick={() => onModeChange('1up')}
    >
      <StopAltHollowIcon />
    </IconButton>
    <IconButton
      variant="ghost"
      size="small"
      padding="small"
      active={previewMode === '2up'}
      ariaLabel="Side-by-side view"
      onClick={() => onModeChange('2up')}
    >
      <SideBySideIcon />
    </IconButton>
  </BarControls>
);

// The preview <iframe> is intentionally a stable element: when the story
// changes the parent only updates `src`, so the iframe navigates in place
// without the manager (or this component) remounting — no flash.
export const DetailsScreen: FC<DetailsScreenProps> = ({
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
  isNew = false,
}) => {
  const latestPreviewSrc = storyPreviewUrl(storyId);
  const [baselinePreviewSrc, setBaselinePreviewSrc] = useState(() =>
    toBaselinePreviewUrl(latestPreviewSrc)
  );
  const baselinePreviewSrcRef = useRef(baselinePreviewSrc);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(readPreviewMode);
  const [visibleSide, setVisibleSide] = useState<VisibleSide>('latest');
  // A newly added story has no baseline counterpart, so there's nothing to
  // compare against: render only the latest preview, full-width, and hide the
  // baseline pane and the comparison controls. Baseline existence is known up
  // front (from the index lookup in ReviewPage), so the baseline pane and
  // comparison bar render immediately — no need to wait for the baseline
  // iframe's load event.
  const showBaseline = !isNew;
  const isSingleUp = previewMode === '1up' || !showBaseline;

  const baselineFrameRef = useRef<HTMLIFrameElement>(null);
  const latestFrameRef = useRef<HTMLIFrameElement>(null);
  const cleanupScrollSyncRef = useRef<(() => void) | null>(null);
  const cleanupBaselineStoryRenderedRef = useRef<(() => void) | null>(null);
  const syncingTargetRef = useRef<VisibleSide | null>(null);

  const disableOverscrollBounce = useCallback((frameElement: HTMLIFrameElement | null) => {
    const iframeDocument = frameElement?.contentDocument;
    if (!iframeDocument) {
      return;
    }

    const { documentElement, body } = iframeDocument;

    if (documentElement) {
      documentElement.style.overscrollBehavior = 'none';
      documentElement.style.overscrollBehaviorX = 'none';
      documentElement.style.overscrollBehaviorY = 'none';
    }

    if (body) {
      body.style.overscrollBehavior = 'none';
      body.style.overscrollBehaviorX = 'none';
      body.style.overscrollBehaviorY = 'none';
    }
  }, []);

  const setupScrollSync = useCallback(() => {
    cleanupScrollSyncRef.current?.();
    cleanupScrollSyncRef.current = null;

    disableOverscrollBounce(baselineFrameRef.current);
    disableOverscrollBounce(latestFrameRef.current);

    const baselineWindow = baselineFrameRef.current?.contentWindow;
    const latestWindow = latestFrameRef.current?.contentWindow;
    if (!baselineWindow || !latestWindow) {
      return;
    }

    const releaseSyncLock = () => {
      window.requestAnimationFrame(() => {
        syncingTargetRef.current = null;
      });
    };

    const syncFromBaseline = () => {
      if (syncingTargetRef.current === 'baseline') {
        return;
      }
      syncingTargetRef.current = 'latest';
      latestWindow.scrollTo(baselineWindow.scrollX, baselineWindow.scrollY);
      releaseSyncLock();
    };

    const syncFromLatest = () => {
      if (syncingTargetRef.current === 'latest') {
        return;
      }
      syncingTargetRef.current = 'baseline';
      baselineWindow.scrollTo(latestWindow.scrollX, latestWindow.scrollY);
      releaseSyncLock();
    };

    baselineWindow.addEventListener('scroll', syncFromBaseline, { passive: true });
    latestWindow.addEventListener('scroll', syncFromLatest, { passive: true });

    cleanupScrollSyncRef.current = () => {
      baselineWindow.removeEventListener('scroll', syncFromBaseline);
      latestWindow.removeEventListener('scroll', syncFromLatest);
      syncingTargetRef.current = null;
    };
  }, [disableOverscrollBounce]);

  useEffect(() => {
    baselinePreviewSrcRef.current = baselinePreviewSrc;
  }, [baselinePreviewSrc]);

  useEffect(() => {
    setBaselinePreviewSrc(toBaselinePreviewUrl(latestPreviewSrc));
  }, [latestPreviewSrc]);

  // Persist the user's layout choice so it carries across navigation between
  // the detail and summary screens.
  useEffect(() => {
    sessionStore.write(PREVIEW_MODE_SESSION_KEY, previewMode);
  }, [previewMode]);

  useEffect(() => {
    const baselineFrame = baselineFrameRef.current;
    const latestFrame = latestFrameRef.current;
    if (!baselineFrame || !latestFrame) {
      return undefined;
    }

    const syncBaselineToLatest = () => {
      const baselineWindow = baselineFrameRef.current?.contentWindow;
      const latestWindow = latestFrameRef.current?.contentWindow;
      if (!baselineWindow || !latestWindow) {
        return;
      }
      baselineWindow.scrollTo(latestWindow.scrollX, latestWindow.scrollY);
    };

    const attachBaselineStoryRenderedListener = () => {
      cleanupBaselineStoryRenderedRef.current?.();
      cleanupBaselineStoryRenderedRef.current = null;

      const baselineChannel = (
        baselineFrameRef.current?.contentWindow as Window & {
          __STORYBOOK_ADDONS_CHANNEL__?: {
            on?: (event: string, listener: () => void) => void;
            off?: (event: string, listener: () => void) => void;
            removeListener?: (event: string, listener: () => void) => void;
          };
        }
      ).__STORYBOOK_ADDONS_CHANNEL__;

      if (!baselineChannel?.on) {
        return;
      }

      const onBaselineStoryRendered = () => {
        syncBaselineToLatest();
        setupScrollSync();
        cleanupBaselineStoryRenderedRef.current?.();
      };

      cleanupBaselineStoryRenderedRef.current = () => {
        if (baselineChannel.off) {
          baselineChannel.off(STORY_RENDERED, onBaselineStoryRendered);
        } else if (baselineChannel.removeListener) {
          baselineChannel.removeListener(STORY_RENDERED, onBaselineStoryRendered);
        }
        cleanupBaselineStoryRenderedRef.current = null;
      };

      baselineChannel.on(STORY_RENDERED, onBaselineStoryRendered);
    };

    const handleBaselineFrameLoad = () => {
      attachBaselineStoryRenderedListener();
      setupScrollSync();
    };

    const handleLatestFrameLoad = () => {
      const latestLocationHref = latestFrameRef.current?.contentWindow?.location.href;
      if (latestLocationHref) {
        const nextBaselineUrl = toBaselinePreviewUrl(latestLocationHref);
        if (baselinePreviewSrcRef.current !== nextBaselineUrl) {
          setBaselinePreviewSrc(nextBaselineUrl);
        }
      }
      setupScrollSync();
    };

    baselineFrame.addEventListener('load', handleBaselineFrameLoad);
    latestFrame.addEventListener('load', handleLatestFrameLoad);
    setupScrollSync();

    return () => {
      cleanupBaselineStoryRenderedRef.current?.();
      baselineFrame.removeEventListener('load', handleBaselineFrameLoad);
      latestFrame.removeEventListener('load', handleLatestFrameLoad);
      cleanupScrollSyncRef.current?.();
      cleanupScrollSyncRef.current = null;
    };
  }, [setupScrollSync]);

  const hasNameInfo = Boolean(componentTitle && storyName);
  const subtitle =
    hasNameInfo || isNew ? (
      <>
        {hasNameInfo ? (
          <>
            <SubtitleStrong>{componentName(componentTitle as string)}</SubtitleStrong>
            <SubtitleSeparator>/</SubtitleSeparator>
            <span>{storyName}</span>
          </>
        ) : null}
        {isNew ? <Badge status="positive">New</Badge> : null}
      </>
    ) : undefined;

  const baselineBar = showBaseline ? (
    isSingleUp ? (
      <SingleBar>
        <BarLabel>{visibleSide === 'baseline' ? 'Baseline' : 'Latest'}</BarLabel>
        <CompareControls
          previewMode={previewMode}
          onModeChange={setPreviewMode}
          onSwitch={() => setVisibleSide((side) => (side === 'baseline' ? 'latest' : 'baseline'))}
        />
      </SingleBar>
    ) : (
      <BaselineBar>
        <BarHalf>
          <BarLabel>Baseline</BarLabel>
          <span />
        </BarHalf>
        <BarHalf>
          <BarLabel>Latest</BarLabel>
          <CompareControls
            previewMode={previewMode}
            onModeChange={setPreviewMode}
            onSwitch={() => {}}
          />
        </BarHalf>
      </BaselineBar>
    )
  ) : undefined;

  return (
    <Page>
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
            <PreviewPane $singleUp={isSingleUp} $active={!isSingleUp || visibleSide === 'baseline'}>
              <PreviewFrame
                ref={baselineFrameRef}
                title={`Baseline ${storyId}`}
                src={baselinePreviewSrc}
              />
            </PreviewPane>
            <PreviewDivider $singleUp={isSingleUp} />
          </>
        ) : null}
        <PreviewPane $singleUp={isSingleUp} $active={!isSingleUp || visibleSide === 'latest'}>
          <PreviewFrame ref={latestFrameRef} title={`Latest ${storyId}`} src={latestPreviewSrc} />
        </PreviewPane>
      </PreviewFrameWrap>
    </Page>
  );
};
