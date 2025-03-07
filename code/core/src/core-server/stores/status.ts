import { createStatusStore } from '../../shared/status-store';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../../shared/status-store';
import { UniversalStore } from '../../shared/universal-store';

const statusStore = createStatusStore({
  universalStatusStore:
    process.env.VITEST !== 'true'
      ? UniversalStore.create({
          ...UNIVERSAL_STATUS_STORE_OPTIONS,
          leader: true,
        })
      : ({} as any),
});

export const { fullStatusStore, getStatusStoreByTypeId } = statusStore;
