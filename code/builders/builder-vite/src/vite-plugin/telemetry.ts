// emulate CLI telemetry behavior in the vite plugin, since the CLI is not used in this context
import { optionalEnvToBoolean } from 'storybook/internal/common';
import {
  sendTelemetryError,
  summarizeIndex,
  type StoryIndexGenerator,
} from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { EventType } from 'storybook/internal/telemetry';
import {
  getPrecedingUpgrade,
  onPayloadError,
  setTelemetryEnabled,
  telemetry,
} from 'storybook/internal/telemetry';
import type { StoryIndex } from 'storybook/internal/types';

export const reportTelemetryError = (
  error: unknown,
  eventType: EventType,
  disableTelemetry = optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
) =>
  sendTelemetryError(error, eventType, {
    cliOptions: { disableTelemetry },
    skipPrompt: true,
  });

const resolveTelemetryState = async (disableTelemetry: boolean | undefined) => {
  await setTelemetryEnabled(!disableTelemetry);

  onPayloadError((error, eventType) => reportTelemetryError(error, eventType, disableTelemetry));
};

/** Emit the same 'dev' event as the CLI's doTelemetry, marked as vitePlugin in metadata. */
export async function emitDevTelemetry({
  configDir,
  disableTelemetry,
  storyIndexGenerator,
}: {
  configDir: string;
  disableTelemetry: boolean | undefined;
  storyIndexGenerator: StoryIndexGenerator;
}) {
  await resolveTelemetryState(disableTelemetry);
  telemetry(
    'dev',
    async () => {
      let indexAndStats;
      try {
        indexAndStats = await storyIndexGenerator.getIndexAndStats();
      } catch (err) {
        // Returning { error } triggers automatic error telemetry in place of the normal event.
        const error = err instanceof Error ? err : new Error(String(err));
        return { error };
      }
      return {
        precedingUpgrade: await getPrecedingUpgrade(),
        // The version-update check is a CLI dev-flow feature that doesn't exist in the plugin.
        versionStatus: 'disabled',
        storyIndex: summarizeIndex(indexAndStats.storyIndex),
        storyStats: indexAndStats.stats,
      };
    },
    { configDir }
  );
}

export async function emitBuildTelemetry({
  configDir,
  disableTelemetry,
  storyIndex,
}: {
  configDir: string;
  disableTelemetry: boolean | undefined;
  storyIndex: StoryIndex;
}) {
  await resolveTelemetryState(disableTelemetry);
  try {
    await telemetry(
      'build',
      {
        precedingUpgrade: await getPrecedingUpgrade(),
        storyIndex: summarizeIndex(storyIndex),
      },
      { configDir }
    );
  } catch (e) {
    logger.debug?.(`Build telemetry failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
