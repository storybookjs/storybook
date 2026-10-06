import { resolve } from 'node:path';

import { cache } from 'storybook/internal/common';
import { telemetry } from 'storybook/internal/telemetry';

import type { SetupRun } from './run.ts';

export async function recordSetupRun({ projectInfo, prompt }: SetupRun): Promise<void> {
  const runId = Math.random().toString(36);

  // The dev server's checklist reads this flag, and it must work with telemetry disabled, so it
  // lives in the regular cache rather than the telemetry event cache.
  await cache
    .set('ai-setup-ran', {
      timestamp: Date.now(),
      runId,
      configDir: resolve(projectInfo.configDir),
    })
    .catch(() => {});

  await telemetry(
    'ai-setup',
    {
      cliOptions: {
        packageManager: projectInfo.packageManager.type,
        prompt,
      },
      project: {
        framework: projectInfo.framework,
        renderer: projectInfo.rendererPackage,
        builder: projectInfo.builderPackage,
        language: projectInfo.language,
      },
      runId,
    },
    { configDir: projectInfo.configDir }
  );
}
