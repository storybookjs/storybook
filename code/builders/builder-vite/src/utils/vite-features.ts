import type { UserConfig } from 'vite';
import { version } from 'vite';

// TODO: Remove once support for Vite < 8 is dropped
const shouldUseRolldownOptions = () => {
  try {
    return Number(version.split('.')[0]) >= 8;
  } catch {
    return false;
  }
};

/**
 * Returns the correct bundler options key based on the installed Vite version. Vite 8 renamed
 * `build.rollupOptions` to `build.rolldownOptions`.
 */
// TODO: Remove once support for Vite < 8 is dropped, and use 'rolldownOptions' directly
export const bundlerOptionsKey = shouldUseRolldownOptions() ? 'rolldownOptions' : 'rollupOptions';

export function ensureRolldownOptions(config: UserConfig) {
  if (!shouldUseRolldownOptions()) {
    return;
  }

  // @ts-expect-error - rolldownOptions will only exist with Vite 8+
  const rolldown = (config.build.rolldownOptions ??= {});
  const output = (rolldown.output ??= {});
  output.strictExecutionOrder = true;
}
