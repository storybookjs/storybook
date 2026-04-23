import { describe, expect, it } from 'vitest';

import {
  INITIAL_RENAME_REDIRECT_STATE,
  type RenameRedirectState,
  extendRenameMaps,
} from './index.ts';

describe('extendRenameMaps', () => {
  it('records a single rename as a new chain entry', () => {
    const result = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
      renames: [
        { oldId: 'button--primary', newId: 'button--secondary', origin: './src/Foo.stories.ts' },
      ],
      orphans: [],
      deletions: [],
    });
    expect(result.chains).toEqual({ 'button--primary': ['button--secondary'] });
  });

  it('extends existing chains when rename destination matches previous last element', () => {
    const initial: RenameRedirectState = { chains: { 'a--x': ['b--x'] }, origins: {} };
    const result = extendRenameMaps(initial, {
      renames: [{ oldId: 'b--x', newId: 'c--x', origin: './src/Foo.stories.ts' }],
      orphans: [],
      deletions: [],
    });
    expect(result.chains).toEqual({
      'a--x': ['b--x', 'c--x'],
      'b--x': ['c--x'],
    });
  });

  it('drops entries where chain last element equals source key (round-trip)', () => {
    const step1 = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
      renames: [{ oldId: 'a--x', newId: 'b--x', origin: './src/Foo.stories.ts' }],
      orphans: [],
      deletions: [],
    });
    const step2 = extendRenameMaps(step1, {
      renames: [{ oldId: 'b--x', newId: 'a--x', origin: './src/Foo.stories.ts' }],
      orphans: [],
      deletions: [],
    });
    // a--x chain becomes ['b--x', 'a--x'] — last equals source — drop.
    // b--x chain becomes ['a--x'] — last does not equal source — keep.
    expect(step2.chains).toEqual({ 'b--x': ['a--x'] });
  });

  it('records a deletion with a null-terminated chain', () => {
    const result = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
      renames: [],
      orphans: [],
      deletions: [{ id: 'gone--story', origin: './src/Gone.stories.ts' }],
    });
    expect(result.chains).toEqual({ 'gone--story': [null] });
  });

  it('appends null to the end of existing chain when rename-then-delete occurs', () => {
    const renamed = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
      renames: [{ oldId: 'a--x', newId: 'b--x', origin: './src/Foo.stories.ts' }],
      orphans: [],
      deletions: [],
    });
    const deleted = extendRenameMaps(renamed, {
      renames: [],
      orphans: [],
      deletions: [{ id: 'b--x', origin: './src/Foo.stories.ts' }],
    });
    expect(deleted.chains).toEqual({
      'a--x': ['b--x', null],
      'b--x': [null],
    });
  });

  it('handles multiple independent renames in one call (folder rename)', () => {
    const result = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
      renames: [
        { oldId: 'old--a', newId: 'new--a', origin: './src/Foo.stories.ts' },
        { oldId: 'old--b', newId: 'new--b', origin: './src/Bar.stories.ts' },
      ],
      orphans: [],
      deletions: [],
    });
    expect(result.chains).toEqual({
      'old--a': ['new--a'],
      'old--b': ['new--b'],
    });
  });

  it('writes origin for a rename event', () => {
    const result = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
      renames: [{ oldId: 'a--x', newId: 'b--x', origin: './src/A.stories.ts' }],
      orphans: [],
      deletions: [],
    });
    expect(result.origins).toEqual({ 'a--x': './src/A.stories.ts' });
  });

  it('writes origin for an orphan without touching chains', () => {
    const result = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
      renames: [],
      orphans: [{ id: 'orphan--x', origin: './src/Orphan.stories.ts' }],
      deletions: [],
    });
    expect(result.origins).toEqual({ 'orphan--x': './src/Orphan.stories.ts' });
    expect(result.chains).toEqual({});
  });

  it('writes origin for a deletion alongside the null chain', () => {
    const result = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
      renames: [],
      orphans: [],
      deletions: [{ id: 'gone--story', origin: './src/Gone.stories.ts' }],
    });
    expect(result.origins).toEqual({ 'gone--story': './src/Gone.stories.ts' });
    expect(result.chains).toEqual({ 'gone--story': [null] });
  });
});
