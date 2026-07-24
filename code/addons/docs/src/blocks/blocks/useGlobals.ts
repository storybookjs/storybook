import { useCallback, useContext, useEffect, useState } from 'react';

import { GLOBALS_UPDATED, UPDATE_GLOBALS } from 'storybook/internal/core-events';
import type { Globals } from 'storybook/internal/csf';

import { DocsContext } from './DocsContext';

export const useGlobals = (): [Globals, (globals: Globals) => void] => {
  const context = useContext(DocsContext);
  const [globals, setGlobals] = useState(context.getGlobals());

  useEffect(() => {
    const onGlobalsUpdated = (changed: { globals: Globals }) => {
      setGlobals(changed.globals);
    };
    context.channel.on(GLOBALS_UPDATED, onGlobalsUpdated);
    return () => context.channel.off(GLOBALS_UPDATED, onGlobalsUpdated);
  }, [context.channel]);

  const updateGlobals = useCallback(
    (updatedGlobals: Globals) =>
      context.channel.emit(UPDATE_GLOBALS, { globals: updatedGlobals }),
    [context.channel]
  );

  return [globals, updateGlobals];
};
