/**
 * This script is used to copy the resolutions from the root package.json to the sandbox package.json.
 * This is necessary because the sandbox package.json is used to run the tests and the resolutions are needed to run the tests.
 * The vite-ecosystem-ci, though, sets the resolutions in the root package.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execaCommand, execa } from 'execa';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const rootPackageJsonPath = path.resolve(dirname, '../../package.json');
const sandboxPackageJsonPath = path.resolve(
  dirname,
  '../../sandbox/react-vite-default-ts/package.json'
);

const rootPackageJson = JSON.parse(await fs.promises.readFile(rootPackageJsonPath, 'utf-8'));
const sandboxPackageJson = JSON.parse(await fs.promises.readFile(sandboxPackageJsonPath, 'utf-8'));

sandboxPackageJson.resolutions = {
  ...(sandboxPackageJson.resolutions ?? {}),
  ...rootPackageJson.resolutions,
};

await fs.promises.writeFile(sandboxPackageJsonPath, JSON.stringify(sandboxPackageJson, null, 2));
const sandboxFolder = path.dirname(sandboxPackageJsonPath);
await execa('yarn add playwright', { cwd: sandboxFolder, shell: true });
await execaCommand('yarn playwright install', { cwd: sandboxFolder, shell: true });
