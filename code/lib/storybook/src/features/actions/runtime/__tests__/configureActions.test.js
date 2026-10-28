import { describe, expect, it } from 'vitest';

import { configureActions } from '../../index.ts';
import { config } from '../configureActions.ts';

describe('Configure Actions', () => {
  it('can configure actions', () => {
    const depth = 100;
    const clearOnStoryChange = false;
    const limit = 20;

    configureActions({
      depth,
      clearOnStoryChange,
      limit,
    });

    expect(config).toEqual({
      depth,
      clearOnStoryChange,
      limit,
    });
  });
});
