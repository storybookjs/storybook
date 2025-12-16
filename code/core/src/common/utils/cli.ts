import type { WriteStream } from 'node:fs';
import { createWriteStream, mkdirSync } from 'node:fs';
import { copyFile, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

import { type MergeExclusive } from 'type-fest';
import uniqueString from 'unique-string';

import type { JsPackageManager } from '../js-package-manager';
import satelliteAddons from '../satellite-addons';
import storybookPackagesVersions from '../versions';

const tempDir = () => realpath(os.tmpdir());

const getPath = async (prefix = '') => join(await tempDir(), prefix + uniqueString());

export async function temporaryDirectory({ prefix = '' } = {}) {
  const directory = await getPath(prefix);
  mkdirSync(directory);
  return directory;
}

export type FileOptions = MergeExclusive<
  {
    /**
     * File extension.
     *
     * Mutually exclusive with the `name` option.
     *
     * _You usually won't need this option. Specify it only when actually needed._
     */
    readonly extension?: string;
  },
  {
    /**
     * Filename.
     *
     * Mutually exclusive with the `extension` option.
     *
     * _You usually won't need this option. Specify it only when actually needed._
     */
    readonly name?: string;
  }
>;

export async function temporaryFile({ name, extension }: FileOptions = {}) {
  if (name) {
    if (extension !== undefined && extension !== null) {
      throw new Error('The `name` and `extension` options are mutually exclusive');
    }

    return join(await temporaryDirectory(), name);
  }

  return (
    (await getPath()) +
    (extension === undefined || extension === null ? '' : '.' + extension.replace(/^\./, ''))
  );
}

export function parseList(str: string): string[] {
  return str
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getEnvConfig(
  program: Record<string, unknown>,
  configEnv: Record<string, string | string[]>
): void {
  Object.keys(configEnv).forEach((fieldName) => {
    const envVarNames = Array.isArray(configEnv[fieldName])
      ? configEnv[fieldName]
      : [configEnv[fieldName]];

    const envVarValue = envVarNames.find((envVarName) => process.env[envVarName]);
    if (envVarValue) {
      program[fieldName] = process.env[envVarValue];
    }
  });
}

/**
 * Given a file name, creates an object with utilities to manage a log file. It creates a temporary
 * log file which you can manage with the returned functions. You can then decide whether to move
 * the log file to the users project, or remove it.
 *
 * @example
 *
 * ```ts
 * const { logStream, moveLogFile, removeLogFile, clearLogFile, readLogFile } =
 *   await createLogStream('my-log-file.log');
 *
 * // SCENARIO 1:
 * // you can write custom messages to generate a log file
 * logStream.write('my log message');
 * await moveLogFile();
 *
 * // SCENARIO 2:
 * // or you can pass it to stdio and capture the output of that command
 * try {
 *   await executeCommand({
 *     command: 'pnpm',
 *     args: ['info', packageName, ...args],
 *     // do not output to the user, and send stdio and stderr to log file
 *     stdio: ['ignore', logStream, logStream],
 *   });
 * } catch (err) {
 *   // do something with the log file content
 *   const output = await readLogFile();
 *   // move the log file to the users project
 *   await moveLogFile();
 * }
 * // success, no need to keep the log file
 * await removeLogFile();
 * ```
 */
export const createLogStream = async (
  logFileName = 'storybook.log'
): Promise<{
  moveLogFile: () => Promise<void>;
  removeLogFile: () => Promise<void>;
  clearLogFile: () => Promise<void>;
  readLogFile: () => Promise<string>;
  logStream: WriteStream;
}> => {
  const finalLogPath = join(process.cwd(), logFileName);
  const temporaryLogPath = await temporaryFile({ name: logFileName });

  const logStream = createWriteStream(temporaryLogPath, { encoding: 'utf8' });

  return new Promise((resolve, reject) => {
    logStream.once('open', () => {
      const clearLogFile = async () => writeFile(temporaryLogPath, '');
      const removeLogFile = async () => rm(temporaryLogPath, { recursive: true, force: true });
      const readLogFile = async () => readFile(temporaryLogPath, { encoding: 'utf8' });
      // Can't use rename because it doesn't work across disks.
      const moveLogFile = async () => copyFile(temporaryLogPath, finalLogPath).then(removeLogFile);
      resolve({ logStream, moveLogFile, clearLogFile, removeLogFile, readLogFile });
    });
    logStream.once('error', reject);
  });
};

export const isCorePackage = (pkg: string) =>
  !!storybookPackagesVersions[pkg as keyof typeof storybookPackagesVersions];
export const isSatelliteAddon = (pkg: string) => satelliteAddons.includes(pkg);
