import * as React from 'react';

import type { UniversalState } from './universal-state';

export const useUniversalState = <
  TUniversalState extends UniversalState,
  TState extends TUniversalState['state'],
>(
  universalState: TUniversalState
): [TState, React.Dispatch<React.SetStateAction<TState>>] => {
  const getSnapshot = React.useCallback(() => universalState.state, [universalState]);

  const state = React.useSyncExternalStore<TState>(universalState.subscribe, getSnapshot);

  const setState = React.useCallback<React.Dispatch<React.SetStateAction<TState>>>(
    (nextStateOrSetter) => {
      const nextState =
        typeof nextStateOrSetter === 'function'
          ? (nextStateOrSetter as (prevState: TState) => TState)(universalState.state)
          : nextStateOrSetter;
      universalState.state = nextState;
    },
    [universalState]
  );

  return [state, setState];
};
