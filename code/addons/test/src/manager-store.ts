import { experimental_UniversalStore } from 'storybook/internal/manager-api';

import { type StoreState, storeOptions } from './constants';

export const store = experimental_UniversalStore.create<StoreState>({
  ...storeOptions,
  leader: (globalThis as any).CONFIG_TYPE === 'PRODUCTION',
});
