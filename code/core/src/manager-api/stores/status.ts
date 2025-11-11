import { UNIVERSAL_STATUS_STORE_OPTIONS, createStatusStore } from '../../shared/status-store';
import { UniversalStore } from '../../shared/universal-store';
import { useUniversalStore } from '../../shared/universal-store/use-universal-store-manager';

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
