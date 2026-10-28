import { fn } from '@storybook/core/test';

export * from './root.tsx';
export * from '@storybook/ui/internal/deep/components/components/utils/platform';
export * from '@storybook/ui/internal/deep/components/components/utils/shortcut';
export { Tag } from '@storybook/core/preview-api';
export { getFeatures } from '@storybook/core/preview-api';

export const openInEditor = fn();

export { UniversalStore as internal_UniversalStore } from '@storybook/core/internal/deep/shared/universal-store';
export { useUniversalStore as internal_useUniversalStore } from '@storybook/core/internal/deep/shared/universal-store/use-universal-store-manager';
export { MockUniversalStore as experimental_MockUniversalStore } from '@storybook/core/internal/deep/shared/universal-store/mock';

export {
  getStatusStoreByTypeId as experimental_getStatusStore,
  useStatusStore as experimental_useStatusStore,
  fullStatusStore as internal_fullStatusStore,
  universalStatusStore as internal_universalStatusStore,
} from './stores/__mocks__/status.ts';
export {
  getTestProviderStoreById as experimental_getTestProviderStore,
  useTestProviderStore as experimental_useTestProviderStore,
  fullTestProviderStore as internal_fullTestProviderStore,
  universalTestProviderStore as internal_universalTestProviderStore,
} from './stores/__mocks__/test-provider.ts';

/** Real open-service surface — not mocked; used by the internal sync-test demo. */
export {
  getService,
  registerService,
  useServiceCommand,
  useServiceQuery,
} from '@storybook/core/internal/deep/shared/open-service/manager';
