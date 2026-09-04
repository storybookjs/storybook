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
      [
        process.env.YARN_NODE_LINKER,
        ...directories.map((dir) => readSetting(join(dir, '.yarnrc.yml'), readYamlNodeLinker)),
      ].find((value): value is YarnNodeLinker => YARN_LINKERS.some((linker) => linker === value)) ??
      'pnp'
    );
  }
  if (packageManager.name === 'pnpm') {
    // pnpm 11 reads settings from pnpm_config_* and pnpm-workspace.yaml only, but the version is
    // known only when package.json has a packageManager field.
    const legacy = !(Number(packageManager.version?.split('.')[0]) >= 11);
    return (
      [
        process.env.pnpm_config_node_linker,
        legacy ? process.env.npm_config_node_linker : undefined,
        ...directories.map((dir) =>
          readSetting(join(dir, 'pnpm-workspace.yaml'), readYamlNodeLinker)
        ),
        ...(legacy
          ? directories.map((dir) => readSetting(join(dir, '.npmrc'), readNpmrcNodeLinker))
          : []),
      ].find((value): value is PnpmNodeLinker => PNPM_LINKERS.some((linker) => linker === value)) ??
      'isolated'
    );
  }
  return 'node_modules';
}

// A missing, unreadable or unparsable file is the same as a file without the setting.
function readSetting(filePath: string, extract: (content: string) => unknown): unknown {
  try {
    return extract(readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
}
