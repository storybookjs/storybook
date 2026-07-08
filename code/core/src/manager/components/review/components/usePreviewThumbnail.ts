import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from 'react';

import {
  IFRAME_RESIZE_REQUEST_CONTEXT,
  parseIframeResizeMessage,
  type IframeResizeDimensions,
} from '../../../../shared/constants/iframe-resize.ts';
import {
  enqueuePreview,
  PREVIEW_SETTLE_TIMEOUT_MS,
  type PreviewHandle,
} from './previewScheduler.ts';
import {
  initialThumbnailState,
  isThumbnailLoading,
  thumbnailReducer,
} from './previewThumbnailState.ts';

/** If iframe.resize never arrives, clear the spinner anyway. */
const PREVIEW_SCALE_SETTLE_FALLBACK_MS = 4500;

/** How often to poll a booting frame so its scheduler slot is released the moment it comes up. */
const PREVIEW_BOOT_POLL_MS = 150;

/**
 * A booted preview constructs `__STORYBOOK_PREVIEW__` on its window early (before the story renders),
 * so its presence marks the boot as complete. Same-origin embeds can be inspected; a cross-origin
 * embed throws, in which case we assume booted so the scheduler slot is never held indefinitely.
 */
const previewRuntimeBooted = (iframe: HTMLIFrameElement | null): boolean => {
  try {
    return !!(iframe?.contentWindow as unknown as { __STORYBOOK_PREVIEW__?: unknown })
      ?.__STORYBOOK_PREVIEW__;
  } catch {
    return true;
  }
};

// IntersectionObserver `rootMargin`s for the preview lifecycle: mount a cell's
// iframe well before it scrolls into view, evict it only much further out.
// The gap is hysteresis so scrolling near a boundary doesn't thrash.
const PREVIEW_MOUNT_ROOT_MARGIN = '50% 0px';
const PREVIEW_EVICT_ROOT_MARGIN = '150% 0px';

// Percentage rootMargins are relative to the observer root, so anchor the
// observers to the nearest scroll container rather than the window.
const getScrollRoot = (element: HTMLElement): HTMLElement | null => {
  const radixViewport = element.closest<HTMLElement>('[data-radix-scroll-area-viewport]');
  if (radixViewport) {
    return radixViewport;
  }
  let current = element.parentElement;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

export type UsePreviewThumbnailOptions = {
  storyId: string;
  getPreviewHref: (storyId: string) => string;
  summaryHidden?: boolean;
};

export type UsePreviewThumbnailResult = {
  cellRef: RefObject<HTMLDivElement>;
  iframeRef: RefObject<HTMLIFrameElement>;
  src: string | undefined;
  /** True until iframe.resize arrives and the measured scale has painted. */
  isPreviewLoading: boolean;
  rememberedDimensions: IframeResizeDimensions | null;
  forceStartCurrent: () => void;
  finishCurrent: () => void;
};

export const usePreviewThumbnail = ({
  storyId,
  getPreviewHref,
  summaryHidden = false,
}: UsePreviewThumbnailOptions): UsePreviewThumbnailResult => {
  const cellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [state, dispatch] = useReducer(thumbnailReducer, initialThumbnailState);
  const handleRef = useRef<PreviewHandle | null>(null);
  const settleRafRef = useRef({ raf1: 0, raf2: 0 });

  const { src, bootId } = state;

  // Visibility: mount near the viewport, evict far outside it. While the summary
  // overlay is hidden (`summaryHidden`), the whole subsystem freezes so loaded
  // previews are neither evicted nor re-observed.
  useEffect(() => {
    const host = cellRef.current;
    if (!host || summaryHidden) {
      return undefined;
    }
    const scrollRoot = getScrollRoot(host);
    const root = scrollRoot && scrollRoot.clientHeight > 0 ? scrollRoot : null;
    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { root, rootMargin: PREVIEW_MOUNT_ROOT_MARGIN }
    );
    const evictObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setIsInView(false);
        }
      },
      { root, rootMargin: PREVIEW_EVICT_ROOT_MARGIN }
    );
    mountObserver.observe(host);
    evictObserver.observe(host);
    return () => {
      mountObserver.disconnect();
      evictObserver.disconnect();
    };
  }, [summaryHidden]);

  useEffect(() => {
    if (!isInView) {
      dispatch({ type: 'evicted' });
    }
  }, [isInView]);

  // Queue a boot per (visible cell × preview href); the scheduler caps how
  // many iframes load at once and releases slots on load/error or deadline.
  useEffect(() => {
    if (!isInView) {
      return undefined;
    }
    const previewHref = getPreviewHref(storyId);
    dispatch({ type: 'enqueued' });
    const handle = enqueuePreview(() => {
      dispatch({ type: 'started', src: previewHref });
    });
    handleRef.current = handle;
    return () => {
      handle.release();
      handleRef.current = null;
    };
  }, [isInView, storyId, getPreviewHref]);

  // Boots are serialized (one scheduler slot), so this frame is the only one coming up. Hold the
  // slot until the preview runtime is constructed, then release it so the next queued preview
  // begins; the scheduler's own deadline is the backstop if the runtime never comes up. The
  // fallback only clears the spinner so a frame that renders without reporting its size still shows.
  useEffect(() => {
    if (!src) {
      return undefined;
    }
    let pollTimer = 0;
    let released = false;
    // Stop polling once the scheduler's own deadline would have released the slot anyway.
    let pollsLeft = Math.ceil(PREVIEW_SETTLE_TIMEOUT_MS / PREVIEW_BOOT_POLL_MS);

    const releaseSlot = () => {
      if (released) {
        return;
      }
      released = true;
      handleRef.current?.release();
    };

    const pollBoot = () => {
      if (previewRuntimeBooted(iframeRef.current)) {
        releaseSlot();
        return;
      }
      if (pollsLeft-- <= 0) {
        return;
      }
      pollTimer = window.setTimeout(pollBoot, PREVIEW_BOOT_POLL_MS);
    };

    const fallbackTimer = window.setTimeout(
      () => dispatch({ type: 'settled' }),
      PREVIEW_SCALE_SETTLE_FALLBACK_MS
    );
    pollBoot();

    return () => {
      window.clearTimeout(pollTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [bootId, src]);

  const handleResize = useCallback((dimensions: IframeResizeDimensions) => {
    dispatch({ type: 'resized', dimensions });
    // Double rAF: let the new scale paint before the spinner clears. Stale
    // callbacks are harmless — the reducer ignores `settled` outside a boot.
    cancelAnimationFrame(settleRafRef.current.raf1);
    cancelAnimationFrame(settleRafRef.current.raf2);
    settleRafRef.current.raf1 = requestAnimationFrame(() => {
      settleRafRef.current.raf2 = requestAnimationFrame(() => {
        dispatch({ type: 'settled' });
      });
    });
  }, []);

  useEffect(() => {
    const rafs = settleRafRef.current;
    return () => {
      cancelAnimationFrame(rafs.raf1);
      cancelAnimationFrame(rafs.raf2);
    };
  }, []);

  useLayoutEffect(() => {
    if (!src) {
      return undefined;
    }
    const iframe = iframeRef.current;
    if (!iframe) {
      return undefined;
    }

    const onMessage = (event: MessageEvent) => {
      // Guard against null === null when the iframe is detached; cross-origin
      // sources are WindowProxy objects, but identity comparison still works.
      if (event.source === null || event.source !== iframe.contentWindow) {
        return;
      }
      const dimensions = parseIframeResizeMessage(event.data);
      if (dimensions) {
        handleResize(dimensions);
      }
    };
    window.addEventListener('message', onMessage);

    const requestRemeasure = () => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ context: IFRAME_RESIZE_REQUEST_CONTEXT }),
          '*'
        );
      } catch {
        // Cross-origin or detached iframe; ignore.
      }
    };
    requestRemeasure();
    iframe.addEventListener('load', requestRemeasure);
    return () => {
      window.removeEventListener('message', onMessage);
      iframe.removeEventListener('load', requestRemeasure);
    };
  }, [src, handleResize]);

  const finishCurrent = useCallback(() => {
    handleRef.current?.release();
  }, []);

  const forceStartCurrent = useCallback(() => {
    handleRef.current?.forceStart();
  }, []);

  return {
    cellRef,
    iframeRef,
    src,
    isPreviewLoading: isThumbnailLoading(state),
    rememberedDimensions: state.dimensions,
    forceStartCurrent,
    finishCurrent,
  };
};
