import { createTestProviderStore } from '@storybook/core/internal/deep/shared/test-provider-store';
import { UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS } from '@storybook/core/internal/deep/shared/test-provider-store';
import { UniversalStore } from '@storybook/core/internal/deep/shared/universal-store';
import { useUniversalStore } from '@storybook/core/internal/deep/shared/universal-store/use-universal-store-manager';

const testProviderStore = createTestProviderStore({
  universalTestProviderStore: UniversalStore.create({
    ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
    // A static build has no server, so the manager owns the state.
    owner: globalThis.CONFIG_TYPE === 'PRODUCTION',
  }),
  useUniversalStore,
});

export const {
  fullTestProviderStore,
  getTestProviderStoreById,
  useTestProviderStore,
  universalTestProviderStore,
} = testProviderStore;
