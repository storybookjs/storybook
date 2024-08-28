/**
 * This script is used to copy the resolutions from the root package.json to the sandbox
 * package.json. This is necessary because the sandbox package.json is used to run the tests and the
 * resolutions are needed to run the tests. The vite-ecosystem-ci, though, sets the resolutions in
 * the root package.json.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { execa, execaCommand } from 'execa';

const filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
const __dirname = dirname(filename);

const rootPackageJsonPath = resolve(__dirname, '../../package.json');
const sandboxPackageJsonPath = resolve(
  __dirname,
  '../../sandbox/react-vite-default-ts/package.json'
);

const rootPackageJson = JSON.parse(await readFile(rootPackageJsonPath, 'utf-8'));
const sandboxPackageJson = JSON.parse(await readFile(sandboxPackageJsonPath, 'utf-8'));

sandboxPackageJson.resolutions = {
  ...(sandboxPackageJson.resolutions ?? {}),
  ...rootPackageJson.resolutions,
};

await writeFile(sandboxPackageJsonPath, JSON.stringify(sandboxPackageJson, null, 2));
const sandboxFolder = dirname(sandboxPackageJsonPath);

await execaCommand('yarn add playwright', { cwd: sandboxFolder, shell: true });
await execaCommand('yarn playwright install', { cwd: sandboxFolder, shell: true });
