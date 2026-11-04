import React from 'react';

/**
 * Stand-in for `use-sync-external-store/shim/index.js`, which react-aria and react-stately import.
 * The build resolves the shim to this module so that `storybook` need not depend on the package.
 *
 * Like the real shim, it returns React's own `useSyncExternalStore` when there is one (React 18 and
 * later). It reads the hook as a property instead of importing it by name, because in Preact
 * projects `react` resolves to `preact/compat`, which only has the hook from Preact 10.9. Older
 * versions get a port of the shim's fallback, which is safe without concurrent rendering.
 */
export const useSyncExternalStore: typeof React.useSyncExternalStore =
  React.useSyncExternalStore ?? useSyncExternalStoreFallback;

function useSyncExternalStoreFallback<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T
): T {
  const value = getSnapshot();
  const [{ inst }, forceUpdate] = React.useState({ inst: { value, getSnapshot } });

  React.useLayoutEffect(() => {
    inst.value = value;
    inst.getSnapshot = getSnapshot;
    if (didSnapshotChange(inst)) {
      forceUpdate({ inst });
    }
  }, [subscribe, value, getSnapshot]);

  React.useEffect(() => {
    if (didSnapshotChange(inst)) {
      forceUpdate({ inst });
    }
    return subscribe(() => {
      if (didSnapshotChange(inst)) {
        forceUpdate({ inst });
      }
    });
  }, [subscribe]);

  return value;
}

function didSnapshotChange<T>(inst: { value: T; getSnapshot: () => T }): boolean {
  try {
    return !Object.is(inst.value, inst.getSnapshot());
  } catch {
    return true;
  }
}
