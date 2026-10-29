import type { StatusesByStoryIdAndTypeId } from '../../shared/status-store/index.ts';
import { type CoreStores, forwardToInstance, getCoreStores } from './core-stores.ts';

type StatusStoreBundle = CoreStores['status'];

export const getStatusStoreByTypeId: StatusStoreBundle['getStatusStoreByTypeId'] = (typeId) =>
  getCoreStores().status.getStatusStoreByTypeId(typeId);

/** All statuses, once a client has the owner's state; rejects when the owner does not answer. */
export async function getSyncedStatuses(): Promise<StatusesByStoryIdAndTypeId> {
  const { status } = getCoreStores();
  await status.universalStatusStore.untilReady();
  return status.fullStatusStore.getAll();
}

export const fullStatusStore: StatusStoreBundle['fullStatusStore'] = forwardToInstance(
  () => getCoreStores().status.fullStatusStore
);

export const universalStatusStore: StatusStoreBundle['universalStatusStore'] = forwardToInstance(
  () => getCoreStores().status.universalStatusStore
);
