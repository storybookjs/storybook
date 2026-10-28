import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStorybook } from '../../instance/create-storybook.ts';
import { runWithStorybook } from '../../instance/instance-context.ts';
import type { Storybook } from '../../instance/types.ts';
import { getInstanceContext } from '../../shared/instance-context.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import { universalStatusStore } from './status.ts';
import { universalTestProviderStore } from './test-provider.ts';

const INSTANCES: Storybook[] = [];

afterEach(async () => {
  await Promise.all(INSTANCES.splice(0).map((storybook) => storybook.close()));
  vi.unstubAllEnvs();
});

describe('server store leadership', () => {
  it.each([false, true])(
    'keeps attached=%s isolated from another instance',
    async (attachedFirst) => {
      const instances = await Promise.all(
        [attachedFirst, !attachedFirst].map(async (attached) => {
          const storybook = await createStorybook(
            {
              configDir: fileURLToPath(
                new URL('../../instance/__fixtures__/first', import.meta.url)
              ),
              main: { stories: [] },
              mode: 'headless',
              ...(attached ? { attach: { transport: { send() {}, setHandler() {} } } } : {}),
            },
            { builtInAddons: [] }
          );
          INSTANCES.push(storybook);
          return storybook;
        })
      );
      for (const storybook of [...instances, ...instances.toReversed()]) {
        runWithStorybook(storybook, () => {
          const actor = storybook.attached
            ? UniversalStore.ActorType.FOLLOWER
            : UniversalStore.ActorType.LEADER;
          expect(universalStatusStore.actor.type).toBe(actor);
          expect(universalTestProviderStore.actor.type).toBe(actor);
        });
      }
    }
  );

  it('creates stores lazily in the owning realm and keeps Vitest children followers', async () => {
    const storybook = await createStorybook(
      {
        configDir: fileURLToPath(new URL('../../instance/__fixtures__/first', import.meta.url)),
        main: { stories: [] },
        mode: 'headless',
      },
      { builtInAddons: [] }
    );
    INSTANCES.push(storybook);
    runWithStorybook(storybook, () => {
      const realm = getInstanceContext()!.universalStoreRealm;
      expect(realm.instances.size).toBe(0);
      vi.stubEnv('VITEST_CHILD_PROCESS', 'true');
      expect(universalStatusStore.actor.type).toBe(UniversalStore.ActorType.FOLLOWER);
      expect(universalTestProviderStore.actor.type).toBe(UniversalStore.ActorType.FOLLOWER);
      expect(realm.instances.size).toBe(2);
    });
  });
});
