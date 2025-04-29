import { withTelemetry } from 'storybook/internal/core-server';
import { telemetry } from 'storybook/internal/telemetry';

export function remove(addonName: string, options: RemoveOptions) {
  withTelemetry('remove', { cliOptions: options }, async () => {
    await remove(addonName, options);
    if (!options.disableTelemetry) {
      await telemetry('remove', { addon: addonName, source: 'cli' });
    }
  });
}
