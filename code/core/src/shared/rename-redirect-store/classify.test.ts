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
});
