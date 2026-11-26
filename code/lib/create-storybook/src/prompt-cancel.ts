import type { TelemetryService } from './services/TelemetryService.ts';

const PROMPT_CANCEL_TIMEOUT_MS = 2_000;

export const createPromptCancelOptions = (
  telemetryService: Pick<TelemetryService, 'trackPromptCancel'>,
  promptName: string
) => ({
  async onCancel() {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, PROMPT_CANCEL_TIMEOUT_MS);
      timeout.unref?.();
    });

    try {
      await Promise.race([
        telemetryService.trackPromptCancel(promptName).catch(() => {}),
        timeoutPromise,
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
    process.exit(0);
  },
});
