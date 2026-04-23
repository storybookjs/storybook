import { describe, expect, it } from 'vitest';

import { INITIAL_RENAME_REDIRECT_STATE, applyRenameChains } from './index.ts';

describe('applyRenameChains', () => {
  it('records a single rename as a new chain entry', () => {
    const result = applyRenameChains(
      INITIAL_RENAME_REDIRECT_STATE,
      [{ oldId: 'button--primary', newId: 'button--secondary' }],
      []
    );
    expect(result.chains).toEqual({ 'button--primary': ['button--secondary'] });
  });
});
