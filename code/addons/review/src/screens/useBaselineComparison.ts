import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { STORY_RENDERED } from 'storybook/internal/core-events';

import { BASELINE_PROXY_PATH } from '../constants.ts';

const toBaselinePreviewUrl = (latestUrlString: string) => {
  const latestUrl = new URL(latestUrlString, window.location.href);
  return new URL(
    `${BASELINE_PROXY_PATH}${latestUrl.pathname}${latestUrl.search}${latestUrl.hash}`,
    window.location.origin
  ).toString();
};

type ComparePane = 'baseline' | 'latest';

// The baseline preview is a *remote* Storybook (potentially a different
// version) loaded through the dev-server proxy, so its in-iframe channel is not
// guaranteed to match our own Channel type. Probe only the small, stable
// surface we need and treat every method as optional.
interface BaselineChannel {
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
}

export interface BaselineComparison {
  baselineFrameRef: RefObject<HTMLIFrameElement>;
  latestFrameRef: RefObject<HTMLIFrameElement>;
  latestPreviewSrc: string;
  baselinePreviewSrc: string;
}

/**
 * Owns the cross-iframe coupling for the baseline/latest comparison: mirrors
 * the baseline pane's URL to the latest pane through the dev-server proxy and
 * keeps their scroll positions in sync so side-by-side diffs line up. The
 * preview iframes are stable elements — only their `src` changes as the story
 * navigates — so this attaches `load`/channel listeners once and re-syncs on
 * each navigation. Returns the frame refs and both preview URLs to render.
 */
export const useBaselineComparison = (
  latestPreviewSrc: string,
  showBaseline: boolean
): BaselineComparison => {
  const [baselinePreviewSrc, setBaselinePreviewSrc] = useState(() =>
    toBaselinePreviewUrl(latestPreviewSrc)
  );
  const baselinePreviewSrcRef = useRef(baselinePreviewSrc);

  const baselineFrameRef = useRef<HTMLIFrameElement>(null);
  const latestFrameRef = useRef<HTMLIFrameElement>(null);
  const cleanupScrollSyncRef = useRef<(() => void) | null>(null);
  const cleanupBaselineStoryRenderedRef = useRef<(() => void) | null>(null);
  const syncingTargetRef = useRef<ComparePane | null>(null);

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

      const baselineWindow = baselineFrameRef.current?.contentWindow as
        | (Window & { __STORYBOOK_ADDONS_CHANNEL__?: BaselineChannel })
        | null
        | undefined;
      const baselineChannel = baselineWindow?.__STORYBOOK_ADDONS_CHANNEL__;

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
  }, [setupScrollSync, showBaseline]);

  return { baselineFrameRef, latestFrameRef, latestPreviewSrc, baselinePreviewSrc };
};
