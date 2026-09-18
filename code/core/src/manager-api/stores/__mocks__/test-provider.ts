import { createTestProviderStore } from '../../../shared/test-provider-store/index.ts';
import { UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS } from '../../../shared/test-provider-store/index.ts';
import { useUniversalStore } from '../../../shared/universal-store/use-universal-store-manager.ts';
import { experimental_MockUniversalStore } from '../../index.mock.ts';

const mockTestProviderStore = createTestProviderStore({
  universalTestProviderStore: new experimental_MockUniversalStore(
    UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS
  ),
  useUniversalStore,
});

export const {
  fullTestProviderStore,
  getTestProviderStoreById,
  useTestProviderStore,
  universalTestProviderStore,
} = mockTestProviderStore;
