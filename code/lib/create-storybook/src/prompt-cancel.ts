import type { TelemetryService } from './services/TelemetryService.ts';

const PROMPT_CANCEL_TIMEOUT_MS = 2_000;

export const createPromptCancelOptions = (
  telemetryService: Pick<TelemetryService, 'trackPromptCancel'>,
  promptName: string
) => ({
  async onCancel() {
    await Promise.race([
      telemetryService.trackPromptCancel(promptName).catch(() => {}),
      new Promise<void>((resolve) => {
        setTimeout(resolve, PROMPT_CANCEL_TIMEOUT_MS);
      }),
    ]);

    process.exit(0);
  },
});