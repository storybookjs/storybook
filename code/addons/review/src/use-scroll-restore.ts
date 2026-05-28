import { type RefObject, useEffect } from 'react';

// Restoring a scroll offset right after mount is racy: the panel's content
// (lazy story thumbnails, collapsibles) keeps growing for several frames, so a
// single `scrollTop = x` lands short. This drives the offset across animation
// frames — re-applying until the scroll height stabilises — and also reacts to
// late layout shifts via a ResizeObserver, bailing out after a deadline.
const RESTORE_DEADLINE_MS = 2500;
const STABLE_FRAMES_REQUIRED = 2;

export function useScrollRestore({
  panelRef,
  isActive,
  getTargetScrollTop,
  resetKey,
}: {
  panelRef: RefObject<HTMLElement | null>;
  /** Only the visible panel is restored; hidden panels keep their DOM offset. */
  isActive: boolean;
  /** Read lazily so programmatic scrolls during restore can't clobber the goal. */
  getTargetScrollTop: () => number;
  /** Changing this re-runs the restore (e.g. a new review resets to the top). */
  resetKey: unknown;
}): void {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !isActive) {
      return undefined;
    }
    const desiredScrollTop = Math.max(0, getTargetScrollTop());
    let rafId: number | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let stableFrames = 0;
    const deadline = performance.now() + RESTORE_DEADLINE_MS;

    const cleanup = () => {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }
      resizeObserver?.disconnect();
      resizeObserver = undefined;
    };

    const restore = () => {
      rafId = undefined;
      const maxScrollable = Math.max(0, panel.scrollHeight - panel.clientHeight);
      const targetScrollTop = Math.min(desiredScrollTop, maxScrollable);
      panel.scrollTop = targetScrollTop;
      const closeEnough = Math.abs(panel.scrollTop - targetScrollTop) <= 1;
      const canFullyRestore = desiredScrollTop === 0 || maxScrollable >= desiredScrollTop;
      if (closeEnough && canFullyRestore) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }
      if (stableFrames >= STABLE_FRAMES_REQUIRED || performance.now() >= deadline) {
        cleanup();
        return;
      }
      rafId = requestAnimationFrame(restore);
    };

    rafId = requestAnimationFrame(restore);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (rafId === undefined) {
          rafId = requestAnimationFrame(restore);
        }
      });
      resizeObserver.observe(panel);
    }
    return cleanup;
  }, [panelRef, isActive, getTargetScrollTop, resetKey]);
}
