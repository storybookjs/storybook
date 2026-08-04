import { resolve } from 'node:path';

import {
  ChangeDetectionService,
  experimental_getChangeDetectionReadiness,
  experimental_getStatusStore,
  experimental_loadStorybook,
  getBuilders,
  getService,
  prepareHeadlessUniversalStores,
  resolveChangeDetectionAdapter,
  type ChangeDetectionAdapter,
  type Experimental_ChangeDetectionReadiness,
  type StoryIndexGenerator,
} from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';
import type { Options } from 'storybook/internal/types';

import type {
  AnyToolsetDefinition,
  ToolsetGetService,
} from '../../shared/open-service/toolset-definition.ts';
import { getRegisteredToolsets } from '../../shared/open-service/toolset-registry.ts';
import { resolveStorybookConfigDir } from '../ai/mcp/local-metadata.ts';
import type { ToolsTarget } from './discover-instance.ts';

export type ToolsRuntime = {
  configDir: string;
  toolsets: AnyToolsetDefinition[];
  getService: ToolsetGetService;
  /** Present only when the module graph was hosted for this invocation. */
  moduleGraphReadiness?: Experimental_ChangeDetectionReadiness;
};

/**
 * Stand up the toolset runtime in this process, fully disconnected from any dev server.
 *
 * Loading the Storybook configuration applies the `services` preset exactly once, which registers
 * every open service and toolset — including any an addon contributes — as a consequence of normal
 * configuration loading, not via CLI-specific machinery.
 *
 * The module-graph engine registered by that pass waits on a deferred builder adapter. That
 * deferred must always settle, or any graph query would hang forever: when this invocation hosts
 * the graph, it repeats the dev server's bootstrap sequence; otherwise it resolves the adapter to
 * `undefined`, so a stray graph query reports `unavailable` instead of hanging.
 */
export async function bootstrapToolsRuntime(
  target: ToolsTarget,
  { hostModuleGraph }: { hostModuleGraph: boolean }
): Promise<ToolsRuntime> {
  const cwd = resolve(target.cwd ?? process.cwd());
  // Everything the `services` hooks register keys its file mapping off `process.cwd()` — the
  // module-graph working dir, the git diff provider, docgen — exactly as in the dev server, whose
  // process runs from the project. A one-shot CLI adopts the target directory so `--cwd` aligns
  // every consumer at once, instead of threading a working dir through each of them.
  if (cwd !== process.cwd()) {
    process.chdir(cwd);
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

  let moduleGraphReadiness: Experimental_ChangeDetectionReadiness | undefined;
  if (hostModuleGraph) {
    moduleGraphReadiness = await hostModuleGraphInProcess(options);
  } else {
    resolveChangeDetectionAdapter(undefined);
  }

  return {
    configDir,
    toolsets: getRegisteredToolsets(),
    getService: (serviceId, serviceOptions) => getService(serviceId as never, serviceOptions),
    moduleGraphReadiness,
  };
}

/**
 * Repeat the dev server's change-detection bootstrap in this process: construct the status
 * service, obtain the builder adapter (undefined on absence or throw), resolve the module-graph
 * engine's deferred adapter, start the status service, and wait for the readiness signal so
 * graph-dependent handlers read a settled graph and a populated status store.
 *
 * The adapter comes from the builder's `changeDetectionAdapter` hook called with `options`, which
 * is the headless variant of the call the dev server makes after `start()`.
 */
async function hostModuleGraphInProcess(
  options: Options
): Promise<Experimental_ChangeDetectionReadiness> {
  const changeDetectionService = new ChangeDetectionService({
    storyIndexGeneratorPromise: options.presets.apply<StoryIndexGenerator>('storyIndexGenerator'),
    statusStore: experimental_getStatusStore(CHANGE_DETECTION_STATUS_TYPE_ID),
    workingDir: process.cwd(),
  });

  const [previewBuilder] = await getBuilders(options);
  let adapter: ChangeDetectionAdapter | undefined;
  try {
    adapter = previewBuilder.changeDetectionAdapter?.(options);
  } catch (error) {
    // Same visibility as the dev server: a misconfigured builder should not look identical to a
    // builder that simply lacks change-detection support.
    logger.warn('Change detection: adapter initialisation failed');
    logger.debug(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
  resolveChangeDetectionAdapter(adapter);

  const features = await options.presets.apply('features');
  changeDetectionService.start(features?.changeDetection !== false);

  return experimental_getChangeDetectionReadiness();
}
