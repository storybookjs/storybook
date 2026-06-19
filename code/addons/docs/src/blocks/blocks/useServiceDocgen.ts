import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { DocgenPayload } from 'storybook/internal/types';

import type { DocgenService } from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

type SnapshotCache = {
  id: string | undefined;
  value: DocgenPayload | undefined;
};

/** Subscribes docs blocks to the preview's local `core/docgen` runtime. */
export function useServiceDocgen(id: string | undefined): DocgenPayload | undefined {
  const snapshotCache = useRef<SnapshotCache>({ id: undefined, value: undefined });
  const service = useMemo(() => {
    try {
      return getService<DocgenService>('core/docgen');
    } catch {
      return undefined;
    }
  }, []);

  const getSnapshot = useCallback(() => {
    return snapshotCache.current.id === id ? snapshotCache.current.value : undefined;
  }, [id]);

  const subscribe = useCallback(
    (listener: () => void) =>
      service && id
        ? service.queries.getDocgen.subscribe({ id }, (value) => {
            snapshotCache.current = { id, value };
            listener();
          })
        : () => {},
    [service, id]
  );

  return useSyncExternalStoreShim(subscribe, getSnapshot);
}

/**
 * Inlined fallback for React's `useSyncExternalStore`.
 *
 * `addon-docs` still supports React 16.8 and 17 (see the `react` range in `package.json`), and
 * `useSyncExternalStore` only exists from React 18 onwards. This is a faithful port of the official
 * `use-sync-external-store/shim` fallback, which is safe on React 16/17 because those versions render
 * synchronously and therefore can't tear (the tearing problem the real hook guards against only
 * occurs with concurrent rendering, which doesn't exist before React 18).
 *
 * The snapshot is recomputed on every render and returned directly, so the value is always current
 * during render; the `useState` updater is used solely as a force-re-render mechanism when the store
 * emits a change. The layout effect re-checks the snapshot to catch a store mutation that happened
 * between render and commit.
 *
 * TODO: Delete this shim and go back to importing `useSyncExternalStore` from `react` once we drop
 * support for React < 18.
 */
function useSyncExternalStoreShim<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T
): T {
  const value = getSnapshot();
  // `inst` is a stable mutable container that is never reassigned, so it is intentionally omitted
  // from the effect dependency arrays below (matching React's upstream shim). The dependency arrays
  // are deliberately `[subscribe, value, getSnapshot]` and `[subscribe]` to preserve the exact
  // re-subscription semantics of `useSyncExternalStore`.
  const [{ inst }, forceUpdate] = useState({ inst: { value, getSnapshot } });

  useLayoutEffect(() => {
    inst.value = value;
    inst.getSnapshot = getSnapshot;

    if (didSnapshotChange(inst)) {
      forceUpdate({ inst });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, value, getSnapshot]);

  useEffect(() => {
    // Re-check on subscribe in case the store changed before the subscription was set up.
    if (didSnapshotChange(inst)) {
      forceUpdate({ inst });
    }

    return subscribe(() => {
      if (didSnapshotChange(inst)) {
        forceUpdate({ inst });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

  return value;
}

function didSnapshotChange<T>(inst: { value: T; getSnapshot: () => T }): boolean {
  const latestGetSnapshot = inst.getSnapshot;
  const prevValue = inst.value;
  try {
    const nextValue = latestGetSnapshot();
    return !Object.is(prevValue, nextValue);
  } catch {
    return true;
  }
}
