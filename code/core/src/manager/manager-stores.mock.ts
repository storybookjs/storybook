import {
  experimental_MockUniversalStore,
  experimental_useUniversalStore,
} from 'storybook/manager-api';
import * as testUtils from 'storybook/test';

import type { ChecklistStore, StoreEvent, StoreState, TaskId } from '../shared/checklist-store';
import { UNIVERSAL_CHECKLIST_STORE_OPTIONS } from '../shared/checklist-store';
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

export const universalChecklistStore = new experimental_MockUniversalStore<StoreState, StoreEvent>(
  {
    ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
    leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
    debug: true,
  },
  testUtils
) as unknown as UniversalStore<StoreState, StoreEvent>;

export const checklistStore: ChecklistStore = {
  accept: (id: TaskId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      accepted: state.accepted.includes(id) ? state.accepted : [...state.accepted, id],
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  done: (id: TaskId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      done: state.done.includes(id) ? state.done : [...state.done, id],
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  skip: (id: TaskId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      accepted: state.accepted.filter((v) => v !== id),
      skipped: state.skipped.includes(id) ? state.skipped : [...state.skipped, id],
    }));
  },
  reset: (id: TaskId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      accepted: state.accepted.filter((v) => v !== id),
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  mute: (value: boolean | Array<TaskId>) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      muted: Array.isArray(value)
        ? Array.from(
            new Set([...(Array.isArray(state.muted) ? state.muted : []), ...(value || [])])
          )
        : value,
    }));
  },
};
