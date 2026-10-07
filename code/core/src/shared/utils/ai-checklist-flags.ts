import { resolve } from 'node:path';

import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import { SESSION_TIMEOUT } from 'storybook/internal/telemetry';

/**
 * Flags persisted to the regular fs cache by the CLI to drive AI-related UI in
 * the dev server. They live OUTSIDE the telemetry event cache on purpose:
 * Storybook's UI behavior must not depend on whether telemetry happens to be
 * enabled. Both flags are tiny local files containing no PII.
 *
 * Both flags are scoped to a Storybook project via `configDir`. Several
 * Storybook projects can share one cache directory (e.g. multiple config dirs
 * in one package) — without scoping, running `storybook ai setup` (or
 * `storybook init` with AI accepted) for one project would falsely flip
 * another project's checklist or copy-prompt UI.
 *
 * The CLI writes `{ timestamp, configDir }` (absolute, resolved). The dev
 * server compares the cached `configDir` against its own resolved
 * `options.configDir` and only honors the flag on a match.
 *
 * The cache is located from the config dir rather than the working directory,
 * so the CLI and the dev server find the same file wherever each was started.
 */

interface ProjectScopedFlag {
  timestamp: number;
  configDir: string;
  // only on ai-init-opt-in
  answer?: boolean;
  // only on ai-setup-ran
  runId?: string;
}

function isProjectScopedFlag(value: unknown): value is ProjectScopedFlag {
  return (
    typeof value === 'object' &&
    value !== null &&
    'configDir' in value &&
    typeof (value as ProjectScopedFlag).configDir === 'string'
  );
}

function projectCache(configDir: string) {
  return createFileSystemCache({
    basePath: resolvePathInStorybookCache('dev-server', 'default', resolve(configDir)),
    ns: 'storybook',
  });
}

export async function writeProjectScopedFlag(
  key: 'ai-init-opt-in' | 'ai-setup-ran',
  configDir: string,
  data: Pick<ProjectScopedFlag, 'answer' | 'runId'>
): Promise<void> {
  await projectCache(configDir).set(key, {
    ...data,
    timestamp: Date.now(),
    configDir: resolve(configDir),
  });
}

async function readProjectScopedFlag(
  key: string,
  configDir: string
): Promise<ProjectScopedFlag | undefined> {
  try {
    const value = await projectCache(configDir).get(key);
    if (isProjectScopedFlag(value) && value.configDir === resolve(configDir)) {
      return value;
    }
  } catch {}
}

/** Written by `storybook init` when the user accepted the AI feature and in legacy inits where the question was not asked.
 * Due to regressions with unsupported frameworks, and the computational complexity of plugging framework feature support
 * into this part of the app, we've decided to revert the flag to treat the user as opting out from init when the flag
 * isn't found.
 */
export async function hasAiInitOptIn(configDir: string): Promise<boolean> {
  const flag = await readProjectScopedFlag('ai-init-opt-in', configDir);
  return flag?.answer === true;
}

/** Written by `storybook ai setup` when it ran in this project. */
export async function hasAiSetupRun(configDir: string): Promise<boolean> {
  return !!(await readProjectScopedFlag('ai-setup-ran', configDir));
}

export async function getAiSetupRunId(configDir: string): Promise<string | undefined> {
  return (await readProjectScopedFlag('ai-setup-ran', configDir))?.runId;
}

// A fixed window from the setup run: the CLI and Vitest may not share a telemetry session to compare.
export async function isWithinAiSetupSession(configDir: string): Promise<boolean> {
  const flag = await readProjectScopedFlag('ai-setup-ran', configDir);
  return !!flag && Date.now() - flag.timestamp < SESSION_TIMEOUT;
}
