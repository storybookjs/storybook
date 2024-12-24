import { getPrecedingUpgrade, telemetry } from '@storybook/core/telemetry';
import type { CoreConfig, Options } from '@storybook/core/types';

import type Polka from 'polka';
import invariant from 'tiny-invariant';

import { sendTelemetryError } from '../withTelemetry';
import type { StoryIndexGenerator } from './StoryIndexGenerator';
import { useStorybookMetadata } from './metadata';
import { summarizeIndex } from './summarizeIndex';
import { versionStatus } from './versionStatus';

export async function doTelemetry(
  app: Polka.Polka,
  core: CoreConfig,
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator | undefined>,
  options: Options
) {
  if (!core?.disableTelemetry) {
    initializedStoryIndexGenerator.then(async (generator) => {
      let indexAndStats;
      try {
        indexAndStats = await generator?.getIndexAndStats();
      } catch (err) {
        // If we fail to get the index, treat it as a recoverable error, but send it up to telemetry
        // as if we crashed. In the future we will revisit this to send a distinct error
        if (!(err instanceof Error)) {
          throw new Error('encountered a non-recoverable error');
        }
        sendTelemetryError(err, 'dev', {
          cliOptions: options,
          presetOptions: { ...options, corePresets: [], overridePresets: [] },
        });
        return;
      }
      const { versionCheck, versionUpdates } = options;
      invariant(
        !versionUpdates || (versionUpdates && versionCheck),
        'versionCheck should be defined when versionUpdates is true'
      );
      const payload = {
        precedingUpgrade: await getPrecedingUpgrade(),
      };
      if (indexAndStats) {
        Object.assign(payload, {
          versionStatus: versionUpdates && versionCheck ? versionStatus(versionCheck) : 'disabled',
          storyIndex: summarizeIndex(indexAndStats.storyIndex),
          storyStats: indexAndStats.stats,
        });
      }
      telemetry('dev', payload, { configDir: options.configDir });
    });
  }

  if (!core?.disableProjectJson) {
    useStorybookMetadata(app, options.configDir);
  }
}
