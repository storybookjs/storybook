import { createStatusStore } from '@storybook/core/internal/deep/shared/status-store';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '@storybook/core/internal/deep/shared/status-store';
import { UniversalStore } from '@storybook/core/internal/deep/shared/universal-store';
import { useUniversalStore } from '@storybook/core/internal/deep/shared/universal-store/use-universal-store-manager';

const statusStore = createStatusStore({
  universalStatusStore: UniversalStore.create({
    ...UNIVERSAL_STATUS_STORE_OPTIONS,
    leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
  }),
  useUniversalStore,
  environment: 'manager',
});

export const { fullStatusStore, getStatusStoreByTypeId, useStatusStore, universalStatusStore } =
  statusStore;
