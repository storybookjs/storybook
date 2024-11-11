import { useCallback, useEffect, useState } from 'storybook/internal/preview-api';

import type { UniversalState } from './universal-state';

export const useUniversalState = <
  TUniversalState extends UniversalState,
  TState extends TUniversalState['state'],
>(
  universalState: TUniversalState
): [TState, any] => {
  const [state, setState] = useState(universalState.state);

  useEffect(() => {
    console.warn('LOG PREVIEW: subscribing to universal state');
    const listener = (nextState: TState) => {
      console.warn('LOG PREVIEW: universal state updated, setting internal state', nextState);
      setState(nextState);
    };
    universalState.subscribe(listener);
    return () => universalState.unsubscribe(listener);
  }, [universalState, setState]);

  useEffect(() => {
    console.warn('LOG PREVIEW: internal state set', state, universalState.state !== state);
    if (universalState.state !== state) {
      universalState.state = state;
    }
  }, [state, universalState]);

  return [state, setState];
};
