import { optionalEnvToBoolean } from '../../common/utils/envs';
import { createTestProviderStore } from '../../shared/test-provider-store';
import { UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS } from '../../shared/test-provider-store';
import { UniversalStore } from '../../shared/universal-store';

const testProviderStore = createTestProviderStore({
  universalTestProviderStore: UniversalStore.create({
    ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
    /*
            This is a temporary workaround, to ensure that the store is not created in the
            vitest sub-process in addon-vitest, even though it imports from core-server
            If it was created in the sub-process, it would try to connect to the leader in the dev server
            before it was ready.
            This will be fixed when we do the planned UniversalStore v0.2.
          */
    leader: !optionalEnvToBoolean(process.env.VITEST_CHILD_PROCESS),
  }),
});

export const { fullTestProviderStore, getTestProviderStoreById, universalTestProviderStore } =
  testProviderStore;
