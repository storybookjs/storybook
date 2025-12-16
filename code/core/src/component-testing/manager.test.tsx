import { describe, expect, it } from 'vitest';

import { isInteractionsDisabled } from './utils';
import type { InteractionsParameters } from './types';
import { PARAM_KEY } from './constants';

describe('Interactions Panel Disable Parameter', () => {
  it('should return true when interactions.disable is true', () => {
    const parameters: InteractionsParameters = {
      [PARAM_KEY]: {
        disable: true,
      },
    };

    expect(isInteractionsDisabled(parameters)).toBe(true);
  });

  it('should return false when interactions.disable is false', () => {
    const parameters: InteractionsParameters = {
      [PARAM_KEY]: {
        disable: false,
      },
    };

    expect(isInteractionsDisabled(parameters)).toBe(false);
  });

  it('should return false when interactions parameter is not provided', () => {
    const parameters: InteractionsParameters = {};

    expect(isInteractionsDisabled(parameters)).toBe(false);
  });

  it('should return false when disable is undefined', () => {
    const parameters: InteractionsParameters = {
      [PARAM_KEY]: {},
    };

    expect(isInteractionsDisabled(parameters)).toBe(false);
  });
});
