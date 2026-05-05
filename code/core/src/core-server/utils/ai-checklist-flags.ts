import { resolve } from 'node:path';

import { cache } from 'storybook/internal/common';

/**
 * Flags persisted to the regular fs cache by the CLI to drive AI-related UI in
 * the dev server. They live OUTSIDE the telemetry event cache on purpose:
 * Storybook's UI behavior must not depend on whether telemetry happens to be
 * enabled. Both flags are tiny local files containing no PII.
 *
 * Both flags are scoped to a Storybook project via `configDir`. In monorepos
 * with hoisted `node_modules`, multiple Storybook projects share the same
 * `node_modules/.cache/storybook/...` directory — without scoping, running
 * `storybook ai setup` (or `storybook init` with AI accepted) in package A
 * would falsely flip package B's checklist or copy-prompt UI.
 *
 * The CLI writes `{ timestamp, configDir }` (absolute, resolved). The dev
 * server compares the cached `configDir` against its own resolved
 * `options.configDir` and only honors the flag on a match.
 */

interface ProjectScopedFlag {
  timestamp: number;
  configDir: string;
}

function isProjectScopedFlag(value: unknown): value is ProjectScopedFlag {
  return (
    typeof value === 'object' &&
    value !== null &&
    'configDir' in value &&
    typeof (value as ProjectScopedFlag).configDir === 'string'
  );
}

async function readProjectScopedFlag(key: string, configDir: string): Promise<boolean> {
  try {
    const value = await cache.get(key);
    if (!isProjectScopedFlag(value)) {
      return false;
    }
    return value.configDir === resolve(configDir);
  } catch {
    return false;
  }
}

/** Written by `storybook init` when the user accepted the AI feature. */
export async function hasAiInitOptIn(configDir: string): Promise<boolean> {
  return readProjectScopedFlag('ai-init-opt-in', configDir);
}

/** Written by `storybook ai setup` when the prompt CLI ran in this project. */
export async function hasAiSetupRun(configDir: string): Promise<boolean> {
  return readProjectScopedFlag('ai-setup-ran', configDir);
}
