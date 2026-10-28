import { getInstanceContext } from '../instance-context.ts';
import { instances } from './instances.ts';
import type { ChannelLike, EnvironmentType } from './types.ts';

export interface UniversalStoreRealm {
  channel?: ChannelLike;
  environment?: EnvironmentType;
  preparation: {
    promise: Promise<{ channel: ChannelLike; environment: EnvironmentType }>;
    resolve: (value: { channel: ChannelLike; environment: EnvironmentType }) => void;
    reject: (error: Error) => void;
  };
  instances: typeof instances;
}

const DEFAULT_REALM: UniversalStoreRealm = { ...createUniversalStoreRealm(), instances };

export function createUniversalStoreRealm(prepared?: {
  channel: ChannelLike;
  environment: EnvironmentType;
}): UniversalStoreRealm {
  let resolve!: UniversalStoreRealm['preparation']['resolve'];
  let reject!: UniversalStoreRealm['preparation']['reject'];
  const promise = new Promise<{ channel: ChannelLike; environment: EnvironmentType }>(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    }
  );
  if (prepared) {
    resolve(prepared);
  }
  return { ...prepared, preparation: { promise, resolve, reject }, instances: new Map() };
}

export function getUniversalStoreRealm(): UniversalStoreRealm {
  return getInstanceContext()?.universalStoreRealm ?? DEFAULT_REALM;
}
