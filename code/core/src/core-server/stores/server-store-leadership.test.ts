import { afterEach, describe, expect, it, vi } from 'vitest';

import { UniversalStore } from '../../shared/universal-store/index.ts';
import { universalStatusStore } from './status.ts';
import { universalTestProviderStore } from './test-provider.ts';

describe('server store leadership', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    void universalStatusStore.actor;
    void universalTestProviderStore.actor;
  });

  it('switches from follower to leader when STORYBOOK_ATTACHED_TOOLS is cleared', () => {
    vi.stubEnv('STORYBOOK_ATTACHED_TOOLS', 'true');
    expect(universalStatusStore.actor.type).toBe(UniversalStore.ActorType.FOLLOWER);
    expect(universalTestProviderStore.actor.type).toBe(UniversalStore.ActorType.FOLLOWER);

    vi.stubEnv('STORYBOOK_ATTACHED_TOOLS', '');
    expect(universalStatusStore.actor.type).toBe(UniversalStore.ActorType.LEADER);
    expect(universalTestProviderStore.actor.type).toBe(UniversalStore.ActorType.LEADER);
  });

  it('switches from leader to follower when STORYBOOK_ATTACHED_TOOLS is set', () => {
    vi.stubEnv('STORYBOOK_ATTACHED_TOOLS', '');
    expect(universalStatusStore.actor.type).toBe(UniversalStore.ActorType.LEADER);
    expect(universalTestProviderStore.actor.type).toBe(UniversalStore.ActorType.LEADER);

    vi.stubEnv('STORYBOOK_ATTACHED_TOOLS', 'true');
    expect(universalStatusStore.actor.type).toBe(UniversalStore.ActorType.FOLLOWER);
    expect(universalTestProviderStore.actor.type).toBe(UniversalStore.ActorType.FOLLOWER);
  });
});
