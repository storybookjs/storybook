import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Channel } from '../../channels/main.ts';
import { createStorybook } from '../../instance/create-storybook.ts';
import { runWithStorybook } from '../../instance/instance-context.ts';
import type { Storybook } from '../../instance/types.ts';
import { getInstanceContext } from '../../shared/instance-context.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import * as statuses from './status.ts';
import type { Status } from '../../shared/status-store/index.ts';

const modified: Status = {
  storyId: 'button--primary',
  typeId: 'storybook/change-detection',
  value: 'status-value:modified',
  title: 'Modified',
  description: '',
};
const modifiedStatuses = { [modified.storyId]: { [modified.typeId]: modified } };

const INSTANCES: Storybook[] = [];

async function loadRealm(channel: Channel, { attached }: { attached: boolean }) {
  const storybook = await createStorybook(
    {
      configDir: fileURLToPath(new URL('../../instance/__fixtures__/first', import.meta.url)),
      main: { stories: [] },
      mode: 'headless',
      ...(attached ? { attach: { transport: { send() {}, setHandler() {} } } } : {}),
    },
    { builtInAddons: [] }
  );
  INSTANCES.push(storybook);
  return runWithStorybook(storybook, () => {
    const context = getInstanceContext()!;
    context.channel = channel;
    UniversalStore.__prepare(
      channel,
      attached ? UniversalStore.Environment.UNKNOWN : UniversalStore.Environment.SERVER
    );
    return {
      context,
      getStatusStoreByTypeId: (id: string) =>
        runWithStorybook(storybook, () => statuses.getStatusStoreByTypeId(id)),
      getSyncedStatuses: () => runWithStorybook(storybook, statuses.getSyncedStatuses),
    };
  });
}

describe('getSyncedStatuses', () => {
  afterEach(async () => {
    await Promise.all(INSTANCES.splice(0).map((storybook) => storybook.close()));
    vi.useRealTimers();
  });

  it('returns the leader state to a follower whose leader answers asynchronously', async () => {
    const channel = new Channel({ async: true });
    const devServer = await loadRealm(channel, { attached: false });
    devServer.getStatusStoreByTypeId(modified.typeId).set([modified]);
    const attachedTools = await loadRealm(channel, { attached: true });

    await expect(attachedTools.getSyncedStatuses()).resolves.toEqual(modifiedStatuses);
  });

  it('rejects instead of returning an empty state when no leader answers', async () => {
    vi.useFakeTimers();
    const attachedTools = await loadRealm(new Channel({}), { attached: true });
    const { UniversalStoreFollowerTimeoutError } = await import('../../manager-errors.ts');

    const rejection = expect(attachedTools.getSyncedStatuses()).rejects.toBeInstanceOf(
      UniversalStoreFollowerTimeoutError
    );
    await vi.advanceTimersByTimeAsync(1000);

    await rejection;
  });

  it('syncs again on the next read after a timeout', async () => {
    vi.useFakeTimers();
    const channel = new Channel({ async: true });
    const attachedTools = await loadRealm(channel, { attached: true });
    const timedOut = expect(attachedTools.getSyncedStatuses()).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    await timedOut;
    vi.useRealTimers();
    const devServer = await loadRealm(channel, { attached: false });
    devServer.getStatusStoreByTypeId(modified.typeId).set([modified]);

    await expect(attachedTools.getSyncedStatuses()).resolves.toEqual(modifiedStatuses);
  });

  it('recreates a timed-out follower only in its owning instance realm', async () => {
    vi.useFakeTimers();
    const followerRealm = await loadRealm(new Channel({}), { attached: true });
    const leaderRealm = await loadRealm(new Channel({}), { attached: false });
    const { instanceContext } = await import('../../instance/instance-context.ts');
    const follower = followerRealm.context;
    const leader = leaderRealm.context;
    const stopListening = vi.spyOn(follower.channel!, 'off');
    try {
      instanceContext.run(follower, () => statuses.getStatusStoreByTypeId(modified.typeId));
      const timedOutStore = follower.universalStoreRealm.instances.get('storybook/status');
      const rejection = expect(
        instanceContext.run(follower, statuses.getSyncedStatuses)
      ).rejects.toThrow();
      const leaderStore = instanceContext.run(leader, () =>
        statuses.getStatusStoreByTypeId(modified.typeId)
      );
      const leaderUniversalStore = leader.universalStoreRealm.instances.get('storybook/status');
      leaderStore.set([modified]);
      await vi.advanceTimersByTimeAsync(1000);
      await rejection;
      expect(stopListening).toHaveBeenCalledWith(
        'UNIVERSAL_STORE:storybook/status',
        expect.any(Function)
      );

      instanceContext.run(follower, () => statuses.getStatusStoreByTypeId(modified.typeId));
      expect(follower.universalStoreRealm.instances.get('storybook/status')).not.toBe(
        timedOutStore
      );
      instanceContext.run(leader, () => statuses.getStatusStoreByTypeId(modified.typeId));
      expect(leader.universalStoreRealm.instances.get('storybook/status')).toBe(
        leaderUniversalStore
      );
      await expect(instanceContext.run(leader, statuses.getSyncedStatuses)).resolves.toEqual(
        modifiedStatuses
      );
    } finally {
      for (const context of [follower, leader]) {
        for (const store of context.universalStoreRealm.instances.values()) {
          store.__dispose();
        }
      }
    }
  });

  it('returns the statuses of a leader', async () => {
    const devServer = await loadRealm(new Channel({}), { attached: false });
    devServer.getStatusStoreByTypeId(modified.typeId).set([modified]);

    await expect(devServer.getSyncedStatuses()).resolves.toEqual(modifiedStatuses);
  });
});
