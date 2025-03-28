import { createTestProviderStore } from '../../shared/test-provider-store';
import { UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS } from '../../shared/test-provider-store';
import { UniversalStore } from '../../shared/universal-store';

const testProviderStore = createTestProviderStore({
  universalTestProviderStore: UniversalStore.create({
    ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
    /*
            This is a temporary workaround, to ensure that the store is not created in the
            vitest sub-process in addon-test, even though it imports from core-server
            If it was created in the sub-process, it would try to connect to the leader in the dev server
            before it was ready.
            This will be fixed when we do the planned UniversalStore v0.2.
          */
    leader: process.env.VITEST_CHILD_PROCESS !== 'true',
  }),
});

export const { fullTestProviderStore, getTestProviderStoreById, universalTestProviderStore } =
  testProviderStore;
