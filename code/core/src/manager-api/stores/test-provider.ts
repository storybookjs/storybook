import { createTestProviderStore } from '../../shared/test-provider-store/index.ts';
import { UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS } from '../../shared/test-provider-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import { useUniversalStore } from '../../shared/universal-store/use-universal-store-manager.ts';

const testProviderStore = createTestProviderStore({
  universalTestProviderStore: UniversalStore.create({
    ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
    leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
  }),
  useUniversalStore,
});

export const {
  fullTestProviderStore,
  getTestProviderStoreById,
  useTestProviderStore,
  universalTestProviderStore,
} = testProviderStore;
