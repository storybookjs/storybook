import { useEffect, useState } from 'storybook/internal/preview-api';

import { isEqual } from 'es-toolkit';

import type { UniversalStore } from './index';

/**
 * A hook to use a UniversalStore in a rendered preview. This hook will react to changes in the
 * store state and re-render when the store changes.
 *
 * @param universalStore The UniversalStore instance to use.
 * @param selector An optional selector function to select a subset of the store state.
 * @remark This hook is intended for use in the preview. For use in the manager UI, import from
 * `storybook/internal/manager-api` instead.
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
  const [state, setState] = useState(
    selector ? selector(universalStore.getState()) : universalStore.getState()
  );

  useEffect(() => {
    return universalStore.onStateChange((nextState, previousState) => {
      if (!selector) {
        setState(nextState);
        return;
      }
      const selectedNextState = selector(nextState);
      const selectedPreviousState = selector(previousState);

      const hasChanges = !isEqual(selectedNextState, selectedPreviousState);
      if (hasChanges) {
        setState(selectedNextState);
      }
    });
  }, [universalStore, setState, selector]);

  return [state, universalStore.setState];
};
