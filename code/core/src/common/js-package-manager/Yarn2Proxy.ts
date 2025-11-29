import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { prompt } from 'storybook/internal/node-logger';
import { FindPackageVersionsError } from 'storybook/internal/server-errors';

import { PosixFS, VirtualFS, ZipOpenFS } from '@yarnpkg/fslib';
import { getLibzipSync } from '@yarnpkg/libzip';
import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import type { ResultPromise } from 'execa';

import { logger } from '../../node-logger';
import type { ExecuteCommandOptions } from '../utils/command';
import { executeCommand } from '../utils/command';
import { getProjectRoot } from '../utils/paths';
import { JsPackageManager, PackageManagerName } from './JsPackageManager';
import type { PackageJson } from './PackageJson';
import type { InstallationMetadata, PackageMetadata } from './types';
import { parsePackageData } from './util';

// more info at https://yarnpkg.com/advanced/error-codes
const CRITICAL_YARN2_ERROR_CODES = {
  YN0001: 'EXCEPTION',
  YN0002: 'MISSING_PEER_DEPENDENCY',
  YN0003: 'CYCLIC_DEPENDENCIES',
  YN0004: 'DISABLED_BUILD_SCRIPTS',
  YN0005: 'BUILD_DISABLED',
  YN0006: 'SOFT_LINK_BUILD',
  YN0007: 'MUST_BUILD',
  YN0008: 'MUST_REBUILD',
  YN0009: 'BUILD_FAILED',
  YN0010: 'RESOLVER_NOT_FOUND',
  YN0011: 'FETCHER_NOT_FOUND',
  YN0012: 'LINKER_NOT_FOUND',
  YN0013: 'FETCH_NOT_CACHED',
  YN0014: 'YARN_IMPORT_FAILED',
  YN0015: 'REMOTE_INVALID',
  YN0016: 'REMOTE_NOT_FOUND',
  YN0018: 'CACHE_CHECKSUM_MISMATCH',
  YN0019: 'UNUSED_CACHE_ENTRY',
  YN0020: 'MISSING_LOCKFILE_ENTRY',
  YN0022: 'TOO_MANY_MATCHING_WORKSPACES',
  YN0023: 'CONSTRAINTS_MISSING_DEPENDENCY',
  YN0024: 'CONSTRAINTS_INCOMPATIBLE_DEPENDENCY',
  YN0025: 'CONSTRAINTS_EXTRANEOUS_DEPENDENCY',
  YN0026: 'CONSTRAINTS_INVALID_DEPENDENCY',
  YN0027: 'CANT_SUGGEST_RESOLUTIONS',
  YN0028: 'FROZEN_LOCKFILE_EXCEPTION',
  YN0029: 'CROSS_DRIVE_VIRTUAL_LOCAL',
  YN0030: 'FETCH_FAILED',
  YN0031: 'DANGEROUS_NODE_MODULES',
  YN0035: 'NETWORK_ERROR',
  YN0046: 'AUTOMERGE_FAILED_TO_PARSE',
  YN0047: 'AUTOMERGE_IMMUTABLE',
  YN0048: 'AUTOMERGE_SUCCESS',
  YN0049: 'AUTOMERGE_REQUIRED',
  YN0050: 'DEPRECATED_CLI_SETTINGS',
  YN0059: 'INVALID_RANGE_PEER_DEPENDENCY',
  YN0060: 'INCOMPATIBLE_PEER_DEPENDENCY',
  YN0062: 'INCOMPATIBLE_OS',
  YN0063: 'INCOMPATIBLE_CPU',
  YN0069: 'REDUNDANT_PACKAGE_EXTENSION',
  YN0071: 'NM_CANT_INSTALL_EXTERNAL_SOFT_LINK',
  YN0072: 'NM_PRESERVE_SYMLINKS_REQUIRED',
  YN0074: 'NM_HARDLINKS_MODE_DOWNGRADED',
  YN0075: 'PROLOG_INSTANTIATION_ERROR',
  YN0076: 'INCOMPATIBLE_ARCHITECTURE',
  YN0077: 'GHOST_ARCHITECTURE',
  YN0078: 'RESOLUTION_MISMATCH',
  YN0080: 'NETWORK_DISABLED',
  YN0081: 'NETWORK_UNSAFE_HTTP',
  YN0082: 'RESOLUTION_FAILED',
  YN0083: 'AUTOMERGE_GIT_ERROR',
  YN0086: 'EXPLAIN_PEER_DEPENDENCIES_CTA',
  YN0090: 'OFFLINE_MODE_ENABLED',
};

// This encompasses Yarn Berry (v2+)
export class Yarn2Proxy extends JsPackageManager {
  readonly type = PackageManagerName.YARN2;

  installArgs: string[] | undefined;

  getInstallArgs(): string[] {
    if (!this.installArgs) {
      this.installArgs = [];
    }
    return this.installArgs;
  }

  getRunCommand(command: string): string {
    return `yarn ${command}`;
  }

  getPackageCommand(args: string[]): string {
    return `yarn exec ${args.join(' ')}`;
  }

  public runPackageCommand({
    args,
    ...options
  }: Omit<ExecuteCommandOptions, 'command'> & { args: string[] }): ResultPromise {
    return executeCommand({
      command: 'yarn',
      args: ['exec', ...args],
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
      command: 'yarn',
      args: [command, ...args],
      cwd: cwd ?? this.cwd,
      stdio,
    });
  }

  public async findInstallations(pattern: string[], { depth = 99 }: { depth?: number } = {}) {
    const yarnArgs = ['info', '--name-only'];

    if (depth !== 0) {
      yarnArgs.push('--recursive');
    }

    try {
      const childProcess = await executeCommand({
        command: 'yarn',
        args: yarnArgs.concat(pattern),
        env: {
          FORCE_COLOR: 'false',
        },
        cwd: this.instanceDir,
      });
      const commandResult = typeof childProcess.stdout === 'string' ? childProcess.stdout : '';

      logger.debug(`Installation found for ${pattern.join(', ')}: ${commandResult}`);

      return this.mapDependencies(commandResult, pattern);
    } catch (e) {
      return undefined;
    }
  }

  // TODO: Remove pnp compatibility code in SB11
  async getModulePackageJSON(packageName: string): Promise<PackageJson | null> {
    const pnpapiPath = find.any(['.pnp.js', '.pnp.cjs'], {
      cwd: this.primaryPackageJson.operationDir,
      last: getProjectRoot(),
    });

    if (pnpapiPath) {
      try {
        /*
          This is a rather fragile way to access Yarn's PnP API, essentially manually loading it.
          The proper way to do this would be to just do await import('pnpapi'),
          as documented at https://yarnpkg.com/advanced/pnpapi#requirepnpapi

          However the 'pnpapi' module is only injected when the Node process is started via Yarn,
          which is not always the case for us, because we spawn child processes directly with Node,
          eg. when running automigrations.
        */
        const { default: pnpApi } = await import(pathToFileURL(pnpapiPath).href);

        const resolvedPath = pnpApi.resolveToUnqualified(
          packageName,
          this.primaryPackageJson.operationDir,
          {
            considerBuiltins: false,
          }
        );

        const pkgLocator = pnpApi.findPackageLocator(resolvedPath);
        const pkg = pnpApi.getPackageInformation(pkgLocator);

        const zipOpenFs = new ZipOpenFS({
          libzip: getLibzipSync(),
        });

        const virtualFs = new VirtualFS({ baseFs: zipOpenFs });
        const crossFs = new PosixFS(virtualFs);

        const virtualPath = join(pkg.packageLocation, 'package.json');

        return crossFs.readJsonSync(virtualPath);
      } catch (error: any) {
        if (error.code !== 'ERR_MODULE_NOT_FOUND') {
          console.error('Error while fetching package version in Yarn PnP mode:', error);
        }
        return null;
      }
    }

    const wantedPath = join('node_modules', packageName, 'package.json');
    const packageJsonPath = find.up(wantedPath, {
      cwd: this.primaryPackageJson.operationDir,
      last: getProjectRoot(),
    });

    if (!packageJsonPath) {
      return null;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson;
  }

  protected getResolutions(packageJson: PackageJson, versions: Record<string, string>) {
    return {
      resolutions: {
        ...packageJson.resolutions,
        ...versions,
      },
    };
  }

  protected runInstall() {
    return executeCommand({
      command: 'yarn',
      args: ['install', ...this.getInstallArgs()],
      cwd: this.cwd,
      stdio: prompt.getPreferredStdio(),
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

  public async getRegistryURL() {
    const process = executeCommand({
      command: 'yarn',
      args: ['config', 'get', 'npmRegistryServer'],
    });
    const result = await process;
    const url = (typeof result.stdout === 'string' ? result.stdout : '').trim();
    return url === 'undefined' ? undefined : url;
  }

  protected async runGetVersions<T extends boolean>(
    packageName: string,
    fetchAllVersions: T
  ): Promise<T extends true ? string[] : string> {
    const field = fetchAllVersions ? 'versions' : 'version';
    const args = ['--fields', field, '--json'];
    try {
      const process = executeCommand({
        command: 'yarn',
        args: ['npm', 'info', packageName, ...args],
      });
      const result = await process;
      const commandResult = typeof result.stdout === 'string' ? result.stdout : '';

      const parsedOutput = JSON.parse(commandResult);
      return parsedOutput[field];
    } catch (error) {
      throw new FindPackageVersionsError({
        error,
        packageManager: 'Yarn Berry',
        packageName,
      });
    }
  }

  protected mapDependencies(input: string, pattern: string[]): InstallationMetadata {
    const lines = input.split('\n');
    const acc: Record<string, PackageMetadata[]> = {};
    const existingVersions: Record<string, string[]> = {};
    const duplicatedDependencies: Record<string, string[]> = {};

    lines.forEach((packageName) => {
      logger.debug(`Processing package ${packageName}`);
      if (
        !packageName ||
        !pattern.some((p) => new RegExp(`${p.replace(/\*/g, '.*')}`).test(packageName))
      ) {
        return;
      }

      const { name, value } = parsePackageData(packageName.replaceAll(`"`, ''));
      logger.debug(`Package ${name} found with version ${value.version}`);
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
    });

    return {
      dependencies: acc,
      duplicatedDependencies,
      infoCommand: 'yarn why',
      dedupeCommand: 'yarn dedupe',
    };
  }

  public parseErrorFromLogs(logs: string): string {
    const finalMessage = 'YARN2 error';
    const errorCodesWithMessages: { code: string; message: string }[] = [];
    const regex = /(YN\d{4}): (.+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(logs)) !== null) {
      const code = match[1];
      const message = match[2].replace(/[┌│└]/g, '').trim();
      if (code in CRITICAL_YARN2_ERROR_CODES) {
        errorCodesWithMessages.push({
          code,
          message: `${
            CRITICAL_YARN2_ERROR_CODES[code as keyof typeof CRITICAL_YARN2_ERROR_CODES]
          }\n-> ${message}\n`,
        });
      }
    }

    return [
      finalMessage,
      errorCodesWithMessages.map(({ code, message }) => `${code}: ${message}`).join('\n'),
    ].join('\n');
  }
}
