import {
  experimental_MockUniversalStore,
  experimental_useUniversalStore,
} from 'storybook/manager-api';
import * as testUtils from 'storybook/test';

import {
  type StoreEvent,
  type StoreState,
  UNIVERSAL_CHECKLIST_STORE_OPTIONS,
  createChecklistStore,
} from '../shared/checklist-store';
import {
  type StatusStoreEvent,
  type StatusesByStoryIdAndTypeId,
  createStatusStore,
} from '../shared/status-store';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../shared/status-store';
import type {
  TestProviderStateByProviderId,
  TestProviderStoreEvent,
} from '../shared/test-provider-store';
import { UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS } from '../shared/test-provider-store';
import { createTestProviderStore } from '../shared/test-provider-store';
import type { UniversalStore } from '../shared/universal-store';

export const {
  fullStatusStore: internal_fullStatusStore,
  getStatusStoreByTypeId: experimental_getStatusStore,
  useStatusStore: experimental_useStatusStore,
} = createStatusStore({
  universalStatusStore: new experimental_MockUniversalStore(
    UNIVERSAL_STATUS_STORE_OPTIONS,
    testUtils
  ) as unknown as UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>,
  useUniversalStore: experimental_useUniversalStore,
  environment: 'manager',
});

export const {
  fullTestProviderStore: internal_fullTestProviderStore,
  getTestProviderStoreById: experimental_getTestProviderStore,
  useTestProviderStore: experimental_useTestProviderStore,
} = createTestProviderStore({
  universalTestProviderStore: new experimental_MockUniversalStore(
    UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
    testUtils
  ) as unknown as UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>,
  useUniversalStore: experimental_useUniversalStore,
});

export const internal_universalChecklistStore = new experimental_MockUniversalStore<
  StoreState,
  StoreEvent
>(
  {
    ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
    leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
  },
  testUtils
) as unknown as UniversalStore<StoreState, StoreEvent>;

export const internal_checklistStore = createChecklistStore(internal_universalChecklistStore);
