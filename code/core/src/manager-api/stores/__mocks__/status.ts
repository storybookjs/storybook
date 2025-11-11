import { UNIVERSAL_STATUS_STORE_OPTIONS, createStatusStore } from '../../../shared/status-store';
import { useUniversalStore } from '../../../shared/universal-store/use-universal-store-manager';
import { experimental_MockUniversalStore } from '../../index.mock';

const mockStatusStore = createStatusStore({
  universalStatusStore: new experimental_MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
  useUniversalStore,
  environment: 'manager',
});

export const { fullStatusStore, getStatusStoreByTypeId, useStatusStore, universalStatusStore } =
  mockStatusStore;
