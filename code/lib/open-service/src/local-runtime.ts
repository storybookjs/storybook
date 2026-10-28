import { resolve } from 'node:path';

import {
  ChangeDetectionService,
  experimental_getStatusStore,
  experimental_setChangeDetectionHost,
} from '@storybook/core/internal/services';
import { type StoryIndexGenerator } from '@storybook/core/internal/story-index';
import type { Storybook } from '@storybook/core';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '@storybook/core/internal/types';

import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';
import { getInstanceContext } from '@storybook/core/internal/deep/shared/instance-context';
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
  target: ToolsTarget & { createStorybook: StorybookFactory },
  deps: { setChangeDetectionHost?: typeof experimental_setChangeDetectionHost } = {}
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
  const setChangeDetectionHost = deps.setChangeDetectionHost ?? experimental_setChangeDetectionHost;
  runWithStorybook(storybook, () => {
    setChangeDetectionHost(() => startChangeDetectionInProcess(storybook));
  });

  return {
    storybook,
    configDir,
    toolsets: storybook.toolsets.values(),
    getService: (serviceId, serviceOptions) =>
      storybook.services.get(serviceId as never, serviceOptions),
    close: () => storybook.close(),
  };
}

async function startChangeDetectionInProcess(storybook: Storybook): Promise<void> {
  const context = getInstanceContext();
  const changeDetectionService = new ChangeDetectionService({
    // Only the `storybook` common plugin provides the preset; core-only instances own one directly.
    storyIndexGeneratorPromise: storybook.presets
      .apply<StoryIndexGenerator | undefined>('storyIndexGenerator')
      .then((generator) => generator ?? storybook.getStoryIndexGenerator()),
    statusStore: experimental_getStatusStore(CHANGE_DETECTION_STATUS_TYPE_ID),
    workingDir: storybook.workingDir,
  });
  context?.cleanups.add(() => changeDetectionService.dispose());
  changeDetectionService.start();
}
