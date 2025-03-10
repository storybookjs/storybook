import { experimental_MockUniversalStore } from 'storybook/internal/manager-api';

import * as testUtils from 'storybook/test';

import { storeOptions } from './constants';

export const store = testUtils.mocked(new experimental_MockUniversalStore(storeOptions, testUtils));

export const componentTestStatusStore = {
  get: testUtils.fn(() => ({})),
  set: testUtils.fn(),
  onStatusChange: testUtils.fn(() => () => {}),
  onSelect: testUtils.fn(() => () => {}),
  unset: testUtils.fn(),
};
export const a11yStatusStore = {
  get: testUtils.fn(() => ({})),
  set: testUtils.fn(),
  onStatusChange: testUtils.fn(() => () => {}),
  onSelect: testUtils.fn(() => () => {}),
  unset: testUtils.fn(),
};
