import { describe, expect, it } from 'vitest';

import { classifyFileChange, type FileSnapshot } from './classify.ts';

const empty: FileSnapshot = { stories: {}, docs: [] };

describe('classifyFileChange', () => {
  it('returns no events when both snapshots are empty', () => {
    expect(classifyFileChange(empty, empty)).toEqual({ renames: [], orphans: [] });
  });
});
