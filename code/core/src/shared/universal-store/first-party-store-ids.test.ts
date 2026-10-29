import { describe, expect, it } from 'vitest';

import { Channel } from '../../channels/main.ts';
import { UniversalStore } from './index.ts';

describe('UniversalStore.create', () => {
  it('rejects store ids that are not first-party', () => {
    expect(() =>
      UniversalStore.create({ id: 'my-addon/store', owner: true, channel: new Channel({}) })
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: UniversalStore is internal to Storybook and cannot create a store with id "my-addon/store"]`
    );
  });

  it('creates stores with first-party ids', () => {
    expect(
      UniversalStore.create({ id: 'storybook/test', owner: true, channel: new Channel({}) })
    ).toBeInstanceOf(UniversalStore);
  });
});
