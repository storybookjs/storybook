import { createTestProviderStore } from '../../shared/test-provider-store/index.ts';
import { UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS } from '../../shared/test-provider-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import { getOrRecreateStore } from './server-store-leadership.ts';

function createServerTestProviderStore(leader: boolean) {
  return createTestProviderStore({
    universalTestProviderStore: UniversalStore.create({
      ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
      leader,
    }),
  });
}

type TestProviderStoreBundle = ReturnType<typeof createServerTestProviderStore>;

const cache: { leader?: boolean; store?: TestProviderStoreBundle } = {};

function getTestProviderStoreBundle(): TestProviderStoreBundle {
  return getOrRecreateStore(
    UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS.id,
    cache,
    createServerTestProviderStore
  );
}

export const getTestProviderStoreById: TestProviderStoreBundle['getTestProviderStoreById'] = (id) =>
  getTestProviderStoreBundle().getTestProviderStoreById(id);

export const fullTestProviderStore: TestProviderStoreBundle['fullTestProviderStore'] = new Proxy(
  {} as TestProviderStoreBundle['fullTestProviderStore'],
  {
    get(_target, prop) {
      const store = getTestProviderStoreBundle().fullTestProviderStore;
      const value = Reflect.get(store, prop, store);
      return typeof value === 'function' ? value.bind(store) : value;
    },
  }
);

export const universalTestProviderStore: TestProviderStoreBundle['universalTestProviderStore'] =
  new Proxy({} as TestProviderStoreBundle['universalTestProviderStore'], {
    get(_target, prop) {
      const store = getTestProviderStoreBundle().universalTestProviderStore;
      const value = Reflect.get(store, prop, store);
      return typeof value === 'function' ? value.bind(store) : value;
    },
  });
