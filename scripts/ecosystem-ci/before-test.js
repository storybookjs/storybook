/**
 * This script is used to copy the resolutions from the root package.json to the sandbox
 * package.json. This is necessary because the sandbox package.json is used to run the tests and the
 * resolutions are needed to run the tests. The vite-ecosystem-ci, though, sets the resolutions in
 * the root package.json.
 */
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';

import { EXISTING_RESOLUTIONS } from './existing-resolutions.js';

const filename = fileURLToPath(import.meta.url);
const __dirname = dirname(filename);

const sandbox = process.argv[2] ?? 'react-vite/default-ts';

const sandboxPackageJsonPath = resolve(
  __dirname,
  `../../../storybook-sandboxes/${sandbox.replace('/', '-')}/package.json`
);

const { default: rootPkgJson } = await import('../../package.json', { with: { type: 'json' } });
const { default: sandboxPkgJson } = await import(sandboxPackageJsonPath, {
  with: { type: 'json' },
});

// copy resolutions from root package.json to sandbox package.json, excluding the known resolutions we have internally in our repo
// ecosystem-ci will add resolutions to the root package.json, and we want to propagate ONLY those to the sandbox package.json
const resolutionsToCopy = rootPkgJson.resolutions
  ? Object.fromEntries(
      Object.entries(rootPkgJson.resolutions).filter(([pkg]) => !EXISTING_RESOLUTIONS.has(pkg))
    )
  : {};

sandboxPkgJson.resolutions = {
  ...(sandboxPkgJson.resolutions ?? {}),
  ...resolutionsToCopy,
};

await writeFile(sandboxPackageJsonPath, JSON.stringify(sandboxPkgJson, null, 2));

const sandboxDir = dirname(sandboxPackageJsonPath);
await execaCommand('yarn add playwright', { cwd: sandboxDir, shell: true });
await execaCommand('yarn playwright install', { cwd: sandboxDir, shell: true });
