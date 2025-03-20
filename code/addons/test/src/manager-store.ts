import {
  experimental_UniversalStore,
  experimental_getStatusStore,
  experimental_getTestProviderStore,
} from 'storybook/manager-api';

import {
  ADDON_ID,
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  storeOptions,
} from './constants';
import type { StoreEvent, StoreState } from './types';

export const store = experimental_UniversalStore.create<StoreState, StoreEvent>({
  ...storeOptions,
  leader: (globalThis as any).CONFIG_TYPE === 'PRODUCTION',
});

export const componentTestStatusStore = experimental_getStatusStore(STATUS_TYPE_ID_COMPONENT_TEST);
export const a11yStatusStore = experimental_getStatusStore(STATUS_TYPE_ID_A11Y);
export const testProviderStore = experimental_getTestProviderStore(ADDON_ID);
