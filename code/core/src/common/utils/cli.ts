import { type WriteStream, createWriteStream, mkdirSync } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

import { move, remove } from '@ndelangen/fs-extra-unified';
import { type MergeExclusive } from 'type-fest';
import uniqueString from 'unique-string';

import type { JsPackageManager } from '../js-package-manager';
import versions from '../versions';
import { rendererPackages } from './get-storybook-info';

const tempDir = () => realpath(os.tmpdir());

const getPath = async (prefix = '') => join(await tempDir(), prefix + uniqueString());

export async function temporaryDirectory({ prefix = '' } = {}) {
  const directory = await getPath(prefix);
  await mkdirSync(directory);
  return directory;
}

export type FileOptions = MergeExclusive<
  {
    /**
	File extension.

	Mutually exclusive with the `name` option.

	_You usually won't need this option. Specify it only when actually needed._
	*/
    readonly extension?: string;
  },
  {
    /**
	Filename.

	Mutually exclusive with the `extension` option.

	_You usually won't need this option. Specify it only when actually needed._
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

/**
 * Given a package manager, returns the coerced version of Storybook.
 * It tries to find renderer packages in the project and returns the coerced version of the first one found.
 * Example:
 * If @storybook/react version 8.0.0-alpha.14 is installed, it returns the coerced version 8.0.0
 */
export async function getCoercedStorybookVersion(packageManager: JsPackageManager) {
  const packages = (
    await Promise.all(
      Object.keys(rendererPackages).map(async (pkg) => ({
        name: pkg,
        version: await packageManager.getPackageVersion(pkg),
      }))
    )
  ).filter(({ version }) => !!version);

  return packages[0]?.version;
}

export function getEnvConfig(program: Record<string, any>, configEnv: Record<string, any>): void {
  Object.keys(configEnv).forEach((fieldName) => {
    const envVarName = configEnv[fieldName];
    const envVarValue = process.env[envVarName];
    if (envVarValue) {
      program[fieldName] = envVarValue;
    }
  });
}

/**
 * Given a file name, creates an object with utilities to manage a log file.
 * It creates a temporary log file which you can manage with the returned functions.
 * You can then decide whether to move the log file to the users project, or remove it.
 *
 * @example
 * ```
 *  const { logStream, moveLogFile, removeLogFile, clearLogFile, readLogFile } = await createLogStream('my-log-file.log');
 *
 *  // SCENARIO 1:
 *  // you can write custom messages to generate a log file
 *  logStream.write('my log message');
 *  await moveLogFile();
 *
 *  // SCENARIO 2:
 *  // or you can pass it to stdio and capture the output of that command
 *  try {
 *    await this.executeCommand({
 *      command: 'pnpm',
 *      args: ['info', packageName, ...args],
 *      // do not output to the user, and send stdio and stderr to log file
 *      stdio: ['ignore', logStream, logStream]
 *    });
 *  } catch (err) {
 *    // do something with the log file content
 *    const output = await readLogFile();
 *    // move the log file to the users project
 *    await moveLogFile();
 *  }
 *  // success, no need to keep the log file
 *  await removeLogFile();
 *
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
      const moveLogFile = async () => move(temporaryLogPath, finalLogPath, { overwrite: true });
      const clearLogFile = async () => writeFile(temporaryLogPath, '');
      const removeLogFile = async () => remove(temporaryLogPath);
      const readLogFile = async () => {
        return readFile(temporaryLogPath, 'utf8');
      };
      resolve({ logStream, moveLogFile, clearLogFile, removeLogFile, readLogFile });
    });
    logStream.once('error', reject);
  });
};

export const isCorePackage = (pkg: string) => Object.keys(versions).includes(pkg);
