import { createStatusStore } from '../../../shared/status-store/index.ts';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../../../shared/status-store/index.ts';
import { useUniversalStore } from '../../../shared/universal-store/use-universal-store-manager.ts';
import { experimental_MockUniversalStore } from '../../index.mock.ts';

const mockStatusStore = createStatusStore({
  universalStatusStore: new experimental_MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
  useUniversalStore,
  environment: 'manager',
});

export const { fullStatusStore, getStatusStoreByTypeId, useStatusStore, universalStatusStore } =
  mockStatusStore;
