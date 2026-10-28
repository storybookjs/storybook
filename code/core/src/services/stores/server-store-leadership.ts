import { optionalEnvToBoolean } from '../../common/utils/envs.ts';
import { getInstanceContext } from '../../shared/instance-context.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import {
  getUniversalStoreRealm,
  type UniversalStoreRealm,
} from '../../shared/universal-store/realm.ts';

export function isServerStoreLeader(): boolean {
  return (
    !optionalEnvToBoolean(process.env.VITEST_CHILD_PROCESS) &&
    !getInstanceContext()?.storybook?.attached &&
    UniversalStore.preparedEnvironment !== UniversalStore.Environment.UNKNOWN
  );
}

export function getOrRecreateStore<T>(
  id: string,
  caches: WeakMap<UniversalStoreRealm, { leader?: boolean; store?: T }>,
  create: (leader: boolean) => T
): T {
  const realm = getUniversalStoreRealm();
  let cache = caches.get(realm);
  if (!cache) {
    cache = {};
    caches.set(realm, cache);
  }
  const leader = isServerStoreLeader();
  if (cache.store !== undefined && cache.leader === leader) {
    return cache.store;
  }
  if (cache.store !== undefined) {
    realm.instances.delete(id);
  }
  cache.leader = leader;
  cache.store = create(leader);
  return cache.store;
}
