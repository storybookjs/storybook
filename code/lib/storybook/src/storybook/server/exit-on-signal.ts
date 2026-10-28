import { isTelemetryModuleEnabled, telemetry } from '@storybook/core/internal/telemetry';
import { summarizeIndex } from '@storybook/core/internal/deep/story-index/summarizeIndex';

import type { buildDevStandalone } from './build-dev.ts';

type DevServer = Pick<Awaited<ReturnType<typeof buildDevStandalone>>, 'storybook' | 'close'>;

const SHUTDOWN_TIMEOUT_MS = 3000;

/**
 * Close the dev server, report `canceled` telemetry and exit with code 0 on SIGINT or SIGTERM.
 *
 * A second signal, or a shutdown slower than three seconds, exits immediately. The returned
 * function removes the listeners for callers that close the server another way.
 */
export function exitOnDevServerSignal(server: DevServer): () => void {
  async function cancelTelemetry(): Promise<void> {
    if (!isTelemetryModuleEnabled()) {
      return;
    }
    const payload = { eventType: 'dev' };
    try {
      const generator = await server.storybook.getStoryIndexGenerator();
      const { storyIndex, stats } = await generator.getIndexAndStats();
      Object.assign(payload, { storyIndex: summarizeIndex(storyIndex), storyStats: stats });
    } catch {}
    await telemetry('canceled', payload, { immediate: true });
  }

  let shuttingDown = false;
  async function onSignal(): Promise<void> {
    if (shuttingDown) {
      return process.exit(0);
    }
    shuttingDown = true;
    const timeout = setTimeout(() => process.exit(0), SHUTDOWN_TIMEOUT_MS);
    try {
      await Promise.allSettled([cancelTelemetry(), server.close()]);
    } finally {
      clearTimeout(timeout);
      process.exit(0);
    }
  }

  // Keep a listener installed until exit so signal-exit cannot re-send the first signal.
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  return () => {
    if (shuttingDown) {
      return;
    }
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  };
}
