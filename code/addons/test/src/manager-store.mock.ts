import type {
  StatusStoreByTypeId,
  TestProviderState,
  TestProviderStoreById,
} from 'storybook/internal/types';

import { experimental_MockUniversalStore } from 'storybook/manager-api';
import * as testUtils from 'storybook/test';

import {
  ADDON_ID,
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  storeOptions,
} from './constants';

export const store = testUtils.mocked(new experimental_MockUniversalStore(storeOptions, testUtils));

export const componentTestStatusStore: StatusStoreByTypeId = {
  typeId: STATUS_TYPE_ID_COMPONENT_TEST,
  getAll: testUtils.fn(() => ({})),
  set: testUtils.fn(),
  onAllStatusChange: testUtils.fn(() => () => {}),
  onSelect: testUtils.fn(() => () => {}),
  unset: testUtils.fn(),
};

export const a11yStatusStore: StatusStoreByTypeId = {
  typeId: STATUS_TYPE_ID_A11Y,
  getAll: testUtils.fn(() => ({})),
  set: testUtils.fn(),
  onAllStatusChange: testUtils.fn(() => () => {}),
  onSelect: testUtils.fn(() => () => {}),
  unset: testUtils.fn(),
};

export const testProviderStore: TestProviderStoreById = {
  testProviderId: ADDON_ID,
  getState: testUtils.fn(() => 'test-provider-state:pending' as TestProviderState),
  setState: testUtils.fn(),
  runWithState: testUtils.fn(),
  settingsChanged: testUtils.fn(),
  onRunAll: testUtils.fn(() => () => {}),
  onClearAll: testUtils.fn(() => () => {}),
};
