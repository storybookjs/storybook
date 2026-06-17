import { fn } from 'storybook/test';

export * from './root.tsx';
export { Tag } from '../shared/constants/tags.ts';

export {
  enterReviewMode,
  exitReviewMode,
  isReviewModeActive,
  type ReviewModeFilters,
} from '../manager/components/sidebar/review-mode.ts';

export const openInEditor = fn();

export { UniversalStore as experimental_UniversalStore } from '../shared/universal-store/index.ts';
export { useUniversalStore as experimental_useUniversalStore } from '../shared/universal-store/use-universal-store-manager.ts';
export { MockUniversalStore as experimental_MockUniversalStore } from '../shared/universal-store/mock.ts';

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
  registerService,
  useServiceCommand,
  useServiceQuery,
} from '../shared/open-service/manager.ts';
