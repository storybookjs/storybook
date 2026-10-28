import { createTestProviderStore } from '@storybook/core/internal/deep/shared/test-provider-store';
import { UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS } from '@storybook/core/internal/deep/shared/test-provider-store';
import { useUniversalStore } from '@storybook/core/internal/deep/shared/universal-store/use-universal-store-manager';
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
