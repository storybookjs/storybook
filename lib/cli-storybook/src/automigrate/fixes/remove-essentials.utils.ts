import type { ConfigFile } from 'storybook/internal/csf-tools';

export function moveEssentialOptions(
  dryRun: boolean | undefined,
  essentialsOptions: Record<string, any>
): (main: ConfigFile) => Promise<void> | void {
  return async (main) => {
    const features = main.getFieldValue(['features']) || {};

    if (!dryRun) {
      main.setFieldValue(['features'], {
        ...features,
        ...essentialsOptions,
      });
    }
  };
}
