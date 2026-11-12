// Ecosystem CI runners override packages only in the monorepo they clone, but the tests run in the
// sandbox, so this copies those overrides into the sandbox package.json as resolutions.
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';

import { disableMinimumReleaseAge } from './disable-minimum-release-age.ts';
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
// The sandbox's minimum release age would block the just-published builds under test.
await disableMinimumReleaseAge(sandboxDir);
await execaCommand('pnpm add playwright', { cwd: sandboxDir, shell: true });
await execaCommand('pnpm exec playwright install', { cwd: sandboxDir, shell: true });
