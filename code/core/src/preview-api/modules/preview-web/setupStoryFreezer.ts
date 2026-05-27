import type { Channel } from 'storybook/internal/channels';
import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import { global } from '@storybook/global';

const FREEZE_STYLE_ID = 'storybook-freeze-after-finished';

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

  const trackedTimeouts = new Set<TimerId>();
  const trackedIntervals = new Set<IntervalId>();
  const trackedRafs = new Set<RafId>();

  const originalSetTimeout = windowRef.setTimeout.bind(windowRef);
  const originalClearTimeout = windowRef.clearTimeout.bind(windowRef);
  const originalSetInterval = windowRef.setInterval.bind(windowRef);
  const originalClearInterval = windowRef.clearInterval.bind(windowRef);
  const originalRequestAnimationFrame = windowRef.requestAnimationFrame.bind(windowRef);
  const originalCancelAnimationFrame = windowRef.cancelAnimationFrame.bind(windowRef);
  const originalQueueMicrotask = windowRef.queueMicrotask.bind(windowRef);

  const setTimeoutWrapper = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (frozen) {
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
    if (frozen) {
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
    if (frozen) {
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
    if (frozen) {
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
    if (frozen) {
      return;
    }

    frozen = true;
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

    stripScriptElements(documentRef);
    stripInlineEventHandlers(documentRef);
    addFreezeStyles(documentRef);
    blockInteractions(documentRef);
  };

  return { freeze };
};

export const setupStoryFreezer = (channel: Pick<Channel, 'on'>) => {
  const windowRef = global.window;
  const documentRef = global.document;
  if (!windowRef || !documentRef) {
    return false;
  }

  if (!shouldFreeze({ search: documentRef.location.search })) {
    return false;
  }

  const freezer = createStoryFreezer(windowRef, documentRef);
  channel.on(STORY_RENDER_PHASE_CHANGED, ({ newPhase }) => {
    if (newPhase === 'finished') {
      if (typeof windowRef.queueMicrotask === 'function') {
        windowRef.queueMicrotask(freezer.freeze);
      } else {
        windowRef.setTimeout(freezer.freeze, 0);
      }
    }
  });
  return true;
};
