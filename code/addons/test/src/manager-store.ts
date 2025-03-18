import { experimental_UniversalStore, experimental_getStatusStore } from 'storybook/manager-api';

import {
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  type StoreState,
  storeOptions,
} from './constants';

export const store = experimental_UniversalStore.create<StoreState>({
  ...storeOptions,
  leader: (globalThis as any).CONFIG_TYPE === 'PRODUCTION',
});

export const componentTestStatusStore = experimental_getStatusStore(STATUS_TYPE_ID_COMPONENT_TEST);
export const a11yStatusStore = experimental_getStatusStore(STATUS_TYPE_ID_A11Y);
