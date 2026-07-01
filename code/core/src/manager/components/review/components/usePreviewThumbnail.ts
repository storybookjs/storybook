import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from 'react';

import { IFRAME_RESIZE_REQUEST_CONTEXT } from '../../../../shared/constants/iframe-resize.ts';
import { parseIframeResizeMessage, type ContentDimensions } from './iframeResizeMessage.ts';
import {
  PREVIEW_SETTLE_TIMEOUT_MS,
  enqueuePreview,
  finishPreview,
  forceStartPreview,
  type PreviewTask,
} from './previewScheduler.ts';

/** If iframe.resize never arrives, don't block the thumbnail forever. */
const PREVIEW_SCALE_SETTLE_FALLBACK_MS = PREVIEW_SETTLE_TIMEOUT_MS * 3;

// IntersectionObserver `rootMargin`s for the preview lifecycle: mount a cell's
// The gap is hysteresis so scrolling near a boundary doesn't thrash.
const PREVIEW_MOUNT_ROOT_MARGIN = '50% 0px';
const PREVIEW_EVICT_ROOT_MARGIN = '150% 0px';

const resizeHandlers = new Map<Window, (dimensions: ContentDimensions) => void>();
let resizeMessageListening = false;

const ensureResizeMessageListener = (): void => {
  if (resizeMessageListening) {
    return;
  }
  resizeMessageListening = true;
  window.addEventListener('message', (event: MessageEvent) => {
    // Cross-origin iframe sources are WindowProxy objects; avoid `instanceof Window`.
    const source = event.source;
    if (source == null) {
      return;
    }
    const handler = resizeHandlers.get(source as Window);
    if (!handler) {
      return;
    }
    const dimensions = parseIframeResizeMessage(event.data);
    if (dimensions) {
      handler(dimensions);
    }
  });
};

const registerResizeHandler = (
  contentWindow: Window,
  handler: (dimensions: ContentDimensions) => void
): (() => void) => {
  ensureResizeMessageListener();
  resizeHandlers.set(contentWindow, handler);
  return () => {
    resizeHandlers.delete(contentWindow);
  };
};

const requestEmbedRemeasure = (contentWindow: Window): void => {
  try {
    contentWindow.postMessage(JSON.stringify({ context: IFRAME_RESIZE_REQUEST_CONTEXT }), '*');
  } catch {
    // Cross-origin or detached iframe; ignore.
  }
};

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

const isWithinPreloadRange = (
  element: HTMLElement,
  root: HTMLElement | null,
  margin: number
): boolean => {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  if (root) {
    const rootRect = root.getBoundingClientRect();
    return rect.bottom >= rootRect.top - margin && rect.top <= rootRect.bottom + margin;
  }
  const viewportHeight =
    typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight || 0;
  return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
};

const getPreloadMargin = (scrollRoot: HTMLElement | null): number => {
  if (!scrollRoot) {
    return typeof window === 'undefined' ? 0 : window.innerHeight;
  }
  return scrollRoot.clientHeight || window.innerHeight;
};

export type UsePreviewThumbnailOptions = {
  storyId: string;
  getPreviewHref: (storyId: string) => string;
  previewsPaused?: boolean;
};

export type UsePreviewThumbnailResult = {
  cellRef: RefObject<HTMLDivElement>;
  frameRef: Ref<HTMLDivElement>;
  iframeRef: RefObject<HTMLIFrameElement>;
  src: string | undefined;
  /** True until iframe.resize arrives and the measured scale has painted. */
  isPreviewLoading: boolean;
  rememberedDimensions: ContentDimensions | null;
  forceStartCurrent: () => void;
  finishCurrent: () => void;
};

export const usePreviewThumbnail = ({
  storyId,
  getPreviewHref,
  previewsPaused = false,
}: UsePreviewThumbnailOptions): UsePreviewThumbnailResult => {
  const cellRef = useRef<HTMLDivElement>(null);
  const frameElementRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useCallback((node: HTMLDivElement | null) => {
    frameElementRef.current = node;
  }, []);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewsPausedRef = useRef(previewsPaused);
  previewsPausedRef.current = previewsPaused;
  const [isInView, setIsInView] = useState(false);
  const [rememberedDimensions, setRememberedDimensions] = useState<ContentDimensions | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [src, setSrc] = useState<string | undefined>(undefined);
  const taskRef = useRef<PreviewTask | null>(null);

  useEffect(() => {
    const host = cellRef.current;
    if (!host) {
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return undefined;
    }
    const scrollRoot = getScrollRoot(host);
    const effectiveRoot = scrollRoot && scrollRoot.clientHeight > 0 ? scrollRoot : null;
    const markInViewIfClose = () => {
      if (isWithinPreloadRange(host, effectiveRoot, getPreloadMargin(scrollRoot))) {
        setIsInView(true);
      }
    };
    markInViewIfClose();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => markInViewIfClose())
        : undefined;
    resizeObserver?.observe(host);
    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { root: effectiveRoot, rootMargin: PREVIEW_MOUNT_ROOT_MARGIN }
    );
    const evictObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !previewsPausedRef.current) {
          setIsInView(false);
        }
      },
      { root: effectiveRoot, rootMargin: PREVIEW_EVICT_ROOT_MARGIN }
    );
    mountObserver.observe(host);
    evictObserver.observe(host);
    return () => {
      resizeObserver?.disconnect();
      mountObserver.disconnect();
      evictObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isInView && !previewsPaused) {
      setSrc(undefined);
    }
  }, [isInView, previewsPaused]);

  useEffect(() => {
    setRememberedDimensions(null);
    setIsPreviewLoading(false);
  }, [storyId]);

  useEffect(() => {
    if (!isInView) {
      return undefined;
    }
    const previewHref = getPreviewHref(storyId);
    const task: PreviewTask = {
      start: () => {
        setSrc(previewHref);
      },
      started: false,
      finished: false,
    };
    taskRef.current = task;
    enqueuePreview(task);
    return () => {
      finishPreview(task);
      taskRef.current = null;
    };
  }, [isInView, storyId, getPreviewHref]);

  const finishCurrent = useCallback(() => {
    if (taskRef.current) {
      finishPreview(taskRef.current);
    }
  }, []);

  const forceStartCurrent = useCallback(() => {
    if (taskRef.current) {
      forceStartPreview(taskRef.current);
    }
  }, []);

  useEffect(() => {
    if (!src) {
      return undefined;
    }
    const timer = setTimeout(finishCurrent, PREVIEW_SETTLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [src, finishCurrent]);

  useEffect(() => {
    if (!src) {
      setRememberedDimensions(null);
      setIsPreviewLoading(false);
      return undefined;
    }
    setIsPreviewLoading(true);
    const fallback = setTimeout(() => setIsPreviewLoading(false), PREVIEW_SCALE_SETTLE_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [src]);

  // Keep the overlay until measured scale is committed and painted (post-bootstrap).
  useLayoutEffect(() => {
    if (!rememberedDimensions) {
      return undefined;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setIsPreviewLoading(false);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [rememberedDimensions]);

  useLayoutEffect(() => {
    if (!src) {
      return undefined;
    }
    const iframe = iframeRef.current;
    if (!iframe) {
      return undefined;
    }

    const attach = () => {
      const contentWindow = iframe.contentWindow;
      if (!contentWindow) {
        return undefined;
      }
      const detachHandler = registerResizeHandler(contentWindow, (dimensions) => {
        setRememberedDimensions((current) =>
          current?.width === dimensions.width && current?.height === dimensions.height
            ? current
            : dimensions
        );
      });
      requestEmbedRemeasure(contentWindow);
      return detachHandler;
    };

    let detach = attach();
    const onLoad = () => {
      detach?.();
      detach = attach();
    };
    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      detach?.();
    };
  }, [src]);

  return {
    cellRef,
    frameRef,
    iframeRef,
    src,
    isPreviewLoading,
    rememberedDimensions,
    forceStartCurrent,
    finishCurrent,
  };
};
