import { describe, expect, it } from 'vitest';

import {
  INITIAL_RENAME_REDIRECT_STATE,
  type RenameRedirectState,
  applyRenameChains,
} from './index.ts';

describe('applyRenameChains', () => {
  it('records a single rename as a new chain entry', () => {
    const result = applyRenameChains(
      INITIAL_RENAME_REDIRECT_STATE,
      [{ oldId: 'button--primary', newId: 'button--secondary' }],
      []
    );
    expect(result.chains).toEqual({ 'button--primary': ['button--secondary'] });
  });

  it('extends existing chains when rename destination matches previous last element', () => {
    const initial: RenameRedirectState = { chains: { 'a--x': ['b--x'] } };
    const result = applyRenameChains(initial, [{ oldId: 'b--x', newId: 'c--x' }], []);
    expect(result.chains).toEqual({
      'a--x': ['b--x', 'c--x'],
      'b--x': ['c--x'],
    });
  });

  it('drops entries where chain last element equals source key (round-trip)', () => {
    const step1 = applyRenameChains(
      INITIAL_RENAME_REDIRECT_STATE,
      [{ oldId: 'a--x', newId: 'b--x' }],
      []
    );
    const step2 = applyRenameChains(step1, [{ oldId: 'b--x', newId: 'a--x' }], []);
    // a--x chain becomes ['b--x', 'a--x'] — last equals source — drop.
    // b--x chain becomes ['a--x'] — last does not equal source — keep.
    expect(step2.chains).toEqual({ 'b--x': ['a--x'] });
  });
});
