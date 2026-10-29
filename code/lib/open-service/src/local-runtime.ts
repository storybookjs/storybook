import { resolve } from 'node:path';

import type { Storybook } from '@storybook/core';

import type { AnyToolsetDefinition, ToolsetGetService } from '@storybook/core/open-service';
import { resolveStorybookConfigDir } from './config-dir.ts';
import type { ToolsTarget } from './discover-instance.ts';
import { projectPathsEqual } from './instances/project-path.ts';
import { ToolsRuntimeError } from './errors.ts';
import type { StorybookFactory } from './instance-factory.ts';

export type ToolsRuntime = {
  storybook: Storybook;
  configDir: string;
  toolsets: AnyToolsetDefinition[];
  getService: ToolsetGetService;
  close(): Promise<void>;
};

/** Load a headless Storybook for local tools without changing the process directory. */
export async function bootstrapToolsRuntime(
  target: ToolsTarget & { createStorybook: StorybookFactory }
): Promise<ToolsRuntime> {
  const cwd = resolve(target.cwd ?? process.cwd());
  if (!projectPathsEqual(cwd, process.cwd())) {
    throw new ToolsRuntimeError({
      reason: 'mode-unavailable',
      message: `Local tools bootstrap requires process.cwd() to be the target project (${cwd}), not ${process.cwd()}.`,
    });
  }
  const configDir = resolveStorybookConfigDir({ cwd, configDir: target.configDir });
  const storybook = await target.createStorybook({ configDir, workingDir: cwd, mode: 'headless' });

  return {
    storybook,
    configDir,
    toolsets: storybook.toolsets.values(),
    getService: (serviceId, serviceOptions) =>
      storybook.services.get(serviceId as never, serviceOptions),
    close: () => storybook.close(),
  };
}
