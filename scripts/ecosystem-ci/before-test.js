/**
 * Copies the overrides an ecosystem CI runner injected into the monorepo over to the sandbox
 * package.json as Yarn resolutions. The runner only patches the repository it cloned, but the tests
 * run in the sandbox, which is a separate Yarn project.
 */
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';

import { disableNpmMinimalAgeGate } from './disable-npm-minimal-age-gate.ts';
import { readRootOverrides, toSandboxResolutions } from './sandbox-resolutions.ts';

const filename = fileURLToPath(import.meta.url);
const __dirname = dirname(filename);

const sandbox = process.argv[2] ?? 'react-vite/default-ts';

const sandboxPackageJsonPath = resolve(
  __dirname,
  `../../../storybook-sandboxes/${sandbox.replace('/', '-')}/package.json`
);

const rootOverrides = await readRootOverrides(resolve(__dirname, '../..'));
const { default: sandboxPkgJson } = await import(sandboxPackageJsonPath, {
  with: { type: 'json' },
});

sandboxPkgJson.resolutions = {
  ...(sandboxPkgJson.resolutions ?? {}),
  ...toSandboxResolutions(rootOverrides),
};

await writeFile(sandboxPackageJsonPath, JSON.stringify(sandboxPkgJson, null, 2));

const sandboxDir = dirname(sandboxPackageJsonPath);
// The runner disables the monorepo's age gate before installing it, but not the sandbox's, which
// would quarantine the freshly published builds under test.
await disableNpmMinimalAgeGate(sandboxDir);
await execaCommand('yarn add playwright', { cwd: sandboxDir, shell: true });
await execaCommand('yarn playwright install', { cwd: sandboxDir, shell: true });
