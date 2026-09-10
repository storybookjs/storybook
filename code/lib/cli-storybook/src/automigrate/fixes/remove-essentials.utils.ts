import type { ConfigFile } from 'storybook/internal/csf-tools';

export function moveEssentialOptions(
  dryRun: boolean | undefined,
  essentialsOptions: Record<string, any>
): (main: ConfigFile) => Promise<void> | void {
  return async (main) => {
    if (!dryRun) {
      for (const [name, value] of Object.entries(essentialsOptions)) {
        main.set(['features', name], value);
      }
    }
  };
}
