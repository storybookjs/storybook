import { describe, expect, it } from 'vite-plus/test';

import { configureActions } from '../..';
import { config } from '../configureActions';

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
