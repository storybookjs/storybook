import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Status, StatusesByStoryIdAndTypeId } from '../../shared/status-store/index.ts';

const STATUS_CHANNEL_EVENT = 'UNIVERSAL_STORE:storybook/status';

const modified: Status = {
  storyId: 'button--primary',
  typeId: 'storybook/change-detection',
  value: 'status-value:modified',
  title: 'Modified',
  description: '',
};
const leaderState: StatusesByStoryIdAndTypeId = {
  [modified.storyId]: { [modified.typeId]: modified },
};

async function prepareRealm({ attached }: { attached: boolean }) {
  vi.stubEnv('STORYBOOK_ATTACHED_TOOLS', attached ? 'true' : '');
  const { UniversalStore } = await import('../../shared/universal-store/index.ts');
  const { Channel } = await import('../../channels/main.ts');
  const channel = new Channel({});
  UniversalStore.__prepare(
    channel,
    attached ? UniversalStore.Environment.UNKNOWN : UniversalStore.Environment.SERVER
  );
  return { UniversalStore, channel };
}

describe('getSyncedStatuses', () => {
  beforeEach(() => {
    // The status store and the UniversalStore preparation are module singletons.
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('returns the leader state to a follower that reads before the leader has answered', async () => {
    const { UniversalStore, channel } = await prepareRealm({ attached: true });
    channel.on(STATUS_CHANNEL_EVENT, ({ event }: { event: { type: string } }) => {
      if (event.type !== UniversalStore.InternalEventType.EXISTING_STATE_REQUEST) {
        return;
      }
      setTimeout(() => {
        channel.emit(STATUS_CHANNEL_EVENT, {
          event: {
            type: UniversalStore.InternalEventType.EXISTING_STATE_RESPONSE,
            payload: leaderState,
          },
          eventInfo: {
            actor: {
              id: 'dev-server',
              type: UniversalStore.ActorType.LEADER,
              environment: UniversalStore.Environment.SERVER,
            },
          },
        });
      }, 0);
    });
    const { fullStatusStore, getSyncedStatuses } = await import('./status.ts');

    const synced = getSyncedStatuses();

    expect(fullStatusStore.getAll()).toEqual({});
    await expect(synced).resolves.toEqual(leaderState);
  });

  it('rejects instead of returning an empty state when no leader answers', async () => {
    vi.useFakeTimers();
    await prepareRealm({ attached: true });
    const { UniversalStoreFollowerTimeoutError } = await import('../../manager-errors.ts');
    const { getSyncedStatuses } = await import('./status.ts');

    const rejection = expect(getSyncedStatuses()).rejects.toBeInstanceOf(
      UniversalStoreFollowerTimeoutError
    );
    await vi.advanceTimersByTimeAsync(1000);

    await rejection;
  });

  it('returns the statuses of a leader without waiting on anyone', async () => {
    await prepareRealm({ attached: false });
    const { getStatusStoreByTypeId, getSyncedStatuses } = await import('./status.ts');
    getStatusStoreByTypeId(modified.typeId).set([modified]);

    await expect(getSyncedStatuses()).resolves.toEqual(leaderState);
  });
});
