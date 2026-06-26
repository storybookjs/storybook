import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import {
  PREVIEW_SETTLE_TIMEOUT_MS,
  enqueuePreview,
  finishPreview,
  forceStartPreview,
  type PreviewTask,
} from './previewScheduler.ts';

// IntersectionObserver `rootMargin`s for the preview lifecycle: mount a cell's
// iframe within half a root-height of the fold, evict it past one and a half.
// The gap is hysteresis so scrolling near a boundary doesn't thrash.
const PREVIEW_MOUNT_ROOT_MARGIN = '50% 0px';
const PREVIEW_EVICT_ROOT_MARGIN = '150% 0px';

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
  src: string | undefined;
  forceStartCurrent: () => void;
  finishCurrent: () => void;
};

export const usePreviewThumbnail = ({
  storyId,
  getPreviewHref,
  previewsPaused = false,
}: UsePreviewThumbnailOptions): UsePreviewThumbnailResult => {
  const cellRef = useRef<HTMLDivElement>(null);
  const previewsPausedRef = useRef(previewsPaused);
  previewsPausedRef.current = previewsPaused;
  const [isInView, setIsInView] = useState(false);
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
    if (!isInView) {
      return undefined;
    }
    const previewHref = getPreviewHref(storyId);
    const task: PreviewTask = {
      start: () => {
        setSrc((current) => (current === previewHref ? current : previewHref));
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

  return {
    cellRef,
    src,
    forceStartCurrent,
    finishCurrent,
  };
};
