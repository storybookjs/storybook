import { resolve } from 'node:path';

import { cache, PackageManagerName } from 'storybook/internal/common';
import { telemetry } from 'storybook/internal/telemetry';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { ProjectInfo } from './project-info.ts';
import { recordSetupRun } from './record-setup-run.ts';

vi.mock('storybook/internal/telemetry', { spy: true });

const projectInfo = {
  framework: '@storybook/react-vite',
  rendererPackage: '@storybook/react',
  builderPackage: '@storybook/builder-vite',
  configDir: resolve('.storybook'),
  language: 'ts',
  packageManager: { type: PackageManagerName.NPM },
} as ProjectInfo;

beforeEach(() => {
  vi.mocked(telemetry).mockResolvedValue(undefined);
  vi.spyOn(cache, 'set').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('persists a project-scoped flag and reports the setup session under the same run id', async () => {
  await recordSetupRun({ projectInfo, prompt: 'optimized-tests' });

  const [, flag] = vi.mocked(cache.set).mock.calls[0];
  expect(cache.set).toHaveBeenCalledWith('ai-setup-ran', {
    timestamp: expect.any(Number),
    runId: expect.any(String),
    configDir: resolve('.storybook'),
  });
  expect(telemetry).toHaveBeenCalledWith('ai-setup', {
    cliOptions: { packageManager: 'npm', prompt: 'optimized-tests' },
    project: {
      framework: '@storybook/react-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
      language: 'ts',
    },
    runId: (flag as { runId: string }).runId,
  });
});

it('still reports the setup session when the flag cannot be written', async () => {
  vi.mocked(cache.set).mockRejectedValue(new Error('read-only cache'));

  await recordSetupRun({ projectInfo, prompt: 'optimized-tests' });

  expect(telemetry).toHaveBeenCalledWith('ai-setup', expect.anything());
});
