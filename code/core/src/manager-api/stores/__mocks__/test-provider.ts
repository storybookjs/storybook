import {
  UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
  createTestProviderStore,
} from '../../../shared/test-provider-store';
import { useUniversalStore } from '../../../shared/universal-store/use-universal-store-manager';
import { experimental_MockUniversalStore } from '../../index.mock';

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
