/**
 * This script is used to copy the resolutions from the root package.json to the sandbox
 * package.json. This is necessary because the sandbox package.json is used to run the tests and the
 * resolutions are needed to run the tests. The vite-ecosystem-ci, though, sets the resolutions in
 * the root package.json.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';

const filename = fileURLToPath(import.meta.url);
const __dirname = dirname(filename);

const sandbox = process.argv[2] ?? 'react-vite/default-ts';

const rootPackageJsonPath = resolve(__dirname, '../../package.json');
const sandboxPackageJsonPath = resolve(
  __dirname,
  `../../../storybook-sandboxes/${sandbox.replace('/', '-')}/package.json`
);

const rootPackageJson = JSON.parse(await readFile(rootPackageJsonPath, 'utf-8'));
const sandboxPackageJson = JSON.parse(await readFile(sandboxPackageJsonPath, 'utf-8'));

const resolutions = rootPackageJson.resolutions
  ? Object.fromEntries(
      Object.entries(rootPackageJson.resolutions).filter(([_, v]) => v.includes('patch:'))
    )
  : {};

sandboxPackageJson.resolutions = {
  ...(sandboxPackageJson.resolutions ?? {}),
  resolutions,
};

await writeFile(sandboxPackageJsonPath, JSON.stringify(sandboxPackageJson, null, 2));
const sandboxDir = dirname(sandboxPackageJsonPath);

await execaCommand('yarn add playwright', { cwd: sandboxDir, shell: true });
await execaCommand('yarn playwright install', { cwd: sandboxDir, shell: true });
