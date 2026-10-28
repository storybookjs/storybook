import { createStatusStore } from '../../shared/status-store/index.ts';
import {
  type StatusesByStoryIdAndTypeId,
  UNIVERSAL_STATUS_STORE_OPTIONS,
} from '../../shared/status-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import {
  getUniversalStoreRealm,
  type UniversalStoreRealm,
} from '../../shared/universal-store/realm.ts';
import { getOrRecreateStore } from './server-store-leadership.ts';

type StatusStoreBundle = ReturnType<typeof createServerStatusStore>;

const CACHES = new WeakMap<UniversalStoreRealm, { leader?: boolean; store?: StatusStoreBundle }>();

function createServerStatusStore(leader: boolean) {
  return createStatusStore({
    universalStatusStore: UniversalStore.create({
      ...UNIVERSAL_STATUS_STORE_OPTIONS,
      leader,
    }),
    environment: 'server',
  });
}

function getStatusStoreBundle(): StatusStoreBundle {
  return getOrRecreateStore(UNIVERSAL_STATUS_STORE_OPTIONS.id, CACHES, createServerStatusStore);
}

export const getStatusStoreByTypeId: StatusStoreBundle['getStatusStoreByTypeId'] = (typeId) =>
  getStatusStoreBundle().getStatusStoreByTypeId(typeId);

// A follower holds its initial (empty) state until the leader answers, so wait for that sync.
export async function getSyncedStatuses(): Promise<StatusesByStoryIdAndTypeId> {
  const realm = getUniversalStoreRealm();
  const bundle = getStatusStoreBundle();
  const cache = CACHES.get(realm);
  try {
    await bundle.universalStatusStore.untilReady();
  } catch (error) {
    // A follower that timed out ignores late answers, so the next read has to sync a fresh one.
    if (cache?.store === bundle) {
      bundle.universalStatusStore.__dispose();
      realm.instances.delete(UNIVERSAL_STATUS_STORE_OPTIONS.id);
      cache.store = undefined;
    }
    throw error;
  }
  return bundle.fullStatusStore.getAll();
}

export const fullStatusStore: StatusStoreBundle['fullStatusStore'] = new Proxy(
  {} as StatusStoreBundle['fullStatusStore'],
  {
    get(_target, prop) {
      const store = getStatusStoreBundle().fullStatusStore;
      const value = Reflect.get(store, prop, store);
      return typeof value === 'function' ? value.bind(store) : value;
    },
  }
);

export const universalStatusStore: StatusStoreBundle['universalStatusStore'] = new Proxy(
  {} as StatusStoreBundle['universalStatusStore'],
  {
    get(_target, prop) {
      const store = getStatusStoreBundle().universalStatusStore;
      const value = Reflect.get(store, prop, store);
      return typeof value === 'function' ? value.bind(store) : value;
    },
  }
);
