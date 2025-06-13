import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { prompt } from 'storybook/internal/node-logger';
import { FindPackageVersionsError } from 'storybook/internal/server-errors';

import { findUpSync } from 'find-up';

import { getProjectRoot } from '../utils/paths';
import { JsPackageManager } from './JsPackageManager';
import type { PackageJson } from './PackageJson';
import type { InstallationMetadata, PackageMetadata } from './types';

type PnpmDependency = {
  from: string;
  version: string;
  resolved: string;
  dependencies?: PnpmDependencies;
};

type PnpmDependencies = {
  [key: string]: PnpmDependency;
};

type PnpmListItem = {
  dependencies: PnpmDependencies;
  peerDependencies: PnpmDependencies;
  devDependencies: PnpmDependencies;
};

export type PnpmListOutput = PnpmListItem[];

const PNPM_ERROR_REGEX = /(ELIFECYCLE|ERR_PNPM_[A-Z_]+)\s+(.*)/i;

export class PNPMProxy extends JsPackageManager {
  readonly type = 'pnpm';

  installArgs: string[] | undefined;

  detectWorkspaceRoot() {
    const CWD = process.cwd();

    const pnpmWorkspaceYaml = `${CWD}/pnpm-workspace.yaml`;
    return existsSync(pnpmWorkspaceYaml);
  }

  getRunCommand(command: string): string {
    return `pnpm run ${command}`;
  }

  getRemoteRunCommand(pkg: string, args: string[], specifier?: string): string {
    return `pnpm dlx ${pkg}${specifier ? `@${specifier}` : ''} ${args.join(' ')}`;
  }

  async getPnpmVersion(): Promise<string> {
    const result = await this.executeCommand({
      command: 'pnpm',
      args: ['--version'],
    });
    return result.stdout ?? null;
  }

  getInstallArgs(): string[] {
    if (!this.installArgs) {
      this.installArgs = [];

      if (this.detectWorkspaceRoot()) {
        this.installArgs.push('-w');
      }
    }
    return this.installArgs;
  }

  public runPackageCommandSync(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'pipe' | 'inherit'
  ): string {
    return this.executeCommandSync({
      command: 'pnpm',
      args: ['exec', command, ...args],
      cwd,
      stdio,
    });
  }

  public runPackageCommand(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'pipe' | 'inherit'
  ) {
    return this.executeCommand({
      command: 'pnpm',
      args: ['exec', command, ...args],
      cwd,
      stdio,
    });
  }

  public runInternalCommand(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'inherit' | 'pipe' | 'ignore'
  ) {
    return this.executeCommand({
      command: 'pnpm',
      args: [command, ...args],
      cwd,
      stdio,
    });
  }

  public async getRegistryURL() {
    const childProcess = await this.executeCommand({
      command: 'pnpm',
      args: ['config', 'get', 'registry'],
    });
    const url = (childProcess.stdout ?? '').trim();
    return url === 'undefined' ? undefined : url;
  }

  public async findInstallations(pattern: string[], { depth = 99 }: { depth?: number } = {}) {
    try {
      const childProcess = await this.executeCommand({
        command: 'pnpm',
        args: ['list', pattern.map((p) => `"${p}"`).join(' '), '--json', `--depth=${depth}`],
        env: {
          FORCE_COLOR: 'false',
        },
        cwd: this.instanceDir,
      });
      const commandResult = childProcess.stdout ?? '';

      const parsedOutput = JSON.parse(commandResult);
      return this.mapDependencies(parsedOutput, pattern);
    } catch (e) {
      return undefined;
    }
  }

  public getModulePackageJSON(packageName: string): PackageJson | null {
    const pnpapiPath = findUpSync(['.pnp.js', '.pnp.cjs'], {
      cwd: this.primaryPackageJson.operationDir,
      stopAt: getProjectRoot(),
    });

    if (pnpapiPath) {
      try {
        const pnpApi = require(pnpapiPath);

        const resolvedPath = pnpApi.resolveToUnqualified(packageName, this.cwd, {
          considerBuiltins: false,
        });

        const pkgLocator = pnpApi.findPackageLocator(resolvedPath);
        const pkg = pnpApi.getPackageInformation(pkgLocator);

        const packageJSON = JSON.parse(
          readFileSync(join(pkg.packageLocation, 'package.json'), 'utf-8')
        );

        return packageJSON;
      } catch (error: any) {
        if (error.code !== 'MODULE_NOT_FOUND') {
          console.error('Error while fetching package version in PNPM PnP mode:', error);
        }
        return null;
      }
    }

    const packageJsonPath = findUpSync(
      (dir) => {
        const possiblePath = join(dir, 'node_modules', packageName, 'package.json');
        return existsSync(possiblePath) ? possiblePath : undefined;
      },
      { cwd: this.cwd, stopAt: getProjectRoot() }
    );

    if (!packageJsonPath) {
      return null;
    }

    return JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  }

  protected getResolutions(packageJson: PackageJson, versions: Record<string, string>) {
    return {
      overrides: {
        ...packageJson.overrides,
        ...versions,
      },
    };
  }

  protected runInstall() {
    return this.executeCommand({
      command: 'pnpm',
      args: ['install', ...this.getInstallArgs()],
      stdio: prompt.getPreferredStdio(),
      cwd: this.cwd,
    });
  }

  protected runAddDeps(dependencies: string[], installAsDevDependencies: boolean) {
    let args = [...dependencies];

    if (installAsDevDependencies) {
      args = ['-D', ...args];
    }

    const commandArgs = ['add', ...args, ...this.getInstallArgs()];

    return this.executeCommand({
      command: 'pnpm',
      args: commandArgs,
      stdio: prompt.getPreferredStdio(),
      cwd: this.primaryPackageJson.operationDir,
    });
  }

  protected async runGetVersions<T extends boolean>(
    packageName: string,
    fetchAllVersions: T
  ): Promise<T extends true ? string[] : string> {
    const args = fetchAllVersions ? ['versions', '--json'] : ['version'];

    try {
      const process = this.executeCommand({
        command: 'pnpm',
        args: ['info', packageName, ...args],
      });
      const result = await process;
      const commandResult = result.stdout ?? '';

      const parsedOutput = fetchAllVersions ? JSON.parse(commandResult) : commandResult.trim();

      if (parsedOutput.error?.summary) {
        // this will be handled in the catch block below
        throw parsedOutput.error.summary;
      }

      return parsedOutput;
    } catch (error) {
      throw new FindPackageVersionsError({
        error,
        packageManager: 'PNPM',
        packageName,
      });
    }
  }

  protected mapDependencies(input: PnpmListOutput, pattern: string[]): InstallationMetadata {
    const acc: Record<string, PackageMetadata[]> = {};
    const existingVersions: Record<string, string[]> = {};
    const duplicatedDependencies: Record<string, string[]> = {};
    const items: PnpmDependencies = input.reduce((curr, item) => {
      const { devDependencies, dependencies, peerDependencies } = item;
      const allDependencies = { ...devDependencies, ...dependencies, ...peerDependencies };
      return Object.assign(curr, allDependencies);
    }, {} as PnpmDependencies);

    const recurse = ([name, packageInfo]: [string, PnpmDependency]): void => {
      // transform pattern into regex where `*` is replaced with `.*`
      if (!name || !pattern.some((p) => new RegExp(`^${p.replace(/\*/g, '.*')}$`).test(name))) {
        return;
      }

      const value = {
        version: packageInfo.version,
        location: '',
      };

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

      if (packageInfo.dependencies) {
        Object.entries(packageInfo.dependencies).forEach(recurse);
      }
    };
    Object.entries(items).forEach(recurse);

    return {
      dependencies: acc,
      duplicatedDependencies,
      infoCommand: 'pnpm list --depth=1',
      dedupeCommand: 'pnpm dedupe',
    };
  }

  public parseErrorFromLogs(logs: string): string {
    let finalMessage = 'PNPM error';
    const match = logs.match(PNPM_ERROR_REGEX);
    if (match) {
      const [errorCode] = match;
      if (errorCode) {
        finalMessage = `${finalMessage} ${errorCode}`;
      }
    }

    return finalMessage.trim();
  }
}
