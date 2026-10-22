import { useSyncExternalStore } from 'react';

const ATTRIBUTE = 'data-shortcuts-enabled';

const subscribe = (onChange: () => void) => {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { attributes: true, attributeFilter: [ATTRIBUTE] });
  return () => observer.disconnect();
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
