import { createStatusStore } from '../../shared/status-store/index.ts';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../../shared/status-store/index.ts';
import type { StatusesByStoryIdAndTypeId } from '../../shared/status-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
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
  const { universalStatusStore, fullStatusStore } = getStatusStoreBundle();
  await universalStatusStore.untilReady();
  return fullStatusStore.getAll();
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
