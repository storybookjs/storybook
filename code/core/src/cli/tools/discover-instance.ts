import { resolve } from 'node:path';

import { detectAgent } from '../../telemetry/detect-agent.ts';
import { resolveStorybookConfigDir } from './config-dir.ts';
import { readRegistry } from './instances/registry.ts';
import { resolveInstance } from './instances/resolve.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';

export type ToolsTarget = {
  /** Project directory of the target Storybook; defaults to `process.cwd()`. */
  cwd?: string;
  /** Directory where to load Storybook configuration from; relative paths resolve from `cwd`. */
  configDir?: string;
};

export type InstanceDiscovery = {
  /** The running instance serving the targeted project, if any. */
  currentRecord: StorybookInstanceRecord | undefined;
  /** All live records, so callers can point at Storybooks running for other projects. */
  records: StorybookInstanceRecord[];
};

/**
 * Find a running `storybook dev` instance for the targeted project via the runtime instance
 * registry the dev server writes.
 *
 * Applies the shared matching rules (cwd/config-dir keys, agent buckets, recency, pid liveness)
 * but ignores the record's MCP status: the tools CLI only needs a live origin for its URLs, so any
 * running Storybook counts — with or without `@storybook/addon-mcp` installed.
 */
export async function discoverRunningInstance(
  target: ToolsTarget,
  deps: { registryDir?: string } = {}
): Promise<InstanceDiscovery> {
  const cwd = resolve(target.cwd ?? process.cwd());
  const configDir = resolveStorybookConfigDir({ cwd, configDir: target.configDir });

  const records = await readRegistry(deps.registryDir);
  const resolution = resolveInstance(records, {
    cwd,
    configDir,
    configDirExplicit: target.configDir != null,
    agent: detectAgent()?.name,
  });

  // `resolveInstance` dispatches on the record's MCP status; a status intercept still carries the
  // matched records (most recent first), which is all this consumer needs.
  const currentRecord = resolution.kind === 'instance' ? resolution.record : resolution.matches[0];
  return { currentRecord, records };
}
