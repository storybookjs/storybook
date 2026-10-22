import { useSyncExternalStore } from 'react';

const ATTRIBUTE = 'data-shortcuts-enabled';

// One observer is shared by all subscribers, because every mounted Button subscribes.
const listeners = new Set<() => void>();
let observer: MutationObserver | undefined;

const subscribe = (onChange: () => void) => {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }
  listeners.add(onChange);
  if (!observer) {
    observer = new MutationObserver(() => listeners.forEach((listener) => listener()));
    observer.observe(document.body, { attributes: true, attributeFilter: [ATTRIBUTE] });
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      observer?.disconnect();
      observer = undefined;
    }
  };
};

const getSnapshot = () =>
  typeof document === 'undefined' || document.body?.getAttribute(ATTRIBUTE) !== 'false';

const getServerSnapshot = () => true;

/**
 * Whether Storybook keyboard shortcuts are enabled. The manager reflects its `ui.enableShortcuts`
 * state in a `data-shortcuts-enabled` attribute on the body. Buttons are public API and can be
 * rendered outside the manager (e.g. in MDX), so we read that attribute instead of the manager API.
 * Outside the manager the attribute is absent, and shortcuts are considered enabled.
 */
export const useShortcutsEnabled = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
