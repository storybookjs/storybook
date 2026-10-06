import { afterEach, describe, expect, it, vi } from 'vitest';

import { Channel } from '../../channels/main.ts';
import type { Status } from '../../shared/status-store/index.ts';

const modified: Status = {
  storyId: 'button--primary',
  typeId: 'storybook/change-detection',
  value: 'status-value:modified',
  title: 'Modified',
  description: '',
};
const modifiedStatuses = { [modified.storyId]: { [modified.typeId]: modified } };

// The status store and the UniversalStore preparation are module singletons, so each call loads a
// fresh realm; two realms sharing a channel stand in for the dev server and the attached CLI.
async function loadRealm(channel: Channel, { attached }: { attached: boolean }) {
  vi.resetModules();
  vi.stubEnv('STORYBOOK_ATTACHED_TOOLS', attached ? 'true' : '');
  const { UniversalStore } = await import('../../shared/universal-store/index.ts');
  UniversalStore.__prepare(
    channel,
    attached ? UniversalStore.Environment.UNKNOWN : UniversalStore.Environment.SERVER
  );
  return import('./status.ts');
}

describe('getSyncedStatuses', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('returns the statuses of a leader', async () => {
    const devServer = await loadRealm(new Channel({}), { attached: false });
    devServer.getStatusStoreByTypeId(modified.typeId).set([modified]);

    await expect(devServer.getSyncedStatuses()).resolves.toEqual(modifiedStatuses);
  });
});
