import { type CoreStores, forwardToInstance, getCoreStores } from './core-stores.ts';

type TestProviderStoreBundle = CoreStores['testProvider'];

export const getTestProviderStoreById: TestProviderStoreBundle['getTestProviderStoreById'] = (id) =>
  getCoreStores().testProvider.getTestProviderStoreById(id);

export const fullTestProviderStore: TestProviderStoreBundle['fullTestProviderStore'] =
  forwardToInstance(() => getCoreStores().testProvider.fullTestProviderStore);

export const universalTestProviderStore: TestProviderStoreBundle['universalTestProviderStore'] =
  forwardToInstance(() => getCoreStores().testProvider.universalTestProviderStore);
