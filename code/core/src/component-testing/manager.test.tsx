import { describe, expect, it } from 'vitest';

import { PARAM_KEY } from './constants';

describe('Interactions Panel Disable Parameter', () => {
  it('should return true when interactions.disable is true', () => {
    const parameters = {
      [PARAM_KEY]: {
        disable: true,
      },
    };

    const disabled = !!parameters?.[PARAM_KEY]?.disable;
    expect(disabled).toBe(true);
  });

  it('should return false when interactions.disable is false', () => {
    const parameters = {
      [PARAM_KEY]: {
        disable: false,
      },
    };

    const disabled = !!parameters?.[PARAM_KEY]?.disable;
    expect(disabled).toBe(false);
  });

  it('should return false when interactions parameter is not provided', () => {
    const parameters = {};

    const disabled = !!parameters?.[PARAM_KEY]?.disable;
    expect(disabled).toBe(false);
  });

  it('should return false when disable is undefined', () => {
    const parameters = {
      [PARAM_KEY]: {},
    };

    const disabled = !!parameters?.[PARAM_KEY]?.disable;
    expect(disabled).toBe(false);
  });
});
