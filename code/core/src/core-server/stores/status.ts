import { createStatusStore } from '../../shared/status-store/index.ts';
import {
  type StatusesByStoryIdAndTypeId,
  UNIVERSAL_STATUS_STORE_OPTIONS,
} from '../../shared/status-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import { instances } from '../../shared/universal-store/instances.ts';
import { getOrRecreateStore } from './server-store-leadership.ts';

function createServerStatusStore(leader: boolean) {
  return createStatusStore({
    universalStatusStore: UniversalStore.create({
      ...UNIVERSAL_STATUS_STORE_OPTIONS,
      leader,
    }),
    environment: 'server',
  });
}

type StatusStoreBundle = ReturnType<typeof createServerStatusStore>;

const cache: { leader?: boolean; store?: StatusStoreBundle } = {};

function getStatusStoreBundle(): StatusStoreBundle {
  return getOrRecreateStore(UNIVERSAL_STATUS_STORE_OPTIONS.id, cache, createServerStatusStore);
}

export const getStatusStoreByTypeId: StatusStoreBundle['getStatusStoreByTypeId'] = (typeId) =>
  getStatusStoreBundle().getStatusStoreByTypeId(typeId);

// A follower holds its initial (empty) state until the leader answers, so wait for that sync.
export async function getSyncedStatuses(): Promise<StatusesByStoryIdAndTypeId> {
  const bundle = getStatusStoreBundle();
  try {
    await bundle.universalStatusStore.untilReady();
  } catch (error) {
    // A timed-out follower keeps returning its rejected `untilReady()` until a late answer reaches
    // it, so the next read syncs a fresh follower with its own wait. The discarded one stays
    // subscribed to the channel, as a UniversalStore cannot be unsubscribed.
    if (cache.store === bundle) {
      instances.delete(UNIVERSAL_STATUS_STORE_OPTIONS.id);
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
