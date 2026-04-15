import {
  collectAiSetupEvidence,
  getPrecedingUpgrade,
  telemetry,
} from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import type { Polka } from 'polka';
import invariant from 'tiny-invariant';

import type { StoryIndexGenerator } from './StoryIndexGenerator.ts';
import { summarizeIndex } from './summarizeIndex.ts';
import { versionStatus } from './versionStatus.ts';

export async function doTelemetry(
  app: Polka,
  core: CoreConfig,
  storyIndexGeneratorPromise: Promise<StoryIndexGenerator>,
  options: Options
) {
  const { versionCheck, versionUpdates } = options;
  invariant(
    !versionUpdates || (versionUpdates && versionCheck),
    'versionCheck should be defined when versionUpdates is true'
  );
  telemetry(
    'dev',
    async () => {
      const generator = await storyIndexGeneratorPromise;
      let indexAndStats;
      try {
        indexAndStats = await generator?.getIndexAndStats();
      } catch (err) {
        // If we fail to get the index, treat it as a recoverable error, but send it up to telemetry
        // as if we crashed. Returning { error } triggers automatic error telemetry in place of
        // the normal event.
        const error = err instanceof Error ? err : new Error('encountered a non-recoverable error');
        return { error };
      }

      const payload = {
        precedingUpgrade: await getPrecedingUpgrade(),
      };
      if (indexAndStats) {
        // sb ai commands trigger side effects performed by agent harnesses, which can't be observed
        // directly. This is the entry point for collecting evidence about those side effects and
        // recording them in telemetry.
        if (indexAndStats) {
          collectAiSetupEvidence('dev', options.configDir, indexAndStats.storyIndex);
        }

        Object.assign(payload, {
          versionStatus: versionUpdates && versionCheck ? versionStatus(versionCheck) : 'disabled',
          storyIndex: summarizeIndex(indexAndStats.storyIndex),
          storyStats: indexAndStats.stats,
        });
      }
      return payload;
    },
    { configDir: options.configDir }
  );
}
