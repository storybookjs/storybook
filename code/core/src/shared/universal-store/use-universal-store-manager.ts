import * as React from 'react';

import { isEqual } from 'es-toolkit';

import type { UniversalStore } from './index';

/**
 * A hook to use a UniversalStore in the manager UI (eg. in an addon panel). This hook will react to
 * changes in the store state and re-render when the store changes.
 *
 * @param universalStore The UniversalStore instance to use.
 * @param selector An optional selector function to select a subset of the store state.
 * @remark This hook is intended for use in the manager UI. For use in the preview, import from
 * `storybook/internal/preview-api` instead.
 */
export const useUniversalStore: {
  <
    TUniversalStore extends UniversalStore<TState, any>,
    TState = TUniversalStore extends UniversalStore<infer S, any> ? S : never,
  >(
    universalStore: TUniversalStore
  ): [TState, TUniversalStore['setState']];
  <
    TUniversalStore extends UniversalStore<any, any>,
    TSelectedState,
    TState = TUniversalStore extends UniversalStore<infer S, any> ? S : never,
  >(
    universalStore: TUniversalStore,
    selector: (state: TState) => TSelectedState
  ): [TSelectedState, TUniversalStore['setState']];
} = <
  TUniversalStore extends UniversalStore<any, any>,
  TSelectedState,
  TState = TUniversalStore extends UniversalStore<infer S, any> ? S : never,
>(
  universalStore: TUniversalStore,
  selector?: (state: TState) => TSelectedState
): [TSelectedState, TUniversalStore['setState']] => {
  const subscribe = React.useCallback<Parameters<(typeof React)['useSyncExternalStore']>[0]>(
    (listener) =>
      universalStore.onStateChange((state, previousState) => {
        if (!selector) {
          listener();
          return;
        }
        const selectedState = selector(state);
        const selectedPreviousState = selector(previousState);

        const hasChanges = !isEqual(selectedState, selectedPreviousState);
        if (hasChanges) {
          listener();
        }
      }),
    [universalStore, selector]
  );

  const getSnapshot = React.useCallback(
    () => (selector ? selector(universalStore.getState()) : universalStore.getState()),
    [universalStore, selector]
  );

  const state = React.useSyncExternalStore(subscribe, getSnapshot);

  return [state, universalStore.setState];
};
