import { createStatusStore } from '../../shared/status-store/index.ts';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../../shared/status-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import { useUniversalStore } from '../../shared/universal-store/use-universal-store-manager.ts';

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
