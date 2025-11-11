import {
  UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
  createTestProviderStore,
} from '../../shared/test-provider-store';
import { UniversalStore } from '../../shared/universal-store';
import { useUniversalStore } from '../../shared/universal-store/use-universal-store-manager';

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
