import type { TelemetryService } from './services/TelemetryService.ts';

export const createPromptCancelOptions = (
  telemetryService: Pick<TelemetryService, 'trackPromptCancel'>,
  promptName: string
) => ({
  async onCancel() {
    await telemetryService.trackPromptCancel(promptName).catch(() => {});
    process.exit(0);
  },
});
