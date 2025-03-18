import { createStatusStore } from '../../shared/status-store';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../../shared/status-store';
import { UniversalStore } from '../../shared/universal-store';

const statusStore = createStatusStore({
  universalStatusStore: UniversalStore.create({
    ...UNIVERSAL_STATUS_STORE_OPTIONS,
    /*
      This is a temporary workaround, to ensure that the store is not created in the
      vitest sub-process in addon-test, even though it imports from core-server
      If it was created in the sub-process, it would try to connect to the leader in the dev server
      before it was ready.
      This will be fixed when we do the planned UniversalStore v0.2.
    */
    leader: process.env.VITEST !== 'true',
  }),
  environment: 'server',
});

export const { fullStatusStore, getStatusStoreByTypeId } = statusStore;
