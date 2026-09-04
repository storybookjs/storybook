import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type DetectResult, detect } from 'package-manager-detector';
import { parse as parseYaml } from 'yaml';

import { getProjectRoot } from '../common/index.ts';
import type { NodeLinker, PnpmNodeLinker, YarnNodeLinker } from './types.ts';

const YARN_LINKERS = ['node-modules', 'pnp', 'pnpm'] as const satisfies readonly YarnNodeLinker[];
const PNPM_LINKERS = ['isolated', 'hoisted', 'pnp'] as const satisfies readonly PnpmNodeLinker[];

const readYamlNodeLinker = (content: string) => parseYaml(content)?.nodeLinker;
// pnpm reads .npmrc as INI, where a value may be wrapped in matching quotes.
const readNpmrcNodeLinker = (content: string) =>
  content
    .match(/^\s*node-linker\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/m)
    ?.slice(1)
    .find(Boolean);

export const getPackageManagerInfo = async () => {
  const projectRoot = getProjectRoot();
  const packageManager = await detect({ cwd: projectRoot });

  if (!packageManager) {
    return undefined;
  }

  return {
    type: packageManager.name,
    version: packageManager.version,
    agent: packageManager.agent,
    nodeLinker: readNodeLinker(packageManager, projectRoot),
  };
};

// The linker setting lives in config files next to the lockfile, so reading them costs a file read
// instead of spawning the package manager, which takes hundreds of milliseconds for pnpm and yarn.
// Both package managers also walk every parent directory for their config file; the working
// directory and the project root are enough for telemetry.
function readNodeLinker(packageManager: DetectResult, projectRoot: string): NodeLinker {
  const directories = [process.cwd(), projectRoot];
  if (packageManager.name === 'yarn' && packageManager.agent === 'yarn@berry') {
    return (
      allowed(process.env.YARN_NODE_LINKER, YARN_LINKERS) ??
      readConfigValue(directories, '.yarnrc.yml', readYamlNodeLinker, YARN_LINKERS) ??
      'pnp'
    );
  }
  if (packageManager.name === 'pnpm') {
    // pnpm 11 reads settings from pnpm_config_* and pnpm-workspace.yaml only, but the version is
    // known only when package.json has a packageManager field.
    const major = Number(packageManager.version?.split('.')[0]);
    return (
      allowed(process.env.pnpm_config_node_linker, PNPM_LINKERS) ??
      allowed(process.env.npm_config_node_linker, PNPM_LINKERS) ??
      readConfigValue(directories, 'pnpm-workspace.yaml', readYamlNodeLinker, PNPM_LINKERS) ??
      (major >= 11
        ? undefined
        : readConfigValue(directories, '.npmrc', readNpmrcNodeLinker, PNPM_LINKERS)) ??
      'isolated'
    );
  }
  return 'node_modules';
}

function allowed<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  return values.includes(value as T) ? (value as T) : undefined;
}

function readConfigValue<T extends string>(
  directories: string[],
  fileName: string,
  read: (content: string) => unknown,
  values: readonly T[]
): T | undefined {
  for (const directory of directories) {
    const value = allowed(readSetting(join(directory, fileName), read), values);
    if (value) {
      return value;
    }
  }
  return undefined;
}

// A missing, unreadable or unparsable file is the same as a file without the setting.
function readSetting(filePath: string, read: (content: string) => unknown): unknown {
  try {
    return read(readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
}
