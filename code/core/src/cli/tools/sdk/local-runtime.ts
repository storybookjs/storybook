import { resolve } from 'node:path';

import {
  ChangeDetectionService,
  experimental_getStatusStore,
  experimental_loadStorybook,
  experimental_resetChangeDetectionReadiness,
  experimental_resetServicesPresetOnce,
  experimental_setChangeDetectionHost,
  getService,
  prepareHeadlessUniversalStores,
  type StoryIndexGenerator,
} from 'storybook/internal/core-server';
import { CHANGE_DETECTION_STATUS_TYPE_ID, type Options } from 'storybook/internal/types';

import { clearRegistry } from '../../../shared/open-service/service-registry.ts';
import type {
  AnyToolsetDefinition,
  ToolsetGetService,
} from '../../../shared/open-service/toolset-definition.ts';
import {
  clearToolsetRegistry,
  getRegisteredToolsets,
} from '../../../shared/open-service/toolset-registry.ts';
import { resolveStorybookConfigDir } from '../config-dir.ts';
import type { ToolsTarget } from '../discover-instance.ts';
import { projectPathsEqual } from '../instances/project-path.ts';
import { ToolsRuntimeError } from './errors.ts';

export type ToolsRuntime = {
  configDir: string;
  toolsets: AnyToolsetDefinition[];
  getService: ToolsetGetService;
  close(): Promise<void>;
};

/**
 * Stand up the toolset runtime in this process, fully disconnected from any dev server.
 *
 * Loading the Storybook configuration applies the `services` preset exactly once, which registers
 * every open service and toolset — including any an addon contributes — as a consequence of normal
 * configuration loading, not via CLI-specific machinery.
 *
 * Graph hosting and change-detection scanning stay lazy: the module-graph engine starts from its
 * `status` query `load` (via `_waitForSettledEngine`), and the status service starts from the first
 * `getChangeDetectionReadiness` call. Help, docs, and test-run never touch either path. A missing
 * adapter settles the graph as unavailable instead of making unrelated tools fail.
 *
 * Requires `process.cwd()` to already be the target project. The `services` preset samples it for
 * file mapping, the same way the dev server does. `createTools` starts a child host when they
 * differ, instead of changing this process.
 */
export async function bootstrapToolsRuntime(
  target: ToolsTarget,
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

  // The dev server prepares the UniversalStore singleton with its server channel
  // (`getServerChannel`); without preparation the leader stores (the status store among them)
  // never become ready and reject every write. Configuration loading must receive the same
  // channel: addon responders (addon-vitest's test runner) answer requests and relay
  // child-process store events over the channel their preset hooks were given, and leader stores
  // only hear events on the channel they were prepared with.
  const channel = prepareHeadlessUniversalStores();

  const options = await experimental_loadStorybook({ configDir, channel });

  const setChangeDetectionHost = deps.setChangeDetectionHost ?? experimental_setChangeDetectionHost;
  setChangeDetectionHost(() => startChangeDetectionInProcess(options));

  let closed = false;
  const close = async () => {
    if (closed) {
      return;
    }
    closed = true;
    clearRegistry();
    clearToolsetRegistry();
    experimental_resetServicesPresetOnce();
    setChangeDetectionHost(undefined);
    experimental_resetChangeDetectionReadiness();
  };

  return {
    configDir,
    toolsets: getRegisteredToolsets(),
    getService: (serviceId, serviceOptions) => getService(serviceId as never, serviceOptions),
    close,
  };
}

async function startChangeDetectionInProcess(options: Options): Promise<void> {
  const changeDetectionService = new ChangeDetectionService({
    storyIndexGeneratorPromise: options.presets.apply<StoryIndexGenerator>('storyIndexGenerator'),
    statusStore: experimental_getStatusStore(CHANGE_DETECTION_STATUS_TYPE_ID),
    workingDir: process.cwd(),
  });

  const features = await options.presets.apply('features');
  changeDetectionService.start(features?.changeDetection !== false);
}
