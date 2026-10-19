import { optionalEnvToBoolean } from '../../common/utils/envs.ts';
import { instances } from '../../shared/universal-store/instances.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';

export function isServerStoreLeader(): boolean {
  // Followers until UniversalStore v0.2: the vitest child process and attached tools both import
  // core-server before a follower channel exists, so they must not construct a leader.
  return (
    !optionalEnvToBoolean(process.env.VITEST_CHILD_PROCESS) &&
    !optionalEnvToBoolean(process.env.STORYBOOK_ATTACHED_TOOLS) &&
    UniversalStore.preparedEnvironment !== UniversalStore.Environment.UNKNOWN
  );
}

export function getOrRecreateStore<T>(
  id: string,
  cache: { leader?: boolean; store?: T },
  create: (leader: boolean) => T
): T {
  const leader = isServerStoreLeader();
  if (cache.store !== undefined && cache.leader === leader) {
    return cache.store;
  }
  if (cache.store !== undefined) {
    instances.delete(id);
  }
  cache.leader = leader;
  cache.store = create(leader);
  return cache.store;
}
