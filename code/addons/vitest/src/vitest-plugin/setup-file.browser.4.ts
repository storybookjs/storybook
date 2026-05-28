import { beforeEach } from 'vitest';

import { commands } from 'vitest/browser';

import { isFunction } from 'es-toolkit/predicate';

export const resetMousePositionBeforeTests = async () => {
  if ('resetMousePosition' in commands && isFunction(commands.resetMousePosition)) {
    await commands.resetMousePosition();
  }
};

beforeEach(async () => {
  await resetMousePositionBeforeTests();
});
