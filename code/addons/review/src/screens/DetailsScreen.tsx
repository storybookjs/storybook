import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from 'storybook/internal/components';
import { STORY_RENDERED } from 'storybook/internal/core-events';
import { styled } from 'storybook/theming';

import {
  CategoryIcon,
  ChevronSmallLeftIcon,
  ChevronSmallRightIcon,
  SideBySideIcon,
  TransferIcon,
} from '@storybook/icons';

const Page = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  minHeight: '100dvh',
  overflow: 'hidden',
  background: theme.background.content,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
}));

const Toolbar = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  minHeight: 40,
  padding: '0 10px',
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const ToolbarSide = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
});

const DetailTitle = styled.h2({
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: '20px',
});

const DetailTitleMuted = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  fontWeight: 400,
}));

const DetailTitleStrong = styled.span({
  fontWeight: 700,
});

const DetailTitleRegular = styled.span({
  fontWeight: 400,
});

type PreviewMode = '1up' | '2up';
type VisibleSide = 'baseline' | 'latest';

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

const BottomToolbar = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  minHeight: 40,
  borderTop: `1px solid ${theme.appBorderColor}`,
}));

const BottomHalf = styled.div({
  flex: 1,
  minWidth: 0,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '0 16px',
});

const BottomDivider = styled(PaneDivider)<{ $singleUp: boolean }>(({ $singleUp }) => ({
  display: $singleUp ? 'none' : 'block',
}));

const RightBottomHalf = styled(BottomHalf)<{ $singleUp: boolean }>(({ $singleUp }) => ({
  justifyContent: $singleUp ? 'flex-end' : 'space-between',
  gap: 8,
}));

const BottomControls = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const BottomLabel = styled.div({
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 600,
});

const BASELINE_PROXY_PATH = '/__review-baseline';
const storyPreviewUrl = (id: string) =>
  `iframe.html?id=${encodeURIComponent(id)}&viewMode=story&freeze=finished`;
const toBaselinePreviewUrl = (latestUrlString: string) => {
  const latestUrl = new URL(latestUrlString, window.location.href);
  return new URL(
    `${BASELINE_PROXY_PATH}${latestUrl.pathname}${latestUrl.search}${latestUrl.hash}`,
    window.location.origin
  ).toString();
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
  branchName?: string;
}

const renderDetailTitle = ({
  title,
  componentTitle,
  storyName,
}: Pick<DetailsScreenProps, 'title' | 'componentTitle' | 'storyName'>) => {
  if (!componentTitle || !storyName) {
    return title;
  }

  const componentName =
    componentTitle
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .pop() ?? componentTitle;

  return (
    <>
      <DetailTitleStrong>{componentName}</DetailTitleStrong>
      <DetailTitleMuted>{' / '}</DetailTitleMuted>
      <DetailTitleRegular>{storyName}</DetailTitleRegular>
    </>
  );
};

// The preview <iframe> is intentionally a stable element: when the story
// changes the parent only updates `src`, so the iframe navigates in place
// without the manager (or this component) remounting — no flash.
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
}: DetailsScreenProps) => {
  const latestPreviewSrc = storyPreviewUrl(storyId);
  const [baselinePreviewSrc, setBaselinePreviewSrc] = useState(() =>
    toBaselinePreviewUrl(latestPreviewSrc)
  );
  const baselinePreviewSrcRef = useRef(baselinePreviewSrc);
  const [isBaselineReady, setIsBaselineReady] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('1up');
  const [visibleSide, setVisibleSide] = useState<VisibleSide>('latest');
  const isSingleUp = previewMode === '1up';
  const effectiveVisibleSide = isBaselineReady ? visibleSide : 'latest';

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

    iframeDocument.documentElement.style.overscrollBehavior = 'none';
    iframeDocument.documentElement.style.overscrollBehaviorX = 'none';
    iframeDocument.documentElement.style.overscrollBehaviorY = 'none';

    if (iframeDocument.body) {
      iframeDocument.body.style.overscrollBehavior = 'none';
      iframeDocument.body.style.overscrollBehaviorX = 'none';
      iframeDocument.body.style.overscrollBehaviorY = 'none';
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
    setIsBaselineReady(false);
    setBaselinePreviewSrc(toBaselinePreviewUrl(latestPreviewSrc));
  }, [latestPreviewSrc]);

  useEffect(() => {
    const baselineFrame = baselineFrameRef.current;
    const latestFrame = latestFrameRef.current;
    if (!baselineFrame || !latestFrame) {
      return;
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
      setIsBaselineReady(true);
      attachBaselineStoryRenderedListener();
      setupScrollSync();
    };

    const handleLatestFrameLoad = () => {
      const latestLocationHref = latestFrameRef.current?.contentWindow?.location.href;
      if (latestLocationHref) {
        const nextBaselineUrl = toBaselinePreviewUrl(latestLocationHref);
        if (baselinePreviewSrcRef.current !== nextBaselineUrl) {
          setIsBaselineReady(false);
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

  return (
    <Page>
      <Toolbar>
        <ToolbarSide>
          <Button variant="ghost" size="small" padding="small" ariaLabel="Back to review" asChild>
            <a href={backHref}>
              <ChevronSmallLeftIcon />
            </a>
          </Button>
          <DetailTitle>{renderDetailTitle({ title, componentTitle, storyName })}</DetailTitle>
        </ToolbarSide>

        <ToolbarSide>
          <Button variant="ghost" size="small" readOnly>
            {storyIndex + 1}/{totalStories}
          </Button>
          <Button variant="ghost" size="small" padding="small" ariaLabel="Previous story" asChild>
            <a href={previousHref}>
              <ChevronSmallLeftIcon />
            </a>
          </Button>
          <Button variant="ghost" size="small" padding="small" ariaLabel="Next story" asChild>
            <a href={nextHref}>
              <ChevronSmallRightIcon />
            </a>
          </Button>
        </ToolbarSide>
      </Toolbar>

      <PreviewFrameWrap $singleUp={isSingleUp}>
        <PreviewPane
          $singleUp={isSingleUp}
          $active={!isSingleUp || effectiveVisibleSide === 'baseline'}
        >
          <PreviewFrame
            ref={baselineFrameRef}
            title={`Baseline ${storyId}`}
            src={baselinePreviewSrc}
          />
        </PreviewPane>
        {isSingleUp ? null : <PreviewDivider $singleUp={isSingleUp} />}
        <PreviewPane
          $singleUp={isSingleUp}
          $active={!isSingleUp || effectiveVisibleSide === 'latest'}
        >
          <PreviewFrame ref={latestFrameRef} title={`Latest ${storyId}`} src={latestPreviewSrc} />
        </PreviewPane>
      </PreviewFrameWrap>

      {isBaselineReady ? (
        <BottomToolbar>
          <BottomHalf>
            <BottomLabel>
              {isSingleUp
                ? effectiveVisibleSide === 'baseline'
                  ? 'Baseline'
                  : 'Latest'
                : 'Baseline'}
            </BottomLabel>
          </BottomHalf>
          <BottomDivider $singleUp={isSingleUp} />
          <RightBottomHalf $singleUp={isSingleUp}>
            {!isSingleUp ? <BottomLabel>Latest</BottomLabel> : null}
            <BottomControls>
              {isSingleUp ? (
                <Button
                  variant="ghost"
                  size="small"
                  padding="small"
                  ariaLabel="Swap visible preview"
                  onClick={() =>
                    setVisibleSide((current) => (current === 'latest' ? 'baseline' : 'latest'))
                  }
                >
                  <TransferIcon />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="small"
                padding="small"
                ariaLabel="Single preview mode"
                active={previewMode === '1up'}
                onClick={() => setPreviewMode('1up')}
              >
                <CategoryIcon />
              </Button>
              <Button
                variant="ghost"
                size="small"
                padding="small"
                ariaLabel="Side-by-side preview mode"
                active={previewMode === '2up'}
                onClick={() => setPreviewMode('2up')}
              >
                <SideBySideIcon />
              </Button>
            </BottomControls>
          </RightBottomHalf>
        </BottomToolbar>
      ) : null}
    </Page>
  );
};
