import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { prompt } from 'storybook/internal/node-logger';
import { FindPackageVersionsError } from 'storybook/internal/server-errors';

import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import type { ExecaChildProcess } from 'execa';

import type { ExecuteCommandOptions } from '../utils/command';
import { executeCommand } from '../utils/command';
import { getProjectRoot } from '../utils/paths';
import { JsPackageManager, PackageManagerName } from './JsPackageManager';
import type { PackageJson } from './PackageJson';
import type { InstallationMetadata, PackageMetadata } from './types';
import { parsePackageData } from './util';

type Yarn1ListItem = {
  name: string;
  children: Yarn1ListItem[];
};

type Yarn1ListData = {
  type: 'list';
  trees: Yarn1ListItem[];
};

export type Yarn1ListOutput = {
  type: 'tree';
  data: Yarn1ListData;
};

const YARN1_ERROR_REGEX = /^error\s(.*)$/gm;

export class Yarn1Proxy extends JsPackageManager {
  readonly type = PackageManagerName.YARN1;

  installArgs: string[] | undefined;

  getInstallArgs(): string[] {
    if (!this.installArgs) {
      this.installArgs = process.env.CI ? [] : ['--ignore-workspace-root-check'];
    }
    return this.installArgs;
  }

  getRunCommand(command: string): string {
    return `yarn ${command}`;
  }

  public runPackageCommand({
    args,
    ...options
  }: Omit<ExecuteCommandOptions, 'command'> & { args: string[] }): ExecaChildProcess {
    const [command, ...rest] = args;
    return executeCommand({
      command: `yarn`,
      args: ['exec', command, '--', ...rest],
      ...options,
    });
  }

  public runInternalCommand(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'inherit' | 'pipe' | 'ignore'
  ) {
    return executeCommand({
      command: `yarn`,
      args: [command, ...args],
      cwd: cwd ?? this.cwd,
      stdio,
    });
  }

  public async getModulePackageJSON(
    packageName: string,
    cwd = this.cwd
  ): Promise<PackageJson | null> {
    const wantedPath = join('node_modules', packageName, 'package.json');
    const packageJsonPath = find.up(wantedPath, { cwd, last: getProjectRoot() });

    if (!packageJsonPath) {
      return null;
    }

    return JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as Record<string, any>;
  }

  public async getRegistryURL() {
    const childProcess = await executeCommand({
      command: 'yarn',
      args: ['config', 'get', 'registry'],
    });
    const url = (childProcess.stdout ?? '').trim();
    return url === 'undefined' ? undefined : url;
  }

  public async findInstallations(pattern: string[], { depth = 99 }: { depth?: number } = {}) {
    const yarnArgs = ['list', '--pattern', pattern.map((p) => `"${p}"`).join(' '), '--json'];

    if (depth !== 0) {
      yarnArgs.push('--recursive');
    }

    try {
      const process = executeCommand({
        command: 'yarn',
        args: yarnArgs.concat(pattern),
        env: {
          FORCE_COLOR: 'false',
        },
        cwd: this.instanceDir,
      });
      const result = await process;
      const commandResult = result.stdout ?? '';

      const parsedOutput = JSON.parse(commandResult);
      return this.mapDependencies(parsedOutput, pattern);
    } catch (e) {
      return undefined;
    }
  }

  protected getResolutions(packageJson: PackageJson, versions: Record<string, string>) {
    return {
      resolutions: {
        ...packageJson.resolutions,
        ...versions,
      },
    };
  }

  protected runInstall(options?: { force?: boolean }) {
    return executeCommand({
      command: 'yarn',
      args: ['install', ...this.getInstallArgs(), ...(options?.force ? ['--force'] : [])],
      stdio: prompt.getPreferredStdio(),
      cwd: this.cwd,
    });
  }

  protected runAddDeps(dependencies: string[], installAsDevDependencies: boolean) {
    let args = [...dependencies];

    if (installAsDevDependencies) {
      args = ['-D', ...args];
    }

    return executeCommand({
      command: 'yarn',
      args: ['add', ...this.getInstallArgs(), ...args],
      stdio: prompt.getPreferredStdio(),
      cwd: this.primaryPackageJson.operationDir,
    });
  }

  protected async runGetVersions<T extends boolean>(
    packageName: string,
    fetchAllVersions: T
  ): Promise<T extends true ? string[] : string> {
    const args = [fetchAllVersions ? 'versions' : 'version', '--json'];
    try {
      const process = executeCommand({
        command: 'yarn',
        args: ['info', packageName, ...args],
      });
      const result = await process;
      const commandResult = result.stdout ?? '';

      const parsedOutput = JSON.parse(commandResult);
      if (parsedOutput.type === 'inspect') {
        return parsedOutput.data;
      }
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(`Yarn did not provide an output with type 'inspect'.`);
    } catch (error) {
      throw new FindPackageVersionsError({
        error,
        packageManager: 'Yarn 1',
        packageName,
      });
    }
  }

  protected mapDependencies(input: Yarn1ListOutput, pattern: string[]): InstallationMetadata {
    if (input.type === 'tree') {
      const { trees } = input.data;
      const acc: Record<string, PackageMetadata[]> = {};
      const existingVersions: Record<string, string[]> = {};
      const duplicatedDependencies: Record<string, string[]> = {};

      const recurse = (tree: (typeof trees)[0]) => {
        const { children } = tree;
        const { name, value } = parsePackageData(tree.name);
        if (!name || !pattern.some((p) => new RegExp(`^${p.replace(/\*/g, '.*')}$`).test(name))) {
          return;
        }

        if (!existingVersions[name]?.includes(value.version)) {
          if (acc[name]) {
            acc[name].push(value);
          } else {
            acc[name] = [value];
          }
          existingVersions[name] = [...(existingVersions[name] || []), value.version];

          if (existingVersions[name].length > 1) {
            duplicatedDependencies[name] = existingVersions[name];
          }
        }

        children.forEach(recurse);
      };

      trees.forEach(recurse);

      return {
        dependencies: acc,
        duplicatedDependencies,
        infoCommand: 'yarn why',
        dedupeCommand: 'yarn dedupe',
      };
    }

    throw new Error('Something went wrong while parsing yarn output');
  }

  public parseErrorFromLogs(logs: string): string {
    let finalMessage = 'YARN1 error';
    const match = logs.match(YARN1_ERROR_REGEX);

    if (match) {
      const errorMessage = match[0]?.replace(/^error\s(.*)$/, '$1');
      if (errorMessage) {
        finalMessage = `${finalMessage}: ${errorMessage}`;
      }
    }

    return finalMessage.trim();
  }
}
