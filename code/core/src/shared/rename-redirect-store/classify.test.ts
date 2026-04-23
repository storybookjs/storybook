import { describe, expect, it } from 'vitest';

import { classifyFileChange, type FileSnapshot } from './classify.ts';

const empty: FileSnapshot = { stories: {}, docs: [] };

describe('classifyFileChange', () => {
  it('returns no events when both snapshots are empty', () => {
    expect(classifyFileChange(empty, empty)).toEqual({ renames: [], orphans: [] });
  });

  it('returns no events when shared exports keep the same IDs', () => {
    const snapshot: FileSnapshot = {
      stories: { Primary: { id: 'button--primary' } },
      docs: [],
    };
    expect(classifyFileChange(snapshot, snapshot)).toEqual({ renames: [], orphans: [] });
  });

  it('emits renames for shared exports whose IDs changed (title rename)', () => {
    const old: FileSnapshot = {
      stories: {
        Primary: { id: 'old--primary' },
        Secondary: { id: 'old--secondary' },
      },
      docs: [],
    };
    const next: FileSnapshot = {
      stories: {
        Primary: { id: 'new--primary' },
        Secondary: { id: 'new--secondary' },
      },
      docs: [],
    };
    expect(classifyFileChange(old, next)).toEqual({
      renames: [
        { oldId: 'old--primary', newId: 'new--primary' },
        { oldId: 'old--secondary', newId: 'new--secondary' },
      ],
      orphans: [],
    });
  });

  it('emits an orphan for each removed export', () => {
    const old: FileSnapshot = {
      stories: {
        Primary: { id: 'button--primary' },
        Secondary: { id: 'button--secondary' },
      },
      docs: [],
    };
    const next: FileSnapshot = {
      stories: { Secondary: { id: 'button--secondary' } },
      docs: [],
    };
    expect(classifyFileChange(old, next)).toEqual({
      renames: [],
      orphans: ['button--primary'],
    });
  });
});
