import type { Channel } from 'storybook/internal/channels';
import { STORY_HOT_UPDATED, STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import { global } from '@storybook/global';

const FREEZE_STYLE_ID = 'storybook-freeze-after-finished';
const PRE_FREEZE_STYLE_ID = 'storybook-freeze-end-frame-preload';

type TimerId = ReturnType<Window['setTimeout']>;
type IntervalId = ReturnType<Window['setInterval']>;
type RafId = ReturnType<Window['requestAnimationFrame']>;

const tryReplaceProperty = (target: object, key: PropertyKey, value: unknown) => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor?.configurable === false) {
      if (descriptor.writable) {
        Reflect.set(target, key, value);
      }
      return;
    }
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  } catch {
    // Best-effort only. Some environments lock descriptors.
  }
};

const getQueryParam = (search: string, key: string): string | null => {
  return new URLSearchParams(search).get(key);
};

export const shouldFreeze = ({ search }: { search: string }) => {
  const freeze = getQueryParam(search, 'freeze');
  const viewMode = getQueryParam(search, 'viewMode') ?? 'story';
  return freeze === 'finished' && viewMode === 'story';
};

/**
 * Removes all `<script>` elements from the document.
 *
 * Ordering matters: this runs after {@link finishAndPauseAnimations} (so the page's own
 * end-of-animation logic can still run while its scripts are present) but before the other
 * DOM-mutating freeze steps. Stripping scripts first stops any page-registered
 * `MutationObserver`s or handlers from reacting to the mutations those later steps perform.
 */
const stripScriptElements = (documentRef: Document) => {
  const scripts = Array.from(documentRef.querySelectorAll('script'));
  scripts.forEach((script) => {
    script.remove();
  });
};

const stripInlineEventHandlers = (documentRef: Document) => {
  const elements = Array.from(documentRef.querySelectorAll('*'));
  elements.forEach((element) => {
    const attrs = Array.from(element.attributes);
    attrs
      .filter((attr) => attr.name.toLowerCase().startsWith('on'))
      .forEach((attr) => {
        element.removeAttribute(attr.name);
      });
  });
};

const addFreezeStyles = (documentRef: Document) => {
  if (documentRef.getElementById(FREEZE_STYLE_ID)) {
    return;
  }

  const style = documentRef.createElement('style');
  style.id = FREEZE_STYLE_ID;
  style.textContent = `
    *, *::before, *::after {
      animation-play-state: paused !important;
      transition: none !important;
      caret-color: transparent !important;
    }
  `;
  documentRef.head?.appendChild(style);
};

const addPreFreezeStyles = (documentRef: Document) => {
  if (documentRef.getElementById(PRE_FREEZE_STYLE_ID)) {
    return;
  }

  const style = documentRef.createElement('style');
  style.id = PRE_FREEZE_STYLE_ID;
  style.textContent = `
    *, *::before, *::after {
      animation-delay: 0s !important;
      animation-direction: reverse !important;
      animation-play-state: paused !important;
      transition: none !important;
      caret-color: transparent !important;
    }
  `;
  documentRef.head?.appendChild(style);
};

/**
 * Settles running animations to their end frame and then pauses them.
 *
 * Must run before {@link stripScriptElements}: calling `finish()` can synchronously fire
 * `finish`/`animationend` events, and we want the page's own scripts to handle those (and
 * apply any final end-state styles) before we tear the scripts out of the document.
 */
const finishAndPauseAnimations = (documentRef: Document) => {
  if (typeof documentRef.getAnimations !== 'function') {
    return;
  }

  const animations = documentRef.getAnimations();
  animations.forEach((animation) => {
    try {
      animation.finish();
    } catch {
      // Infinite or unresolved animations cannot be finished; still pause them in place.
    }

    try {
      animation.pause();
    } catch {
      // Best-effort only, some animations may no longer be pausable.
    }
  });
};

const blockInteractions = (documentRef: Document) => {
  const blockedEvents: Array<keyof GlobalEventHandlersEventMap> = [
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'pointerdown',
    'pointerup',
    'touchstart',
    'touchend',
    'keydown',
    'keyup',
    'keypress',
    'input',
    'change',
    'submit',
  ];

  const stopEvent = (event: Event) => {
    event.stopImmediatePropagation();
    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  blockedEvents.forEach((eventName) => {
    documentRef.addEventListener(eventName, stopEvent, { capture: true });
  });
};

const createStoryFreezer = (windowRef: Window, documentRef: Document) => {
  let frozen = false;
  // Set as soon as freezing starts so wrappers reject any async work scheduled
  // synchronously by animation-finish handlers, before `frozen` is committed.
  let freezing = false;

  const trackedTimeouts = new Set<TimerId>();
  const trackedIntervals = new Set<IntervalId>();
  const trackedRafs = new Set<RafId>();

  const originalSetTimeout = windowRef.setTimeout.bind(windowRef);
  const originalClearTimeout = windowRef.clearTimeout.bind(windowRef);
  const originalSetInterval = windowRef.setInterval.bind(windowRef);
  const originalClearInterval = windowRef.clearInterval.bind(windowRef);
  const originalRequestAnimationFrame = windowRef.requestAnimationFrame.bind(windowRef);
  const originalCancelAnimationFrame = windowRef.cancelAnimationFrame.bind(windowRef);
  const originalQueueMicrotask =
    typeof windowRef.queueMicrotask === 'function'
      ? windowRef.queueMicrotask.bind(windowRef)
      : (callback: VoidFunction) => {
          originalSetTimeout(callback, 0);
        };

  const setTimeoutWrapper = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (frozen || freezing) {
      return -1 as TimerId;
    }
    const timerId = originalSetTimeout(handler, timeout, ...args);
    trackedTimeouts.add(timerId);
    return timerId;
  }) as Window['setTimeout'];

  const clearTimeoutWrapper = ((id?: TimerId) => {
    if (id !== undefined) {
      trackedTimeouts.delete(id);
    }
    return originalClearTimeout(id);
  }) as Window['clearTimeout'];

  const setIntervalWrapper = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (frozen || freezing) {
      return -1 as IntervalId;
    }
    const timerId = originalSetInterval(handler, timeout, ...args);
    trackedIntervals.add(timerId);
    return timerId;
  }) as Window['setInterval'];

  const clearIntervalWrapper = ((id?: IntervalId) => {
    if (id !== undefined) {
      trackedIntervals.delete(id);
    }
    return originalClearInterval(id);
  }) as Window['clearInterval'];

  const requestAnimationFrameWrapper = ((callback: FrameRequestCallback) => {
    if (frozen || freezing) {
      return -1 as RafId;
    }
    const rafId = originalRequestAnimationFrame(callback);
    trackedRafs.add(rafId);
    return rafId;
  }) as Window['requestAnimationFrame'];

  const cancelAnimationFrameWrapper = ((id: RafId) => {
    trackedRafs.delete(id);
    return originalCancelAnimationFrame(id);
  }) as Window['cancelAnimationFrame'];

  const queueMicrotaskWrapper: typeof windowRef.queueMicrotask = ((callback: VoidFunction) => {
    if (frozen || freezing) {
      return;
    }
    originalQueueMicrotask(callback);
  }) as typeof windowRef.queueMicrotask;

  tryReplaceProperty(windowRef, 'setTimeout', setTimeoutWrapper);
  tryReplaceProperty(windowRef, 'clearTimeout', clearTimeoutWrapper);
  tryReplaceProperty(windowRef, 'setInterval', setIntervalWrapper);
  tryReplaceProperty(windowRef, 'clearInterval', clearIntervalWrapper);
  tryReplaceProperty(windowRef, 'requestAnimationFrame', requestAnimationFrameWrapper);
  tryReplaceProperty(windowRef, 'cancelAnimationFrame', cancelAnimationFrameWrapper);
  tryReplaceProperty(windowRef, 'queueMicrotask', queueMicrotaskWrapper);

  const freeze = () => {
    if (frozen || freezing) {
      return;
    }
    freezing = true;

    try {
      trackedTimeouts.forEach((timerId) => {
        originalClearTimeout(timerId);
      });
      trackedIntervals.forEach((intervalId) => {
        originalClearInterval(intervalId);
      });
      trackedRafs.forEach((rafId) => {
        originalCancelAnimationFrame(rafId);
      });
      trackedTimeouts.clear();
      trackedIntervals.clear();
      trackedRafs.clear();

      finishAndPauseAnimations(documentRef);
      stripScriptElements(documentRef);
      addFreezeStyles(documentRef);
      stripInlineEventHandlers(documentRef);
      blockInteractions(documentRef);
    } finally {
      // Mark frozen last so a throw in any step can't leave the story
      // wedged as "frozen" before the freeze actually completed.
      frozen = true;
    }
  };

  return { freeze };
};

export type StoryFreezerOptions = {
  /** Called once after the document has been frozen. */
  onFrozen?: () => void;
};

export const setupStoryFreezer = (
  channel: Pick<Channel, 'on'>,
  options: StoryFreezerOptions = {}
) => {
  const windowRef = global.window;
  const documentRef = global.document;
  if (!windowRef || !documentRef) {
    return false;
  }

  if (!shouldFreeze({ search: documentRef.location.search })) {
    return false;
  }

  addPreFreezeStyles(documentRef);
  const freezer = createStoryFreezer(windowRef, documentRef);
  let notifiedFrozen = false;
  channel.on(STORY_RENDER_PHASE_CHANGED, ({ newPhase }) => {
    if (newPhase === 'finished') {
      const runFreeze = () => {
        if (notifiedFrozen) {
          return;
        }
        freezer.freeze();
        notifiedFrozen = true;
        options.onFrozen?.();
      };
      if (typeof windowRef.queueMicrotask === 'function') {
        windowRef.queueMicrotask(runFreeze);
      } else {
        windowRef.setTimeout(runFreeze, 0);
      }
    }
  });

  // The HMR connection stays live (we no longer block reloads or skip the builder's HMR handler),
  // but applying a hot update in place would re-render into an already-frozen document, where
  // scripts are stripped, timers and animations are paused, and interactions are blocked, so the
  // updated story would never come alive. Instead, reload the whole iframe on any hot update so it
  // boots fresh and re-freezes cleanly once the new render finishes.
  channel.on(STORY_HOT_UPDATED, () => {
    windowRef.location.reload();
  });

  return true;
};
