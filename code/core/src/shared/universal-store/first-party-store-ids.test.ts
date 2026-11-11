import { describe, expect, it } from 'vitest';

import { UniversalStore } from './index.ts';

describe('UniversalStore.create', () => {
  it('rejects store ids that are not first-party', () => {
    expect(() =>
      UniversalStore.create({ id: 'my-addon/store', leader: true })
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: UniversalStore is internal to Storybook and cannot create a store with id "my-addon/store"]`
    );
  });

  it('creates stores with first-party ids', () => {
    expect(UniversalStore.create({ id: 'storybook/test', leader: true })).toBeInstanceOf(
      UniversalStore
    );
  });
});
