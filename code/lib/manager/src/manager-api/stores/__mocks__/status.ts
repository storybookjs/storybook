import { createStatusStore } from '@storybook/core/internal/deep/shared/status-store';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '@storybook/core/internal/deep/shared/status-store';
import { useUniversalStore } from '@storybook/core/internal/deep/shared/universal-store/use-universal-store-manager';
import { experimental_MockUniversalStore } from '../../index.mock.ts';

const mockStatusStore = createStatusStore({
  universalStatusStore: new experimental_MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
  useUniversalStore,
  environment: 'manager',
});

export const { fullStatusStore, getStatusStoreByTypeId, useStatusStore, universalStatusStore } =
  mockStatusStore;
