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
  PREVIEW_SETTLE_TIMEOUT_MS,
  enqueuePreview,
  type PreviewHandle,
} from './previewScheduler.ts';
import {
  initialThumbnailState,
  isThumbnailLoading,
  thumbnailReducer,
} from './previewThumbnailState.ts';

/**
 * If iframe.resize never arrives, clear the spinner anyway. 3× the scheduler slot deadline so even
 * a boot that spent a full queue round waiting still gets time to report.
 */
const PREVIEW_SCALE_SETTLE_FALLBACK_MS = PREVIEW_SETTLE_TIMEOUT_MS * 3;

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
  previewsPaused?: boolean;
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
  previewsPaused = false,
}: UsePreviewThumbnailOptions): UsePreviewThumbnailResult => {
  const cellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [state, dispatch] = useReducer(thumbnailReducer, initialThumbnailState);
  const handleRef = useRef<PreviewHandle | null>(null);
  const settleRafRef = useRef({ raf1: 0, raf2: 0 });

  const { src, bootId } = state;

  // Visibility: mount near the viewport, evict far outside it. While the
  // summary overlay parks this grid off-screen (`previewsPaused`), the whole
  // subsystem freezes so loaded previews are neither evicted nor re-observed.
  useEffect(() => {
    const host = cellRef.current;
    if (!host || previewsPaused) {
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
  }, [previewsPaused]);

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

  useEffect(() => {
    if (!src) {
      return undefined;
    }
    const timer = setTimeout(() => dispatch({ type: 'settled' }), PREVIEW_SCALE_SETTLE_FALLBACK_MS);
    return () => clearTimeout(timer);
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
