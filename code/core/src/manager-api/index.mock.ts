import { fn } from 'storybook/test';

export * from './root';
export { Tag } from '../shared/constants/tags';

export const openInEditor = fn();

export { UniversalStore as experimental_UniversalStore } from '../shared/universal-store';
export { useUniversalStore as experimental_useUniversalStore } from '../shared/universal-store/use-universal-store-manager';
export { MockUniversalStore as experimental_MockUniversalStore } from '../shared/universal-store/mock';

export {
  getStatusStoreByTypeId as experimental_getStatusStore,
  useStatusStore as experimental_useStatusStore,
  fullStatusStore as internal_fullStatusStore,
  universalStatusStore as internal_universalStatusStore,
} from './stores/__mocks__/status';
export {
  getTestProviderStoreById as experimental_getTestProviderStore,
  useTestProviderStore as experimental_useTestProviderStore,
  fullTestProviderStore as internal_fullTestProviderStore,
  universalTestProviderStore as internal_universalTestProviderStore,
} from './stores/__mocks__/test-provider';
