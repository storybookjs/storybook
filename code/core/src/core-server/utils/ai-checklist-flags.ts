import { cache } from 'storybook/internal/common';

/**
 * Flags persisted to the regular fs cache by the CLI to drive AI-related UI in
 * the dev server. They live OUTSIDE the telemetry event cache on purpose:
 * Storybook's UI behavior must not depend on whether telemetry happens to be
 * enabled. Both flags are tiny local files containing no PII.
 */

/** Written by `storybook init` when the user accepted the AI feature. */
export async function hasAiInitOptIn(): Promise<boolean> {
  try {
    return Boolean(await cache.get('ai-init-opt-in'));
  } catch {
    return false;
  }
}

/** Written by `storybook ai setup` when the prompt CLI ran in this project. */
export async function hasAiSetupRun(): Promise<boolean> {
  try {
    return Boolean(await cache.get('ai-setup-ran'));
  } catch {
    return false;
  }
}
